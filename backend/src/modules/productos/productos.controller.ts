import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-productos.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('productos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Roles('Dueño')
  @ApiOperation({ summary: 'Registrar un producto en el catálogo' })
  @ApiResponse({ status: 201, description: 'Producto registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Código de producto duplicado' })
  async create(@Body() dto: CreateProductoDto) {
    return this.productosService.create(dto);
  }

  @Get()
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Listar y buscar productos del catálogo' })
  @ApiResponse({ status: 200, description: 'Lista de productos retornada' })
  async findAll(@Query() query: QueryProductosDto) {
    return this.productosService.findAll(query);
  }

  @Get('codigo/:codigo')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Buscar producto por su código único' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async findByCodigo(@Param('codigo') codigo: string) {
    return this.productosService.findByCodigo(codigo);
  }

  @Get(':id')
  @Roles('Cajero', 'Gerente', 'Dueño')
  @ApiOperation({ summary: 'Obtener producto por su ID' })
  @ApiResponse({ status: 200, description: 'Producto retornado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.findById(id);
  }

  @Patch(':id')
  @Roles('Dueño')
  @ApiOperation({ summary: 'Actualizar datos de un producto' })
  @ApiResponse({ status: 200, description: 'Producto actualizado' })
  @ApiResponse({ status: 400, description: 'Código de producto duplicado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Dueño')
  @ApiOperation({ summary: 'Desactivar un producto (baja lógica)' })
  @ApiResponse({ status: 200, description: 'Producto desactivado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id);
  }
}
