import { IsOptional, IsString, MinLength } from 'class-validator';

export class EditarInsumoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unidad_base?: string;
}
