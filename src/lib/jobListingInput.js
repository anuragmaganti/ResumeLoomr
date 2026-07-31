import { trimText } from './text.js';

export const JOB_LISTING_FILE_MAX_BYTES = 3 * 1024 * 1024;
export const JOB_LISTING_FILE_MAX_MEGABYTES = 3;
export const JOB_LISTING_FILE_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const JOB_LISTING_PDF_MIME = 'application/pdf';
export const JOB_LISTING_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const EXTENSION_MIME = new Map([
  ['pdf', JOB_LISTING_PDF_MIME],
  ['docx', JOB_LISTING_DOCX_MIME],
]);

export function normalizeJobListingMimeType(fileName, mimeType = '') {
  const extension = trimText(fileName).toLowerCase().split('.').pop();
  const expectedMime = EXTENSION_MIME.get(extension);
  const normalizedMime = trimText(mimeType).toLowerCase();

  if (!expectedMime) return '';
  if (!normalizedMime || normalizedMime === 'application/octet-stream') return expectedMime;
  return normalizedMime === expectedMime ? expectedMime : '';
}

export function validateJobListingFile(file) {
  if (!file) return 'Choose a PDF or DOCX job listing.';
  if (!normalizeJobListingMimeType(file.name, file.type)) return 'Upload a PDF or DOCX job listing.';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > JOB_LISTING_FILE_MAX_BYTES) {
    return `Upload a job listing smaller than ${JOB_LISTING_FILE_MAX_MEGABYTES} MB.`;
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
  const blockedHostname = (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === '0.0.0.0'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );

  return blockedHostname ? '' : url.toString();
}
