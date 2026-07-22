import { ImportResumeError } from './error.js';
import {
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES,
} from '../../src/lib/importFileTypes.js';
import { readJsonRequestBody } from '../httpProtocol.js';

const IMPORT_REQUEST_MAX_BYTES = Math.ceil(IMPORT_FILE_MAX_BYTES * (4 / 3)) + (128 * 1024);

export async function parseImportRequestBody(req) {
  try {
    return await readJsonRequestBody(req, { maxBytes: IMPORT_REQUEST_MAX_BYTES });
  } catch (error) {
    const isTooLarge = error?.statusCode === 413;

    throw new ImportResumeError(
      isTooLarge
        ? `Upload a resume smaller than ${IMPORT_FILE_MAX_MEGABYTES} MB.`
        : 'The upload request could not be read.',
      {
        statusCode: isTooLarge ? 413 : 400,
        code: isTooLarge ? 'import/file-too-large' : 'import/invalid-json',
      },
    );
  }
}

export function createImportResponseBody(parsedImport) {
  return {
    suggestedName: parsedImport.suggestedName,
    draft: parsedImport.draft,
  };
}
