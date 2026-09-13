import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { fechaMinimaVenta } from '../../common/utils/fefo.util';

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVentaDto, user: any) {
    // 1. Validar que no se repita un producto en la misma venta
    const idsProductos = dto.items.map((item) => item.id_producto);

    if (new Set(idsProductos).size !== idsProductos.length) {
      throw new BadRequestException(
        'No se permite repetir un producto en la misma venta',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Validar que el empleado tenga un turno de caja ABIERTA
      const turno = await tx.cierre_caja.findFirst({
        where: { id_empleado: user.id_empleado, estado: 'ABIERTA' },
      });

      if (!turno) {
        throw new BadRequestException(
          'No tiene un turno de caja ABIERTA. Debe aperturar una caja antes de vender',
        );
      }

      // 3. Cargar productos y validar existencia/estado
      const productos = await tx.producto.findMany({
        where: { id_producto: { in: idsProductos } },
      });

      const mapaProductos = new Map(
        productos.map((producto) => [producto.id_producto, producto]),
      );

      for (const item of dto.items) {
        const producto = mapaProductos.get(item.id_producto);

        if (!producto) {
          throw new NotFoundException(
            `Producto con ID ${item.id_producto} no encontrado`,
          );
        }

        if (!producto.activo) {
          throw new BadRequestException(
            `El producto "${producto.nombre}" se encuentra inactivo`,
          );
        }
      }

      // 4. Validar receta médica si algún ítem la requiere
      const requiereReceta = dto.items.some(
        (item) => mapaProductos.get(item.id_producto)!.requiere_receta,
      );

      if (requiereReceta && !dto.numero_receta) {
        throw new BadRequestException(
          'La venta incluye medicamentos que requieren receta médica (numero_receta obligatorio)',
        );
      }

      const receta = dto.numero_receta
        ? await this.obtenerRecetaValida(tx, dto.numero_receta)
        : null;

      // 5. Resolver el cliente de la venta
      let id_cliente = dto.id_cliente ?? null;

      if (id_cliente) {
        const cliente = await tx.cliente.findUnique({
          where: { id_cliente },
        });

        if (!cliente) {
          throw new NotFoundException('Cliente no encontrado');
        }
      }

      if (receta) {
        if (id_cliente && receta.id_cliente !== id_cliente) {
          throw new BadRequestException(
            'La receta médica no corresponde al cliente indicado',
          );
        }

        id_cliente = receta.id_cliente;
      }

      // 6. Asignar lotes FEFO y descontar stock
      const detalles: Prisma.detalle_ventaUncheckedCreateWithoutVentaInput[] =
        [];
      const movimientos: Prisma.kardex_movimientoCreateManyInput[] = [];
      let subtotal = 0;

      for (const item of dto.items) {
        const producto = mapaProductos.get(item.id_producto)!;
        const asignaciones = await this.asignarLotesFefo(
          tx,
          producto,
          item.cantidad,
          user.id_sucursal,
        );

        for (const asignacion of asignaciones) {
          subtotal += Number(
            (asignacion.cantidad * Number(producto.precio_venta)).toFixed(2),
          );

          detalles.push({
            id_producto: producto.id_producto,
            id_lote: asignacion.id_lote,
            cantidad: asignacion.cantidad,
            precio_unitario: producto.precio_venta,
          });

          movimientos.push({
            id_empleado: user.id_empleado,
            id_lote: asignacion.id_lote,
            id_sucursal: user.id_sucursal,
            tipo_movimiento: 'VENTA',
            cantidad: -asignacion.cantidad,
            referencia_tipo: 'VENTA',
            motivo: 'Despacho por venta en mostrador',
          });
        }
      }

      const totalVenta = Number(subtotal.toFixed(2));

      // 7. Registrar cabecera y detalle de la venta (subtotal es columna generada)
      const venta = await tx.venta.create({
        data: {
          id_sucursal: user.id_sucursal,
          id_empleado: user.id_empleado,
          id_cliente,
          id_receta: receta ? receta.id_receta : null,
          subtotal: totalVenta,
          impuesto: 0,
          total: totalVenta,
          estado: 'COMPLETADA',
          detalle_venta: { create: detalles },
        },
        include: {
          detalle_venta: {
            include: {
              producto: { select: { codigo: true, nombre: true } },
              lote: {
                select: { numero_lote: true, fecha_vencimiento: true },
              },
            },
          },
          cliente: true,
        },
      });

      // 8. Registrar salidas en kardex (convención: salida negativa)
      await tx.kardex_movimiento.createMany({
        data: movimientos.map((movimiento) => ({
          ...movimiento,
          referencia_id: venta.id_venta,
        })),
      });

      return venta;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  }

  async findById(id: number, user: any) {
    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: id },
      include: {
        detalle_venta: {
          include: {
            producto: { select: { codigo: true, nombre: true } },
            lote: { select: { numero_lote: true, fecha_vencimiento: true } },
          },
        },
        cliente: true,
      },
    });

    if (!venta) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }

    // El Cajero y el Gerente solo consultan ventas de su sucursal
    if (user.rol !== 'Dueño' && venta.id_sucursal !== user.id_sucursal) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }

    return venta;
  }

  private async asignarLotesFefo(
    tx: Prisma.TransactionClient,
    producto: { id_producto: number; nombre: string },
    cantidad: number,
    id_sucursal: number,
  ) {
    // 1. Lotes elegibles (desde 30 días de vigencia), ordenados FEFO
    const lotesDisponibles = await tx.inventario_lote.findMany({
      where: {
        id_sucursal,
        cantidad: { gt: 0 },
        lote: {
          id_producto: producto.id_producto,
          fecha_vencimiento: { gte: fechaMinimaVenta() },
        },
      },
      include: { lote: true },
      orderBy: { lote: { fecha_vencimiento: 'asc' } },
    });

    const stockElegible = lotesDisponibles.reduce(
      (total, item) => total + item.cantidad,
      0,
    );

    if (stockElegible < cantidad) {
      const stockTotal = await tx.inventario_lote.aggregate({
        _sum: { cantidad: true },
        where: {
          id_sucursal,
          cantidad: { gt: 0 },
          lote: { id_producto: producto.id_producto },
        },
      });

      const totalSede = stockTotal._sum.cantidad ?? 0;

      if (totalSede === 0) {
        throw new BadRequestException(
          `No hay stock disponible de "${producto.nombre}" en la sucursal`,
        );
      }

      if (stockElegible === 0) {
        throw new BadRequestException(
          `El stock de "${producto.nombre}" está en lotes vencidos o en estado CRITICO (≤29 días); la venta está bloqueada en mostrador. Sugiera traslado urgente o merma`,
        );
      }

      throw new BadRequestException(
        `Stock insuficiente de "${producto.nombre}": solicitado ${cantidad}, disponible para venta ${stockElegible}`,
      );
    }

    // 2. Repartir la cantidad entre lotes y descontar stock
    const asignaciones: Array<{ id_lote: number; cantidad: number }> = [];
    let restante = cantidad;

    for (const item of lotesDisponibles) {
      if (restante === 0) break;

      const aTomar = Math.min(restante, item.cantidad);

      // Descuento condicional para evitar sobreventa por concurrencia
      const actualizado = await tx.inventario_lote.updateMany({
        where: { id_inventario: item.id_inventario, cantidad: { gte: aTomar } },
        data: { cantidad: { decrement: aTomar } },
      });

      if (actualizado.count === 0) {
        throw new BadRequestException(
          'El stock del producto cambió durante la operación. Intente nuevamente',
        );
      }

      asignaciones.push({ id_lote: item.id_lote, cantidad: aTomar });
      restante -= aTomar;
    }

    return asignaciones;
  }

  private async obtenerRecetaValida(
    tx: Prisma.TransactionClient,
    numero_receta: string,
  ) {
    // Bloqueo pesimista para impedir el uso concurrente de la misma receta
    const bloqueo = await tx.$queryRaw<Array<{ id_receta: number }>>`
      SELECT id_receta FROM receta WHERE numero_receta = ${numero_receta} FOR UPDATE
    `;

    if (bloqueo.length === 0) {
      throw new BadRequestException(
        'La receta médica no se encuentra registrada en el sistema',
      );
    }

    const receta = await tx.receta.findUnique({
      where: { numero_receta },
      include: {
        venta: {
          where: { estado: 'COMPLETADA' },
          select: { id_venta: true },
        },
      },
    });

    if (!receta) {
      throw new NotFoundException('Receta médica no encontrada');
    }

    // 1. Validar vigencia (válida hasta el final del día de vencimiento)
    if (receta.fecha_vencimiento) {
      const ahora = new Date();
      const hoyUtc = Date.UTC(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate(),
      );

      if (receta.fecha_vencimiento.getTime() < hoyUtc) {
        throw new BadRequestException('La receta médica se encuentra vencida');
      }
    }

    // 2. Validar uso único en ventas completadas
    if (receta.venta.length > 0) {
      throw new BadRequestException(
        'La receta médica ya fue utilizada en una venta completada previa',
      );
    }

    return receta;
  }
}
