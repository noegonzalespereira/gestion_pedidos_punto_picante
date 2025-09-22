import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { EstadoPago, EstadoPedido, MetodoPago, TipoPedido } from '../pedido.entity';

export class QueryPedidosDto {
  @IsOptional() @IsInt() caja?: number;
  @IsOptional() @IsEnum(TipoPedido) tipo_pedido?: TipoPedido;
  @IsOptional() @IsInt() num_mesa?: number;
  @IsOptional() @IsEnum(EstadoPago) estado_pago?: EstadoPago;
  @IsOptional() @IsEnum(EstadoPedido) estado_pedido?: EstadoPedido;
  @IsOptional() @IsEnum(MetodoPago) metodo_pago?: MetodoPago;
  @IsOptional() desde?: string;
  @IsOptional() hasta?: string;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}
