import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RazorpayPaymentProof } from '../shared/types';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  captured: boolean;
  method: string | null;
}

export class RazorpayError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'RazorpayError';
    this.status = status;
  }
}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function razorpayIsTestMode(config: RazorpayConfig): boolean {
  return config.keyId.startsWith('rzp_test_');
}

async function razorpayRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const config = getRazorpayConfig();
  if (!config) {
    throw new RazorpayError('Online payments are not configured.', 503);
  }

  const authorization = Buffer.from(
    `${config.keyId}:${config.keySecret}`,
    'utf8',
  ).toString('base64');

  let response: Response;
  try {
    response = await fetch(`${RAZORPAY_API}${path}`, {
      ...init,
      headers: {
        authorization: `Basic ${authorization}`,
        'content-type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new RazorpayError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The payment gateway timed out. Try again.'
        : 'The payment gateway could not be reached.',
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const errorPayload = payload as {
      error?: { description?: string };
    } | null;
    throw new RazorpayError(
      errorPayload?.error?.description ??
        'The payment gateway rejected the request.',
    );
  }

  return payload as T;
}

export function createRazorpayOrder(input: {
  amount: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
}

export function fetchRazorpayOrder(id: string): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>(`/orders/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export function fetchRazorpayPayment(id: string): Promise<RazorpayPayment> {
  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(id)}`,
    { method: 'GET' },
  );
}

export function captureRazorpayPayment(
  id: string,
  amount: number,
): Promise<RazorpayPayment> {
  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(id)}/capture`,
    {
      method: 'POST',
      body: JSON.stringify({ amount, currency: 'INR' }),
    },
  );
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const config = getRazorpayConfig();
  if (!config) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = createHmac('sha256', config.keySecret)
    .update(`${orderId}|${paymentId}`, 'utf8')
    .digest();
  const provided = Buffer.from(signature, 'hex');
  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

export async function verifyRazorpayPayment(
  expectedAmountCents: number,
  proof: RazorpayPaymentProof,
): Promise<{ paymentId: string; method: string | null }> {
  if (
    !verifyRazorpaySignature(
      proof.razorpayOrderId,
      proof.razorpayPaymentId,
      proof.razorpaySignature,
    )
  ) {
    throw new RazorpayError('The payment signature could not be verified.', 400);
  }

  const [order, payment] = await Promise.all([
    fetchRazorpayOrder(proof.razorpayOrderId),
    fetchRazorpayPayment(proof.razorpayPaymentId),
  ]);

  if (order.amount !== expectedAmountCents || order.currency !== 'INR') {
    throw new RazorpayError(
      'The paid amount does not match this order.',
      400,
    );
  }
  if (payment.order_id !== proof.razorpayOrderId) {
    throw new RazorpayError('The payment does not belong to this order.', 400);
  }
  if (payment.amount !== expectedAmountCents || payment.currency !== 'INR') {
    throw new RazorpayError(
      'The paid amount does not match this order.',
      400,
    );
  }

  let captured = payment;
  if (payment.status === 'authorized') {
    captured = await captureRazorpayPayment(payment.id, expectedAmountCents);
  }

  if (captured.status !== 'captured' || !captured.captured) {
    throw new RazorpayError(
      captured.status === 'failed'
        ? 'The payment failed. Nothing was charged.'
        : 'The payment has not been captured yet. Try again in a moment.',
      400,
    );
  }

  return { paymentId: captured.id, method: captured.method };
}
