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

function hoyUtcMedianoche(): number {
  const ahora = new Date();
  return Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

export function fechaMinimaVenta(): Date {
  const ahora = new Date();
  return new Date(
    Date.UTC(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate() + DIAS_MINIMOS_VENTA,
    ),
  );
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
    (vencimiento - hoyUtcMedianoche()) / MS_POR_DIA,
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
