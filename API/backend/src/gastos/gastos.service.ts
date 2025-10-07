import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
  
import { Between, MoreThanOrEqual, LessThanOrEqual, Repository, DeepPartial } from 'typeorm';
import { Gasto } from './gasto.entity';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { Caja, EstadoCaja } from '../caja/caja.entity';

type RolUsuario = 'GERENTE' | 'CAJERO' | 'COCINA';

@Injectable()
export class GastosService {
  constructor(
    @InjectRepository(Gasto) private readonly repo: Repository<Gasto>,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
  ) {}

  // Convierte a 'YYYY-MM-DD' para columna DATE
  private toYMD(v?: string): string {
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (!v) return toYMD(new Date());
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return toYMD(d);
  }

  private parseDateMaybe(value?: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  async create(userId: number, userRol: RolUsuario, dto: CreateGastoDto) {
    // Si viene caja, validarla
    let caja: Caja | null = null;
    if (dto.id_caja !== undefined && dto.id_caja !== null) {
      caja = await this.cajas.findOne({ where: { id_caja: dto.id_caja } });
      if (!caja) throw new NotFoundException('Caja no existe');

      if (userRol === 'CAJERO' && caja.estado !== EstadoCaja.ABIERTA) {
        throw new ForbiddenException('La caja no está ABIERTA');
      }
    }

    const partial: DeepPartial<Gasto> = {
      // relaciones:
      usuario: { id_usuario: userId } as any,
      ...(caja ? { caja: { id_caja: caja.id_caja } as any } : {}),

      // datos:
      nombre_producto: dto.nombre_producto,
      ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
      cantidad: dto.cantidad,
      precio: dto.precio,
      fecha: this.toYMD(dto.fecha),
    };

    const entity = this.repo.create(partial);
    const saved = (await this.repo.save(entity)) as Gasto;

    return {
      ...saved,
      total: (Number(saved.precio) * saved.cantidad).toFixed(2),
    };
  }

  async findOne(id_gasto: number) {
    const g = await this.repo.findOne({ where: { id_gasto } });
    if (!g) throw new NotFoundException('Gasto no encontrado');
    return { ...g, total: (Number(g.precio) * g.cantidad).toFixed(2) };
  }

  async findAll(query: {
    caja?: number;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }) {
    // Build where para findAndCount (soporta anidado en 0.3.x)
    const where: any = {};
    if (query.caja) where.caja = { id_caja: query.caja };

    const d1 = this.parseDateMaybe(query.desde);
    const d2 = this.parseDateMaybe(query.hasta);
    if (d1 && d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      where.fecha = Between(d1, end);
    } else if (d1) {
      where.fecha = MoreThanOrEqual(d1);
    } else if (d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      where.fecha = LessThanOrEqual(end);
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? 20)));

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { fecha: 'DESC', id_gasto: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    const data = rows.map((g) => ({
      ...g,
      total: (Number(g.precio) * g.cantidad).toFixed(2),
    }));

    return { total, page, pageSize, data };
  }

  async update(userRol: RolUsuario, id_gasto: number, dto: UpdateGastoDto) {
    const gasto = await this.repo.findOne({ where: { id_gasto } });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    // Validar caja actual si es CAJERO
    if (userRol === 'CAJERO') {
      // necesitamos estado de la caja asociada (si hay)
      const caja = gasto.id_caja
        ? await this.cajas.findOne({ where: { id_caja: gasto.id_caja } })
        : null;
      if (caja && caja.estado !== EstadoCaja.ABIERTA) {
        throw new ForbiddenException('La caja no está ABIERTA');
      }
    }

    if (dto.nombre_producto !== undefined) gasto.nombre_producto = dto.nombre_producto;
    if (dto.descripcion !== undefined) gasto.descripcion = dto.descripcion;
    if (dto.cantidad !== undefined) gasto.cantidad = dto.cantidad;
    if (dto.precio !== undefined) gasto.precio = dto.precio;
    if (dto.fecha !== undefined) gasto.fecha = this.toYMD(dto.fecha);

    // Si quisieras cambiar la caja del gasto:
    if (dto.id_caja !== undefined) {
      if (dto.id_caja === null) {
        gasto.caja = null;
      } else {
        const caja = await this.cajas.findOne({ where: { id_caja: dto.id_caja } });
        if (!caja) throw new NotFoundException('Caja no existe');
        gasto.caja = { id_caja: caja.id_caja } as any;
      }
    }

    const saved = (await this.repo.save(gasto)) as Gasto;
    return { ...saved, total: (Number(saved.precio) * saved.cantidad).toFixed(2) };
  }

  async remove(id_gasto: number) {
    const res = await this.repo.delete(id_gasto);
    if (!res.affected) throw new NotFoundException('Gasto no encontrado');
    return { ok: true };
  }

  async resumen(query: { caja?: number; desde?: string; hasta?: string }) {
    // Para el resumen uso QB y filtro por la columna real 'id_caja'
    const qb = this.repo.createQueryBuilder('g').where('1=1');

    if (query.caja) qb.andWhere('g.id_caja = :caja', { caja: query.caja });

    const d1 = this.parseDateMaybe(query.desde);
    const d2 = this.parseDateMaybe(query.hasta);
    if (d1 && d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      qb.andWhere('g.fecha BETWEEN :ini AND :fin', { ini: d1, fin: end });
    } else if (d1) qb.andWhere('g.fecha >= :ini', { ini: d1 });
    else if (d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      qb.andWhere('g.fecha <= :fin', { fin: end });
    }

    const raw =
      (await qb
        .select('COALESCE(SUM(g.precio * g.cantidad), 0)', 'sum')
        .addSelect('COUNT(1)', 'count')
        .getRawOne<{ sum: string | null; count: string }>()) ?? { sum: '0', count: '0' };

    return {
      total_gastos: Number(raw.sum ?? 0).toFixed(2),
      num_gastos: Number(raw.count ?? 0),
    };
  }
}

