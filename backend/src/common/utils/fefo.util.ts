export type SemaforoFefo = 'VENCIDO' | 'CRITICO' | 'PREVENTIVO' | 'NORMAL';

export const SEMAFOROS_FEFO: SemaforoFefo[] = [
  'VENCIDO',
  'CRITICO',
  'PREVENTIVO',
  'NORMAL',
];

export const DIAS_MINIMOS_VENTA = 30;
export const DIAS_PREVENTIVO_MAXIMO = 90;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Ancla temporal: siempre medianoche UTC del día actual en calendario UTC.
// Es Obligatorio usar getUTC* (no getFullYear/getMonth/getDate locales) porque
// las columnas @db.Date de PostgreSQL/Prisma se leen como medianoche UTC;
// mezclar calendario local con esas fechas desplaza el semáforo FEFO y el
// bloqueo de venta de lotes con menos de 30 días según la zona horaria del
// servidor.
export function hoyUtcMedianoche(): Date {
  const ahora = new Date();
  return new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
  );
}

export function fechaMinimaVenta(): Date {
  const minima = hoyUtcMedianoche();
  minima.setUTCDate(minima.getUTCDate() + DIAS_MINIMOS_VENTA);
  return minima;
}

export function calcularSemaforo(fecha_vencimiento: Date): {
  dias_restantes: number;
  semaforo: SemaforoFefo;
} {
  const vencimiento = Date.UTC(
    fecha_vencimiento.getUTCFullYear(),
    fecha_vencimiento.getUTCMonth(),
    fecha_vencimiento.getUTCDate(),
  );

  const dias_restantes = Math.round(
    (vencimiento - hoyUtcMedianoche().getTime()) / MS_POR_DIA,
  );

  let semaforo: SemaforoFefo;
  if (dias_restantes <= 0) {
    semaforo = 'VENCIDO';
  } else if (dias_restantes < DIAS_MINIMOS_VENTA) {
    semaforo = 'CRITICO';
  } else if (dias_restantes <= DIAS_PREVENTIVO_MAXIMO) {
    semaforo = 'PREVENTIVO';
  } else {
    semaforo = 'NORMAL';
  }

  return { dias_restantes, semaforo };
}
