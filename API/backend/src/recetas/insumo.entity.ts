import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { CostoInsumoHistorial } from './costo-insumo.entity';
import { RecetaPlato } from '../recetas/receta-plato.entity';

@Entity('insumos')
export class Insumo {
  @PrimaryGeneratedColumn() id_insumo: number;
  @Column({ length: 150, unique: true }) nombre: string;
  @Column({ length: 20 }) unidad_base: string;   // 'g','ml','unidad'
  @CreateDateColumn() created_at: Date;

  @OneToMany(() => CostoInsumoHistorial, c => c.insumo) costos: CostoInsumoHistorial[];
  @OneToMany(() => RecetaPlato, r => r.insumo) recetas: RecetaPlato[];
}
