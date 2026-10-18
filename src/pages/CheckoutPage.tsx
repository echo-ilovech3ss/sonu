import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPrice } from '../../shared/catalog';
import type {
  CreateOrderInput,
  PaymentMethod,
  PromoValidation,
} from '../../shared/types';
import { useCart } from '../lib/cart';
import { useStore } from '../lib/store';
import {
  ApiRequestError,
  createOrder,
  createRazorpayIntent,
  fetchPaymentConfig,
  validatePromo,
  type PaymentConfig,
} from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';
import { rememberOrder } from '../lib/storage';
import { ArrowRight, Card, Close, Truck } from '../components/Icons';

export default function CheckoutPage() {
  const { lines, subtotalCents, clearCart } = useCart();
  const { products, settings, refresh } = useStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(
    null,
  );
  const [promoError, setPromoError] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const shippingCents =
    settings.freeShippingThresholdCents > 0 &&
    subtotalCents >= settings.freeShippingThresholdCents
      ? 0
      : settings.shippingCents;
  const discountCents = appliedPromo?.discountCents ?? 0;
  const totalCents = Math.max(
    0,
    subtotalCents - discountCents + shippingCents,
  );
  const deliveryCopy =
    settings.shippingCents === 0
      ? 'We deliver inside India. Free delivery.'
      : settings.freeShippingThresholdCents > 0
        ? `We deliver inside India. Free over ${formatPrice(
            settings.freeShippingThresholdCents,
          )}.`
        : 'We deliver inside India. Delivery is calculated below.';

  const codAvailable = settings.codEnabled;
  const onlineAvailable = paymentConfig?.razorpay.enabled ?? false;

  useEffect(() => {
    let active = true;
    fetchPaymentConfig()
      .then((config) => {
        if (active) setPaymentConfig(config);
      })
      .catch(() => {
        if (active) setPaymentConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!codAvailable && onlineAvailable) setPaymentMethod('razorpay');
    if (!onlineAvailable && codAvailable) setPaymentMethod('cod');
  }, [codAvailable, onlineAvailable]);

  useEffect(() => {
    setAppliedPromo(null);
    setPromoError('');
    setPromoInput('');
  }, [subtotalCents]);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code || checkingPromo) return;

    setCheckingPromo(true);
    setPromoError('');

    try {
      const validation = await validatePromo(code, subtotalCents);
      setAppliedPromo(validation);
      setPromoInput(validation.code);
    } catch (requestError) {
      setAppliedPromo(null);
      setPromoError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : 'That code could not be checked.',
      );
    } finally {
      setCheckingPromo(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();

    const input: CreateOrderInput = {
      customer: {
        name: value('name'),
        email: value('email'),
        phone: value('phone'),
      },
      shipping: {
        addressLine1: value('addressLine1'),
        addressLine2: value('addressLine2') || undefined,
        city: value('city'),
        state: value('state') || undefined,
        postalCode: value('postalCode').replace(/\s+/g, ''),
        country: 'India',
      },
      items: lines,
      promoCode: appliedPromo?.code,
      paymentMethod,
      whatsappOptIn: form.get('whatsappOptIn') === 'on',
    };

    setSubmitting(true);
    setError('');

    try {
      let paidInput = input;
      if (paymentMethod === 'razorpay') {
        const intent = await createRazorpayIntent(input);
        const payment = await openRazorpayCheckout(intent);
        paidInput = { ...input, payment };
      }
      const order = await createOrder(paidInput);
      rememberOrder({
        code: order.trackingCode,
        createdAt: order.createdAt,
        itemCount,
        totalCents: order.totalCents,
      });
      clearCart();
      void refresh();
      navigate(`/track/${order.trackingCode}?new=1`);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError || requestError instanceof Error
          ? requestError.message
          : 'The order did not go through. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <section className="page-shell checkout-page">
        <div className="shell checkout-empty">
          <p className="eyebrow">CHECKOUT / EMPTY BAG</p>
          <h1>Your bag is empty.</h1>
          <p>
            {products.length === 0
              ? 'The 01 is between runs. Check back for the next colorway.'
              : `The 01 comes in ${
                  products.length === 1 ? 'one colorway' : `${products.length} colorways`
                }. Pick a pair before you stand at the counter.`}
          </p>
          <Link className="button button--ink" to="/#shop">
            Shop the 01 <ArrowRight />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell checkout-page" aria-labelledby="checkout-title">
      <div className="shell">
        <div className="checkout-head">
          <div>
            <p className="eyebrow">CHECKOUT / GUEST ORDER</p>
            <h1 id="checkout-title">Almost on your feet.</h1>
          </div>
          <Link className="text-link" to="/#shop">
            Back to the 01
          </Link>
        </div>

        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={submit}>
            <div className="checkout-section">
              <div className="checkout-section__head">
                <span>01</span>
                <div>
                  <h2>Who is it for?</h2>
                  <p>Five required fields. No password.</p>
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Full name</span>
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Arun Mehta"
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <label className="field">
                <span>Phone</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="For delivery calls and order updates"
                  required
                />
              </label>

              <label className="check-field">
                <input type="checkbox" name="whatsappOptIn" defaultChecked />
                <span>
                  <strong>Send this order on WhatsApp</strong>
                  <small>
                    We send the pair, size, photo, and tracking code to this
                    number. Uncheck to skip.
                  </small>
                </span>
              </label>
            </div>

            <div className="checkout-section">
              <div className="checkout-section__head">
                <span>02</span>
                <div>
                  <h2>Where does it go?</h2>
                  <p>{deliveryCopy}</p>
                </div>
              </div>

              <label className="field">
                <span>Address</span>
                <input
                  name="addressLine1"
                  type="text"
                  autoComplete="address-line1"
                  required
                  minLength={4}
                  maxLength={120}
                  placeholder="Flat, building, street"
                />
              </label>
              <label className="field">
                <span>Address line 2 (optional)</span>
                <input
                  name="addressLine2"
                  type="text"
                  autoComplete="address-line2"
                  maxLength={120}
                  placeholder="Landmark, area"
                />
              </label>

              <div className="field-row field-row--three">
                <label className="field">
                  <span>City</span>
                  <input
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Mumbai"
                  />
                </label>
                <label className="field">
                  <span>State (optional)</span>
                  <input
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    maxLength={80}
                    placeholder="Maharashtra"
                  />
                </label>
                <label className="field">
                  <span>PIN code</span>
                  <input
                    name="postalCode"
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    required
                    pattern="[0-9]{3} ?[0-9]{3}"
                    maxLength={7}
                    placeholder="400001"
                  />
                </label>
              </div>

              <div className="country-line">
                <span>Country</span>
                <strong>India</strong>
                <input type="hidden" name="country" value="India" />
              </div>
            </div>

            <div className="checkout-section">
              <div className="checkout-section__head">
                <span>03</span>
                <div>
                  <h2>How do you want to pay?</h2>
                  <p>Pay on delivery or online. No account needed.</p>
                </div>
              </div>

              <div className="payment-methods">
                {codAvailable ? (
                  <button
                    type="button"
                    className={`payment-option ${
                      paymentMethod === 'cod' ? 'is-selected' : ''
                    }`}
                    aria-pressed={paymentMethod === 'cod'}
                    onClick={() => setPaymentMethod('cod')}
                  >
                    <Truck />
                    <div>
                      <strong>Pay on delivery</strong>
                      <p>Cash or UPI when the pair reaches your door.</p>
                    </div>
                    <span className="payment-option__check">
                      {paymentMethod === 'cod' ? 'Selected' : 'Choose'}
                    </span>
                  </button>
                ) : null}

                {onlineAvailable ? (
                  <button
                    type="button"
                    className={`payment-option ${
                      paymentMethod === 'razorpay' ? 'is-selected' : ''
                    }`}
                    aria-pressed={paymentMethod === 'razorpay'}
                    onClick={() => setPaymentMethod('razorpay')}
                  >
                    <Card />
                    <div>
                      <strong>Pay online</strong>
                      <p>
                        UPI, card or netbanking via Razorpay.
                        {paymentConfig?.razorpay.testMode
                          ? ' Test mode — no real charge.'
                          : ''}
                      </p>
                    </div>
                    <span className="payment-option__check">
                      {paymentMethod === 'razorpay' ? 'Selected' : 'Choose'}
                    </span>
                  </button>
                ) : null}
              </div>

              {!codAvailable && !onlineAvailable ? (
                <p className="form-error form-error--box">
                  Payments are paused. Please check back shortly.
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="form-error form-error--box" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="button button--flare button--wide checkout-submit"
              type="submit"
              disabled={submitting || (!codAvailable && !onlineAvailable)}
              aria-busy={submitting}
            >
              {submitting
                ? paymentMethod === 'razorpay'
                  ? 'Completing payment...'
                  : 'Placing order...'
                : paymentMethod === 'razorpay'
                  ? `Pay ${formatPrice(totalCents)}`
                  : 'Place order'}
              {submitting ? null : <ArrowRight />}
            </button>

            <p className="checkout-note">
              Placing the order stores your details and request IP on our server
              so we can fulfil it and prevent abuse. We do not create an
              account.
            </p>
          </form>

          <aside className="order-summary" aria-labelledby="summary-title">
            <div className="order-summary__head">
              <p className="eyebrow">ORDER SUMMARY</p>
              <h2 id="summary-title">{itemCount} {itemCount === 1 ? 'pair' : 'pairs'}</h2>
            </div>

            <div className="order-summary__lines">
              {lines.map((line) => {
                const product = products.find(
                  (entry) => entry.id === line.productId,
                );
                if (!product) return null;

                return (
                  <div className="summary-line" key={`${line.productId}-${line.size}`}>
                    <div className="summary-line__image">
                      <img
                        src={product.image}
                        alt={`${product.name} in ${product.colorway}`}
                      />
                    </div>
                    <div className="summary-line__body">
                      <strong>
                        {product.name} / {product.colorway}
                      </strong>
                      <span>
                        EU {line.size} / Qty {line.quantity}
                      </span>
                    </div>
                    <span>{formatPrice(product.priceCents * line.quantity)}</span>
                  </div>
                );
              })}
            </div>

            {settings.promosEnabled ? (
              <div className="promo-box">
                <label htmlFor="promo-code">Promo code</label>
                <div className="promo-box__row">
                  <input
                    id="promo-code"
                    type="text"
                    value={promoInput}
                    onChange={(event) =>
                      setPromoInput(event.target.value.toUpperCase())
                    }
                    placeholder="WELCOME10"
                    autoComplete="off"
                    maxLength={24}
                    disabled={Boolean(appliedPromo) || checkingPromo}
                  />
                  {appliedPromo ? (
                    <button
                      type="button"
                      className="promo-box__remove"
                      onClick={removePromo}
                      aria-label="Remove promo code"
                    >
                      <Close />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="promo-box__apply"
                      onClick={() => void applyPromo()}
                      disabled={checkingPromo || promoInput.trim().length === 0}
                    >
                      {checkingPromo ? 'Checking' : 'Apply'}
                    </button>
                  )}
                </div>
                {promoError ? (
                  <p className="promo-box__message is-error" role="alert">
                    {promoError}
                  </p>
                ) : null}
                {appliedPromo ? (
                  <p className="promo-box__message is-success">
                    {appliedPromo.code} applied: {appliedPromo.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            <dl className="summary-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotalCents)}</dd>
              </div>
              {appliedPromo ? (
                <div>
                  <dt>Promo / {appliedPromo.code}</dt>
                  <dd>−{formatPrice(discountCents)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Delivery</dt>
                <dd>
                  {shippingCents === 0
                    ? 'Free'
                    : formatPrice(shippingCents)}
                </dd>
              </div>
              <div className="summary-totals__grand">
                <dt>Total</dt>
                <dd>{formatPrice(totalCents)}</dd>
              </div>
            </dl>

            <div className="summary-tracking">
              <span>After you order</span>
              <p>
                You get a tracking code like <strong>SNU-7K4P-9Q2M</strong>. It
                is the only thing you need to see where the pair is.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
