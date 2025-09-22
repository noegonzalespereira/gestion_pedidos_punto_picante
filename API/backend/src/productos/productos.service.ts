import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, DeepPartial } from 'typeorm';
import { Producto } from './producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-producto.dto';

@Injectable()
export class ProductosService {
  constructor(@InjectRepository(Producto) private readonly repo: Repository<Producto>) {}

  async create(dto: CreateProductoDto) {
    const exists = await this.repo.findOne({ where: { nombre: dto.nombre } });
    if (exists) throw new ConflictException('Ya existe un producto con ese nombre');

    const partial: DeepPartial<Producto> = {
      nombre: dto.nombre,
      tipo: dto.tipo,
      precio: dto.precio,
      // solo incluimos img_url si vino; si vino null, guardamos null
      ...(dto.img_url !== undefined ? { img_url: dto.img_url } : {}),
      activo: dto.activo ?? 1,
    };

    const entity = this.repo.create(partial);
    return this.repo.save(entity);
  }

  async findAll(q: QueryProductosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(q.pageSize ?? 50)));

    const where: any = {};
    if (q.tipo) where.tipo = q.tipo;
    if (q.activo !== undefined) where.activo = q.activo;

    const whereLike = q.search ? { nombre: Like(`%${q.search}%`) } : {};

    const [rows, total] = await this.repo.findAndCount({
      where: { ...where, ...whereLike },
      order: { nombre: 'ASC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    return { total, page, pageSize, data: rows };
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async update(id: number, dto: UpdateProductoDto) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');

    if (dto.nombre !== undefined) p.nombre = dto.nombre;
    if (dto.tipo !== undefined) p.tipo = dto.tipo;
    if (dto.precio !== undefined) p.precio = dto.precio;

    if (dto.img_url !== undefined) {
      // permite null para limpiar la URL
      p.img_url = dto.img_url;
    }

    if (dto.activo !== undefined) p.activo = dto.activo;

    return this.repo.save(p);
  }

  async remove(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    p.activo = 0;
    return this.repo.save(p);
  }

  async activar(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    p.activo = 1;
    return this.repo.save(p);
  }
}
