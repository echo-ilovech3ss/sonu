import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { formatPrice } from '../shared/catalog';
import type {
  CreateOrderResponse,
  WhatsAppClientStatus,
  WhatsAppSettings,
  WhatsAppStatus,
} from '../shared/types';
import type { OrderStore } from './db';
import { findProduct } from './products';
import type { CreateOrderData } from './validation';

const DEFAULTS: WhatsAppSettings = {
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  gatewayUrl: process.env.WHATSAPP_GATEWAY_URL?.trim() || 'http://127.0.0.1:10000',
  apiKey: process.env.WHATSAPP_GATEWAY_API_KEY?.trim() || '',
  clientId: process.env.WHATSAPP_CLIENT_ID?.trim() || '',
  senderLabel: process.env.WHATSAPP_SENDER_LABEL?.trim() || 'SONU',
};

const SETTING_KEYS = {
  enabled: 'whatsapp_enabled',
  gatewayUrl: 'whatsapp_gateway_url',
  apiKey: 'whatsapp_api_key',
  clientId: 'whatsapp_client_id',
  senderLabel: 'whatsapp_sender_label',
} as const;

function gatewayBase(settings: WhatsAppSettings): string {
  return settings.gatewayUrl.replace(/\/+$/, '');
}

export function getWhatsAppSettings(store: OrderStore): WhatsAppSettings {
  const stored = store.getSettings();
  return {
    enabled:
      stored[SETTING_KEYS.enabled] !== undefined
        ? stored[SETTING_KEYS.enabled] === 'true'
        : DEFAULTS.enabled,
    gatewayUrl: stored[SETTING_KEYS.gatewayUrl] ?? DEFAULTS.gatewayUrl,
    apiKey: stored[SETTING_KEYS.apiKey] ?? DEFAULTS.apiKey,
    clientId: stored[SETTING_KEYS.clientId] ?? DEFAULTS.clientId,
    senderLabel: stored[SETTING_KEYS.senderLabel] ?? DEFAULTS.senderLabel,
  };
}

export function updateWhatsAppSettings(
  store: OrderStore,
  patch: Partial<WhatsAppSettings>,
): WhatsAppSettings {
  const next = { ...getWhatsAppSettings(store), ...patch };
  store.setSettings({
    [SETTING_KEYS.enabled]: String(next.enabled),
    [SETTING_KEYS.gatewayUrl]: next.gatewayUrl.trim(),
    [SETTING_KEYS.apiKey]: next.apiKey.trim(),
    [SETTING_KEYS.clientId]: next.clientId.trim(),
    [SETTING_KEYS.senderLabel]: next.senderLabel.trim() || 'SONU',
  });
  return getWhatsAppSettings(store);
}

function mapClient(value: unknown): WhatsAppClientStatus | null {
  if (!value || typeof value !== 'object') return null;
  const client = value as Record<string, unknown>;
  if (typeof client.clientId !== 'string') return null;
  return {
    clientId: client.clientId,
    state: typeof client.state === 'string' ? client.state : 'UNKNOWN',
    authenticated: client.authenticated === true,
    qrCodeAvailable: client.qrCodeAvailable === true,
    qrBase64: typeof client.qrBase64 === 'string' ? client.qrBase64 : null,
    clientInfo:
      client.clientInfo && typeof client.clientInfo === 'object'
        ? (client.clientInfo as WhatsAppClientStatus['clientInfo'])
        : null,
  };
}

