import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../shared/catalog';
import { useCart } from '../lib/cart';
import { useStore } from '../lib/store';
import { ArrowRight, Close, Minus, Plus } from './Icons';

export default function CartDrawer() {
  const { products, settings } = useStore();
  const {
    lines,
    cartCount,
    subtotalCents,
    isCartOpen,
    closeCart,
    setQuantity,
    removeLine,
  } = useCart();
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart();
        return;
      }

      if (event.key !== 'Tab' || !panel.current) return;

      const focusable = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isCartOpen, closeCart]);

  return (
    <div
      className={`cart-drawer ${isCartOpen ? 'is-open' : ''}`}
      aria-hidden={!isCartOpen}
    >
      <button
        className="cart-drawer__scrim"
        type="button"
        onClick={closeCart}
        aria-label="Close bag"
        tabIndex={isCartOpen ? 0 : -1}
      />

      <aside
        ref={panel}
        className="cart-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="cart-drawer__head">
          <div>
            <p className="eyebrow">GUEST BAG</p>
            <h2 id="cart-title">Your bag ({cartCount})</h2>
          </div>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            onClick={closeCart}
            aria-label="Close bag"
            tabIndex={isCartOpen ? 0 : -1}
          >
            <Close />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="cart-empty">
            <p className="cart-empty__mark">01</p>
            <h3>Nothing in the bag yet.</h3>
            <p>
              {products.length === 0
                ? 'The 01 is between runs. Check back for the next colorway.'
                : `The 01 comes in ${
                    products.length === 1 ? 'one colorway' : `${products.length} colorways`
                  }. Pick a size and we will take it from there.`}
            </p>
            <Link
              className="button button--ink"
              to="/#shop"
              onClick={closeCart}
              tabIndex={isCartOpen ? 0 : -1}
            >
              Shop the 01 <ArrowRight />
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map((line) => {
                const product = products.find(
                  (entry) => entry.id === line.productId,
                );
                if (!product) return null;
                const stock = product.stock[String(line.size)] ?? 0;
                const maxQuantity = Math.min(5, stock);

                return (
                  <article
                    className="cart-line"
                    key={`${line.productId}-${line.size}`}
                  >
                    <div className="cart-line__image">
                      <img
                        src={product.image}
                        alt={`${product.name} in ${product.colorway}`}
                      />
                    </div>
                    <div className="cart-line__body">
                      <div className="cart-line__title">
                        <div>
                          <h3>
                            {product.name} / {product.colorway}
                          </h3>
                          <p>EU {line.size}</p>
                        </div>
                        <span>
                          {formatPrice(product.priceCents * line.quantity)}
                        </span>
                      </div>

                      <div className="cart-line__controls">
                        <div
                          className="quantity"
                          aria-label={`Quantity for ${product.name} ${product.colorway}, size ${line.size}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(
                                line.productId,
                                line.size,
                                line.quantity - 1,
                              )
                            }
                            aria-label="Decrease quantity"
                            tabIndex={isCartOpen ? 0 : -1}
                          >
                            <Minus />
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(
                                line.productId,
                                line.size,
                                line.quantity + 1,
                              )
                            }
                            aria-label="Increase quantity"
                            disabled={line.quantity >= maxQuantity}
                            tabIndex={isCartOpen ? 0 : -1}
                          >
                            <Plus />
                          </button>
                        </div>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => removeLine(line.productId, line.size)}
                          tabIndex={isCartOpen ? 0 : -1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="cart-drawer__foot">
              <div className="cart-total">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotalCents)}</strong>
              </div>
              <p className="cart-note">
                {settings.shippingCents === 0
                  ? 'Free delivery in India.'
                  : settings.freeShippingThresholdCents > 0
                    ? `Free delivery over ${formatPrice(
                        settings.freeShippingThresholdCents,
                      )}.`
                    : 'Delivery calculated at checkout.'}{' '}
                Pay on delivery. No account needed.
              </p>
              <Link
                className="button button--flare button--wide"
                to="/checkout"
                onClick={closeCart}
                tabIndex={isCartOpen ? 0 : -1}
              >
                Checkout <ArrowRight />
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
