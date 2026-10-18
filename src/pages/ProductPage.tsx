import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPrice, type Product } from '../../shared/catalog';
import { useCart } from '../lib/cart';
import { useStore } from '../lib/store';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Minus,
  Plus,
  Truck,
} from '../components/Icons';

function imageStyle(product: Product): CSSProperties {
  return {
    filter: [
      product.imageFilter,
      'drop-shadow(0 30px 24px rgba(20, 21, 18, 0.24))',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, settings } = useStore();
  const { addLine, openCart } = useCart();

  const product =
    products.find((entry) => entry.id === id) ?? null;
  const productId = product?.id;

  const [shown, setShown] = useState<Product | null>(product);
  const [leaving, setLeaving] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!product) {
      setShown(null);
      setLeaving(null);
      return;
    }

    if (!shown) {
      setShown(product);
      return;
    }

    if (shown.id !== product.id) {
      setLeaving(shown);
      setShown(product);
      return;
    }

    if (shown !== product) setShown(product);
  }, [product, shown]);

  useEffect(() => {
    if (!leaving) return;

    const timer = window.setTimeout(() => setLeaving(null), 700);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    setSelectedSize(null);
    setAdded(false);
  }, [productId]);

  useEffect(() => {
    setQuantity(1);
  }, [productId, selectedSize]);

  useEffect(() => {
    if (!productId) return;

    void fetch('/api/analytics/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId }),
      keepalive: true,
    }).catch(() => {
      // View tracking is best effort and must never block the page.
    });
  }, [productId]);

  useEffect(
    () => () => {
      if (addTimer.current) window.clearTimeout(addTimer.current);
    },
    [],
  );

  if (!product) {
    return (
      <section
        className="page-shell product-page product-page--missing"
        aria-labelledby="product-missing-title"
      >
        <div className="shell">
          <div className="product-page__missing">
            <p className="eyebrow">SONU / OFF THE RUN</p>
            <h1 id="product-missing-title">That pair isn’t here.</h1>
            <p>
              The colorway may have sold through, or the link took a wrong
              turn. The rest of the run is still on the shelf.
            </p>
            <Link className="button button--ink" to="/#shop">
              Back to the collection <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const visual = shown ?? product;
  const modelNumber = product.name.replace(/^The\s+/i, '');
  const models = [...new Set(products.map((entry) => entry.name))];
  const colorways = products.filter(
    (entry) => entry.name === product.name,
  );
  const selectedStock = selectedSize
    ? (product.stock[String(selectedSize)] ?? 0)
    : 0;
  const maxQuantity = Math.min(5, selectedStock);

  const productIndex = products.findIndex(
    (entry) => entry.id === product.id,
  );
  const previousProduct =
    products.length > 1 && productIndex >= 0
      ? products[(productIndex - 1 + products.length) % products.length]
      : null;
  const nextProduct =
    products.length > 1 && productIndex >= 0
      ? products[(productIndex + 1) % products.length]
      : null;

  function addToBag() {
    if (!product || !selectedSize || maxQuantity <= 0) return;

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
    <section
      className="page-shell product-page"
      aria-labelledby="product-title"
    >
      <div className="shell">
        <nav className="product-page__crumbs" aria-label="Breadcrumb">
          <Link to="/#shop">Shop</Link>
          <span aria-hidden="true">/</span>
          <span>{product.name}</span>
          <span aria-hidden="true">/</span>
          <span>{product.colorway}</span>
        </nav>

        <div className="product-page__layout">
          <div
            className={`product-page__stage product-page__stage--${visual.imageFit}`}
            style={{
              backgroundColor: `color-mix(in srgb, ${visual.swatch} 30%, var(--paper))`,
            }}
          >
            {leaving && leaving.id !== visual.id ? (
              <img
                className={`product-page__image product-page__image--${leaving.imageFit} is-leaving`}
                src={leaving.image}
                alt=""
                aria-hidden="true"
                style={imageStyle(leaving)}
              />
            ) : null}

            <img
              key={visual.id}
              className={`product-page__image product-page__image--${visual.imageFit} is-entering`}
              src={visual.image}
              alt={`${visual.name} in ${visual.colorway}`}
              style={imageStyle(visual)}
            />

            <span
              key={`index-${product.id}`}
              className="product-page__stage-index"
              aria-hidden="true"
            >
              {modelNumber}
            </span>

            <div
              key={`chrome-${product.id}`}
              className="product-page__stage-chrome"
              aria-hidden="true"
            >
              <div className="product-page__stage-top">
                <span>SONU / {modelNumber}</span>
                <span>MADE IN MUMBAI</span>
              </div>
              <div className="product-page__stage-bottom">
                <span>
                  <small>COLORWAY</small>
                  <strong>{product.colorway}</strong>
                </span>
                <span>
                  <small>PRICE</small>
                  <strong>{formatPrice(product.priceCents)}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="product-page__panel">
            <div
              key={`heading-${product.id}`}
              className="product-page__heading"
            >
              <p className="eyebrow">
                SONU / {modelNumber} / {product.colorway.toUpperCase()}
              </p>
              <h1 id="product-title">{product.name}</h1>
              <div className="product-page__meta">
                <span className="product-page__colorway">
                  {product.colorway}
                </span>
                <strong className="product-page__price">
                  {formatPrice(product.priceCents)}
                </strong>
              </div>
              <p className="product-page__description">
                {product.description}
              </p>
            </div>

            {models.length > 1 ? (
              <fieldset className="option-group">
                <legend>
                  Model <span>{models.length} styles</span>
                </legend>
                <div className="model-tabs">
                  {models.map((name) => {
                    const entries = products.filter(
                      (entry) => entry.name === name,
                    );
                    const first = entries[0];
                    const isSelected = name === product.name;

                    return (
                      <button
                        key={name}
                        type="button"
                        className={`model-tab ${
                          isSelected ? 'is-selected' : ''
                        }`}
                        onClick={() => {
                          if (first.id !== product.id) {
                            navigate(`/product/${first.id}`, {
                              replace: true,
                            });
                          }
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
                            {entries.length === 1
                              ? 'colorway'
                              : 'colorways'}
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
                    style={
                      {
                        '--swatch': entry.swatch,
                        '--swatch-ink': entry.swatchInk,
                      } as CSSProperties
                    }
                    onClick={() => {
                      if (entry.id !== product.id) {
                        navigate(`/product/${entry.id}`, {
                          replace: true,
                        });
                      }
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
                      onClick={() => {
                        setSelectedSize(size);
                        setAdded(false);
                      }}
                      aria-pressed={selectedSize === size}
                      aria-label={`EU ${size}${
                        stock === 0 ? ', sold out' : ''
                      }`}
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
                  EU 42 fits a 27 cm foot. If you are between sizes, take
                  the larger one. The leather gives a little after a week.
                </p>
              </details>
            </fieldset>

            <div className="product-page__quantity">
              <span>Pairs</span>
              <div className="quantity" aria-label="Quantity">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  aria-label="Decrease pairs"
                  disabled={!selectedSize || quantity <= 1}
                >
                  <Minus />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(maxQuantity, current + 1),
                    )
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
            <p className="product-page__micro" aria-live="polite">
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

            <div className="product-page__service">
              <div className="product-page__service-card">
                <Truck aria-hidden="true" />
                <strong>Delivery</strong>
                <p>
                  {settings.shippingCents === 0
                    ? 'Free delivery across India.'
                    : 'Delivery is calculated at checkout.'}{' '}
                  Ships in 3 to 6 working days.
                </p>
              </div>
              <div className="product-page__service-card">
                <Check aria-hidden="true" />
                <strong>Returns</strong>
                <p>
                  {settings.returnsDays}-day returns on unworn pairs in the
                  original box.
                </p>
              </div>
            </div>

            <Link className="text-link product-page__track" to="/track">
              Track an order <ArrowUpRight />
            </Link>

            {previousProduct && nextProduct ? (
              <nav
                className="product-page__pager"
                aria-label="Browse shoes"
              >
                <Link
                  className="product-pager product-pager--prev"
                  to={`/product/${previousProduct.id}`}
                  aria-label={`Previous shoe: ${previousProduct.name} in ${previousProduct.colorway}`}
                >
                  <ArrowRight
                    className="product-pager__icon"
                    aria-hidden="true"
                  />
                  <span className="product-pager__copy">
                    <small>Previous shoe</small>
                    <strong>
                      {previousProduct.name} / {previousProduct.colorway}
                    </strong>
                  </span>
                </Link>
                <Link
                  className="product-pager product-pager--next"
                  to={`/product/${nextProduct.id}`}
                  aria-label={`Next shoe: ${nextProduct.name} in ${nextProduct.colorway}`}
                >
                  <span className="product-pager__copy">
                    <small>Next shoe</small>
                    <strong>
                      {nextProduct.name} / {nextProduct.colorway}
                    </strong>
                  </span>
                  <ArrowRight
                    className="product-pager__icon"
                    aria-hidden="true"
                  />
                </Link>
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
