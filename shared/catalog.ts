export type Currency = 'INR';

export interface Product {
  id: string;
  name: string;
  colorway: string;
  colorwaySlug: string;
  priceCents: number;
  currency: Currency;
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
  active: boolean;
  stock: Record<string, number>;
}

const SIZES = [37, 38, 39, 40, 41, 42, 43, 44, 45];

function stockFor(sizes: number[], quantity = 12): Record<string, number> {
  return Object.fromEntries(sizes.map((size) => [String(size), quantity]));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ProductSeed {
  id: string;
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
}

const SEEDS: ProductSeed[] = [
  {
    id: 'sonu-01-pool',
    name: 'The 01',
    colorway: 'Pool',
    priceCents: 890000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    swatch: '#9fd6c8',
    swatchInk: '#14211d',
    upper: 'Pebbled teal leather',
    sole: 'Natural gum rubber',
    weightGrams: 312,
    description:
      'The original. Soft teal leather, a low profile, and a gum sole that gets better with pavement.',
  },
  {
    id: 'sonu-01-tar',
    name: 'The 01',
    colorway: 'Tar',
    priceCents: 890000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) brightness(0.38) contrast(1.15)',
    swatch: '#1d1d1a',
    swatchInk: '#f4f1e8',
    upper: 'Full-grain black leather',
    sole: 'Black rubber',
    weightGrams: 318,
    description:
      'Black leather, brass eyelets, and a low shine. The pair you can wear to dinner and then walk home in.',
  },
  {
    id: 'sonu-01-chalk',
    name: 'The 01',
    colorway: 'Chalk',
    priceCents: 890000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) brightness(1.45) contrast(0.92)',
    swatch: '#e9e4d6',
    swatchInk: '#26241f',
    upper: 'Off-white leather',
    sole: 'Natural gum rubber',
    weightGrams: 308,
    description:
      'Off-white leather with a soft toe. A clean pair that does not mind a scuff.',
  },
  {
    id: 'sonu-02-clay',
    name: 'The 02',
    colorway: 'Clay',
    priceCents: 940000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    swatch: '#df6b3f',
    swatchInk: '#1d1b18',
    upper: 'Orange suede and mesh',
    sole: 'White EVA foam',
    weightGrams: 286,
    description:
      'A lighter, louder trainer. Orange suede over breathable mesh, built for the long way through the city.',
  },
  {
    id: 'sonu-02-moss',
    name: 'The 02',
    colorway: 'Moss',
    priceCents: 920000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) sepia(1) saturate(1.2) hue-rotate(35deg) brightness(0.8)',
    swatch: '#6f7a4e',
    swatchInk: '#f4f1e8',
    upper: 'Olive canvas and leather',
    sole: 'Natural gum rubber',
    weightGrams: 300,
    description:
      'Olive canvas panels with a soft leather collar. Quiet enough for the office, light enough for the whole walk home.',
  },
  {
    id: 'sonu-02-ink',
    name: 'The 02',
    colorway: 'Ink',
    priceCents: 940000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) sepia(1) saturate(2) hue-rotate(165deg) brightness(0.45)',
    swatch: '#2b3440',
    swatchInk: '#f4f1e8',
    upper: 'Navy mesh and suede',
    sole: 'White EVA foam',
    weightGrams: 286,
    description:
      'A deep navy runner with a bright sole. The mesh keeps it cool; the suede keeps it from looking like gym kit.',
  },
  {
    id: 'sonu-03-tobacco',
    name: 'The 03',
    colorway: 'Tobacco',
    priceCents: 860000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    swatch: '#b56b3d',
    swatchInk: '#f4f1e8',
    upper: 'Tan canvas and leather',
    sole: 'White rubber',
    weightGrams: 330,
    description:
      'A warm tan pair with a padded collar and a clean white sole. Built for long days and late trains.',
  },
  {
    id: 'sonu-03-court',
    name: 'The 03',
    colorway: 'Court',
    priceCents: 820000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) brightness(1.5) contrast(0.9)',
    swatch: '#e7e1d2',
    swatchInk: '#25221c',
    upper: 'White canvas',
    sole: 'Vulcanized rubber',
    weightGrams: 342,
    description:
      'A clean court shoe with a vulcanized sole. White canvas, soft lining, and no logos shouting from the side.',
  },
  {
    id: 'sonu-03-slate',
    name: 'The 03',
    colorway: 'Slate',
    priceCents: 840000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) brightness(0.9) contrast(0.95)',
    swatch: '#6b7480',
    swatchInk: '#f4f1e8',
    upper: 'Grey canvas',
    sole: 'White rubber',
    weightGrams: 338,
    description:
      'The court shape in a soft slate grey. A pair that works with denim, chinos, and whatever the weekend turns into.',
  },
  {
    id: 'sonu-04-rust',
    name: 'The 04',
    colorway: 'Stone',
    priceCents: 980000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    swatch: '#8b8b85',
    swatchInk: '#f4f1e8',
    upper: 'Grey suede and mesh',
    sole: 'Lugged rubber',
    weightGrams: 360,
    description:
      'A trail-leaning high-top in grey suede and mesh. More grip, more padding, and a sole that does not mind a wet footpath.',
  },
  {
    id: 'sonu-04-sand',
    name: 'The 04',
    colorway: 'Sand',
    priceCents: 960000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) sepia(1) saturate(0.75) brightness(1.18)',
    swatch: '#d8c3a5',
    swatchInk: '#26241f',
    upper: 'Sand suede',
    sole: 'Natural gum rubber',
    weightGrams: 350,
    description:
      'Sand suede with a gum sole. The lightest way into the trail shape, and the easiest to wear with everything.',
  },
  {
    id: 'sonu-04-pine',
    name: 'The 04',
    colorway: 'Pine',
    priceCents: 980000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) sepia(1) saturate(1.3) hue-rotate(55deg) brightness(0.62)',
    swatch: '#3f5a45',
    swatchInk: '#f4f1e8',
    upper: 'Pine canvas and suede',
    sole: 'Lugged rubber',
    weightGrams: 355,
    description:
      'Deep pine green with a lugged sole. Built for the park, the commute, and the shortcut that looked shorter on the map.',
  },
  {
    id: 'sonu-05-pool',
    name: 'The 05',
    colorway: 'Flare',
    priceCents: 1020000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    swatch: '#d9a441',
    swatchInk: '#1d1b18',
    upper: 'Multi-panel mesh and suede',
    sole: 'White EVA foam',
    weightGrams: 320,
    description:
      'The archive shape in a mixed-material flare. A softer toe, a higher collar, and a bright sole for the first warm evening of the year.',
  },
  {
    id: 'sonu-05-mono',
    name: 'The 05',
    colorway: 'Mono',
    priceCents: 1040000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) brightness(0.3) contrast(1.25)',
    swatch: '#1d1d1a',
    swatchInk: '#f4f1e8',
    upper: 'Black leather',
    sole: 'Black rubber',
    weightGrams: 320,
    description:
      'All black, all leather, no contrast. The archive pair for the days you want to disappear into the city.',
  },
  {
    id: 'sonu-05-coral',
    name: 'The 05',
    colorway: 'Coral',
    priceCents: 990000,
    image: '/images/model-01-low.webp',
    imageFit: 'contain',
    imageFilter: 'grayscale(1) sepia(1) saturate(1.8) hue-rotate(-12deg) brightness(0.92)',
    swatch: '#e06a3a',
    swatchInk: '#1d1b18',
    upper: 'Coral mesh and suede',
    sole: 'White EVA foam',
    weightGrams: 290,
    description:
      'A coral archive pair with a white sole. Bright, light, and built for the first warm evening of the year.',
  },
];

