import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, type Product } from '../../shared/catalog';
import type {
  AdminOrder,
  AdminSummary,
  CreateProductInput,
  OrderStatus,
  ProductUpdate,
  PromoCode,
  PromoCodeInput,
  StoreSettings,
} from '../../shared/types';
import {
  adminAdvanceOrder,
  adminCreateProduct,
  adminCreatePromo,
  adminDeletePromo,
  adminOrders,
  adminProducts,
  adminPromoCodes,
  adminSettings,
  adminSummary,
  adminUpdateProduct,
  adminUpdatePromo,
  adminUpdateSettings,
  ApiRequestError,
} from '../lib/api';
import {
  OrdersPanel,
  PromosPanel,
  SettingsPanel,
} from './admin/AdminPanels';
import { CatalogPanel } from './admin/CatalogPanel';
import { WhatsAppPanel } from './admin/WhatsAppPanel';
import { AnalyticsPanel } from './admin/AnalyticsPanel';

const KEY_STORAGE = 'sonu.admin.key';
type Tab =
  | 'orders'
  | 'catalog'
  | 'analytics'
  | 'promos'
  | 'settings'
  | 'whatsapp';

const tabs: { id: Tab; label: string; number: string }[] = [
  { id: 'orders', label: 'Orders', number: '01' },
  { id: 'catalog', label: 'Catalog', number: '02' },
  { id: 'analytics', label: 'Analytics', number: '03' },
  { id: 'promos', label: 'Promos', number: '04' },
  { id: 'settings', label: 'Storefront', number: '05' },
  { id: 'whatsapp', label: 'WhatsApp', number: '06' },
];

