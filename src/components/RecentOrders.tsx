import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../shared/catalog';
import { readRecentOrders, type RecentOrder } from '../lib/storage';
import { formatDate } from '../lib/format';
import { ArrowUpRight } from './Icons';

interface RecentOrdersProps {
  limit?: number;
}

export default function RecentOrders({ limit = 4 }: RecentOrdersProps) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    setOrders(readRecentOrders().slice(0, limit));
  }, [limit]);

  if (orders.length === 0) {
    return (
      <div className="recent-orders recent-orders--empty">
        <p className="eyebrow">ON THIS DEVICE</p>
        <p>
          Orders you place here will show up in this list. Nothing is sent to an
          account because there is no account.
        </p>
      </div>
    );
  }

  return (
    <div className="recent-orders">
      <p className="eyebrow">ON THIS DEVICE</p>
      <ul>
        {orders.map((order) => (
          <li key={order.code}>
            <Link to={`/track/${order.code}`}>
              <span>
                <strong>{order.code}</strong>
                <small>
                  {formatDate(order.createdAt)} / {order.itemCount}{' '}
                  {order.itemCount === 1 ? 'pair' : 'pairs'} /{' '}
                  {formatPrice(order.totalCents)}
                </small>
              </span>
              <ArrowUpRight />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
