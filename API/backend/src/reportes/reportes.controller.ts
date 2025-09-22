import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { ProductosRankingDto } from './dto/productos-ranking.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('ventas')
  @Roles('GERENTE', 'CAJERO')
  ventas(@Query() q: ReportQueryDto) {
    if (q.cajero !== undefined) (q as any).cajero = Number(q.cajero);
    return this.service.ventas(q);
  }

  @Get('gastos')
  @Roles('GERENTE', 'CAJERO')
  gastos(@Query() q: ReportQueryDto) {
    if (q.cajero !== undefined) (q as any).cajero = Number(q.cajero);
    return this.service.gastosPorPeriodo(q);
  }

  @Get('neto')
  @Roles('GERENTE', 'CAJERO')
  neto(@Query() q: ReportQueryDto) {
    if (q.cajero !== undefined) (q as any).cajero = Number(q.cajero);
    return this.service.neto(q);
  }

  @Get('productos/top')
  @Roles('GERENTE')
  top(@Query() q: ProductosRankingDto) {
    if (q.cajero !== undefined) (q as any).cajero = Number(q.cajero);
    if (q.limite !== undefined) (q as any).limite = Number(q.limite);
    return this.service.productosTop(q);
  }

  @Get('productos/bottom')
  @Roles('GERENTE')
  bottom(@Query() q: ProductosRankingDto) {
    if (q.cajero !== undefined) (q as any).cajero = Number(q.cajero);
    if (q.limite !== undefined) (q as any).limite = Number(q.limite);
    return this.service.productosBottom(q);
  }
}
