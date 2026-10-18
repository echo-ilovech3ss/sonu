import { randomUUID } from 'node:crypto';
import { CURRENCY } from '../shared/catalog';
import { ORDER_STATUSES, STATUS_COPY } from '../shared/types';
import type {
  AdminOrder,
  CreateOrderResponse,
  OrderEvent,
  OrderItem,
  OrderStatus,
  PromoCode,
  PublicOrder,
  RazorpayIntent,
  StoreSettings,
} from '../shared/types';
import { toAdminOrder } from './admin';
import {
  PromoError,
  StockError,
  type OrderRecord,
  type OrderStore,
} from './db';
import { findProduct } from './products';
import { checkPromo } from './promos';
import {
  createRazorpayOrder,
  getRazorpayConfig,
  razorpayIsTestMode,
  RazorpayError,
  verifyRazorpayPayment,
} from './razorpay';
import {
  decryptTrackingCode,
  encryptTrackingCode,
  generateTrackingCode,
  hashTrackingCode,
  isValidTrackingCode,
  normalizeTrackingCode,
  trackingLast4,
} from './security';
import { getSettings } from './settings';
import type { CreateOrderData, PaymentIntentData } from './validation';

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export type AdvanceOrderResult =
  | { ok: true; order: PublicOrder }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid_transition'; currentStatus: OrderStatus };

const DELIVERY_DAYS = 5;

function addDays(isoTimestamp: string, days: number): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function publicCustomerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function buildItems(
  store: OrderStore,
  lines: CreateOrderData['items'],
): OrderItem[] {
  const requested = new Map<string, number>();
  for (const line of lines) {
    const key = `${line.productId}:${line.size}`;
    requested.set(key, (requested.get(key) ?? 0) + line.quantity);
  }

  return lines.map((line) => {
    const product = findProduct(store, line.productId);
    if (!product || !product.active) {
      throw new OrderError('That colorway is no longer available.');
    }

    const available = product.stock[String(line.size)] ?? 0;
    const wanted = requested.get(`${line.productId}:${line.size}`) ?? 0;
    if (wanted > available) {
      throw new OrderError(
        available === 0
          ? `${product.colorway} in EU ${line.size} is sold out.`
          : `Only ${available} left in ${product.colorway} EU ${line.size}.`,
      );
    }

    return {
      productId: product.id,
      name: product.name,
      colorway: product.colorway,
      size: line.size,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
      image: product.image,
    };
  });
}

function toPublicOrder(record: OrderRecord, events: OrderEvent[], trackingCode: string): PublicOrder {
  return {
    trackingCode,
    status: record.status,
    createdAt: record.createdAt,
    estimatedDelivery: record.estimatedDelivery,
    customerName: publicCustomerName(record.customerName),
    shippingCity: record.city,
    items: record.items,
    subtotalCents: record.subtotalCents,
    shippingCents: record.shippingCents,
    discountCents: record.discountCents,
    promoCode: record.promoCode,
    totalCents: record.totalCents,
    currency: record.currency,
    paymentMethod: record.paymentMethod,
    paymentStatus: record.paymentStatus,
    events,
  };
}

function uniqueTrackingCode(store: OrderStore): string {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateTrackingCode();
    if (!store.findOrderByTrackingHash(hashTrackingCode(code))) return code;
  }
  throw new Error('Unable to generate a unique tracking code');
}

interface PricedOrder {
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  promo: PromoCode | null;
  settings: StoreSettings;
}

function priceOrder(
  store: OrderStore,
  input: Pick<CreateOrderData, 'items' | 'promoCode'>,
): PricedOrder {
  const items = buildItems(store, input.items);
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const settings = getSettings(store);
  const freeShipping =
    settings.freeShippingThresholdCents > 0 &&
    subtotalCents >= settings.freeShippingThresholdCents;
  const shippingCents = freeShipping ? 0 : settings.shippingCents;

  let promo: PromoCode | null = null;
  let discountCents = 0;
  if (input.promoCode) {
    const check = checkPromo(store, input.promoCode, subtotalCents);
    if (!check.ok) throw new OrderError(check.error);
    promo = check.promo;
    discountCents = check.validation.discountCents;
  }

  return {
    items,
    subtotalCents,
    shippingCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents + shippingCents),
    promo,
    settings,
  };
}

