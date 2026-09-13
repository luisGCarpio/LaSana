import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecetaDto } from './dto/create-receta.dto';

export interface ValidacionRecetaResultado {
  valida: boolean;
  motivo?: string;
  receta?: any;
}

@Injectable()
export class RecetasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecetaDto) {
    // 1. Validar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: dto.id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // 2. Validar que no exista otra receta con el mismo número
    const existe = await this.prisma.receta.findUnique({
      where: { numero_receta: dto.numero_receta },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe una receta registrada con este número',
      );
    }

    // 3. Crear registro de receta médica
    return this.prisma.receta.create({
      data: {
        id_cliente: dto.id_cliente,
        numero_receta: dto.numero_receta,
        fecha_emision: new Date(dto.fecha_emision),
        fecha_vencimiento: dto.fecha_vencimiento
          ? new Date(dto.fecha_vencimiento)
          : null,
        observacion: dto.observacion || null,
      },
      include: {
        cliente: true,
      },
    });
  }

  async validarReceta(numero_receta: string): Promise<ValidacionRecetaResultado> {
    // 1. Verificar existencia de la receta
    const receta = await this.prisma.receta.findUnique({
      where: { numero_receta },
      include: {
        cliente: true,
        venta: {
          where: { estado: 'COMPLETADA' },
        },
      },
    });

    if (!receta) {
      return {
        valida: false,
        motivo: 'La receta médica no se encuentra registrada en el sistema',
      };
    }

    // 2. Verificar que no esté vencida
    if (receta.fecha_vencimiento) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const vencimiento = new Date(receta.fecha_vencimiento);
      vencimiento.setHours(0, 0, 0, 0);

      if (vencimiento < hoy) {
        return {
          valida: false,
          motivo: 'La receta médica se encuentra vencida',
          receta,
        };
      }
    }

    // 3. Verificar que no haya sido usada previamente en una venta completada
    if (receta.venta && receta.venta.length > 0) {
      return {
        valida: false,
        motivo:
          'La receta médica ya fue utilizada en una venta completada previa',
        receta,
      };
    }

    // 4. Receta válida
    return {
      valida: true,
      receta,
    };
  }

  async findByNumero(numero_receta: string) {
    const receta = await this.prisma.receta.findUnique({
      where: { numero_receta },
      include: {
        cliente: true,
      },
    });

    if (!receta) {
      throw new NotFoundException(
        `Receta médica con número ${numero_receta} no encontrada`,
      );
    }

    return receta;
  }
}
