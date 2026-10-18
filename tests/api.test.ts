import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrderStore } from '../server/db';
import { createApp } from '../server/index';
import type { SonuApp } from '../server/index';
import { hashTrackingCode } from '../server/security';
import { STATUS_COPY } from '../shared/types';
import type {
  AdminOrder,
  CreateOrderInput,
  CreateOrderResponse,
  OrderItem,
  PublicOrder,
} from '../shared/types';

const TRACKING_PATTERN = /^SNU-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const ADMIN_KEY = 'sonu-dev';

let directory: string;
let dbPath: string;
let store: OrderStore;
let app: SonuApp;

function validInput(): CreateOrderInput {
  return {
    customer: {
      name: 'Arun Mehta',
      email: 'arun@example.com',
      phone: '+91 99999 00000',
    },
    shipping: {
      addressLine1: '12 Marine Drive',
      addressLine2: 'Flat 4B',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400002',
      country: 'India',
    },
    items: [{ productId: 'sonu-01-pool', size: 42, quantity: 2 }],
    paymentMethod: 'cod',
  };
}

function withRawDb<T>(fn: (db: Database) => T): T {
  const db = new Database(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function razorpaySignature(
  orderId: string,
  paymentId: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function postOrder(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return app.request('/api/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'user-agent': 'SonuTest/1.0',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function advance(
  code: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request(`/api/admin/orders/${code}/status`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SONU_ADMIN_KEY = ADMIN_KEY;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  directory = mkdtempSync(path.join(tmpdir(), 'sonu-api-test-'));
  dbPath = path.join(directory, 'sonu.sqlite');
  store = new OrderStore(dbPath);
  app = createApp(store);
});

afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('health and catalog', () => {
  test('health reports the database is ok', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: 'ok' });
  });

  test('products are served from the shared catalog', async () => {
    const response = await app.request('/api/products');
    expect(response.status).toBe(200);
    const products = (await response.json()) as Array<{ id: string; priceCents: number }>;
    expect(products.length).toBeGreaterThan(0);
    expect(products.map((product) => product.id)).toContain('sonu-01-pool');
  });
});

describe('order creation', () => {
  test('creates an order, returns a tracking code and persists request metadata', async () => {
    const response = await postOrder(validInput());
    expect(response.status).toBe(201);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');

    const body = (await response.json()) as CreateOrderResponse;
    expect(body.trackingCode).toMatch(TRACKING_PATTERN);
    expect(body.lookupUrl).toBe(`/track/${body.trackingCode}`);
    expect(body.status).toBe('confirmed');
    expect(body.currency).toBe('INR');
    expect(body.totalCents).toBe(1_780_000);

    const expectedDelivery = new Date(body.createdAt);
    expectedDelivery.setUTCDate(expectedDelivery.getUTCDate() + 5);
    expect(body.estimatedDelivery).toBe(expectedDelivery.toISOString().slice(0, 10));

    withRawDb((db) => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(orders)')
        .all()
        .map((column) => column.name);
      expect(columns).not.toContain('tracking_code');
      expect(columns).toContain('tracking_hash');

      const row = db
        .query<
          {
            tracking_hash: string;
            tracking_last4: string;
            ip: string | null;
            user_agent: string | null;
            status: string;
            total_cents: number;
          },
          []
        >('SELECT tracking_hash, tracking_last4, ip, user_agent, status, total_cents FROM orders')
        .get();
      expect(row).not.toBeNull();
      expect(row!.tracking_hash).toBe(hashTrackingCode(body.trackingCode));
      expect(row!.tracking_hash).toHaveLength(64);
      expect(row!.tracking_hash).not.toContain(body.trackingCode);
      expect(row!.tracking_last4).toBe(body.trackingCode.slice(-4));
      expect(row!.ip).toBe('203.0.113.7');
      expect(row!.user_agent).toBe('SonuTest/1.0');
      expect(row!.status).toBe('confirmed');
      expect(row!.total_cents).toBe(1_780_000);

      const event = db
        .query<{ status: string; label: string; detail: string; occurred_at: string }, []>(
          'SELECT status, label, detail, occurred_at FROM order_events',
        )
        .get();
      expect(event).toEqual({
        status: 'confirmed',
        label: STATUS_COPY.confirmed.label,
        detail: STATUS_COPY.confirmed.detail,
        occurred_at: body.createdAt,
      });
    });
  });

  test('requires a phone number so every buyer can be reached', async () => {
    const input = validInput();
    const response = await postOrder({
      ...input,
      customer: { name: input.customer.name, email: input.customer.email },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: string;
      details?: Record<string, string[]>;
    };
    expect(body.error).toBe('Invalid order');
    expect(JSON.stringify(body.details)).toContain('Phone');
  });

  test('ignores forged prices and recomputes totals from the catalog', async () => {
    const forged = {
      ...validInput(),
      subtotalCents: 1,
      shippingCents: 0,
      totalCents: 1,
      items: [
        {
          productId: 'sonu-01-tar',
          size: 41,
          quantity: 3,
          unitPriceCents: 1,
          priceCents: 1,
        },
      ],
    };

    const response = await postOrder(forged);
    expect(response.status).toBe(201);
    const body = (await response.json()) as CreateOrderResponse;
    expect(body.totalCents).toBe(2_670_000);

    withRawDb((db) => {
      const row = db
        .query<{ items_json: string; subtotal_cents: number; total_cents: number }, []>(
          'SELECT items_json, subtotal_cents, total_cents FROM orders',
        )
        .get();
      expect(row!.subtotal_cents).toBe(2_670_000);
      expect(row!.total_cents).toBe(2_670_000);
      const items = JSON.parse(row!.items_json) as OrderItem[];
      expect(items).toMatchObject([
        {
          productId: 'sonu-01-tar',
          name: 'The 01',
          colorway: 'Tar',
          size: 41,
          quantity: 3,
          unitPriceCents: 890_000,
        },
      ]);
    });
  });

  test('rejects unknown products and unavailable sizes', async () => {
    const unknownProduct = validInput();
    unknownProduct.items = [{ productId: 'not-a-shoe', size: 42, quantity: 1 }];
    const productResponse = await postOrder(unknownProduct);
    expect(productResponse.status).toBe(400);
    const productError = (await productResponse.json()) as {
      error: string;
      details: Record<string, string[]>;
    };
    expect(productError.details['items.0.productId']?.[0]).toContain('Unknown product');

    const badSize = validInput();
    badSize.items = [{ productId: 'sonu-01-pool', size: 99, quantity: 1 }];
    const sizeResponse = await postOrder(badSize);
    expect(sizeResponse.status).toBe(400);
    const sizeError = (await sizeResponse.json()) as { error: string };
    expect(sizeError.error).toContain('EU 99 is sold out');

    const emptyCart = validInput();
    emptyCart.items = [];
    expect((await postOrder(emptyCart)).status).toBe(400);

    const tooMany = validInput();
    tooMany.items = [{ productId: 'sonu-01-pool', size: 42, quantity: 6 }];
    expect((await postOrder(tooMany)).status).toBe(400);
  });

  test('rejects malformed JSON and non-cod payment methods', async () => {
    const malformed = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"customer":',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Invalid JSON body' });

    const response = await postOrder({ ...validInput(), paymentMethod: 'card' });
    expect(response.status).toBe(400);
  });

  test('rejects non-JSON, cross-site and oversized writes', async () => {
    const plain = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(validInput()),
    });
    expect(plain.status).toBe(415);

    const crossSite = await postOrder(validInput(), { 'sec-fetch-site': 'cross-site' });
    expect(crossSite.status).toBe(403);

    const oversized = await postOrder(validInput(), { 'content-length': '40000' });
    expect(oversized.status).toBe(413);
  });

  test('does not persist an invalid forwarded IP', async () => {
    const response = await postOrder(validInput(), {
      'x-forwarded-for': 'not-an-ip',
      'x-real-ip': 'x'.repeat(3007),
    });
    expect(response.status).toBe(201);

    withRawDb((db) => {
      const row = db
        .query<{ ip: string | null }, []>('SELECT ip FROM orders')
        .get();
      expect(row!.ip).toBeNull();
    });
  });

  test('rejects a non-Indian PIN or country', async () => {
    const spacedPin = validInput();
    spacedPin.shipping.postalCode = '400 002';
    expect((await postOrder(spacedPin)).status).toBe(400);

    const otherCountry = validInput();
    otherCountry.shipping.country = 'US';
    expect((await postOrder(otherCountry)).status).toBe(400);
  });

  test('falls back to cf-connecting-ip and x-real-ip in that order', async () => {
    const cloudflare = await app.request('/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.44',
        'x-real-ip': '192.0.2.55',
        'user-agent': 'CFTest/1.0',
      },
      body: JSON.stringify(validInput()),
    });
    expect(cloudflare.status).toBe(201);
    const cloudflareBody = (await cloudflare.json()) as CreateOrderResponse;

    const realIp = await app.request('/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '192.0.2.66',
        'user-agent': 'RealIpTest/1.0',
      },
      body: JSON.stringify(validInput()),
    });
    expect(realIp.status).toBe(201);
    const realIpBody = (await realIp.json()) as CreateOrderResponse;

    withRawDb((db) => {
      const cloudflareHash = hashTrackingCode(cloudflareBody.trackingCode);
      const realIpHash = hashTrackingCode(realIpBody.trackingCode);
      const rows = db
        .query<{ tracking_hash: string; ip: string | null }, [string, string]>(
          'SELECT tracking_hash, ip FROM orders WHERE tracking_hash IN (?, ?)',
        )
        .all(cloudflareHash, realIpHash);
      expect(rows.find((row) => row.tracking_hash === cloudflareHash)?.ip).toBe('192.0.2.44');
      expect(rows.find((row) => row.tracking_hash === realIpHash)?.ip).toBe('192.0.2.66');
    });
  });
});

