import { IsString, MinLength } from 'class-validator';

export class CrearInsumoDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  // Ej.: 'g', 'kg', 'ml', 'l', 'unidad'
  @IsString()
  @MinLength(1)
  unidad_base!: string;
}
