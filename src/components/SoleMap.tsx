/// <reference types="vite/client" />
import { useId, useState } from 'react';
import styles from './SoleMap.module.css';

type ZoneId = 'toe' | 'forefoot' | 'arch' | 'heel';

type Zone = {
  index: string;
  name: string;
  title: string;
  body: string;
  material: string;
};

const ZONES: Record<ZoneId, Zone> = {
  toe: {
    index: '01',
    name: 'Toe',
    title: 'Toe bumper.',
    body: 'Raised rubber at the front, the first part to scuff. It is meant to.',
    material: 'Raised rubber',
  },
  forefoot: {
    index: '02',
    name: 'Forefoot',
    title: 'Flex groove.',
    body: 'The sole splits where your foot bends, so the 01 moves with you instead of against you.',
    material: 'Flex groove',
  },
  arch: {
    index: '03',
    name: 'Arch',
    title: 'Arch bridge.',
    body: 'A steel shank keeps the middle from folding, so the sole stays flat when the road is not.',
    material: 'Steel shank',
  },
  heel: {
    index: '04',
    name: 'Heel',
    title: 'Heel strike.',
    body: 'A 6 mm gum rubber pad takes the first landing, then rolls you forward without a slap.',
    material: 'Gum rubber',
  },
};

const ZONE_ORDER: readonly ZoneId[] = ['toe', 'forefoot', 'arch', 'heel'];

const SOLE_PATH =
  'M112 28 C80 30 58 48 48 80 C38 112 46 148 52 182 C58 216 58 248 54 280 C50 314 50 348 56 382 C62 416 54 450 60 486 C66 526 92 556 130 564 C168 572 204 558 220 526 C234 498 228 468 232 436 C236 402 220 370 216 342 C212 310 232 284 240 252 C246 218 242 182 234 148 C224 106 204 68 172 46 C154 34 132 27 112 28 Z';

const INNER_PATH =
  'M112 46 C86 48 68 64 60 90 C52 118 58 150 64 184 C70 218 70 250 66 282 C62 316 62 350 68 384 C74 416 66 450 72 486 C78 520 100 544 132 551 C164 558 194 546 208 520 C220 496 214 468 218 438 C222 404 208 372 204 342 C200 312 218 286 226 252 C232 220 228 186 220 152 C211 114 194 80 166 60 C150 49 130 44 112 46 Z';

const ZONE_PATHS: Record<ZoneId, string> = {
  toe: 'M20 150 L20 20 L280 20 L280 150 C220 130 80 130 20 150 Z',
  forefoot: 'M20 150 C80 130 220 130 280 150 L280 300 C220 286 80 286 20 300 Z',
  arch: 'M20 300 C80 286 220 286 280 300 L280 410 C220 398 80 398 20 410 Z',
  heel: 'M20 410 C80 398 220 398 280 410 L280 600 L20 600 Z',
};

const ZONE_CLASS: Record<ZoneId, string> = {
  toe: styles.zoneToe,
  forefoot: styles.zoneForefoot,
  arch: styles.zoneArch,
  heel: styles.zoneHeel,
};