async function gatewayJson(
  settings: WhatsAppSettings,
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await fetch(`${gatewayBase(settings)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': settings.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { response, data };
}

export async function getWhatsAppStatus(
  store: OrderStore,
): Promise<WhatsAppStatus> {
  const settings = getWhatsAppSettings(store);
  if (!settings.gatewayUrl || !settings.apiKey) {
    return {
      ok: false,
      configured: false,
      error: 'Set the gateway URL and API key first.',
      clients: [],
    };
  }

  try {
    const path = settings.clientId
      ? `/status?clientId=${encodeURIComponent(settings.clientId)}`
      : '/status';
    const { response, data } = await gatewayJson(settings, path);
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        error:
          typeof data.error === 'string'
            ? data.error
            : `Gateway returned ${response.status}.`,
        clients: [],
      };
    }

    const rawClients = Array.isArray(data.clients)
      ? data.clients
      : data.clientId
        ? [data]
        : [];
    const clients = rawClients
      .map(mapClient)
      .filter((client): client is WhatsAppClientStatus => client !== null);

    return { ok: true, configured: true, error: null, clients };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error:
        error instanceof Error
          ? error.message
          : 'Could not reach the WhatsApp gateway.',
      clients: [],
    };
  }
}

export async function connectWhatsApp(
  store: OrderStore,
): Promise<WhatsAppStatus> {
  const settings = getWhatsAppSettings(store);
  if (!settings.clientId) {
    return {
      ok: false,
      configured: false,
      error: 'Set the 10-digit WhatsApp account number first.',
      clients: [],
    };
  }

  try {
    const { response, data } = await gatewayJson(settings, '/register', {
      method: 'POST',
      body: JSON.stringify({ clientId: settings.clientId }),
    });
    if (!response.ok && response.status !== 400) {
      return {
        ok: false,
        configured: true,
        error:
          typeof data.error === 'string'
            ? data.error
            : `Gateway returned ${response.status}.`,
        clients: [],
      };
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error:
        error instanceof Error
          ? error.message
          : 'Could not start the WhatsApp session.',
      clients: [],
    };
  }

  return getWhatsAppStatus(store);
}

export async function disconnectWhatsApp(
  store: OrderStore,
): Promise<WhatsAppStatus> {
  const settings = getWhatsAppSettings(store);
  if (!settings.clientId) {
    return {
      ok: false,
      configured: false,
      error: 'No WhatsApp account is configured.',
      clients: [],
    };
  }

  try {
    await gatewayJson(settings, '/disconnect', {
      method: 'POST',
      body: JSON.stringify({ clientId: settings.clientId }),
    });
  } catch {
    // The status request below reports the live state.
  }

  return getWhatsAppStatus(store);
}

function normalizePhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

function imagePayload(image: string): {
  mediaBase64: string;
  mimetype: string;
  filename: string;
} | null {
  if (!image.startsWith('/')) return null;

  const publicRoot = resolve(process.cwd(), 'public');
  const filePath = resolve(publicRoot, image.replace(/^\/+/, ''));
  if (!filePath.startsWith(`${publicRoot}${sep}`) || !existsSync(filePath)) {
    return null;
  }

  const extension = extname(filePath).slice(1).toLowerCase();
  const mimetype =
    extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'webp'
          ? 'image/webp'
          : null;
  if (!mimetype) return null;

  return {
    mediaBase64: readFileSync(filePath).toString('base64'),
    mimetype,
    filename: `sonu-${Date.now()}.${extension}`,
  };
}

function buildOrderMessage(
  store: OrderStore,
  input: CreateOrderData,
  response: CreateOrderResponse,
): string {
  const lines = input.items.map((item) => {
    const product = findProduct(store, item.productId);
    return `• ${product?.name ?? 'SONU'} / ${product?.colorway ?? 'Pair'} / EU ${item.size} × ${item.quantity}`;
  });
  const baseUrl = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8787').replace(
    /\/+$/,
    '',
  );
  const firstName = input.customer.name.trim().split(/\s+/)[0] || 'there';
  const payment =
    response.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online';
  const delivery = new Date(response.estimatedDelivery);
  const deliveryLabel = Number.isNaN(delivery.getTime())
    ? response.estimatedDelivery
    : delivery.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });

  return [
    `SONU / order confirmed`,
    `Hi ${firstName}, your pair is reserved.`,
    '',
    ...lines,
    '',
    `Total: ${formatPrice(response.totalCents)}`,
    `Payment: ${payment}`,
    `Delivery: ${deliveryLabel}`,
    '',
    `Tracking code: ${response.trackingCode}`,
    `Track: ${baseUrl}${response.lookupUrl}`,
    '',
    'No account needed. Keep this code.',
  ].join('\n');
}

export async function sendOrderWhatsApp(
  store: OrderStore,
  input: CreateOrderData,
  response: CreateOrderResponse,
): Promise<void> {
  const settings = getWhatsAppSettings(store);
  const phone = input.customer.phone;
  if (!settings.enabled || !phone || input.whatsappOptIn === false) return;

  const number = normalizePhone(phone);
  if (!number) {
    console.warn('[WhatsApp] Order phone could not be normalized:', phone);
    return;
  }
  if (!settings.gatewayUrl || !settings.apiKey || !settings.clientId) {
    console.warn('[WhatsApp] Gateway is not fully configured; skipping send.');
    return;
  }

  const message = buildOrderMessage(store, input, response);
  const firstProduct = findProduct(store, input.items[0].productId);
  const media = firstProduct ? imagePayload(firstProduct.image) : null;
  const body = {
    clientId: settings.clientId,
    number,
    message,
    ...(media ?? {}),
  };

  try {
    const { response: gatewayResponse, data } = await gatewayJson(
      settings,
      '/send',
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (gatewayResponse.ok && data.success !== false) {
      if (data.status === 'HOLD') {
        console.warn(
          `[WhatsApp] ${response.trackingCode} queued until the account is linked.`,
        );
      }
      return;
    }

    console.error(
      `[WhatsApp] ${response.trackingCode} failed:`,
      typeof data.error === 'string' ? data.error : gatewayResponse.status,
    );

    if (media) {
      const fallback = await gatewayJson(settings, '/send', {
        method: 'POST',
        body: JSON.stringify({
          clientId: settings.clientId,
          number,
          message,
        }),
      });
      if (!fallback.response.ok || fallback.data.success === false) {
        console.error(
          `[WhatsApp] ${response.trackingCode} text fallback failed.`,
        );
      }
    }
  } catch (error) {
    console.error(
      `[WhatsApp] ${response.trackingCode} could not reach the gateway:`,
      error,
    );
  }
}
