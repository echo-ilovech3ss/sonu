import { Database } from 'bun:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PRODUCTS, type Product } from '../shared/catalog';
import type {
  OrderEvent,
  OrderItem,
  OrderStatus,
  PromoCode,
  PromoType,
} from '../shared/types';

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

export class PromoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoError';
  }
}

export interface OrderRecord {
  id: string;
  trackingHash: string;
  trackingLast4: string;
  trackingCodeEnc: string | null;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  promoCode: string | null;
  totalCents: number;
  currency: 'INR';
  paymentMethod: 'cod' | 'razorpay';
  paymentStatus: 'cod' | 'paid';
  paymentReference: string | null;
  whatsappOptIn: boolean;
  ip: string | null;
  userAgent: string | null;
  estimatedDelivery: string;
}

interface OrderRow {
  id: string;
  tracking_hash: string;
  tracking_last4: string;
  tracking_code_enc: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  customer_name: string;
  email: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  items_json: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  promo_code: string | null;
  total_cents: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  whatsapp_opt_in: number;
  ip: string | null;
  user_agent: string | null;
  estimated_delivery: string;
}

interface EventRow {
  status: string;
  label: string;
  detail: string;
  occurred_at: string;
}

export interface ProductOverride {
  productId: string;
  name: string | null;
  colorway: string | null;
  colorwaySlug: string | null;
  priceCents: number | null;
  image: string | null;
  imageFit: 'contain' | 'cover' | null;
  imageFilter: string | null;
  swatch: string | null;
  swatchInk: string | null;
  upper: string | null;
  sole: string | null;
  weightGrams: number | null;
  active: boolean | null;
  sizes: number[] | null;
  stock: Record<string, number> | null;
  description: string | null;
  updatedAt: string;
}

interface ProductOverrideRow {
  product_id: string;
  name: string | null;
  colorway: string | null;
  colorway_slug: string | null;
  price_cents: number | null;
  image: string | null;
  image_fit: string | null;
  image_filter: string | null;
  swatch: string | null;
  swatch_ink: string | null;
  upper: string | null;
  sole: string | null;
  weight_grams: number | null;
  active: number | null;
  sizes_json: string | null;
  stock_json: string | null;
  description: string | null;
  updated_at: string;
}

interface CustomProductRow {
  id: string;
  product_json: string;
  created_at: string;
  updated_at: string;
}

