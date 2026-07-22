import { trimText } from '../../src/lib/text.js';
import {
  BULLET_MARKER_PATTERN,
  DATE_RANGE_SOURCE,
  DATE_TEXT_PATTERN,
  DATE_TEXT_PATTERN_GLOBAL,
  DATE_TOKEN_SOURCE,
  RESUME_SIGNAL_PATTERNS,
  YEAR_TOKEN_SOURCE,
} from './patterns.js';

export function isLikelySourceBullet(line) {
  return new RegExp(`^${BULLET_MARKER_PATTERN.source}\\s+\\S`, 'u').test(trimText(line));
}

export function cleanSourceBullet(line) {
  return trimText(line).replace(new RegExp(`^${BULLET_MARKER_PATTERN.source}\\s*`, 'u'), '').trim();
}

export function isLikelyUrlText(value) {
  return /(?<!@)\b(?:https?:\/\/|www\.|linkedin\.com|github\.com|[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}(?:\/\S*)?)\S*/i.test(trimText(value));
}

export function isResumeContactLine(line) {
  return RESUME_SIGNAL_PATTERNS.slice(0, 3).some((pattern) => pattern.test(line)) || /[●•]\s*/.test(line);
}

export function isLikelyPersonalContactLine(line) {
  const text = trimText(line);

  return (
    isResumeContactLine(text) ||
    isLikelyUrlText(text) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
  );
}

export function hasDateSignal(line) {
  return DATE_TEXT_PATTERN.test(line);
}

export function extractTrailingDateText(line) {
  const text = trimText(line);
  DATE_TEXT_PATTERN_GLOBAL.lastIndex = 0;
  const matches = Array.from(text.matchAll(DATE_TEXT_PATTERN_GLOBAL));
  const match = matches[matches.length - 1];

  if (!match) {
    return { beforeDate: text, dateText: '' };
  }

  const dateText = trimText(match[0]);
  const beforeDate = trimText(`${text.slice(0, match.index)} ${text.slice((match.index || 0) + match[0].length)}`);

  return { beforeDate, dateText };
}

export function extractEndingDateText(line) {
  const text = trimText(line);
  const endingDatePattern = new RegExp(`(?:${DATE_RANGE_SOURCE}|${DATE_TOKEN_SOURCE})\\s*$`, 'i');
  const match = text.match(endingDatePattern);

  if (!match || typeof match.index !== 'number') {
    return { beforeDate: text, dateText: '' };
  }

  return {
    beforeDate: trimText(text.slice(0, match.index)),
    dateText: trimText(match[0]),
  };
}

export function extractRoleDateText(line) {
  const text = trimText(line);
  const parentheticalDatePattern = new RegExp(`^(.*?)\\s*\\(([^)]*${YEAR_TOKEN_SOURCE}[^)]*)\\)\\s*$`, 'i');
  const parentheticalMatch = text.match(parentheticalDatePattern);
  const parentheticalDateCount = Array.from(text.matchAll(new RegExp(`\\([^)]*${YEAR_TOKEN_SOURCE}[^)]*\\)`, 'gi'))).length;

  if (parentheticalMatch && trimText(parentheticalMatch[1]) && parentheticalDateCount <= 1) {
    return {
      beforeDate: trimText(parentheticalMatch[1]),
      dateText: trimText(parentheticalMatch[2]),
    };
  }

  return extractEndingDateText(text);
}

export function isDateOnlyLine(line) {
  return new RegExp(`^\\s*(?:${DATE_RANGE_SOURCE}|${DATE_TOKEN_SOURCE})\\s*$`, 'i').test(trimText(line));
}

export function isLikelyLocationText(value) {
  const text = trimText(value);

  if (text.includes('/')) {
    const parts = text.split('/').map(trimText).filter(Boolean);
    return parts.length > 1 && parts.every((part) => isLikelyLocationText(part));
  }

  if (/\s+and\s+/i.test(text)) {
    const parts = text.split(/\s+and\s+/i).map(trimText).filter(Boolean);
    return parts.length > 1 && parts.every((part) => isLikelyLocationText(part));
  }

  if (/\b(?:lab|laborator(?:y|ies)|center|centre|institute|university|college|school|department|program|group|team|organization|association|society|committee|council|systems?|technologies)\b/i.test(text.split(',').slice(1).join(','))) {
    return false;
  }

  return (
    /^(?:remote|virtual|hybrid)$/i.test(text) ||
    /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*(?:[A-Z]{2}|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)$/.test(text)
  );
}
