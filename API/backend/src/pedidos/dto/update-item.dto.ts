import { IsInt, IsOptional, IsPositive, ValidateIf, IsString,IsEnum } from 'class-validator';
import { DestinoItem } from '../detalle-pedido.entity';

export class UpdateItemDto {
  @IsOptional() @IsInt() @IsPositive()
  cantidad?: number;

  // permite string o null
  @ValidateIf((o) => o.notas !== undefined && o.notas !== null)
  @IsString()
  notas?: string | null;

  @IsOptional() @IsEnum(DestinoItem)
  destino?: DestinoItem;
}
