import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CostoInsumoDto {
  @IsInt() @Min(1)
  id_insumo: number;

  @IsNumber() @Min(0)
  costo_unitario: number; // unidad_base del insumo


  @IsString()
  vigencia_desde: string;

  @IsOptional() @IsString()
  nota?: string;
}
