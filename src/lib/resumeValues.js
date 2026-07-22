import { trimText } from './text.js';

function asText(value) {
  return typeof value === 'string' ? value : '';
}

export function listHasContent(items) {
  return Array.isArray(items) && items.some((item) => trimText(item) !== '');
}

export function normalizeStringList(items, { minItems = 1 } = {}) {
  const nextItems = Array.isArray(items)
    ? items.map((item) => asText(item))
    : [];

  while (nextItems.length < minItems) {
    nextItems.push('');
  }

  return nextItems;
}
