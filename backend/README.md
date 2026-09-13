# Sistema de Facturación e Inventario - Farmacia La Sana (Backend)

API backend desarrollada en NestJS con Prisma ORM y PostgreSQL (alojada en Supabase) para la gestión centralizada de 4 sucursales de farmacia. Cuenta con documentación interactiva en Swagger y autenticación basada en JWT.

---

## Contexto y Reglas de Negocio

El sistema está diseñado para resolver los tres dolores operativos principales de la cadena:
1. **Desbalance de inventario entre sedes:** Permitir traslados ágiles desde una sucursal con sobrestock/baja rotación hacia otra con desabastecimiento/alta rotación.
2. **Pérdida por vencimientos:** Control por lotes y alertas preventivas antes de que los medicamentos caduquen.
3. **Control en punto de venta:** Validación obligatoria de recetas para medicamentos controlados y control de apertura/cierre de cajas para evitar descuadres de dinero.

### Roles del Sistema

* **Dueño:** Acceso total a reportes financieros consolidados, métricas globales de las 4 sedes y gestión de empleados/gerentes.
* **Gerente General:** Monitoreo de stock de las 4 sucursales en tiempo real, creación y despacho de traslados entre sedes, registro de compras a proveedores, consulta general de ventas y ajustes por merma.
* **Cajero / Farmacéutico:** Limitado a su sucursal asignada. Apertura y cierre de caja, registro de ventas (validando stock, vencimiento y receta), consulta de clientes y recepción física de traslados que llegan a su sede.

### Flujos Principales

1. **Venta y Facturación:**
   * La venta solo procede si el cajero tiene un turno de caja en estado `ABIERTA`.
   * Si el producto tiene la marca `requiere_receta = true`, es obligatorio asociar una receta médica vigente del cliente.
   * **Semáforo de Vencimientos FEFO:**
     * 🛑 **Vencido ($\le 0$ días):** Venta bloqueada. Solo permite baja por merma.
     * 🔴 **Crítico ($1 \text{ a } 29$ días):** Venta bloqueada en mostrador (evita riesgo sanitario y reclamos). Sugerido para traslado urgente a sede con alta rotación o merma.
     * 🟡 **Preventivo ($30 \text{ a } 90$ días):** Venta permitida con prioridad de despacho FEFO (sale antes que los lotes nuevos).
     * 🟢 **Normal ($> 90$ días):** Stock en rango seguro.
   * El descuento de stock y el registro en `kardex_movimiento` se procesan dentro de una misma transacción atómica (`prisma.$transaction`). Si algo falla, se revierte todo.

2. **Consulta de Stock Inter-Sucursal (Solo Agotados):**
   * El cajero solo puede ver las existencias de su propia sucursal.
   * **Excepción controlada:** Si un producto está completamente agotado en su sede (`stock = 0`), el cajero puede consultar el stock de ese producto en las otras 3 sucursales para orientar al cliente. Si aún tiene existencias en su sede, el backend rechaza la consulta intersede.

3. **Cierre de Caja:**
   * El cajero ingresa el dinero físico contado.
   * El sistema calcula automáticamente el monto esperado: `monto_inicial + total_ventas_del_turno`.
   * Se calcula la diferencia (`monto_fisico - monto_esperado`). Si no cuadra (diferencia != 0), queda registrado el descuadre con su respectiva observación para auditoría.

4. **Traslados entre Sucursales:**
   * **Paso 1 (Origen / Gerente):** Se solicita el traslado indicando sede origen, sede destino, lote y cantidad. El backend valida stock y lo descuenta de inmediato en la sede origen para que no se venda por error. El estado pasa a `EN_CAMINO` con su movimiento de salida en kardex.
   * **Paso 2 (Destino / Cajero):** Al llegar el producto a la sede destino, el cajero revisa el paquete. Si falta algo o llega dañado, anota la irregularidad. Al confirmar, el stock entra al inventario de la sede destino y el estado cambia a `COMPLETADO`.

5. **Seguridad y Acceso:**
   * Contraseñas encriptadas con bcrypt.
   * Control de intentos fallidos: si un usuario falla la contraseña 3 veces seguidas, la cuenta se bloquea por 1 hora.

---

## Arquitectura (MVC en NestJS)

