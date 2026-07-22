import { ImportResumeError } from './error.js';

export async function parseImportRequestBody(req) {
  try {
    if (req.body) {
      return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new ImportResumeError('The upload request could not be read.', {
      statusCode: 400,
      code: 'import/invalid-json',
    });
  }
}

export function createImportResponseBody(parsedImport) {
  return {
    suggestedName: parsedImport.suggestedName,
    draft: parsedImport.draft,
  };
}
