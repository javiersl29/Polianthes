# Plan de Implementación — E-commerce Polianthes + Mercado Pago

> Análisis generado el 2026-06-11 a partir del codebase actual.
> Stack: Next.js 14 App Router · TypeScript · Postgres (Neon) · `pg` (sin ORM) · Tailwind v3 · Framer Motion · Railway.

---

## 0. Resumen ejecutivo

Construir la capa de comercio del sitio actual sin reescribir lo existente. La base (catálogo, decodificador, admin auth, IA) se mantiene intacta. Se añade:

1. **Esquema de comercio** (4 tablas nuevas + extensiones a `presentation`).
2. **Carrito** (React Context + localStorage, sin auth de cliente).
3. **Checkout de 3 pasos** (datos → envío → pago) integrado con **Mercado Pago Checkout Pro** (redirect, sin PCI).
4. **Webhooks de MP** para confirmar pagos y generar pedidos.
5. **Admin de pedidos, precios/inventario, cupones, promociones, zonas de envío**.
6. **Toasts + sonner** (UX feedback transversal).

**Alcance del plan:** 4 sprints de 1-2 semanas cada uno. Al terminar el Sprint 4 hay un e-commerce funcional con cobros reales, panel de control y panel de envíos.

---

## 1. Decisiones de arquitectura (a confirmar contigo antes de codear)

### 1.1 Pasarela de pago — **Mercado Pago Checkout Pro (redirect)**
Razones:
- Ya nos pediste MP explícitamente.
- Checkout Pro **redirige al sitio de MP** → cero manejo de tarjeta, sin PCI-DSS, sin tokens.
- Funciona con cualquier método que el comprador tenga guardado (tarjeta, OXXO, transferencia, MSI, Mercado Crédito).
- SDK oficial: `mercadopago` (Node.js) v2.x. Estable, soporta Preference + Webhooks v2.

**Por qué NO Checkout Bricks:** agrega formulario embebido (más código, más PCI surface) y no aporta valor para perfumería de nicho donde el comprador ya está familiarizado con el flujo de MP.

**Credenciales necesarias** (te las pediré al final del Sprint 1):
- `MP_ACCESS_TOKEN` (producción + sandbox).
- `MP_PUBLIC_KEY` (solo si en algún punto queremos Brick; con Checkout Pro **no es estrictamente necesario**).
- Webhook URL pública (Railway ya nos da una estable).

### 1.2 Tipos de presentación — **catálogo fijo, pero configurable por admin**
La regla que diste es: **toda fragancia se ofrece en 10, 30, 60 y 100 ml** (militros). El admin puede:
- Activar/desactivar cada tamaño por fragancia (la tabla `presentation` ya tiene `active`).
- Poner precio por tamaño (campo `price_cents` que ya existe pero está en `null`).
- Definir stock por tamaño (campo nuevo).

Si una fragancia no tiene stock en 100 ml, simplemente no aparece como opción al comprar. El catálogo de tamaños **es la constante**, el stock y precio **son configurables**.

### 1.3 Currency — **MXN fijo**
El sitio ya muestra "MXN" hard-codeado en la UI (`app/fragancias/[slug]/page.tsx:7-10`). MP soporta cuentas en MXN perfectamente. Centralizamos la currency en un helper `lib/money.ts` para no repetirla.

### 1.4 Cliente (comprador) — **sin registro obligatorio**
Patrón "guest checkout": el cliente llena nombre, email, teléfono, dirección. El email es el identificador de la orden. **No construimos un sistema de cuentas de cliente en este plan.** Razones:
- Perfumería de nicho: el 80% de las compras son one-shot.
- MP ya guarda los datos del pagador.
- Agregar cuentas de cliente es trivial más adelante: tabla `customer` + passwordless login por email.

Lo que sí persiste: dirección + email del último comprador como "usar de nuevo" opcional en checkout (cookie/localStorage).

### 1.5 Carrito — **Context + localStorage, no servidor**
Razones:
- El sitio no tiene sesiones de cliente.
- localStorage sobrevive navegaciones, refresh y cierre de tab.
- El carrito se hidrata en el server layout con un placeholder vacío y se llena en el cliente.
- La **orden** sí vive en el servidor (es la fuente de verdad para el admin).

Estructura:
```
lib/cart.tsx            → CartProvider + useCart() + useCartCount()
                          shape: { items: CartItem[], add, remove, updateQty, clear, subtotalCents }
types                    CartItem = { slug, name, brand, image, size_ml, unit_price_cents, qty }
                          (presentaciones son inmutables; precio se congela al agregar)
```

