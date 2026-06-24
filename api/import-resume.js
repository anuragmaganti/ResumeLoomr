import {
  ImportResumeError,
  createImportResponseBody,
  enforceDailyImportLimit,
  normalizeImportFilePayload,
  parseImportRequestBody,
  parseResumeWithGemini,
  verifyFirebaseIdToken,
} from '../server/importResume.js';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function logImportError(error) {
  if (error instanceof ImportResumeError && error.statusCode < 500) {
    return;
  }

  console.error('Resume import failed', {
    code: error?.code,
    message: error?.message,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, {
      error: {
        code: 'import/method-not-allowed',
        message: 'Use POST to import a resume.',
      },
    });
    return;
  }

  try {
    const decodedToken = await verifyFirebaseIdToken(req.headers.authorization || '');
    const body = await parseImportRequestBody(req);
    const file = normalizeImportFilePayload(body);

    await enforceDailyImportLimit(decodedToken.uid);

    const parsedImport = await parseResumeWithGemini(file);
    sendJson(res, 200, createImportResponseBody(parsedImport));
  } catch (error) {
    logImportError(error);

    if (error instanceof ImportResumeError) {
      sendJson(res, error.statusCode, {
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    sendJson(res, 500, {
      error: {
        code: 'import/failed',
        message: 'Resume import failed. Try again with another file.',
      },
    });
  }
}
