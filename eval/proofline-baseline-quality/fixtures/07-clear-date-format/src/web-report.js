export function formatCreatedAt(date) {
  return new Intl.DateTimeFormat('en-US').format(date);
}
