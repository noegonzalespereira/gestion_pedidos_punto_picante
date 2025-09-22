import { MigrationInterface, QueryRunner } from "typeorm";

export class addCoreIndexes1758494000000 implements MigrationInterface {
  name = 'addCoreIndexes1758494000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PEDIDO
    await queryRunner.query(`CREATE INDEX idx_pedido_estado_updated ON pedido (estado_pedido, updated_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_created ON pedido (created_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_caja_created ON pedido (id_caja, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_metodo ON pedido (metodo_pago)`);
    await queryRunner.query(`CREATE INDEX idx_pedido_usuario ON pedido (id_usuario)`);

    // DETALLES
    await queryRunner.query(`CREATE INDEX idx_detalle_pedido ON detalles_pedido (id_pedido)`);
    await queryRunner.query(`CREATE INDEX idx_detalle_producto ON detalles_pedido (id_producto)`);

    // GASTOS
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
  }
}
