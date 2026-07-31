import { verifyFirebaseIdTokenHeader } from '../server/firebaseAdmin.js';
import { readJsonRequestBody, sendPrivateError, sendPrivateJson } from '../server/httpProtocol.js';
import {
  ResumeTailoringError,
  parseResumeTailoringRequest,
  tailorResumeToJob,
} from '../server/resumeTailoring.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendPrivateJson(res, 405, {
      error: { code: 'tailor/method-not-allowed', message: 'Use POST to tailor a resume.' },
    });
    return;
  }

  const startedAt = Date.now();
  const requestId = req.headers['x-vercel-id'] || req.headers['x-request-id'] || '';
  try {
    const user = await verifyFirebaseIdTokenHeader(req.headers.authorization || '');
    const request = await parseResumeTailoringRequest(req, readJsonRequestBody);
    const result = await tailorResumeToJob(request);

    console.info(JSON.stringify({
      level: 'info',
      message: 'Resume tailoring completed',
      requestId,
      uid: user.uid,
      sourceType: request.source.type,
      targetCount: request.resume.targets.length,
      changeCount: result.changes.length,
      ms: Date.now() - startedAt,
    }));
    sendPrivateJson(res, 200, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Resume tailoring failed',
        requestId,
        code: error?.code,
        errorMessage: error?.message,
        diagnostics: error?.diagnostics || undefined,
      }));
    }
    sendPrivateError(res, statusCode, error, {
      code: 'tailor/failed',
      message: 'The resume could not be tailored. Try again.',
    });
  }
}