### 1.6 Formularios — **añadir `react-hook-form` + `zod`**
Hoy no hay librería de forms. Para checkout y admin de cupones/zonas lo necesitamos. Decisión: **añadir** (2 dependencias maduras, usadas universalmente).

### 1.7 Toasts — **añadir `sonner`**
1 dependencia, ~3KB, dark-mode nativo, usado por shadcn/ui. Lo activamos globalmente en `app/layout.tsx`.

### 1.8 Zona de envío — **tabla `shipping_zone` con cálculo por polígono simplificado**
Dos opciones:
- **(A) Por código postal**: tabla `shipping_zone { id, name, postal_code_prefix, cost_cents, free_from_cents }`. El admin mete rangos de CP (ej. `03100-03999` = CDMX, `$99 MXN`, envío gratis >$1500). Sencillo, sin API externa.
- **(B) Por estado/regex**: lo mismo pero por nombre de estado.

Recomendado: **(A) por prefijo de CP**, con fallback "nacional" y "foráneo". México no necesita cálculo por distancia real para perfumería. Si más adelante hace falta, agregamos API de paquetería.

### 1.9 Cupones — **códigos alfanuméricos, % o monto fijo**
- Tabla `coupon { code, type ('percent'|'fixed'), value, min_subtotal_cents?, expires_at?, active, usage_limit?, usage_count }`.
- Validación en el checkout (no en admin).
- Descuento se aplica al **subtotal** (no al envío).
- Un cupón por orden.
- Si el cupón es expirado, agotado o no cumple el mínimo: mensaje claro en checkout.

### 1.10 Promociones — **reglas automáticas que se aplican solas**
- Tabla `promotion { id, name, kind, config_json, active, starts_at, ends_at, priority }`.
- `kind` ∈ `{ "bxgy", "percent_category", "free_shipping_over" }`.
- `priority` resuelve conflictos (la de mayor prioridad gana; las demás no se acumulan salvo que `stackable: true` en config).
- Ejemplos:
  - `kind: "bxgy", config: { buy: 2, get: 1, free: true, category: "Floral" }` → 2x1 en florales.
  - `kind: "percent_category", config: { percent: 15, category: "Oriental" }` → 15% off en orientales.
  - `kind: "free_shipping_over", config: { threshold_cents: 200000 }` → envío gratis sobre $2000.
- La UI del admin es un **JSON editor guiado** (no un form gigante de 20 campos).

### 1.11 Stock — **campo `stock` en `presentation`, sin reservar**
No implementamos "reservar stock durante el checkout" en este plan. Razones: el flujo de MP es redirect (el cliente puede tardar 5 min en pagar, el stock quedaría bloqueado). En su lugar:
- El stock se valida en el **momento de crear la orden** (post-pago aprobado).
- Si en ese instante no hay stock, **se rechaza la orden y se devuelve el dinero** vía `refunds.create` de MP. Esto es edge-case raro y manejable.
- El admin ve el campo `stock` editable (puede poner `-1` o `NULL` para "ilimitado").

### 1.12 Email de confirmación — **SMTP genérico via nodemailer**
- Plantilla en español con el resumen de la orden + número de seguimiento + link a `https://.../pedido/[id]`.
- SMTP configurable (recomendado: **Resend** o **Mailgun**, ambos tienen tier gratuito y buen deliverability en MX).
- Si no hay SMTP configurado al inicio: el admin ve el link de la orden en el panel de pedidos, y el email se loguea en consola con un warning. No bloquea el flujo.

---

## 2. Cambios al esquema de base de datos

> Las migraciones se aplican vía `app/api/bootstrap/route.ts` siguiendo el patrón idempotente que ya usas (`ensureColumn` / `CREATE TABLE IF NOT EXISTS`).

### 2.1 Extender `presentation` (tabla existente)
| Columna nueva | Tipo | Default | Notas |
|---|---|---|---|
| `stock` | INTEGER | NULL | `NULL` = sin control de stock. `< 0` = ilimitado. `0` = agotado (no se muestra al público). |
| `sku` | TEXT | NULL | Opcional. Si se setea, debe ser UNIQUE por fragancia. |
| `compare_at_price_cents` | INTEGER | NULL | Precio tachado. Si está set, el catálogo muestra el descuento. |
| `weight_grams` | INTEGER | NULL | Para futuras integraciones con paquetería. |

