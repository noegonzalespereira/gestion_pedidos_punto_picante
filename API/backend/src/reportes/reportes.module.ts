import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { Pedido } from '../pedidos/pedido.entity';
import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Producto } from '../productos/producto.entity';
import { Gasto } from '../gastos/gasto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, DetallePedido, Producto, Gasto])],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
