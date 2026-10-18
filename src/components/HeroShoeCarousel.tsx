import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, type Product } from '../../shared/catalog';
import { ArrowRight } from './Icons';

interface HeroShoeCarouselProps {
  products: Product[];
  shippingCents: number;
}

const ROTATE_MS = 5000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

export default function HeroShoeCarousel({
  products,
  shippingCents,
}: HeroShoeCarouselProps) {
  const featured = useMemo(() => {
    const seen = new Set<string>();
    const list: Product[] = [];

    for (const product of products) {
      if (seen.has(product.name)) continue;
      seen.add(product.name);
      list.push(product);
    }

    return list;
  }, [products]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setActive((current) => (current >= featured.length ? 0 : current));
  }, [featured.length]);

  useEffect(() => {
    if (paused || reducedMotion || featured.length < 2) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % featured.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [active, featured.length, paused, reducedMotion]);

  if (featured.length === 0) return null;

  const safeActive = Math.min(active, featured.length - 1);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPaused(false);
    }
  }

  return (
    <div
      className="hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured shoes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={handleBlur}
    >
      {featured.map((product, index) => {
        const isActive = index === safeActive;
        const modelNumber = product.name.replace(/^The\s+/i, '');

        return (
          <div
            key={product.id}
            className={`hero-carousel__slide ${isActive ? 'is-active' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${featured.length}`}
            aria-hidden={!isActive}
          >
            <Link
              className="hero-carousel__image-link"
              to={`/product/${product.id}`}
              tabIndex={isActive ? 0 : -1}
              draggable={false}
            >
              <img
                className="hero__image"
                src={product.image}
                alt={`${product.name} in ${product.colorway}`}
                style={{
                  filter: [
                    product.imageFilter,
                    'drop-shadow(0 34px 28px rgba(20, 21, 18, 0.24))',
                  ]
                    .filter(Boolean)
                    .join(' '),
                }}
                draggable={false}
              />
            </Link>

            <span className="hero__index" aria-hidden="true">
              {modelNumber}
            </span>

            <Link
              className="hero__tag hero-carousel__tag"
              to={`/product/${product.id}`}
              tabIndex={isActive ? 0 : -1}
              aria-label={`View ${product.name} in ${product.colorway}, ${formatPrice(
                product.priceCents,
              )}`}
            >
              <span className="eyebrow">
                SONU / {modelNumber} / {product.colorway.toUpperCase()}
              </span>
              <strong>{formatPrice(product.priceCents)}</strong>
              <span>
                {shippingCents === 0
                  ? 'Free delivery in India'
                  : 'Delivery calculated at checkout'}
              </span>
            </Link>

            <p className="hero__caption" aria-hidden="true">
              {product.upper.toUpperCase()} / {product.sole.toUpperCase()}
            </p>
          </div>
        );
      })}

      <button
        type="button"
        className="hero-carousel__arrow hero-carousel__arrow--prev"
        onClick={() =>
          setActive(
            (current) =>
              (current - 1 + featured.length) % featured.length,
          )
        }
        aria-label="Previous featured shoe"
      >
        <ArrowRight />
      </button>
      <button
        type="button"
        className="hero-carousel__arrow hero-carousel__arrow--next"
        onClick={() =>
          setActive((current) => (current + 1) % featured.length)
        }
        aria-label="Next featured shoe"
      >
        <ArrowRight />
      </button>

      <div
        className="hero-carousel__dots"
        role="group"
        aria-label="Choose a featured shoe"
      >
        {featured.map((product, index) => (
          <button
            key={product.id}
            type="button"
            className={`hero-carousel__dot ${
              index === safeActive ? 'is-active' : ''
            }`}
            onClick={() => setActive(index)}
            aria-pressed={index === safeActive}
            aria-label={`Show ${product.name} in ${product.colorway}`}
          />
        ))}
      </div>
    </div>
  );
}
