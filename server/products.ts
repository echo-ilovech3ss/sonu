import { CURRENCY, PRODUCTS, type Product } from '../shared/catalog';
import type { CreateProductInput, ProductUpdate } from '../shared/types';
import type { OrderStore, ProductOverride } from './db';

function mergeProduct(base: Product, override: ProductOverride | undefined): Product {
  if (!override) return base;

  const sizes = override.sizes ?? base.sizes;
  const stock = override.stock ?? base.stock;

  return {
    ...base,
    name: override.name ?? base.name,
    colorway: override.colorway ?? base.colorway,
    colorwaySlug: override.colorwaySlug ?? base.colorwaySlug,
    priceCents: override.priceCents ?? base.priceCents,
    image: override.image ?? base.image,
    imageFit: override.imageFit ?? base.imageFit,
    imageFilter: override.imageFilter ?? base.imageFilter,
    swatch: override.swatch ?? base.swatch,
    swatchInk: override.swatchInk ?? base.swatchInk,
    upper: override.upper ?? base.upper,
    sole: override.sole ?? base.sole,
    weightGrams: override.weightGrams ?? base.weightGrams,
    active: override.active ?? base.active,
    sizes,
    stock: Object.fromEntries(
      sizes.map((size) => [String(size), Math.max(0, stock[String(size)] ?? 0)]),
    ),
    description: override.description ?? base.description,
  };
}

function allBaseProducts(store: OrderStore): Product[] {
  return [...PRODUCTS, ...store.listCustomProducts()];
}

export function listProducts(store: OrderStore, includeInactive = false): Product[] {
  const overrides = new Map(
    store.listProductOverrides().map((entry) => [entry.productId, entry]),
  );

  return allBaseProducts(store)
    .map((product) => mergeProduct(product, overrides.get(product.id)))
    .filter((product) => includeInactive || product.active);
}

export function findProduct(store: OrderStore, id: string): Product | undefined {
  return listProducts(store, true).find((product) => product.id === id);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueProductId(store: OrderStore, colorway: string): string {
  const existing = new Set(allBaseProducts(store).map((product) => product.id));
  const slug = slugify(colorway) || 'pair';
  let index = 1;
  let id = `sonu-${String(index).padStart(2, '0')}-${slug}`;

  while (existing.has(id)) {
    index += 1;
    id = `sonu-${String(index).padStart(2, '0')}-${slug}`;
  }

  return id;
}

export function createProduct(
  store: OrderStore,
  input: CreateProductInput,
): Product {
  const colorwaySlug = slugify(input.colorway) || 'pair';
  const product: Product = {
    id: uniqueProductId(store, input.colorway),
    name: input.name.trim(),
    colorway: input.colorway.trim(),
    colorwaySlug,
    priceCents: input.priceCents,
    currency: CURRENCY,
    image: input.image.trim(),
    imageFit: input.imageFit,
    imageFilter: input.imageFilter?.trim() || undefined,
    swatch: input.swatch,
    swatchInk: input.swatchInk,
    upper: input.upper.trim(),
    sole: input.sole.trim(),
    weightGrams: input.weightGrams,
    description: input.description.trim(),
    sizes: input.sizes,
    active: input.active,
    stock: Object.fromEntries(
      input.sizes.map((size) => [
        String(size),
        Math.max(0, Math.floor(input.stock[String(size)] ?? 0)),
      ]),
    ),
  };

  store.insertCustomProduct(product);
  return product;
}

export function updateProduct(
  store: OrderStore,
  id: string,
  update: ProductUpdate,
): Product | null {
  const base = allBaseProducts(store).find((product) => product.id === id);
  if (!base) return null;

  const current = store.getProductOverride(id);
  const sizes = update.sizes ?? current?.sizes ?? base.sizes;
  const stock = update.stock
    ? { ...(current?.stock ?? base.stock), ...update.stock }
    : (current?.stock ?? base.stock);

  const override: ProductOverride = {
    productId: id,
    name: update.name ?? current?.name ?? null,
    colorway: update.colorway ?? current?.colorway ?? null,
    colorwaySlug:
      update.colorwaySlug ??
      (update.colorway ? slugify(update.colorway) : current?.colorwaySlug ?? null),
    priceCents: update.priceCents ?? current?.priceCents ?? null,
    image: update.image ?? current?.image ?? null,
    imageFit: update.imageFit ?? current?.imageFit ?? null,
    imageFilter:
      update.imageFilter === undefined
        ? (current?.imageFilter ?? null)
        : update.imageFilter?.trim() || null,
    swatch: update.swatch ?? current?.swatch ?? null,
    swatchInk: update.swatchInk ?? current?.swatchInk ?? null,
    upper: update.upper ?? current?.upper ?? null,
    sole: update.sole ?? current?.sole ?? null,
    weightGrams: update.weightGrams ?? current?.weightGrams ?? null,
    active: update.active ?? current?.active ?? null,
    sizes: update.sizes ?? current?.sizes ?? null,
    stock: Object.fromEntries(
      sizes.map((size) => [
        String(size),
        Math.max(0, Math.floor(stock[String(size)] ?? 0)),
      ]),
    ),
    description: update.description ?? current?.description ?? null,
    updatedAt: new Date().toISOString(),
  };

  store.saveProductOverride(override);
  return mergeProduct(base, override);
}
