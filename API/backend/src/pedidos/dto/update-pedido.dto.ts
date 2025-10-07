import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido } from '../pedido.entity';
import { DestinoItem } from '../detalle-pedido.entity';
class ItemUpdDto {
  @IsInt() @IsPositive()
  id_producto: number;

  @IsInt() @IsPositive()
  cantidad: number;

  @IsOptional()
  notas?: string | null;

  @IsOptional() @IsEnum(DestinoItem)
  destino?: DestinoItem
}

export class UpdatePedidoDto {
  @IsOptional() @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;

  @IsOptional() @IsInt()
  num_mesa?: number | null;

  @IsOptional() @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => ItemUpdDto)
  items?: ItemUpdDto[];
}
