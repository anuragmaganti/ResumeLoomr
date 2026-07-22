import { z } from 'zod';

import {
  DOCX_MIME_TYPE,
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES,
  IMPORT_FILE_TYPES_LABEL,
  PDF_MIME_TYPE,
  isResumeImportImageMimeType,
  normalizeResumeImportMimeType,
} from '../../src/lib/importFileTypes.js';
import { trimText } from '../../src/lib/text.js';
import { ImportResumeError } from './error.js';

export { DOCX_MIME_TYPE, IMPORT_FILE_MAX_BYTES, PDF_MIME_TYPE };

const importRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional().default(''),
  fileDataBase64: z.string().min(1),
});

export function isImageMimeType(mimeType) {
  return isResumeImportImageMimeType(mimeType);
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
    throw new ImportResumeError(`Upload a ${IMPORT_FILE_TYPES_LABEL} resume file.`, {
      statusCode: 400,
      code: 'import/invalid-request',
    });
  }

  const mimeType = normalizeResumeImportMimeType(parsedPayload.data.fileName, parsedPayload.data.mimeType);

  if (!mimeType) {
    throw new ImportResumeError(`Upload a ${IMPORT_FILE_TYPES_LABEL} resume file.`, {
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
    throw new ImportResumeError(`Upload a resume smaller than ${IMPORT_FILE_MAX_MEGABYTES} MB.`, {
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
