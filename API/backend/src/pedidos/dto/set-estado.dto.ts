import { IsEnum } from 'class-validator';
import { EstadoPedido } from '../pedido.entity';

export class SetEstadoDto {
  @IsEnum(EstadoPedido)
  estado: EstadoPedido;
}
