// src/productos/dto/update-producto.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength, IsDecimal, IsInt, IsIn } from 'class-validator';
import { TipoProducto } from '../producto.entity';

export class UpdateProductoDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsEnum(TipoProducto) tipo?: TipoProducto;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2' }) precio?: string;

  // opcional y permite null para borrar la URL
  @IsOptional() @IsString()
  img_url?: string | null;

  @IsOptional() @IsInt() @IsIn([0,1])
  activo?: 0 | 1;
}
