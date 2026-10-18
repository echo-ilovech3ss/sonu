export const ORDER_STATUSES = [
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_COPY: Record<
  OrderStatus,
  { label: string; short: string; detail: string }
> = {
  confirmed: {
    label: 'Order confirmed',
    short: 'Confirmed',
    detail: 'We have your order and your pair is being pulled from the run.',
  },
  packed: {
    label: 'Packed',
    short: 'Packed',
    detail: 'Your pair is boxed and waiting for the courier.',
  },
  shipped: {
    label: 'On the way',
    short: 'Shipped',
    detail: 'The courier has your parcel. The tracking code below is live.',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    short: 'Out for delivery',
    detail: 'Your pair is with the delivery person today.',
  },
  delivered: {
    label: 'Delivered',
    short: 'Delivered',
    detail: 'Your pair is home. Wear it in slowly.',
  },
};

export interface CartLine {
  productId: string;
  size: number;
  quantity: number;
}

export type PaymentMethod = 'cod' | 'razorpay';
export type PaymentStatus = 'cod' | 'paid';

export interface RazorpayPaymentProof {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayIntent {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: 'INR';
  receipt: string;
  storeName: string;
  description: string;
  testMode: boolean;
  prefill: {
    name: string;
    email: string;
    contact?: string;
  };
}

export interface OrderItem {
  productId: string;
  name: string;
  colorway: string;
  size: number;
  quantity: number;
  unitPriceCents: number;
  image: string;
}

export interface OrderEvent {
  status: OrderStatus;
  label: string;
  detail: string;
  occurredAt: string;
}

export interface PublicOrder {
  trackingCode: string;
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  customerName: string;
  shippingCity: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  promoCode: string | null;
  totalCents: number;
  currency: 'INR';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  events: OrderEvent[];
}

export interface CreateOrderInput {
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  items: CartLine[];
  promoCode?: string;
  paymentMethod: PaymentMethod;
  payment?: RazorpayPaymentProof;
  whatsappOptIn?: boolean;
}

export interface CreateOrderResponse {
  trackingCode: string;
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  promoCode: string | null;
  totalCents: number;
  currency: 'INR';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  lookupUrl: string;
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export type PromoType = 'percent' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromoValidation {
  code: string;
  type: PromoType;
  value: number;
  discountCents: number;
  description: string;
}

export interface PromoCodeInput {
  code: string;
  type: PromoType;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  active: boolean;
  expiresAt: string | null;
}

export interface StoreSettings {
  storeName: string;
  announcement: string;
  heroKicker: string;
  heroLede: string;
  shopIntro: string;
  supportEmail: string;
  shippingCents: number;
  freeShippingThresholdCents: number;
  codEnabled: boolean;
  onlineEnabled: boolean;
  promosEnabled: boolean;
  returnsDays: number;
}

export interface WhatsAppSettings {
  enabled: boolean;
  gatewayUrl: string;
  apiKey: string;
  clientId: string;
  senderLabel: string;
}

export interface WhatsAppClientStatus {
  clientId: string;
  state: string;
  authenticated: boolean;
  qrCodeAvailable: boolean;
  qrBase64: string | null;
  clientInfo: {
    number?: string;
    pushname?: string;
  } | null;
}

export interface WhatsAppStatus {
  ok: boolean;
  configured: boolean;
  error: string | null;
  clients: WhatsAppClientStatus[];
}

export interface ProductUpdate {
  name?: string;
  colorway?: string;
  colorwaySlug?: string;
  priceCents?: number;
  image?: string;
  imageFit?: 'contain' | 'cover';
  imageFilter?: string | null;
  swatch?: string;
  swatchInk?: string;
  upper?: string;
  sole?: string;
  weightGrams?: number;
  description?: string;
  active?: boolean;
  stock?: Record<string, number>;
  sizes?: number[];
}

export interface CreateProductInput {
  name: string;
  colorway: string;
  priceCents: number;
  image: string;
  imageFit: 'contain' | 'cover';
  imageFilter?: string;
  swatch: string;
  swatchInk: string;
  upper: string;
  sole: string;
  weightGrams: number;
  description: string;
  sizes: number[];
  stock: Record<string, number>;
  active: boolean;
}

export interface AdminOrder {
  id: string;
  trackingCode: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  email: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  promoCode: string | null;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  estimatedDelivery: string;
}

export interface AnalyticsProductRow {
  productId: string;
  name: string;
  colorway: string;
  views: number;
  purchased: number;
  revenueCents: number;
}

export interface AnalyticsGeoRow {
  city: string;
  state: string;
  country: string;
  orders: number;
  revenueCents: number;
}

export interface AnalyticsBuyerRow {
  orderId: string;
  trackingCode: string;
  customerName: string;
  email: string;
  phone: string | null;
  hasPhone: boolean;
  city: string;
  state: string | null;
  country: string;
  items: OrderItem[];
  totalCents: number;
  paymentMethod: PaymentMethod;
  whatsappOptIn: boolean;
  createdAt: string;
}

export interface AnalyticsSummary {
  totals: {
    orders: number;
    revenueCents: number;
    productViews: number;
    conversionRate: number;
    phoneOrders: number;
    whatsappOptInOrders: number;
  };
  topProducts: AnalyticsProductRow[];
  geography: AnalyticsGeoRow[];
  buyers: AnalyticsBuyerRow[];
  paymentSplit: {
    cod: number;
    razorpay: number;
  };
}

export interface LowStockItem {
  productId: string;
  name: string;
  colorway: string;
  size: number;
  quantity: number;
}

export interface AdminSummary {
  totalOrders: number;
  openOrders: number;
  revenueCents: number;
  activePromos: number;
  lowStock: LowStockItem[];
  recentOrders: AdminOrder[];
}
