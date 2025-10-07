import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { EstadoPago, EstadoPedido, MetodoPago, TipoPedido } from '../pedido.entity';

export class QueryPedidosDto {
  @IsOptional() @IsInt() @IsPositive()
  caja?: number;

  @IsOptional() @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;

  @IsOptional() @IsInt()
  num_mesa?: number;

  @IsOptional() @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;

  @IsOptional() @IsEnum(EstadoPago)
  estado_pago?: EstadoPago;

  @IsOptional() @IsEnum(EstadoPedido)
  estado_pedido?: EstadoPedido;

  @IsOptional() @IsString()
  desde?: string;  // ISO o YYYY-MM-DD

  @IsOptional() @IsString()
  hasta?: string;

  @IsOptional() @IsInt()
  page?: number;

  @IsOptional() @IsInt()
  pageSize?: number;
}
