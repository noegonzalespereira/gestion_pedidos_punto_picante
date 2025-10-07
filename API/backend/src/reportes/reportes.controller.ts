import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  /**
   * GET /reportes/utilidad-teorica?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&caja=1
   * Roles: GERENTE (y si quieres, CAJERO para su caja).
   */
  @Get('utilidad-teorica')
  @Roles('GERENTE')
  utilidadTeorica(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('caja') caja?: string,
  ) {
    return this.service.utilidadTeorica({
      desde,
      hasta,
      caja: caja ? Number(caja) : undefined,
    });
  }

  /**
   * GET /reportes/mermas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   * Roles: GERENTE
   */
  @Get('mermas')
  @Roles('GERENTE')
  mermasResumen(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.mermasResumen({ desde, hasta });
  }
}
