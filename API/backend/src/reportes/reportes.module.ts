import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Pedido } from '../pedidos/pedido.entity';
import { Producto } from '../productos/producto.entity';

import { RecetaPlato } from '../recetas/receta-plato.entity';
import { CostoInsumoHistorial } from '../recetas/costo-insumo.entity';

import { InventarioMovimiento } from '../inventario/inventario-mov.entity';
import { InventarioProducto } from '../inventario/inventario-producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DetallePedido,
      Pedido,
      Producto,
      RecetaPlato,
      CostoInsumoHistorial,
      InventarioMovimiento,
      InventarioProducto,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
