import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class RecetaItemDto {
  @IsInt() @Min(1)
  id_insumo: number;

  @IsNumber() @Min(0)
  cantidad_base: number;

  @IsOptional()
  @IsNumber()
  merma_porcentaje?: number; 
}

export class RecetaUpsertDto {
  @IsInt() @Min(1)
  id_producto: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecetaItemDto)
  items: RecetaItemDto[];

  @IsOptional() @IsString()
  nota?: string;
}
