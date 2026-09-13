# CONTEXTO_PROYECTO.md — Memoria Principal y Reglas Base

> **Propósito:** Este archivo es la memoria principal del proyecto. Cualquier sesión de asistencia de código (IA o desarrollador) DEBE cumplir estrictamente las reglas aquí definidas antes de escribir o modificar código.
>
> **Fuentes de verdad:**
> - `backend/README.md` — arquitectura, contratos de API y estado de implementación.
> - `backend/FLUJOS_NEGOCIO.md` — lógica de negocio detallada por flujo.
> - `Base de datos/BD.txt` — esquema real de PostgreSQL (Supabase).
> - `backend/GEMINI.md` — directrices de comportamiento al codificar.

---

## 1. Contexto General

**Sistema de Facturación e Inventario para la cadena de farmacias La Sana** (4 sucursales).

- **Stack:** NestJS (MVC) + Prisma ORM + PostgreSQL alojado en **Supabase**.
- **Autenticación:** JWT con roles (`Dueño`, `Gerente`, `Cajero`), guards y decoradores propios.
- **Documentación:** Swagger UI en `/api/docs`.
- **Objetivos del negocio:** balancear inventario entre sedes (traslados), evitar pérdidas por vencimiento (lotes + FEFO) y controlar el punto de venta (recetas, arqueo de caja).

---

## 2. Reglas de Negocio Críticas (resumen operativo)

### 2.1 Sesión y seguridad
- Todo endpoint protegido con JWT; roles declarados con `@Roles(...)`.
- 3 intentos fallidos de login → bloqueo de cuenta por **1 hora** (implementado en memoria, TTL 3600s, anti-enumeración de usuarios).
- Contraseñas con bcrypt. Logins exitosos se auditan en `auditoria_empleado`.

### 2.2 Ventas (núcleo transaccional)
- **Precondición:** el cajero debe tener un turno de caja en estado `ABIERTA` (ver `GET /cajas/estado-actual`).
- **Validaciones en orden:** stock disponible → semáforo de vencimiento FEFO → receta si `producto.requiere_receta = true`.
- **Semáforo FEFO:**
  - 🛑 Vencido (≤ 0 días): venta bloqueada; solo merma.
  - 🔴 Crítico (1–29 días): venta bloqueada en mostrador; sugerir traslado urgente o merma.
  - 🟡 Preventivo (30–90 días): venta permitida con prioridad FEFO.
  - 🟢 Normal (> 90 días): venta normal.
- **Receta:** debe existir, estar vigente y no haber sido usada en una venta `COMPLETADA` previa (ver `GET /recetas/validar/:numero_receta`). Si falla → venta fallida.
- **Atomicidad:** descuento de `inventario_lote`, inserción de `venta` + `detalle_venta` y registro en `kardex_movimiento` se ejecutan en un único `prisma.$transaction`.

### 2.3 Consulta de stock inter-sucursal
- El cajero solo ve existencias de su sucursal.
- **Excepción:** si `stock = 0` en su sede, puede consultar ese producto en las otras 3 sucursales. Si tiene existencias locales, el backend rechaza la consulta.

### 2.4 Cierre de caja (arqueo)
- Caja cerrada **no admite más ventas**.
- `monto_esperado = monto_inicial + total_ventas_del_turno` (ventas `COMPLETADA` desde `fecha_apertura`).
- `diferencia = monto_fisico - monto_esperado`.
- Si `diferencia ≠ 0` → **descuadre** registrado con observación `[DESCUADRE DETECTADO: Diferencia de +/-X.XX]` para auditoría.

### 2.5 Traslados entre sucursales
- **Entradas:** sede origen (superávit), sede destino (déficit), lote, cantidad.
- **Paso 1 (Gerente, origen):** validar stock suficiente en origen (si no → traslado rechazado). Descontar stock **de inmediato** para que no se venda por error. Estado → `EN_CAMINO` + salida en kardex.
- **Paso 2 (Cajero, destino):** revisar paquete. Irregularidad (faltante/daño) → se registra. Confirmar → sumar stock en destino, estado → `COMPLETADO` + entrada en kardex.

