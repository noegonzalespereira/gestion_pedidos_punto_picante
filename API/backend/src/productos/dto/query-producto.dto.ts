import { IsEnum, IsOptional, IsString, IsIn } from 'class-validator';
import { TipoProducto } from '../producto.entity';

export class QueryProductosDto {
  @IsOptional()
  @IsString()
  search?: string;               // busca por nombre

  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;           // PLATO | BEBIDA

  @IsOptional()
  @IsIn([0, 1] as any)
  activo?: 0 | 1;                // 1=activos, 0=inactivos

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
