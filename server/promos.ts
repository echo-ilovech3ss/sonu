import { randomUUID } from 'node:crypto';
import { formatPrice } from '../shared/catalog';
import type {
  PromoCode,
  PromoCodeInput,
  PromoValidation,
} from '../shared/types';
import type { OrderStore } from './db';
import { getSettings } from './settings';

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export function promoDescription(promo: PromoCode): string {
  return promo.type === 'percent'
    ? `${promo.value}% off`
    : `${formatPrice(promo.value)} off`;
}

export type PromoCheck =
  | { ok: true; promo: PromoCode; validation: PromoValidation }
  | { ok: false; error: string };

export function checkPromo(
  store: OrderStore,
  rawCode: string,
  subtotalCents: number,
): PromoCheck {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, error: 'Enter a promo code.' };
  if (!getSettings(store).promosEnabled) {
    return { ok: false, error: 'Promo codes are paused.' };
  }

  const promo = store.getPromoByCode(code);
  if (!promo) return { ok: false, error: 'That code does not exist.' };
  if (!promo.active) return { ok: false, error: 'That code is no longer active.' };

  if (promo.expiresAt) {
    const expiry = new Date(promo.expiresAt).getTime();
    if (!Number.isFinite(expiry) || expiry < Date.now()) {
      return { ok: false, error: 'That code has expired.' };
    }
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { ok: false, error: 'That code has reached its limit.' };
  }

  if (subtotalCents < promo.minSubtotalCents) {
    return {
      ok: false,
      error: `That code needs a ${formatPrice(promo.minSubtotalCents)} bag.`,
    };
  }

  const rawDiscount =
    promo.type === 'percent'
      ? Math.round((subtotalCents * promo.value) / 100)
      : promo.value;
  const discountCents = Math.max(0, Math.min(subtotalCents, rawDiscount));

  return {
    ok: true,
    promo,
    validation: {
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discountCents,
      description: promoDescription(promo),
    },
  };
}

function normalizeExpiry(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function createPromo(store: OrderStore, input: PromoCodeInput): PromoCode {
  const now = new Date().toISOString();
  const promo: PromoCode = {
    id: randomUUID(),
    code: normalizePromoCode(input.code),
    type: input.type,
    value: input.value,
    minSubtotalCents: input.minSubtotalCents,
    maxUses: input.maxUses,
    usedCount: 0,
    active: input.active,
    expiresAt: normalizeExpiry(input.expiresAt),
    createdAt: now,
    updatedAt: now,
  };
  store.insertPromo(promo);
  return promo;
}

export function updatePromo(
  store: OrderStore,
  id: string,
  input: PromoCodeInput,
): PromoCode | null {
  const current = store.getPromoById(id);
  if (!current) return null;

  const promo: PromoCode = {
    ...current,
    code: normalizePromoCode(input.code),
    type: input.type,
    value: input.value,
    minSubtotalCents: input.minSubtotalCents,
    maxUses: input.maxUses,
    active: input.active,
    expiresAt: normalizeExpiry(input.expiresAt),
    updatedAt: new Date().toISOString(),
  };
  store.updatePromo(promo);
  return promo;
}

export function deletePromo(store: OrderStore, id: string): boolean {
  return store.deletePromo(id);
}
