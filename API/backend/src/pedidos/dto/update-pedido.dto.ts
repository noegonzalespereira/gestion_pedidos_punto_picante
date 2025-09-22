import { IsArray, IsEnum, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido } from '../pedido.entity';
import { ItemDto } from './item.dto';

export class UpdatePedidoDto {
  @IsOptional()
  @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;

  @IsOptional()
  @IsInt()
  num_mesa?: number | null;

  @IsOptional()
  @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;

  // Si se envía, REEMPLAZA toda la lista (recalcula total)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items?: ItemDto[];
}
