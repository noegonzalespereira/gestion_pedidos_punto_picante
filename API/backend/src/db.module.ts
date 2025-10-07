import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Usuario } from './usuarios/usuario.entity';
import { Caja } from './caja/caja.entity';
import { Producto } from './productos/producto.entity';
import { Pedido } from './pedidos/pedido.entity';
import { DetallePedido } from './pedidos/detalle-pedido.entity';
import { Gasto } from './gastos/gasto.entity';
import { InventarioProducto } from './inventario/inventario-producto.entity';
import { InventarioMovimiento } from './inventario/inventario-mov.entity';
import { Insumo } from './recetas/insumo.entity';
import { CostoInsumoHistorial } from './recetas/costo-insumo.entity';
import { RecetaPlato } from './recetas/receta-plato.entity';
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('DB_HOST'),
        port: parseInt(cfg.get<string>('DB_PORT') ?? '3306', 10),
        username: cfg.get<string>('DB_USER'),
        password: cfg.get<string>('DB_PASS'),
        database: cfg.get<string>('DB_NAME'),
        entities: [Usuario, Caja, Producto, Pedido, DetallePedido, Gasto,InventarioProducto, InventarioMovimiento,
        Insumo, CostoInsumoHistorial, RecetaPlato],
        synchronize: false,      // en prod: SIEMPRE false (usaremos migraciones)
        logging: false,
      }),
    }),
  ],
})
export class DbModule {}
