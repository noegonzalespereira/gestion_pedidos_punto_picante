import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Req,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecetasService } from './recetas.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';
import { RecetaUpsertDto } from './dto/receta.dto';
import { CostoInsumoDto } from './dto/costo-insumo.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

// --- DTOs simples para Insumo ---
class CrearInsumoDto {
  @IsString() @MinLength(2)
  nombre!: string;

  @IsString() @MinLength(1)
  unidad_base!: string; // ej: 'g','ml','unidad'
}

class EditarInsumoDto {
  @IsOptional() @IsString() @MinLength(2)
  nombre?: string;

  @IsOptional() @IsString() @MinLength(1)
  unidad_base?: string;
}

@Controller('recetas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecetasController {
  constructor(private readonly recetas: RecetasService) {}

  // ===== Insumos =====

  /** Listar insumos  */
  @Get('insumos')
  @Roles('GERENTE')
  listarInsumos() {
    return this.recetas.listarInsumos();
  }

  /** Crear insumo. */
  @Post('insumos')
  @Roles('GERENTE')
  crearInsumo(@Body() dto: CrearInsumoDto) {
    return this.recetas.crearInsumo(dto.nombre, dto.unidad_base);
  }

  /** Editar insumo. */
  @Patch('insumos/:id')
  @Roles('GERENTE')
  editarInsumo(@Param('id') id: string, @Body() dto: EditarInsumoDto) {
    return this.recetas.editarInsumo(Number(id), dto);
  }

  /** Eliminar insumo. */
  @Delete('insumos/:id')
  @Roles('GERENTE')
  eliminarInsumo(@Param('id') id: string) {
    return this.recetas.eliminarInsumo(Number(id));
  }

  // ===== Costos de insumo (histórico) =====

  /** Registrar un costo nuevo para un insumo (se conserva historial). */
  @Post('costos')
  @Roles('GERENTE')
  setCosto(@Body() dto: CostoInsumoDto) {
    return this.recetas.setCostoInsumo(dto);
  }
  @Get('costos/:idInsumo')
  @Roles('GERENTE')
  getHistorialCostos(@Param('idInsumo') idInsumo: string) {
    return this.recetas.getHistorialCostos(Number(idInsumo));
  }

  // ===== Receta por plato =====

  /** Reemplaza la receta completa de un plato (upsert). */
  @Post('upsert')
  @Roles('GERENTE')
  upsert(@Body() dto: RecetaUpsertDto) {
    return this.recetas.upsertReceta(dto);
  }

  /** Obtiene la receta + costo teórico total (con desglose). */
  @Get(':id')
  @Roles('GERENTE')
  getReceta(@Param('id') id: string, @Query('fecha') fecha?: string) {
    return this.recetas.getReceta(Number(id), fecha);
  }
  @Get('resumen')
  @Roles('GERENTE')
  listarResumenRecetas() {
    return this.recetas.listarResumenRecetas();
  }
}
