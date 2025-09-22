import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  notas?: string | null; // null para limpiar notas
}
