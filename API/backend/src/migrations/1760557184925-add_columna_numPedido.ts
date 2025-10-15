import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnaNumPedido1760557184925 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pedido
      ADD COLUMN num_pedido INT NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pedido
      DROP COLUMN num_pedido;
    `);
  }
}
