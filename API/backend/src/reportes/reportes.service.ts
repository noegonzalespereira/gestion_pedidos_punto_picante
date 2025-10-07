import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';

import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Pedido } from '../pedidos/pedido.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';

import { RecetaPlato } from '../recetas/receta-plato.entity';
import { CostoInsumoHistorial } from '../recetas/costo-insumo.entity';

import { InventarioMovimiento, TipoMovimiento } from '../inventario/inventario-mov.entity';
import { InventarioProducto } from '../inventario/inventario-producto.entity';

type RangoFechasCaja = { desde?: string; hasta?: string; caja?: number };
type RangoFechas = { desde?: string; hasta?: string };

type DetalleUtilidad = {
  id_producto: number;
  nombre: string;
  tipo: string;
  unidades: number;
  ventas: string;                  // 2 decimales
  costo_unitario_teorico: string;  // 4 decimales
  costo_total_teorico: string;     // 2 decimales
  margen: string;                  // 2 decimales
};

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(DetallePedido) private readonly detRepo: Repository<DetallePedido>,
    @InjectRepository(Pedido) private readonly pedRepo: Repository<Pedido>,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
    @InjectRepository(RecetaPlato) private readonly recetaRepo: Repository<RecetaPlato>,
    @InjectRepository(CostoInsumoHistorial) private readonly costoRepo: Repository<CostoInsumoHistorial>,
    @InjectRepository(InventarioMovimiento) private readonly movRepo: Repository<InventarioMovimiento>,
    @InjectRepository(InventarioProducto) private readonly invRepo: Repository<InventarioProducto>,
  ) {}

  // --- Helpers de fechas ---
  private parseDateMaybe(v?: string): Date | undefined {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  private buildBetween(desde?: string, hasta?: string) {
    const d1 = this.parseDateMaybe(desde);
    const d2 = this.parseDateMaybe(hasta);
    if (d1 && d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      return Between(d1, end);
    } else if (d1) {
      return MoreThanOrEqual(d1);
    } else if (d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      return LessThanOrEqual(end);
    }
    return undefined;
  }

  // --- Costo teórico unitario de un PLATO en una fecha de referencia ---
  // Suma: (cantidad_base * (1 + merma%/100)) * costo_unitario_insumo(vigente)
  private async costoTeoricoPlatoUnitario(id_producto: number, fechaRefISO: string): Promise<number> {
    // receta del producto
    const receta = await this.recetaRepo.find({
      where: { producto: { id_producto } },
      relations: { insumo: true, producto: false },
      order: { id_receta: 'ASC' },
    });

    if (!receta.length) return 0;

    const fechaRef = new Date(fechaRefISO);
    const costoUnit = async (id_insumo: number) => {
      // último costo <= fechaRef
      const row = await this.costoRepo
        .createQueryBuilder('c')
        .where('c.id_insumo = :id_insumo', { id_insumo })
        .andWhere('c.vigencia_desde <= :f', { f: fechaRef })
        .orderBy('c.vigencia_desde', 'DESC')
        .limit(1)
        .getOne();

      return row ? Number(row.costo_unitario) : 0;
    };

    let total = 0;
    for (const r of receta) {
      const base = Number(r.cantidad_base);
      const merma = Number(r.merma_porcentaje ?? 0) / 100;
      const consumoNeto = base * (1 + merma); // criterio: sobreconsumo por merma
      const cu = await costoUnit(r.insumo.id_insumo);
      total += consumoNeto * cu;
    }
    return total; // número
  }

  // --- Ventas agrupadas por producto (unidades y ventas $) ---
  private async ventasAgrupadas(q: RangoFechasCaja) {
    const qb = this.detRepo
      .createQueryBuilder('d')
      .innerJoin('d.pedido', 'p')
      .innerJoin('d.producto', 'pr')
      .select('pr.id_producto', 'id_producto')
      .addSelect('pr.nombre', 'nombre')
      .addSelect('pr.tipo', 'tipo')
      .addSelect('SUM(d.cantidad)', 'unidades')
      .addSelect('SUM(d.subtotal)', 'ventas')
      .where('1=1');

    if (q.caja) qb.andWhere('p.id_caja = :caja', { caja: q.caja });

    const expr = this.buildBetween(q.desde, q.hasta);
    if (expr) {
      // usamos created_at del pedido
      const d1 = (expr as any)._low ?? new Date(0);
      const d2 = (expr as any)._high ?? new Date();
      qb.andWhere('p.created_at BETWEEN :ini AND :fin', { ini: d1, fin: d2 });
    }

    qb.groupBy('pr.id_producto')
      .addGroupBy('pr.nombre')
      .addGroupBy('pr.tipo')
      .orderBy('pr.id_producto', 'ASC');

    const rows = await qb.getRawMany<{
      id_producto: number;
      nombre: string;
      tipo: TipoProducto;
      unidades: string;
      ventas: string;
    }>();

    return rows.map(r => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo,
      unidades: Number(r.unidades ?? 0),
      ventas: Number(r.ventas ?? 0),
    }));
  }

  // --- Reporte principal: Utilidad teórica ---
  async utilidadTeorica(q: RangoFechasCaja) {
    const rows = await this.ventasAgrupadas(q);
    const fechaRef = q.hasta ?? new Date().toISOString().slice(0, 10);

    const detalle: DetalleUtilidad[] = [];
    let totalVentasNum = 0;
    let totalCostoNum = 0;

    for (const r of rows) {
      const unidades = r.unidades;
      const ventasNum = r.ventas;
      totalVentasNum += ventasNum;

      let costoUnit = 0;
      if (r.tipo === TipoProducto.PLATO) {
        costoUnit = await this.costoTeoricoPlatoUnitario(r.id_producto, fechaRef);
      } else {
        // Si más adelante defines costo de bebidas, cámbialo aquí.
        costoUnit = 0;
      }

      const costoTotal = costoUnit * unidades;
      totalCostoNum += costoTotal;

      detalle.push({
        id_producto: r.id_producto,
        nombre: r.nombre,
        tipo: r.tipo,
        unidades,
        ventas: ventasNum.toFixed(2),
        costo_unitario_teorico: costoUnit.toFixed(4),
        costo_total_teorico: costoTotal.toFixed(2),
        margen: (ventasNum - costoTotal).toFixed(2),
      });
    }

    return {
      periodo: {
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        caja: q.caja ?? null,
      },
      total_ventas: totalVentasNum.toFixed(2),
      total_costo_teorico: totalCostoNum.toFixed(2),
      utilidad_teorica: (totalVentasNum - totalCostoNum).toFixed(2),
      detalle,
    };
  }

  // --- Resumen de mermas por producto ---
  async mermasResumen(q: RangoFechas) {
    const qb = this.movRepo
      .createQueryBuilder('m')
      .innerJoin('m.inventario', 'i')
      .innerJoin('i.producto', 'p')
      .select('p.id_producto', 'id_producto')
      .addSelect('p.nombre', 'nombre')
      .addSelect('p.tipo', 'tipo')
      .addSelect('SUM(m.cantidad)', 'merma_total')
      .where('m.tipo = :t', { t: TipoMovimiento.MERMA });

    const expr = this.buildBetween(q.desde, q.hasta);
    if (expr) {
      const d1 = (expr as any)._low ?? new Date(0);
      const d2 = (expr as any)._high ?? new Date();
      qb.andWhere('m.created_at BETWEEN :ini AND :fin', { ini: d1, fin: d2 });
    }

    qb.groupBy('p.id_producto').addGroupBy('p.nombre').addGroupBy('p.tipo').orderBy('p.id_producto', 'ASC');

    const rows = await qb.getRawMany<{ id_producto: number; nombre: string; tipo: TipoProducto; merma_total: string }>();

    const detalle = rows.map(r => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo,
      merma_total: Number(r.merma_total ?? 0),
    }));

    const total_mermas = detalle.reduce((acc, x) => acc + x.merma_total, 0);

    return {
      periodo: { desde: q.desde ?? null, hasta: q.hasta ?? null },
      total_mermas,
      detalle,
    };
  }
}
