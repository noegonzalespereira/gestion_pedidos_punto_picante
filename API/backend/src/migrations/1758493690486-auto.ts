import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1758493690486 implements MigrationInterface {
    name = 'Auto1758493690486'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`gastos\` (\`id_gasto\` int NOT NULL AUTO_INCREMENT, \`nombre_producto\` varchar(150) NOT NULL, \`descripcion\` text NULL, \`cantidad\` int NOT NULL DEFAULT '1', \`precio\` decimal(10,2) NOT NULL, \`fecha\` date NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id_usuario\` int NOT NULL, \`id_caja\` int NULL, PRIMARY KEY (\`id_gasto\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`caja\` (\`id_caja\` int NOT NULL AUTO_INCREMENT, \`id_usuario\` int NOT NULL, \`estado\` enum ('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA', \`fecha_apertura\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`monto_apertura\` decimal(10,2) NOT NULL DEFAULT '0.00', \`monto_cierre\` decimal(10,2) NULL, \`fecha_cierre\` datetime NULL, PRIMARY KEY (\`id_caja\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`productos\` (\`id_producto\` int NOT NULL AUTO_INCREMENT, \`nombre\` varchar(255) NOT NULL, \`tipo\` enum ('PLATO', 'BEBIDA') NOT NULL, \`precio\` decimal(10,2) NOT NULL, \`img_url\` varchar(255) NULL, \`activo\` tinyint NOT NULL DEFAULT '1', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id_producto\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`detalles_pedido\` (\`id_detalle_pedido\` int NOT NULL AUTO_INCREMENT, \`notas\` text NULL, \`cantidad\` int NOT NULL, \`precio_unitario\` decimal(10,2) NOT NULL, \`subtotal\` decimal(10,2) NOT NULL, \`id_pedido\` int NOT NULL, \`id_producto\` int NOT NULL, PRIMARY KEY (\`id_detalle_pedido\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`pedido\` (\`id_pedido\` int NOT NULL AUTO_INCREMENT, \`tipo_pedido\` enum ('MESA', 'LLEVAR') NOT NULL, \`num_mesa\` int NULL, \`metodo_pago\` enum ('EFECTIVO', 'QR') NOT NULL, \`estado_pago\` enum ('SIN_PAGAR', 'PAGADO') NOT NULL DEFAULT 'SIN_PAGAR', \`total\` decimal(10,2) NOT NULL DEFAULT '0.00', \`estado_pedido\` enum ('PENDIENTE', 'LISTO') NOT NULL DEFAULT 'PENDIENTE', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id_usuario\` int NOT NULL, \`id_caja\` int NOT NULL, PRIMARY KEY (\`id_pedido\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`usuarios\` (\`id_usuario\` int NOT NULL AUTO_INCREMENT, \`nombre\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`contrasena\` varchar(255) NOT NULL, \`rol\` enum ('CAJERO', 'GERENTE', 'COCINA') NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_446adfc18b35418aac32ae0b7b\` (\`email\`), PRIMARY KEY (\`id_usuario\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`gastos\` ADD CONSTRAINT \`FK_80356fdf161b9aaba3c4e24281a\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\`(\`id_usuario\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`gastos\` ADD CONSTRAINT \`FK_8786f01033e108aab382c9bde8f\` FOREIGN KEY (\`id_caja\`) REFERENCES \`caja\`(\`id_caja\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`caja\` ADD CONSTRAINT \`FK_a2be356f39d7dcf40ac5a270d0f\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\`(\`id_usuario\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` ADD CONSTRAINT \`FK_4c6addd6905fc3410ee969d8bbf\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedido\`(\`id_pedido\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` ADD CONSTRAINT \`FK_283f2be8f2d218c7f26d17b4098\` FOREIGN KEY (\`id_producto\`) REFERENCES \`productos\`(\`id_producto\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`pedido\` ADD CONSTRAINT \`FK_512f2a53c873366a90180938ee5\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\`(\`id_usuario\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`pedido\` ADD CONSTRAINT \`FK_ed459f0d43ccf704ed692be6345\` FOREIGN KEY (\`id_caja\`) REFERENCES \`caja\`(\`id_caja\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`pedido\` DROP FOREIGN KEY \`FK_ed459f0d43ccf704ed692be6345\``);
        await queryRunner.query(`ALTER TABLE \`pedido\` DROP FOREIGN KEY \`FK_512f2a53c873366a90180938ee5\``);
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` DROP FOREIGN KEY \`FK_283f2be8f2d218c7f26d17b4098\``);
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` DROP FOREIGN KEY \`FK_4c6addd6905fc3410ee969d8bbf\``);
        await queryRunner.query(`ALTER TABLE \`caja\` DROP FOREIGN KEY \`FK_a2be356f39d7dcf40ac5a270d0f\``);
        await queryRunner.query(`ALTER TABLE \`gastos\` DROP FOREIGN KEY \`FK_8786f01033e108aab382c9bde8f\``);
        await queryRunner.query(`ALTER TABLE \`gastos\` DROP FOREIGN KEY \`FK_80356fdf161b9aaba3c4e24281a\``);
        await queryRunner.query(`DROP INDEX \`IDX_446adfc18b35418aac32ae0b7b\` ON \`usuarios\``);
        await queryRunner.query(`DROP TABLE \`usuarios\``);
        await queryRunner.query(`DROP TABLE \`pedido\``);
        await queryRunner.query(`DROP TABLE \`detalles_pedido\``);
        await queryRunner.query(`DROP TABLE \`productos\``);
        await queryRunner.query(`DROP TABLE \`caja\``);
        await queryRunner.query(`DROP TABLE \`gastos\``);
    }

}
