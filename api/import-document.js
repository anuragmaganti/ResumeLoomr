import { verifyFirebaseIdToken } from '../server/importResume.js';
import { parseImportedDocument } from '../server/importDocument.js';
import { ImportResumeError } from '../server/resumeImport/error.js';
import { normalizeImportFilePayload } from '../server/resumeImport/filePayload.js';
import { parseImportRequestBody } from '../server/resumeImport/http.js';
import { sendPrivateError, sendPrivateJson } from '../server/httpProtocol.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendPrivateJson(res, 405, {
      error: { code: 'import/method-not-allowed', message: 'Use POST to import a document.' },
    });
    return;
  }

  const startedAt = Date.now();
  const requestId = req.headers['x-vercel-id'] || req.headers['x-request-id'] || '';
  try {
    const decodedUser = await verifyFirebaseIdToken(req.headers.authorization || '');
    const body = await parseImportRequestBody(req);
    const file = normalizeImportFilePayload(body);
    const parsed = await parseImportedDocument(file, {
      documentKind: body.documentKind,
      resumeId: typeof body.resumeId === 'string' ? body.resumeId.trim() : '',
    });

    console.info(JSON.stringify({
      level: 'info',
      message: 'Document import completed',
      requestId,
      uid: decodedUser.uid,
      documentKind: parsed.documentKind,
      ms: Date.now() - startedAt,
      fileSizeBytes: file.size,
      mimeType: file.mimeType,
      warningCount: parsed.draft?.importWarnings?.length || 0,
      diagnostics: parsed.diagnostics || undefined,
    }));
    sendPrivateJson(res, 200, {
      documentKind: parsed.documentKind,
      suggestedName: parsed.suggestedName,
      draft: parsed.draft,
      senderValues: parsed.senderValues || undefined,
    });
  } catch (error) {
    if (!(error instanceof ImportResumeError) || error.statusCode >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Document import failed',
        requestId,
        code: error?.code,
        errorMessage: error?.message,
        diagnostics: error?.diagnostics || undefined,
      }));
    }
    const statusCode = error instanceof ImportResumeError ? error.statusCode : 500;
    sendPrivateError(res, statusCode, error, {
      code: 'import/failed',
      message: 'Document import failed. Try again with another file.',
    });
  }
}

