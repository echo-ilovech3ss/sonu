import { useCallback, useEffect, useState } from 'react';
import { formatPrice } from '../../../shared/catalog';
import type { AnalyticsBuyerRow, AnalyticsSummary } from '../../../shared/types';
import { adminAnalytics, ApiRequestError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import '../../styles/analytics.css';

const countFormatter = new Intl.NumberFormat('en-IN');

const percentFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 1,
});

function formatCount(value: number) {
  return Number.isFinite(value) ? countFormatter.format(value) : '—';
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? `${percentFormatter.format(value)}%` : '—';
}

function summarizeItems(items: AnalyticsBuyerRow['items']) {
  if (items.length === 0) return 'No items';
  return items
    .map(
      (item) =>
        `${item.name} (${item.colorway}) / EU ${item.size} ×${item.quantity}`,
    )
    .join(', ');
}

export function AnalyticsPanel({ adminKey }: { adminKey: string }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setSummary(await adminAnalytics(adminKey));
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : 'Could not load analytics. Try again in a moment.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const busy = loading || refreshing;
  const initialLoading = loading || (refreshing && summary === null);
  const codCount = summary?.paymentSplit.cod ?? 0;
  const razorpayCount = summary?.paymentSplit.razorpay ?? 0;
  const paymentTotal = codCount + razorpayCount;
  const codShare = paymentTotal > 0 ? (codCount / paymentTotal) * 100 : 0;
  const razorpayShare =
    paymentTotal > 0 ? (razorpayCount / paymentTotal) * 100 : 0;

  return (
    <div className="analytics" aria-busy={busy}>
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">ANALYTICS / LIVE</p>
          <h2>What the shop is doing.</h2>
        </div>
        <div className="analytics-head__actions">
          <p className="admin-panel-note">
            Views, orders, and buyers, straight from the store database.
          </p>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={() => void load()}
            disabled={busy}
          >
            {initialLoading
              ? 'Loading...'
              : refreshing
                ? 'Refreshing...'
                : 'Refresh'}
          </button>
        </div>
      </div>

      {initialLoading ? (
        <p className="admin-loading" role="status">
          Loading analytics...
        </p>
      ) : null}

      {!initialLoading && error && !summary ? (
        <div className="analytics-error-state" role="alert">
          <p className="admin-kicker">ANALYTICS UNAVAILABLE</p>
          <p className="analytics-error-state__text">{error}</p>
          <button
            type="button"
            className="admin-button admin-button--ink"
            onClick={() => void load()}
            disabled={refreshing}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!initialLoading && !error && !summary ? (
        <p className="analytics-empty analytics-empty--page">
          No analytics have been recorded yet.
        </p>
      ) : null}

      {summary ? (
        <>
          {error ? (
            <p className="analytics-banner" role="alert">
              {error} Showing the last loaded numbers.
            </p>
          ) : null}

          <section className="analytics-kpis" aria-label="Store totals">
            <div className="analytics-kpi">
              <p className="admin-kicker">ORDERS</p>
              <strong>{formatCount(summary.totals.orders)}</strong>
              <small>Orders placed</small>
            </div>
            <div className="analytics-kpi">
              <p className="admin-kicker">REVENUE</p>
              <strong>{formatPrice(summary.totals.revenueCents)}</strong>
              <small>Order value</small>
            </div>
            <div className="analytics-kpi">
              <p className="admin-kicker">PRODUCT VIEWS</p>
              <strong>{formatCount(summary.totals.productViews)}</strong>
              <small>Product page opens</small>
            </div>
            <div className="analytics-kpi analytics-kpi--pool">
              <p className="admin-kicker">CONVERSION</p>
              <strong>{formatPercent(summary.totals.conversionRate)}</strong>
              <small>Views to orders</small>
            </div>
            <div className="analytics-kpi">
              <p className="admin-kicker">PHONE CAPTURED</p>
              <strong>{formatCount(summary.totals.phoneOrders)}</strong>
              <small>Orders with a phone</small>
            </div>
            <div className="analytics-kpi">
              <p className="admin-kicker">WHATSAPP OPT-IN</p>
              <strong>{formatCount(summary.totals.whatsappOptInOrders)}</strong>
              <small>Orders opted in</small>
            </div>
          </section>

          <section
            className="analytics-section"
            aria-labelledby="analytics-top-products"
          >
            <div className="analytics-section__head">
              <h3 id="analytics-top-products">Top products.</h3>
              <p>{summary.topProducts.length} tracked</p>
            </div>
            {summary.topProducts.length === 0 ? (
              <p className="analytics-empty">
                No product views or purchases yet.
              </p>
            ) : (
              <div
                className="analytics-table-wrap"
                role="region"
                aria-label="Top products table"
                tabIndex={0}
              >
                <table className="analytics-table analytics-table--products">
                  <caption className="analytics-sr-only">
                    Product views, purchases, revenue, and view-to-purchase
                    conversion.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="is-numeric">
                        Views
                      </th>
                      <th scope="col" className="is-numeric">
                        Purchased
                      </th>
                      <th scope="col" className="is-numeric">
                        Revenue
                      </th>
                      <th scope="col" className="is-numeric">
                        Conversion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topProducts.map((row) => {
                      const conversion =
                        row.views > 0
                          ? Math.min(100, (row.purchased / row.views) * 100)
                          : null;
                      return (
                        <tr key={`${row.productId}-${row.colorway}`}>
                          <td>
                            <span className="analytics-product">
                              <strong>{row.name}</strong>
                              <span>{row.colorway}</span>
                            </span>
                          </td>
                          <td className="is-numeric">{formatCount(row.views)}</td>
                          <td className="is-numeric">
                            {formatCount(row.purchased)}
                          </td>
                          <td className="is-numeric">
                            {formatPrice(row.revenueCents)}
                          </td>
                          <td className="is-numeric">
                            <span className="analytics-conversion">
                              <span
                                className="analytics-conversion__meter"
                                aria-hidden="true"
                              >
                                <span
                                  className="analytics-conversion__fill"
                                  style={{
                                    width: `${
                                      conversion === null
                                        ? 0
                                        : Math.min(conversion, 100)
                                    }%`,
                                  }}
                                />
                              </span>
                              <span className="analytics-conversion__value">
                                {conversion === null
                                  ? '—'
                                  : formatPercent(conversion)}
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="analytics-duo">
            <section
              className="analytics-section"
              aria-labelledby="analytics-geography"
            >
              <div className="analytics-section__head">
                <h3 id="analytics-geography">Where they buy.</h3>
                <p>{summary.geography.length} places</p>
              </div>
              {summary.geography.length === 0 ? (
                <p className="analytics-empty">No order locations yet.</p>
              ) : (
                <div
                  className="analytics-table-wrap"
                  role="region"
                  aria-label="Geography table"
                  tabIndex={0}
                >
                  <table className="analytics-table analytics-table--geo">
                    <caption className="analytics-sr-only">
                      Orders and revenue by city, state, and country.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">City</th>
                        <th scope="col">State</th>
                        <th scope="col">Country</th>
                        <th scope="col" className="is-numeric">
                          Orders
                        </th>
                        <th scope="col" className="is-numeric">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.geography.map((row) => (
                        <tr
                          key={`${row.city}-${row.state}-${row.country}`}
                        >
                          <td>{row.city}</td>
                          <td>{row.state || '—'}</td>
                          <td>{row.country}</td>
                          <td className="is-numeric">
                            {formatCount(row.orders)}
                          </td>
                          <td className="is-numeric">
                            {formatPrice(row.revenueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              className="analytics-section"
              aria-labelledby="analytics-payment-split"
            >
              <div className="analytics-section__head">
                <h3 id="analytics-payment-split">How they pay.</h3>
                <p>{formatCount(paymentTotal)} orders</p>
              </div>
              {paymentTotal === 0 ? (
                <p className="analytics-empty">No payments recorded yet.</p>
              ) : (
                <div className="analytics-payment">
                  <div
                    className="analytics-payment__bar"
                    aria-hidden="true"
                  >
                    <span
                      className="analytics-payment__fill is-cod"
                      style={{ width: `${codShare}%` }}
                    />
                    <span
                      className="analytics-payment__fill is-razorpay"
                      style={{ width: `${razorpayShare}%` }}
                    />
                  </div>
                  <div className="analytics-payment__legend">
                    <div>
                      <span
                        className="analytics-payment__dot is-cod"
                        aria-hidden="true"
                      />
                      <span>Cash on delivery</span>
                      <strong>
                        {formatCount(codCount)} / {formatPercent(codShare)}
                      </strong>
                    </div>
                    <div>
                      <span
                        className="analytics-payment__dot is-razorpay"
                        aria-hidden="true"
                      />
                      <span>Razorpay</span>
                      <strong>
                        {formatCount(razorpayCount)} /{' '}
                        {formatPercent(razorpayShare)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section
            className="analytics-section"
            aria-labelledby="analytics-buyers"
          >
            <div className="analytics-section__head">
              <h3 id="analytics-buyers">Recent buyers.</h3>
              <p>{summary.buyers.length} recent</p>
            </div>
            {summary.buyers.length === 0 ? (
              <p className="analytics-empty">
                No orders yet, so there are no buyers to show.
              </p>
            ) : (
              <div
                className="analytics-table-wrap"
                role="region"
                aria-label="Recent buyers table"
                tabIndex={0}
              >
                <table className="analytics-table analytics-table--buyers">
                  <caption className="analytics-sr-only">
                    Recent buyers with tracking code, location, items, total,
                    payment method, contact capture, and order date.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Buyer</th>
                      <th scope="col">Tracking</th>
                      <th scope="col">Location</th>
                      <th scope="col">Items</th>
                      <th scope="col" className="is-numeric">
                        Total
                      </th>
                      <th scope="col">Payment</th>
                      <th scope="col">Phone captured</th>
                      <th scope="col">WhatsApp opt-in</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.buyers.map((buyer) => {
                      const placed = formatDate(buyer.createdAt);
                      const location = [
                        buyer.city,
                        buyer.state,
                        buyer.country,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      const items = summarizeItems(buyer.items);
                      return (
                        <tr key={buyer.orderId}>
                          <td>
                            <span className="analytics-product">
                              <strong>{buyer.customerName}</strong>
                              <span>{buyer.email}</span>
                            </span>
                          </td>
                          <td className="analytics-code">
                            {buyer.trackingCode}
                          </td>
                          <td className="analytics-muted">{location}</td>
                          <td>
                            <span className="analytics-items" title={items}>
                              {items}
                            </span>
                          </td>
                          <td className="is-numeric">
                            {formatPrice(buyer.totalCents)}
                          </td>
                          <td>
                            <span
                              className={`analytics-badge is-${buyer.paymentMethod}`}
                            >
                              {buyer.paymentMethod === 'cod'
                                ? 'COD'
                                : 'Razorpay'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`analytics-badge ${
                                buyer.hasPhone ? 'is-yes' : 'is-no'
                              }`}
                              title={buyer.phone ?? undefined}
                            >
                              {buyer.hasPhone ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`analytics-badge ${
                                buyer.whatsappOptIn ? 'is-yes' : 'is-no'
                              }`}
                            >
                              {buyer.whatsappOptIn ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="analytics-muted">{placed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
