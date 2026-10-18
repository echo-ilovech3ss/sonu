import type { StoreSettings } from './types';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'SONU',
  announcement: 'Made in Mumbai. Runs of 120 pairs.',
  heroKicker: 'THE EVERYDAY TRAINER',
  heroLede:
    'The 01 is a low-profile leather trainer for the walk that takes the scenic route. Made in runs of 120 pairs. No account required.',
  shopIntro:
    'One low-profile trainer, made in runs of 120 pairs. Pebbled leather, cotton laces, and a natural gum sole. No seasonal drops. No midnight refresh.',
  supportEmail: 'hello@sonu.example',
  shippingCents: 0,
  freeShippingThresholdCents: 0,
  codEnabled: true,
  onlineEnabled: true,
  promosEnabled: true,
  returnsDays: 30,
};

export const PUBLIC_SETTING_KEYS: Array<keyof StoreSettings> = [
  'storeName',
  'announcement',
  'heroKicker',
  'heroLede',
  'shopIntro',
  'supportEmail',
  'shippingCents',
  'freeShippingThresholdCents',
  'codEnabled',
  'onlineEnabled',
  'promosEnabled',
  'returnsDays',
];
