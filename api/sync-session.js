import {
  FirebaseAdminError,
  getAdminAuth,
  verifyFirebaseIdTokenHeader,
} from '../server/firebaseAdmin.js';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_MAX_AGE_MS / 1000);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function createCookie(value, { maxAge = SESSION_MAX_AGE_SECONDS } = {}) {
  const encodedValue = encodeURIComponent(value);
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return `${SESSION_COOKIE_NAME}=${encodedValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureFlag}`;
}

function clearCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    sendJson(res, 405, {
      error: {
        code: 'sync-session/method-not-allowed',
        message: 'Use POST to start a sync session.',
      },
    });
    return;
  }

  try {
    const decodedToken = await verifyFirebaseIdTokenHeader(req.headers.authorization || '');
    const idToken = String(req.headers.authorization || '').trim().replace(/^Bearer\s+/i, '');
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    res.setHeader('Set-Cookie', createCookie(sessionCookie));
    sendJson(res, 200, {
      ok: true,
      uid: decodedToken.uid,
      expiresIn: SESSION_MAX_AGE_SECONDS,
    });
  } catch (error) {
    const statusCode = error instanceof FirebaseAdminError ? error.statusCode : 500;

    sendJson(res, statusCode, {
      error: {
        code: error?.code || 'sync-session/failed',
        message: error?.message || 'Could not start browser sync session.',
      },
    });
  }
}
