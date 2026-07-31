import { trimText } from './text.js';
import {
  DOCX_MIME_TYPE,
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES,
  PDF_MIME_TYPE,
} from './importFileTypes.js';

export {
  DOCX_MIME_TYPE as JOB_LISTING_DOCX_MIME,
  IMPORT_FILE_MAX_BYTES as JOB_LISTING_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES as JOB_LISTING_FILE_MAX_MEGABYTES,
  PDF_MIME_TYPE as JOB_LISTING_PDF_MIME,
};
export const JOB_LISTING_FILE_ACCEPT = `.pdf,.docx,${PDF_MIME_TYPE},${DOCX_MIME_TYPE}`;
const JOB_LISTING_MIME_BY_EXTENSION = new Map([['pdf', PDF_MIME_TYPE], ['docx', DOCX_MIME_TYPE]]);
const PRIVATE_HOSTNAME = /^(?:localhost|0\.0\.0\.0|127\.0\.0\.1|::1|10\..*|192\.168\..*|169\.254\..*|172\.(?:1[6-9]|2\d|3[01])\..*)$/;
const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal'];

export function normalizeJobListingMimeType(fileName, mimeType = '') {
  const expected = JOB_LISTING_MIME_BY_EXTENSION.get(trimText(fileName).toLowerCase().split('.').pop());
  const normalized = trimText(mimeType).toLowerCase();
  if (!expected) return '';
  if (!normalized || normalized === 'application/octet-stream') return expected;
  return normalized === expected ? expected : '';
}

export function validateJobListingFile(file) {
  if (!file) return 'Choose a PDF or DOCX job listing.';
  if (!normalizeJobListingMimeType(file.name, file.type)) return 'Upload a PDF or DOCX job listing.';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > IMPORT_FILE_MAX_BYTES) {
    return `Upload a job listing smaller than ${IMPORT_FILE_MAX_MEGABYTES} MB.`;
  }
  return '';
}

export function normalizePublicJobListingUrl(value) {
  let url;
  try {
    url = new URL(trimText(value));
  } catch {
    return '';
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blockedHostname = PRIVATE_HOSTNAME.test(hostname)
    || PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

  return blockedHostname ? '' : url.toString();
}
