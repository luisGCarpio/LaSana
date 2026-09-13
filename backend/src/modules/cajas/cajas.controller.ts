import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CajasService } from './cajas.service';
import { AperturaCajaDto } from './dto/apertura-caja.dto';
import { CierreCajaDto } from './dto/cierre-caja.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('cajas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cajas')
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Post('apertura')
  @Roles('Cajero', 'Gerente')
  @ApiOperation({ summary: 'Aperturar turno de caja' })
  @ApiResponse({ status: 201, description: 'Turno de caja aperturado exitosamente' })
  @ApiResponse({ status: 400, description: 'Empleado o caja con turno abierto activo' })
  @ApiResponse({ status: 404, description: 'Caja no encontrada o inactiva' })
  async apertura(
    @CurrentUser() user: any,
    @Body() dto: AperturaCajaDto,
  ) {
    return this.cajasService.aperturaCaja(user.id_empleado, dto);
  }

  @Post('cierre')
  @Roles('Cajero', 'Gerente')
  @ApiOperation({ summary: 'Cerrar turno de caja y realizar arqueo' })
  @ApiResponse({ status: 200, description: 'Turno cerrado exitosamente con arqueo' })
  @ApiResponse({ status: 400, description: 'El empleado no tiene turno abierto para cerrar' })
  async cierre(
    @CurrentUser() user: any,
    @Body() dto: CierreCajaDto,
  ) {
    return this.cajasService.cierreCaja(user.id_empleado, dto);
  }

  @Get('estado-actual')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Obtener estado del turno actual del empleado en sesión' })
  @ApiResponse({ status: 200, description: 'Estado actual retornado' })
  async obtenerEstadoActual(@CurrentUser() user: any) {
    return this.cajasService.obtenerEstadoActual(user.id_empleado);
  }

  @Get('historial')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Consultar historial de turnos de caja según rol' })
  @ApiResponse({ status: 200, description: 'Historial retornado' })
  async obtenerHistorial(@CurrentUser() user: any) {
    if (user.rol === 'Cajero') {
      return this.cajasService.obtenerHistorial(user.id_empleado, undefined);
    }
    if (user.rol === 'Gerente') {
      return this.cajasService.obtenerHistorial(undefined, user.id_sucursal);
    }
    // Dueño: no aplica filtros obligatorios
    return this.cajasService.obtenerHistorial();
  }
}
