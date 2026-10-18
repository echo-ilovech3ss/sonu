# SONU

A guest-checkout shoe store for small-run trainers. No accounts, no passwords. The run is 15 pairs across five shapes — the 01 low-top, 02 runner, 03 court, 04 trail, and 05 archive — each in three colorways. A customer searches the run, picks a model, colorway and size, leaves the delivery fields, pays on delivery or through Razorpay, and gets a tracking code they can use from any device.

The storefront is backed by a private studio at `/admin`: live orders, add/edit products and per-size stock, traffic and buyer analytics, promo codes, payment status, editable storefront copy, and optional WhatsApp order confirmations. The customer side never sees an account screen.

## Stack

- React 19 + TypeScript + Vite
- Hono on Bun
- `bun:sqlite` with WAL mode
- Zod validation shared by the API boundary
- Razorpay Standard Checkout with server-side signature and payment verification
- Self-hosted Anybody, Instrument Sans, and Space Mono

## Run it

```bash
bun install
bun run dev
```

`bun run dev` starts the API on `http://127.0.0.1:8787` and Vite on `http://127.0.0.1:5173`. Vite proxies `/api` to Bun.

For a production build:

```bash
bun run build
SONU_ADMIN_KEY="$(openssl rand -hex 32)" \
SONU_CODE_KEY="$(openssl rand -hex 32)" \
RAZORPAY_KEY_ID="rzp_test_..." \
RAZORPAY_KEY_SECRET="..." \
bun run start
```

`bun run start` sets `NODE_ENV=production` itself and refuses to boot without a `SONU_ADMIN_KEY` of at least 32 characters. The server serves `dist/` and falls back to `index.html` for client routes. It also serves the API on the same origin.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Bun HTTP port |
| `HOST` | `127.0.0.1` | Bind address. Set `0.0.0.0` only when a proxy fronts the app. |
| `SONU_DB_PATH` | `./data/sonu.sqlite` | SQLite file location |
| `SONU_ADMIN_KEY` | `sonu-dev` in development | Studio password and default encryption secret. Production requires at least 32 random characters and refuses placeholders. |
| `SONU_CODE_KEY` | falls back to `SONU_ADMIN_KEY` | Optional stable AES key material for the admin-only recovery copy of tracking codes. Set this before launch and keep it stable. |
| `RAZORPAY_KEY_ID` | unset | Razorpay key id. Online payment is hidden when this or the secret is missing. Test keys start with `rzp_test_`. |
| `RAZORPAY_KEY_SECRET` | unset | Razorpay key secret. Server-only; never expose it to Vite or the browser. |
| `WHATSAPP_ENABLED` | `false` | Initial WhatsApp switch. The admin panel stores the live value in SQLite. |
| `WHATSAPP_GATEWAY_URL` | `http://127.0.0.1:10000` | lite-wa gateway base URL |
| `WHATSAPP_GATEWAY_API_KEY` | unset | Must match the gateway's `API_KEY` |
| `WHATSAPP_CLIENT_ID` | unset | 10-digit WhatsApp sender account |
| `PUBLIC_BASE_URL` | `http://localhost:8787` | Origin used in WhatsApp tracking links |
| `NODE_ENV` | unset | `production` enables static `dist/`, HSTS, and the startup key check. |

Bun loads `.env` automatically. Copy `.env.example` if you want a local starting point. The SQLite directory is created `0700`; the database, WAL, and SHM files are set `0600`.

## How guest tracking works

1. `POST /api/orders` validates the cart against the server catalog, prices the order server-side, and creates a code like `SNU-7K4P-9Q2M`. For online payments it also verifies the Razorpay signature and fetches the payment from Razorpay before writing the order.
2. The full code is shown once and saved in `localStorage` as `sonu.recentOrders.v1`. The server stores a SHA-256 hash of the code plus the last four characters for lookup, and an AES-GCM recovery copy that only the admin API can decrypt. Lookup never needs the recovery copy.
3. `GET /api/orders/:code` returns a public projection: status, event timeline, items, city, first name + last initial when a surname is present, totals, and delivery estimate. It does not return the email, phone, street address, or full surname.
4. The customer can open `/track`, enter the code on any device, and see the same order. Local storage is a convenience, not the source of truth.
5. Request IP and user agent are stored on the order and on each lookup in `order_lookups`; lookup rows older than 90 days are pruned at startup.

Status progression is forward-only and advances one step at a time:

```text
confirmed -> packed -> shipped -> out_for_delivery -> delivered
```

### Advance an order locally

