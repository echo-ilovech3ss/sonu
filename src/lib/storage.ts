export interface RecentOrder {
  code: string;
  createdAt: string;
  itemCount: number;
  totalCents: number;
}

const RECENT_ORDERS_KEY = 'sonu.recentOrders.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readRecentOrders(): RecentOrder[] {
  const orders = readJson<RecentOrder[]>(RECENT_ORDERS_KEY, []);
  if (!Array.isArray(orders)) return [];
  return orders.filter(
    (order) =>
      typeof order?.code === 'string' &&
      typeof order?.createdAt === 'string' &&
      typeof order?.itemCount === 'number' &&
      typeof order?.totalCents === 'number',
  );
}

export function rememberOrder(order: RecentOrder) {
  const existing = readRecentOrders();
  const next = [
    order,
    ...existing.filter((entry) => entry.code !== order.code),
  ].slice(0, 8);

  try {
    window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private browsing. The tracking code still works.
  }
}
