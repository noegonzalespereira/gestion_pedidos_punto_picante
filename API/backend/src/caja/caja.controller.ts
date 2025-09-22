import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CajaService } from './caja.service';
import { OpenCajaDto } from './dto/open-caja.dto';
import { CloseCajaDto } from './dto/close-caja.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('cajas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly service: CajaService) {}

  /** Abre una caja para el usuario autenticado */
  @Post('abrir')
  @Roles('CAJERO', 'GERENTE')
  abrir(@Req() req: any, @Body() dto: OpenCajaDto) {
    return this.service.abrir(req.user.userId, req.user.rol, dto);
  }

  /** Devuelve la caja ABIERTA del usuario (si existe) */
  @Get('abierta')
  @Roles('CAJERO', 'GERENTE')
  cajaAbierta(@Req() req: any) {
    return this.service.cajaAbiertaDe(req.user.userId);
  }

  /** Cierra la caja indicada */
  @Patch(':id/cerrar')
  @Roles('CAJERO', 'GERENTE')
  cerrar(@Req() req: any, @Param('id') id: string, @Body() dto: CloseCajaDto) {
    return this.service.cerrar(
      req.user.userId,
      req.user.rol,
      Number(id),
      dto,
    );
  }

  /** Reporte/resumen de caja (puede reimprimirse luego) */
  @Get(':id/resumen')
  @Roles('CAJERO', 'GERENTE')
  resumen(@Param('id') id: string) {
    return this.service.resumen(Number(id));
  }
}
