import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import ProductConfigurator from '../components/ProductConfigurator';
import HeroShoeCarousel from '../components/HeroShoeCarousel';
import HeroSearch from '../components/HeroSearch';
import HowItWorks from '../components/HowItWorks';
import SoleMap from '../components/SoleMap';
import TrackingForm from '../components/TrackingForm';
import RecentOrders from '../components/RecentOrders';
import Reveal from '../components/Reveal';
import { ArrowRight, ArrowUpRight } from '../components/Icons';

export default function HomePage() {
  const { products, settings } = useStore();
  const tickerItems = [
    settings.announcement,
    settings.shippingCents === 0
      ? 'FREE DELIVERY IN INDIA'
      : 'DELIVERY CALCULATED AT CHECKOUT',
    `${settings.returnsDays}-DAY RETURNS`,
    'PAY ON DELIVERY',
    'NO ACCOUNT NEEDED',
    'RUN OF 120 PAIRS',
  ].filter(Boolean);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__lines" aria-hidden="true" />
        <div className="hero__orb" aria-hidden="true" />

        <div className="shell hero__inner">
          <div className="hero__meta">
            <span>SMALL-RUN FOOTWEAR / MUMBAI</span>
            <span>EST. 2026</span>
          </div>

          <div className="hero__visual">
            {products.length === 0 ? (
              <div className="hero__empty">
                <p className="eyebrow">THE 01 / BETWEEN RUNS</p>
                <h2>Next colorway soon.</h2>
                <p>
                  The current run is closed. Track an existing order while the
                  next one is being finished.
                </p>
                <Link className="button button--ink" to="/track">
                  Track an order <ArrowUpRight />
                </Link>
              </div>
            ) : (
              <HeroShoeCarousel
                products={products}
                shippingCents={settings.shippingCents}
              />
            )}
          </div>

          <div className="hero__copy">
            <p className="eyebrow">{settings.heroKicker}</p>
            <h1 id="hero-title">
              The long
              <br />
              <span className="hero__way">way</span>{' '}
              <span className="hero__outline">home</span>
            </h1>
            <p className="hero__lede">{settings.heroLede}</p>
            <div className="hero__actions">
              <Link className="button button--ink" to="/#shop">
                Shop the run <ArrowRight />
              </Link>
              <Link className="button button--ghost" to="/track">
                Track an order <ArrowUpRight />
              </Link>
            </div>
            <HeroSearch products={products} />
          </div>

        </div>
      </section>

      <div className="ticker" aria-label="Shop notes">
        <div className="ticker__track">
          {[0, 1].map((copy) => (
            <div className="ticker__group" key={copy} aria-hidden={copy === 1}>
              {tickerItems.map((item) => (
                <span key={`${copy}-${item}`}>
                  <i aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <ProductConfigurator />
      <HowItWorks />

      <section
        className="section anatomy"
        id="anatomy"
        aria-labelledby="anatomy-title"
      >
        <div className="shell">
          <div className="anatomy__grid">
            <div className="anatomy__copy">
              <p className="eyebrow">ANATOMY / THE 01</p>
              <h2 id="anatomy-title">A sole with a memory.</h2>
              <p>
                The outsole is the only part that touches the ground, so we
                started there. Natural gum rubber, a heel strike pad, and one
                flex groove through the forefoot. It starts firm and softens
                with wear.
              </p>
              <p>
                Hover or tap the sole map to see what each zone does. No
                exploded diagrams with arrows pointing at nothing.
              </p>

              <dl className="anatomy__specs">
                <div>
                  <dt>Weight</dt>
                  <dd>312 g / EU 42</dd>
                </div>
                <div>
                  <dt>Drop</dt>
                  <dd>8 mm</dd>
                </div>
                <div>
                  <dt>Upper</dt>
                  <dd>Full-grain leather</dd>
                </div>
                <div>
                  <dt>Lining</dt>
                  <dd>Vegetable-tanned leather</dd>
                </div>
                <div>
                  <dt>Sole</dt>
                  <dd>Natural gum rubber</dd>
                </div>
                <div>
                  <dt>Made</dt>
                  <dd>Mumbai, India</dd>
                </div>
              </dl>
            </div>

            <Reveal className="anatomy__map">
              <SoleMap />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section notes" aria-labelledby="notes-title">
        <div className="shell">
          <div className="section-head section-head--notes">
            <div>
              <p className="eyebrow">FIELD NOTES / MATERIALS</p>
              <h2 id="notes-title">Leather that keeps score.</h2>
            </div>
            <p>
              Full-grain leather takes creases. That is the point. The pair
              starts sharp and ends up yours.
            </p>
          </div>

          <div className="notes__grid">
            <Reveal className="notes__main">
              <figure>
                <img
                  src="/images/detail-tar.webp"
                  alt="Close-up of black full-grain leather with a yellow leaf resting on it"
                />
                <figcaption>
                  The 01 / Tar. Full-grain leather, brass eyelets, natural gum
                  sole.
                </figcaption>
              </figure>
            </Reveal>

            <div className="notes__side">
              <Reveal className="notes__small" delay={100}>
                <figure>
                  <img
                    src="/images/detail-shelf.webp"
                    alt="White canvas trainers hanging on a wooden shelf"
                  />
                  <figcaption>A pair waiting on the workshop shelf.</figcaption>
                </figure>
              </Reveal>

              <Reveal className="notes__copy" delay={180}>
                <p className="notes__dropcap">
                  We use full-grain leather because it takes a beating and keeps
                  its shape. Condition it twice a year. Replace the laces when
                  they fray. Let the creases happen.
                </p>
                <ul className="care-list">
                  <li>
                    <span>01</span>
                    Wipe with a dry cloth. Use a neutral cream twice a year.
                  </li>
                  <li>
                    <span>02</span>
                    Air-dry away from direct heat. Never put leather in a dryer.
                  </li>
                  <li>
                    <span>03</span>
                    Send them back for a resole when the gum wears through.
                  </li>
                </ul>
                <Link className="text-link" to="/#shop">
                  Shop the 01 <ArrowRight />
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="section tracking" id="track" aria-labelledby="track-title">
        <div className="shell">
          <div className="tracking__grid">
            <div className="tracking__copy">
              <p className="eyebrow">ORDER TRACKING / NO ACCOUNT</p>
              <h2 id="track-title">
                Your pair is somewhere. Find it.
              </h2>
              <p>
                Every order gets a tracking code. No account, no password. If
                you ordered on this device, it is already saved below.
              </p>
              <TrackingForm />
              <RecentOrders limit={3} />
            </div>

            <div className="tracking__label-wrap" aria-hidden="true">
              <div className="parcel-label">
                <div className="parcel-label__top">
                  <span>SONU</span>
                  <span>MUMBAI / IN</span>
                </div>
                <div className="parcel-label__route">
                  <span>FROM</span>
                  <strong>SONU WORKSHOP</strong>
                  <span>TO</span>
                  <strong>YOUR FRONT DOOR</strong>
                </div>
                <div className="parcel-label__barcode" />
                <div className="parcel-label__code">SNU-••••-••••</div>
                <div className="parcel-label__bottom">
                  <span>NO ACCOUNT</span>
                  <span>KEEP THIS CODE</span>
                </div>
              </div>
              <p className="tracking__stamp">GUEST CHECKOUT / EST. 2026</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
