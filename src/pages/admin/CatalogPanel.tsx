import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PRODUCT_IMAGE_PRESETS,
  formatPrice,
  type Product,
} from '../../../shared/catalog';
import type { CreateProductInput, ProductUpdate } from '../../../shared/types';

const DEFAULT_SIZES = [37, 38, 39, 40, 41, 42, 43, 44, 45];

function parseSizes(value: string): number[] {
  return [
    ...new Set(
      value
        .split(/[,\s]+/)
        .map((entry) => Number(entry))
        .filter(
          (entry) =>
            Number.isInteger(entry) && entry >= 30 && entry <= 50,
        ),
    ),
  ].sort((a, b) => a - b);
}

function stockFor(sizes: number[], existing: Record<string, number> = {}) {
  return Object.fromEntries(
    sizes.map((size) => [String(size), existing[String(size)] ?? 0]),
  );
}

function imageOptions(current?: string) {
  const options = PRODUCT_IMAGE_PRESETS.map((preset) => ({ ...preset }));
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: 'Current image' });
  }
  return options;
}

export function CatalogPanel({
  products,
  busy,
  onSave,
  onCreate,
}: {
  products: Product[];
  busy: boolean;
  onSave: (id: string, update: ProductUpdate) => Promise<void>;
  onCreate: (input: CreateProductInput) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.id, product.name, product.colorway, product.upper, product.sole]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [products, query]);

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">
            CATALOG / {products.length} {products.length === 1 ? 'PAIR' : 'PAIRS'}
          </p>
          <h2>Stock, price, shelf.</h2>
        </div>
        <p className="admin-panel-note">
          Add a shoe, edit every field, and hold stock per size. Hidden pairs
          leave the storefront immediately.
        </p>
      </div>

      <div className="admin-catalog-tools">
        <label className="admin-search">
          <span className="sr-only">Search catalog</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search model, colorway, or ID..."
          />
        </label>
        <button
          type="button"
          className="admin-button admin-button--ink"
          onClick={() => setAdding((current) => !current)}
        >
          {adding ? 'Close form' : 'Add a shoe'}
        </button>
      </div>

      {adding ? (
        <AddProductForm
          busy={busy}
          onCancel={() => setAdding(false)}
          onCreate={async (input) => {
            await onCreate(input);
            setAdding(false);
          }}
        />
      ) : null}

      {filtered.length === 0 ? (
        <p className="admin-empty">
          No pair matches “{query.trim()}”. Clear the search or add a new shoe.
        </p>
      ) : (
        <div className="admin-catalog">
          {filtered.map((product) => (
            <ProductEditor
              key={product.id}
              product={product}
              busy={busy}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddProductForm({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: CreateProductInput) => Promise<void>;
}) {
  const [sizesText, setSizesText] = useState(DEFAULT_SIZES.join(', '));
  const [stock, setStock] = useState<Record<string, number>>(
    stockFor(DEFAULT_SIZES),
  );
  const [error, setError] = useState('');
  const sizes = parseSizes(sizesText);

  useEffect(() => {
    setStock((current) => stockFor(sizes, current));
  }, [sizesText]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const priceCents = Math.round(Number(data.get('price')) * 100);
    const weightGrams = Math.round(Number(data.get('weightGrams')));
    const nextSizes = parseSizes(String(data.get('sizes') ?? ''));

    if (nextSizes.length === 0) {
      setError('Add at least one EU size.');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      setError('Enter a price of at least ₹1.');
      return;
    }
    if (!Number.isFinite(weightGrams) || weightGrams < 100) {
      setError('Enter a weight of at least 100 g.');
      return;
    }

    try {
      await onCreate({
        name: String(data.get('name') ?? '').trim(),
        colorway: String(data.get('colorway') ?? '').trim(),
        priceCents,
        image: String(data.get('image') ?? ''),
        imageFit: data.get('imageFit') === 'contain' ? 'contain' : 'cover',
        imageFilter: String(data.get('imageFilter') ?? '').trim() || undefined,
        swatch: String(data.get('swatch') ?? '#e9e4d6'),
        swatchInk: String(data.get('swatchInk') ?? '#26241f'),
        upper: String(data.get('upper') ?? '').trim(),
        sole: String(data.get('sole') ?? '').trim(),
        weightGrams,
        description: String(data.get('description') ?? '').trim(),
        sizes: nextSizes,
        stock: Object.fromEntries(
          nextSizes.map((size) => [
            String(size),
            Math.max(0, Math.floor(stock[String(size)] ?? 0)),
          ]),
        ),
        active: data.get('active') === 'on',
      });
      form.reset();
    } catch {
      setError('The shoe did not save. Check the fields and try again.');
    }
  }

  return (
    <form className="admin-add-product" onSubmit={submit}>
      <div className="admin-add-product__head">
        <div>
          <p className="admin-kicker">NEW PAIR</p>
          <h3>Add a shoe.</h3>
        </div>
        <button type="button" className="admin-text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="admin-add-product__grid">
        <label className="admin-field">
          <span>Model name</span>
          <input name="name" required placeholder="The 04" />
        </label>
        <label className="admin-field">
          <span>Colorway</span>
          <input name="colorway" required placeholder="Moss" />
        </label>
        <label className="admin-field">
          <span>Price (₹)</span>
          <input name="price" type="number" min="1" step="1" required placeholder="8900" />
        </label>
        <label className="admin-field">
          <span>Weight (g)</span>
          <input name="weightGrams" type="number" min="100" max="2000" required placeholder="310" />
        </label>
        <label className="admin-field">
          <span>Image</span>
          <select name="image" defaultValue={PRODUCT_IMAGE_PRESETS[0].value}>
            {imageOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Image fit</span>
          <select name="imageFit" defaultValue="cover">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label className="admin-field admin-field--wide">
          <span>Image filter (CSS, optional)</span>
          <input
            name="imageFilter"
            placeholder="hue-rotate(65deg) saturate(0.75)"
          />
        </label>
        <label className="admin-field">
          <span>Swatch</span>
          <input name="swatch" type="color" defaultValue="#df6b3f" />
        </label>
        <label className="admin-field">
          <span>Swatch ink</span>
          <input name="swatchInk" type="color" defaultValue="#1d1b18" />
        </label>
        <label className="admin-field">
          <span>Upper</span>
          <input name="upper" required placeholder="Orange suede and mesh" />
        </label>
        <label className="admin-field">
          <span>Sole</span>
          <input name="sole" required placeholder="White EVA foam" />
        </label>
        <label className="admin-field admin-field--wide">
          <span>Description</span>
          <textarea name="description" rows={3} required placeholder="How the pair wears, and where it belongs." />
        </label>
        <label className="admin-field admin-field--wide">
          <span>Sizes (comma separated)</span>
          <input
            name="sizes"
            value={sizesText}
            onChange={(event) => setSizesText(event.target.value)}
            placeholder="37, 38, 39, 40, 41, 42, 43, 44, 45"
          />
        </label>
      </div>

      <div className="admin-add-product__stock">
        <p className="admin-kicker">INITIAL STOCK</p>
        <div className="admin-stock">
          {sizes.map((size) => (
            <label key={size}>
              <span>EU {size}</span>
              <input
                type="number"
                min="0"
                max="999"
                value={stock[String(size)] ?? 0}
                onChange={(event) =>
                  setStock((current) => ({
                    ...current,
                    [String(size)]: Number(event.target.value) || 0,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="admin-add-product__footer">
        <label className="admin-toggle">
          <input name="active" type="checkbox" defaultChecked />
          <span>Live on the storefront</span>
        </label>
        <button
          type="submit"
          className="admin-button admin-button--ink"
          disabled={busy}
        >
          {busy ? 'Saving...' : 'Create shoe'}
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}

function ProductEditor({
  product,
  busy,
  onSave,
}: {
  product: Product;
  busy: boolean;
  onSave: (id: string, update: ProductUpdate) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: product.name,
    colorway: product.colorway,
    price: String(product.priceCents / 100),
    image: product.image,
    imageFit: product.imageFit,
    imageFilter: product.imageFilter ?? '',
    swatch: product.swatch,
    swatchInk: product.swatchInk,
    upper: product.upper,
    sole: product.sole,
    weightGrams: String(product.weightGrams),
    description: product.description,
    active: product.active,
    sizesText: product.sizes.join(', '),
  });
  const [stock, setStock] = useState<Record<string, number>>({
    ...product.stock,
  });
  const [saved, setSaved] = useState(false);
  const sizes = parseSizes(draft.sizesText);

  useEffect(() => {
    setDraft({
      name: product.name,
      colorway: product.colorway,
      price: String(product.priceCents / 100),
      image: product.image,
      imageFit: product.imageFit,
      imageFilter: product.imageFilter ?? '',
      swatch: product.swatch,
      swatchInk: product.swatchInk,
      upper: product.upper,
      sole: product.sole,
      weightGrams: String(product.weightGrams),
      description: product.description,
      active: product.active,
      sizesText: product.sizes.join(', '),
    });
    setStock({ ...product.stock });
  }, [product]);

  function update<K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const priceCents = Math.round(Number(draft.price) * 100);
    const weightGrams = Math.round(Number(draft.weightGrams));
    if (!Number.isFinite(priceCents) || priceCents < 100) return;
    if (sizes.length === 0) return;

    const updatePayload: ProductUpdate = {};
    if (draft.name.trim() !== product.name) updatePayload.name = draft.name.trim();
    if (draft.colorway.trim() !== product.colorway) {
      updatePayload.colorway = draft.colorway.trim();
    }
    if (priceCents !== product.priceCents) updatePayload.priceCents = priceCents;
    if (draft.image !== product.image) updatePayload.image = draft.image;
    if (draft.imageFit !== product.imageFit) updatePayload.imageFit = draft.imageFit;
    if (draft.imageFilter.trim() !== (product.imageFilter ?? '')) {
      updatePayload.imageFilter = draft.imageFilter.trim();
    }
    if (draft.swatch !== product.swatch) updatePayload.swatch = draft.swatch;
    if (draft.swatchInk !== product.swatchInk) {
      updatePayload.swatchInk = draft.swatchInk;
    }
    if (draft.upper.trim() !== product.upper) updatePayload.upper = draft.upper.trim();
    if (draft.sole.trim() !== product.sole) updatePayload.sole = draft.sole.trim();
    if (weightGrams !== product.weightGrams) {
      updatePayload.weightGrams = weightGrams;
    }
    if (draft.description.trim() !== product.description) {
      updatePayload.description = draft.description.trim();
    }
    if (draft.active !== product.active) updatePayload.active = draft.active;
    if (
      sizes.length !== product.sizes.length ||
      sizes.some((size, index) => size !== product.sizes[index])
    ) {
      updatePayload.sizes = sizes;
    }

    const changedStock = Object.fromEntries(
      sizes
        .map((size) => [
          String(size),
          Math.max(0, Math.floor(stock[String(size)] ?? 0)),
        ])
        .filter(
          ([size, quantity]) => quantity !== (product.stock[size] ?? 0),
        ),
    );
    if (Object.keys(changedStock).length > 0) updatePayload.stock = changedStock;

    if (Object.keys(updatePayload).length === 0) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      return;
    }

    try {
      await onSave(product.id, updatePayload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      // The studio-level notice explains the failed save.
    }
  }

  return (
    <article className="admin-product">
      <div className="admin-product__media">
        <img
          src={product.image}
          alt={`${product.name} in ${product.colorway}`}
          style={{ filter: product.imageFilter }}
        />
        <span
          className="admin-product__swatch"
          style={{ background: product.swatch }}
        />
      </div>
      <div className="admin-product__body">
        <div className="admin-product__head">
          <div>
            <p className="admin-kicker">
              {product.id} / {formatPrice(product.priceCents)}
            </p>
            <h3>
              {product.name} / {product.colorway}
            </h3>
          </div>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => update('active', event.target.checked)}
            />
            <span>{draft.active ? 'Live' : 'Hidden'}</span>
          </label>
        </div>

        <div className="admin-product__fields">
          <label className="admin-field">
            <span>Model</span>
            <input
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Colorway</span>
            <input
              value={draft.colorway}
              onChange={(event) => update('colorway', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Price (₹)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={draft.price}
              onChange={(event) => update('price', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Weight (g)</span>
            <input
              type="number"
              min="100"
              max="2000"
              value={draft.weightGrams}
              onChange={(event) => update('weightGrams', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Image</span>
            <select
              value={draft.image}
              onChange={(event) => update('image', event.target.value)}
            >
              {imageOptions(product.image).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Fit</span>
            <select
              value={draft.imageFit}
              onChange={(event) =>
                update('imageFit', event.target.value === 'contain' ? 'contain' : 'cover')
              }
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
          <label className="admin-field admin-field--wide">
            <span>Image filter (CSS, optional)</span>
            <input
              value={draft.imageFilter}
              onChange={(event) => update('imageFilter', event.target.value)}
              placeholder="hue-rotate(65deg) saturate(0.75)"
            />
          </label>
          <label className="admin-field">
            <span>Swatch</span>
            <input
              type="color"
              value={draft.swatch}
              onChange={(event) => update('swatch', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Swatch ink</span>
            <input
              type="color"
              value={draft.swatchInk}
              onChange={(event) => update('swatchInk', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Upper</span>
            <input
              value={draft.upper}
              onChange={(event) => update('upper', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Sole</span>
            <input
              value={draft.sole}
              onChange={(event) => update('sole', event.target.value)}
            />
          </label>
          <label className="admin-field admin-field--wide">
            <span>Description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
          <label className="admin-field admin-field--wide">
            <span>Sizes (comma separated)</span>
            <input
              value={draft.sizesText}
              onChange={(event) => update('sizesText', event.target.value)}
            />
          </label>
        </div>

        <div className="admin-stock">
          {sizes.map((size) => (
            <label key={size}>
              <span>EU {size}</span>
              <input
                type="number"
                min="0"
                max="999"
                value={stock[String(size)] ?? 0}
                onChange={(event) =>
                  setStock((current) => ({
                    ...current,
                    [String(size)]: Number(event.target.value) || 0,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          className="admin-button admin-button--ink"
          onClick={() => void save()}
          disabled={busy}
        >
          {saved ? 'Saved' : busy ? 'Saving...' : 'Save product'}
        </button>
      </div>
    </article>
  );
}
