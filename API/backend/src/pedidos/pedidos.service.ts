import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Caja, EstadoCaja } from '../caja/caja.entity';
import { Producto } from '../productos/producto.entity';
import { DestinoItem, DetallePedido } from './detalle-pedido.entity';
import { Pedido, EstadoPago, EstadoPedido, MetodoPago, TipoPedido } from './pedido.entity';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { InventarioService } from '../inventario/inventario.service';

type Rol = 'GERENTE' | 'CAJERO' | 'COCINA';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(DetallePedido) private readonly detalles: Repository<DetallePedido>,
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
    private readonly dataSource: DataSource,
    private readonly inventario: InventarioService,
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

  private agregate(items: { id_producto: number; cantidad: number }[]) {
    const agg = new Map<number, number>();
    for (const it of items ?? []) {
      agg.set(it.id_producto, (agg.get(it.id_producto) ?? 0) + Number(it.cantidad));
    }
    return agg;
  }

  /** YYYY-MM-DD (para cupo diario de PLATO) */
  private ymd(date?: Date) {
    const d = date ?? new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async recalcularTotal(id_pedido: number, mgr = this.pedidos.manager) {
    const { sum } =
      (await mgr
        .createQueryBuilder(DetallePedido, 'd')
        .select('COALESCE(SUM(d.subtotal), 0)', 'sum')
        .where('d.pedido = :id', { id: id_pedido })
        .getRawOne<{ sum: string }>()) ?? { sum: '0' };

    const p = await mgr.findOneBy(Pedido, { id_pedido });
    if (!p) throw new NotFoundException('Pedido no existe');
    p.total = Number(sum).toFixed(2);
    await mgr.save(p);
    return p.total;
  }
  private tipoDesdeDestinos(destinos: DestinoItem[]): TipoPedido   {
    const paraMesa = destinos.includes(DestinoItem.MESA);
    const paraLlevar = destinos.includes(DestinoItem.LLEVAR);
    if (paraMesa && paraLlevar) return TipoPedido.MIXTO;
    return paraMesa ? TipoPedido.MESA : TipoPedido.LLEVAR;

  }

  private async validarTipo_Y_Mesa(id_pedido: number, mgr = this.pedidos.manager) {
    const items = await mgr.find(DetallePedido, { where: { pedido: { id_pedido } } });
    const destinos = items.map(i => i.destino);
    const tipo = this.tipoDesdeDestinos(destinos);
    const p = await mgr.findOneBy(Pedido, { id_pedido });
    if (!p) throw new NotFoundException('Pedido no existe');

    const previo = p.tipo_pedido;
    p.tipo_pedido = tipo;

    if (tipo === TipoPedido.LLEVAR) {
      p.num_mesa = null;
    } else if (tipo === TipoPedido.MESA) {
      if (!p.num_mesa) {
        throw new BadRequestException('num_mesa es obligatorio para pedidos de MESA');
      }
    } // MIXTO: si hay items mesa y llevar; num_mesa requerido si hay al menos un ítem MESA
    if (tipo === TipoPedido.MIXTO) {
      const tieneMesa = destinos.includes(DestinoItem.MESA);
      if (tieneMesa && !p.num_mesa) {
        throw new BadRequestException('Hay ítems para MESA: num_mesa es obligatorio');
      }
    }

    await mgr.save(p);
    return { tipo_final: tipo, convertidoAMixto: previo !== tipo && tipo === TipoPedido.MIXTO };
  }

  

  /** Reserva stock (lanza 400 si falta) */
  private async reservarStock(items: { id_producto: number; cantidad: number }[], fechaBase?: Date) {
    const hoy = this.ymd(fechaBase);
    const agg = this.agregate(items);

    for (const [id_producto, cant] of agg.entries()) {
      // verifica disponible y descuenta
      const disponible = await this.inventario.disponibleProducto(id_producto, hoy);
      if (disponible < cant) {
        throw new BadRequestException(`Stock insuficiente para producto ${id_producto}. Disponible: ${disponible}, solicitado: ${cant}`);
      }
    }
    // si todo OK, descuenta (reserva)
    for (const [id_producto, cant] of agg.entries()) {
      await this.inventario.reservar(id_producto, cant, hoy);
    }
  }

  /** Libera stock (devuelve unidades) */
  private async liberarStock(items: { id_producto: number; cantidad: number }[], fechaBase?: Date) {
    const hoy = this.ymd(fechaBase);
    const agg = this.agregate(items);
    for (const [id_producto, cant] of agg.entries()) {
      await this.inventario.liberar(id_producto, cant, hoy);
    }
  }

  async crear(userId: number, _rol: Rol, dto: CreatePedidoDto) {
    if (!dto.items?.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const caja = await this.cajas.findOne({ where: { id_caja: dto.id_caja } });
    if (!caja) throw new NotFoundException('Caja no existe');
    if (caja.estado !== EstadoCaja.ABIERTA) throw new BadRequestException('La caja no está ABIERTA');

    if (dto.tipo_pedido === TipoPedido.MESA && !dto.num_mesa)
      throw new BadRequestException('num_mesa es obligatorio para MESA');
    const hoy = this.ymd(new Date());
    const inicioDia = new Date(hoy + ' 00:00:00');
    const finDia = new Date(hoy + ' 23:59:59');
    
    const ultimoPedidoHoy = await this.pedidos.findOne({
      where: { created_at: Between(inicioDia, finDia) },
      order: { num_pedido: 'DESC' }
    });
    
    const num_pedido = ultimoPedidoHoy ? ultimoPedidoHoy.num_pedido + 1 : 1;
    const ids = [...new Set(dto.items.map((i) => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    // 1) Reservar stock (si falla, no creamos pedido)
    await this.reservarStock(
      dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })),
      new Date(), // hoy
    );

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for(const it of dto.items) {
        if(!it.destino && dto.tipo_pedido === TipoPedido.MIXTO) {
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
        }
      }
      const pedido = await qr.manager.save(Pedido, {
        num_pedido,
        usuario: { id_usuario: userId },
        caja: { id_caja: dto.id_caja },
        tipo_pedido: dto.tipo_pedido,
        num_mesa: dto.tipo_pedido === TipoPedido.MESA ? dto.num_mesa! : null,
        metodo_pago: dto.metodo_pago,
        estado_pago: EstadoPago.SIN_PAGAR,
        estado_pedido: EstadoPedido.PENDIENTE,
        total: '0.00',
      });

      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);

        const destino: DestinoItem =
          it.destino ?? (dto.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA); 

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido: pedido.id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
        });
      }
      //recalcular tipo y validar reglas de mesa/mixto
      const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(pedido.id_pedido, qr.manager);
      const total = await this.recalcularTotal(pedido.id_pedido, qr.manager);
      await qr.commitTransaction();
      return { id_pedido: pedido.id_pedido,num_pedido: pedido.num_pedido ,total,tipo_pedido: tipo_final, convertidoAMixto };
    } catch (e) {
      await qr.rollbackTransaction();
      // si falló DB, revertimos la reserva
      await this.liberarStock(
        dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })),
        new Date(),
      );
      throw e;
    } finally {
      await qr.release();
    }
  }

  async actualizar(_rol: Rol, id_pedido: number, dto: UpdatePedidoDto) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
      order: { items: { id_detalle_pedido: 'ASC' } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) throw new ForbiddenException('No se puede editar un pedido PAGADO');

    if (dto.tipo_pedido !== undefined) p.tipo_pedido = dto.tipo_pedido;
    if (dto.num_mesa !== undefined) p.num_mesa = dto.num_mesa as any;
    if (dto.metodo_pago !== undefined) p.metodo_pago = dto.metodo_pago;

    // Si NO reemplazamos ítems, solo guardamos cabecera
    if (!dto.items) {
      await this.pedidos.save(p);
      const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(id_pedido);
      return { ok: true,tipo_pedido:tipo_final, convertidoAMixto  };
    }


    // Reemplazo completo de ítems:
    const oldAgg = this.agregate(p.items.map(d => ({ id_producto: d.producto.id_producto, cantidad: d.cantidad })));
    const newAgg = this.agregate(dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })));

    // Calcular delta = nuevo - viejo
    const productosIds = Array.from(new Set([...oldAgg.keys(), ...newAgg.keys()]));
    const deltaPos: { id_producto: number; cantidad: number }[] = [];
    const deltaNeg: { id_producto: number; cantidad: number }[] = [];

    for (const id of productosIds) {
      const antes = oldAgg.get(id) ?? 0;
      const ahora = newAgg.get(id) ?? 0;
      const delta = ahora - antes;
      if (delta > 0) deltaPos.push({ id_producto: id, cantidad: delta }); // reservar extra
      else if (delta < 0) deltaNeg.push({ id_producto: id, cantidad: -delta }); // liberar sobrante
    }

    // 1) Primero reservar lo adicional (si falla, no tocamos nada)
    if (deltaPos.length) await this.reservarStock(deltaPos, p.created_at);
    // 2) Luego liberar lo que sobró
    if (deltaNeg.length) await this.liberarStock(deltaNeg, p.created_at);

    // Persistir cambios de ítems
    const idsNuevos = [...new Set(dto.items.map((i) => i.id_producto))];
    const precioPorId = await this.preciosPorId(idsNuevos);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.save(p);

      await qr.manager.delete(DetallePedido, { pedido: { id_pedido } });
      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);
        if(!it.destino && p.tipo_pedido === TipoPedido.MIXTO) {
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
        }
        const destino:DestinoItem =
          it.destino ?? (p.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA);

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
        });
      }

      p.estado_pedido = EstadoPedido.PENDIENTE; // vuelve a cocina
      await qr.manager.save(p);
      const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(id_pedido, qr.manager);
      const total = await this.recalcularTotal(id_pedido, qr.manager);
      await qr.commitTransaction();
      return { ok: true, total, tipo_pedido: tipo_final, convertidoAMixto  };
    } catch (e) {
      await qr.rollbackTransaction();
      // si falló DB, revertimos los cambios de stock
      if (deltaPos.length) await this.liberarStock(deltaPos, p.created_at);
      // - si liberamos deltaNeg, hay que reservar de vuelta
      if (deltaNeg.length) await this.reservarStock(deltaNeg, p.created_at);
      throw e;
    } finally {
      await qr.release();
    }
  }

  async agregarItems(id_pedido: number, items: { id_producto: number; cantidad: number; notas?: string; destino?:DestinoItem }[]) {
    if (!items?.length) throw new BadRequestException('Debes enviar al menos un ítem');

    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) throw new ForbiddenException('No se puede editar un pedido PAGADO');

    // reservar extra
    await this.reservarStock(items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), p.created_at);

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
        if(!it.destino && p.tipo_pedido === TipoPedido.MIXTO) {
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
        }
        const destino:DestinoItem =
          it.destino ?? (p.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA);

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
        });
      }

      p.estado_pedido = EstadoPedido.PENDIENTE;
      await qr.manager.save(p);
      const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(id_pedido, qr.manager);
      const total = await this.recalcularTotal(id_pedido, qr.manager);
      await qr.commitTransaction();
      return { ok: true, total,tipo_pedido: tipo_final, convertidoAMixto  };
    } catch (e) {
      await qr.rollbackTransaction();
      // revertimos la reserva
      await this.liberarStock(items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), p.created_at);
      throw e;
    } finally {
      await qr.release();
    }
  }

  async editarItem(id_pedido: number, id_detalle: number, dto: { cantidad?: number; notas?: string | null,destino?:DestinoItem }) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) throw new ForbiddenException('No se puede editar un pedido PAGADO');

    const d = await this.detalles.findOne({
      where: { id_detalle_pedido: id_detalle, pedido: { id_pedido } },
      relations: { producto: true },
    });
    if (!d) throw new NotFoundException('Detalle no encontrado');

    // Delta de cantidad
    if (dto.cantidad !== undefined) {
      if (!Number.isInteger(dto.cantidad) || dto.cantidad < 1) {
        throw new BadRequestException('Cantidad inválida');
        
      }
    
      const delta = dto.cantidad - d.cantidad;
      if (delta > 0) {
        await this.reservarStock([{ id_producto: d.producto.id_producto, cantidad: delta }], p.created_at);
      } else if (delta < 0) {
        await this.liberarStock([{ id_producto: d.producto.id_producto, cantidad: -delta }], p.created_at);
      }
      d.cantidad = dto.cantidad;
      d.subtotal = (Number(d.precio_unitario) * d.cantidad).toFixed(2);
    }

    if (dto.notas !== undefined) d.notas = dto.notas;
    if(dto.destino !== undefined) d.destino = dto.destino;

    await this.detalles.save(d);

    p.estado_pedido = EstadoPedido.PENDIENTE;
    await this.pedidos.save(p);
    const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(id_pedido);
    const total = await this.recalcularTotal(id_pedido);
    return { ok: true, total, tipo_pedido: tipo_final, convertidoAMixto  };
  }

  async eliminarItem(id_pedido: number, id_detalle: number) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) throw new ForbiddenException('No se puede editar un pedido PAGADO');

    const d = await this.detalles.findOne({
      where: { id_detalle_pedido: id_detalle, pedido: { id_pedido } },
      relations: { producto: true },
    });
    if (!d) throw new NotFoundException('Detalle no encontrado');

    // liberar el item eliminado
    await this.liberarStock([{ id_producto: d.producto.id_producto, cantidad: d.cantidad }], p.created_at);

    await this.detalles.delete({ id_detalle_pedido: id_detalle, pedido: { id_pedido } });
    
    p.estado_pedido = EstadoPedido.PENDIENTE;
    await this.pedidos.save(p);
    const {tipo_final,convertidoAMixto}= await this.validarTipo_Y_Mesa(id_pedido);

    const total = await this.recalcularTotal(id_pedido);
    return { ok: true, total,tipo_pedido: tipo_final, convertidoAMixto  };
  }

  async setEstadoPedido(id_pedido: number, estado: EstadoPedido) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    p.estado_pedido = estado;
    await this.pedidos.save(p);
    return { ok: true };
  }

  async pagar(id_pedido: number, metodo?: MetodoPago) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (metodo) p.metodo_pago = metodo;
    p.estado_pago = EstadoPago.PAGADO;
    await this.pedidos.save(p);
    return { ok: true };
  }

  async eliminar(id_pedido: number) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO) throw new ForbiddenException('No se puede eliminar un pedido PAGADO');

    // liberar TODO el pedido
    const devolver = p.items.map(d => ({ id_producto: d.producto.id_producto, cantidad: d.cantidad }));
    if (devolver.length) await this.liberarStock(devolver, p.created_at);

    await this.pedidos.delete(id_pedido);
    return { ok: true };
  }

  async uno(id_pedido: number) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
      order: { items: { id_detalle_pedido: 'ASC' } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    return p;
  }

  async listar(q: QueryPedidosDto) {
    const where: any = {};
    if (q.caja) where.caja = { id_caja: q.caja };
    if (q.tipo_pedido) where.tipo_pedido = q.tipo_pedido as any;
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

  async listaParaCocina(desde?: string) {
    const d = this.parseDateMaybe(desde);
    const where: any = { estado_pedido: EstadoPedido.PENDIENTE};
    if (d) where.updated_at = MoreThanOrEqual(d);

    return this.pedidos.find({
      where,
      relations: { items: { producto: true } },
      order: { updated_at: 'ASC', id_pedido: 'ASC' },
    });
  }
}
