import {
  createBlankCoverLetterDraft,
  createCoverLetterBulletItem,
  createCoverLetterBulletListBlock,
  createCoverLetterParagraphBlock,
  normalizeCoverLetterDraft,
} from '../../src/lib/coverLetter.js';
import { trimText } from '../../src/lib/text.js';
import { normalizeCoverLetterSourceDocument } from './sourceDocument.js';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d().\s-]{7,}\d)/;
const URL_PATTERN = /(?:https?:\/\/|www\.|linkedin\.com|github\.com)[^\s|]+/i;
const COMPANY_PATTERN = /\b(?:inc\.?|llc|ltd\.?|corp\.?|corporation|company|partners|group|university|college|school|hospital|foundation|agency)\b/i;
const LOCATION_PATTERN = /(?:,\s*[A-Z]{2}\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+\b)/;

function stripProtocol(value) {
  return trimText(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

function parseSender(lines) {
  const values = lines.map(trimText).filter(Boolean);
  const joined = values.join(' | ');
  const email = joined.match(EMAIL_PATTERN)?.[0] || '';
  const phone = joined.match(PHONE_PATTERN)?.[0] || '';
  const urls = [...joined.matchAll(new RegExp(URL_PATTERN.source, 'ig'))].map((match) => stripProtocol(match[0]));
  const nonContact = values.filter((line) => (
    !EMAIL_PATTERN.test(line)
    && !PHONE_PATTERN.test(line)
    && !URL_PATTERN.test(line)
  ));
  const location = nonContact.find((line, index) => index > 0 && LOCATION_PATTERN.test(line)) || '';
  const name = nonContact[0] || '';
  const headline = nonContact.find((line, index) => index > 0 && line !== location) || '';
  const overrides = {
    ...(name ? { name } : {}),
    ...(headline ? { headline } : {}),
    ...(location ? { location } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };

  urls.forEach((url) => {
    if (/linkedin\.com/i.test(url)) overrides.linkedinUrl = url;
    else if (/github\.com/i.test(url)) overrides.githubUrl = url;
    else if (!overrides.portfolioUrl) overrides.portfolioUrl = url;
  });
  return overrides;
}

function parseRecipient(lines) {
  const values = lines.map(trimText).filter(Boolean);
  const companyIndex = values.findIndex((line) => COMPANY_PATTERN.test(line));
  const company = companyIndex >= 0 ? values[companyIndex] : values[2] || values[1] || '';
  const beforeCompany = companyIndex >= 0 ? values.slice(0, companyIndex) : values.slice(0, Math.min(2, values.length));
  const afterCompany = companyIndex >= 0 ? values.slice(companyIndex + 1) : values.slice(Math.min(3, values.length));

  return {
    hiringManagerName: beforeCompany[0] || '',
    hiringManagerTitle: beforeCompany[1] || '',
    company,
    addressLines: afterCompany.length > 0 ? afterCompany : [''],
  };
}

export function compileCoverLetterSourceDocument(sourceDocument, {
  resumeId = '',
  sourceFileName = '',
} = {}) {
  const source = normalizeCoverLetterSourceDocument(sourceDocument);
  const draft = createBlankCoverLetterDraft(resumeId);
  const senderOverrides = parseSender(source.senderLines);
  const recipient = parseRecipient(source.recipientLines);
  const bodyBlocks = source.bodyBlocks.map((block) => {
    if (block.kind === 'bulletList') {
      const result = createCoverLetterBulletListBlock();
      return {
        ...result,
        items: block.items.map((text) => ({ ...createCoverLetterBulletItem(), text })),
      };
    }
    return { ...createCoverLetterParagraphBlock(block.role), text: block.text };
  });
  const importedDraft = normalizeCoverLetterDraft({
    ...draft,
    coverLetter: {
      ...draft.coverLetter,
      sender: { mode: 'resume', overrides: senderOverrides },
      recipient: { ...recipient, date: source.dateLine },
      greeting: source.greeting,
      bodyBlocks,
      signOff: source.signOff || 'Sincerely,',
      signatureName: source.signatureName,
    },
  }, resumeId);
  const baseName = trimText(source.recipientLines.find((line) => COMPANY_PATTERN.test(line)))
    || trimText(sourceFileName).replace(/\.[^.]+$/, '')
    || 'Cover letter';

  return {
    suggestedName: `${baseName.replace(/\s+cover\s+letter$/i, '')} cover letter`.slice(0, 50),
    draft: importedDraft,
    senderValues: senderOverrides,
  };
}

