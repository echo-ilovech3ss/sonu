import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { serveStatic } from 'hono/bun';
import type {
  ApiError,
  CreateOrderResponse,
  PublicOrder,
} from '../shared/types';
import { getAdminSummary, toAdminOrder } from './admin';
import { OrderStore } from './db';
import {
  OrderError,
  advanceOrder,
  advanceOrderById,
  createOrder,
  createRazorpayIntent,
  lookupOrder,
} from './orders';
import { FixedWindowLimiter } from './rate-limit';
import {
  getRazorpayConfig,
  razorpayIsTestMode,
  RazorpayError,
} from './razorpay';
import {
  createProduct,
  findProduct,
  listProducts,
  updateProduct,
} from './products';
import { getAnalytics } from './analytics';
import {
  checkPromo,
  createPromo,
  deletePromo,
  updatePromo,
} from './promos';
import {
  assertAdminKeyConfigured,
  getAdminKey,
  getClientIp,
  getUserAgent,
  isValidTrackingCode,
  normalizeTrackingCode,
  safeCompare,
} from './security';
import { getSettings, updateSettings } from './settings';
import {
  parseCreateOrderInput,
  parseCreateProductInput,
  parseProductUpdateInput,
  parsePromoInput,
  parsePaymentIntentInput,
  parsePromoValidationInput,
  parseSettingsInput,
  parseUpdateStatusInput,
  parseWhatsAppSettingsInput,
} from './validation';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppSettings,
  getWhatsAppStatus,
  sendOrderWhatsApp,
  updateWhatsAppSettings,
} from './whatsapp';

const MAX_BODY_BYTES = 32 * 1024;
const ORDER_WINDOW_MS = 10 * 60 * 1000;
const LOOKUP_WINDOW_MS = 60 * 1000;
const ADMIN_WINDOW_MS = 60 * 1000;

type JsonReadResult = { ok: true; value: unknown } | { ok: false };

function unknownProductDetails(
  store: OrderStore,
  items: Array<{ productId: string }>,
): Record<string, string[]> | null {
  const known = new Set(listProducts(store, true).map((product) => product.id));
  const index = items.findIndex((item) => !known.has(item.productId));
  if (index < 0) return null;
  return {
    [`items.${index}.productId`]: [
      `Unknown product: ${items[index].productId}`,
    ],
  };
}

async function readJson(c: Context): Promise<JsonReadResult> {
  try {
    return { ok: true, value: await c.req.json() };
  } catch {
    return { ok: false };
  }
}

function rejectWrite(c: Context): Response | null {
  const site = c.req.header('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
    return c.json<ApiError>({ error: 'Cross-site requests are not allowed' }, 403);
  }

  const contentType = c.req.header('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return c.json<ApiError>({ error: 'Content-Type must be application/json' }, 415);
  }

  const length = Number(c.req.header('content-length') ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return c.json<ApiError>({ error: 'Request body is too large' }, 413);
  }

  return null;
}

function tooMany(c: Context, retryAfterSeconds: number): Response {
  c.header('retry-after', String(retryAfterSeconds));
  return c.json<ApiError>({ error: 'Too many requests. Try again shortly.' }, 429);
}

export type SonuApp = Hono;

