import {
  ORDER_STATUSES,
  STATUS_COPY,
  type PublicOrder,
} from '../../shared/types';
import { formatDateTime } from '../lib/format';

export default function OrderTimeline({ order }: { order: PublicOrder }) {
  const currentIndex = ORDER_STATUSES.indexOf(order.status);

  return (
    <ol className="timeline" aria-label="Order progress">
      {ORDER_STATUSES.map((status, index) => {
        const event = order.events.find((entry) => entry.status === status);
        const isPast = index < currentIndex;
        const state = isPast
          ? 'is-complete'
          : index === currentIndex
            ? 'is-current'
            : 'is-upcoming';

        return (
          <li
            className={`timeline__item ${state}`}
            key={status}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <span className="timeline__dot" aria-hidden="true" />
            <div className="timeline__body">
              <div className="timeline__title">
                <h3>{STATUS_COPY[status].label}</h3>
                <time dateTime={event?.occurredAt ?? undefined}>
                  {event
                    ? formatDateTime(event.occurredAt)
                    : isPast
                      ? 'Skipped'
                      : 'Pending'}
                </time>
              </div>
              <p>
                {event?.detail ??
                  (isPast
                    ? 'No scan recorded for this step.'
                    : STATUS_COPY[status].detail)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