describe('public tracking lookup', () => {
  test('returns a public order without address, email, phone or IP', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    const response = await app.request(`/api/orders/${created.trackingCode.toLowerCase()}`, {
      headers: {
        'x-forwarded-for': '198.51.100.9',
        'user-agent': 'LookupAgent/2.0',
      },
    });
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).not.toContain('arun@example.com');
    expect(text).not.toContain('12 Marine Drive');
    expect(text).not.toContain('Flat 4B');
    expect(text).not.toContain('+91 99999 00000');
    expect(text).not.toContain('198.51.100.9');
    expect(text).not.toContain('"email"');
    expect(text).not.toContain('"addressLine1"');
    expect(text).not.toContain('"ip"');

    const order = JSON.parse(text) as PublicOrder;
    expect(order.trackingCode).toBe(created.trackingCode);
    expect(order.status).toBe('confirmed');
    expect(order.customerName).toBe('Arun M.');
    expect(order.shippingCity).toBe('Mumbai');
    expect(order.totalCents).toBe(1_780_000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].unitPriceCents).toBe(890_000);
    expect(order.events).toHaveLength(1);
    expect(order.events[0].status).toBe('confirmed');
  });

  test('logs every successful lookup with IP and user agent', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    await app.request(`/api/orders/${created.trackingCode}`, {
      headers: { 'x-forwarded-for': '198.51.100.9', 'user-agent': 'LookupAgent/2.0' },
    });
    await app.request(`/api/orders/${created.trackingCode}`, {
      headers: { 'x-forwarded-for': '198.51.100.10', 'user-agent': 'LookupAgent/3.0' },
    });

    withRawDb((db) => {
      const rows = db
        .query<{ ip: string | null; user_agent: string | null; looked_up_at: string }, []>(
          'SELECT ip, user_agent, looked_up_at FROM order_lookups ORDER BY id ASC',
        )
        .all();
      expect(rows).toHaveLength(2);
      expect(rows[0].ip).toBe('198.51.100.9');
      expect(rows[0].user_agent).toBe('LookupAgent/2.0');
      expect(rows[0].looked_up_at).toBeString();
      expect(rows[1].ip).toBe('198.51.100.10');
    });
  });

  test('returns 404 for unknown and malformed codes without logging', async () => {
    for (const code of ['SNU-0000-0000', 'not-a-code', 'SNU-ILOU-0000', 'SNU-1234']) {
      const response = await app.request(`/api/orders/${code}`, {
        headers: { 'x-forwarded-for': '198.51.100.11' },
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Order not found' });
    }

    withRawDb((db) => {
      const row = db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM order_lookups').get();
      expect(row!.count).toBe(0);
    });
  });
});

