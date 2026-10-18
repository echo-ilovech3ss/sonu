import { ORDER_STATUSES } from '../shared/types';
import type { OrderStatus } from '../shared/types';
import { OrderStore } from '../server/db';
import { advanceOrder } from '../server/orders';

const [trackingCode, statusArg] = process.argv.slice(2);

if (!trackingCode || !statusArg) {
  console.error('Usage: bun scripts/advance-order.ts <tracking-code> <status>');
  console.error(`Statuses: ${ORDER_STATUSES.join(', ')}`);
  process.exit(1);
}

if (!ORDER_STATUSES.includes(statusArg as OrderStatus)) {
  console.error(`Unknown status: ${statusArg}`);
  console.error(`Statuses: ${ORDER_STATUSES.join(', ')}`);
  process.exit(1);
}

const store = new OrderStore();
try {
  const result = advanceOrder(store, trackingCode, statusArg as OrderStatus);
  if (!result.ok) {
    if (result.reason === 'not_found') {
      console.error(`Order ${trackingCode} not found`);
    } else {
      console.error(`Cannot move order from ${result.currentStatus} to ${statusArg}`);
    }
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result.order, null, 2));
  }
} finally {
  store.close();
}
