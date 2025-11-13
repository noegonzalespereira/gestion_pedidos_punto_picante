import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';

import { Producto, TipoProducto } from '../productos/producto.entity';

// Entidades (usa los paths nuevos bajo /recetas/entities)
import { Insumo } from './insumo.entity';
import { CostoInsumoHistorial } from './costo-insumo.entity';
import { RecetaPlato } from './receta-plato.entity';

// DTOs
import { RecetaUpsertDto } from './dto/receta.dto';
import { CostoInsumoDto } from './dto/costo-insumo.dto';

type DesgloseItem = {
  insumo: string;
  unidad_base: string;
  cantidad_base: number;
  merma_porcentaje: number;   // 0..100
  consumo_neto: number;       // cantidad_base * (1 + merma%)
  costo_unitario: number;     // vigente a la fecha consultada
  costo: number;              // consumo_neto * costo_unitario
};

@Injectable()
export class RecetasService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
    @InjectRepository(Insumo) private readonly insumoRepo: Repository<Insumo>,
    @InjectRepository(CostoInsumoHistorial) private readonly costoRepo: Repository<CostoInsumoHistorial>,
    @InjectRepository(RecetaPlato) private readonly recetaRepo: Repository<RecetaPlato>,
  ) {}

  // ===================== Utilidades =====================

  /** Parsea fecha (string) a Date, o ahora si es falsy. */
  private toDateOrNow(v?: string | Date): Date {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  /** Devuelve el costo unitario vigente para un insumo a una fecha dada. */
  private async costoVigenteInsumo(id_insumo: number, at: Date): Promise<number> {
    const row = await this.costoRepo
      .createQueryBuilder('c')
      .where('c.id_insumo = :id', { id: id_insumo })
      .andWhere('c.vigencia_desde <= :at', { at })
      .orderBy('c.vigencia_desde', 'DESC')
      .addOrderBy('c.id_costo', 'DESC')
      .getOne();

    if (!row) {
      // Si no hay costo histórico, lo tratamos como 0 (o puedes lanzar error si prefieres)
      return 0;
    }
    return Number(row.costo_unitario);
  }

  // ===================== Insumos =====================

  async crearInsumo(nombre: string, unidad_base: string) {
    if (!nombre?.trim()) throw new BadRequestException('Nombre requerido');
    if (!unidad_base?.trim()) throw new BadRequestException('unidad_base requerida');

    const exists = await this.insumoRepo.findOne({ where: { nombre } });
    if (exists) throw new BadRequestException('Ya existe un insumo con ese nombre');

    const saved = await this.insumoRepo.save(this.insumoRepo.create({ nombre, unidad_base }));
    return saved;
  }

  async editarInsumo(id_insumo: number, patch: Partial<Pick<Insumo, 'nombre' | 'unidad_base'>>) {
    const ins = await this.insumoRepo.findOne({ where: { id_insumo } });
    if (!ins) throw new NotFoundException('Insumo no encontrado');

    if (patch.nombre !== undefined) ins.nombre = patch.nombre;
    if (patch.unidad_base !== undefined) ins.unidad_base = patch.unidad_base;

    return this.insumoRepo.save(ins);
  }

  async eliminarInsumo(id_insumo: number) {
    const res = await this.insumoRepo.delete(id_insumo);
    if (!res.affected) throw new NotFoundException('Insumo no encontrado');
    return { ok: true };
  }

  async listarInsumos() {
    
    return this.insumoRepo.find({ order: { nombre: 'ASC' } });
  }

  // ===================== Costos de Insumo =====================

  /** Inserta un nuevo costo vigente desde la fecha indicada (no borra históricos) */
  async setCostoInsumo(dto: CostoInsumoDto) {
    const ins = await this.insumoRepo.findOne({ where: { id_insumo: dto.id_insumo } });
    if (!ins) throw new NotFoundException('Insumo no encontrado');

    const vig = this.toDateOrNow(dto.vigencia_desde);
    const entity = this.costoRepo.create({
      insumo: { id_insumo: dto.id_insumo } as any,
      costo_unitario: dto.costo_unitario.toFixed(4),
      vigencia_desde: vig,
      nota: dto.nota ?? null,
    });
    const saved = await this.costoRepo.save(entity);
    return saved;
  }
  //historial de costos de insumo
  async getHistorialCostos(id_insumo: number) {
    const insumo = await this.insumoRepo.findOne({ where: { id_insumo } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');

    return this.costoRepo.find({
        where: { insumo: { id_insumo } as any },
        relations: { insumo: true }, // Opcional, pero útil para obtener la unidad base
        order: { vigencia_desde: 'DESC', created_at: 'DESC' },
    });
}

  // ===================== Receta (por plato) =====================

  /**
   * Reemplaza la receta completa del plato (upsert).
   * Borra filas anteriores y crea las nuevas.
   */
  async upsertReceta(dto: RecetaUpsertDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no encontrado');
    if (prod.tipo !== TipoProducto.PLATO) {
      throw new BadRequestException('La receta solo aplica a productos de tipo PLATO');
    }

    if (!dto.items?.length) {
      // Receta vacía también es válida: borra todo
      await this.recetaRepo.delete({ producto: { id_producto: dto.id_producto } as any });
      return { ok: true, items: [] };
    }

    // Validar insumos
    const idsInsumo = dto.items.map(i => i.id_insumo);
    const insumos = await this.insumoRepo.find({ where: { id_insumo: In(idsInsumo) } });
    if (insumos.length !== idsInsumo.length) {
      const faltan = idsInsumo.filter(id => !insumos.find(x => x.id_insumo === id));
      throw new BadRequestException(`Insumos inexistentes: ${faltan.join(', ')}`);
    }

    // Tx: borrar y crear
    await this.dataSource.transaction(async (mgr) => {
      await mgr.delete(RecetaPlato, { producto: { id_producto: dto.id_producto } as any });

      for (const it of dto.items) {
        if (it.cantidad_base < 0) throw new BadRequestException('cantidad_base no puede ser negativa');
        const merma = it.merma_porcentaje ?? 0;
        if (merma < 0) throw new BadRequestException('merma_porcentaje no puede ser negativa');

        const row = mgr.create(RecetaPlato, {
          producto: { id_producto: dto.id_producto } as any,
          insumo: { id_insumo: it.id_insumo } as any,
          cantidad_base: it.cantidad_base.toFixed(3),
          merma_porcentaje: merma.toFixed(2),
          nota: dto.nota ?? null, // opcional: nota general aplicada a cada renglón
        });
        await mgr.save(row);
      }
    });

    return this.getReceta(dto.id_producto);
  }


  /** Devuelve la receta de un plato con costo vigente y total */
  async getReceta(id_producto: number, fecha?: string) {
    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no encontrado');
    if (prod.tipo !== TipoProducto.PLATO) {
      throw new BadRequestException('La receta solo aplica a productos de tipo PLATO');
    }

    const at = this.toDateOrNow(fecha);
    const rows = await this.recetaRepo.find({
      where: { producto: { id_producto } as any },
      relations: { insumo: true },
      order: { id_receta: 'ASC' },
    });

    const desglose: DesgloseItem[] = [];
    let total = 0;

    for (const r of rows) {
      const cantidadBase = Number(r.cantidad_base);
      const mermaPorc = Number(r.merma_porcentaje ?? 0); // 0..100
      const consumoNeto = cantidadBase * (1 + mermaPorc / 100);

      const costoUnit = await this.costoVigenteInsumo(r.insumo.id_insumo, at);
      const costo = consumoNeto * costoUnit;

      total += costo;

      desglose.push({
        insumo: r.insumo.nombre,
        unidad_base: r.insumo.unidad_base,
        cantidad_base: Number(cantidadBase.toFixed(3)),
        merma_porcentaje: Number(mermaPorc.toFixed(2)),
        consumo_neto: Number(consumoNeto.toFixed(3)),
        costo_unitario: Number(costoUnit.toFixed(4)),
        costo: Number(costo.toFixed(4)),
      });
    }

    return {
      id_producto,
      producto: prod.nombre,
      fecha_base_costos: at.toISOString(),
      costo_teorico_total: Number(total.toFixed(4)),
      items: desglose,
    };
  }

  /**
   * Calcula solo el costo total (con desglose opcional) para usarlo en reportes.
   * Alias conveniente por si quieres exponer endpoint `GET /recetas/:id/costo?fecha=...`
   */
  async costoPlato(id_producto: number, fecha?: string) {
    return this.getReceta(id_producto, fecha);
  }

// recetas.service.ts (Función listarResumenRecetas FINALMENTE CORREGIDA)

async listarResumenRecetas() {
    const platosConReceta = await this.recetaRepo
        .createQueryBuilder('r')
        .select('r.id_producto', 'platoId') 
        .groupBy('r.id_producto') 
        .getRawMany();

    const idsPlatos = platosConReceta
        .map(p => Number(p.platoId)) 
        .filter(id => !isNaN(id) && id > 0);
    
    // 🚨 PASO DE DEBUG CRÍTICO 🚨
    // Antes de iterar, verificamos qué IDs quedaron
    console.log('--- Debug IDs Platos ---');
    console.log('Platos crudos de la DB:', platosConReceta);
    console.log('IDs después del filtro (debe ser [1, 2, ...]):', idsPlatos);

        if (idsPlatos.length === 0) {
            return [];
        }
        
        const resultados: any[] = [];
        
        // 3. Iteramos sobre los IDs válidos
        for (const id_producto of idsPlatos) {
            try{
                // getReceta hará la consulta principal usando este ID
                const recetaData = await this.getReceta(id_producto); 
                
                // Obtenemos la última actualización
                const ultimaReceta = await this.recetaRepo.findOne({
                    where: { producto: { id_producto } as any },
                    order: { created_at: 'DESC' },
                });

                resultados.push({
                    id_producto: recetaData.id_producto,
                    nombre: recetaData.producto,
                    ingredientes_count: recetaData.items.length, 
                    costo_teorico: Number(recetaData.costo_teorico_total).toFixed(2), 
                    ultima_actualizacion: ultimaReceta?.created_at.toISOString() || new Date().toISOString(),
                });
            } catch (e) {
                // Captura fallos individuales de getReceta (ej. producto eliminado)
                console.error(`Error al procesar resumen para ID ${id_producto}:`, e);
            }
        }

        return resultados;
    } catch (dbError) {
        // Captura cualquier fallo de la consulta SQL inicial (ej. columna mal escrita)
        console.error("ERROR GRAVE EN listarResumenRecetas SQL:", dbError);
        throw new NotFoundException('Fallo al generar el resumen de recetas (Error interno del servidor)');
    }
}

