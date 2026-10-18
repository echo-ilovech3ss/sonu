import { useEffect, useState, type FormEvent } from 'react';
import { formatPrice } from '../../../shared/catalog';
import {
  ORDER_STATUSES,
  STATUS_COPY,
  type AdminOrder,
  type OrderStatus,
  type PromoCode,
  type PromoCodeInput,
  type StoreSettings,
} from '../../../shared/types';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUSES.indexOf(status);
  return index >= 0 && index < ORDER_STATUSES.length - 1
    ? ORDER_STATUSES[index + 1]
    : null;
}

export function OrdersPanel({
  orders,
  busy,
  onAdvance,
}: {
  orders: AdminOrder[];
  busy: boolean;
  onAdvance: (
    order: AdminOrder,
    status: OrderStatus,
    detail?: string,
  ) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const filtered = orders.filter((order) => {
    const haystack = [
      order.trackingCode,
      order.customerName,
      order.email,
      order.city,
    ]
      .join(' ')
      .toLowerCase();
    return (
      (!query.trim() || haystack.includes(query.trim().toLowerCase())) &&
      (!status || order.status === status)
    );
  });

  const selected =
    orders.find((order) => order.id === selectedId) ?? null;
  const next = selected ? nextStatus(selected.status) : null;

  async function advance() {
    if (!selected || !next) return;
    await onAdvance(selected, next, note.trim() || undefined);
    setNote('');
  }

  return (
    <div className="admin-orders">
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">ORDERS / {orders.length}</p>
          <h2>Every pair, accounted for.</h2>
        </div>
        <div className="admin-filters">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, name, city"
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {STATUS_COPY[entry].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-orders__grid">
        <div className="admin-order-list">
          {filtered.length === 0 ? (
            <p className="admin-empty">No orders match that filter.</p>
          ) : (
            filtered.map((order) => (
              <button
                key={order.trackingCode}
                type="button"
                className={`admin-order-row ${
                  selectedId === order.id ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedId(order.id)}
              >
                <span className="admin-order-row__code">
                  {order.trackingCode}
                </span>
                <span>
                  <strong>{order.customerName}</strong>
                  <small>
                    {order.city} / {formatDate(order.createdAt)}
                  </small>
                </span>
                <span className={`admin-status is-${order.status}`}>
                  {STATUS_COPY[order.status].label}
                </span>
                <span className="admin-order-row__total">
                  {formatPrice(order.totalCents)}
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="admin-order-detail">
          {!selected ? (
            <div className="admin-empty admin-empty--detail">
              <p className="admin-kicker">ORDER DETAIL</p>
              <h3>Pick an order.</h3>
              <p>
                The full delivery address, line items and next status action
                appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-detail-head">
                <div>
                  <p className="admin-kicker">ORDER DETAIL</p>
                  <h3>{selected.trackingCode}</h3>
                </div>
                <span className={`admin-status is-${selected.status}`}>
                  {STATUS_COPY[selected.status].label}
                </span>
              </div>

              <dl className="admin-detail-meta">
                <div>
                  <dt>Customer</dt>
                  <dd>{selected.customerName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selected.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selected.phone ?? 'Not given'}</dd>
                </div>
                <div>
                  <dt>Placed</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt>Ship to</dt>
                  <dd>
                    {selected.addressLine1}
                    {selected.addressLine2 ? `, ${selected.addressLine2}` : ''}
                    <br />
                    {selected.city}
                    {selected.state ? `, ${selected.state}` : ''}{' '}
                    {selected.postalCode}
                    <br />
                    {selected.country}
                  </dd>
                </div>
                <div>
                  <dt>Est. delivery</dt>
                  <dd>{formatDate(selected.estimatedDelivery)}</dd>
                </div>
              </dl>

              <div className="admin-detail-items">
                {selected.items.map((item) => (
                  <div key={`${item.productId}-${item.size}`}>
                    <span>
                      {item.colorway} / EU {item.size} / ×{item.quantity}
                    </span>
                    <strong>{formatPrice(item.unitPriceCents * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              <dl className="admin-detail-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(selected.subtotalCents)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>
                    {selected.shippingCents === 0
                      ? 'Free'
                      : formatPrice(selected.shippingCents)}
                  </dd>
                </div>
                {selected.discountCents > 0 ? (
                  <div>
                    <dt>Promo / {selected.promoCode}</dt>
                    <dd>−{formatPrice(selected.discountCents)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Payment</dt>
                  <dd>
                    {selected.paymentStatus === 'paid'
                      ? 'Paid online'
                      : 'Pay on delivery'}
                  </dd>
                </div>
                {selected.paymentReference ? (
                  <div>
                    <dt>Razorpay payment</dt>
                    <dd>{selected.paymentReference}</dd>
                  </div>
                ) : null}
                <div className="admin-detail-total">
                  <dt>Total</dt>
                  <dd>{formatPrice(selected.totalCents)}</dd>
                </div>
              </dl>

              {next ? (
                <div className="admin-advance">
                  <label>
                    <span>Optional note for the timeline</span>
                    <input
                      type="text"
                      value={note}
                      maxLength={500}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Handed to courier"
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-button admin-button--ink"
                    onClick={() => void advance()}
                    disabled={busy}
                  >
                    {busy
                      ? 'Updating...'
                      : `Mark ${STATUS_COPY[next].label.toLowerCase()}`}
                  </button>
                </div>
              ) : (
                <p className="admin-complete">
                  Delivered. This order is closed.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function promoToForm(promo: PromoCode | null) {
  return {
    code: promo?.code ?? '',
    type: promo?.type ?? ('percent' as const),
    value: promo
      ? promo.type === 'fixed'
        ? String(promo.value / 100)
        : String(promo.value)
      : '10',
    minSubtotal: promo ? String(promo.minSubtotalCents / 100) : '0',
    maxUses: promo?.maxUses ? String(promo.maxUses) : '',
    active: promo?.active ?? true,
    expiresAt: promo?.expiresAt ? promo.expiresAt.slice(0, 10) : '',
  };
}

export function PromosPanel({
  promos,
  busy,
  onCreate,
  onUpdate,
  onDelete,
}: {
  promos: PromoCode[];
  busy: boolean;
  onCreate: (input: PromoCodeInput) => Promise<void>;
  onUpdate: (id: string, input: PromoCodeInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState(() => promoToForm(null));
  const [error, setError] = useState('');

  function startNew() {
    setEditing(null);
    setForm(promoToForm(null));
    setError('');
  }

  function startEdit(promo: PromoCode) {
    setEditing(promo);
    setForm(promoToForm(promo));
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(form.value);
    const minSubtotal = Number(form.minSubtotal);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a value above zero.');
      return;
    }

    const input: PromoCodeInput = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === 'fixed' ? Math.round(value * 100) : Math.round(value),
      minSubtotalCents: Math.max(0, Math.round(minSubtotal * 100)),
      maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
      active: form.active,
      expiresAt: form.expiresAt
        ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
        : null,
    };

    try {
      if (editing) {
        await onUpdate(editing.id, input);
      } else {
        await onCreate(input);
      }
      startNew();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The code could not be saved.',
      );
    }
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">PROMOS / {promos.length}</p>
          <h2>Codes with a job.</h2>
        </div>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          onClick={startNew}
        >
          New code
        </button>
      </div>

      <div className="admin-promos">
        <div className="admin-promo-list">
          {promos.length === 0 ? (
            <p className="admin-empty">No promo codes yet.</p>
          ) : (
            promos.map((promo) => (
              <article key={promo.id} className="admin-promo-row">
                <div>
                  <strong>{promo.code}</strong>
                  <span>
                    {promo.type === 'percent'
                      ? `${promo.value}% off`
                      : `${formatPrice(promo.value)} off`}
                    {promo.minSubtotalCents > 0
                      ? ` / min ${formatPrice(promo.minSubtotalCents)}`
                      : ''}
                  </span>
                </div>
                <div className="admin-promo-meta">
                  <span>
                    {promo.usedCount}
                    {promo.maxUses === null ? ' used' : ` / ${promo.maxUses} used`}
                  </span>
                  <span className={`admin-status ${promo.active ? 'is-confirmed' : 'is-cancelled'}`}>
                    {promo.active ? 'Active' : 'Paused'}
                  </span>
                  {promo.expiresAt ? (
                    <span>Ends {formatDate(promo.expiresAt)}</span>
                  ) : null}
                </div>
                <div className="admin-promo-actions">
                  <button
                    type="button"
                    className="admin-text-button"
                    onClick={() => startEdit(promo)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-text-button is-danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${promo.code}? Existing orders keep their discount.`,
                        )
                      ) {
                        void onDelete(promo.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <form className="admin-promo-form" onSubmit={submit}>
          <div className="admin-form-head">
            <p className="admin-kicker">
              {editing ? `EDIT / ${editing.code}` : 'NEW CODE'}
            </p>
            <h3>{editing ? 'Change the rules.' : 'Make a code.'}</h3>
          </div>

          <label className="admin-field">
            <span>Code</span>
            <input
              type="text"
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="WELCOME10"
              required
              minLength={3}
              maxLength={24}
            />
          </label>

          <div className="admin-field-row">
            <label className="admin-field">
              <span>Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as 'percent' | 'fixed',
                  }))
                }
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed ₹</option>
              </select>
            </label>
            <label className="admin-field">
              <span>{form.type === 'percent' ? 'Percent off' : 'Rupees off'}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>

          <div className="admin-field-row">
            <label className="admin-field">
              <span>Minimum subtotal (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.minSubtotal}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minSubtotal: event.target.value,
                  }))
                }
              />
            </label>
            <label className="admin-field">
              <span>Max uses (blank = ∞)</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxUses: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label className="admin-field">
            <span>Expires (optional)</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expiresAt: event.target.value,
                }))
              }
            />
          </label>

          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
            />
            <span>{form.active ? 'Active' : 'Paused'}</span>
          </label>

          {error ? <p className="admin-error">{error}</p> : null}

          <div className="admin-form-actions">
            <button
              type="submit"
              className="admin-button admin-button--ink"
              disabled={busy}
            >
              {busy ? 'Saving...' : editing ? 'Save changes' : 'Create code'}
            </button>
            {editing ? (
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={startNew}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  busy,
  onSave,
}: {
  settings: StoreSettings;
  busy: boolean;
  onSave: (settings: Partial<StoreSettings>) => Promise<void>;
}) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSave(form);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      // The studio-level notice already explains the failed save.
    }
  }

  return (
    <form className="admin-settings" onSubmit={submit}>
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">STOREFRONT / SETTINGS</p>
          <h2>The shop, edited live.</h2>
        </div>
        <p className="admin-panel-note">
          Copy changes are public on the next page load. Order data is never
          editable here.
        </p>
      </div>

      <div className="admin-settings__grid">
        <fieldset>
          <legend>Identity</legend>
          <label className="admin-field">
            <span>Store name</span>
            <input
              type="text"
              value={form.storeName}
              onChange={(event) => set('storeName', event.target.value)}
              required
              maxLength={40}
            />
          </label>
          <label className="admin-field">
            <span>Announcement</span>
            <input
              type="text"
              value={form.announcement}
              onChange={(event) => set('announcement', event.target.value)}
              maxLength={160}
            />
          </label>
          <label className="admin-field">
            <span>Support email</span>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(event) => set('supportEmail', event.target.value)}
              required
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Hero</legend>
          <label className="admin-field">
            <span>Kicker</span>
            <input
              type="text"
              value={form.heroKicker}
              onChange={(event) => set('heroKicker', event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="admin-field">
            <span>Lede</span>
            <textarea
              value={form.heroLede}
              onChange={(event) => set('heroLede', event.target.value)}
              maxLength={400}
              rows={4}
            />
          </label>
          <label className="admin-field">
            <span>Shop intro</span>
            <textarea
              value={form.shopIntro}
              onChange={(event) => set('shopIntro', event.target.value)}
              maxLength={600}
              rows={4}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Delivery & returns</legend>
          <div className="admin-field-row">
            <label className="admin-field">
              <span>Delivery fee (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.shippingCents / 100}
                onChange={(event) =>
                  set(
                    'shippingCents',
                    Math.max(0, Math.round(Number(event.target.value) * 100)),
                  )
                }
              />
            </label>
            <label className="admin-field">
              <span>Free over (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.freeShippingThresholdCents / 100}
                onChange={(event) =>
                  set(
                    'freeShippingThresholdCents',
                    Math.max(0, Math.round(Number(event.target.value) * 100)),
                  )
                }
              />
            </label>
          </div>
          <label className="admin-field">
            <span>Return window (days)</span>
            <input
              type="number"
              min="0"
              max="365"
              step="1"
              value={form.returnsDays}
              onChange={(event) =>
                set('returnsDays', Math.max(0, Number(event.target.value)))
              }
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Checkout</legend>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={form.codEnabled}
              onChange={(event) => set('codEnabled', event.target.checked)}
            />
            <span>Cash on delivery (COD) is open</span>
          </label>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={form.onlineEnabled}
              onChange={(event) => set('onlineEnabled', event.target.checked)}
            />
            <span>Online payment (Razorpay) is open</span>
          </label>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={form.promosEnabled}
              onChange={(event) => set('promosEnabled', event.target.checked)}
            />
            <span>Show promo code field</span>
          </label>
          <p className="admin-help">
            A free-shipping threshold of ₹0 means no threshold; the delivery fee
            above still applies.
          </p>
        </fieldset>
      </div>

      <div className="admin-settings__actions">
        <button
          type="submit"
          className="admin-button admin-button--ink"
          disabled={busy}
        >
          {saved ? 'Saved' : busy ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
