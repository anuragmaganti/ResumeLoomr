import { createRequire } from 'node:module';
import mammoth from 'mammoth';

import {
  RESUME_SIGNAL_PATTERNS,
} from './patterns.js';

const PDF_TEXT_EXTRACTION_TIMEOUT_MS = 2000;
const TRUSTED_PDF_TEXT_MIN_CHARACTERS = 450;
const TRUSTED_PDF_TEXT_MIN_WORDS = 75;
const TRUSTED_PDF_TEXT_MIN_PRINTABLE_RATIO = 0.85;
const TRUSTED_PDF_TEXT_MIN_RESUME_SIGNALS = 2;
const serverRequire = createRequire(import.meta.url);

export function normalizeExtractedResumeText(value) {
  return (typeof value === 'string' ? value : '')
    .split('\u0000').join('')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(value) {
  const matches = normalizeExtractedResumeText(value).match(/\b[\p{L}\p{N}][\p{L}\p{N}'’.-]*\b/gu);
  return matches?.length || 0;
}

function getPrintableCharacterRatio(value) {
  const normalizedValue = normalizeExtractedResumeText(value);

  if (!normalizedValue) {
    return 0;
  }

  const printableCharacters = Array.from(normalizedValue).filter((character) => (
    /[\p{L}\p{N}\p{P}\p{S}\s]/u.test(character)
  )).length;

  return printableCharacters / Array.from(normalizedValue).length;
}

function countResumeSignals(value) {
  return RESUME_SIGNAL_PATTERNS.filter((pattern) => pattern.test(value)).length;
}

export function assessExtractedResumeText(text) {
  const normalizedText = normalizeExtractedResumeText(text);
  const nonWhitespaceCharacters = normalizedText.replace(/\s/g, '').length;
  const wordCount = countWords(normalizedText);
  const printableRatio = getPrintableCharacterRatio(normalizedText);
  const resumeSignalCount = countResumeSignals(normalizedText);
  const isTrustworthy = (
    nonWhitespaceCharacters >= TRUSTED_PDF_TEXT_MIN_CHARACTERS &&
    wordCount >= TRUSTED_PDF_TEXT_MIN_WORDS &&
    printableRatio >= TRUSTED_PDF_TEXT_MIN_PRINTABLE_RATIO &&
    resumeSignalCount >= TRUSTED_PDF_TEXT_MIN_RESUME_SIGNALS
  );

  return {
    isTrustworthy,
    text: normalizedText,
    nonWhitespaceCharacters,
    wordCount,
    printableRatio,
    resumeSignalCount,
  };
}

function runWithTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('PDF text extraction timed out.'));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function extractPdfText(file) {
  try {
    const parsePdf = serverRequire('pdf-parse');
    const result = await runWithTimeout(parsePdf(file.buffer), PDF_TEXT_EXTRACTION_TIMEOUT_MS);

    return normalizeExtractedResumeText(result.text);
  } catch {
    return '';
  }
}

export async function extractDocxText(file) {
  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return normalizeExtractedResumeText(result.value);
}
