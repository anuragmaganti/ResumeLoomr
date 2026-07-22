import { trimText } from '../../src/lib/text.js';
import { isLikelyPersonalContactLine } from './sourceSignals.js';

export function isContactLinkGroupingLabel(line) {
  return /^(?:links?|contact|contacts?|online|web|profiles?)$/i.test(trimText(line));
}

export function shouldTreatAsContactGroupingLabel(line, nextLine = '') {
  const text = trimText(line);

  if (/^(?:links?|online|web)$/i.test(text)) {
    return true;
  }

  return isContactLinkGroupingLabel(text) && isLikelyPersonalContactLine(nextLine);
}

export function isKnownSourceSectionHeader(line) {
  return /^(?:summary|profile|objective|education|relevant coursework|coursework|internship experience|professional experience|work experience|additional work experience|employment experience|experience|leadership(?: experience|\s*(?:&|and|\+)\s*service)?|volunteer experience|volunteering|research(?: experience)?|teaching(?: experience)?|advising(?: experience)?|industry(?: experience)?|military(?: experience| service)?|clinical(?: experience)?|campus involvement|public service|community service|projects?|skills|certifications?|languages|additional information|activities?\s*(?:&|and|\+)\s*awards?|honors?\s*(?:&|and|\+)?\s*awards?|awards(?:\s*(?:&|and|\+)\s*interests?)?|interests?|publications?|invited talks?|conferences?|patents?|references?)$/i.test(trimText(line));
}

function getRoleSectionType(line) {
  const text = trimText(line);

  if (/^leadership experience$/i.test(text)) {
    return 'leadership';
  }

  if (/^(?:internship experience|professional experience|work experience|additional work experience|employment experience|experience|volunteer experience|volunteering|research(?: experience)?|teaching(?: experience)?|advising(?: experience)?|industry(?: experience)?|military(?: experience| service)?|clinical(?: experience)?|campus involvement|public service|community service)$/i.test(text)) {
    return 'experience';
  }

  return '';
}

export function slugifyImportId(value, fallback = 'section') {
  const slug = trimText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

export function getSourceSectionHeaderInfo(line) {
  const title = trimText(line);

  if (!isKnownSourceSectionHeader(title)) {
    return null;
  }

  if (/^education$/i.test(title)) {
    return { title, kind: 'education', roleType: '' };
  }

  if (/^(?:summary|profile|objective)$/i.test(title)) {
    return { title, kind: 'custom', roleType: '' };
  }

  if (/^(?:relevant\s+)?coursework$/i.test(title)) {
    return { title, kind: 'education-detail', roleType: '' };
  }

  if (/^honors?\s*(?:&|and)?\s*awards?$|^awards$/i.test(title)) {
    return { title, kind: 'awards', roleType: '' };
  }

  if (/^projects?$/i.test(title)) {
    return { title, kind: 'projects', roleType: '' };
  }

  if (/^(?:skills|additional information)$/i.test(title)) {
    return { title, kind: 'skills', roleType: '' };
  }

  if (/^certifications?$/i.test(title)) {
    return { title, kind: 'certifications', roleType: '' };
  }

  if (/^languages$/i.test(title)) {
    return { title, kind: 'languages', roleType: '' };
  }

  if (/^publications?$/i.test(title)) {
    return { title, kind: 'publications', roleType: '' };
  }

  if (/^(?:invited talks?|conferences?|patents?)$/i.test(title)) {
    return { title, kind: 'publications', roleType: '' };
  }

  if (/^references?$/i.test(title)) {
    return { title, kind: 'custom', roleType: '' };
  }

  const roleType = getRoleSectionType(title);

  if (roleType) {
    return { title, kind: 'roles', roleType };
  }

  return { title, kind: 'custom', roleType: '' };
}