```bash
bun run order:advance SNU-7K4P-9Q2M packed
bun run order:advance SNU-7K4P-9Q2M shipped
```

The CLI opens the same SQLite store directly. The same transition is available in the studio's order detail panel. To use the HTTP endpoint:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/orders/SNU-7K4P-9Q2M/status \
  -H 'content-type: application/json' \
  -H "x-admin-key: $SONU_ADMIN_KEY" \
  -d '{"status":"shipped","detail":"Handed to the courier."}'
```

## Payments

Online checkout uses Razorpay Standard Checkout in INR. The browser never receives the key secret.

1. The customer submits checkout. `POST /api/payments/razorpay/intent` re-prices the cart server-side and creates a Razorpay order for the exact total.
2. `checkout.js` opens with that order id and prefilled name, email, and phone.
3. On success the browser sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `POST /api/orders`.
4. The server verifies the HMAC signature, fetches the Razorpay order and payment, checks the order id, amount, currency, and captured state, and only then writes the order. If Razorpay reports `authorized`, the server captures it first.
5. The payment id is stored as `payment_reference`. Replaying the same successful proof returns the existing order instead of creating a second one.

Use test keys (`rzp_test_…`) to exercise the flow without moving money. Test cards and the mock bank Success/Failure page are documented by Razorpay. Live keys need a Razorpay account, completed KYC, and the store's public domain enabled in the Razorpay dashboard.

There is no webhook or refund UI yet. If a customer pays but closes the tab before `POST /api/orders`, the payment is captured at Razorpay but no order exists until the proof is replayed; refunds are handled in the Razorpay dashboard.

## WhatsApp order confirmations

The gateway is vendored in `whatsapp-gateway/` from [flowify-agency/lite-wa](https://github.com/flowify-agency/lite-wa). It is optional and off by default.

```bash
bun run whatsapp:install
API_KEY="$(openssl rand -hex 32)" npm --prefix whatsapp-gateway start
```

Keep the gateway on `127.0.0.1` unless a proxy protects it. In `/admin` → **WhatsApp**:

1. Set the gateway URL, the same API key, a sender label, and the 10-digit WhatsApp account number.
2. Press **Start login / show QR** and scan the code from WhatsApp → Linked devices.
3. Enable the switch and save.

A phone number is required at checkout so every order can be reached about delivery. The WhatsApp send is still opt-in: it runs only when the customer leaves the WhatsApp checkbox checked. The message includes the model/colorway, EU size and quantity, total, payment method, delivery estimate, first product image, tracking code, and a tracking link. If media delivery fails, the gateway retries as text. The message is sent asynchronously after the order is committed; a gateway outage never blocks checkout.

The gateway stores its linked-device session under `whatsapp-gateway/.wwebjs_auth/` (gitignored). Back that directory up if you do not want to re-scan after moving hosts.

## Studio

Open `/admin` and enter the `SONU_ADMIN_KEY`. The key is kept in this browser's `localStorage` until you press **Lock**. It is sent as `x-admin-key`; it is never rendered back into the page.

- **Orders** — search by code/name/city, filter by status, see the full delivery address and line items, and advance one status step with an optional timeline note.
- **Catalog** — add a shoe, edit every product field (model, colorway, price, image, optional CSS image filter, colors, upper, sole, weight, description, sizes), hide a pair, and set stock per EU size. Sold-out sizes disappear from the storefront immediately.
- **Analytics** — product-page views, orders, revenue, conversion, phone capture, WhatsApp opt-in, top products, buyer geography, recent buyers, and the COD/Razorpay split. Views are recorded server-side with IP and user agent.
- **WhatsApp** — optional. Point the studio at a self-hosted [lite-wa](https://github.com/flowify-agency/lite-wa) gateway, set its API key and 10-digit sender account, then scan the account QR from the panel. Orders with WhatsApp consent get a confirmation with the pair, size, photo, total, and tracking code.
- **Promos** — percent or fixed-amount codes with minimum subtotal, usage cap, expiry, and pause/active state. Usage is incremented in the same SQLite transaction as the order.
- **Storefront** — store name, ticker announcement, hero kicker/lede, shop intro, support email, delivery fee, free-shipping threshold, return window, COD switch, and promo-field switch.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Database ping |
| `GET` | `/api/products` | Live catalog, including stock and overrides |
| `POST` | `/api/analytics/view` | Records a product-page view (`{ productId }`) |
| `GET` | `/api/settings` | Public storefront settings |
| `POST` | `/api/promo/validate` | Validates a code against a subtotal |
| `GET` | `/api/payments/config` | Public Razorpay key id, enabled flag, and test-mode flag |
| `POST` | `/api/payments/razorpay/intent` | Re-prices the cart and creates a Razorpay order |
| `POST` | `/api/orders` | Creates a guest order; accepts optional `promoCode` and Razorpay proof |
| `GET` | `/api/orders/:code` | Public tracking projection |
| `GET` | `/api/admin/summary` | Requires `x-admin-key` |
| `GET` | `/api/admin/analytics` | Views, buyers, geography, and payment split |
| `GET` | `/api/admin/orders` | `?q=&status=`; requires `x-admin-key` |
| `GET` | `/api/admin/products` | Includes inactive colorways |
| `POST` | `/api/admin/products` | Create a custom shoe |
| `PATCH` | `/api/admin/products/:id` | Every product field, active flag, stock, sizes |
| `GET/PUT` | `/api/admin/whatsapp` | Read / update gateway and sender account |
| `GET` | `/api/admin/whatsapp/status` | Gateway connection state and QR |
| `POST` | `/api/admin/whatsapp/connect` | Start the account session / show QR |
| `POST` | `/api/admin/whatsapp/disconnect` | Unlink the account |
| `GET/POST` | `/api/admin/promo-codes` | List / create |
| `PUT/DELETE` | `/api/admin/promo-codes/:id` | Update / delete |
| `GET/PUT` | `/api/admin/settings` | Read / update storefront settings |
| `POST` | `/api/admin/orders/by-id/:id/status` | Advance by order id (works even when the recovery code is unreadable) |
| `POST` | `/api/admin/orders/:code/status` | Advance by tracking code |

## Data

SQLite tables:

- `orders` — customer and shipping fields, item JSON, totals, promo snapshot, payment method/status/reference, WhatsApp consent, request metadata
- `order_events` — append-only status timeline
- `order_lookups` — tracking lookups with IP and user agent
- `product_views` — product-page views with IP and user agent
- `product_settings` — per-product overrides, including name, colorway, image, image filter, colors, materials, price, visibility, sizes, stock, and description
- `custom_products` — shoes added from the studio, stored as JSON
- `promo_codes` — code rules and usage counter
- `settings` — storefront copy, checkout switches, and WhatsApp gateway settings

The schema is additive on boot: missing columns and tables are created, but existing rows are never rewritten or dropped. The database file, `data/`, `dist/`, and `.env` are gitignored. Back up the SQLite file (and its WAL) if the store is deployed.

## Checks

```bash
bun run typecheck
bun test
bun run build
```

The API suite covers validation (including mandatory phone), server-side pricing, tracking-code lookup, IP precedence, PII projection, status transitions, headers, Razorpay intent creation, signature checks, amount/order mismatches, capture, paid-order idempotency, product views, and the analytics aggregation. It also exercises promo validation, discount math, promo usage, and stock-aware pricing.

## Layout

```text
src/                 React storefront, cart, checkout, tracking
src/pages/admin/     Studio panels: orders, catalog, analytics, promos, settings
src/styles/          Global visual system and studio styling
shared/              Catalog, defaults, and public types used by both sides
server/              Hono routes, SQLite store, promos, settings, validation
scripts/             Local order-status CLI
tests/               API integration tests
public/images/       Product and editorial imagery
```

## Known limits

This is a small-run storefront, not a full commerce platform. COD and Razorpay online payments are supported; there is no webhook, refund workflow, or multi-instance payment reconciliation.

- Rate limits are in-process: 60 orders per 10 minutes, 300 tracking lookups per minute, 120 promo checks per minute, 180 product views per minute, and 60 admin calls per minute per IP. They reset on restart and are not shared across instances.
- Write requests must be JSON, same-origin, and at most 32 KB. Forwarded IP headers are validated; Cloudflare's `CF-Connecting-IP` wins when present. Deploy behind a proxy that overwrites forwarding headers.
- Tracking codes are 8 Crockford base32 characters (about 40 bits) and are not authentication. There is no confirmation email. Online retries with the same payment id return the existing order; COD retries have no idempotency key and can create a second order if a successful response is lost.
- The admin-only recovery copy is encrypted with `SONU_CODE_KEY` (or `SONU_ADMIN_KEY` as fallback). Changing that secret makes older recovery copies unreadable; the studio then shows the masked code (`SNU-••••-XXXX`) and order advancement still works by database id. Set a stable `SONU_CODE_KEY` before launch.
- `hello@sonu.example` is a placeholder support address; replace it in the studio before launch.
- The storefront is designed for one Bun process and one SQLite file. Back up `data/` before changing the schema.
