import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  WhatsAppSettings,
  WhatsAppStatus,
} from '../../../shared/types';
import {
  adminConnectWhatsApp,
  adminDisconnectWhatsApp,
  adminUpdateWhatsApp,
  adminWhatsApp,
  adminWhatsAppStatus,
  ApiRequestError,
} from '../../lib/api';

const EMPTY_STATUS: WhatsAppStatus = {
  ok: false,
  configured: false,
  error: null,
  clients: [],
};

export function WhatsAppPanel({ adminKey }: { adminKey: string }) {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [status, setStatus] = useState<WhatsAppStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextStatus] = await Promise.all([
        adminWhatsApp(adminKey),
        adminWhatsAppStatus(adminKey),
      ]);
      setSettings(nextSettings);
      setStatus(nextStatus);
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Could not load WhatsApp settings.',
      });
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await adminWhatsAppStatus(adminKey));
    } catch {
      // The next poll or manual refresh will retry.
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!settings?.enabled) return;
    const timer = window.setInterval(() => void refreshStatus(), 8_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus, settings?.enabled]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const next = await adminUpdateWhatsApp(adminKey, settings);
      setSettings(next);
      setStatus(await adminWhatsAppStatus(adminKey));
      setNotice({ kind: 'success', text: 'WhatsApp settings saved.' });
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'WhatsApp settings did not save.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function connect() {
    setNotice(null);
    try {
      setStatus(await adminConnectWhatsApp(adminKey));
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Could not start the WhatsApp session.',
      });
    }
  }

  async function disconnect() {
    setNotice(null);
    try {
      setStatus(await adminDisconnectWhatsApp(adminKey));
    } catch (requestError) {
      setNotice({
        kind: 'error',
        text:
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Could not disconnect the WhatsApp account.',
      });
    }
  }

  if (loading) {
    return <p className="admin-loading">Loading WhatsApp...</p>;
  }

  if (!settings) {
    return <p className="admin-empty">WhatsApp settings are unavailable.</p>;
  }

  const client = status.clients[0] ?? null;
  const connected = client?.authenticated === true;

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">WHATSAPP / OPTIONAL</p>
          <h2>Order updates, sent.</h2>
        </div>
        <p className="admin-panel-note">
          When enabled, an order with a phone number gets a WhatsApp message
          with the pair, sizes, total, photo, and tracking code. No phone, no
          message.
        </p>
      </div>

      <div className="admin-whatsapp">
        <form className="admin-whatsapp__form" onSubmit={save}>
          <div className="admin-whatsapp__head">
            <div>
              <p className="admin-kicker">GATEWAY</p>
              <h3>Account & delivery.</h3>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  setSettings({ ...settings, enabled: event.target.checked })
                }
              />
              <span>{settings.enabled ? 'Enabled' : 'Off'}</span>
            </label>
          </div>

          <label className="admin-field">
            <span>Gateway URL</span>
            <input
              type="url"
              value={settings.gatewayUrl}
              onChange={(event) =>
                setSettings({ ...settings, gatewayUrl: event.target.value })
              }
              placeholder="http://127.0.0.1:10000"
              required
            />
          </label>

          <label className="admin-field">
            <span>Gateway API key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) =>
                setSettings({ ...settings, apiKey: event.target.value })
              }
              placeholder="The API_KEY from the gateway"
              autoComplete="off"
            />
          </label>

          <label className="admin-field">
            <span>WhatsApp account (10-digit number)</span>
            <input
              inputMode="numeric"
              value={settings.clientId}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  clientId: event.target.value.replace(/\D/g, '').slice(0, 10),
                })
              }
              placeholder="9876543210"
            />
            <small className="admin-help">
              This is the WhatsApp account that sends the messages. Use the
              number without +91, exactly as the gateway expects.
            </small>
          </label>

          <label className="admin-field">
            <span>Sender label</span>
            <input
              value={settings.senderLabel}
              onChange={(event) =>
                setSettings({ ...settings, senderLabel: event.target.value })
              }
              placeholder="SONU"
            />
          </label>

          <button
            type="submit"
            className="admin-button admin-button--ink"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save WhatsApp settings'}
          </button>
          {notice ? (
            <p
              className={
                notice.kind === 'error' ? 'admin-error' : 'admin-help'
              }
            >
              {notice.text}
            </p>
          ) : null}
        </form>

        <section className="admin-whatsapp__status">
          <div className="admin-whatsapp__head">
            <div>
              <p className="admin-kicker">ACCOUNT LOGIN</p>
              <h3>Link the phone.</h3>
            </div>
            <span
              className={`admin-whatsapp__dot ${
                connected ? 'is-connected' : ''
              }`}
              aria-label={connected ? 'Connected' : 'Not connected'}
            />
          </div>

          <p className="admin-whatsapp__state">
            {client
              ? `${client.clientInfo?.pushname ?? 'WhatsApp'} / ${client.state}`
              : 'No session yet. Save an account number, then start the login.'}
          </p>

          {client?.qrBase64 ? (
            <div className="admin-whatsapp__qr">
              <img src={client.qrBase64} alt="WhatsApp login QR code" />
              <p>
                Open WhatsApp on the phone, go to <strong>Linked devices</strong>,
                and scan this code.
              </p>
            </div>
          ) : null}

          {status.error ? <p className="admin-error">{status.error}</p> : null}

          <div className="admin-whatsapp__actions">
            <button
              type="button"
              className="admin-button admin-button--ink"
              onClick={() => void connect()}
              disabled={!settings.clientId}
            >
              Start login / show QR
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => void refreshStatus()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => void disconnect()}
              disabled={!settings.clientId}
            >
              Disconnect
            </button>
          </div>

          <div className="admin-whatsapp__help">
            <p className="admin-kicker">RUNNING THE GATEWAY</p>
            <code>cd whatsapp-gateway</code>
            <code>npm install</code>
            <code>API_KEY=your-secret npm start</code>
            <p>
              Keep the gateway bound to localhost. The API key above must match
              the gateway&apos;s <code>API_KEY</code>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
