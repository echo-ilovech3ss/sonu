import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { useStore } from '../lib/store';
import { Bag, Close, Menu } from './Icons';

export default function Header() {
  const { settings } = useStore();
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const navItems = [
    { label: 'The 01', to: '/#shop' },
    { label: 'Anatomy', to: '/#anatomy' },
    { label: 'How it works', to: '/#how' },
    { label: 'Track order', to: '/track' },
  ];

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="shell site-header__inner">
        <Link
          className="wordmark"
          to="/"
          aria-label={`${settings.storeName} home`}
        >
          {settings.storeName}
          <span className="wordmark__dot">.</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.label} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <button
            className="bag-button"
            type="button"
            onClick={openCart}
            aria-label={`Open bag, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
          >
            <Bag />
            <span>Bag</span>
            {cartCount > 0 ? (
              <span className="bag-button__count">{cartCount}</span>
            ) : null}
          </button>

          <button
            className="menu-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={`mobile-nav ${menuOpen ? 'is-open' : ''}`}
        hidden={!menuOpen}
      >
        <nav className="shell mobile-nav__inner" aria-label="Mobile">
          {navItems.map((item, index) => (
            <Link key={item.label} to={item.to}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item.label}
            </Link>
          ))}
          <p>No account needed. Just a tracking code.</p>
        </nav>
      </div>
    </header>
  );
}