Para cumplir con el patrón MVC solicitado, la estructura del proyecto se organiza de la siguiente manera:

* **Modelo (M):** Manejado a través de Prisma Client (`schema.prisma`) contra PostgreSQL. Encapsula las entidades de base de datos y la persistencia transaccional (Kardex, stock, ventas).
* **Controlador (C):** Controladores de NestJS (`@Controller`) que exponen las rutas REST, reciben los requests, ejecutan validaciones con class-validator y llaman a la capa de servicios.
* **Vista (V):** Respuestas estructuradas en formato JSON y documentación interactiva expuesta mediante Swagger UI (`/api/docs`).

```mermaid
flowchart LR
    Frontend[Frontend App] -->|HTTP / JWT| Controllers[Controllers\nRutas REST & Guards]
    Controllers -->|DTO Validado| Services[Services\nLógica de Negocio]
    Services -->|Transacciones ACID| Prisma[Prisma Models\nAcceso a Datos & Kardex]
    Prisma -->|TCP Pooler| PostgreSQL[(PostgreSQL / Supabase)]
    Services -->|Respuesta JSON| Views[Views / DTOs\nSwagger UI]
```

### Estructura del Código

```text
src/
├── common/              # Guards de JWT/Roles, decoradores, filtros globales y DTOs base
├── prisma/              # PrismaService y PrismaModule para conexión a BD
└── modules/             # Módulos organizados por dominio
    ├── auth/            # Login, JWT y bloqueo de intentos fallidos
    ├── cajas/           # Turnos de caja, arqueos y detección de descuadres
    ├── clientes/        # Registro y consulta de clientes
    ├── recetas/         # Validación de recetas médicas
    ├── ventas/          # Venta transaccional, regla FEFO y alertas de sucursal
    ├── productos/       # Catálogo y bandera requiere_receta
    ├── lotes/           # Fechas de vencimiento y números de lote
    ├── proveedores/     # Directorio de proveedores
    ├── compras/         # Entrada de mercancía a sucursales
    ├── traslados/       # Despacho y recepción entre sucursales
    ├── inventarios/     # Ajustes de inventario y registro de mermas
    └── reportes/        # Stock multisede en tiempo real y reportes financieros
```

---

## Instalación y Ejecución en Local

### Requisitos
* Node.js v18 o superior
* npm v9 o superior

### Pasos

1. Clonar el repositorio y entrar a la carpeta del backend:
   ```bash
   cd backend
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar el archivo `.env` en la raíz de `backend/`:
   ```env
   pidanlo
   ```

4. Generar el cliente de Prisma:
   ```bash
   npx prisma generate
   ```

5. Iniciar en modo desarrollo:
   ```bash
   npm run start:dev
   ```

La API quedará escuchando en `http://localhost:3000`.  
La documentación Swagger para probar los endpoints estará disponible en:  
**`http://localhost:3000/api/docs`**

---

## Comandos de Base de Datos (Leer antes de tocar)

**CUIDADO CON LA BASE DE DATOS:**  
La base de datos en Supabase ya tiene el esquema final con llaves foráneas, restricciones únicas y columnas calculadas.  

* **NO USAR:** `npx prisma db push` (puede desconfigurar columnas calculadas y restricciones).
* **NO USAR:** `npx prisma migrate reset` (borra todas las tablas y datos de Supabase).
* **Comandos seguros:**
   * `npx prisma generate` (compila los tipos locales de TypeScript).
   * `npx prisma db pull` (solo lee la BD y refresca `schema.prisma`).
   * `npx prisma studio` (abre un visor web en `http://localhost:5555` para ver los datos).

---

---

## Hoja de Ruta - Fase 1 (MVP 50% Funcional del Backend)

Para entregar un primer producto mínimo viable completamente funcional y testeable en Swagger, el backend se ha dividido en dos fases:
* **Fase 1 (MVP actual - 50%):** Ciclo operativo completo de la farmacia (Autenticación, Turnos de Caja, Catálogo/Stock con FEFO, Clientes, Recetas y Motor de Ventas transaccional).
* **Fase 2 (Siguiente 50%):** Logística y Gerencia (Traslados inter-sucursales, Compras a proveedores, Mermas y Reportes globales).

