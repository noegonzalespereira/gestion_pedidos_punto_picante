import { MigrationInterface, QueryRunner } from "typeorm";

export class initSchema1736300000000 implements MigrationInterface {
  name = 'initSchema1736300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------ Usuarios ------------------
    await queryRunner.query(`
      CREATE TABLE usuarios (
        id_usuario INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        contrasena VARCHAR(255) NOT NULL,
        rol ENUM('CAJERO','GERENTE','COCINA') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ------------------ Caja ------------------
    await queryRunner.query(`
      CREATE TABLE caja (
        id_caja INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        estado ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
        fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        monto_apertura DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_cierre DECIMAL(10,2),
        fecha_cierre DATETIME,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      ) ENGINE=InnoDB
    `);

    // ------------------ Productos ------------------
    await queryRunner.query(`
      CREATE TABLE productos (
        id_producto INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        tipo ENUM('PLATO','BEBIDA') NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        img_url VARCHAR(255),
        activo TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ------------------ Pedido ------------------
    await queryRunner.query(`
      CREATE TABLE pedido (
        id_pedido INT AUTO_INCREMENT PRIMARY KEY,
        tipo_pedido ENUM('MESA','LLEVAR','MIXTO') NOT NULL,
        num_mesa INT,
        metodo_pago ENUM('EFECTIVO','QR') NOT NULL,
        estado_pago ENUM('SIN_PAGAR','PAGADO') NOT NULL DEFAULT 'SIN_PAGAR',
        total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado_pedido ENUM('PENDIENTE','LISTO') NOT NULL DEFAULT 'PENDIENTE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        id_usuario INT NOT NULL,
        id_caja INT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
        FOREIGN KEY (id_caja) REFERENCES caja(id_caja)
      ) ENGINE=InnoDB
    `);

    // ------------------ Detalles Pedido ------------------
    await queryRunner.query(`
      CREATE TABLE detalles_pedido (
        id_detalle_pedido INT AUTO_INCREMENT PRIMARY KEY,
        notas TEXT,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        destino ENUM('MESA','LLEVAR') NOT NULL DEFAULT 'MESA',
        id_pedido INT NOT NULL,
        id_producto INT NOT NULL,
        FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
        FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
      ) ENGINE=InnoDB
    `);

    // ------------------ Gastos ------------------
    await queryRunner.query(`
      CREATE TABLE gastos (
        id_gasto INT AUTO_INCREMENT PRIMARY KEY,
        nombre_producto VARCHAR(150) NOT NULL,
        descripcion TEXT,
        cantidad INT NOT NULL DEFAULT 1,
        precio DECIMAL(10,2) NOT NULL,
        fecha DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        id_usuario INT NOT NULL,
        id_caja INT,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
        FOREIGN KEY (id_caja) REFERENCES caja(id_caja) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ------------------ Inventario Producto ------------------
    await queryRunner.query(`
      CREATE TABLE inventario_producto (
        id_inventario INT AUTO_INCREMENT PRIMARY KEY,
        modo ENUM('PLATO','BEBIDA') NOT NULL,
        fecha DATE,
        cantidad_inicial INT NOT NULL,
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        id_producto INT NOT NULL,
        UNIQUE KEY UQ_inv_prod_fecha (id_producto, fecha),
        FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
      ) ENGINE=InnoDB
    `);

    // ------------------ Inventario Movimientos ------------------
    await queryRunner.query(`
      CREATE TABLE inventario_mov (
        id_mov INT AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('INGRESO','MERMA') NOT NULL,
        cantidad INT NOT NULL,
        motivo VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        id_inventario INT NOT NULL,
        FOREIGN KEY (id_inventario) REFERENCES inventario_producto(id_inventario) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ------------------ Insumos ------------------
    await queryRunner.query(`
      CREATE TABLE insumos (
        id_insumo INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL UNIQUE,
        unidad_base VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ------------------ Historial de Costos Insumo ------------------
    await queryRunner.query(`
      CREATE TABLE costo_insumo_historial (
        id_costo INT AUTO_INCREMENT PRIMARY KEY,
        costo_unitario DECIMAL(10,4) NOT NULL,
        vigencia_desde DATETIME NOT NULL,
        nota TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        id_insumo INT,
        FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ------------------ Recetas Plato ------------------
    await queryRunner.query(`
      CREATE TABLE recetas_plato (
        id_receta INT AUTO_INCREMENT PRIMARY KEY,
        cantidad_base DECIMAL(10,3) NOT NULL,
        merma_porcentaje DECIMAL(5,2) DEFAULT 0.00,
        nota TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        id_producto INT,
        id_insumo INT,
        UNIQUE KEY UQ_receta (id_producto, id_insumo),
        FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
        FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo)
      ) ENGINE=InnoDB
    `);

    // ------------------ Índices (como addCoreIndexes) ------------------
    await queryRunner.query(`CREATE INDEX idx_pedido_estado_updated ON pedido (estado_pedido, updated_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_created ON pedido (created_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_caja_created ON pedido (id_caja, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_metodo ON pedido (metodo_pago)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_usuario ON pedido (id_usuario)`);

    await queryRunner.query(`CREATE INDEX idx_detalle_pedido ON detalles_pedido (id_pedido)`);
    await queryRunner.query(`CREATE INDEX idx_detalle_producto ON detalles_pedido (id_producto)`);

    await queryRunner.query(`CREATE INDEX idx_gasto_fecha ON gastos (fecha)`);
    await queryRunner.query(`CREATE INDEX idx_gasto_usuario ON gastos (id_usuario)`);
    await queryRunner.query(`CREATE INDEX idx_gasto_caja_fecha ON gastos (id_caja, fecha)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_gasto_caja_fecha ON gastos`);
    await queryRunner.query(`DROP INDEX idx_gasto_usuario ON gastos`);
    await queryRunner.query(`DROP INDEX idx_gasto_fecha ON gastos`);
    await queryRunner.query(`DROP INDEX idx_detalle_producto ON detalles_pedido`);
    await queryRunner.query(`DROP INDEX idx_detalle_pedido ON detalles_pedido`);
    await queryRunner.query(`DROP INDEX idx_pedido_usuario ON pedido`);
    await queryRunner.query(`DROP INDEX idx_pedido_metodo ON pedido`);
    await queryRunner.query(`DROP INDEX idx_pedido_caja_created ON pedido`);
    await queryRunner.query(`DROP INDEX idx_pedido_created ON pedido`);
    await queryRunner.query(`DROP INDEX idx_pedido_estado_updated ON pedido`);

    await queryRunner.query(`DROP TABLE recetas_plato`);
    await queryRunner.query(`DROP TABLE costo_insumo_historial`);
    await queryRunner.query(`DROP TABLE insumos`);
    await queryRunner.query(`DROP TABLE inventario_mov`);
    await queryRunner.query(`DROP TABLE inventario_producto`);
    await queryRunner.query(`DROP TABLE gastos`);
    await queryRunner.query(`DROP TABLE detalles_pedido`);
    await queryRunner.query(`DROP TABLE pedido`);
    await queryRunner.query(`DROP TABLE productos`);
    await queryRunner.query(`DROP TABLE caja`);
    await queryRunner.query(`DROP TABLE usuarios`);
  }
}
