import { IsArray, IsEnum, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido } from '../pedido.entity';
import { ItemDto } from './item.dto';

export class CreatePedidoDto {
  @IsInt()
  id_caja: number;

  @IsEnum(TipoPedido)
  tipo_pedido: TipoPedido;

  @IsOptional()
  @IsInt()
  num_mesa?: number;

  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}

