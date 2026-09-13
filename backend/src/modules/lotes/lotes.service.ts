import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { QueryLotesDto } from './dto/query-lotes.dto';
import { calcularSemaforo } from '../../common/utils/fefo.util';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLoteDto) {
    // 1. Validar que el producto exista
    const producto = await this.prisma.producto.findUnique({
      where: { id_producto: dto.id_producto },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    // 2. Validar número de lote único por producto
    const existe = await this.prisma.lote.findUnique({
      where: {
        id_producto_numero_lote: {
          id_producto: dto.id_producto,
          numero_lote: dto.numero_lote,
        },
      },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe un lote con este número para el producto',
      );
    }

    // 3. Registrar lote
    const lote = await this.prisma.lote.create({
      data: {
        id_producto: dto.id_producto,
        numero_lote: dto.numero_lote,
        fecha_fabricacion: dto.fecha_fabricacion
          ? new Date(dto.fecha_fabricacion)
          : null,
        fecha_vencimiento: new Date(dto.fecha_vencimiento),
      },
      include: {
        producto: { select: { codigo: true, nombre: true } },
      },
    });

    return { ...lote, ...calcularSemaforo(lote.fecha_vencimiento) };
  }

  async findAll(query: QueryLotesDto) {
    const lotes = await this.prisma.lote.findMany({
      where: { id_producto: query.id_producto },
      include: {
        producto: { select: { codigo: true, nombre: true } },
      },
      orderBy: { fecha_vencimiento: 'asc' },
    });

    const lotesConSemaforo = lotes.map((lote) => ({
      ...lote,
      ...calcularSemaforo(lote.fecha_vencimiento),
    }));

    if (query.semaforo) {
      return lotesConSemaforo.filter(
        (lote) => lote.semaforo === query.semaforo,
      );
    }

    return lotesConSemaforo;
  }

  async findById(id: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { id_lote: id },
      include: {
        producto: { select: { codigo: true, nombre: true } },
      },
    });

    if (!lote) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }

    return { ...lote, ...calcularSemaforo(lote.fecha_vencimiento) };
  }
}
