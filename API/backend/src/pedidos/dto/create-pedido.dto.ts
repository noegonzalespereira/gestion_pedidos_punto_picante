import { IsArray, ArrayMinSize, IsEnum, IsInt, IsOptional, IsPositive, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido } from '../pedido.entity';
import { DestinoItem } from '../detalle-pedido.entity';
class ItemDto {
  @IsInt() @IsPositive()
  id_producto: number;

  @IsInt() @IsPositive()
  cantidad: number;

  @IsOptional()
  notas?: string;
  @IsOptional() @IsEnum(DestinoItem)
  destino?: DestinoItem;
}

export class CreatePedidoDto {
  @IsInt() @IsPositive()
  id_caja: number;

  @IsEnum(TipoPedido)
  tipo_pedido: TipoPedido;

  @IsOptional() @IsInt() @Min(1) @Max(10)
  num_mesa?: number | null;
 
  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}