### 2.6 Compras a proveedores
- Registrar pago + cabecera `compra` con `detalle_compra` (producto, lote con fecha de vencimiento).
- En recepción: irregularidad → reportear y **ajustar cantidades** a lo realmente recibido.
- Validar vencimiento de lotes entrantes antes de aceptarlos. Luego actualizar `inventario_lote` + kardex.

### 2.7 Inventario / Mermas
- Ajuste exige: **producto + motivo, empleado, sede, cantidad**.
- El motivo es obligatorio y auditable. Registrar merma en kardex y descontar de `inventario_lote`.

### 2.8 Regla transversal de trazabilidad
- **Todo** movimiento de inventario (venta, traslado, compra, merma) genera registro en `kardex_movimiento` y se ejecuta dentro de transacciones atómicas.

---

## 3. Estructura del Proyecto (NestJS / Prisma)

```text
backend/src/
├── common/              # Guards JWT/Roles, decoradores (@CurrentUser, @Roles), filtros, DTOs base
├── prisma/              # PrismaService + PrismaModule (conexión a Supabase)
└── modules/             # Un módulo por dominio (controller + service + DTOs)
    ├── auth/            # Login, JWT, bloqueo por intentos fallidos, perfil
    ├── cajas/           # Apertura/cierre de turnos, arqueo, historial
    ├── clientes/        # Registro y consulta de clientes
    ├── recetas/         # Registro y motor de validación de recetas
    ├── ventas/          # Motor de ventas transaccional + FEFO
    ├── productos/       # Catálogo, bandera requiere_receta
    ├── lotes/           # Lotes y fechas de vencimiento
    ├── proveedores/     # Directorio de proveedores
    ├── compras/         # Pedidos y recepción de mercancía
    ├── traslados/       # Despacho (EN_CAMINO) y recepción (COMPLETADO)
    ├── inventarios/     # Stock por lote, consulta inter-sede, mermas
    └── reportes/        # Stock multisede y reportes financieros
```

- **Modelo (M):** Prisma Client contra PostgreSQL; persistencia transaccional.
- **Controlador (C):** `@Controller` REST, validación con `class-validator`, guards de JWT/roles.
- **Vista (V):** respuestas JSON + Swagger UI.
- **Estado actual:** **Fase 1 (MVP) COMPLETADA, AUDITADA y oficialmente CERRADA** — auth, cajas, clientes, recetas, catálogo/stock y motor de ventas, con 6 parches defensivos aplicados (ver tabla de estado en `README.md`, sección "Hoja de Ruta - Fase 1"): CHECK de stock no negativo y coherencia de kardex en BD (`Base de datos/parche_seguridad_stock.sql`), ancla temporal UTC unificada, bloqueo pesimista `FOR UPDATE` determinista en asignación FEFO, mapeo P2002/P2034 → 409/503 (`common/utils/prisma-error.util.ts`), `Prisma.Decimal` en montos de venta y validaciones de fechas en lotes/ingresos. **Fase 2 en construcción:** traslados, compras, mermas y reportes.

---

## 4. Esquema de Base de Datos (tablas clave)

Referencia rápida del esquema real (ver `Base de datos/BD.txt` para el DDL completo):

| Dominio | Tablas |
|---|---|
| Personas y seguridad | `usuario` (1:1 `empleado`, password_hash), `empleado` (sucursal + rol), `rol`, `auditoria_empleado` |
| Sedes y caja | `sucursal`, `caja` (única por sucursal+nombre), `cierre_caja` (turno: montos, estado) |
| Catálogo | `producto` (código único, `requiere_receta`), `lote` (único producto+número, `fecha_vencimiento` NOT NULL), `proveedor` |
| Inventario | `inventario_lote` (único sucursal+lote, `cantidad`, `stock_minimo`), `kardex_movimiento` (empleado, lote, sucursal, tipo, cantidad, referencia_tipo/id) |
| Operaciones | `venta` (sucursal, empleado, cliente?, receta?), `detalle_venta` (venta, producto, lote, subtotal GENERATED STORED), `compra` + `detalle_compra`, `traslado` + `detalle_traslado` |
| Clientes | `cliente` (documento único), `receta` (número único, fechas) |

