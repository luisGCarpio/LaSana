import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ventas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @Roles('Cajero', 'Gerente')
  @ApiOperation({
    summary:
      'Procesar una venta transaccional (turno ABIERTA, FEFO, receta y kardex)',
  })
  @ApiResponse({
    status: 201,
    description: 'Venta completada con su detalle y lotes asignados',
  })
  @ApiResponse({
    status: 400,
    description:
      'Sin turno ABIERTA, stock insuficiente/bloqueado por semáforo, o receta inválida',
  })
  @ApiResponse({ status: 404, description: 'Producto o cliente no encontrado' })
  async create(@CurrentUser() user: any, @Body() dto: CreateVentaDto) {
    return this.ventasService.create(dto, user);
  }

  @Get(':id')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Consultar una venta por su ID según sucursal' })
  @ApiResponse({ status: 200, description: 'Venta retornada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async findById(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ventasService.findById(id, user);
  }
}
