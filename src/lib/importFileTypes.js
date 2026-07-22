export const IMPORT_FILE_MAX_BYTES = 3 * 1024 * 1024;
export const IMPORT_FILE_MAX_MEGABYTES = 3;
export const PDF_MIME_TYPE = 'application/pdf';
export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PNG_MIME_TYPE = 'image/png';
export const JPEG_MIME_TYPE = 'image/jpeg';
export const IMPORT_FILE_TYPES_LABEL = 'PDF, DOCX, PNG, JPG, or JPEG';
export const IMPORT_FILE_ACCEPT = [
  '.pdf',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
  PNG_MIME_TYPE,
  JPEG_MIME_TYPE,
].join(',');

const OCTET_STREAM_MIME_TYPE = 'application/octet-stream';
const CANONICAL_MIME_TYPE_BY_EXTENSION = {
  pdf: PDF_MIME_TYPE,
  docx: DOCX_MIME_TYPE,
  png: PNG_MIME_TYPE,
  jpg: JPEG_MIME_TYPE,
  jpeg: JPEG_MIME_TYPE,
};
const SUPPORTED_MIME_TYPES = new Set(Object.values(CANONICAL_MIME_TYPE_BY_EXTENSION));

function getFileExtension(fileName) {
  const match = String(fileName || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

export function normalizeResumeImportMimeType(
  fileName,
  mimeType,
  { allowMimeOnly = true } = {},
) {
  const extension = getFileExtension(fileName);
  const canonicalMimeType = CANONICAL_MIME_TYPE_BY_EXTENSION[extension];
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();

  if (canonicalMimeType) {
    return !normalizedMimeType
      || normalizedMimeType === canonicalMimeType
      || normalizedMimeType === OCTET_STREAM_MIME_TYPE
      ? canonicalMimeType
      : '';
  }

  if (extension || !allowMimeOnly) {
    return '';
  }

  return SUPPORTED_MIME_TYPES.has(normalizedMimeType) ? normalizedMimeType : '';
}

export function isResumeImportImageMimeType(mimeType) {
  return mimeType === PNG_MIME_TYPE || mimeType === JPEG_MIME_TYPE;
}
