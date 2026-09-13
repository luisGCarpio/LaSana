# Guía Técnica de Flujos de Negocio - Farmacia La Sana

> Documento generado a partir de los diagramas de flujo y casos de uso de la carpeta `guia/`.
> Es la referencia oficial de la lógica de negocio para el desarrollo del backend (NestJS + Prisma + PostgreSQL/Supabase) y el frontend.
> Complementa a `backend/README.md` (arquitectura y contratos de API) y al esquema de `Base de datos/BD.txt`.

---

## 1. Validación de Sesión y Roles (Diagrama de Casos de Uso)

Antes de cualquier operación, el sistema **valida la sesión** del usuario:

### Reglas de sesión
- Todo request pasa por validación de sesión (JWT). Solo usuarios con sesión válida acceden a los flujos.
- **Control de fuerza bruta:** si el usuario acumula **3 intentos fallidos consecutivos** de login, la cuenta se **bloquea por 1 hora**.

### Capacidades por rol

| Cajero (Farmacéutico) | Gerente General | Dueño |
|---|---|---|
| Vender / consultar stocks | Ver stock en tiempo real de las 4 sucursales | Ver reportes consolidados |
| Ver alertas de stock / vencimiento | Generar traslados entre sedes | CRUD completo del sistema |
| Apertura / cierre de caja | Compras a proveedores | Gestión de gerentes y empleados |
| Confirmar recepción de traslados | Consulta de ventas | Acceso total multisede |
| Gestión de clientes | Generar reportes | — |
| — | Ajuste de inventario (mermas) | — |

**Regla transversal:** el Cajero está limitado a su sucursal asignada; el Gerente opera a nivel de su cadena (stock y traslados multisede); el Dueño tiene acceso irrestricto a las 4 sedes.

---

## 2. Flujo de Venta y Facturación (Cajero)

Diagrama: `Venta → Validar stock → Vencimiento → Receta → Cobro → Actualizar BD → Facturación`.

Entradas del flujo: **Producto (relación 1:1 por ítem), Cliente y Receta** (cuando aplica).

### Paso a paso

1. **Validar stock**
   - Si **no hay stock** disponible en la sede → **Venta fallida** (se aborta el proceso).
2. **Validar vencimiento (semáforo FEFO)**
   - Si el lote tiene **más de 30 días** de margen (🟡 preventivo 30–90 y 🟢 normal >90) → la venta **procede**.
   - Si el lote está por debajo del umbral (🔴 crítico ≤29 días o 🛑 vencido) → **Venta fallida**: el lote no puede venderse en mostrador; solo aplica traslado urgente a sede de alta rotación o baja por merma.
   - El despacho siempre prioriza el lote más próximo a vencer (FEFO).
3. **Validar receta**
   - Si el producto **requiere receta** (`requiere_receta = true`):
     - La receta se **valida**: si está **usada** (ya vinculada a una venta completada) o **inválida** (inexistente o vencida) → **Venta fallida**.
     - Si es **válida** → continúa al cobro y queda vinculada a la venta.
   - Si el producto **no requiere receta** → continúa directo al cobro.
4. **Cobro** → 5. **Actualizar BD** (descuento de stock, cabecera e ítems de venta, kardex) → 6. **Facturación**.

### Reglas transversales
- La venta solo procede si el cajero tiene un **turno de caja en estado `ABIERTA`**.
- El descuento de stock, el registro de `venta`/`detalle_venta` y el movimiento en `kardex_movimiento` se ejecutan en una **transacción atómica** (`prisma.$transaction`); si algo falla, se revierte todo.

---

## 3. Flujo de Cierre de Caja (Arqueo)

Diagrama: `Caja cerrada → Ingreso monto físico → Calcular esperado → Validar → Alerta`.

1. **Caja cerrada: no admite más ventas.** Al cerrar el turno, la caja deja de registrar operaciones de venta.
2. **El cajero ingresa el monto físico** (dinero contado en caja).
3. **Calcular monto esperado:**
   - `monto_esperado = monto_inicial + total_ventas_del_turno`
4. **Validar arqueo:**
   - `diferencia = monto_fisico - monto_esperado`
   - **Igual (diferencia = 0)** → **Alerta positiva**: cierre cuadrado, sin observaciones.
   - **Descuadre (diferencia ≠ 0)** → **Alerta negativa**: se registra el descuadre con su observación para auditoría.

