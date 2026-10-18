import type { RazorpayIntent, RazorpayPaymentProof } from '../../shared/types';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: {
    description?: string;
  };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact?: string;
  };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  scriptPromise = promise;
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => {
    scriptPromise = null;
    reject(new Error('The payment window could not be loaded.'));
  };
  document.head.appendChild(script);

  return promise;
}

export async function openRazorpayCheckout(
  intent: RazorpayIntent,
): Promise<RazorpayPaymentProof> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    throw new Error('The payment window could not be loaded.');
  }

  const { promise, resolve, reject } =
    Promise.withResolvers<RazorpayPaymentProof>();
  const checkout = new Razorpay({
    key: intent.keyId,
    amount: intent.amount,
    currency: intent.currency,
    name: intent.storeName,
    description: intent.description,
    order_id: intent.razorpayOrderId,
    prefill: intent.prefill,
    notes: { receipt: intent.receipt },
    theme: { color: '#ff5a36' },
    handler: (response) => {
      resolve({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
    },
    modal: {
      ondismiss: () => {
        reject(new Error('Payment was closed before it completed.'));
      },
    },
  });

  checkout.on('payment.failed', (response) => {
    reject(
      new Error(
        response.error?.description ??
          'The payment did not go through. Try again.',
      ),
    );
  });
  checkout.open();
  return promise;
}
