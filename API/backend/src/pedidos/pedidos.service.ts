import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
} from 'typeorm';
import { Caja, EstadoCaja } from '../caja/caja.entity';
import { Producto } from '../productos/producto.entity';
import { DetallePedido } from './detalle-pedido.entity';
import {
  Pedido,
  EstadoPago,
  EstadoPedido,
  MetodoPago,
  TipoPedido,
} from './pedido.entity';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';

type Rol = 'GERENTE' | 'CAJERO' | 'COCINA';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(DetallePedido) private readonly detalles: Repository<DetallePedido>,
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
    private readonly dataSource: DataSource,
  ) {}

  private parseDateMaybe(v?: string) {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  private async preciosPorId(ids: number[]) {
    if (!ids.length) return new Map<number, number>();
    const prods = await this.productos.find({ where: { id_producto: In(ids) } });
    const map = new Map<number, number>();
    for (const p of prods) map.set(p.id_producto, Number(p.precio));
    return map;
  }

  private async recalcularTotal(id_pedido: number, mgr = this.pedidos.manager) {
    const { sum } =
      (await mgr
        .createQueryBuilder(DetallePedido, 'd')
        .select("COALESCE(SUM(d.subtotal), 0)", 'sum')
        .where('d.id_pedido = :id', { id: id_pedido })
        .getRawOne<{ sum: string }>()) ?? { sum: '0' };
    const p = await mgr.findOneBy(Pedido, { id_pedido });
    if (!p) throw new NotFoundException('Pedido no existe');
    p.total = Number(sum).toFixed(2);
    await mgr.save(p);
    return p.total;
  }

  /** Crear pedido */
  async crear(userId: number, _rol: Rol, dto: CreatePedidoDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('El pedido debe tener al menos un item');
    }

    const caja = await this.cajas.findOne({ where: { id_caja: dto.id_caja } });
    if (!caja) throw new NotFoundException('Caja no existe');
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('La caja no está ABIERTA');
    }

    if (dto.tipo_pedido === TipoPedido.MESA && !dto.num_mesa) {
      throw new BadRequestException('num_mesa es obligatorio para MESA');
    }

    const ids = [...new Set(dto.items.map((i) => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const pedido = await qr.manager.save(Pedido, {
        id_usuario: userId,
        id_caja: dto.id_caja,
        tipo_pedido: dto.tipo_pedido,
        num_mesa: dto.tipo_pedido === TipoPedido.MESA ? dto.num_mesa! : null,
        metodo_pago: dto.metodo_pago,
        estado_pago: EstadoPago.SIN_PAGAR,
        estado_pedido: EstadoPedido.PENDIENTE,
        total: '0.00',
      });

      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) {
          throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        }
        const subtotal = Number(precio * it.cantidad);
        await qr.manager.save(DetallePedido, {
          id_pedido: pedido.id_pedido,
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
        });
      }

      const total = await this.recalcularTotal(pedido.id_pedido, qr.manager);
      await qr.commitTransaction();
      return { id_pedido: pedido.id_pedido, total };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Editar cabecera / reemplazar items (si viene `items`) */
  async actualizar(_rol: Rol, id_pedido: number, dto: UpdatePedidoDto) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) {
      throw new ForbiddenException('No se puede editar un pedido PAGADO');
    }

    if (dto.tipo_pedido !== undefined) p.tipo_pedido = dto.tipo_pedido;
    if (dto.num_mesa !== undefined) p.num_mesa = dto.num_mesa as any;
    if (dto.metodo_pago !== undefined) p.metodo_pago = dto.metodo_pago;

    if (!dto.items) {
      await this.pedidos.save(p);
      return { ok: true };
    }

    // Reemplazar lista completa
    const ids = [...new Set(dto.items.map((i) => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.save(p); // guardar cabecera

      await qr.manager.delete(DetallePedido, { id_pedido });
      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) {
          throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        }
        const subtotal = Number(precio * it.cantidad);
        await qr.manager.save(DetallePedido, {
          id_pedido,
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
        });
      }
      // vuelve a PENDIENTE para que cocina lo vea
      p.estado_pedido = EstadoPedido.PENDIENTE;
      await qr.manager.save(p);

      const total = await this.recalcularTotal(id_pedido, qr.manager);
      await qr.commitTransaction();
      return { ok: true, total };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Agregar ítems (incremental) */
  async agregarItems(id_pedido: number, items: { id_producto: number; cantidad: number; notas?: string }[]) {
    if (!items?.length) throw new BadRequestException('Debes enviar al menos un ítem');

    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) {
      throw new ForbiddenException('No se puede editar un pedido PAGADO');
    }

    const ids = [...new Set(items.map((i) => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const it of items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);

        await qr.manager.save(DetallePedido, {
          id_pedido,
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
        });
      }
      // vuelve a PENDIENTE para cocina
      p.estado_pedido = EstadoPedido.PENDIENTE;
      await qr.manager.save(p);

      const total = await this.recalcularTotal(id_pedido, qr.manager);
      await qr.commitTransaction();
      return { ok: true, total };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Editar un ítem existente (cantidad / notas) */
  async editarItem(id_pedido: number, id_detalle: number, dto: { cantidad?: number; notas?: string | null }) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) {
      throw new ForbiddenException('No se puede editar un pedido PAGADO');
    }

    const d = await this.detalles.findOne({ where: { id_detalle_pedido: id_detalle, id_pedido } });
    if (!d) throw new NotFoundException('Detalle no encontrado');

    if (dto.cantidad !== undefined) {
      if (!Number.isInteger(dto.cantidad) || dto.cantidad < 1) {
        throw new BadRequestException('Cantidad inválida');
      }
      d.cantidad = dto.cantidad;
      d.subtotal = (Number(d.precio_unitario) * d.cantidad).toFixed(2);
    }
    if (dto.notas !== undefined) d.notas = dto.notas;

    await this.detalles.save(d);

    // vuelve a PENDIENTE para cocina
    p.estado_pedido = EstadoPedido.PENDIENTE;
    await this.pedidos.save(p);

    const total = await this.recalcularTotal(id_pedido);
    return { ok: true, total };
  }

  /** Eliminar un ítem del pedido */
  async eliminarItem(id_pedido: number, id_detalle: number) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) {
      throw new ForbiddenException('No se puede editar un pedido PAGADO');
    }

    const res = await this.detalles.delete({ id_detalle_pedido: id_detalle, id_pedido });
    if (!res.affected) throw new NotFoundException('Detalle no encontrado');

    // vuelve a PENDIENTE para cocina
    p.estado_pedido = EstadoPedido.PENDIENTE;
    await this.pedidos.save(p);

    const total = await this.recalcularTotal(id_pedido);
    return { ok: true, total };
  }

  /** Cambiar estado del pedido (cocina / gerente) */
  async setEstadoPedido(id_pedido: number, estado: EstadoPedido) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');

    // Regla: si ya estaba LISTO y cocina intenta volver a PENDIENTE
    if (p.estado_pedido === EstadoPedido.LISTO && estado === EstadoPedido.PENDIENTE) {
      // Permitir solo si lo cambió el cajero editando; aquí lo permitimos manualmente si lo piden:
      // throw new BadRequestException('No se puede volver a PENDIENTE');
    }
    p.estado_pedido = estado;
    await this.pedidos.save(p);
    return { ok: true };
  }

  /** Marcar como pagado (opcionalmente cambiar método) */
  async pagar(id_pedido: number, metodo?: MetodoPago) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (metodo) p.metodo_pago = metodo;
    p.estado_pago = EstadoPago.PAGADO;
    await this.pedidos.save(p);
    return { ok: true };
  }

  /** Eliminar pedido (solo si no está PAGADO) */
  async eliminar(id_pedido: number) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) {
      throw new ForbiddenException('No se puede eliminar un pedido PAGADO');
    }
    await this.pedidos.delete(id_pedido);
    return { ok: true };
  }

  /** Ver pedido con items y productos */
  async uno(id_pedido: number) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
      order: { items: { id_detalle_pedido: 'ASC' } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    return p;
  }

  /** Listar con filtros y paginación */
  async listar(q: QueryPedidosDto) {
    const where: any = {};
    if (q.caja) where.id_caja = q.caja;
    if (q.tipo_pedido) where.tipo_pedido = q.tipo_pedido;
    if (q.num_mesa !== undefined) where.num_mesa = q.num_mesa;
    if (q.estado_pago) where.estado_pago = q.estado_pago;
    if (q.estado_pedido) where.estado_pedido = q.estado_pedido;
    if (q.metodo_pago) where.metodo_pago = q.metodo_pago;

    const d1 = this.parseDateMaybe(q.desde);
    const d2 = this.parseDateMaybe(q.hasta);
    if (d1 && d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      where.created_at = Between(d1, end);
    } else if (d1) where.created_at = MoreThanOrEqual(d1);
    else if (d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      where.created_at = LessThanOrEqual(end);
    }

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(q.pageSize ?? 50)));

    const [rows, total] = await this.pedidos.findAndCount({
      where,
      order: { id_pedido: 'DESC' },
      relations: { items: true },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return { total, page, pageSize, data: rows };
  }

  /** Feed para cocina: todos los PENDIENTE, ordenados por updated_at ASC */
  async listaParaCocina(desde?: string) {
    const d = this.parseDateMaybe(desde);
    const where: any = { estado_pedido: EstadoPedido.PENDIENTE };
    if (d) where.updated_at = MoreThanOrEqual(d);

    return this.pedidos.find({
      where,
      relations: { items: { producto: true } },
      order: { updated_at: 'ASC', id_pedido: 'ASC' },
    });
  }
}

