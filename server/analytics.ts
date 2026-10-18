import type {
  AnalyticsBuyerRow,
  AnalyticsGeoRow,
  AnalyticsProductRow,
  AnalyticsSummary,
} from '../shared/types';
import type { OrderStore } from './db';
import { listProducts } from './products';
import { decryptTrackingCode } from './security';

export function getAnalytics(store: OrderStore): AnalyticsSummary {
  const orders = store.listOrders(2_000);
  const products = listProducts(store, true);
  const viewCounts = new Map(
    store.listProductViewCounts().map((row) => [row.productId, row.views]),
  );

  const purchases = new Map<
    string,
    { purchased: number; revenueCents: number }
  >();
  for (const order of orders) {
    for (const item of order.items) {
      const current = purchases.get(item.productId) ?? {
        purchased: 0,
        revenueCents: 0,
      };
      current.purchased += item.quantity;
      current.revenueCents += item.unitPriceCents * item.quantity;
      purchases.set(item.productId, current);
    }
  }

  const topProducts: AnalyticsProductRow[] = products
    .map((product) => {
      const purchase = purchases.get(product.id);
      return {
        productId: product.id,
        name: product.name,
        colorway: product.colorway,
        views: viewCounts.get(product.id) ?? 0,
        purchased: purchase?.purchased ?? 0,
        revenueCents: purchase?.revenueCents ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.views - a.views ||
        b.purchased - a.purchased ||
        b.revenueCents - a.revenueCents,
    );

  const geo = new Map<
    string,
    { city: string; state: string; country: string; orders: number; revenueCents: number }
  >();
  for (const order of orders) {
    const key = `${order.city}|${order.state ?? ''}|${order.country}`;
    const current = geo.get(key) ?? {
      city: order.city,
      state: order.state ?? '',
      country: order.country,
      orders: 0,
      revenueCents: 0,
    };
    current.orders += 1;
    current.revenueCents += order.totalCents;
    geo.set(key, current);
  }

  const geography: AnalyticsGeoRow[] = [...geo.values()]
    .sort((a, b) => b.orders - a.orders || b.revenueCents - a.revenueCents)
    .slice(0, 30);

  const buyers: AnalyticsBuyerRow[] = orders.slice(0, 60).map((order) => ({
    orderId: order.id,
    trackingCode:
      decryptTrackingCode(order.trackingCodeEnc) ??
      `SNU-••••-${order.trackingLast4}`,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    hasPhone: Boolean(order.phone?.trim()),
    city: order.city,
    state: order.state,
    country: order.country,
    items: order.items,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    whatsappOptIn: order.whatsappOptIn,
    createdAt: order.createdAt,
  }));

  const totalViews = [...viewCounts.values()].reduce(
    (sum, views) => sum + views,
    0,
  );

  return {
    totals: {
      orders: orders.length,
      revenueCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
      productViews: totalViews,
      conversionRate:
        totalViews > 0
          ? Math.min(100, (orders.length / totalViews) * 100)
          : 0,
      phoneOrders: orders.filter((order) => Boolean(order.phone?.trim())).length,
      whatsappOptInOrders: orders.filter((order) => order.whatsappOptIn).length,
    },
    topProducts,
    geography,
    buyers,
    paymentSplit: {
      cod: orders.filter((order) => order.paymentMethod === 'cod').length,
      razorpay: orders.filter((order) => order.paymentMethod === 'razorpay')
        .length,
    },
  };
}
