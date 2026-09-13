import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-productos.dto';
import { manejarErrorPrisma } from '../../common/utils/prisma-error.util';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductoDto) {
    // 1. Validar que el código sea único
    const existe = await this.prisma.producto.findUnique({
      where: { codigo: dto.codigo },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe un producto registrado con este código',
      );
    }

    // 2. Crear producto en el catálogo
    // .catch: la verificación previa de unicidad es check-then-insert; si dos
    // usuarios crean el mismo código en paralelo, la BD responde P2002 => 409.
    return this.prisma.producto
      .create({
        data: {
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion || null,
          precio_venta: dto.precio_venta,
          requiere_receta: dto.requiere_receta ?? false,
        },
      })
      .catch(manejarErrorPrisma);
  }

  async findAll(query: QueryProductosDto) {
    return this.prisma.producto.findMany({
      where: {
        activo: query.activo,
        OR: query.busqueda
          ? [
              { codigo: { contains: query.busqueda, mode: 'insensitive' } },
              { nombre: { contains: query.busqueda, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findById(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id_producto: id },
    });

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return producto;
  }

  async findByCodigo(codigo: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { codigo },
    });

    if (!producto) {
      throw new NotFoundException(
        `Producto con código ${codigo} no encontrado`,
      );
    }

    return producto;
  }

  async update(id: number, dto: UpdateProductoDto) {
    const producto = await this.findById(id);

    // 1. Validar unicidad del código si se está modificando
    if (dto.codigo && dto.codigo !== producto.codigo) {
      const existe = await this.prisma.producto.findUnique({
        where: { codigo: dto.codigo },
      });

      if (existe) {
        throw new BadRequestException(
          'Ya existe un producto registrado con este código',
        );
      }
    }

    // 2. Actualizar producto (P2002 por carrera en el cambio de código => 409)
    return this.prisma.producto
      .update({
        where: { id_producto: id },
        data: dto,
      })
      .catch(manejarErrorPrisma);
  }

  async remove(id: number) {
    await this.findById(id);

    // Baja lógica: se conserva el histórico de ventas y lotes asociados
    const producto = await this.prisma.producto.update({
      where: { id_producto: id },
      data: { activo: false },
    });

    return { message: 'Producto desactivado correctamente', producto };
  }
}