export default function AdminPage() {
  const [key, setKey] = useState(() => {
    try {
      return (window.localStorage.getItem(KEY_STORAGE) ?? '').trim();
    } catch {
      return '';
    }
  });
  const [authed, setAuthed] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [tab, setTab] = useState<Tab>('orders');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    document.title = 'SONU — Studio';
  }, []);

  const loadAll = useCallback(
    async (adminKey: string): Promise<boolean> => {
      setBusy(true);
      try {
        const [nextSummary, nextOrders, nextProducts, nextPromos, nextSettings] =
          await Promise.all([
            adminSummary(adminKey),
            adminOrders(adminKey),
            adminProducts(adminKey),
            adminPromoCodes(adminKey),
            adminSettings(adminKey),
          ]);
        setSummary(nextSummary);
        setOrders(nextOrders);
        setProducts(nextProducts);
        setPromos(nextPromos);
        setSettings(nextSettings);
        setAuthed(true);
        setError('');
        return true;
      } catch (requestError) {
        setAuthed(false);
        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Could not reach the studio.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (autoChecked || !key) return;
    setAutoChecked(true);
    void loadAll(key);
  }, [autoChecked, key, loadAll]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || checking) return;

    setChecking(true);
    setError('');
    const opened = await loadAll(trimmed);
    if (opened) {
      setAutoChecked(true);
      setKey(trimmed);
      try {
        window.localStorage.setItem(KEY_STORAGE, trimmed);
      } catch {
        // The key still works for this session.
      }
    } else {
      setError('The studio key was rejected.');
    }
    setChecking(false);
  }

  function logout() {
    try {
      window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      // The session lock still works without storage.
    }
    setKey('');
    setAuthed(false);
    setSummary(null);
    setOrders([]);
    setProducts([]);
    setPromos([]);
    setSettings(null);
  }

  async function refresh(message?: string) {
    await loadAll(key);
    if (message) setNotice({ kind: 'success', text: message });
  }

  async function advanceOrder(
    order: AdminOrder,
    status: OrderStatus,
    detail?: string,
  ) {
    try {
      await adminAdvanceOrder(key, order.id, status, detail);
      await refresh(`${order.trackingCode} moved to ${status}.`);
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The status did not change.',
      });
    }
  }

  async function createProduct(input: CreateProductInput) {
    try {
      await adminCreateProduct(key, input);
      await refresh(`${input.name} / ${input.colorway} added.`);
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The shoe did not save.',
      });
      throw requestError;
    }
  }

  async function saveProduct(id: string, update: ProductUpdate) {
    try {
      await adminUpdateProduct(key, id, update);
      await refresh('Product saved.');
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The product did not save.',
      });
      throw requestError;
    }
  }

  async function createPromo(input: PromoCodeInput) {
    try {
      await adminCreatePromo(key, input);
      await refresh(`${input.code} created.`);
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The code did not save.',
      });
      throw requestError;
    }
  }

  async function updatePromo(id: string, input: PromoCodeInput) {
    try {
      await adminUpdatePromo(key, id, input);
      await refresh(`${input.code} updated.`);
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The code did not save.',
      });
      throw requestError;
    }
  }

  async function deletePromo(id: string) {
    try {
      await adminDeletePromo(key, id);
      await refresh('Code deleted.');
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'The code did not delete.',
      });
    }
  }

  async function saveSettings(next: Partial<StoreSettings>) {
    try {
      await adminUpdateSettings(key, next);
      await refresh('Storefront copy saved.');
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Settings did not save.',
      });
      throw requestError;
    }
  }

  if (!authed) {
    return (
      <main className="admin-login">
        <div className="admin-login__brand">
          <p className="admin-kicker">SONU / PRIVATE STUDIO</p>
          <h1>
            The back
            <br />
            of the shop.
          </h1>
          <p>
            Orders, stock, promo codes and storefront copy. The customer side
            never asks for an account, so this is the only door in.
          </p>
          <Link to="/">← Back to the store</Link>
        </div>

        <form className="admin-login__form" onSubmit={login}>
          <p className="admin-kicker">ACCESS KEY</p>
          <h2>Open the studio.</h2>
          <p>
            Set <code>SONU_ADMIN_KEY</code> in the server environment. The key
            stays in this browser until you lock it.
          </p>
          <label className="admin-field">
            <span>Studio key</span>
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="current-password"
              placeholder="Paste the admin key"
              required
            />
          </label>
          {error ? (
            <p className="admin-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="admin-button admin-button--ink admin-button--wide"
            type="submit"
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Unlock studio'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-brand" to="/">
          SONU<span>.</span>
          <small>/ STUDIO</small>
        </Link>

        <nav className="admin-tabs" aria-label="Studio sections">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={tab === entry.id ? 'is-active' : ''}
              onClick={() => setTab(entry.id)}
            >
              <span>{entry.number}</span>
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="admin-topbar__actions">
          <Link to="/" target="_blank" rel="noreferrer">
            View store ↗
          </Link>
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Refresh
          </button>
          <button type="button" onClick={logout}>
            Lock
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      ) : null}

      <main className="admin-main">
        {summary ? (
          <section className="admin-summary" aria-label="Store summary">
            <div>
              <p className="admin-kicker">TOTAL ORDERS</p>
              <strong>{summary.totalOrders}</strong>
            </div>
            <div>
              <p className="admin-kicker">OPEN</p>
              <strong>{summary.openOrders}</strong>
            </div>
            <div>
              <p className="admin-kicker">ORDER VALUE</p>
              <strong>{formatPrice(summary.revenueCents)}</strong>
            </div>
            <div>
              <p className="admin-kicker">ACTIVE PROMOS</p>
              <strong>{summary.activePromos}</strong>
            </div>
            <div className="admin-summary__low">
              <p className="admin-kicker">LOW STOCK</p>
              {summary.lowStock.length === 0 ? (
                <span>All sizes above three pairs.</span>
              ) : (
                <div className="admin-low-list">
                  {summary.lowStock.slice(0, 6).map((item) => (
                    <span key={`${item.productId}-${item.size}`}>
                      {item.colorway} / EU {item.size} / {item.quantity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {busy && !summary ? (
          <p className="admin-loading">Loading the studio...</p>
        ) : null}

        {tab === 'orders' ? (
          <OrdersPanel
            orders={orders}
            busy={busy}
            onAdvance={advanceOrder}
          />
        ) : null}

        {tab === 'catalog' ? (
          <CatalogPanel
            products={products}
            busy={busy}
            onSave={saveProduct}
            onCreate={createProduct}
          />
        ) : null}

        {tab === 'analytics' ? <AnalyticsPanel adminKey={key} /> : null}
        {tab === 'promos' ? (
          <PromosPanel
            promos={promos}
            busy={busy}
            onCreate={createPromo}
            onUpdate={updatePromo}
            onDelete={deletePromo}
          />
        ) : null}

        {tab === 'settings' && settings ? (
          <SettingsPanel
            settings={settings}
            busy={busy}
            onSave={saveSettings}
          />
        ) : null}
        {tab === 'whatsapp' ? <WhatsAppPanel adminKey={key} /> : null}
      </main>
    </div>
  );
}
