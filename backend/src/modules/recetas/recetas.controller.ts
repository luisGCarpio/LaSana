import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RecetasService } from './recetas.service';
import { CreateRecetaDto } from './dto/create-receta.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('recetas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recetas')
export class RecetasController {
  constructor(private readonly recetasService: RecetasService) {}

  @Post()
  @Roles('Cajero', 'Gerente')
  @ApiOperation({ summary: 'Registrar una nueva receta médica vinculada a un cliente' })
  @ApiResponse({ status: 201, description: 'Receta registrada exitosamente' })
  @ApiResponse({ status: 400, description: 'Número de receta duplicado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async create(@Body() dto: CreateRecetaDto) {
    return this.recetasService.create(dto);
  }

  @Get('validar/:numero_receta')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({
    summary: 'Validar receta médica (existencia, vigencia y uso previo en ventas)',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la validación ({ valida, motivo, receta })',
  })
  async validarReceta(@Param('numero_receta') numero_receta: string) {
    return this.recetasService.validarReceta(numero_receta);
  }

  @Get(':numero_receta')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Consultar receta médica por su número' })
  @ApiResponse({ status: 200, description: 'Receta encontrada' })
  @ApiResponse({ status: 404, description: 'Receta no encontrada' })
  async findByNumero(@Param('numero_receta') numero_receta: string) {
    return this.recetasService.findByNumero(numero_receta);
  }
}
