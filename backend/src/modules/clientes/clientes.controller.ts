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
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('Cajero', 'Gerente')
  @ApiOperation({ summary: 'Registrar un nuevo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Documento ya registrado' })
  async create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get('documento/:documento')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Buscar cliente por número de documento' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findByDocumento(@Param('documento') documento: string) {
    return this.clientesService.findByDocumento(documento);
  }

  @Get()
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Listar todos los clientes' })
  @ApiResponse({ status: 200, description: 'Lista de clientes retornada' })
  async findAll() {
    return this.clientesService.findAll();
  }

  @Get(':id')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Obtener cliente por su ID' })
  @ApiResponse({ status: 200, description: 'Cliente retornado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.findById(id);
  }
}
