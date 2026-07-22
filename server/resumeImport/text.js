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

export function splitTopLevelCommaParts(value) {
  const parts = [];
  let current = '';
  let depth = 0;

  Array.from(trimText(value)).forEach((character) => {
    if (character === '(') {
      depth += 1;
    } else if (character === ')' && depth > 0) {
      depth -= 1;
    }

    if (character === ',' && depth === 0) {
      const part = trimText(current);

      if (part) {
        parts.push(part);
      }

      current = '';
      return;
    }

    current += character;
  });

  const finalPart = trimText(current);

  if (finalPart) {
    parts.push(finalPart);
  }

  return parts;
}
