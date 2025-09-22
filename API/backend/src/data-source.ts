import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Usuario } from './usuarios/usuario.entity';
import { Caja } from './caja/caja.entity';
import { Producto } from './productos/producto.entity';
import { Pedido } from './pedidos/pedido.entity';
import { DetallePedido } from './pedidos/detalle-pedido.entity';
import { Gasto } from './gastos/gasto.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Usuario, Caja, Producto, Pedido, DetallePedido, Gasto],
  migrations: ['src/migrations/*.{ts,js}'], // <-- importante para opción B
  synchronize: false,
});