**Características a respetar:**
- IDs con `GENERATED ALWAYS AS IDENTITY` (no enviar IDs en inserts).
- Columnas calculadas: `subtotal` en `detalle_venta` y `detalle_compra` son `GENERATED ALWAYS ... STORED` (no se escriben manualmente).
- Estados como varchar: `cierre_caja.estado` ('ABIERTA'/'CERRADA'), `venta.estado` ('COMPLETADA'...), `traslado.estado` ('PENDIENTE'/'EN_CAMINO'/'COMPLETADO'), `compra.estado` ('PENDIENTE'...).
- `venta.id_receta` vincula la receta usada (uso único de recetas).
- **Constraints defensivos (aplicados en el cierre de la Fase 1):** `ck_inventario_cantidad_no_negativa` (`cantidad >= 0` en `inventario_lote`) y `ck_kardex_signo` (`VENTA` ⇒ cantidad negativa, resto ⇒ positiva). ⚠️ Al agregar en Fase 2 nuevos tipos de salida en kardex (`TRASLADO_SALIDA`, `MERMA`...), recrear `ck_kardex_signo` incluyéndolos en el lado "cantidad < 0".

---

## 5. Instrucciones de Interacción (cómo trabajaremos los módulos)

Estas reglas aplican SIEMPRE que se pida ayuda con código, especialmente en **Ventas, Traslados e Inventario**:

### 5.1 Antes de programar
1. **Leer primero el esquema de BD** (`Base de datos/BD.txt` y/o `backend/prisma/schema.prisma`) antes de tocar cualquier modelo o query. Nunca asumir nombres de campos o relaciones.
2. **Leer el flujo correspondiente** en `backend/FLUJOS_NEGOCIO.md` para respetar pasos y validaciones del negocio.
3. Si hay ambigüedad o varias interpretaciones posibles, **preguntar antes de implementar**, no elegir silenciosamente.
4. Cambios mínimos y quirúrgicos: no refactorizar código ajeno ni "mejorar" lo no solicitado; mantener el estilo existente.

### 5.2 Orden de trabajo por módulo
1. **Proponer los DTOs primero** (con validadores `class-validator`) y el contrato de endpoints (ruta, roles permitidos, request/response) para **revisión y aprobación del usuario** antes de escribir la lógica.
2. Luego implementar el `service` con la lógica de negocio.
3. Después el `controller` con guards y decoradores (`@Roles`, `@CurrentUser`).
4. Finalmente, **actualizar `backend/README.md`** con los endpoints y reglas nuevas (README siempre sincronizado con el código).

### 5.3 Reglas de implementación obligatorias
- **Transacciones:** toda operación que modifique stock + kardex + cabeceras/detalles (venta, traslado, compra, merma) DEBE usar `prisma.$transaction`; si algo falla, todo se revierte.
- **Kardex siempre:** ningún movimiento de inventario sin su registro en `kardex_movimiento` (con `referencia_tipo`/`referencia_id` apuntando a la operación).
- **No tocar la BD destructivamente:** PROHIBIDO usar `npx prisma db push` y `npx prisma migrate reset` (el esquema de Supabase es final, con columnas calculadas y restricciones). Solo permitido: `prisma generate`, `prisma db pull`, `prisma studio`.
- **Columnas generadas:** nunca escribir manualmente `subtotal` ni los IDs identity.
- **Seguridad:** validar siempre sucursal/rol del usuario en sesión; el cajero nunca ve ni opera datos de otras sedes (salvo la excepción de consulta de agotados).
- **Estados correctos:** usar exactamente los valores de estado definidos en la BD (`EN_CAMINO`, `COMPLETADO`, `COMPLETADA`, etc.).
- **Simplicidad:** código mínimo que resuelva el problema; nada especulativo, sin sobre-abstracciones ni manejo de errores de escenarios imposibles.

### 5.4 Al entregar cambios
- Verificar compilación (`npm run build` / `start:dev` sin errores) y, si aplica, probar el flujo en Swagger (`/api/docs`).
- Confirmar que el flujo implementado coincide paso a paso con `FLUJOS_NEGOCIO.md`.
- Reportar cualquier desviación detectada entre código, esquema BD y documentación en lugar de parcharla en silencio.