describe('admin status updates', () => {
  test('requires the admin key', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    const missing = await app.request(`/api/admin/orders/${created.trackingCode}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'packed' }),
    });
    expect(missing.status).toBe(401);

    const wrong = await advance(created.trackingCode, { status: 'packed' }, { 'x-admin-key': 'nope' });
    expect(wrong.status).toBe(401);

    const lookup = await app.request(`/api/orders/${created.trackingCode}`);
    const lookupBody = (await lookup.json()) as PublicOrder;
    expect(lookupBody.status).toBe('confirmed');
  });

  test('advances forward and appends events, using custom detail when provided', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    const packed = await advance(created.trackingCode, { status: 'packed' });
    expect(packed.status).toBe(200);
    const packedOrder = (await packed.json()) as PublicOrder;
    expect(packedOrder.status).toBe('packed');
    expect(packedOrder.events).toHaveLength(2);
    expect(packedOrder.events[1]).toEqual({
      status: 'packed',
      label: STATUS_COPY.packed.label,
      detail: STATUS_COPY.packed.detail,
      occurredAt: expect.any(String),
    });

    const shipped = await advance(created.trackingCode, {
      status: 'shipped',
      detail: 'Handed to Blue Dart',
    });
    expect(shipped.status).toBe(200);
    const shippedOrder = (await shipped.json()) as PublicOrder;
    expect(shippedOrder.status).toBe('shipped');
    expect(shippedOrder.events).toHaveLength(3);
    expect(shippedOrder.events[2].detail).toBe('Handed to Blue Dart');
    expect(shippedOrder.events[2].label).toBe(STATUS_COPY.shipped.label);

    withRawDb((db) => {
      const row = db
        .query<{ status: string; updated_at: string }, []>('SELECT status, updated_at FROM orders')
        .get();
      expect(row!.status).toBe('shipped');
      expect(row!.updated_at).toBeString();
      const eventCount = db
        .query<{ count: number }, []>('SELECT COUNT(*) AS count FROM order_events')
        .get();
      expect(eventCount!.count).toBe(3);
    });
  });

  test('rejects skipped transitions with 409', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    const skipped = await advance(created.trackingCode, { status: 'delivered' });
    expect(skipped.status).toBe(409);

    const packed = await advance(created.trackingCode, { status: 'packed' });
    expect(packed.status).toBe(200);
  });

  test('rejects backward and repeated transitions with 409', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;
    await advance(created.trackingCode, { status: 'packed' });
    await advance(created.trackingCode, { status: 'shipped' });

    const backward = await advance(created.trackingCode, { status: 'packed' });
    expect(backward.status).toBe(409);
    const backwardBody = (await backward.json()) as { error: string };
    expect(backwardBody.error).toContain('shipped');

    const repeated = await advance(created.trackingCode, { status: 'shipped' });
    expect(repeated.status).toBe(409);

    const current = await app.request(`/api/orders/${created.trackingCode}`);
    const currentBody = (await current.json()) as PublicOrder;
    expect(currentBody.status).toBe('shipped');
  });

  test('treats delivered as terminal', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered']) {
      expect((await advance(created.trackingCode, { status })).status).toBe(200);
    }

    const afterDelivery = await advance(created.trackingCode, { status: 'shipped' });
    expect(afterDelivery.status).toBe(409);

    const lookup = await app.request(`/api/orders/${created.trackingCode}`);
    const order = (await lookup.json()) as PublicOrder;
    expect(order.status).toBe('delivered');
    expect(order.events).toHaveLength(5);
    expect(order.events[4].label).toBe(STATUS_COPY.delivered.label);
  });

  test('validates the status body and unknown codes', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    const invalidStatus = await advance(created.trackingCode, { status: 'teleported' });
    expect(invalidStatus.status).toBe(400);

    const missingStatus = await advance(created.trackingCode, {});
    expect(missingStatus.status).toBe(400);

    const unknown = await advance('SNU-0000-0000', { status: 'packed' });
    expect(unknown.status).toBe(404);

    const malformed = await advance('nope', { status: 'packed' });
    expect(malformed.status).toBe(404);
  });
});

describe('stock, promos and settings', () => {
  async function adminRequest(pathname: string, init: RequestInit = {}) {
    return app.request(pathname, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-admin-key': ADMIN_KEY,
        ...init.headers,
      },
    });
  }

  test('decrements stock inside the order transaction', async () => {
    const before = (await (await app.request('/api/products')).json()) as Array<{
      id: string;
      stock: Record<string, number>;
    }>;
    const poolBefore = before.find((product) => product.id === 'sonu-01-pool')!;
    expect(poolBefore.stock['42']).toBe(12);

    const response = await postOrder(validInput());
    expect(response.status).toBe(201);

    const after = (await (await app.request('/api/products')).json()) as Array<{
      id: string;
      stock: Record<string, number>;
    }>;
    expect(
      after.find((product) => product.id === 'sonu-01-pool')!.stock['42'],
    ).toBe(10);
  });

  test('rejects a size after the studio sets it to zero', async () => {
    const current = (await (await app.request('/api/products')).json()) as Array<{
      id: string;
      stock: Record<string, number>;
    }>;
    const pool = current.find((product) => product.id === 'sonu-01-pool')!;
    const stock = { ...pool.stock, '41': 0 };

    const patch = await adminRequest('/api/admin/products/sonu-01-pool', {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    });
    expect(patch.status).toBe(200);

    const soldOut = validInput();
    soldOut.items = [{ productId: 'sonu-01-pool', size: 41, quantity: 1 }];
    const response = await postOrder(soldOut);
    expect(response.status).toBe(400);
    const errorBody = (await response.json()) as { error: string };
    expect(errorBody.error).toContain('sold out');
  });

  test('validates, applies and consumes a one-use promo', async () => {
    const created = await adminRequest('/api/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify({
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minSubtotalCents: 0,
        maxUses: 1,
        active: true,
        expiresAt: null,
      }),
    });
    expect(created.status).toBe(201);

    const validation = await app.request('/api/promo/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'welcome10', subtotalCents: 890_000 }),
    });
    expect(validation.status).toBe(200);
    expect(await validation.json()).toMatchObject({
      code: 'WELCOME10',
      discountCents: 89_000,
    });

    const input = validInput();
    input.items = [{ productId: 'sonu-01-pool', size: 42, quantity: 1 }];
    input.promoCode = 'WELCOME10';
    const order = await postOrder(input);
    expect(order.status).toBe(201);
    expect(await order.json()).toMatchObject({
      subtotalCents: 890_000,
      discountCents: 89_000,
      promoCode: 'WELCOME10',
      totalCents: 801_000,
    });

    const used = await postOrder(input);
    expect(used.status).toBe(400);
    const usedBody = (await used.json()) as { error: string };
    expect(usedBody.error).toContain('reached its limit');
  });

  test('protects admin reads and updates the public catalog', async () => {
    expect((await app.request('/api/admin/summary')).status).toBe(401);

    const summary = await adminRequest('/api/admin/summary');
    expect(summary.status).toBe(200);

    const patch = await adminRequest('/api/admin/products/sonu-01-chalk', {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    expect(patch.status).toBe(200);

    const publicProducts = (await (
      await app.request('/api/products')
    ).json()) as Array<{ id: string }>;
    expect(publicProducts.map((product) => product.id)).not.toContain(
      'sonu-01-chalk',
    );

    const adminProducts = (await (
      await adminRequest('/api/admin/products')
    ).json()) as Array<{ id: string; active: boolean }>;
    expect(
      adminProducts.find((product) => product.id === 'sonu-01-chalk')?.active,
    ).toBe(false);
  });

  test('aggregates views, buyers, geography and payment split', async () => {
    const view = await app.request('/api/analytics/view', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.9',
      },
      body: JSON.stringify({ productId: 'sonu-01-pool' }),
    });
    expect(view.status).toBe(202);
    await app.request('/api/analytics/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'sonu-01-pool' }),
    });
    const unknownView = await app.request('/api/analytics/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'not-a-shoe' }),
    });
    expect(unknownView.status).toBe(404);

    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;
    expect(created.status).toBe('confirmed');

    const analytics = await adminRequest('/api/admin/analytics');
    expect(analytics.status).toBe(200);
    const body = (await analytics.json()) as {
      totals: {
        orders: number;
        productViews: number;
        phoneOrders: number;
        whatsappOptInOrders: number;
      };
      topProducts: Array<{ productId: string; views: number; purchased: number }>;
      geography: Array<{ city: string; orders: number }>;
      buyers: Array<{ phone: string | null; whatsappOptIn: boolean; city: string }>;
      paymentSplit: { cod: number; razorpay: number };
    };

    expect(body.totals.orders).toBe(1);
    expect(body.totals.productViews).toBe(2);
    expect(body.totals.phoneOrders).toBe(1);
    expect(body.totals.whatsappOptInOrders).toBe(1);
    expect(
      body.topProducts.find((product) => product.productId === 'sonu-01-pool'),
    ).toMatchObject({ views: 2, purchased: 2 });
    expect(body.geography[0]).toMatchObject({ city: 'Mumbai', orders: 1 });
    expect(body.buyers[0]).toMatchObject({
      phone: '+91 99999 00000',
      whatsappOptIn: true,
      city: 'Mumbai',
    });
    expect(body.paymentSplit).toEqual({ cod: 1, razorpay: 0 });
  });

  test('pauses COD and promo use on the server, not only in the UI', async () => {
    const pauseCod = await adminRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ codEnabled: false }),
    });
    expect(pauseCod.status).toBe(200);

    const blockedOrder = await postOrder(validInput());
    expect(blockedOrder.status).toBe(400);
    const blockedBody = (await blockedOrder.json()) as { error: string };
    expect(blockedBody.error).toContain('paused');

    await adminRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ codEnabled: true, promosEnabled: false }),
    });
    await adminRequest('/api/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify({
        code: 'PAUSED10',
        type: 'percent',
        value: 10,
        minSubtotalCents: 0,
        maxUses: null,
        active: true,
        expiresAt: null,
      }),
    });

    const promoCheck = await app.request('/api/promo/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'PAUSED10', subtotalCents: 890_000 }),
    });
    expect(promoCheck.status).toBe(400);
    const promoBody = (await promoCheck.json()) as { error: string };
    expect(promoBody.error).toContain('paused');
  });

  test('accepts a size added through the studio', async () => {
    const patch = await adminRequest('/api/admin/products/sonu-01-pool', {
      method: 'PATCH',
      body: JSON.stringify({
        sizes: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46],
        stock: { '46': 2 },
      }),
    });
    expect(patch.status).toBe(200);

    const input = validInput();
    input.items = [{ productId: 'sonu-01-pool', size: 46, quantity: 1 }];
    const response = await postOrder(input);
    expect(response.status).toBe(201);

    const products = (await (await app.request('/api/products')).json()) as Array<{
      id: string;
      stock: Record<string, number>;
    }>;
    expect(
      products.find((product) => product.id === 'sonu-01-pool')!.stock['46'],
    ).toBe(1);
  });

  test('advances an order by id when its recovery code is unreadable', async () => {
    await postOrder(validInput());
    withRawDb((db) => {
      db.query("UPDATE orders SET tracking_code_enc = 'broken'").run();
    });

    const listed = (await (await adminRequest('/api/admin/orders')).json()) as AdminOrder[];
    const order = listed.find((entry) => entry.email === 'arun@example.com');
    expect(order).toBeDefined();
    expect(order!.trackingCode).toContain('••••');

    const advanced = await adminRequest(
      `/api/admin/orders/by-id/${order!.id}/status`,
      { method: 'POST', body: JSON.stringify({ status: 'packed' }) },
    );
    expect(advanced.status).toBe(200);
    const advancedBody = (await advanced.json()) as AdminOrder;
    expect(advancedBody.status).toBe('packed');
  });

  test('serves Razorpay config and creates a payment intent', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/orders') && init?.method === 'POST') {
        return jsonResponse({
          id: 'order_test123',
          amount: 1_780_000,
          amount_paid: 0,
          amount_due: 1_780_000,
          currency: 'INR',
          receipt: 'sonu_test',
          status: 'created',
        });
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    }) as typeof fetch;

    try {
      const config = await app.request('/api/payments/config');
      expect(config.status).toBe(200);
      expect(await config.json()).toEqual({
        razorpay: {
          enabled: true,
          keyId: 'rzp_test_unit',
          testMode: true,
        },
      });

      const intent = await app.request('/api/payments/razorpay/intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...validInput(),
          paymentMethod: 'razorpay',
        }),
      });
      expect(intent.status).toBe(201);
      const intentBody = (await intent.json()) as {
        keyId: string;
        razorpayOrderId: string;
        amount: number;
        testMode: boolean;
      };
      expect(intentBody.keyId).toBe('rzp_test_unit');
      expect(intentBody.razorpayOrderId).toBe('order_test123');
      expect(intentBody.amount).toBe(1_780_000);
      expect(intentBody.testMode).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects a forged Razorpay signature without calling the gateway', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';

    const response = await postOrder({
      ...validInput(),
      paymentMethod: 'razorpay',
      payment: {
        razorpayOrderId: 'order_test123',
        razorpayPaymentId: 'pay_test123',
        razorpaySignature: '0'.repeat(64),
      },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('signature');
  });

  test('verifies a captured payment and creates one paid order', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const amount = 1_780_000;
    const signature = razorpaySignature(orderId, paymentId, 'unit-secret');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith(`/orders/${orderId}`)) {
        return jsonResponse({
          id: orderId,
          amount,
          amount_paid: amount,
          amount_due: 0,
          currency: 'INR',
          receipt: 'sonu_test',
          status: 'paid',
        });
      }
      if (url.endsWith(`/payments/${paymentId}`)) {
        return jsonResponse({
          id: paymentId,
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'captured',
          captured: true,
          method: 'card',
        });
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    }) as typeof fetch;

    try {
      const paidInput = {
        ...validInput(),
        paymentMethod: 'razorpay',
        payment: {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        },
      };

      const response = await postOrder(paidInput);
      expect(response.status).toBe(201);
      const created = (await response.json()) as CreateOrderResponse;
      expect(created.paymentStatus).toBe('paid');
      expect(created.paymentMethod).toBe('razorpay');

      const replay = await postOrder(paidInput);
      expect(replay.status).toBe(201);
      const replayed = (await replay.json()) as CreateOrderResponse;
      expect(replayed.trackingCode).toBe(created.trackingCode);

      const products = (await (await app.request('/api/products')).json()) as Array<{
        id: string;
        stock: Record<string, number>;
      }>;
      expect(
        products.find((product) => product.id === 'sonu-01-pool')!.stock['42'],
      ).toBe(10);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('captures an authorized payment before creating the order', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const amount = 1_780_000;
    const signature = razorpaySignature(orderId, paymentId, 'unit-secret');
    const originalFetch = globalThis.fetch;
    let captureCalls = 0;

    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/orders/${orderId}`)) {
        return jsonResponse({
          id: orderId,
          amount,
          amount_paid: 0,
          amount_due: amount,
          currency: 'INR',
          receipt: 'sonu_test',
          status: 'created',
        });
      }
      if (url.endsWith(`/payments/${paymentId}/capture`)) {
        captureCalls += 1;
        expect(init?.method).toBe('POST');
        return jsonResponse({
          id: paymentId,
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'captured',
          captured: true,
          method: 'card',
        });
      }
      if (url.endsWith(`/payments/${paymentId}`)) {
        return jsonResponse({
          id: paymentId,
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'authorized',
          captured: false,
          method: 'card',
        });
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    }) as typeof fetch;

    try {
      const response = await postOrder({
        ...validInput(),
        paymentMethod: 'razorpay',
        payment: {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        },
      });
      expect(response.status).toBe(201);
      const created = (await response.json()) as CreateOrderResponse;
      expect(created.paymentStatus).toBe('paid');
      expect(captureCalls).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects a payment that belongs to another Razorpay order', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const amount = 1_780_000;
    const signature = razorpaySignature(orderId, paymentId, 'unit-secret');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith(`/orders/${orderId}`)) {
        return jsonResponse({
          id: orderId,
          amount,
          amount_paid: amount,
          amount_due: 0,
          currency: 'INR',
          receipt: 'sonu_test',
          status: 'paid',
        });
      }
      if (url.endsWith(`/payments/${paymentId}`)) {
        return jsonResponse({
          id: paymentId,
          order_id: 'order_other',
          amount,
          currency: 'INR',
          status: 'captured',
          captured: true,
          method: 'card',
        });
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    }) as typeof fetch;

    try {
      const response = await postOrder({
        ...validInput(),
        paymentMethod: 'razorpay',
        payment: {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        },
      });
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: string }).error).toContain(
        'does not belong',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects a captured payment for the wrong amount', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
    process.env.RAZORPAY_KEY_SECRET = 'unit-secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const signature = razorpaySignature(orderId, paymentId, 'unit-secret');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith(`/orders/${orderId}`)) {
        return jsonResponse({
          id: orderId,
          amount: 100,
          amount_paid: 100,
          amount_due: 0,
          currency: 'INR',
          receipt: 'sonu_test',
          status: 'paid',
        });
      }
      if (url.endsWith(`/payments/${paymentId}`)) {
        return jsonResponse({
          id: paymentId,
          order_id: orderId,
          amount: 100,
          currency: 'INR',
          status: 'captured',
          captured: true,
          method: 'card',
        });
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    }) as typeof fetch;

    try {
      const response = await postOrder({
        ...validInput(),
        paymentMethod: 'razorpay',
        payment: {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        },
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('amount');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('updates public settings and prices delivery from them', async () => {
    const update = await adminRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        announcement: 'Studio note',
        shippingCents: 4_900,
        freeShippingThresholdCents: 0,
      }),
    });
    expect(update.status).toBe(200);

    const settings = (await (
      await app.request('/api/settings')
    ).json()) as { announcement: string; shippingCents: number };
    expect(settings.announcement).toBe('Studio note');
    expect(settings.shippingCents).toBe(4_900);

    const orderResponse = await postOrder(validInput());
    const order = (await orderResponse.json()) as CreateOrderResponse;
    expect(order.shippingCents).toBe(4_900);
    expect(order.totalCents).toBe(1_784_900);
  });
});

describe('persistence', () => {
  test('orders and events survive closing and reopening the store', async () => {
    const created = (await (await postOrder(validInput())).json()) as CreateOrderResponse;

    store.close();
    store = new OrderStore(dbPath);
    app = createApp(store);

    const response = await app.request(`/api/orders/${created.trackingCode}`);
    expect(response.status).toBe(200);
    const order = (await response.json()) as PublicOrder;
    expect(order.trackingCode).toBe(created.trackingCode);
    expect(order.totalCents).toBe(created.totalCents);
    expect(order.status).toBe('confirmed');
    expect(order.events).toHaveLength(1);
  });
});

describe('routing and errors', () => {
  test('returns JSON 404 for unknown API routes', async () => {
    const response = await app.request('/api/nope');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
