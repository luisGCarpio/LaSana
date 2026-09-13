import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IngresoInventarioDto } from './dto/ingreso-inventario.dto';
import { calcularSemaforo } from '../../common/utils/fefo.util';
import { manejarErrorPrisma } from '../../common/utils/prisma-error.util';

@Injectable()
export class InventariosService {
  constructor(private readonly prisma: PrismaService) {}

  async consultarStock(id_producto: number, user: any) {
    // 1. Validar que el producto exista
    await this.obtenerProducto(id_producto);

    // 2. Consultar existencias por lote (Cajero: solo su sucursal)
    const where: any = {
      cantidad: { gt: 0 },
      lote: { id_producto },
    };

    if (user.rol === 'Cajero') {
      where.id_sucursal = user.id_sucursal;
    }

    const inventarios = await this.prisma.inventario_lote.findMany({
      where,
      include: { lote: true, sucursal: true },
      orderBy: [
        { id_sucursal: 'asc' },
        { lote: { fecha_vencimiento: 'asc' } },
      ],
    });

    return inventarios.map((item) => this.aElementoStock(item));
  }

  async consultarOtrasSucursales(id_producto: number, user: any) {
    await this.obtenerProducto(id_producto);

    const where: any = {
      cantidad: { gt: 0 },
      lote: { id_producto },
    };

    if (user.rol === 'Cajero') {
      // 1. Regla de negocio: solo se permite consultar otras sedes con stock local en 0
      const stockLocal = await this.prisma.inventario_lote.aggregate({
        _sum: { cantidad: true },
        where: { id_sucursal: user.id_sucursal, lote: { id_producto } },
      });

      if ((stockLocal._sum.cantidad ?? 0) > 0) {
        throw new BadRequestException(
          'El producto tiene existencias en su sucursal; la consulta intersede solo se permite con stock local en 0',
        );
      }

      where.id_sucursal = { not: user.id_sucursal };
    }

    const inventarios = await this.prisma.inventario_lote.findMany({
      where,
      include: { lote: true, sucursal: true },
      orderBy: { lote: { fecha_vencimiento: 'asc' } },
    });

    // 2. Agrupar por sucursal con total y vencimiento más próximo
    const porSucursal = new Map<
      number,
      {
        id_sucursal: number;
        sucursal: string;
        cantidad_total: number;
        vencimiento_mas_proximo: Date;
      }
    >();

    for (const item of inventarios) {
      const acumulado = porSucursal.get(item.id_sucursal);

      if (acumulado) {
        acumulado.cantidad_total += item.cantidad;
        if (item.lote.fecha_vencimiento < acumulado.vencimiento_mas_proximo) {
          acumulado.vencimiento_mas_proximo = item.lote.fecha_vencimiento;
        }
      } else {
        porSucursal.set(item.id_sucursal, {
          id_sucursal: item.id_sucursal,
          sucursal: item.sucursal.nombre,
          cantidad_total: item.cantidad,
          vencimiento_mas_proximo: item.lote.fecha_vencimiento,
        });
      }
    }

    return Array.from(porSucursal.values());
  }

  async ingresarStock(dto: IngresoInventarioDto, user: any) {
    // 1. Validar que el lote exista
    const lote = await this.prisma.lote.findUnique({
      where: { id_lote: dto.id_lote },
      include: { producto: { select: { codigo: true, nombre: true } } },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    // 2. Validar que el lote no esté vencido (el kardex no debe registrar
    //    entradas de stock que no se pueden vender ni trasladar)
    if (calcularSemaforo(lote.fecha_vencimiento).semaforo === 'VENCIDO') {
      throw new BadRequestException(
        `El lote "${lote.numero_lote}" está vencido; registre una merma en lugar de un ingreso de stock`,
      );
    }

    // 3. Resolver sucursal de destino según rol
    let id_sucursal = user.id_sucursal;

    if (user.rol === 'Dueño') {
      if (!dto.id_sucursal) {
        throw new BadRequestException(
          'El Dueño debe indicar la sucursal de destino (id_sucursal)',
        );
      }

      const sucursal = await this.prisma.sucursal.findUnique({
        where: { id_sucursal: dto.id_sucursal },
      });

      if (!sucursal) {
        throw new NotFoundException('Sucursal no encontrada');
      }

      id_sucursal = dto.id_sucursal;
    }

    // 4. Transacción: sumar stock + registrar entrada en kardex
    //    .catch: dos ingresos simultáneos del mismo (sucursal, lote) que
    //    compiten en el create del upsert producen P2002 => 409.
    return this.prisma
      .$transaction(async (tx) => {
      const inventario = await tx.inventario_lote.upsert({
        where: {
          id_sucursal_id_lote: { id_sucursal, id_lote: dto.id_lote },
        },
        create: {
          id_sucursal,
          id_lote: dto.id_lote,
          cantidad: dto.cantidad,
          stock_minimo: dto.stock_minimo ?? 0,
        },
        update: {
          cantidad: { increment: dto.cantidad },
          ...(dto.stock_minimo !== undefined && {
            stock_minimo: dto.stock_minimo,
          }),
        },
      });

      await tx.kardex_movimiento.create({
        data: {
          id_empleado: user.id_empleado,
          id_lote: dto.id_lote,
          id_sucursal,
          tipo_movimiento: 'AJUSTE_INGRESO',
          cantidad: dto.cantidad,
          motivo: 'Ingreso provisional de stock (pre-Compras)',
          referencia_tipo: 'INVENTARIO',
          referencia_id: inventario.id_inventario,
        },
      });

      return { ...inventario, lote };
    })
      .catch(manejarErrorPrisma);
  }

  private async obtenerProducto(id_producto: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id_producto },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  private aElementoStock(item: any) {
    const { dias_restantes, semaforo } = calcularSemaforo(
      item.lote.fecha_vencimiento,
    );

    return {
      id_inventario: item.id_inventario,
      id_sucursal: item.id_sucursal,
      sucursal: item.sucursal.nombre,
      id_lote: item.id_lote,
      numero_lote: item.lote.numero_lote,
      fecha_vencimiento: item.lote.fecha_vencimiento,
      dias_restantes,
      semaforo,
      cantidad: item.cantidad,
      stock_minimo: item.stock_minimo,
      alerta_stock_bajo: item.cantidad <= item.stock_minimo,
    };
  }
}
