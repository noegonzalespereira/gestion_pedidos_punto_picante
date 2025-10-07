import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1759172300856 implements MigrationInterface {
    name = 'Auto1759172300856'

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
        ALTER TABLE \`pedido\`
        MODIFY \`tipo_pedido\` ENUM('MESA','LLEVAR','MIXTO') NOT NULL
        `);
        await q.query(`
      ALTER TABLE \`detalles_pedido\`
      ADD \`destino\` ENUM('MESA','LLEVAR') NOT NULL DEFAULT 'MESA'
    `);

    
        await q.query(`
        UPDATE detalles_pedido d
        JOIN pedido p ON p.id_pedido = d.id_pedido
        SET d.destino = CASE
            WHEN p.tipo_pedido = 'LLEVAR' THEN 'LLEVAR'
            ELSE 'MESA'
        END
        `);

    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE \`detalles_pedido\` DROP COLUMN \`destino\``);
        await q.query(`
        ALTER TABLE \`pedido\`
        MODIFY \`tipo_pedido\` ENUM('MESA','LLEVAR') NOT NULL
        `);
        
    }

}
