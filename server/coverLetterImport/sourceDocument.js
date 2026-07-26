import { trimText } from '../../src/lib/text.js';

const GREETING_PATTERN = /^(?:dear|hello|to)\b.+[,!:]?$/i;
const SIGN_OFF_PATTERN = /^(?:sincerely|best(?: regards)?|kind regards|regards|respectfully|thank you|yours truly|warmly)[,!:]?$/i;
const DATE_PATTERN = /^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/i;
const RESUME_HEADING_PATTERN = /^(?:education|experience|work experience|skills|projects|certifications|awards|publications|leadership|volunteering)$/i;

function normalizeLine(value) {
  return trimText(value).replace(/\s+/g, ' ');
}

function normalizeBodyBlock(block, index) {
  if (block?.kind === 'bulletList') {
    return {
      kind: 'bulletList',
      items: (Array.isArray(block.items) ? block.items : [])
        .map(normalizeLine)
        .filter(Boolean)
        .slice(0, 30),
    };
  }

  return {
    kind: 'paragraph',
    role: ['opening', 'evidence', 'closing'].includes(block?.role)
      ? block.role
      : (index === 0 ? 'opening' : 'evidence'),
    text: trimText(block?.text).slice(0, 12_000),
  };
}

export function normalizeCoverLetterSourceDocument(candidate = {}) {
  const senderLines = (Array.isArray(candidate.senderLines) ? candidate.senderLines : [])
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 20);
  const recipientLines = (Array.isArray(candidate.recipientLines) ? candidate.recipientLines : [])
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 20);
  const bodyBlocks = (Array.isArray(candidate.bodyBlocks) ? candidate.bodyBlocks : [])
    .map(normalizeBodyBlock)
    .filter((block) => block.kind === 'bulletList' ? block.items.length > 0 : trimText(block.text))
    .slice(0, 20);
  const rawLines = (Array.isArray(candidate.rawLines) ? candidate.rawLines : [])
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 500);

  return {
    senderLines,
    dateLine: normalizeLine(candidate.dateLine),
    recipientLines,
    greeting: normalizeLine(candidate.greeting),
    bodyBlocks,
    signOff: normalizeLine(candidate.signOff),
    signatureName: normalizeLine(candidate.signatureName),
    rawLines,
    hasSourceText: Boolean(
      senderLines.length
      || recipientLines.length
      || bodyBlocks.length
      || trimText(candidate.greeting)
      || trimText(candidate.signOff)
    ),
  };
}

function splitParagraphs(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split('\n').map(normalizeLine).filter(Boolean))
    .filter((lines) => lines.length > 0);
}

function stripBullet(line) {
  return normalizeLine(line).replace(/^[•●▪◦*\-–—]\s*/, '');
}

export function createCoverLetterSourceDocumentFromText(text) {
  const paragraphs = splitParagraphs(text);
  const lineEntries = paragraphs.flatMap((paragraph, paragraphIndex) => (
    paragraph.map((line) => ({ line, paragraphIndex }))
  ));
  const lines = lineEntries.map(({ line }) => line);
  const greetingIndex = lines.findIndex((line) => GREETING_PATTERN.test(line));
  const signOffIndex = lines.findIndex((line, index) => index > greetingIndex && SIGN_OFF_PATTERN.test(line));
  const preambleEnd = greetingIndex >= 0 ? greetingIndex : Math.min(lines.length, 8);
  const preamble = lines.slice(0, preambleEnd);
  const dateIndex = preamble.findIndex((line) => DATE_PATTERN.test(line));
  const senderLines = dateIndex >= 0 ? preamble.slice(0, dateIndex) : preamble.slice(0, Math.max(0, preamble.length - 3));
  const recipientLines = dateIndex >= 0 ? preamble.slice(dateIndex + 1) : preamble.slice(senderLines.length);
  const bodyStart = greetingIndex >= 0 ? greetingIndex + 1 : preambleEnd;
  const bodyEnd = signOffIndex >= 0 ? signOffIndex : lines.length;
  const bodyEntries = lineEntries.slice(bodyStart, bodyEnd);
  const bodyBlocks = [];
  let bulletItems = [];
  let paragraphLines = [];
  let activeParagraphIndex = null;

  function flushParagraph() {
    const value = trimText(paragraphLines.join(' '));
    if (value) bodyBlocks.push({ kind: 'paragraph', text: value });
    paragraphLines = [];
  }

  function flushBullets() {
    if (bulletItems.length) bodyBlocks.push({ kind: 'bulletList', items: bulletItems });
    bulletItems = [];
  }

  bodyEntries.forEach(({ line, paragraphIndex }) => {
    if (activeParagraphIndex !== null && paragraphIndex !== activeParagraphIndex) {
      flushParagraph();
      flushBullets();
    }
    activeParagraphIndex = paragraphIndex;

    if (/^[•●▪◦*\-–—]\s+/.test(line)) {
      flushParagraph();
      bulletItems.push(stripBullet(line));
    } else {
      flushBullets();
      paragraphLines.push(line);
    }
  });
  flushParagraph();
  flushBullets();

  const paragraphBlocks = bodyBlocks.filter((block) => block.kind === 'paragraph');
  paragraphBlocks.forEach((block, index) => {
    block.role = index === 0 ? 'opening' : index === paragraphBlocks.length - 1 ? 'closing' : 'evidence';
  });

  return normalizeCoverLetterSourceDocument({
    senderLines,
    dateLine: dateIndex >= 0 ? preamble[dateIndex] : '',
    recipientLines,
    greeting: greetingIndex >= 0 ? lines[greetingIndex] : '',
    bodyBlocks,
    signOff: signOffIndex >= 0 ? lines[signOffIndex] : '',
    signatureName: signOffIndex >= 0 ? lines[signOffIndex + 1] || '' : '',
    rawLines: lines,
  });
}

export function assessCoverLetterSourceDocument(candidate) {
  const source = normalizeCoverLetterSourceDocument(candidate);
  const resumeHeadingCount = source.rawLines.filter((line) => RESUME_HEADING_PATTERN.test(line)).length;
  const coverSignalCount = [source.greeting, source.signOff, source.recipientLines.length, source.bodyBlocks.length]
    .filter(Boolean).length;

  return {
    isUsable: source.hasSourceText && source.bodyBlocks.length > 0,
    isLikelyResume: resumeHeadingCount >= 2 && !source.greeting && !source.signOff,
    coverSignalCount,
    resumeHeadingCount,
  };
}
