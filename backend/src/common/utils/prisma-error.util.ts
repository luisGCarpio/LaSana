import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Conflicto de concurrencia sobre el stock de un lote: el estado de la fila
 * cambió entre la lectura FEFO y el descuento. No es un error del usuario:
 * corresponde a un 409 Conflict reintentable.
 */
export class StockConflictException extends ConflictException {
  constructor() {
    super(
      'El stock del producto cambió durante la operación. Intente nuevamente',
    );
  }
}

/**
 * Traduce códigos de error de Prisma a respuestas HTTP limpias:
 *  - P2002 (violación de unicidad, típica carrera check-then-insert) => 409
 *  - P2034 (conflicto de escritura: deadlock, serialización, write-write) => 503
 * Cualquier otro error se re-lanza sin modificar.
 */
export function manejarErrorPrisma(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException(
        'El registro ya existe (conflicto de unicidad). Intente nuevamente',
      );
    }

    if (error.code === 'P2034') {
      throw new ServiceUnavailableException(
        'La operación entró en conflicto con otra transacción concurrente. Intente nuevamente',
      );
    }
  }

  throw error;
}
