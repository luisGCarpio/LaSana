import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AperturaCajaDto } from './dto/apertura-caja.dto';
import { CierreCajaDto } from './dto/cierre-caja.dto';

@Injectable()
export class CajasService {
  constructor(private readonly prisma: PrismaService) {}

  async aperturaCaja(id_empleado: number, dto: AperturaCajaDto) {
    // 1. Validar que la caja exista y esté activa
    const caja = await this.prisma.caja.findUnique({
      where: { id_caja: dto.id_caja },
    });

    if (!caja || !caja.activa) {
      throw new NotFoundException('Caja no encontrada o inactiva');
    }

    // 2. Validar que el empleado no tenga ya un turno abierto
    const turnoEmpleado = await this.prisma.cierre_caja.findFirst({
      where: {
        id_empleado,
        estado: 'ABIERTA',
      },
    });

    if (turnoEmpleado) {
      throw new BadRequestException(
        'El empleado ya tiene un turno de caja abierto',
      );
    }

    // 3. Validar que la caja no esté ocupada por otro turno abierto
    const turnoCaja = await this.prisma.cierre_caja.findFirst({
      where: {
        id_caja: dto.id_caja,
        estado: 'ABIERTA',
      },
    });

    if (turnoCaja) {
      throw new BadRequestException(
        'La caja ya se encuentra ocupada por otro turno abierto',
      );
    }

    // 4. Crear registro de apertura
    return this.prisma.cierre_caja.create({
      data: {
        id_caja: dto.id_caja,
        id_empleado,
        monto_inicial: dto.monto_inicial,
        monto_esperado: dto.monto_inicial,
        estado: 'ABIERTA',
        fecha_apertura: new Date(),
      },
      include: {
        caja: true,
      },
    });
  }

  async cierreCaja(id_empleado: number, dto: CierreCajaDto) {
    // 1. Buscar turno abierto del empleado
    const turno = await this.prisma.cierre_caja.findFirst({
      where: {
        id_empleado,
        estado: 'ABIERTA',
      },
      include: {
        caja: true,
      },
    });

    if (!turno) {
      throw new BadRequestException(
        'El empleado no tiene un turno de caja abierto para cerrar',
      );
    }

    // 2. Sumar ventas completadas del turno
    const agregacionVentas = await this.prisma.venta.aggregate({
      _sum: {
        total: true,
      },
      where: {
        id_empleado: turno.id_empleado,
        id_sucursal: turno.caja.id_sucursal,
        estado: 'COMPLETADA',
        fecha: {
          gte: turno.fecha_apertura,
        },
      },
    });

    const total_ventas = Number(agregacionVentas._sum.total || 0);

    // 3. Calcular montos esperados y diferencias
    const monto_esperado = Number(
      (Number(turno.monto_inicial) + total_ventas).toFixed(2),
    );
    const diferencia = Number(
      (Number(dto.monto_fisico) - monto_esperado).toFixed(2),
    );

    // 4. Detectar descuadre si aplica
    let observacion = dto.observacion?.trim();
    if (Math.abs(diferencia) > 0.001) {
      const notaDescuadre = `[DESCUADRE DETECTADO: Diferencia de ${diferencia.toFixed(2)}]`;
      observacion = observacion
        ? `${observacion} ${notaDescuadre}`
        : notaDescuadre;
    }

    // 5. Actualizar turno a CERRADA
    return this.prisma.cierre_caja.update({
      where: { id_cierre: turno.id_cierre },
      data: {
        fecha_cierre: new Date(),
        monto_esperado,
        monto_fisico: dto.monto_fisico,
        diferencia,
        estado: 'CERRADA',
        observacion: observacion || null,
      },
      include: {
        caja: true,
      },
    });
  }

  async obtenerEstadoActual(id_empleado: number) {
    const turno = await this.prisma.cierre_caja.findFirst({
      where: {
        id_empleado,
        estado: 'ABIERTA',
      },
      include: {
        caja: true,
      },
    });

    if (!turno) {
      return { tiene_turno_abierto: false, turno: null };
    }

    return { tiene_turno_abierto: true, turno };
  }

  async obtenerHistorial(id_empleado?: number, id_sucursal?: number) {
    const where: any = {};

    if (id_empleado !== undefined) {
      where.id_empleado = id_empleado;
    }

    if (id_sucursal !== undefined) {
      where.caja = {
        id_sucursal,
      };
    }

    return this.prisma.cierre_caja.findMany({
      where,
      include: {
        caja: true,
      },
      orderBy: {
        fecha_apertura: 'desc',
      },
    });
  }
}
