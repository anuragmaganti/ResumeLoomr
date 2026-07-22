import {
  ImportResumeError,
  createImportResponseBody,
  normalizeImportFilePayload,
  parseImportRequestBody,
  parseResumeWithGemini,
  verifyFirebaseIdToken,
} from '../server/importResume.js';
import { sendPrivateJson } from '../server/httpProtocol.js';

function logImportError(error, context = {}) {
  if (error instanceof ImportResumeError && error.statusCode < 500) {
    return;
  }

  console.error(JSON.stringify({
    level: 'error',
    message: 'Resume import failed',
    code: error?.code,
    errorMessage: error?.message,
    statusCode: error?.statusCode,
    diagnostics: error?.diagnostics || undefined,
    ...context,
  }));
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const requestId = req.headers['x-vercel-id'] || req.headers['x-request-id'] || '';

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendPrivateJson(res, 405, {
      error: {
        code: 'import/method-not-allowed',
        message: 'Use POST to import a resume.',
      },
    });
    return;
  }

  try {
    await verifyFirebaseIdToken(req.headers.authorization || '');
    const body = await parseImportRequestBody(req);
    const file = normalizeImportFilePayload(body);

    const parsedImport = await parseResumeWithGemini(file);
    console.info(JSON.stringify({
      level: 'info',
      message: 'Resume import completed',
      requestId,
      ms: Date.now() - startedAt,
      fileSizeBytes: file.size,
      mimeType: file.mimeType,
      sectionCount: parsedImport?.draft?.resume?.sections?.length || 0,
      warningCount: parsedImport?.draft?.importWarnings?.length || 0,
      diagnostics: parsedImport?.diagnostics || undefined,
    }));
    sendPrivateJson(res, 200, createImportResponseBody(parsedImport));
  } catch (error) {
    logImportError(error, {
      requestId,
      ms: Date.now() - startedAt,
    });

    if (error instanceof ImportResumeError) {
      sendPrivateJson(res, error.statusCode, {
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    sendPrivateJson(res, 500, {
      error: {
        code: 'import/failed',
        message: 'Resume import failed. Try again with another file.',
      },
    });
  }
}
