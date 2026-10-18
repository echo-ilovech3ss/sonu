import type { Product } from '../../shared/catalog';
import type {
  AdminOrder,
  AdminSummary,
  AnalyticsSummary,
  ApiError,
  CreateOrderInput,
  CreateOrderResponse,
  CreateProductInput,
  OrderStatus,
  ProductUpdate,
  PromoCode,
  PromoCodeInput,
  PromoValidation,
  PublicOrder,
  RazorpayIntent,
  StoreSettings,
  WhatsAppSettings,
  WhatsAppStatus,
} from '../../shared/types';

export interface PaymentConfig {
  razorpay: {
    enabled: boolean;
    keyId: string | null;
    testMode: boolean;
  };
}

export class ApiRequestError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiError
    | null;

  if (!response.ok) {
    const error = payload as ApiError | null;
    throw new ApiRequestError(
      error?.error ?? 'Something went wrong. Try again.',
      response.status,
      error?.details,
    );
  }

  return payload as T;
}

export function fetchProducts() {
  return request<Product[]>('/api/products');
}

export function fetchSettings() {
  return request<StoreSettings>('/api/settings');
}

export function fetchPaymentConfig() {
  return request<PaymentConfig>('/api/payments/config');
}

export function createRazorpayIntent(input: CreateOrderInput) {
  return request<RazorpayIntent>('/api/payments/razorpay/intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function validatePromo(code: string, subtotalCents: number) {
  return request<PromoValidation>('/api/promo/validate', {
    method: 'POST',
    body: JSON.stringify({ code, subtotalCents }),
  });
}

export function createOrder(input: CreateOrderInput) {
  return request<CreateOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchOrder(code: string) {
  return request<PublicOrder>(`/api/orders/${encodeURIComponent(code)}`);
}

export function normalizeTrackingCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function trackingCodeIsValid(value: string): boolean {
  return /^SNU-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}

async function adminRequest<T>(
  path: string,
  key: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': key,
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiError
    | null;

  if (!response.ok) {
    const error = payload as ApiError | null;
    throw new ApiRequestError(
      error?.error ?? 'Something went wrong. Try again.',
      response.status,
      error?.details,
    );
  }

  return payload as T;
}

export function adminSummary(key: string) {
  return adminRequest<AdminSummary>('/api/admin/summary', key);
}

export function adminAnalytics(key: string) {
  return adminRequest<AnalyticsSummary>('/api/admin/analytics', key);
}

export function adminOrders(key: string, query = '', status = '') {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (status) params.set('status', status);
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return adminRequest<AdminOrder[]>(`/api/admin/orders${suffix}`, key);
}

export function adminAdvanceOrder(
  key: string,
  id: string,
  status: OrderStatus,
  detail?: string,
) {
  return adminRequest<AdminOrder>(
    `/api/admin/orders/by-id/${encodeURIComponent(id)}/status`,
    key,
    {
      method: 'POST',
      body: JSON.stringify({ status, detail }),
    },
  );
}

export function adminProducts(key: string) {
  return adminRequest<Product[]>('/api/admin/products', key);
}

export function adminCreateProduct(key: string, input: CreateProductInput) {
  return adminRequest<Product>('/api/admin/products', key, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function adminUpdateProduct(
  key: string,
  id: string,
  update: ProductUpdate,
) {
  return adminRequest<Product>(`/api/admin/products/${encodeURIComponent(id)}`, key, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export function adminPromoCodes(key: string) {
  return adminRequest<PromoCode[]>('/api/admin/promo-codes', key);
}

export function adminCreatePromo(key: string, input: PromoCodeInput) {
  return adminRequest<PromoCode>('/api/admin/promo-codes', key, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function adminUpdatePromo(
  key: string,
  id: string,
  input: PromoCodeInput,
) {
  return adminRequest<PromoCode>(
    `/api/admin/promo-codes/${encodeURIComponent(id)}`,
    key,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function adminDeletePromo(key: string, id: string) {
  return adminRequest<{ ok: boolean }>(
    `/api/admin/promo-codes/${encodeURIComponent(id)}`,
    key,
    { method: 'DELETE' },
  );
}

export function adminSettings(key: string) {
  return adminRequest<StoreSettings>('/api/admin/settings', key);
}

export function adminWhatsApp(key: string) {
  return adminRequest<WhatsAppSettings>('/api/admin/whatsapp', key);
}

export function adminUpdateWhatsApp(
  key: string,
  update: Partial<WhatsAppSettings>,
) {
  return adminRequest<WhatsAppSettings>('/api/admin/whatsapp', key, {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}

export function adminWhatsAppStatus(key: string) {
  return adminRequest<WhatsAppStatus>('/api/admin/whatsapp/status', key);
}

export function adminConnectWhatsApp(key: string) {
  return adminRequest<WhatsAppStatus>('/api/admin/whatsapp/connect', key, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function adminDisconnectWhatsApp(key: string) {
  return adminRequest<WhatsAppStatus>('/api/admin/whatsapp/disconnect', key, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function adminUpdateSettings(
  key: string,
  settings: Partial<StoreSettings>,
) {
  return adminRequest<StoreSettings>('/api/admin/settings', key, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
