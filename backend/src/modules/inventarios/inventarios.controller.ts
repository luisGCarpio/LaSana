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
import { InventariosService } from './inventarios.service';
import { IngresoInventarioDto } from './dto/ingreso-inventario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inventarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventarios')
export class InventariosController {
  constructor(private readonly inventariosService: InventariosService) {}

  @Get('stock/:id_producto/otras-sucursales')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({
    summary:
      'Consultar stock del producto en otras sucursales (Cajero: solo si su stock local es 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Totales por sucursal con vencimiento más próximo',
  })
  @ApiResponse({
    status: 400,
    description: 'El Cajero tiene existencias locales del producto',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async consultarOtrasSucursales(
    @CurrentUser() user: any,
    @Param('id_producto', ParseIntPipe) id_producto: number,
  ) {
    return this.inventariosService.consultarOtrasSucursales(id_producto, user);
  }

  @Get('stock/:id_producto')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({
    summary:
      'Consultar existencias por lote con semáforo FEFO (Cajero: su sucursal)',
  })
  @ApiResponse({ status: 200, description: 'Existencias por lote retornadas' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async consultarStock(
    @CurrentUser() user: any,
    @Param('id_producto', ParseIntPipe) id_producto: number,
  ) {
    return this.inventariosService.consultarStock(id_producto, user);
  }

  @Post('ingreso')
  @Roles('Gerente', 'Dueño')
  @ApiOperation({
    summary:
      'Ingreso provisional de stock por lote (reemplazado por Compras en Fase 2)',
  })
  @ApiResponse({ status: 201, description: 'Stock ingresado y kardex registrado' })
  @ApiResponse({ status: 404, description: 'Lote o sucursal no encontrada' })
  async ingresarStock(
    @CurrentUser() user: any,
    @Body() dto: IngresoInventarioDto,
  ) {
    return this.inventariosService.ingresarStock(dto, user);
  }
}
