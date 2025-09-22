// src/reportes/reportes.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pedido, EstadoPago } from '../pedidos/pedido.entity';
import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { Gasto } from '../gastos/gasto.entity';
import { ReportQueryDto, Granularidad } from './dto/report-query.dto';
import { ProductosRankingDto } from './dto/productos-ranking.dto';

type Row = Record<string, any>;
type DateBounds =
  | { kind: 'none' }
  | { kind: 'between'; ini: Date; fin: Date }
  | { kind: 'ge'; ini: Date }
  | { kind: 'le'; fin: Date };

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(DetallePedido) private readonly detalles: Repository<DetallePedido>,
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
    @InjectRepository(Gasto) private readonly gastos: Repository<Gasto>,
  ) {}

  // ---- helpers de fechas ----

  private parseDateMaybe(v?: string) {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  private dateBounds(desde?: string, hasta?: string): DateBounds {
    const d1 = this.parseDateMaybe(desde);
    const d2 = this.parseDateMaybe(hasta);
    if (!d1 && !d2) return { kind: 'none' };
    if (d1 && d2) {
      const fin = new Date(d2);
      if (fin.getHours() === 0 && fin.getMinutes() === 0) fin.setHours(23, 59, 59, 999);
      return { kind: 'between', ini: d1, fin };
    }
    if (d1) return { kind: 'ge', ini: d1 };
    const fin = new Date(d2!);
    if (fin.getHours() === 0 && fin.getMinutes() === 0) fin.setHours(23, 59, 59, 999);
    return { kind: 'le', fin };
  }

  /** Expresiones MySQL para agrupar/etiquetar periodos (sobre PEDIDOS) */
  private groupExpr(g?: Granularidad) {
    const gran = g ?? Granularidad.DIA;
    switch (gran) {
      case Granularidad.DIA:
        return { expr: "DATE_FORMAT(p.created_at, '%Y-%m-%d')", gexpr: 'DATE(p.created_at)' };
      case Granularidad.SEMANA:
        return { expr: "DATE_FORMAT(p.created_at, '%x-W%v')", gexpr: 'YEARWEEK(p.created_at, 3)' };
      case Granularidad.MES:
        return { expr: "DATE_FORMAT(p.created_at, '%Y-%m')", gexpr: "DATE_FORMAT(p.created_at, '%Y-%m')" };
      case Granularidad.ANIO:
        return { expr: "DATE_FORMAT(p.created_at, '%Y')", gexpr: 'YEAR(p.created_at)' };
    }
  }

  /** Expresiones para agrupar sobre GASTOS */
  private groupExprGasto(g?: Granularidad) {
    const gran = g ?? Granularidad.DIA;
    switch (gran) {
      case Granularidad.DIA:
        return { expr: "DATE_FORMAT(g.fecha, '%Y-%m-%d')", gexpr: 'DATE(g.fecha)' };
      case Granularidad.SEMANA:
        return { expr: "DATE_FORMAT(g.fecha, '%x-W%v')", gexpr: 'YEARWEEK(g.fecha, 3)' };
      case Granularidad.MES:
        return { expr: "DATE_FORMAT(g.fecha, '%Y-%m')", gexpr: "DATE_FORMAT(g.fecha, '%Y-%m')" };
      case Granularidad.ANIO:
        return { expr: "DATE_FORMAT(g.fecha, '%Y')", gexpr: 'YEAR(g.fecha)' };
    }
  }

  // ---- Ventas por periodo ----

  async ventas(q: ReportQueryDto) {
    const { expr, gexpr } = this.groupExpr(q.granularidad);

    const qb = this.detalles
      .createQueryBuilder('d')
      .innerJoin(Pedido, 'p', 'p.id_pedido = d.id_pedido')
      .innerJoin(Producto, 'pr', 'pr.id_producto = d.id_producto')
      .select(`${expr}`, 'periodo')
      .addSelect('COALESCE(SUM(d.subtotal), 0)', 'total')
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' THEN d.subtotal ELSE 0 END), 0)",
        'total_efectivo',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.metodo_pago = 'QR'       THEN d.subtotal ELSE 0 END), 0)",
        'total_qr',
      )
      .addSelect('COUNT(DISTINCT p.id_pedido)', 'n_pedidos')
      .addSelect(
        "COALESCE(SUM(CASE WHEN pr.tipo = 'PLATO'  THEN d.cantidad ELSE 0 END), 0)",
        'cant_platos',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN pr.tipo = 'PLATO'  THEN d.subtotal ELSE 0 END), 0)",
        'total_platos',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN pr.tipo = 'BEBIDA' THEN d.cantidad ELSE 0 END), 0)",
        'cant_bebidas',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN pr.tipo = 'BEBIDA' THEN d.subtotal ELSE 0 END), 0)",
        'total_bebidas',
      )
      .where('p.estado_pago = :pg', { pg: EstadoPago.PAGADO });

    // Filtros
    const b = this.dateBounds(q.desde, q.hasta);
    switch (b.kind) {
      case 'between':
        qb.andWhere('p.created_at BETWEEN :ini AND :fin', { ini: b.ini, fin: b.fin });
        break;
      case 'ge':
        qb.andWhere('p.created_at >= :ini', { ini: b.ini });
        break;
      case 'le':
        qb.andWhere('p.created_at <= :fin', { fin: b.fin });
        break;
      case 'none':
        break;
    }

    if (q.tipo_pedido) qb.andWhere('p.tipo_pedido = :tp', { tp: q.tipo_pedido });
    if (q.metodo_pago) qb.andWhere('p.metodo_pago = :mp', { mp: q.metodo_pago });
    if (q.cajero) qb.andWhere('p.id_usuario = :u', { u: q.cajero });

    qb.groupBy(gexpr).orderBy(gexpr, 'ASC');

    const rows = (await qb.getRawMany<Row>()) ?? [];
    return rows.map((r) => {
      const total = Number(r.total ?? 0);
      const n = Number(r.n_pedidos ?? 0);
      const total_efectivo = Number(r.total_efectivo ?? 0);
      const total_qr = Number(r.total_qr ?? 0);
      return {
        periodo: r.periodo,
        total: Number(total.toFixed(2)),
        total_efectivo: Number(total_efectivo.toFixed(2)),
        total_qr: Number(total_qr.toFixed(2)),
        n_pedidos: n,
        ticket_promedio: n ? Number((total / n).toFixed(2)) : 0,
        platos: {
          cantidad: Number(r.cant_platos ?? 0),
          total: Number(Number(r.total_platos ?? 0).toFixed(2)),
        },
        bebidas: {
          cantidad: Number(r.cant_bebidas ?? 0),
          total: Number(Number(r.total_bebidas ?? 0).toFixed(2)),
        },
      };
    });
  }

  // ---- Gastos por periodo ----

  async gastosPorPeriodo(q: ReportQueryDto) {
    const { expr, gexpr } = this.groupExprGasto(q.granularidad);

    const qb = this.gastos
      .createQueryBuilder('g')
      .select(`${expr}`, 'periodo')
      .addSelect('COALESCE(SUM(g.precio * g.cantidad), 0)', 'total_gastos')
      .addSelect('COUNT(1)', 'n_gastos');

    const b = this.dateBounds(q.desde, q.hasta);
    switch (b.kind) {
      case 'between':
        qb.where('g.fecha BETWEEN :ini AND :fin', { ini: b.ini, fin: b.fin });
        break;
      case 'ge':
        qb.where('g.fecha >= :ini', { ini: b.ini });
        break;
      case 'le':
        qb.where('g.fecha <= :fin', { fin: b.fin });
        break;
      case 'none':
        // sin filtro de fecha
        break;
    }

    if (q.cajero) qb.andWhere('g.id_usuario = :u', { u: q.cajero });

    qb.groupBy(gexpr).orderBy(gexpr, 'ASC');

    const rows = (await qb.getRawMany<Row>()) ?? [];
    return rows.map((r) => ({
      periodo: r.periodo,
      total_gastos: Number(Number(r.total_gastos ?? 0).toFixed(2)),
      n_gastos: Number(r.n_gastos ?? 0),
    }));
  }

  // ---- Neto (ventas - gastos) por periodo ----

  async neto(q: ReportQueryDto) {
    const ventas = await this.ventas(q);
    const gastos = await this.gastosPorPeriodo(q);
    const gmap = new Map(gastos.map((g) => [g.periodo, g]));
    return ventas.map((v) => {
      const tg = gmap.get(v.periodo)?.total_gastos ?? 0;
      return {
        periodo: v.periodo,
        ventas: {
          total: v.total,
          total_efectivo: v.total_efectivo,
          total_qr: v.total_qr,
          n_pedidos: v.n_pedidos,
          ticket_promedio: v.ticket_promedio,
        },
        gastos: tg,
        neto: Number((v.total - tg).toFixed(2)),
      };
    });
  }

  // ---- Ranking de productos (Top / Bottom) ----

  async productosTop(dto: ProductosRankingDto) {
    return this.productosRanking(dto, 'DESC');
  }

  async productosBottom(dto: ProductosRankingDto) {
    return this.productosRanking(dto, 'ASC');
  }

  private async productosRanking(dto: ProductosRankingDto, direction: 'ASC' | 'DESC') {
    const limite = dto.limite ?? 5;

    const qb = this.detalles
      .createQueryBuilder('d')
      .innerJoin(Pedido, 'p', 'p.id_pedido = d.id_pedido')
      .innerJoin(Producto, 'pr', 'pr.id_producto = d.id_producto')
      .select('pr.id_producto', 'id_producto')
      .addSelect('pr.nombre', 'nombre')
      .addSelect('pr.tipo', 'tipo')
      .addSelect('COALESCE(SUM(d.cantidad), 0)', 'cantidad')
      .addSelect('COALESCE(SUM(d.subtotal), 0)', 'total')
      .where('p.estado_pago = :pg', { pg: EstadoPago.PAGADO });

    const b = this.dateBounds(dto.desde, dto.hasta);
    switch (b.kind) {
      case 'between':
        qb.andWhere('p.created_at BETWEEN :ini AND :fin', { ini: b.ini, fin: b.fin });
        break;
      case 'ge':
        qb.andWhere('p.created_at >= :ini', { ini: b.ini });
        break;
      case 'le':
        qb.andWhere('p.created_at <= :fin', { fin: b.fin });
        break;
      case 'none':
        break;
    }

    if (dto.tipo_pedido) qb.andWhere('p.tipo_pedido = :tp', { tp: dto.tipo_pedido });
    if (dto.metodo_pago) qb.andWhere('p.metodo_pago = :mp', { mp: dto.metodo_pago });
    if (dto.cajero) qb.andWhere('p.id_usuario = :u', { u: dto.cajero });
    if (dto.tipo) qb.andWhere('pr.tipo = :t', { t: dto.tipo });

    qb.groupBy('pr.id_producto')
      .addGroupBy('pr.nombre')
      .addGroupBy('pr.tipo')
      .having('SUM(d.cantidad) > 0')
      .orderBy('cantidad', direction)
      .addOrderBy('total', direction)
      .limit(limite);

    const rows = (await qb.getRawMany<Row>()) ?? [];
    return rows.map((r) => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo as TipoProducto,
      cantidad: Number(r.cantidad ?? 0),
      total: Number(Number(r.total ?? 0).toFixed(2)),
    }));
  }
}
