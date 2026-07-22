import { trimText } from '../../src/lib/text.js';

export function normalizeComparisonKey(value) {
  return trimText(value)
    .toLowerCase()
    .replace(/\bhonors?\s+program\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mergeUniqueText(values, separator = '; ') {
  const seen = new Set();

  return values
    .flatMap((value) => trimText(value).split(/\n|;/g))
    .map(trimText)
    .filter((value) => {
      if (!value) {
        return false;
      }

      const key = normalizeComparisonKey(value);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(separator);
}