// Each model has one real cutout. Colorway variants reuse it with a tinted
// filter, so the photography stays consistent across the run.
const MODEL_IMAGES: Record<string, string> = {
  'The 01': '/images/model-01-low.webp',
  'The 02': '/images/model-02-runner.webp',
  'The 03': '/images/model-03-court.webp',
  'The 04': '/images/model-04-trail.webp',
  'The 05': '/images/model-05-archive.webp',
};

export const PRODUCTS: Product[] = SEEDS.map((seed) => ({
  ...seed,
  image: MODEL_IMAGES[seed.name] ?? seed.image,
  colorwaySlug: slugify(seed.colorway),
  currency: 'INR',
  sizes: SIZES,
  active: true,
  stock: stockFor(SIZES),
}));

export const CURRENCY = 'INR' as const;
export const SHIPPING_CENTS = 0;

export const PRODUCT_IMAGE_PRESETS: Array<{
  value: string;
  label: string;
}> = [
  { value: '/images/model-01-low.webp', label: 'The 01 / low top' },
  { value: '/images/model-02-runner.webp', label: 'The 02 / runner' },
  { value: '/images/model-03-court.webp', label: 'The 03 / court' },
  { value: '/images/model-04-trail.webp', label: 'The 04 / trail' },
  { value: '/images/model-05-archive.webp', label: 'The 05 / archive' },
  { value: '/images/detail-orange.webp', label: 'Orange trainer / photo' },
  { value: '/images/detail-shelf.webp', label: 'Court shoe / shelf' },
  { value: '/images/pair-multi.webp', label: 'Multi pair / studio' },
  { value: '/images/detail-chalk.webp', label: 'Chalk trainer / photo' },
  { value: '/images/detail-tar.webp', label: 'Tar trainer / photo' },
  { value: '/images/hero-pool.webp', label: 'Pool trainer / full' },
  { value: '/images/hero-pool.png', label: 'Pool trainer / transparent PNG' },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
