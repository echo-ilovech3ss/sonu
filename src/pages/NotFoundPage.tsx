import { Link } from 'react-router-dom';
import { ArrowRight } from '../components/Icons';

export default function NotFoundPage() {
  return (
    <section className="page-shell not-found">
      <div className="shell">
        <p className="eyebrow">404 / OFF THE PATH</p>
        <h1>This page took a wrong turn.</h1>
        <p>
          The shoes are still where you left them. Go back to the 01, or track
          an order you already placed.
        </p>
        <div className="not-found__actions">
          <Link className="button button--ink" to="/#shop">
            Shop the 01 <ArrowRight />
          </Link>
          <Link className="button button--ghost" to="/track">
            Track an order
          </Link>
        </div>
      </div>
    </section>
  );
}
