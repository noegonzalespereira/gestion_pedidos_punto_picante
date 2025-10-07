import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecetasController } from './recetas.controller';
import { RecetasService } from './recetas.service';

import { RecetaPlato } from '../recetas/receta-plato.entity';
import { Insumo } from '../recetas/insumo.entity';
import { CostoInsumoHistorial } from '../recetas/costo-insumo.entity';
import { Producto } from '../productos/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecetaPlato, Insumo, CostoInsumoHistorial, Producto])],
  controllers: [RecetasController],
  providers: [RecetasService],
  exports: [RecetasService],
})
export class RecetasModule {}
