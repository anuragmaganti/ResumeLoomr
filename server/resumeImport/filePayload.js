import { z } from 'zod';

import { trimText } from '../../src/lib/text.js';
import { ImportResumeError } from './error.js';

export const IMPORT_FILE_MAX_BYTES = 3 * 1024 * 1024;
export const PDF_MIME_TYPE = 'application/pdf';
export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PNG_MIME_TYPE = 'image/png';
export const JPEG_MIME_TYPE = 'image/jpeg';

const OCTET_STREAM_MIME_TYPE = 'application/octet-stream';
const SUPPORTED_FILE_TYPES_LABEL = 'PDF, DOCX, PNG, JPG, or JPEG';

const importRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional().default(''),
  fileDataBase64: z.string().min(1),
});

export function isImageMimeType(mimeType) {
  return mimeType === PNG_MIME_TYPE || mimeType === JPEG_MIME_TYPE;
}

function getExtension(fileName) {
  const match = trimText(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function normalizeMimeType(fileName, mimeType) {
  const extension = getExtension(fileName);
  const normalizedMimeType = trimText(mimeType).toLowerCase();

  if (extension === 'pdf' && (!normalizedMimeType || normalizedMimeType === PDF_MIME_TYPE || normalizedMimeType === OCTET_STREAM_MIME_TYPE)) {
    return PDF_MIME_TYPE;
  }

  if (extension === 'docx' && (!normalizedMimeType || normalizedMimeType === DOCX_MIME_TYPE || normalizedMimeType === OCTET_STREAM_MIME_TYPE)) {
    return DOCX_MIME_TYPE;
  }

  if (extension === 'png' && (!normalizedMimeType || normalizedMimeType === PNG_MIME_TYPE || normalizedMimeType === OCTET_STREAM_MIME_TYPE)) {
    return PNG_MIME_TYPE;
  }

  if ((extension === 'jpg' || extension === 'jpeg') && (!normalizedMimeType || normalizedMimeType === JPEG_MIME_TYPE || normalizedMimeType === OCTET_STREAM_MIME_TYPE)) {
    return JPEG_MIME_TYPE;
  }

  if (extension) {
    return '';
  }

  if (normalizedMimeType === PDF_MIME_TYPE) {
    return PDF_MIME_TYPE;
  }

  if (normalizedMimeType === DOCX_MIME_TYPE) {
    return DOCX_MIME_TYPE;
  }

  if (isImageMimeType(normalizedMimeType)) {
    return normalizedMimeType;
  }

  return '';
}

function normalizeBase64(value) {
  const rawValue = trimText(value);
  const base64Value = rawValue.includes(',') ? rawValue.split(',').pop() : rawValue;
  const compactValue = base64Value.replace(/\s/g, '');

  if (!/^[a-zA-Z0-9+/]*={0,2}$/.test(compactValue)) {
    throw new ImportResumeError('The uploaded file could not be read.', {
      statusCode: 400,
      code: 'import/invalid-file-data',
    });
  }

  return compactValue;
}

export function normalizeImportFilePayload(payload) {
  const parsedPayload = importRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new ImportResumeError(`Upload a ${SUPPORTED_FILE_TYPES_LABEL} resume file.`, {
      statusCode: 400,
      code: 'import/invalid-request',
    });
  }

  const mimeType = normalizeMimeType(parsedPayload.data.fileName, parsedPayload.data.mimeType);

  if (!mimeType) {
    throw new ImportResumeError(`Upload a ${SUPPORTED_FILE_TYPES_LABEL} resume file.`, {
      statusCode: 415,
      code: 'import/unsupported-file-type',
    });
  }

  const base64 = normalizeBase64(parsedPayload.data.fileDataBase64);
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length === 0) {
    throw new ImportResumeError('The uploaded file is empty.', {
      statusCode: 400,
      code: 'import/empty-file',
    });
  }

  if (buffer.length > IMPORT_FILE_MAX_BYTES) {
    throw new ImportResumeError('Upload a resume smaller than 3 MB.', {
      statusCode: 413,
      code: 'import/file-too-large',
    });
  }

  return {
    fileName: parsedPayload.data.fileName,
    mimeType,
    base64: buffer.toString('base64'),
    buffer,
    size: buffer.length,
  };
}
