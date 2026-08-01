export function slugify(value) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, '-');
}
