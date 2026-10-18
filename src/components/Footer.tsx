import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ArrowUpRight } from './Icons';

export default function Footer() {
  const { settings } = useStore();
  const mailto = `mailto:${settings.supportEmail}`;

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__top">
          <p className="eyebrow">SONU / MUMBAI</p>
          <p className="site-footer__note">
            Small runs. Long walks. No accounts.
          </p>
        </div>

        <div className="site-footer__mark" aria-hidden="true">
          SONU
        </div>

        <div className="site-footer__grid">
          <div>
            <p className="site-footer__label">Shop</p>
            <Link to="/#shop">The 01</Link>
            <Link to="/#anatomy">Anatomy</Link>
            <Link to="/#how">How it works</Link>
          </div>
          <div>
            <p className="site-footer__label">Orders</p>
            <Link to="/track">Track an order</Link>
            <a href={mailto}>Returns</a>
            <a href={mailto}>Contact</a>
          </div>
          <div>
            <p className="site-footer__label">Elsewhere</p>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">
              Instagram <ArrowUpRight />
            </a>
            <a href={mailto}>Email</a>
          </div>
          <div className="site-footer__statement">
            <p>
              Your order details and request IP are stored on our server to
              fulfil the order and prevent abuse. No account is created.
            </p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>
            © {new Date().getFullYear()} {settings.storeName}
          </span>
          <span>Made in Mumbai</span>
          <span>Photography via Pexels and Unsplash</span>
        </div>
      </div>
    </footer>
  );
}