export function createApp(store: OrderStore): SonuApp {
  const app = new Hono();
  const orderLimiter = new FixedWindowLimiter(60, ORDER_WINDOW_MS);
  const lookupLimiter = new FixedWindowLimiter(300, LOOKUP_WINDOW_MS);
  const adminLimiter = new FixedWindowLimiter(60, ADMIN_WINDOW_MS);
  const promoLimiter = new FixedWindowLimiter(120, LOOKUP_WINDOW_MS);
  const paymentLimiter = new FixedWindowLimiter(30, ORDER_WINDOW_MS);
  const analyticsLimiter = new FixedWindowLimiter(180, 60_000);

  app.use('*', async (c, next) => {
    await next();
    c.header('x-content-type-options', 'nosniff');
    c.header('x-frame-options', 'DENY');
    c.header('referrer-policy', 'strict-origin-when-cross-origin');
    c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    c.header(
      'content-security-policy',
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://checkout.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    );
    if (process.env.NODE_ENV === 'production') {
      c.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    if (c.req.path.startsWith('/api/')) {
      c.header('cache-control', 'no-store');
    }
    if (
      c.req.path.startsWith('/track/') ||
      c.req.path.startsWith('/api/orders/') ||
      c.req.path.startsWith('/admin')
    ) {
      c.header('x-robots-tag', 'noindex, nofollow');
    }
  });

  app.use('/api/admin/*', async (c, next) => {
    const ip = getClientIp(c) ?? 'unknown';
    if (!adminLimiter.take(ip)) {
      return tooMany(c, Math.ceil(ADMIN_WINDOW_MS / 1000));
    }

    const providedKey = c.req.header('x-admin-key');
    if (!providedKey || !safeCompare(providedKey, getAdminKey())) {
      return c.json<ApiError>({ error: 'Unauthorized' }, 401);
    }

    await next();
  });

  app.get('/api/health', (c) => {
    try {
      const healthy = store.ping();
      return c.json(
        healthy ? { ok: true, db: 'ok' } : { ok: false, db: 'error' },
        healthy ? 200 : 503,
      );
    } catch {
      return c.json({ ok: false, db: 'error' }, 503);
    }
  });

  app.get('/api/products', (c) => c.json(listProducts(store)));

  app.post('/api/analytics/view', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const ip = getClientIp(c) ?? 'unknown';
    if (!analyticsLimiter.take(ip)) {
      return tooMany(c, 60);
    }

    const body = await readJson(c);
    if (!body.ok || typeof body.value !== 'object' || body.value === null) {
      return c.json<ApiError>({ error: 'Invalid view' }, 400);
    }
    const productId = (body.value as { productId?: unknown }).productId;
    if (typeof productId !== 'string' || !findProduct(store, productId)) {
      return c.json<ApiError>({ error: 'Unknown product' }, 404);
    }

    store.recordProductView(productId, getClientIp(c), getUserAgent(c));
    return c.json({ ok: true }, 202);
  });

  app.get('/api/settings', (c) => c.json(getSettings(store)));

  app.get('/api/payments/config', (c) => {
    const settings = getSettings(store);
    const config = getRazorpayConfig();
    return c.json({
      razorpay: {
        enabled: settings.onlineEnabled && Boolean(config),
        keyId: config?.keyId ?? null,
        testMode: config ? razorpayIsTestMode(config) : false,
      },
    });
  });

  app.post('/api/payments/razorpay/intent', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const ip = getClientIp(c) ?? 'unknown';
    if (!paymentLimiter.take(ip)) {
      return tooMany(c, Math.ceil(ORDER_WINDOW_MS / 1000));
    }

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parsePaymentIntentInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid payment intent', details: parsed.details },
        400,
      );
    }

    const unknown = unknownProductDetails(store, parsed.data.items);
    if (unknown) {
      return c.json<ApiError>(
        { error: 'Invalid payment intent', details: unknown },
        400,
      );
    }

    try {
      return c.json(await createRazorpayIntent(store, parsed.data), 201);
    } catch (error) {
      if (error instanceof OrderError) {
        return c.json<ApiError>({ error: error.message }, 400);
      }
      if (error instanceof RazorpayError) {
        return c.json<ApiError>(
          { error: error.message },
          error.status === 400 ? 400 : 502,
        );
      }
      throw error;
    }
  });

  app.post('/api/promo/validate', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const ip = getClientIp(c) ?? 'unknown';
    if (!promoLimiter.take(ip)) {
      return tooMany(c, Math.ceil(LOOKUP_WINDOW_MS / 1000));
    }

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parsePromoValidationInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid promo check', details: parsed.details },
        400,
      );
    }

    const result = checkPromo(
      store,
      parsed.data.code,
      parsed.data.subtotalCents,
    );
    if (!result.ok) {
      return c.json<ApiError>({ error: result.error }, 400);
    }

    return c.json(result.validation);
  });

  app.post('/api/orders', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const ip = getClientIp(c) ?? 'unknown';
    if (!orderLimiter.take(ip)) {
      return tooMany(c, Math.ceil(ORDER_WINDOW_MS / 1000));
    }

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseCreateOrderInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>({ error: 'Invalid order', details: parsed.details }, 400);
    }

    const unknown = unknownProductDetails(store, parsed.data.items);
    if (unknown) {
      return c.json<ApiError>({ error: 'Invalid order', details: unknown }, 400);
    }

    try {
      const response = await createOrder(store, parsed.data, {
        ip: getClientIp(c),
        userAgent: getUserAgent(c),
      });
      void sendOrderWhatsApp(store, parsed.data, response);
      return c.json<CreateOrderResponse>(response, 201);
    } catch (error) {
      if (error instanceof OrderError) {
        return c.json<ApiError>({ error: error.message }, 400);
      }
      if (error instanceof RazorpayError) {
        return c.json<ApiError>(
          { error: error.message },
          error.status === 400 ? 400 : 502,
        );
      }
      throw error;
    }
  });

  app.get('/api/orders/:code', (c) => {
    const ip = getClientIp(c) ?? 'unknown';
    if (!lookupLimiter.take(ip)) {
      return tooMany(c, Math.ceil(LOOKUP_WINDOW_MS / 1000));
    }

    const code = normalizeTrackingCode(c.req.param('code'));
    if (!isValidTrackingCode(code)) {
      return c.json<ApiError>({ error: 'Order not found' }, 404);
    }

    const order = lookupOrder(store, code, {
      ip: getClientIp(c),
      userAgent: getUserAgent(c),
    });
    if (!order) {
      return c.json<ApiError>({ error: 'Order not found' }, 404);
    }
    return c.json<PublicOrder>(order);
  });

  app.get('/api/admin/summary', (c) => c.json(getAdminSummary(store)));

  app.get('/api/admin/analytics', (c) => c.json(getAnalytics(store)));

  app.get('/api/admin/orders', (c) => {
    const query = (c.req.query('q') ?? '').trim().toLowerCase();
    const status = c.req.query('status') ?? '';
    let orders = store.listOrders(500).map(toAdminOrder);

    if (query) {
      orders = orders.filter((order) =>
        [
          order.trackingCode,
          order.customerName,
          order.email,
          order.city,
        ].some((value) => value.toLowerCase().includes(query)),
      );
    }

    if (status) {
      orders = orders.filter((order) => order.status === status);
    }

    return c.json(orders);
  });

  app.get('/api/admin/products', (c) => c.json(listProducts(store, true)));

  app.post('/api/admin/products', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseCreateProductInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid product', details: parsed.details },
        400,
      );
    }

    return c.json(createProduct(store, parsed.data), 201);
  });

  app.patch('/api/admin/products/:id', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseProductUpdateInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid product update', details: parsed.details },
        400,
      );
    }

    const product = updateProduct(store, c.req.param('id'), parsed.data);
    if (!product) {
      return c.json<ApiError>({ error: 'Product not found' }, 404);
    }

    return c.json(product);
  });

  app.get('/api/admin/promo-codes', (c) => c.json(store.listPromoCodes()));

  app.post('/api/admin/promo-codes', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parsePromoInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid promo code', details: parsed.details },
        400,
      );
    }

    if (store.getPromoByCode(parsed.data.code)) {
      return c.json<ApiError>({ error: 'That code already exists' }, 409);
    }

    return c.json(createPromo(store, parsed.data), 201);
  });

  app.put('/api/admin/promo-codes/:id', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parsePromoInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid promo code', details: parsed.details },
        400,
      );
    }

    const existing = store.getPromoByCode(parsed.data.code);
    if (existing && existing.id !== c.req.param('id')) {
      return c.json<ApiError>({ error: 'That code already exists' }, 409);
    }

    const promo = updatePromo(store, c.req.param('id'), parsed.data);
    if (!promo) {
      return c.json<ApiError>({ error: 'Promo code not found' }, 404);
    }

    return c.json(promo);
  });

  app.delete('/api/admin/promo-codes/:id', (c) => {
    if (!deletePromo(store, c.req.param('id'))) {
      return c.json<ApiError>({ error: 'Promo code not found' }, 404);
    }
    return c.json({ ok: true });
  });

  app.get('/api/admin/whatsapp', (c) =>
    c.json(getWhatsAppSettings(store)),
  );

  app.put('/api/admin/whatsapp', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseWhatsAppSettingsInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid WhatsApp settings', details: parsed.details },
        400,
      );
    }

    return c.json(updateWhatsAppSettings(store, parsed.data));
  });

  app.get('/api/admin/whatsapp/status', async (c) =>
    c.json(await getWhatsAppStatus(store)),
  );

  app.post('/api/admin/whatsapp/connect', async (c) =>
    c.json(await connectWhatsApp(store)),
  );

  app.post('/api/admin/whatsapp/disconnect', async (c) =>
    c.json(await disconnectWhatsApp(store)),
  );

  app.get('/api/admin/settings', (c) => c.json(getSettings(store)));

  app.put('/api/admin/settings', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseSettingsInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid settings', details: parsed.details },
        400,
      );
    }

    return c.json(updateSettings(store, parsed.data));
  });

  app.post('/api/admin/orders/by-id/:id/status', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseUpdateStatusInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: 'Invalid status update', details: parsed.details },
        400,
      );
    }

    const result = advanceOrderById(
      store,
      c.req.param('id'),
      parsed.data.status,
      parsed.data.detail,
    );
    if (!result.ok) {
      if (result.reason === 'not_found') {
        return c.json<ApiError>({ error: 'Order not found' }, 404);
      }
      return c.json<ApiError>(
        {
          error: `Cannot move order from ${result.currentStatus} to ${parsed.data.status}`,
        },
        409,
      );
    }

    return c.json(result.order);
  });

  app.post('/api/admin/orders/:code/status', async (c) => {
    const rejected = rejectWrite(c);
    if (rejected) return rejected;

    const body = await readJson(c);
    if (!body.ok) {
      return c.json<ApiError>({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseUpdateStatusInput(body.value);
    if (!parsed.success) {
      return c.json<ApiError>({ error: 'Invalid status update', details: parsed.details }, 400);
    }

    const result = advanceOrder(store, c.req.param('code'), parsed.data.status, parsed.data.detail);
    if (!result.ok) {
      if (result.reason === 'not_found') {
        return c.json<ApiError>({ error: 'Order not found' }, 404);
      }
      return c.json<ApiError>(
        {
          error: `Cannot move order from ${result.currentStatus} to ${parsed.data.status}`,
        },
        409,
      );
    }

    return c.json<PublicOrder>(result.order);
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const shouldServeStatic =
    process.env.NODE_ENV === 'production' || existsSync(distIndex);

  if (shouldServeStatic) {
    app.use('*', serveStatic({ root: distDir }));
    app.get('*', async (c) => {
      if (
        c.req.path.startsWith('/api/') ||
        /\.[a-z0-9]+$/i.test(c.req.path)
      ) {
        return c.json<ApiError>({ error: 'Not found' }, 404);
      }
      const indexFile = Bun.file(distIndex);
      if (!(await indexFile.exists())) {
        return c.text('Not found', 404);
      }
      return c.html(await indexFile.text());
    });
  }

  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json<ApiError>({ error: 'Not found' }, 404);
    }
    return c.text('Not found', 404);
  });

  app.onError((error, c) => {
    console.error('[sonu] request failed', error);
    return c.json<ApiError>({ error: 'Internal server error' }, 500);
  });

  return app;
}

if (import.meta.main) {
  assertAdminKeyConfigured();

  const store = new OrderStore();
  const app = createApp(store);
  const port = Number(process.env.PORT ?? 8787);
  const hostname = process.env.HOST ?? '127.0.0.1';
  const server = Bun.serve({
    port,
    hostname,
    maxRequestBodySize: MAX_BODY_BYTES,
    fetch: app.fetch,
  });

  const shutdown = () => {
    server.stop();
    store.close();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  console.log(
    `SONU API listening on http://${hostname}:${port} (db: ${store.path})`,
  );
}