### Estado de la Fase 1: ✅ COMPLETADA Y AUDITADA (cerrada oficialmente)

Tras una auditoría de backend (concurrencia, zonas horarias, consistencia de errores y rendimiento), la Fase 1 se cerró aplicando 6 parches defensivos:

| # | Parche | Ubicación |
|---|--------|-----------|
| 1 | `CHECK (cantidad >= 0)` en `inventario_lote` + coherencia de signo en `kardex_movimiento` (`ck_kardex_signo`) aplicados en Supabase | `Base de datos/parche_seguridad_stock.sql` |
| 2 | Ancla temporal unificada en UTC (`getUTC*`): el semáforo FEFO, el bloqueo de lotes <30 días y la vigencia de recetas ya no dependen de la zona horaria del servidor | `common/utils/fefo.util.ts`, `ventas.service.ts` |
| 3 | Bloqueo pesimista `SELECT ... FOR UPDATE` con orden determinista (`fecha_vencimiento ASC, id_lote ASC`) en la asignación FEFO: sin deadlocks ni sobreventa concurrente | `ventas.service.ts` |
| 4 | Mapeo de errores de infraestructura: carrera de stock → **409 Conflict**, `P2002` (unicidad) → **409**, `P2034` (deadlock/serialización) → **503 reintentable** (ya no salen 500 crudos) | `common/utils/prisma-error.util.ts` (nuevo) |
| 5 | Aritmética monetaria exacta con `Prisma.Decimal` en `subtotal`/`total` de la venta (sin drift de centavos frente a `Decimal(12,2)`) | `ventas.service.ts` |
| 6 | Validación de fechas: lotes con `fecha_vencimiento <= hoy` o `fecha_fabricacion > fecha_vencimiento` rechazados; ingreso de stock bloqueado para lotes `VENCIDO` | `lotes.service.ts`, `inventarios.service.ts` |

Deuda técnica conocida (para abordar en Fase 2, no bloquea el cierre): unificar la validación de receta duplicada (`recetas.service` vs `ventas.service`), índice parcial anti doble-uso de receta a nivel BD, paginación en `GET /lotes`, y reparar el harness de pruebas unitarias — `src/app.controller.spec.ts` (scaffold, no cubre lógica de Fase 1) no puede ejecutarse en este entorno por incompatibilidad preexistente del tooling: `@nestjs/testing` v12 es ESM-only y Jest 30.5.1 no puede requerirlo en Windows. Los portones de verificación de la Fase 1 fueron `npm run build` y `npm run lint` (ambos limpios).

---

## División del Trabajo en Dupla (Fase 1)

El 50% correspondiente a la Fase 1 está dividido equitativamente en dos frentes de desarrollo independientes y desacoplados para evitar conflictos en Git:

### Lucho: *Seguridad, Control de Caja y Personas (Implementado y Verificado ✅)*

#### 1. Módulo `auth` (Seguridad y Sesión)
* **`POST /auth/login`**:
  * **Request Body:** `{ "nombre_usuario": string, "password": string }`
  * **Respuesta 200:**
    ```json
    {
      "access_token": "eyJhbGciOi...",
      "usuario": {
        "id_usuario": 1,
        "nombre_usuario": "cajero1",
        "id_empleado": 10,
        "id_sucursal": 1,
        "rol": "Cajero",
        "nombres": "Carlos",
        "apellidos": "Gómez"
      }
    }
    ```
  * **Protección contra Fuerza Bruta (En memoria con Map y TTL 3600s):**
    * Si un usuario acumula **3 intentos fallidos consecutivos**, la cuenta queda bloqueada por **1 hora** (3600s) sin alterar la BD.
    * Cualquier intento subsiguiente durante la hora de bloqueo es rechazado de inmediato sin tocar la base de datos ni gastar CPU en bcrypt:  
      `401 Unauthorized: "La cuenta se encuentra bloqueada temporalmente por exceso de intentos fallidos. Intente nuevamente en X minuto(s)."`
    * **Anti-Enumeración de Usuarios (OWASP):** La respuesta de error y el bloqueo aplican de forma idéntica tanto a usuarios existentes como inexistentes, impidiendo a terceros adivinar nombres de usuario válidos.
    * Un inicio de sesión exitoso reinicia el contador de fallos a cero de inmediato.
  * **Auditoría:** Cada login exitoso genera un registro en la tabla `auditoria_empleado` (`accion: 'LOGIN'`, `modulo: 'auth'`).
