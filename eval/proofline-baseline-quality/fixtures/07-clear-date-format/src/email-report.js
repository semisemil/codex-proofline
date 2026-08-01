export function formatCreatedAt(date) {
  return date.toISOString().slice(0, 10);
}
