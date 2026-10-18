import type {
  AdminOrder,
  AdminSummary,
  LowStockItem,
} from '../shared/types';
import type { OrderRecord, OrderStore } from './db';
import { listProducts } from './products';
import { decryptTrackingCode } from './security';

export function toAdminOrder(record: OrderRecord): AdminOrder {
  const code =
    decryptTrackingCode(record.trackingCodeEnc) ??
    `SNU-••••-${record.trackingLast4}`;

  return {
    id: record.id,
    trackingCode: code,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    customerName: record.customerName,
    email: record.email,
    phone: record.phone,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    country: record.country,
    items: record.items,
    subtotalCents: record.subtotalCents,
    shippingCents: record.shippingCents,
    discountCents: record.discountCents,
    promoCode: record.promoCode,
    totalCents: record.totalCents,
    paymentMethod: record.paymentMethod,
    paymentStatus: record.paymentStatus,
    paymentReference: record.paymentReference,
    estimatedDelivery: record.estimatedDelivery,
  };
}

export function getAdminSummary(store: OrderStore): AdminSummary {
  const orders = store.listOrders(500);
  const promos = store.listPromoCodes();
  const now = Date.now();

  const lowStock: LowStockItem[] = [];
  for (const product of listProducts(store, true)) {
    for (const size of product.sizes) {
      const quantity = product.stock[String(size)] ?? 0;
      if (quantity <= 3) {
        lowStock.push({
          productId: product.id,
          name: product.name,
          colorway: product.colorway,
          size,
          quantity,
        });
      }
    }
  }

  return {
    totalOrders: orders.length,
    openOrders: orders.filter((order) => order.status !== 'delivered').length,
    revenueCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
    activePromos: promos.filter(
      (promo) =>
        promo.active &&
        (!promo.expiresAt || new Date(promo.expiresAt).getTime() > now) &&
        (promo.maxUses === null || promo.usedCount < promo.maxUses),
    ).length,
    lowStock: lowStock.sort((a, b) => a.quantity - b.quantity).slice(0, 12),
    recentOrders: orders.slice(0, 5).map(toAdminOrder),
  };
}
