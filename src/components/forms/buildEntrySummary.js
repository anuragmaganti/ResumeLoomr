export function buildEntrySummary(parts, fallback) {
  const summary = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' • ');

  return summary || fallback;
}