* **`GET /auth/perfil`**:
  * **Headers:** `Authorization: Bearer <token>`
  * **Respuesta 200:** Información del usuario autenticado, vinculación a su empleado, rol y sucursal (campo `password_hash` excluido).
* **Infraestructura de Seguridad Común:**
  * `@Roles('Cajero', 'Gerente', 'Dueño')`: Decorador de autorización declarativa.
  * `@CurrentUser()`: Decorador de parámetro para inyección directa del usuario del token.
  * `JwtAuthGuard` y `RolesGuard`: Guards de protección JWT y validación estricta de rol (arrojando `403 Forbidden` ante insuficiencia de permisos).

#### 2. Módulo `cajas` (Control de Turnos y Arqueos)
* **`POST /cajas/apertura`** (`@Roles('Cajero', 'Gerente')`):
  * **Request Body:** `{ "id_caja": number, "monto_inicial": number }`
  * **Reglas de Negocio:**
    1. Valida que la caja física exista y esté en estado `activa: true`.
    2. Valida que el empleado en sesión **no tenga ya otro turno abierto** (`estado: 'ABIERTA'`).
    3. Valida que la caja física seleccionada **no esté ocupada** por otro turno abierto.
    4. Registra en `cierre_caja` con estado `ABIERTA`, `fecha_apertura` actual y `monto_esperado = monto_inicial`.
* **`POST /cajas/cierre`** (`@Roles('Cajero', 'Gerente')`):
  * **Request Body:** `{ "monto_fisico": number, "observacion"?: string }`
  * **Cálculo Transaccional de Arqueo:**
    * Suma el total de ventas completadas durante el turno:  
      $$\text{total\_ventas} = \sum \text{venta.total} \quad (\text{con } \text{estado} = \text{'COMPLETADA'} \land \text{fecha} \ge \text{fecha\_apertura})$$
    * Calcula el monto esperado:  
      $$\text{monto\_esperado} = \text{monto\_inicial} + \text{total\_ventas}$$
    * Calcula la diferencia de arqueo:  
      $$\text{diferencia} = \text{monto\_fisico} - \text{monto\_esperado}$$
    * **Detección de Descuadre:** Si $\text{diferencia} \neq 0$, adjunta automáticamente la advertencia de auditoría a la observación:  
      `[DESCUADRE DETECTADO: Diferencia de +/-X.XX]`.
    * Cierra el turno en `cierre_caja` (`estado: 'CERRADA'`, `fecha_cierre = now()`, montos actualizados).
* **`GET /cajas/estado-actual`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * **Contrato Crítico para el Módulo de Ventas:**
    * Si tiene caja abierta: `{ "tiene_turno_abierto": true, "turno": { "id_cierre": ..., "id_caja": ..., ... } }`
    * Si no tiene caja abierta: `{ "tiene_turno_abierto": false, "turno": null }`
* **`GET /cajas/historial`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * Filtrado inteligente según contexto de seguridad:
    * **Cajero:** Consulta exclusivamente sus propios turnos históricos.
    * **Gerente:** Consulta el historial de todas las cajas de su sucursal asignada.
    * **Dueño:** Acceso irrestricto al historial multisede consolidado.

#### 3. Módulos `clientes` y `recetas`
* **Módulo `clientes`:**
  * **`POST /clientes`** (`@Roles('Cajero', 'Gerente')`): Alta de cliente con documento único (`documento`, `nombres`, `apellidos`, `telefono`, `correo`, `direccion`).
  * **`GET /clientes/documento/:documento`**: Búsqueda indexada inmediata para agilizar la facturación en mostrador.
  * **`GET /clientes`** y **`GET /clientes/:id`**: Listado y consulta puntual.