interface PromoRow {
  id: string;
  code: string;
  type: string;
  value: number;
  min_subtotal_cents: number;
  max_uses: number | null;
  used_count: number;
  active: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

export function defaultDbPath(): string {
  return resolve(process.env.SONU_DB_PATH ?? resolve(process.cwd(), 'data', 'sonu.sqlite'));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tracking_hash TEXT UNIQUE NOT NULL,
  tracking_last4 TEXT NOT NULL,
  tracking_code_enc TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  items_json TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'cod',
  payment_reference TEXT,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 1,
  ip TEXT,
  user_agent TEXT,
  estimated_delivery TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_lookups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  looked_up_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_settings (
  product_id TEXT PRIMARY KEY,
  name TEXT,
  colorway TEXT,
  colorway_slug TEXT,
  price_cents INTEGER,
  image TEXT,
  image_fit TEXT,
  image_filter TEXT,
  swatch TEXT,
  swatch_ink TEXT,
  upper TEXT,
  sole TEXT,
  weight_grams INTEGER,
  active INTEGER,
  sizes_json TEXT,
  stock_json TEXT,
  description TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  viewed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_views_product
  ON product_views(product_id);

CREATE TABLE IF NOT EXISTS custom_products (
  id TEXT PRIMARY KEY,
  product_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tracking_hash ON orders(tracking_hash);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lookups_order_id ON order_lookups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lookups_looked_up_at ON order_lookups(looked_up_at);
`;

type StatementParams = Record<string, string | number | null>;

function ensureColumn(
  db: Database,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function parseNumberArray(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === 'number')
      : null;
  } catch {
    return null;
  }
}

function parseStock(json: string | null): Record<string, number> | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return null;
  }
}

function toPromoCode(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type as PromoType,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    active: row.active === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProductOverride(row: ProductOverrideRow): ProductOverride {
  return {
    productId: row.product_id,
    name: row.name,
    colorway: row.colorway,
    colorwaySlug: row.colorway_slug,
    priceCents: row.price_cents,
    image: row.image,
    imageFit:
      row.image_fit === 'contain' || row.image_fit === 'cover'
        ? row.image_fit
        : null,
    imageFilter: row.image_filter,
    swatch: row.swatch,
    swatchInk: row.swatch_ink,
    upper: row.upper,
    sole: row.sole,
    weightGrams: row.weight_grams,
    active: row.active === null ? null : row.active === 1,
    sizes: parseNumberArray(row.sizes_json),
    stock: parseStock(row.stock_json),
    description: row.description,
    updatedAt: row.updated_at,
  };
}

function toCustomProduct(row: CustomProductRow): Product | null {
  try {
    const parsed = JSON.parse(row.product_json) as Product;
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

const INSERT_EVENT_SQL = `
  INSERT INTO order_events (order_id, status, label, detail, occurred_at)
  VALUES ($orderId, $status, $label, $detail, $occurredAt)
`;

function parseItems(json: string): OrderItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
  } catch {
    return [];
  }
}

function toOrderRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    trackingHash: row.tracking_hash,
    trackingLast4: row.tracking_last4,
    trackingCodeEnc: row.tracking_code_enc,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as OrderStatus,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    items: parseItems(row.items_json),
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    discountCents: row.discount_cents,
    promoCode: row.promo_code,
    totalCents: row.total_cents,
    currency: row.currency as 'INR',
    paymentMethod: row.payment_method as 'cod' | 'razorpay',
    paymentStatus: row.payment_status as 'cod' | 'paid',
    paymentReference: row.payment_reference,
    whatsappOptIn: row.whatsapp_opt_in !== 0,
    ip: row.ip,
    userAgent: row.user_agent,
    estimatedDelivery: row.estimated_delivery,
  };
}

export class OrderStore {
  readonly path: string;
  private readonly db: Database;

  constructor(dbPath: string = defaultDbPath()) {
    this.path = resolve(dbPath);
    const dataDirectory = dirname(this.path);

    // Keep the SQLite database, WAL and SHM private to the service account.
    process.umask(0o077);
    mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
    try {
      chmodSync(dataDirectory, 0o700);
    } catch {
      // Filesystems without POSIX permissions (or a read-only mount) are fine.
    }

    this.db = new Database(this.path, { create: true, strict: true });
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
    ensureColumn(this.db, 'orders', 'tracking_code_enc', 'TEXT');
    ensureColumn(this.db, 'orders', 'discount_cents', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(this.db, 'orders', 'promo_code', 'TEXT');
    ensureColumn(this.db, 'orders', 'payment_status', "TEXT NOT NULL DEFAULT 'cod'");
    ensureColumn(this.db, 'orders', 'payment_reference', 'TEXT');
    ensureColumn(
      this.db,
      'orders',
      'whatsapp_opt_in',
      'INTEGER NOT NULL DEFAULT 1',
    );
    ensureColumn(this.db, 'product_settings', 'name', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'colorway', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'colorway_slug', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'image', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'image_fit', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'image_filter', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'swatch', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'swatch_ink', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'upper', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'sole', 'TEXT');
    ensureColumn(this.db, 'product_settings', 'weight_grams', 'INTEGER');
    this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference
       ON orders(payment_reference)
       WHERE payment_reference IS NOT NULL;`,
    );
    this.db.exec(
      "DELETE FROM order_lookups WHERE julianday(looked_up_at) < julianday('now', '-90 days');",
    );

    for (const file of [this.path, `${this.path}-wal`, `${this.path}-shm`]) {
      try {
        chmodSync(file, 0o600);
      } catch {
        // The DB still works if chmod is unavailable.
      }
    }
  }

  ping(): boolean {
    return this.db.query<{ ok: number }, []>('SELECT 1 AS ok').get() !== null;
  }

  close(): void {
    this.db.close();
  }

  findOrderById(id: string): OrderRecord | null {
    const row = this.db
      .query<OrderRow, [string]>('SELECT * FROM orders WHERE id = ?')
      .get(id);
    return row ? toOrderRecord(row) : null;
  }

  findOrderByPaymentReference(paymentReference: string): OrderRecord | null {
    const row = this.db
      .query<OrderRow, [string]>(
        'SELECT * FROM orders WHERE payment_reference = ?',
      )
      .get(paymentReference);
    return row ? toOrderRecord(row) : null;
  }

  findOrderByTrackingHash(trackingHash: string): OrderRecord | null {
    const row = this.db
      .query<OrderRow, [string]>('SELECT * FROM orders WHERE tracking_hash = ?')
      .get(trackingHash);
    return row ? toOrderRecord(row) : null;
  }

  listOrders(limit = 200): OrderRecord[] {
    return this.db
      .query<OrderRow, [number]>(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?',
      )
      .all(limit)
      .map(toOrderRecord);
  }

  listProductOverrides(): ProductOverride[] {
    return this.db
      .query<ProductOverrideRow, []>('SELECT * FROM product_settings')
      .all()
      .map(toProductOverride);
  }

  listCustomProducts(): Product[] {
    return this.db
      .query<CustomProductRow, []>(
        'SELECT * FROM custom_products ORDER BY created_at ASC',
      )
      .all()
      .map(toCustomProduct)
      .filter((product): product is Product => product !== null);
  }

  getCustomProduct(id: string): Product | null {
    const row = this.db
      .query<CustomProductRow, [string]>(
        'SELECT * FROM custom_products WHERE id = ?',
      )
      .get(id);
    return row ? toCustomProduct(row) : null;
  }

  recordProductView(
    productId: string,
    ip: string | null,
    userAgent: string | null,
  ): void {
    this.db
      .query<unknown, StatementParams>(`
        INSERT INTO product_views (product_id, ip, user_agent, viewed_at)
        VALUES ($productId, $ip, $userAgent, $viewedAt)
      `)
      .run({
        productId,
        ip,
        userAgent,
        viewedAt: new Date().toISOString(),
      });
  }

  listProductViewCounts(): Array<{ productId: string; views: number }> {
    return this.db
      .query<{ product_id: string; views: number }, []>(`
        SELECT product_id, COUNT(*) AS views
        FROM product_views
        GROUP BY product_id
      `)
      .all()
      .map((row) => ({ productId: row.product_id, views: row.views }));
  }

  insertCustomProduct(product: Product): void {
    const now = new Date().toISOString();
    this.db
      .query<unknown, StatementParams>(`
        INSERT INTO custom_products (id, product_json, created_at, updated_at)
        VALUES ($id, $productJson, $createdAt, $updatedAt)
      `)
      .run({
        id: product.id,
        productJson: JSON.stringify(product),
        createdAt: now,
        updatedAt: now,
      });
  }

  getProductOverride(productId: string): ProductOverride | null {
    const row = this.db
      .query<ProductOverrideRow, [string]>(
        'SELECT * FROM product_settings WHERE product_id = ?',
      )
      .get(productId);
    return row ? toProductOverride(row) : null;
  }

  saveProductOverride(override: ProductOverride): void {
    this.db
      .query<unknown, StatementParams>(`
        INSERT INTO product_settings (
          product_id, name, colorway, colorway_slug, price_cents, image, image_fit,
          image_filter, swatch, swatch_ink, upper, sole, weight_grams, active, sizes_json,
          stock_json, description, updated_at
        ) VALUES (
          $productId, $name, $colorway, $colorwaySlug, $priceCents, $image, $imageFit,
          $imageFilter, $swatch, $swatchInk, $upper, $sole, $weightGrams, $active, $sizesJson,
          $stockJson, $description, $updatedAt
        )
        ON CONFLICT(product_id) DO UPDATE SET
          name = excluded.name,
          colorway = excluded.colorway,
          colorway_slug = excluded.colorway_slug,
          price_cents = excluded.price_cents,
          image = excluded.image,
          image_fit = excluded.image_fit,
          image_filter = excluded.image_filter,
          swatch = excluded.swatch,
          swatch_ink = excluded.swatch_ink,
          upper = excluded.upper,
          sole = excluded.sole,
          weight_grams = excluded.weight_grams,
          active = excluded.active,
          sizes_json = excluded.sizes_json,
          stock_json = excluded.stock_json,
          description = excluded.description,
          updated_at = excluded.updated_at
      `)
      .run({
        productId: override.productId,
        name: override.name,
        colorway: override.colorway,
        colorwaySlug: override.colorwaySlug,
        priceCents: override.priceCents,
        image: override.image,
        imageFit: override.imageFit,
        imageFilter: override.imageFilter,
        swatch: override.swatch,
        swatchInk: override.swatchInk,
        upper: override.upper,
        sole: override.sole,
        weightGrams: override.weightGrams,
        active: override.active === null ? null : override.active ? 1 : 0,
        sizesJson: override.sizes ? JSON.stringify(override.sizes) : null,
        stockJson: override.stock ? JSON.stringify(override.stock) : null,
        description: override.description,
        updatedAt: override.updatedAt,
      });
  }

  getSettings(): Record<string, string> {
    const rows = this.db
      .query<SettingRow, []>('SELECT key, value FROM settings')
      .all();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  setSettings(values: Record<string, string>): void {
    const upsert = this.db.prepare<unknown, { key: string; value: string }>(`
      INSERT INTO settings (key, value) VALUES ($key, $value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(values)) {
        upsert.run({ key, value });
      }
    });
    transaction();
  }

  getPromoById(id: string): PromoCode | null {
    const row = this.db
      .query<PromoRow, [string]>('SELECT * FROM promo_codes WHERE id = ?')
      .get(id);
    return row ? toPromoCode(row) : null;
  }

  getPromoByCode(code: string): PromoCode | null {
    const row = this.db
      .query<PromoRow, [string]>(
        'SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE',
      )
      .get(code);
    return row ? toPromoCode(row) : null;
  }

  listPromoCodes(): PromoCode[] {
    return this.db
      .query<PromoRow, []>('SELECT * FROM promo_codes ORDER BY created_at DESC')
      .all()
      .map(toPromoCode);
  }

  insertPromo(promo: PromoCode): void {
    this.db
      .query<unknown, StatementParams>(`
        INSERT INTO promo_codes (
          id, code, type, value, min_subtotal_cents, max_uses, used_count,
          active, expires_at, created_at, updated_at
        ) VALUES (
          $id, $code, $type, $value, $minSubtotalCents, $maxUses, $usedCount,
          $active, $expiresAt, $createdAt, $updatedAt
        )
      `)
      .run({
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: promo.value,
        minSubtotalCents: promo.minSubtotalCents,
        maxUses: promo.maxUses,
        usedCount: promo.usedCount,
        active: promo.active ? 1 : 0,
        expiresAt: promo.expiresAt,
        createdAt: promo.createdAt,
        updatedAt: promo.updatedAt,
      });
  }

  updatePromo(promo: PromoCode): void {
    this.db
      .query<unknown, StatementParams>(`
        UPDATE promo_codes SET
          code = $code, type = $type, value = $value,
          min_subtotal_cents = $minSubtotalCents, max_uses = $maxUses,
          active = $active, expires_at = $expiresAt, updated_at = $updatedAt
        WHERE id = $id
      `)
      .run({
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: promo.value,
        minSubtotalCents: promo.minSubtotalCents,
        maxUses: promo.maxUses,
        active: promo.active ? 1 : 0,
        expiresAt: promo.expiresAt,
        updatedAt: promo.updatedAt,
      });
  }

  deletePromo(id: string): boolean {
    const result = this.db
      .query<unknown, [string]>('DELETE FROM promo_codes WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  getEvents(orderId: string): OrderEvent[] {
    const rows = this.db
      .query<EventRow, [string]>(
        'SELECT status, label, detail, occurred_at FROM order_events WHERE order_id = ? ORDER BY id ASC',
      )
      .all(orderId);
    return rows.map((row) => ({
      status: row.status as OrderStatus,
      label: row.label,
      detail: row.detail,
      occurredAt: row.occurred_at,
    }));
  }

  private consumeStock(items: OrderItem[]): void {
    const overrides = new Map(
      this.listProductOverrides().map((entry) => [entry.productId, entry]),
    );
    const customProducts = new Map(
      this.listCustomProducts().map((entry) => [entry.id, entry]),
    );
    const updates = new Map<string, ProductOverride>();

    for (const item of items) {
      const base =
        PRODUCTS.find((product) => product.id === item.productId) ??
        customProducts.get(item.productId);
      if (!base) throw new StockError('That colorway is no longer available.');

      const current =
        updates.get(item.productId) ??
        overrides.get(item.productId) ?? {
          productId: item.productId,
          name: null,
          colorway: null,
          colorwaySlug: null,
          priceCents: null,
          image: null,
          imageFit: null,
          imageFilter: null,
          swatch: null,
          swatchInk: null,
          upper: null,
          sole: null,
          weightGrams: null,
          active: null,
          sizes: null,
          stock: null,
          description: null,
          updatedAt: new Date().toISOString(),
        };
      if (!(current.active ?? base.active)) {
        throw new StockError('That colorway is no longer available.');
      }

      const stock = { ...(current.stock ?? base.stock) };
      const size = String(item.size);
      const available = stock[size] ?? 0;

      if (item.quantity > available) {
        throw new StockError(
          available === 0
            ? `${base.colorway} in EU ${item.size} just sold out.`
            : `Only ${available} left in ${base.colorway} EU ${item.size}.`,
        );
      }

      stock[size] = available - item.quantity;
      updates.set(item.productId, {
        ...current,
        stock,
        updatedAt: new Date().toISOString(),
      });
    }

    for (const override of updates.values()) {
      this.saveProductOverride(override);
    }
  }

  insertOrderWithEvent(
    order: OrderRecord,
    event: OrderEvent,
    promoId: string | null = null,
  ): void {
    const insertOrder = this.db.prepare<unknown, StatementParams>(`
      INSERT INTO orders (
        id, tracking_hash, tracking_last4, tracking_code_enc, created_at, updated_at, status,
        customer_name, email, phone, address_line1, address_line2, city, state,
        postal_code, country, items_json, subtotal_cents, shipping_cents,
        discount_cents, promo_code, total_cents, currency, payment_method,
        payment_status, payment_reference, whatsapp_opt_in, ip, user_agent,
        estimated_delivery
      ) VALUES (
        $id, $trackingHash, $trackingLast4, $trackingCodeEnc, $createdAt, $updatedAt, $status,
        $customerName, $email, $phone, $addressLine1, $addressLine2, $city, $state,
        $postalCode, $country, $itemsJson, $subtotalCents, $shippingCents,
        $discountCents, $promoCode, $totalCents, $currency, $paymentMethod,
        $paymentStatus, $paymentReference, $whatsappOptIn, $ip, $userAgent,
        $estimatedDelivery
      )
    `);
    const insertEvent = this.db.prepare<unknown, StatementParams>(INSERT_EVENT_SQL);
    const consumePromo = this.db.prepare<
      unknown,
      { id: string; updatedAt: string; now: string }
    >(
      `UPDATE promo_codes
       SET used_count = used_count + 1, updated_at = $updatedAt
       WHERE id = $id
         AND active = 1
         AND (
           expires_at IS NULL
           OR strftime('%s', expires_at) > strftime('%s', $now)
         )
         AND (max_uses IS NULL OR used_count < max_uses)`,
    );

    const transaction = this.db.transaction(() => {
      this.consumeStock(order.items);
      insertOrder.run({
        id: order.id,
        trackingHash: order.trackingHash,
        trackingLast4: order.trackingLast4,
        trackingCodeEnc: order.trackingCodeEnc,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        customerName: order.customerName,
        email: order.email,
        phone: order.phone,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2,
        city: order.city,
        state: order.state,
        postalCode: order.postalCode,
        country: order.country,
        itemsJson: JSON.stringify(order.items),
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents,
        promoCode: order.promoCode,
        totalCents: order.totalCents,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        whatsappOptIn: order.whatsappOptIn ? 1 : 0,
        ip: order.ip,
        userAgent: order.userAgent,
        estimatedDelivery: order.estimatedDelivery,
      });
      insertEvent.run({
        orderId: order.id,
        status: event.status,
        label: event.label,
        detail: event.detail,
        occurredAt: event.occurredAt,
      });
      if (promoId) {
        const consumed = consumePromo.run({
          id: promoId,
          updatedAt: order.createdAt,
          now: order.createdAt,
        });
        if (consumed.changes === 0) {
          throw new PromoError('That code is no longer available.');
        }
      }
    });

    transaction();
  }

  updateStatusWithEvent(
    orderId: string,
    status: OrderStatus,
    updatedAt: string,
    event: OrderEvent,
  ): void {
    const update = this.db.prepare<unknown, StatementParams>(
      'UPDATE orders SET status = $status, updated_at = $updatedAt WHERE id = $id',
    );
    const insertEvent = this.db.prepare<unknown, StatementParams>(INSERT_EVENT_SQL);

    const transaction = this.db.transaction(() => {
      update.run({ id: orderId, status, updatedAt });
      insertEvent.run({
        orderId,
        status: event.status,
        label: event.label,
        detail: event.detail,
        occurredAt: event.occurredAt,
      });
    });

    transaction();
  }

  recordLookup(orderId: string, ip: string | null, userAgent: string | null, at: string): void {
    this.db
      .query<unknown, [string, string | null, string | null, string]>(
        'INSERT INTO order_lookups (order_id, ip, user_agent, looked_up_at) VALUES (?, ?, ?, ?)',
      )
      .run(orderId, ip, userAgent, at);
  }
}
