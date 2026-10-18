import { z } from 'zod';
import { ORDER_STATUSES } from '../shared/types';

function optionalText(max: number, message: string) {
  return z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().max(max, message).optional(),
  );
}

const orderBaseSchema = z
  .object({
    customer: z.object({
      name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(80, 'Name must be at most 80 characters')
        .regex(/^[^\u0000-\u001F\u007F]+$/, 'Name contains invalid characters'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .max(254, 'Email must be at most 254 characters')
        .pipe(z.email('Enter a valid email address')),
      phone: z
        .string({ error: 'Phone is required' })
        .trim()
        .min(10, 'Phone is required')
        .max(30, 'Phone must be at most 30 characters')
        .regex(
          /^[+0-9][0-9\s-]{8,28}$/,
          'Enter a valid phone number',
        ),
    }),
    shipping: z.object({
      addressLine1: z
        .string()
        .trim()
        .min(4, 'Address must be at least 4 characters')
        .max(120, 'Address must be at most 120 characters'),
      addressLine2: optionalText(120, 'Address line 2 must be at most 120 characters'),
      city: z
        .string()
        .trim()
        .min(2, 'City must be at least 2 characters')
        .max(80, 'City must be at most 80 characters'),
      state: optionalText(80, 'State must be at most 80 characters'),
      postalCode: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
      country: z.literal('India').default('India'),
    }),
    items: z
      .array(
        z.object({
          productId: z
            .string()
            .trim()
            .min(1, 'Product is required')
            .max(64, 'Product is too long'),
          size: z.number().int('Size must be a whole number'),
          quantity: z
            .number()
            .int('Quantity must be a whole number')
            .min(1, 'Quantity must be at least 1')
            .max(5, 'Quantity must be at most 5'),
        }),
      )
      .min(1, 'Order must contain at least one item')
      .max(10, 'Order cannot contain more than 10 items'),
    promoCode: z.string().trim().max(24, 'Promo code is too long').optional(),
    whatsappOptIn: z.boolean().default(true),
    paymentMethod: z.enum(['cod', 'razorpay']),
    payment: z
      .object({
        razorpayOrderId: z
          .string()
          .trim()
          .regex(/^order_[A-Za-z0-9]+$/, 'Invalid Razorpay order id')
          .max(64),
        razorpayPaymentId: z
          .string()
          .trim()
          .regex(/^pay_[A-Za-z0-9]+$/, 'Invalid Razorpay payment id')
          .max(64),
        razorpaySignature: z
          .string()
          .trim()
          .regex(/^[a-f0-9]{64}$/i, 'Invalid Razorpay signature')
          .max(128),
      })
      .optional(),
  });

const createOrderSchema = orderBaseSchema.superRefine((input, ctx) => {
  if (input.paymentMethod === 'razorpay' && !input.payment) {
    ctx.addIssue({
      code: 'custom',
      message: 'Razorpay payment proof is required',
      path: ['payment'],
    });
  }
  if (input.paymentMethod === 'cod' && input.payment) {
    ctx.addIssue({
      code: 'custom',
      message: 'Payment proof is only valid for online payments',
      path: ['payment'],
    });
  }
});

const paymentIntentSchema = orderBaseSchema.extend({
  paymentMethod: z.literal('razorpay'),
});

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  detail: z.string().trim().max(500, 'Detail must be at most 500 characters').optional(),
});

const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1, 'Store name is required').max(40),
    announcement: z.string().trim().max(160, 'Announcement is too long'),
    heroKicker: z.string().trim().max(80, 'Kicker is too long'),
    heroLede: z.string().trim().max(400, 'Hero copy is too long'),
    shopIntro: z.string().trim().max(600, 'Shop intro is too long'),
    supportEmail: z
      .string()
      .trim()
      .max(254, 'Support email is too long')
      .pipe(z.email('Enter a valid support email')),
    shippingCents: z.number().int().min(0).max(100_000),
    freeShippingThresholdCents: z.number().int().min(0).max(10_000_000),
    codEnabled: z.boolean(),
    onlineEnabled: z.boolean(),
    promosEnabled: z.boolean(),
    returnsDays: z.number().int().min(0).max(365),
  })
  .partial();

const imagePathSchema = z
  .string()
  .trim()
  .min(1, 'Image is required')
  .max(500, 'Image path is too long')
  .regex(
    /^(\/images\/[A-Za-z0-9._-]+|https?:\/\/[^\s]+)$/,
    'Use an image path or an https URL',
  );

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color');

