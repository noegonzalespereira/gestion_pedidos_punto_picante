import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Insumo } from './insumo.entity';

@Entity('costo_insumo_historial')
export class CostoInsumoHistorial {
  @PrimaryGeneratedColumn() id_costo: number;

  @ManyToOne(() => Insumo, i => i.costos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_insumo' })
  insumo: Insumo;

  @Column('decimal', { precision: 10, scale: 4 }) costo_unitario: string; // por unidad_base
  @Column() vigencia_desde: Date;
  @Column({ type: 'text', nullable: true }) nota: string | null;
  @CreateDateColumn() created_at: Date;
}
