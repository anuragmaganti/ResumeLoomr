import { trimText } from '../../src/lib/text.js';
import {
  PHONE_TEXT_PATTERN,
  RESUME_SIGNAL_PATTERNS,
} from './patterns.js';
import { isKnownSourceSectionHeader } from './sectionHeadings.js';
import {
  isLikelyLocationText,
  isResumeContactLine,
} from './sourceSignals.js';
import { normalizeComparisonKey } from './text.js';

export function mergeMappedPersonal(detectedPersonal, mappedPersonal = {}) {
  const source = mappedPersonal && typeof mappedPersonal === 'object' ? mappedPersonal : {};
  const merged = Object.fromEntries(
    Object.entries(detectedPersonal).map(([field, value]) => [
      field,
      trimText(source[field]) || value,
    ])
  );

  if (normalizeComparisonKey(merged.headline) === normalizeComparisonKey(merged.name)) {
    merged.headline = '';
  }

  merged.location = normalizePersonalLocationText(merged.location) || normalizePersonalLocationText(detectedPersonal.location);

  return merged;
}

function extractResumeUrls(value) {
  return Array.from(trimText(value).matchAll(/(?<!@)\b(?:https?:\/\/|www\.|linkedin\.com|github\.com|[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}(?:\/\S*)?)\S*/gi))
    .map((match) => trimText(match[0]).replace(/[),.;]+$/g, ''))
    .filter((url) => url && !/@/.test(url));
}

function extractResumeEmail(value) {
  const text = trimText(value);
  const commonDomainMatch = text.match(/[A-Z][A-Z0-9._%+-]*@(?:gmail|yahoo|outlook|hotmail|icloud|me|protonmail|aol)\.com/i);

  if (commonDomainMatch) {
    return commonDomainMatch[0];
  }

  return text.match(/[A-Z][A-Z0-9._%+-]*@[A-Z0-9.-]+?\.(?:com|edu|org|net|io|dev|co|us|gov|me)/i)?.[0] || '';
}

function removeContactTokens(value, { email = '', phone = '', urls = [] } = {}) {
  let text = trimText(value);

  [email, phone, ...urls].filter(Boolean).forEach((token) => {
    text = text.split(token).join(' ');
  });

  return trimText(text)
    .replace(/\b(?:email|e-mail|phone|tel|telephone|mobile)\s*:\s*/ig, ' ')
    .replace(/[●•|]/g, ' ')
    .replace(/\s{2,}/g, ' ');
}

function normalizePersonalLocationText(value) {
  const text = trimText(value);

  if (/^(?:remote|virtual|hybrid)$/i.test(text)) {
    return text;
  }

  if (isLikelyLocationText(text)) {
    return text.replace(/\s+\d{5}(?:-\d{4})?$/, '');
  }

  const cityStateMatches = Array.from(text.matchAll(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\b/g))
    .map((match) => trimText(match[1]))
    .filter(isLikelyLocationText);

  return cityStateMatches[cityStateMatches.length - 1] || '';
}

export function isLikelyHeadlineLine(line) {
  const text = trimText(line);
  const words = text.split(/\s+/g).filter(Boolean);

  return (
    text.length > 0 &&
    text.length <= 90 &&
    words.length <= 10 &&
    !isResumeContactLine(text) &&
    !isKnownSourceSectionHeader(text) &&
    !/\baddress\b/i.test(text) &&
    !/\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|memorial)\b/i.test(text) &&
    !/\b[A-Z]{2}\s+\d{5}\b/.test(text) &&
    !/[.!?]$/.test(text)
  );
}

export function detectPersonalFromSourceLines(lines) {
  const personalLines = Array.isArray(lines) ? lines.map(trimText).filter(Boolean) : [];
  const combinedText = personalLines.join('\n');
  const email = extractResumeEmail(combinedText);
  const phone = combinedText.match(PHONE_TEXT_PATTERN)?.[0] || '';
  const urls = extractResumeUrls(email ? combinedText.split(email).join(' ') : combinedText);
  const linkedinUrl = urls.find((url) => /linkedin\.com/i.test(url)) || '';
  const githubUrl = urls.find((url) => /github\.com/i.test(url)) || '';
  const portfolioUrl = urls.find((url) => !/linkedin\.com|github\.com/i.test(url)) || '';
  const name = personalLines.find((line) => (
    line !== email &&
    line !== phone &&
    !isResumeContactLine(line) &&
    !RESUME_SIGNAL_PATTERNS[2].test(line)
  )) || '';
  const remainingPersonalLines = personalLines
    .filter((line) => line !== name)
    .map((line) => removeContactTokens(line, { email, phone, urls }));
  const headline = remainingPersonalLines.find(isLikelyHeadlineLine) || '';
  const location = remainingPersonalLines
    .flatMap((line) => line.split(/[●•|]/g))
    .map(trimText)
    .map((part) => (
      part &&
      part !== email &&
      part !== phone &&
      part !== headline &&
      !/linkedin\.com|github\.com|https?:\/\/|www\./i.test(part)
        ? normalizePersonalLocationText(part)
        : ''
    ))
    .find(Boolean) || '';
  const aboutMe = personalLines
    .filter((line) => line !== name)
    .filter((line) => !isResumeContactLine(line))
    .filter((line) => line !== headline)
    .find((line) => line.length > 90 || /[.!?]$/.test(line)) || '';

  return {
    name,
    headline,
    location,
    phone,
    email,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    customField: '',
    aboutMe,
  };
}
