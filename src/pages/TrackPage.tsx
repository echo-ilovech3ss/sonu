import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  STATUS_COPY,
  type PublicOrder,
} from '../../shared/types';
import { formatPrice } from '../../shared/catalog';
import { ApiRequestError, fetchOrder, normalizeTrackingCode } from '../lib/api';
import { formatDate } from '../lib/format';
import TrackingForm from '../components/TrackingForm';
import RecentOrders from '../components/RecentOrders';
import OrderTimeline from '../components/OrderTimeline';
import { ArrowRight, Check, Copy } from '../components/Icons';

export default function TrackPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const normalizedCode = code ? normalizeTrackingCode(code) : '';
  const isNew = searchParams.get('new') === '1';

  useEffect(() => {
    if (!normalizedCode) {
      setOrder(null);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchOrder(normalizedCode)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setOrder(null);
        setError(
          requestError instanceof ApiRequestError && requestError.status === 404
            ? 'We could not find that code. Check the letters and numbers, then try again.'
            : 'The tracking service did not answer. Try again in a moment.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedCode, refreshToken]);

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="page-shell track-page" aria-labelledby="track-title">
      <div className="shell">
        <div className="track-head">
          <div>
            <p className="eyebrow">ORDER TRACKING / GUEST ORDER</p>
            <h1 id="track-title">
              {isNew && order?.status === 'confirmed'
                ? 'Order confirmed.'
                : 'Track your pair.'}
            </h1>
          </div>
          {!code ? (
            <p>
              Enter the tracking code from your confirmation. No account, no
              password. The code is the key.
            </p>
          ) : null}
        </div>

        {!code ? (
          <div className="track-landing">
            <div className="track-landing__form">
              <TrackingForm />
            </div>
            <RecentOrders limit={6} />
          </div>
        ) : null}

        {loading && !order ? (
          <div className="track-loading" aria-live="polite">
            <span className="track-loading__bar" />
            <p>Looking up {normalizedCode}...</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="track-error" role="alert">
            <p className="eyebrow">NO MATCH</p>
            <h2>{error}</h2>
            <TrackingForm initialCode={normalizedCode} compact />
            <Link className="text-link" to="/track">
              Clear and start again <ArrowRight />
            </Link>
          </div>
        ) : null}

        {order ? (
          <div className="track-result">
            {isNew ? (
              <div className="track-success">
                <div>
                  <p className="eyebrow">YOUR TRACKING CODE</p>
                  <div className="track-code">
                    <code>{order.trackingCode}</code>
                    <button
                      className="icon-button icon-button--dark"
                      type="button"
                      onClick={() => copyCode(order.trackingCode)}
                      aria-label="Copy tracking code"
                    >
                      {copied ? <Check /> : <Copy />}
                    </button>
                  </div>
                  <p>
                    Save this code. It is the only thing you need to see where
                    your pair is. A copy is saved on this device.
                  </p>
                </div>
                <span className="track-success__stamp">SAVED</span>
              </div>
            ) : null}

            <div className="order-card">
              <div className="order-card__top">
                <div>
                  <p className="eyebrow">ORDER {order.trackingCode}</p>
                  <h2>{order.customerName}</h2>
                  <p className="order-card__placed">
                    Placed {formatDate(order.createdAt)}
                  </p>
                </div>
                <span className={`status-pill status-pill--${order.status}`}>
                  {STATUS_COPY[order.status].short}
                </span>
              </div>

              <div className="order-card__meta">
                <div>
                  <span>Estimated delivery</span>
                  <strong>{formatDate(order.estimatedDelivery)}</strong>
                </div>
                <div>
                  <span>Shipping to</span>
                  <strong>{order.shippingCity}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatPrice(order.totalCents)}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>
                    {order.paymentStatus === 'paid'
                      ? 'Paid online'
                      : 'Pay on delivery'}
                  </strong>
                </div>
              </div>

              <div className="order-card__body">
                <div>
                  <div className="order-card__section-head">
                    <p className="eyebrow">PROGRESS</p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setRefreshToken((token) => token + 1)}
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading ? 'Refreshing...' : 'Refresh status'}
                    </button>
                  </div>
                  <OrderTimeline order={order} />
                </div>

                <div>
                  <p className="eyebrow">IN THIS ORDER</p>
                  <div className="order-items">
                    {order.items.map((item) => (
                      <div
                        className="order-item"
                        key={`${item.productId}-${item.size}`}
                      >
                        <div className="order-item__image">
                          <img
                            src={item.image}
                            alt={`${item.name} in ${item.colorway}`}
                          />
                        </div>
                        <div>
                          <strong>
                            {item.name} / {item.colorway}
                          </strong>
                          <span>
                            EU {item.size} / Qty {item.quantity}
                          </span>
                        </div>
                        <span>
                          {formatPrice(item.unitPriceCents * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="order-card__foot">
                <div>
                  <p className="eyebrow">NEED TO CHANGE SOMETHING?</p>
                  <p>
                    Email{' '}
                    <a href="mailto:hello@sonu.example">hello@sonu.example</a>{' '}
                    with your code. We will answer within one working day.
                  </p>
                </div>
                <Link className="button button--ghost" to="/track">
                  Track another order <ArrowRight />
                </Link>
              </div>
            </div>

            <RecentOrders limit={6} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
