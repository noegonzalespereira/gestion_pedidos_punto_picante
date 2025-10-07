import { IsEnum, isNotEmpty, IsString, MaxLength, IsDecimal, IsInt, IsIn, IsNotEmpty } from 'class-validator';
import { TipoProducto } from '../producto.entity';

export class CreateProductoDto {
  @IsString() @MaxLength(120) @IsNotEmpty() 
  nombre!: string;
  @IsEnum(TipoProducto) @IsNotEmpty()
  tipo!: TipoProducto;
  @IsDecimal({ decimal_digits: '0,2' }) @IsNotEmpty()
  precio!: string;

  @IsNotEmpty() @IsString() 
  img_url?: string | null;

  @IsInt() @IsIn([0,1])
  activo?: 0 | 1;
}
