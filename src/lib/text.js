export function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
