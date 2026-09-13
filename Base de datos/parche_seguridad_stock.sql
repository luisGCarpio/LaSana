-- ============================================================================
-- PARCHE 1: SEGURIDAD DE STOCK Y COHERENCIA DE KARDEX
-- Proyecto: La Sana - Fase 1 (Catálogo, Lotes, Inventarios, Motor de Ventas)
-- ============================================================================
-- Objetivo:
--   1. Impedir stock negativo en inventario_lote a nivel de base de datos
--      (defense-in-depth: hoy la única garantía vive en el updateMany
--      condicional del motor de ventas de NestJS).
--   2. Garantizar la coherencia del signo de cantidad en kardex_movimiento
--      según el tipo de movimiento.
--
-- Instrucciones de aplicación (Supabase SQL Editor):
--   * Ejecutar el bloque "Verificación previa" primero. Si devuelve filas,
--     corregir esos registros manualmente ANTES de aplicar los constraints,
--     porque el VALIDATE fallará (y con razón: habría datos inválidos).
--   * Los constraints se agregan como NOT VALID y se validan después para
--     minimizar el bloqueo sobre la tabla en producción.
--
-- ADVERTENCIA DE MANTENIMIENTO:
--   El constraint ck_kardex_signo considera únicamente los tipos de
--   movimiento existentes en Fase 1: 'VENTA' (salida, cantidad < 0) y
--   'AJUSTE_INGRESO' (entrada, cantidad > 0). Cuando la Fase 2 introduzca
--   nuevos tipos de SALIDA (p. ej. 'TRASLADO_SALIDA', 'MERMA', 'DEVOLUCION_SALIDA'),
--   se debe recrear este constraint incluyendo esos tipos en el lado
--   "cantidad < 0" de la expresión. De lo contrario, dichos movimientos
--   fallarán al insertarse.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN PREVIA (ejecutar y validar antes de aplicar los constraints)
-- ----------------------------------------------------------------------------
-- No debe haber cantidades negativas en inventario:
-- SELECT * FROM public.inventario_lote WHERE cantidad < 0;

-- No debe haber kardex incoherente (venta con signo positivo, o entrada con
-- signo negativo):
-- SELECT *
-- FROM public.kardex_movimiento
-- WHERE (tipo_movimiento = 'VENTA' AND cantidad >= 0)
--    OR (tipo_movimiento <> 'VENTA' AND cantidad <= 0);

-- ----------------------------------------------------------------------------
-- 1. STOCK NO NEGATIVO EN INVENTARIO
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_inventario_cantidad_no_negativa'
      AND conrelid = 'public.inventario_lote'::regclass
  ) THEN
    ALTER TABLE public.inventario_lote
      ADD CONSTRAINT ck_inventario_cantidad_no_negativa
      CHECK (cantidad >= 0) NOT VALID;

    ALTER TABLE public.inventario_lote
      VALIDATE CONSTRAINT ck_inventario_cantidad_no_negativa;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. COHERENCIA DE SIGNO EN KARDEX
--    'VENTA' => salida (cantidad < 0)
--    resto de tipos (hoy: 'AJUSTE_INGRESO') => entrada (cantidad > 0)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_kardex_signo'
      AND conrelid = 'public.kardex_movimiento'::regclass
  ) THEN
    ALTER TABLE public.kardex_movimiento
      ADD CONSTRAINT ck_kardex_signo
      CHECK (
        (tipo_movimiento = 'VENTA' AND cantidad < 0)
        OR (tipo_movimiento <> 'VENTA' AND cantidad > 0)
      ) NOT VALID;

    ALTER TABLE public.kardex_movimiento
      VALIDATE CONSTRAINT ck_kardex_signo;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN POSTERIOR (opcional)
-- ----------------------------------------------------------------------------
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname IN ('ck_inventario_cantidad_no_negativa', 'ck_kardex_signo');
