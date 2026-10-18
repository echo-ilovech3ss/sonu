const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function parseDateValue(value: string): Date {
  // Date-only delivery estimates should render as the same calendar day in
  // every timezone. A bare YYYY-MM-DD is parsed as UTC midnight otherwise.
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

export function formatDate(value: string): string {
  return dateFormatter.format(parseDateValue(value));
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