function toCreateOrderResponse(
  record: OrderRecord,
  trackingCode: string,
): CreateOrderResponse {
  return {
    trackingCode,
    status: record.status,
    createdAt: record.createdAt,
    estimatedDelivery: record.estimatedDelivery,
    subtotalCents: record.subtotalCents,
    shippingCents: record.shippingCents,
    discountCents: record.discountCents,
    promoCode: record.promoCode,
    totalCents: record.totalCents,
    currency: record.currency,
    paymentMethod: record.paymentMethod,
    paymentStatus: record.paymentStatus,
    lookupUrl: `/track/${trackingCode}`,
  };
}

export async function createRazorpayIntent(
  store: OrderStore,
  input: PaymentIntentData,
): Promise<RazorpayIntent> {
  const priced = priceOrder(store, input);
  if (!priced.settings.onlineEnabled) {
    throw new OrderError('Online payments are paused. Please check back shortly.');
  }

  const config = getRazorpayConfig();
  if (!config) {
    throw new RazorpayError('Online payments are not configured.', 503);
  }

  const receipt = `sonu_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const gatewayOrder = await createRazorpayOrder({
    amount: priced.totalCents,
    receipt,
    notes: {
      store: 'SONU',
      receipt,
    },
  });

  return {
    keyId: config.keyId,
    razorpayOrderId: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: 'INR',
    receipt: gatewayOrder.receipt,
    storeName: priced.settings.storeName,
    description: 'The 01 / guest order',
    testMode: razorpayIsTestMode(config),
    prefill: {
      name: input.customer.name,
      email: input.customer.email,
      contact: input.customer.phone,
    },
  };
}

export async function createOrder(
  store: OrderStore,
  input: CreateOrderData,
  meta: RequestMeta,
): Promise<CreateOrderResponse> {
  const priced = priceOrder(store, input);

  let paymentStatus: 'cod' | 'paid' = 'cod';
  let paymentReference: string | null = null;

  if (input.paymentMethod === 'cod') {
    if (!priced.settings.codEnabled) {
      throw new OrderError('Pay on delivery is paused. Please check back shortly.');
    }
  } else {
    if (!priced.settings.onlineEnabled) {
      throw new OrderError('Online payments are paused. Please check back shortly.');
    }
    if (!input.payment) {
      throw new OrderError('Razorpay payment proof is required.');
    }

    const verified = await verifyRazorpayPayment(
      priced.totalCents,
      input.payment,
    );
    const existing = store.findOrderByPaymentReference(verified.paymentId);
    if (existing) {
      const existingCode = decryptTrackingCode(existing.trackingCodeEnc);
      if (existingCode) return toCreateOrderResponse(existing, existingCode);
      throw new OrderError('This payment is already linked to an order.');
    }
    paymentStatus = 'paid';
    paymentReference = verified.paymentId;
  }

  const trackingCode = uniqueTrackingCode(store);
  const createdAt = new Date().toISOString();
  const estimatedDelivery = addDays(createdAt, DELIVERY_DAYS);
  const confirmed = STATUS_COPY.confirmed;

  const order: OrderRecord = {
    id: randomUUID(),
    trackingHash: hashTrackingCode(trackingCode),
    trackingLast4: trackingLast4(trackingCode),
    trackingCodeEnc: encryptTrackingCode(trackingCode),
    createdAt,
    updatedAt: createdAt,
    status: 'confirmed',
    customerName: input.customer.name,
    email: input.customer.email,
    phone: input.customer.phone ?? null,
    addressLine1: input.shipping.addressLine1,
    addressLine2: input.shipping.addressLine2 ?? null,
    city: input.shipping.city,
    state: input.shipping.state ?? null,
    postalCode: input.shipping.postalCode,
    country: input.shipping.country,
    items: priced.items,
    subtotalCents: priced.subtotalCents,
    shippingCents: priced.shippingCents,
    discountCents: priced.discountCents,
    promoCode: priced.promo?.code ?? null,
    totalCents: priced.totalCents,
    currency: CURRENCY,
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paymentReference,
    whatsappOptIn: input.whatsappOptIn !== false,
    ip: meta.ip,
    userAgent: meta.userAgent,
    estimatedDelivery,
  };

  try {
    store.insertOrderWithEvent(
      order,
      {
        status: 'confirmed',
        label: confirmed.label,
        detail: confirmed.detail,
        occurredAt: createdAt,
      },
      priced.promo?.id ?? null,
    );
  } catch (error) {
    if (error instanceof StockError || error instanceof PromoError) {
      throw new OrderError(error.message);
    }
    throw error;
  }

  return toCreateOrderResponse(order, trackingCode);
}

export function lookupOrder(
  store: OrderStore,
  rawCode: string,
  meta: RequestMeta,
): PublicOrder | null {
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCode(trackingCode)) return null;

  const order = store.findOrderByTrackingHash(hashTrackingCode(trackingCode));
  if (!order) return null;

  try {
    store.recordLookup(order.id, meta.ip, meta.userAgent, new Date().toISOString());
  } catch (error) {
    // Lookup logging must never turn a valid tracking code into a 500.
    console.error('[sonu] lookup logging failed', error);
  }

  return toPublicOrder(order, store.getEvents(order.id), trackingCode);
}

export type AdvanceOrderByIdResult =
  | { ok: true; order: AdminOrder }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid_transition'; currentStatus: OrderStatus };

export function advanceOrderById(
  store: OrderStore,
  id: string,
  status: OrderStatus,
  detail?: string,
): AdvanceOrderByIdResult {
  const order = store.findOrderById(id);
  if (!order) return { ok: false, reason: 'not_found' };

  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const nextIndex = ORDER_STATUSES.indexOf(status);
  if (nextIndex !== currentIndex + 1) {
    return {
      ok: false,
      reason: 'invalid_transition',
      currentStatus: order.status,
    };
  }

  const occurredAt = new Date().toISOString();
  const copy = STATUS_COPY[status];
  store.updateStatusWithEvent(order.id, status, occurredAt, {
    status,
    label: copy.label,
    detail: detail && detail.length > 0 ? detail : copy.detail,
    occurredAt,
  });

  const updated = store.findOrderById(id);
  if (!updated) return { ok: false, reason: 'not_found' };
  return { ok: true, order: toAdminOrder(updated) };
}

export function advanceOrder(
  store: OrderStore,
  rawCode: string,
  status: OrderStatus,
  detail?: string,
): AdvanceOrderResult {
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCode(trackingCode)) return { ok: false, reason: 'not_found' };

  const trackingHash = hashTrackingCode(trackingCode);
  const order = store.findOrderByTrackingHash(trackingHash);
  if (!order) return { ok: false, reason: 'not_found' };

  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const nextIndex = ORDER_STATUSES.indexOf(status);
  if (nextIndex !== currentIndex + 1) {
    return { ok: false, reason: 'invalid_transition', currentStatus: order.status };
  }

  const occurredAt = new Date().toISOString();
  const copy = STATUS_COPY[status];
  store.updateStatusWithEvent(order.id, status, occurredAt, {
    status,
    label: copy.label,
    detail: detail && detail.length > 0 ? detail : copy.detail,
    occurredAt,
  });

  const updated = store.findOrderByTrackingHash(trackingHash);
  if (!updated) return { ok: false, reason: 'not_found' };

  return {
    ok: true,
    order: toPublicOrder(updated, store.getEvents(updated.id), trackingCode),
  };
}
