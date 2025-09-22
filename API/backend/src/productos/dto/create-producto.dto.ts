import { IsEnum, IsOptional, IsString, MaxLength, IsDecimal, IsInt, IsIn } from 'class-validator';
import { TipoProducto } from '../producto.entity';

export class CreateProductoDto {
  @IsString() @MaxLength(120) nombre!: string;
  @IsEnum(TipoProducto) tipo!: TipoProducto;
  @IsDecimal({ decimal_digits: '0,2' }) precio!: string;

  @IsOptional() @IsString()
  img_url?: string | null;

  @IsOptional() @IsInt() @IsIn([0,1])
  activo?: 0 | 1;
}