> Sin tocar `size_ml`, `price_cents`, `active` — ya existen.

### 2.2 Tabla nueva `shipping_zone`
```sql
CREATE TABLE IF NOT EXISTS shipping_zone (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                       -- "CDMX Centro", "Zona Metropolitana", "Nacional"
  postal_code_prefix TEXT NOT NULL,        -- "03", "04", "00" (string de 2 dígitos)
  cost_cents INTEGER NOT NULL DEFAULT 0,   -- costo de envío en centavos MXN
  free_from_cents INTEGER,                  -- envío gratis si subtotal >= este valor
  estimated_days TEXT,                      -- "2-3 días hábiles"
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipping_zone_prefix ON shipping_zone(postal_code_prefix) WHERE active;
```

### 2.3 Tabla nueva `coupon`
```sql
CREATE TABLE IF NOT EXISTS coupon (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                 -- "BIENVENIDA10", "POLIANTHES20" (uppercase)
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value INTEGER NOT NULL,                    -- si percent: 1-100, si fixed: centavos
  min_subtotal_cents INTEGER,                -- subtotal mínimo para aplicar
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,                       -- NULL = ilimitado
  usage_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,                          -- nota interna para admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.4 Tabla nueva `promotion`
```sql
CREATE TABLE IF NOT EXISTS promotion (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bxgy','percent_category','free_shipping_over','fixed_off_over')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stackable BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,       -- mayor = gana
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.5 Tabla nueva `order`
```sql
CREATE TABLE IF NOT EXISTS "order" (
  id SERIAL PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,            -- "POL-2026-000123" (human-friendly)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled','refunded','in_transit','delivered')),
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  -- snapshot de envío (no FK a nada; si el admin edita zonas no rompe órdenes viejas)
  shipping_zone_name TEXT NOT NULL,
  shipping_address_line TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'MX',
  -- importes
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  -- cupón y promo aplicados (snapshot)
  coupon_code TEXT,
  promotion_id INTEGER REFERENCES promotion(id) ON DELETE SET NULL,
  -- pago
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,                            -- estado crudo de MP
  paid_at TIMESTAMPTZ,
  -- auditoría
  notes TEXT,                                -- notas internas del admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_email ON "order"(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_created ON "order"(created_at DESC);
```

### 2.6 Tabla nueva `order_item`
```sql
CREATE TABLE IF NOT EXISTS order_item (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  fragrance_id INTEGER NOT NULL REFERENCES fragrance(id) ON DELETE RESTRICT,
  -- snapshot del producto al momento de la compra
  fragrance_slug TEXT NOT NULL,
  fragrance_brand TEXT NOT NULL,
  fragrance_name TEXT NOT NULL,
  size_ml INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_total_cents INTEGER NOT NULL,
  fragrance_image_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
```

### 2.7 Tabla nueva `coupon_redemption` (auditoría de uso)
```sql
CREATE TABLE IF NOT EXISTS coupon_redemption (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupon(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON coupon_redemption(coupon_id);
```

> Esto evita re-contar `usage_count` y nos da historial por cliente (futuro: "1 cupón por email" si se requiere).

---

## 3. Rutas nuevas (API + páginas)

### 3.1 Rutas públicas (cliente)
| Path | Método | Función |
|---|---|---|
| `app/api/cart/preview/route.ts` | POST | Recibe items del carrito + cupón + CP, devuelve `{ subtotal, discount, shipping, total, applied_coupon, applied_promotions[], warnings[] }`. No crea orden. |
| `app/api/checkout/create/route.ts` | POST | Crea preferencia de MP, persiste orden en estado `pending`, devuelve `init_point` (URL a donde redirigir al cliente). |
| `app/api/webhooks/mercadopago/route.ts` | POST | Recibe IPN/webhook de MP. Verifica firma. Actualiza estado de la orden. No requiere auth. |
| `app/api/pedido/[id]/route.ts` | GET | Devuelve resumen público de la orden por `public_id` (para la página de confirmación). Valida con email como segundo factor. |

### 3.2 Páginas nuevas
| Path | Función |
|---|---|
| `app/carrito/page.tsx` | Página del carrito. Lista de items, input de cupón, selector de tamaño al editar. |
| `app/checkout/page.tsx` | Wizard 3 pasos: Datos → Envío → Pago (redirect a MP). |
| `app/checkout/exito/page.tsx` | Confirmación post-pago. |
| `app/checkout/fallo/page.tsx` | Pago rechazado. |
| `app/checkout/pendiente/page.tsx` | OXXO/transferencia pendiente. |
| `app/pedido/[id]/page.tsx` | Detalle de orden (lookup por email). |

### 3.3 Rutas admin (protegidas con `isAuthenticated()`)
| Path | Función |
|---|---|
| `app/api/admin/pricing/route.ts` | GET/POST `presentation` (precios, stock, sku, compare_at_price). |
| `app/api/admin/shipping/route.ts` | GET/POST/PATCH/DELETE `shipping_zone`. |
| `app/api/admin/coupons/route.ts` | CRUD `coupon`. |
| `app/api/admin/promotions/route.ts` | CRUD `promotion`. |
| `app/api/admin/orders/route.ts` | GET (lista paginada + filtros), PATCH (cambiar status, notas). |
| `app/api/admin/orders/[id]/route.ts` | GET detalle con items. |
| `app/api/admin/orders/[id]/refund/route.ts` | POST reembolso vía MP. |

### 3.4 Páginas admin nuevas
| Path | Función |
|---|---|
| `app/admin/(panel)/pedidos/page.tsx` | Lista de pedidos con filtros (status, fecha, email). Click → detalle. |
| `app/admin/(panel)/pedidos/[id]/page.tsx` | Detalle de pedido. Acciones: marcar enviado, entregado, reembolsar, agregar notas. |
| `app/admin/(panel)/precios/page.tsx` | Matriz: fragancia × tamaño → precio/stock/SKU/comparar. Edición inline. |
| `app/admin/(panel)/envios/page.tsx` | CRUD de zonas de envío. |
| `app/admin/(panel)/cupones/page.tsx` | CRUD de cupones. Lista de redenciones. |
| `app/admin/(panel)/promociones/page.tsx` | CRUD de promociones. Editor JSON guiado. |
| `app/admin/(panel)/configuracion/page.tsx` | (Reemplaza el "AI Config" simple por un hub.) Pestañas: IA · Pagos · Email. |

---

## 4. Componentes nuevos (cliente)

| Archivo | Función |
|---|---|
| `lib/cart.tsx` | CartProvider + useCart + useCartCount. Hidratación desde localStorage. |
| `lib/money.ts` | formatMXN(cents), parseMXN(str) → cents. |
| `lib/promotions.ts` | `applyPromotions(cart, promotions)` → descuentos calculados. Pure function, testable. |
| `lib/coupons.ts` | `validateCoupon(code, subtotal)` desde API. |
| `lib/shipping.ts` | `resolveShippingZone(postalCode)` desde API. |
| `lib/mp.ts` | Wrapper sobre SDK de MP. `createPreference`, `refundPayment`. |
| `components/CartIcon.tsx` | Ícono en navbar con badge de count. |
| `components/CartDrawer.tsx` | Drawer lateral con resumen + link a /carrito. |
| `components/AddToCartButton.tsx` | Botón reutilizable. Pasa tamaño + qty. Dispara toast. |
| `components/QuantityStepper.tsx` | +/- para carrito y detalle. |
| `components/SizeSelector.tsx` | Selector de tamaño (10/30/60/100ml) con precios y stock por tamaño. |
| `components/CouponInput.tsx` | Input de cupón con validación inline. |
| `components/CheckoutForm/DatosStep.tsx` | Paso 1. |
| `components/CheckoutForm/EnvioStep.tsx` | Paso 2. |
| `components/CheckoutForm/PagoStep.tsx` | Paso 3 — botón "Pagar con Mercado Pago". |
| `components/OrderSummary.tsx` | Componente compartido entre carrito y checkout. |

---

## 5. Flujo end-to-end del cliente

```
[Navega catálogo]
  └→ Click "Ver detalle" en /fragancias/[slug]
       └→ Selecciona tamaño (10/30/60/100ml) y qty
            └→ Click "Agregar al carrito"  → toast "Agregado"
                 └→ Drawer de carrito se puede abrir desde navbar (badge con count)
                      └→ Click "Ir a checkout" → /carrito
                           └→ Revisa items, aplica cupón (opcional)
                                └→ Click "Continuar" → /checkout
                                     ├─ Paso 1: email, nombre, teléfono
                                     ├─ Paso 2: CP → busca zona de envío,
                                     │           muestra costo + ETA
                                     │           llena dirección
                                     └─ Paso 3: resumen + botón "Pagar con MP"
                                          └→ POST /api/checkout/create
                                               └→ MP crea preference, devuelve init_point
                                                    └→ Redirige a mercadopago.com.mx
                                                         ├─ Éxito → /checkout/exito?pid=XXX
                                                         ├─ Fallo → /checkout/fallo
                                                         └─ Pendiente (OXXO) → /checkout/pendiente

[MP envía webhook] → /api/webhooks/mercadopago
  └→ Actualiza orden: status='approved', paid_at, mp_payment_id
       └→ Envía email de confirmación al cliente
       └→ Decrementa stock de los items vendidos
            └→ Incrementa coupon.usage_count si usó cupón
                 └→ Inserta en coupon_redemption
```

---

## 6. Flujo admin de pedidos

```
/admin/pedidos
  └→ Filtros: estado (pendiente/pagado/enviado/entregado), rango fecha, email
       └→ Tabla con columnas: public_id, fecha, cliente, total, status, acciones
            └→ Click fila → /admin/pedidos/[id]
                 ├─ Datos del cliente y dirección (no editables; snapshot)
                 ├─ Lista de items comprados (con link a la fragancia)
                 ├─ Desglose: subtotal · descuento · envío · total
                 ├─ Estado del pago (MP payment id, status, fecha)
                 ├─ Acciones:
                 │   ├─ Marcar enviado (si 'approved')
                 │   ├─ Marcar entregado (si 'in_transit')
                 │   ├─ Reembolsar (si 'approved'|'in_transit'|'delivered') → MP API
                 │   └─ Agregar notas internas
                 └─ Historial de cambios (created/updated/refunded)
```

---

## 7. Dependencias nuevas (a añadir a `package.json`)

```jsonc
{
  "dependencies": {
    // producción
    "mercadopago": "^2.0.0",         // SDK oficial
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0", // bridge rhf + zod
    "sonner": "^1.5.0",              // toasts
    "nodemailer": "^6.9.0"           // emails transaccionales
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.0"
  }
}
```

> Total: **5 deps runtime nuevas, 1 dev**. Todas son maduras y mantenidas.

---

## 8. Variables de entorno nuevas (a añadir a `.env.example`)

```
# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxxxxxxx
MP_PUBLIC_KEY=APP_USR-xxxxxxxx
MP_ENVIRONMENT=sandbox              # sandbox | production
MP_WEBHOOK_URL=https://web-production-529650.up.railway.app/api/webhooks/mercadopago

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Polianthes <hola@polianthes.mx>"
```

---

## 9. Roadmap de sprints

### Sprint 1 — Fundaciones (5-7 días)
**Objetivo:** se puede poner precio a una fragancia y verla en el sitio.

- [ ] Instalar dependencias (Mercado Pago SDK, react-hook-form, zod, sonner, nodemailer).
- [ ] Migración SQL: extender `presentation` con `stock`, `sku`, `compare_at_price_cents`, `weight_grams`.
- [ ] Crear `lib/money.ts` con `formatMXN` y `parseMXN`.
- [ ] Crear `app/admin/(panel)/precios/page.tsx` con matriz editable.
- [ ] API `app/api/admin/pricing/route.ts` (GET/POST).
- [ ] Modificar `app/fragancias/[slug]/page.tsx` para mostrar precios reales y agregar botón "Agregar al carrito" (placeholder).
- [ ] `app/api/search` debe devolver precios para que el catálogo muestre desde cuánto cuesta cada fragancia.
- [ ] Mostrar en el `Catalog.tsx` "Desde $XXX MXN".
- [ ] Configurar `.env.example` con las nuevas vars.
- [ ] **Entregable:** admin puede poner precio, el sitio público lo muestra.

### Sprint 2 — Carrito + Checkout skeleton (5-7 días)
**Objetivo:** usuario puede armar un carrito y ver el resumen; todavía no cobra.

- [ ] `lib/cart.tsx` con `CartProvider` + localStorage.
- [ ] Montar provider en `app/layout.tsx`.
- [ ] `components/CartIcon` + badge en navbar.
- [ ] `components/CartDrawer` lateral.
- [ ] `app/carrito/page.tsx` con lista de items, qty stepper, subtotal.
- [ ] `components/CouponInput` (sin lógica real aún, solo UI).
- [ ] `components/CheckoutForm/{DatosStep,EnvioStep,PagoStep}` (estructura).
- [ ] Página `/checkout` con wizard de 3 pasos (sin pago todavía).
- [ ] **Entregable:** usuario llena carrito, llena checkout, llega a paso 3 y ve "Pagar" deshabilitado con tooltip "Próximamente".

### Sprint 3 — Pago real con Mercado Pago (4-5 días)
**Objetivo:** cobros reales funcionando end-to-end.

- [ ] Migración: crear tablas `order`, `order_item`, `coupon`, `coupon_redemption`, `promotion`, `shipping_zone`.
- [ ] `lib/mp.ts` con `createPreference` y `refundPayment`.
- [ ] `app/api/checkout/create/route.ts` — crea preferencia + orden `pending`.
- [ ] `app/api/webhooks/mercadopago/route.ts` — recibe notificaciones, valida firma, actualiza orden.
- [ ] Páginas `/checkout/{exito,fallo,pendiente}`.
- [ ] `app/pedido/[id]/page.tsx` con lookup por email.
- [ ] Probar con **cuentas de prueba de MP** (sandbox): tarjeta 4509 9535 6623 3704, etc.
- [ ] **Entregable:** un usuario real de prueba puede hacer una compra completa.

### Sprint 4 — Admin de operaciones (5-7 días)
**Objetivo:** el equipo puede gestionar todo desde el panel.

- [ ] `app/admin/(panel)/pedidos/page.tsx` + `[id]`.
- [ ] Acciones admin: marcar enviado, entregado, reembolsar.
- [ ] `app/admin/(panel)/envios/page.tsx` con CRUD de `shipping_zone`.
- [ ] `app/admin/(panel)/cupones/page.tsx` con CRUD de cupones.
- [ ] `app/admin/(panel)/promociones/page.tsx` con editor JSON de promociones.
- [ ] Hookear `app/api/cart/preview` con cupones + promos + envío real.
- [ ] Email de confirmación post-pago (vía nodemailer, con fallback a console.log si SMTP no configurado).
- [ ] Sidebar admin: añadir items (Pedidos, Precios, Envíos, Cupones, Promos, Config).
- [ ] **Entregable:** tienda en vivo con todas las operativas desde admin.

### Sprint 5 (opcional, no incluido en este plan base)
- Sistema de cuentas de cliente (login por email magic-link, historial de pedidos).
- Wishlist / favoritos.
- Notificaciones por WhatsApp al admin cuando entra un pedido.
- Integración con paquetería real (Skydropx, Envia.com) para imprimir guías.

---

## 10. Riesgos y cómo los mitigué

| Riesgo | Mitigación |
|---|---|
| MP no se puede probar sin credenciales reales | Te pediré `MP_ACCESS_TOKEN` de sandbox apenas termine Sprint 1. Te dejo documentado cómo obtenerlo (10 min en mercadopago.com.mx/developers). |
| Webhook de MP requiere URL pública estable | Railway ya nos da una estable (`web-production-529650.up.railway.app`). Solo hay que configurar esa URL en el panel de MP. |
| Cambios al catálogo de tamaños (presentaciones) rompen órdenes viejas | Las órdenes guardan **snapshot** de marca, nombre, tamaño y precio en `order_item`. Si el admin borra una presentación, las órdenes viejas siguen mostrando el producto correctamente. |
| Stock se agota entre "agregar al carrito" y "pagar" | Validamos stock al **recibir el webhook de pago aprobado**, no antes. Si falla, reembolso automático. Raro en perfumería de nicho. |
| Cupones duplicados / abuso | `usage_count` se incrementa en transacción con `coupon_redemption`. Si `usage_limit` se alcanza, el cupón se marca visualmente como agotado y se rechaza en checkout. |
| Zona de envío no matchea un CP | Fallback a una zona "Nacional" (con costo mayor) configurable. Si no existe zona nacional, el checkout bloquea con error claro. |

---

## 11. Lo que necesito de ti para arrancar

1. **Confirmar** que vamos con **Mercado Pago Checkout Pro** (redirect) y no con Bricks.
2. **Confirmar** que los tamaños son **10/30/60/100 ml** y aplica a TODAS las fragancias.
3. **Confirmar** guest checkout (sin login de cliente) para esta primera versión.
4. **Crear cuenta de MP Developers** y darme `MP_ACCESS_TOKEN` de sandbox al final del Sprint 1.
5. (Opcional) Decirme si querés **email transaccional** desde el día 1 o si lo dejamos con fallback a log.

Una vez que confirmes, arranco con el **Sprint 1**.
