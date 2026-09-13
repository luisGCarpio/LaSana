import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { QueryLotesDto } from './dto/query-lotes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('lotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Post()
  @Roles('Dueño', 'Gerente')
  @ApiOperation({ summary: 'Registrar un lote con su fecha de vencimiento' })
  @ApiResponse({ status: 201, description: 'Lote registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Número de lote duplicado para el producto' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async create(@Body() dto: CreateLoteDto) {
    return this.lotesService.create(dto);
  }

  @Get()
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Listar lotes con su semáforo FEFO' })
  @ApiResponse({ status: 200, description: 'Lista de lotes retornada' })
  async findAll(@Query() query: QueryLotesDto) {
    return this.lotesService.findAll(query);
  }

  @Get(':id')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Obtener lote por su ID' })
  @ApiResponse({ status: 200, description: 'Lote retornado' })
  @ApiResponse({ status: 404, description: 'Lote no encontrado' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.lotesService.findById(id);
  }
}
