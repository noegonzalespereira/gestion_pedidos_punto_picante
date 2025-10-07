import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { InventarioProducto,ModoInventario } from './inventario-producto.entity';
import { InventarioMovimiento, TipoMovimiento } from './inventario-mov.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { AperturaPlatosDto } from './dto/apertura-platos.dto';
import { IngresoBebidaDto } from './dto/ingreso-bebida.dto';
import { MermaDto, MermaSobre } from './dto/merma.dto';
import { QueryDisponibleDto } from './dto/query-disponible.dto';


@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioProducto) private readonly invRepo: Repository<InventarioProducto>,
    @InjectRepository(InventarioMovimiento) private readonly movRepo: Repository<InventarioMovimiento>,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
  ) {}

  private ymd(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Stock disponible (PLATO por fecha, BEBIDA global) */
  async disponibleProducto(id_producto: number, fecha?: string): Promise<number> {
    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      return row?.cantidad_inicial ?? 0;
    } else {
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull() } });
      return row?.cantidad_inicial ?? 0;
    }
  }

  /** Reserva (venta) — NO crea movimiento */
  async reservar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      if (!row) throw new BadRequestException(`No hay apertura para el plato ${id_producto} en ${f}`);
      if (row.cantidad_inicial < cantidad) {
        throw new BadRequestException(`Stock insuficiente (disponible ${row.cantidad_inicial})`);
      }
      row.cantidad_inicial -= cantidad;
      await this.invRepo.save(row);
    } else {
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull()  } });
      if (!row) throw new BadRequestException(`No hay stock cargado para la bebida ${id_producto}`);
      if (row.cantidad_inicial < cantidad) {
        throw new BadRequestException(`Stock insuficiente (disponible ${row.cantidad_inicial})`);
      }
      row.cantidad_inicial -= cantidad;
      await this.invRepo.save(row);
    }
  }

  /** Libera (anulación) — NO crea movimiento */
  async liberar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      let row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      if (!row) {
        row = this.invRepo.create({ 
          producto: { id_producto } as any,
          modo: ModoInventario.PLATO,
          fecha: f, 
          cantidad_inicial: 0 });
      }
      row.cantidad_inicial += cantidad;
      await this.invRepo.save(row);
    } else {
      let row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull()  } });
      if (!row) row = this.invRepo.create({ 
        producto: { id_producto } as any,
        modo: ModoInventario.BEBIDA, 
        fecha: null, 
        cantidad_inicial: 0 });
      row.cantidad_inicial += cantidad;
      await this.invRepo.save(row);
    }
  }

  /** Apertura diaria de PLATOS */
async aperturaPlatos(dto: AperturaPlatosDto) {
  // 1) Validaciones básicas
  const ids = dto.items.map(i => i.id_producto);
  const productos = await this.prodRepo.find({ where: { id_producto: In(ids) } });
  const porId = new Map(productos.map(p => [p.id_producto, p]));

  for (const it of dto.items) {
    const p = porId.get(it.id_producto);
    if (!p) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
    if (p.tipo !== TipoProducto.PLATO)
      throw new BadRequestException(`Producto ${it.id_producto} no es PLATO`);
  }

  const results: { id_producto: number; fecha: string; cantidad_inicial: number }[] = [];

  // 2) Procesar cada plato
  for (const it of dto.items) {
    // buscar fila de inventario del día
    let inv = await this.invRepo.findOne({
      where: { producto: { id_producto: it.id_producto }, fecha: dto.fecha },
    });

    const oldQty = inv?.cantidad_inicial ?? 0;
    const newQty = it.cantidad_inicial;                       // “stock del día” del DTO
    const delta  = newQty - oldQty;

    // 2.a) crear/actualizar inventario
    if (inv) {
      inv.cantidad_inicial = newQty;
      inv = await this.invRepo.save(inv);          // ← ya persistido
    } else {
      inv = await this.invRepo.save(               // ← save devuelve la entidad
        this.invRepo.create({
          producto: { id_producto: it.id_producto } as any,
          modo: ModoInventario.PLATO,
          fecha: dto.fecha,
          cantidad_inicial: newQty,
        }),
      );
    }

    // 2.b) registrar movimiento solo si hubo cambio (delta ≠ 0)
    if (delta !== 0) {
      await this.movRepo.save(
        this.movRepo.create({
          inventario: inv,                         // ← inv NO es null aquí
          tipo: delta > 0 ? TipoMovimiento.INGRESO : TipoMovimiento.MERMA,
          cantidad: Math.abs(delta),
          motivo: 'APERTURA',
        }),
      );
    }

    results.push({ id_producto: it.id_producto, fecha: dto.fecha, cantidad_inicial: newQty });
  }

  return { ok: true, items: results };
}


  /** Ingreso para BEBIDA (global) */
  async ingresoBebida(dto: IngresoBebidaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');
    if (prod.tipo !== TipoProducto.BEBIDA) throw new BadRequestException('Solo aplica a BEBIDA');

    let row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha: IsNull () } });
    if (!row)
      row = this.invRepo.create({ 
      producto: { id_producto: dto.id_producto } as any, 
      modo: ModoInventario.BEBIDA,
      fecha: null, 
      cantidad_inicial: 0 
    });

    row.cantidad_inicial += dto.cantidad;
    row = await this.invRepo.save(row);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.INGRESO,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'INGRESO',
      }),
    );

    return { ok: true, id_producto: dto.id_producto, stock: row.cantidad_inicial };
  }

  /** Merma (PLATO por día o BEBIDA global) */
  async merma(dto: MermaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (dto.sobre === MermaSobre.PLATO) {
      if (prod.tipo !== TipoProducto.PLATO) throw new BadRequestException('El producto no es PLATO');
      const fecha = dto.fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha } });
      if (!row || row.cantidad_inicial < dto.cantidad) throw new BadRequestException('Stock insuficiente');
      row.cantidad_inicial -= dto.cantidad;
      const saved = await this.invRepo.save(row);

      await this.movRepo.save(
        this.movRepo.create({
          inventario: saved,
          tipo: TipoMovimiento.MERMA,
          cantidad: dto.cantidad,
          motivo: dto.motivo ?? 'MERMA',
        }),
      );
      return { ok: true, id_producto: dto.id_producto, fecha, stock: row.cantidad_inicial };
    }

    // BEBIDA
    if (prod.tipo !== TipoProducto.BEBIDA) throw new BadRequestException('El producto no es BEBIDA');
    const row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha: IsNull() } });
    if (!row || row.cantidad_inicial < dto.cantidad) throw new BadRequestException('Stock insuficiente');
    row.cantidad_inicial -= dto.cantidad;
    const saved = await this.invRepo.save(row);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: saved,
        tipo: TipoMovimiento.MERMA,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'MERMA',
      }),
    );
    return { ok: true, id_producto: dto.id_producto, stock: row.cantidad_inicial };
  }

  /** Consulta combinada para UI */
  async disponible(q: QueryDisponibleDto) {
    const fecha = q.fecha ?? this.ymd();

    const platos = await this.invRepo.find({
      where: { fecha },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const bebidas = await this.invRepo.find({
      where: { fecha: IsNull() },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    return {
      fecha,
      platos: platos.map((i) => ({ id_producto: i.id_producto, nombre: i.producto.nombre, stock: i.cantidad_inicial })),
      bebidas: bebidas.map((i) => ({ id_producto: i.id_producto, nombre: i.producto.nombre, stock: i.cantidad_inicial })),
    };
  }
  
}