* **Módulo `recetas`:**
  * **`POST /recetas`** (`@Roles('Cajero', 'Gerente')`):
    * **Request Body:** `{ "id_cliente": number, "numero_receta": string, "fecha_emision": "YYYY-MM-DD", "fecha_vencimiento"?: "YYYY-MM-DD", "observacion"?: string }`
    * Valida que el cliente exista en base de datos y que el `numero_receta` sea único.
  * **`GET /recetas/validar/:numero_receta`** (Motor de Validación de Recetas):
    * **Contrato Crítico para el Módulo de Ventas:** Si un medicamento tiene la bandera `requiere_receta = true`, el backend consulta este endpoint antes de procesar la venta.
    * Evalúa las 3 reglas de negocio obligatorias:
      1. **Existencia:** Retorna `{ "valida": false, "motivo": "La receta médica no se encuentra registrada en el sistema" }` si no existe.
      2. **Vencimiento:** Retorna `{ "valida": false, "motivo": "La receta médica se encuentra vencida", "receta": ... }` si $\text{fecha\_vencimiento} < \text{hoy}$.
      3. **Uso Único:** Retorna `{ "valida": false, "motivo": "La receta médica ya fue utilizada en una venta completada previa", "receta": ... }` si ya está vinculada a una venta previa con estado `COMPLETADA`.
      4. **Aprobación:** Retorna `{ "valida": true, "receta": ... }` cuando cumple todos los criterios.

---

### Jhonatan: *Catálogo, Stock y Motor de Ventas (Implementado ✅)*

#### Semáforo FEFO compartido (`common/utils/fefo.util.ts`)

Calcula `dias_restantes` en días calendario con un ancla temporal unificada en UTC (medianoche UTC de la fecha de vencimiento contra medianoche UTC del día actual, `getUTC*` en ambas) y clasifica el lote:

| Días restantes | Semáforo | ¿Despachable en mostrador? |
|---|---|---|
| $\le 0$ | 🛑 `VENCIDO` | No |
| $1 - 29$ | 🔴 `CRITICO` | No (sugerir traslado urgente o merma) |
| $30 - 90$ | 🟡 `PREVENTIVO` | Sí, con prioridad FEFO |
| $> 90$ | 🟢 `NORMAL` | Sí |

Regla aprobada: la venta permite lotes con `dias_restantes >= 30` y bloquea de `0` a `29`. El despacho siempre reparte la cantidad entre los lotes elegibles ordenados por `fecha_vencimiento ASC` (FEFO), aunque un ítem abarque varios lotes (genera una fila de `detalle_venta` y un movimiento de kardex por lote).

#### 1. Módulo `productos`

* **`POST /productos`** (`@Roles('Dueño')`):
  * **Request Body:** `{ "codigo": string, "nombre": string, "descripcion"?: string, "precio_venta": number, "requiere_receta"?: boolean }`
  * **Reglas:** `codigo` único (400 si se repite); `precio_venta >= 0`.
* **`GET /productos`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * **Query params:** `busqueda` (coincidencia parcial en `codigo`/`nombre`, insensible a mayúsculas), `activo` (`true`/`false`).
* **`GET /productos/codigo/:codigo`** y **`GET /productos/:id`** (todos los roles): consulta puntual (404 si no existe).
* **`PATCH /productos/:id`** (`@Roles('Dueño')`): mismos campos del alta, todos opcionales.
* **`DELETE /productos/:id`** (`@Roles('Dueño')`): **baja lógica** (`activo = false`), conservando el histórico de ventas/lotes.

#### 2. Módulo `lotes`

* **`POST /lotes`** (`@Roles('Dueño', 'Gerente')`):
  * **Request Body:** `{ "id_producto": number, "numero_lote": string, "fecha_fabricacion"?: "YYYY-MM-DD", "fecha_vencimiento": "YYYY-MM-DD" }`
  * **Reglas:** el producto debe existir (404); `numero_lote` único por producto (400, restricción `uq_lote_producto_numero`). La respuesta incluye `dias_restantes` y `semaforo`.
* **`GET /lotes`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * **Query params:** `id_producto`, `semaforo` (`VENCIDO`, `CRITICO`, `PREVENTIVO`, `NORMAL`).
  * Cada lote retorna su `dias_restantes` y `semaforo` calculados.
* **`GET /lotes/:id`** (todos los roles): consulta puntual con semáforo.

#### 3. Módulo `inventarios`

