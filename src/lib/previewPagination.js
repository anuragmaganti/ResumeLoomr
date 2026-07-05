export const PRINT_PAGE_WIDTH_PX = 816;
export const PRINT_PAGE_HEIGHT_PX = 1056;
export const CSS_PIXELS_PER_INCH = 96;

const MIN_BREAK_PROGRESS_PX = 1;

function asFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeCandidate(candidate) {
  const top = asFiniteNumber(candidate?.top);
  const bottom = asFiniteNumber(candidate?.bottom);
  const priority = asFiniteNumber(candidate?.priority, 99);

  if (bottom <= top) {
    return null;
  }

  return { top, bottom, priority };
}

function findCleanBreak(rawBreak, pageStart, printableHeight, candidates) {
  const matchingCandidates = candidates
    .filter((candidate) => (
      candidate.top < rawBreak &&
      candidate.bottom > rawBreak &&
      candidate.top > pageStart + MIN_BREAK_PROGRESS_PX &&
      candidate.bottom - candidate.top <= printableHeight
    ))
    .sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority;
      }

      return second.top - first.top;
    });

  return matchingCandidates[0]?.top || rawBreak;
}

export function calculatePreviewPageBreaks({
  contentHeight,
  printableHeight,
  breakCandidates = [],
} = {}) {
  const normalizedContentHeight = Math.max(0, asFiniteNumber(contentHeight));
  const normalizedPrintableHeight = Math.max(1, asFiniteNumber(printableHeight, 1));
  const candidates = breakCandidates
    .map(normalizeCandidate)
    .filter(Boolean)
    .sort((first, second) => first.top - second.top);
  const breaks = [];
  let pageStart = 0;
  let rawBreak = normalizedPrintableHeight;

  while (rawBreak < normalizedContentHeight - MIN_BREAK_PROGRESS_PX) {
    const adjustedBreak = findCleanBreak(rawBreak, pageStart, normalizedPrintableHeight, candidates);
    const safeBreak = adjustedBreak <= pageStart + MIN_BREAK_PROGRESS_PX ? rawBreak : adjustedBreak;

    breaks.push(Math.round(safeBreak));
    pageStart = safeBreak;
    rawBreak = pageStart + normalizedPrintableHeight;
  }

  return breaks;
}
