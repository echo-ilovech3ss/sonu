import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PRODUCTS, formatPrice } from '../../shared/catalog';
import { useCart } from '../lib/cart';
import { useStore } from '../lib/store';
import { ArrowRight, Check, Close, Minus, Plus } from './Icons';

export default function ProductConfigurator() {
  const { products, settings } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').trim();
  const requestedProductId = searchParams.get('product');
  const available = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((entry) =>
      [entry.name, entry.colorway, entry.upper, entry.description]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [products, searchQuery]);
  const [selectedId, setSelectedId] = useState(
    available[0]?.id ?? PRODUCTS[0].id,
  );
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addTimer = useRef<number | null>(null);
  const appliedRequest = useRef<string | null>(null);
  const { addLine, openCart } = useCart();

  const product =
    available.find((entry) => entry.id === selectedId) ?? available[0];
  const selectedStock =
    selectedSize && product ? (product.stock[String(selectedSize)] ?? 0) : 0;
  const maxQuantity = Math.min(5, selectedStock);
  const models = [...new Set(available.map((entry) => entry.name))];
  const selectedModel = product?.name ?? models[0] ?? '';
  const colorways = available.filter((entry) => entry.name === selectedModel);

  useEffect(() => {
    const requested = requestedProductId
      ? available.find((entry) => entry.id === requestedProductId)
      : undefined;
    if (requested && appliedRequest.current !== requestedProductId) {
      appliedRequest.current = requestedProductId;
      setSelectedId(requested.id);
      setSelectedSize(null);
      return;
    }
    if (!available.some((entry) => entry.id === selectedId) && available[0]) {
      setSelectedId(available[0].id);
      setSelectedSize(null);
    }
  }, [available, requestedProductId, selectedId]);

  useEffect(() => {
    setQuantity(1);
  }, [selectedId, selectedSize]);

  useEffect(() => {
    return () => {
      if (addTimer.current) window.clearTimeout(addTimer.current);
    };
  }, []);

  function addToBag() {
    if (!selectedSize || maxQuantity <= 0) return;

    addLine({
      productId: product.id,
      size: selectedSize,
      quantity: Math.min(quantity, maxQuantity),
    });
    setAdded(true);
    openCart();

    if (addTimer.current) window.clearTimeout(addTimer.current);
    addTimer.current = window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <section className="section shop" id="shop" aria-labelledby="shop-title">
      <div className="shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              {searchQuery
                ? `SEARCH / ${available.length} ${
                    available.length === 1 ? 'MATCH' : 'MATCHES'
                  }`
                : `THE COLLECTION / ${available.length} ${
                    available.length === 1 ? 'PAIR' : 'PAIRS'
                  }`}
            </p>
            <h2 id="shop-title">
              Pick a pair.
              <br />
              Pick a size.
            </h2>
          </div>
          <p>{settings.shopIntro}</p>
        </div>

        {searchQuery ? (
          <div className="shop-search-note">
            <span>
              Showing {available.length} {available.length === 1 ? 'pair' : 'pairs'} for{' '}
              <strong>“{searchQuery}”</strong>
            </span>
            <button
              type="button"
              className="shop-search-note__clear"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Clear search <Close />
            </button>
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="shop-empty">
            <p className="eyebrow">BETWEEN RUNS</p>
            <h3>Every colorway is resting.</h3>
            <p>
              The next run is being finished. Check back shortly, or track an
              existing order.
            </p>
            <a className="button button--ghost" href="/track">
              Track an order <ArrowRight />
            </a>
          </div>
        ) : !product ? (
          <div className="shop-empty">
            <p className="eyebrow">NO MATCH</p>
            <h3>Nothing in that search.</h3>
            <p>
              Try a model, a colorway, or a material. The whole run is below.
            </p>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Show every pair <ArrowRight />
            </button>
          </div>
        ) : (
        <div className="shop__grid">
          <div
            className={`product-stage product-stage--${product.imageFit}`}
            style={{
              backgroundColor: `color-mix(in srgb, ${product.swatch} 30%, var(--paper))`,
            }}
          >
            <div className="product-stage__top">
              <span>SONU / {product.name.replace(/^The\s+/i, '')}</span>
              <span>MADE IN MUMBAI</span>
            </div>

            <span className="product-stage__index" aria-hidden="true">
              {product.name.replace(/^The\s+/i, '')}
            </span>

            <img
              className="product-stage__image"
              src={product.image}
              alt={`${product.name} in ${product.colorway}`}
              style={{
                filter: [
                  product.imageFilter,
                  'drop-shadow(0 28px 24px rgba(20, 21, 18, 0.2))',
                ]
                  .filter(Boolean)
                  .join(' '),
              }}
            />

            <div className="product-stage__bottom">
              <div>
                <p className="eyebrow">COLORWAY</p>
                <strong>{product.colorway}</strong>
              </div>
              <div>
                <p className="eyebrow">PRICE</p>
                <strong>{formatPrice(product.priceCents)}</strong>
              </div>
            </div>
          </div>

          <div className="product-panel">
            <div className="product-panel__heading">
              <div>
                <p className="eyebrow">SONU / DAILY FOOTWEAR</p>
                <h3>{product.name}</h3>
              </div>
              <span className="product-panel__price">
                {formatPrice(product.priceCents)}
              </span>
            </div>

            <p className="product-panel__description">{product.description}</p>

            <Link
              className="text-link product-panel__detail-link"
              to={`/product/${product.id}`}
            >
              Full details, sizing and delivery <ArrowRight />
            </Link>

            {models.length > 1 ? (
              <fieldset className="option-group">
                <legend>
                  Model <span>{models.length} styles</span>
                </legend>
                <div className="model-tabs">
                  {models.map((name) => {
                    const entries = available.filter(
                      (entry) => entry.name === name,
                    );
                    const first = entries[0];
                    const isSelected = name === selectedModel;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`model-tab ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedId(first.id);
                          setSelectedSize(null);
                          setAdded(false);
                        }}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="model-tab__swatch"
                          style={{ backgroundColor: first.swatch }}
                          aria-hidden="true"
                        />
                        <span className="model-tab__copy">
                          <strong>{name}</strong>
                          <small>
                            {entries.length}{' '}
                            {entries.length === 1 ? 'colorway' : 'colorways'}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <fieldset className="option-group">
              <legend>
                Colorway <span>{product.colorway}</span>
              </legend>
              <div className="swatches">
                {colorways.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`swatch ${
                      entry.id === product.id ? 'is-selected' : ''
                    }`}
                    style={{
                      '--swatch': entry.swatch,
                      '--swatch-ink': entry.swatchInk,
                    } as CSSProperties}
                    onClick={() => {
                      setSelectedId(entry.id);
                      setSelectedSize(null);
                      setAdded(false);
                    }}
                    aria-pressed={entry.id === product.id}
                    aria-label={`${entry.colorway} colorway`}
                  >
                    <span />
                    {entry.colorway}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="option-group">
              <legend>
                Size <span>EU</span>
              </legend>
              <div className="size-grid">
                {product.sizes.map((size) => {
                  const stock = product.stock[String(size)] ?? 0;
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`size-button ${
                        selectedSize === size ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={selectedSize === size}
                      aria-label={`EU ${size}${stock === 0 ? ', sold out' : ''}`}
                      title={stock === 0 ? 'Sold out' : undefined}
                      disabled={stock === 0}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <details className="size-note">
                <summary>Size note</summary>
                <p>
                  EU 42 fits a 27 cm foot. If you are between sizes, take the
                  larger one. The leather gives a little after a week.
                </p>
              </details>
            </fieldset>

            <div className="product-quantity">
              <span>Pairs</span>
              <div className="quantity" aria-label="Quantity">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  aria-label="Decrease pairs"
                  disabled={!selectedSize || quantity <= 1}
                >
                  <Minus />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.min(maxQuantity, current + 1))
                  }
                  aria-label="Increase pairs"
                  disabled={!selectedSize || quantity >= maxQuantity}
                >
                  <Plus />
                </button>
              </div>
            </div>

            <button
              className="button button--ink button--wide add-button"
              type="button"
              onClick={addToBag}
              disabled={!selectedSize || selectedStock === 0}
            >
              {added ? (
                <>
                  Added to bag <Check />
                </>
              ) : selectedSize ? (
                <>
                  Add {quantity > 1 ? `${quantity} pairs` : 'to bag'}{' '}
                  <span>
                    {formatPrice(product.priceCents * quantity)}
                  </span>
                </>
              ) : (
                <>
                  Choose a size <ArrowRight />
                </>
              )}
            </button>
            <p className="product-panel__micro" aria-live="polite">
              {added
                ? 'Your bag is open. Checkout takes five fields.'
                : 'No account. No password. A tracking code follows your order.'}
            </p>

            <dl className="product-specs">
              <div>
                <dt>Upper</dt>
                <dd>{product.upper}</dd>
              </div>
              <div>
                <dt>Sole</dt>
                <dd>{product.sole}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{product.weightGrams} g</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>3 to 6 working days</dd>
              </div>
            </dl>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
