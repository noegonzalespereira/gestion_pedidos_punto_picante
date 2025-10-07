import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Producto } from '../productos/producto.entity';
import { Insumo } from './insumo.entity';

@Entity('recetas_plato')
@Unique(['producto', 'insumo'])
export class RecetaPlato {
  @PrimaryGeneratedColumn() id_receta: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @ManyToOne(() => Insumo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_insumo' })
  insumo: Insumo;

  @Column('decimal', { precision: 10, scale: 3 }) cantidad_base: string;
  @Column('decimal', { precision: 5, scale: 2, default: 0 }) merma_porcentaje: string;
  @Column({ type: 'text', nullable: true }) nota: string | null;
  @CreateDateColumn() created_at: Date;
}