* **`GET /inventarios/stock/:id_producto`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * **Cajero:** solo las existencias de su sucursal. **Gerente/Dueño:** las 4 sucursales.
  * **Respuesta por lote:** `{ id_inventario, id_sucursal, sucursal, id_lote, numero_lote, fecha_vencimiento, dias_restantes, semaforo, cantidad, stock_minimo, alerta_stock_bajo }` (solo lotes con `cantidad > 0`).
* **`GET /inventarios/stock/:id_producto/otras-sucursales`** (`@Roles('Cajero', 'Gerente', 'Dueño')`):
  * **Regla:** el Cajero solo puede consultarla si su stock local del producto es 0; si tiene existencias locales, el backend responde 400.
  * **Respuesta:** `[{ id_sucursal, sucursal, cantidad_total, vencimiento_mas_proximo }]`.
* **`POST /inventarios/ingreso`** (`@Roles('Gerente', 'Dueño')` — **provisional hasta que exista el módulo de Compras**):
  * **Request Body:** `{ "id_lote": number, "cantidad": number, "stock_minimo"?: number, "id_sucursal"?: number }`
  * El Gerente siempre ingresa en su sede asignada; el Dueño debe indicar `id_sucursal`.
  * **Transacción atómica:** `upsert` de `inventario_lote` (suma cantidad) + movimiento de entrada en kardex (`tipo_movimiento: 'AJUSTE_INGRESO'`, cantidad positiva, `referencia_tipo: 'INVENTARIO'`).

#### 4. Módulo `ventas` (Núcleo Transaccional)

* **`POST /ventas`** (`@Roles('Cajero', 'Gerente')`):
  * **Request Body:**
    ```json
    {
      "id_cliente": 5,
      "numero_receta": "REC-2026-001",
      "items": [
        { "id_producto": 1, "cantidad": 2 },
        { "id_producto": 8, "cantidad": 1 }
      ]
    }
    ```
  * **Regla de oro:** `precio_unitario`, `subtotal`, `impuesto` y `total` **nunca** vienen del cliente; se calculan en el backend (`venta.impuesto = 0` en el MVP, `total = subtotal`). El cajero **no elige lote**: el sistema asigna automáticamente bajo FEFO.
  * **Pasos dentro de un único `prisma.$transaction`:**
    1. Verifica turno de caja `ABIERTA` del empleado en sesión (400 si no lo tiene).
    2. Carga los productos y valida que existan y estén activos (404/400). Rechaza productos duplicados en el mismo request.
    3. Si algún ítem tiene `requiere_receta = true`, exige `numero_receta` y valida **existencia, vigencia y uso único** (receta no vinculada a una venta `COMPLETADA` previa). Además, si llega `id_cliente`, debe coincidir con el cliente de la receta; si no llega, se asocia el cliente de la receta. La fila de la receta se bloquea con `SELECT ... FOR UPDATE` para impedir doble uso concurrente.
    4. Por cada ítem bloquea los lotes elegibles de la sucursal del usuario (`cantidad > 0` y `fecha_vencimiento >= hoy + 30 días`) con `SELECT ... FOR UPDATE` y orden determinista (`fecha_vencimiento ASC, id_lote ASC`) para serializar ventas concurrentes del mismo producto sin deadlocks, los ordena FEFO y reparte la cantidad entre ellos con descuento condicional (`cantidad: { gte: X }`) como segunda barrera atómica. Si no alcanza, diferencia el error: sin stock, stock retenido en lotes 🔴/🛑, o stock vendible insuficiente.
    5. Inserta la cabecera `venta` y sus `detalle_venta` (una fila por lote asignado; `subtotal` es columna generada y no se escribe). El `subtotal` y `total` de la cabecera se calculan con aritmética decimal exacta (`Prisma.Decimal`) para evitar drift de centavos frente a las columnas `Decimal(12,2)`.
    6. Registra las salidas en `kardex_movimiento` (`tipo_movimiento: 'VENTA'`, `referencia_tipo: 'VENTA'`, `referencia_id = id_venta`, cantidad **negativa**).
  * **Convención de kardex:** entradas con cantidad positiva (`+`), salidas con cantidad negativa (`-`); el `tipo_movimiento` define la operación (`VENTA`, `AJUSTE_INGRESO`, y en Fase 2 `TRASLADO_SALIDA`/`TRASLADO_ENTRADA`/`MERMA`).
