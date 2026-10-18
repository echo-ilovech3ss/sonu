import { useEffect } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { CartProvider } from './lib/cart';
import { StoreProvider } from './lib/store';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import CheckoutPage from './pages/CheckoutPage';
import TrackPage from './pages/TrackPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminPage from './pages/AdminPage';
import './styles/product.css';

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        window.setTimeout(() => {
          const header = document.querySelector<HTMLElement>('.site-header');
          const headerHeight = header?.offsetHeight ?? 0;
          const targetTop =
            target.getBoundingClientRect().top + window.scrollY;

          window.scrollTo({
            top: Math.max(0, targetTop - headerHeight - 12),
            behavior: reduceMotion ? 'auto' : 'smooth',
          });
        }, 0);
        return;
      }
    }

    const reset = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);

    return () => window.clearTimeout(reset);
  }, [pathname, hash]);

  return null;
}

function Site() {
  useEffect(() => {
    document.title = 'SONU — For the long way home';
  }, []);

  return (
    <StoreProvider>
      <CartProvider>
        <ScrollManager />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <CartDrawer />
        <main id="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/track/:code" element={<TrackPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </CartProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<Site />} />
      </Routes>
    </BrowserRouter>
  );
}