export default function SoleMap() {
  const [selected, setSelected] = useState<ZoneId>('forefoot');
  const [preview, setPreview] = useState<ZoneId | null>(null);

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `sole-clip-${uid}`;
  const panelId = `sole-panel-${uid}`;
  const headingId = `sole-heading-${uid}`;

  const activeId = preview ?? selected;
  const active = ZONES[activeId];

  const clearPreview = (id: ZoneId) => {
    setPreview((current) => (current === id ? null : current));
  };

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <div className={styles.head}>
        <p className={styles.kicker} id={headingId}>
          The 01 / Outsole
        </p>
        <p className={styles.hint}>Four zones / tap to inspect</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.stage} role="group" aria-label="Outsole zones">
          <svg
            className={styles.svg}
            viewBox="0 0 300 600"
            role="presentation"
            focusable="false"
            aria-hidden="true"
          >
            <defs>
              <clipPath id={clipId}>
                <path d={SOLE_PATH} />
              </clipPath>
            </defs>

            <g className={styles.rail}>
              <path d="M270 36 V584" />
              <path d="M262 150 H282 M262 300 H282 M262 410 H282" />
            </g>

            <path className={styles.soleShadow} d={SOLE_PATH} transform="translate(4 7)" />
            <path className={styles.soleBase} d={SOLE_PATH} />
            <path className={styles.innerLine} d={INNER_PATH} />

            {ZONE_ORDER.map((id) => (
              <g
                key={id}
                className={styles.zoneGroup}
                data-active={activeId === id}
                data-selected={selected === id}
                clipPath={`url(#${clipId})`}
              >
                <path className={styles.zoneTint} d={ZONE_PATHS[id]} />
                <path className={styles.zoneOutline} d={ZONE_PATHS[id]} />
              </g>
            ))}

            <g clipPath={`url(#${clipId})`}>
              <g>
                <path
                  className={styles.bumperFill}
                  d="M58 112 C74 62 110 34 150 38 C190 42 218 72 230 114 C212 92 190 80 166 78 C130 74 90 86 58 112 Z"
                />
                <path
                  className={styles.bumperLine}
                  d="M70 122 C88 78 116 54 150 56 C184 58 208 84 220 122"
                />
                <path
                  className={styles.bumperLineSoft}
                  d="M84 134 C100 96 124 74 150 75 C176 76 198 98 210 132"
                />
                <g className={styles.toeSipes}>
                  <path d="M112 84 L108 118 M150 78 L150 114 M188 86 L192 120" />
                  <path d="M92 102 L86 130 M130 80 L126 116 M170 80 L174 116 M208 104 L214 132" />
                </g>
              </g>

              <g>
                <g className={styles.forefootLines}>
                  <path d="M54 196 C104 184 190 182 240 194" />
                  <path d="M52 222 C104 208 192 206 242 220" />
                  <path d="M54 274 C104 260 192 258 238 272" />
                  <path d="M56 294 C106 282 190 280 236 292" />
                </g>
                <path
                  className={styles.flexGroove}
                  d="M52 246 C104 232 138 246 148 258 C158 246 190 230 240 244"
                />
                <path
                  className={styles.flexShadow}
                  d="M52 252 C104 238 138 252 148 264 C158 252 190 236 240 250"
                />
                <g className={styles.treadDashes}>
                  <path d="M66 168 H86 M104 166 H124 M142 165 H162 M180 166 H200 M216 170 H232" />
                  <path d="M64 208 H80 M94 204 H112 M130 202 H150 M168 202 H186 M204 206 H226" />
                  <path d="M66 286 H84 M100 283 H118 M136 282 H156 M174 282 H192 M208 286 H226" />
                </g>
              </g>

              <g>
                <path
                  className={styles.shank}
                  d="M206 300 C214 322 214 364 206 400 L192 398 C200 362 200 326 192 306 Z"
                />
                <g className={styles.shankTicks}>
                  <path d="M196 322 H212 M195 344 H214 M195 366 H213 M196 386 H210" />
                </g>
                <g className={styles.archLines}>
                  <path d="M66 396 C104 366 150 344 202 330" />
                  <path d="M62 374 C102 344 148 322 200 310" />
                  <path d="M60 350 C100 322 146 302 198 292" />
                </g>
                <text className={styles.soleLabel} x="136" y="358" textAnchor="middle">
                  SONU
                </text>
                <text className={styles.soleSubLabel} x="136" y="372" textAnchor="middle">
                  MUMBAI / 01
                </text>
              </g>

              <g>
                <path
                  className={styles.heelPad}
                  d="M88 472 C112 462 170 460 196 472 C202 494 200 524 188 544 C170 560 118 560 100 544 C88 524 84 494 88 472 Z"
                />
                <g className={styles.heelLines}>
                  <path d="M98 484 C122 476 164 474 186 484" />
                  <path d="M94 504 C120 494 166 492 190 504" />
                  <path d="M96 524 C120 514 166 512 190 524" />
                  <path d="M104 542 C124 534 160 532 182 542" />
                </g>
                <path
                  className={styles.heelAccent}
                  d="M112 556 C132 550 158 550 176 556"
                />
              </g>

              <path className={styles.sideMint} d="M54 280 C50 314 50 348 56 382" />
              <path
                className={styles.sidePaper}
                d="M60 486 C66 526 92 556 130 564"
              />
            </g>

            <g className={styles.flexNotches}>
              <path d="M48 246 L58 248 M242 244 L232 246" />
            </g>

            <g className={styles.ticks}>
              <path d="M28 150 H44 M28 300 H44 M28 410 H44" />
            </g>
          </svg>

          {ZONE_ORDER.map((id) => {
            const zone = ZONES[id];
            return (
              <button
                key={id}
                type="button"
                className={`${styles.zoneButton} ${ZONE_CLASS[id]}`}
                aria-pressed={selected === id}
                aria-controls={panelId}
                aria-label={`${zone.name}: ${zone.title}`}
                onMouseEnter={() => setPreview(id)}
                onMouseLeave={() => clearPreview(id)}
                onFocus={() => setPreview(id)}
                onBlur={() => clearPreview(id)}
                onClick={() => setSelected(id)}
              >
                <span className={styles.zoneChip} aria-hidden="true">
                  {zone.index}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.info}>
          <div
            className={styles.panel}
            id={panelId}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.panelMeta}>
              <span>
                {active.index} / {active.name}
              </span>
              <span className={styles.panelMaterial}>{active.material}</span>
            </div>
            <p className={styles.panelTitle}>{active.title}</p>
            <p className={styles.panelBody}>{active.body}</p>
            <div className={styles.gauge} aria-hidden="true">
              {ZONE_ORDER.map((id) => (
                <span
                  key={id}
                  className={styles.gaugeBar}
                  data-on={id === selected}
                />
              ))}
            </div>
          </div>

          <ul className={styles.legend} aria-label="Zone key">
            {ZONE_ORDER.map((id) => {
              const zone = ZONES[id];
              return (
                <li className={styles.legendItem} key={id}>
                  <span
                    className={styles.legendMark}
                    data-kind={id}
                    aria-hidden="true"
                  />
                  <span className={styles.legendIndex}>{zone.index}</span>
                  <span className={styles.legendName}>{zone.name}</span>
                  <span className={styles.legendMaterial}>{zone.material}</span>
                </li>
              );
            })}
          </ul>

          <p className={styles.footnote}>Left outsole / size 42 / 280 mm</p>
        </div>
      </div>
    </section>
  );
}
