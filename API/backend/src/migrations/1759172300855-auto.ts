import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1759172300855 implements MigrationInterface {
    name = 'Auto1759172300855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        
        await queryRunner.query(`CREATE TABLE \`inventario_mov\` (\`id_mov\` int NOT NULL AUTO_INCREMENT, \`tipo\` enum ('INGRESO', 'MERMA') NOT NULL, \`cantidad\` int NOT NULL, \`motivo\` varchar(200) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`id_inventario\` int NOT NULL, PRIMARY KEY (\`id_mov\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`inventario_producto\` (\`id_inventario\` int NOT NULL AUTO_INCREMENT, \`modo\` enum ('PLATO', 'BEBIDA') NOT NULL, \`fecha\` date NULL, \`cantidad_inicial\` int NOT NULL, \`notas\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`id_producto\` int NOT NULL, PRIMARY KEY (\`id_inventario\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`costo_insumo_historial\` (\`id_costo\` int NOT NULL AUTO_INCREMENT, \`costo_unitario\` decimal(10,4) NOT NULL, \`vigencia_desde\` datetime NOT NULL, \`nota\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`id_insumo\` int NULL, PRIMARY KEY (\`id_costo\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`recetas_plato\` (\`id_receta\` int NOT NULL AUTO_INCREMENT, \`cantidad_base\` decimal(10,3) NOT NULL, \`merma_porcentaje\` decimal(5,2) NOT NULL DEFAULT '0.00', \`nota\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`id_producto\` int NULL, \`id_insumo\` int NULL, UNIQUE INDEX \`IDX_87fa33d2f04ac1a849f5fec445\` (\`id_producto\`, \`id_insumo\`), PRIMARY KEY (\`id_receta\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`insumos\` (\`id_insumo\` int NOT NULL AUTO_INCREMENT, \`nombre\` varchar(150) NOT NULL, \`unidad_base\` varchar(20) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_0d28ae68a8f742beb176aa51ae\` (\`nombre\`), PRIMARY KEY (\`id_insumo\`)) ENGINE=InnoDB`);
        await queryRunner.query(`
        ALTER TABLE \`inventario_producto\`
        ADD UNIQUE KEY \`UQ_inv_prod_fecha\` (\`id_producto\`, \`fecha\`);
        `);

        await queryRunner.query(`ALTER TABLE \`inventario_mov\` ADD CONSTRAINT \`FK_32867723282b29af1ff49905f04\` FOREIGN KEY (\`id_inventario\`) REFERENCES \`inventario_producto\`(\`id_inventario\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`inventario_producto\` ADD CONSTRAINT \`FK_f744d54fb63f14d2cf5f02d2cf1\` FOREIGN KEY (\`id_producto\`) REFERENCES \`productos\`(\`id_producto\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`costo_insumo_historial\` ADD CONSTRAINT \`FK_51056cf74ffc893a955254ac115\` FOREIGN KEY (\`id_insumo\`) REFERENCES \`insumos\`(\`id_insumo\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`recetas_plato\` ADD CONSTRAINT \`FK_aea6125c187eea293642cead458\` FOREIGN KEY (\`id_producto\`) REFERENCES \`productos\`(\`id_producto\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`recetas_plato\` ADD CONSTRAINT \`FK_2311e1a7cfea9e9304f7dbd5e97\` FOREIGN KEY (\`id_insumo\`) REFERENCES \`insumos\`(\`id_insumo\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`recetas_plato\` DROP FOREIGN KEY \`FK_2311e1a7cfea9e9304f7dbd5e97\``);
        await queryRunner.query(`ALTER TABLE \`recetas_plato\` DROP FOREIGN KEY \`FK_aea6125c187eea293642cead458\``);
        await queryRunner.query(`ALTER TABLE \`costo_insumo_historial\` DROP FOREIGN KEY \`FK_51056cf74ffc893a955254ac115\``);
        await queryRunner.query(`ALTER TABLE \`inventario_producto\` DROP FOREIGN KEY \`FK_f744d54fb63f14d2cf5f02d2cf1\``);
        await queryRunner.query(`ALTER TABLE \`inventario_mov\` DROP FOREIGN KEY \`FK_32867723282b29af1ff49905f04\``);
        await queryRunner.query(`ALTER TABLE \`inventario_producto\` DROP INDEX \`UQ_inv_prod_fecha\``);

        await queryRunner.query(`DROP INDEX \`IDX_0d28ae68a8f742beb176aa51ae\` ON \`insumos\``);
        await queryRunner.query(`DROP TABLE \`insumos\``);
        await queryRunner.query(`DROP INDEX \`IDX_87fa33d2f04ac1a849f5fec445\` ON \`recetas_plato\``);
        await queryRunner.query(`DROP TABLE \`recetas_plato\``);
        await queryRunner.query(`DROP TABLE \`costo_insumo_historial\``);
        await queryRunner.query(`DROP TABLE \`inventario_producto\``);
        await queryRunner.query(`DROP TABLE \`inventario_mov\``);
        
    }

}