---

## 4. Flujo de Traslado entre Sucursales (Gerente + Cajero)

Diagrama: `Datos del traslado → Validar stock sede superávit → Iniciar traslado → Confirmar/Revisar → Sumar stock → Actualizar BD`.

**Entradas:** sede en **déficit** (destino, alta rotación/desabastecimiento), sede en **superávit** (origen, sobrestock/baja rotación), medicamento = cantidad (lote y cantidad a mover).

1. **Validar stock en la sede superávit (origen):**
   - Si el stock no es **apto** (insuficiente para cubrir la cantidad solicitada) → **Rechazado**: el traslado no se crea.
2. **Iniciar traslado (lado origen / Gerente):**
   - **Descontar el stock** de la sede origen de inmediato (el producto queda reservado y no puede venderse por error en origen).
   - Estado del traslado: **`EN_CAMINO`**.
   - **Registrar** el movimiento de salida en el kardex.
3. **Confirmar / Revisar (lado destino / Cajero):**
   - El cajero de la sede destino revisa físicamente el paquete.
   - Si detecta una **irregularidad** (falta mercancía o llega dañado) → la **registra** (quedará anotada para auditoría) y luego continúa con lo efectivamente recibido.
4. **Sumar stock** en la sede destino → estado **`COMPLETADO`** → **Actualizar BD** (entrada de inventario + movimiento de kardex).

---

## 5. Flujo de Compra a Proveedor (Gerente)

Diagrama: `Proveedor/Productos → Hacer pedido → Confirmar/Revisar → Validar vencimiento → Actualizar BD`.

**Entradas:** proveedor, producto, cantidad y **dirección de la sede** de destino de la mercancía.

1. **Hacer pedido:**
   - Registrar el **pago** y la compra en el sistema (**Registrar Proveedor/Compra**: se crea la cabecera `compra` y sus `detalle_compra` con lote y fecha de vencimiento).
2. **Confirmar y revisar la recepción:**
   - Al llegar la mercancía se revisa físicamente.
   - Si hay **irregularidad** (faltante o daño) → **Reportear** → **Ajustar cantidad** (la compra se ajusta a lo realmente recibido) y luego continuar.
3. **Validar vencimiento:**
   - Los lotes entrantes se verifican por fecha de vencimiento antes de aceptarlos al inventario.
4. **Actualizar BD:** el stock entra a `inventario_lote` de la sede y se registra el movimiento de entrada en kardex.

---

## 6. Flujo de Ajuste de Inventario / Merma (Gerente)

Diagrama: `Datos → Validación de motivo → Registro de merma → Actualizar BD`.

**Campos requeridos (Data Fields):**
- **Producto + motivo** del ajuste (ej.: vencimiento, daño, pérdida).
- **Empleado** que realiza el ajuste.
- **Sede** donde se aplica.
- **Cantidad** afectada.

1. **Validación de motivo:** el motivo es obligatorio y debe ser válido (auditable).
2. **Registro de merma:** se documenta el ajuste (tabla de movimientos/kardex, tipo salida por merma).
3. **Actualizar BD:** se descuenta la cantidad del inventario de la sede correspondiente.

---

## 7. Resumen de Reglas de Oro

1. Sin caja `ABIERTA` no hay ventas; caja cerrada no admite más ventas.
2. Venta bloqueada si: no hay stock, lote con ≤30 días para vencer, o receta usada/inválida/vencida cuando `requiere_receta = true`.
3. Todo movimiento de inventario (venta, traslado, compra, merma) se registra en `kardex_movimiento` y se ejecuta dentro de transacciones atómicas.
4. En traslados, el stock se descuenta en origen al despachar (`EN_CAMINO`) y se suma en destino al confirmar (`COMPLETADO`), registrando toda irregularidad.
5. En compras, toda irregularidad se reporta y la cantidad se ajusta a lo realmente recibido antes de aceptar los lotes (validando su vencimiento).
6. Los ajustes por merma exigen motivo, empleado, sede y cantidad; quedan trazados para auditoría.
7. 3 intentos de login fallidos → bloqueo de la cuenta por 1 hora.
