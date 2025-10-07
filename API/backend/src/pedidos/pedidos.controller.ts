import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { SetEstadoDto } from './dto/set-estado.dto';
import { PagarDto } from './dto/pagar.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  /** Feed para cocina (polling) — poner ANTES de :id */
  @Get('cocina/pendientes')
  @Roles('COCINA', 'GERENTE')
  cocinaPendientes(@Query('desde') desde?: string) {
    return this.service.listaParaCocina(desde);
  }

  /** Listar */
  @Get()
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  listar(@Query() q: QueryPedidosDto) {
    if (q.caja !== undefined) (q as any).caja = Number(q.caja);
    if (q.num_mesa !== undefined) (q as any).num_mesa = Number(q.num_mesa);
    if (q.page !== undefined) (q as any).page = Number(q.page);
    if (q.pageSize !== undefined) (q as any).pageSize = Number(q.pageSize);
    return this.service.listar(q);
  }

  /** Crear — CAJERO/GERENTE */
  @Post()
  @Roles('CAJERO', 'GERENTE')
  crear(@Req() req: any, @Body() dto: CreatePedidoDto) {
    return this.service.crear(req.user.userId, req.user.rol, dto);
  }

  /** Ver detalle */
  @Get(':id')
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  uno(@Param('id') id: string) {
    return this.service.uno(Number(id));
  }

  /** Editar cabecera / reemplazar ítems — CAJERO/GERENTE */
  @Patch(':id')
  @Roles('CAJERO', 'GERENTE')
  actualizar(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePedidoDto) {
    return this.service.actualizar(req.user.rol, Number(id), dto);
  }

  /** Agregar ítems — CAJERO/GERENTE */
  @Post(':id/items')
  @Roles('CAJERO', 'GERENTE')
  agregarItems(@Param('id') id: string, @Body() dto: AddItemsDto) {
    return this.service.agregarItems(Number(id), dto.items);
  }

  /** Editar un ítem — CAJERO/GERENTE */
  @Patch(':id/items/:detalleId')
  @Roles('CAJERO', 'GERENTE')
  editarItem(@Param('id') id: string, @Param('detalleId') detalleId: string, @Body() dto: UpdateItemDto) {
    return this.service.editarItem(Number(id), Number(detalleId), dto);
  }

  /** Eliminar un ítem — CAJERO/GERENTE */
  @Delete(':id/items/:detalleId')
  @Roles('CAJERO', 'GERENTE')
  eliminarItem(@Param('id') id: string, @Param('detalleId') detalleId: string) {
    return this.service.eliminarItem(Number(id), Number(detalleId));
  }

  /** Cambiar estado del pedido — COCINA/GERENTE */
  @Patch(':id/estado-pedido')
  @Roles('COCINA', 'GERENTE')
  estado(@Param('id') id: string, @Body() dto: SetEstadoDto) {
    return this.service.setEstadoPedido(Number(id), dto.estado);
  }

  /** Pagar — CAJERO/GERENTE */
  @Patch(':id/pagar')
  @Roles('CAJERO', 'GERENTE')
  pagar(@Param('id') id: string, @Body() dto: PagarDto) {
    return this.service.pagar(Number(id), dto?.metodo);
  }
  @Delete(':id')
  @Roles('GERENTE','CAJERO' )
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(Number(id));
  }
}