* **`GET /ventas/:id`** (`@Roles('Cajero', 'Gerente', 'Dueño')`): retorna la venta con su `detalle_venta` (producto + lote), cliente y montos. El Cajero y el Gerente solo pueden consultar ventas de su sucursal (404 en caso contrario); el Dueño accede a todas.

#### ¿Cómo funciona una venta? (Explicación paso a paso)

Piensa en una venta como un cajero atendiendo en mostrador. El sistema la procesa en este orden:

**Paso 0 — El requisito que lo es todo: la caja abierta.**
Ninguna venta puede registrarse si el cajero no abrió su caja al iniciar el turno. Si intenta vender sin caja abierta, el sistema lo rechaza de inmediato con el mensaje *"Debe aperturar una caja antes de vender"*. ¿Por qué? Porque todo el dinero que entra por ventas debe poder cuadrarse contra un turno de caja al final del día. Sin turno abierto no hay a quién imputarle el dinero.

**Paso 1 — Revisar los productos del carrito.**
El sistema verifica que cada producto del pedido exista en el catálogo y esté activo. También rechaza si alguien intenta incluir el mismo producto dos veces en la misma venta (debe ir como una sola línea con su cantidad).

**Paso 2 — Los medicamentos con receta médica.**
Si el carrito incluye un medicamento marcado como "requiere receta", la venta **no pasa sin receta**. El sistema valida tres cosas sobre ella:
   1. **Que exista** registrada en el sistema (el médico o el cajero la dieron de alta antes).
   2. **Que esté vigente** (no vencida según su fecha de vencimiento).
   3. **Que no se haya usado antes** (una receta solo sirve para una venta; sirve una vez y queda "quemada").
   Si además se indicó un cliente, el sistema confirma que la receta pertenezca a ese mismo cliente. Si no se indicó cliente, se toma el de la receta.

**Paso 3 — El sistema elige los lotes solo (regla FEFO).**
El cajero **nunca elige de qué paquete sale el medicamento**: el sistema decide en segundo plano, y siempre despacha **lo que vence primero** ("First Expired, First Out": lo primero en caducar es lo primero en salir). Esto evita que queden cajas olvidadas que acaben venciéndose en la repisa. Si un pedido necesita 10 unidades y un lote solo tiene 6, el sistema toma las 6 de ese lote y las 4 restantes del siguiente. Antes de despachar, cada lote pasa por un semáforo según los días que le faltan para vencer:

   | Días para vencer | Semáforo | ¿Se puede vender? |
   |---|---|---|
   | Ya venció o hoy | 🛑 Vencido | No |
   | 1 a 29 días | 🔴 Crítico | No (sugerir traslado urgente o merma) |
   | 30 a 90 días | 🟡 Preventivo | Sí, con prioridad FEFO |
   | Más de 90 días | 🟢 Normal | Sí, con prioridad FEFO |

**Paso 4 — Registro y cobro.**
Con los lotes asignados, el sistema calcula los montos (el precio lo pone el backend, **nunca** el frontend, para que nadie pueda manipularlo) y guarda la venta como `COMPLETADA` con su detalle producto por producto.

**Paso 5 — La red de seguridad: todo o nada.**
Todos los pasos anteriores ocurren dentro de una sola transacción de base de datos ("todo o nada"). Si algo falla a mitad de camino —se acabó el stock, la receta ya se usó, un producto ya no existe— **se cancela todo y el inventario queda exactamente como estaba**. Es imposible que el sistema descunte stock de un producto y luego falle sin registrar la venta, o viceversa: el inventario nunca se descuadra por una venta a medias. Además, cuando dos cajeros venden el mismo producto al mismo tiempo, el sistema "pone en fila" las peticiones (bloqueo de lotes) y verifica el stock justo antes de descontarlo, así que tampoco se puede vender más de lo que hay.

---

### Fase 2 (Por construir tras completar la Fase 1)
* `traslados`: Despacho desde sede origen, descuento temporal, recepción en destino y reporte de irregularidades.
* `proveedores` & `compras`: Ingreso de pedidos a proveedores con lotes y fechas de vencimiento.
* `inventarios` (Mermas): Ajustes de inventario por vencimiento o merma.
* `reportes`: Consolidado multisede en tiempo real y métricas financieras para Gerente y Dueño.