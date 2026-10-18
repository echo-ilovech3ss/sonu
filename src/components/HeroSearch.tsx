import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice, type Product } from '../../shared/catalog';
import { ArrowRight, Search } from './Icons';

interface HeroSearchProps {
  products: Product[];
}

export default function HeroSearch({ products }: HeroSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((product) =>
        [product.name, product.colorway, product.upper, product.description]
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 5);
  }, [products, query]);

  function goToShop(search: string, productId?: string) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (productId) params.set('product', productId);
    navigate(`/?${params.toString()}#shop`);
    window.setTimeout(() => {
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    goToShop(query);
  }

  return (
    <div className="hero-search">
      <form className="hero-search__form" onSubmit={onSubmit} role="search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the run: The 02, Clay, Tobacco..."
          aria-label="Search shoes"
          autoComplete="off"
        />
        <button type="submit" aria-label="Search the shop">
          <ArrowRight />
        </button>
      </form>

      {query.trim() ? (
        <div className="hero-search__results" aria-live="polite">
          {suggestions.length > 0 ? (
            suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                className="hero-search__result"
                onClick={() => goToShop(product.name, product.id)}
              >
                <span className="hero-search__thumb">
                  <img src={product.image} alt="" />
                </span>
                <span className="hero-search__result-copy">
                  <strong>{product.name}</strong>
                  <span>{product.colorway}</span>
                </span>
                <span className="hero-search__price">
                  {formatPrice(product.priceCents)}
                </span>
              </button>
            ))
          ) : (
            <p className="hero-search__empty">
              No pair matches “{query.trim()}”. Try a model or colorway.
            </p>
          )}
        </div>
      ) : (
        <div className="hero-search__quick" aria-label="Popular searches">
          <span>Try</span>
          {['The 02', 'Clay', 'Tobacco'].map((term) => (
            <button key={term} type="button" onClick={() => goToShop(term)}>
              {term}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