const productFields = {
  name: z.string().trim().min(1, 'Model name is required').max(40),
  colorway: z.string().trim().min(1, 'Colorway is required').max(40),
  priceCents: z.number().int().min(100).max(10_000_000),
  image: imagePathSchema,
  imageFit: z.enum(['contain', 'cover']),
  imageFilter: z.string().trim().max(200).optional(),
  swatch: colorSchema,
  swatchInk: colorSchema,
  upper: z.string().trim().min(1, 'Upper is required').max(120),
  sole: z.string().trim().min(1, 'Sole is required').max(120),
  weightGrams: z.number().int().min(100).max(2000),
  description: z.string().trim().min(1, 'Description is required').max(600),
  sizes: z.array(z.number().int().min(30).max(50)).min(1).max(20),
  stock: z.record(z.string(), z.number().int().min(0).max(999)),
  active: z.boolean(),
};

const createProductSchema = z.object(productFields);

const productUpdateSchema = z.object(productFields).partial();

const whatsappSettingsSchema = z
  .object({
    enabled: z.boolean(),
    gatewayUrl: z
      .string()
      .trim()
      .max(300, 'Gateway URL is too long')
      .url('Enter a valid gateway URL'),
    apiKey: z.string().trim().max(300, 'API key is too long'),
    clientId: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || /^\d{10}$/.test(value),
        'Use a 10-digit WhatsApp account number',
      ),
    senderLabel: z.string().trim().min(1).max(60),
  })
  .partial();

const promoInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Code must be at least 3 characters')
      .max(24, 'Code must be at most 24 characters')
      .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Use letters, numbers or hyphens'),
    type: z.enum(['percent', 'fixed']),
    value: z.number().int().min(1).max(10_000_000),
    minSubtotalCents: z.number().int().min(0).max(10_000_000),
    maxUses: z.number().int().min(1).max(100_000).nullable(),
    active: z.boolean(),
    expiresAt: z
      .string()
      .trim()
      .nullable()
      .refine(
        (value) => value === null || Number.isFinite(Date.parse(value)),
        'Enter a valid expiry date',
      ),
  })
  .superRefine((input, ctx) => {
    if (input.type === 'percent' && input.value > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Percentage cannot exceed 100',
        path: ['value'],
      });
    }
  });

const promoValidationSchema = z.object({
  code: z.string().trim().min(1, 'Enter a promo code').max(24),
  subtotalCents: z.number().int().min(0).max(10_000_000),
});

export type CreateOrderData = z.infer<typeof createOrderSchema>;
export type PaymentIntentData = z.infer<typeof paymentIntentSchema>;
export type UpdateStatusData = z.infer<typeof updateStatusSchema>;
export type SettingsData = z.infer<typeof settingsSchema>;
export type CreateProductData = z.infer<typeof createProductSchema>;
export type ProductUpdateData = z.infer<typeof productUpdateSchema>;
export type WhatsAppSettingsData = z.infer<typeof whatsappSettingsSchema>;
export type PromoInputData = z.infer<typeof promoInputSchema>;
export type PromoValidationData = z.infer<typeof promoValidationSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; details: Record<string, string[]> };

function collectIssues(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

export function parseCreateOrderInput(value: unknown): ValidationResult<CreateOrderData> {
  const result = createOrderSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parsePaymentIntentInput(
  value: unknown,
): ValidationResult<PaymentIntentData> {
  const result = paymentIntentSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parseUpdateStatusInput(value: unknown): ValidationResult<UpdateStatusData> {
  const result = updateStatusSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parseSettingsInput(value: unknown): ValidationResult<SettingsData> {
  const result = settingsSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parseCreateProductInput(
  value: unknown,
): ValidationResult<CreateProductData> {
  const result = createProductSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parseProductUpdateInput(
  value: unknown,
): ValidationResult<ProductUpdateData> {
  const result = productUpdateSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parseWhatsAppSettingsInput(
  value: unknown,
): ValidationResult<WhatsAppSettingsData> {
  const result = whatsappSettingsSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parsePromoInput(value: unknown): ValidationResult<PromoInputData> {
  const result = promoInputSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}

export function parsePromoValidationInput(
  value: unknown,
): ValidationResult<PromoValidationData> {
  const result = promoValidationSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, details: collectIssues(result.error) };
}
