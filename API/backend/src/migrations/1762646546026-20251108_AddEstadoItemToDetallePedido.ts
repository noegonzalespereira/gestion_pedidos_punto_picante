import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEstadoItemToDetallePedido1762646546026 implements MigrationInterface {
 

    public async up(queryRunner: QueryRunner): Promise<void> {
       
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` ADD \`estado_item\` enum ('PENDIENTE', 'LISTO') NOT NULL DEFAULT 'PENDIENTE'`);

        
    }


    public async down(queryRunner: QueryRunner): Promise<void> {
        
        await queryRunner.query(`ALTER TABLE \`detalles_pedido\` DROP COLUMN \`estado_item\``);

        
    }
}
