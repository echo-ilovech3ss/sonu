import { DEFAULT_SETTINGS } from '../shared/settings';
import type { StoreSettings } from '../shared/types';
import type { OrderStore } from './db';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof StoreSettings>;

function coerce<K extends keyof StoreSettings>(
  key: K,
  raw: string,
): StoreSettings[K] {
  const fallback = DEFAULT_SETTINGS[key];

  if (typeof fallback === 'number') {
    const parsed = Number(raw);
    return (Number.isFinite(parsed) ? parsed : fallback) as StoreSettings[K];
  }

  if (typeof fallback === 'boolean') {
    return (raw === 'true') as StoreSettings[K];
  }

  return (raw.length > 0 ? raw : fallback) as StoreSettings[K];
}

export function getSettings(store: OrderStore): StoreSettings {
  const stored = store.getSettings();
  const settings = { ...DEFAULT_SETTINGS };

  for (const key of SETTING_KEYS) {
    const raw = stored[key];
    if (raw !== undefined) {
      // The key and fallback type are paired by SETTING_KEYS.
      settings[key] = coerce(key, raw) as never;
    }
  }

  return settings;
}

export function updateSettings(
  store: OrderStore,
  patch: Partial<StoreSettings>,
): StoreSettings {
  const next = { ...getSettings(store), ...patch };
  store.setSettings(
    Object.fromEntries(SETTING_KEYS.map((key) => [key, String(next[key])])),
  );
  return next;
}
