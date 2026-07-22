import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { parseCookieHeader } from './httpProtocol.js';

export class FirebaseAdminError extends Error {
  constructor(message, {
    statusCode = 500,
    code = 'firebase-admin/error',
    expose = statusCode < 500,
  } = {}) {
    super(message);
    this.name = 'FirebaseAdminError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
  }
}

function parseServiceAccount() {
  const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!rawValue) {
    throw new FirebaseAdminError('Firebase Admin is not configured.', {
      statusCode: 500,
      code: 'firebase-admin/missing-service-account',
    });
  }

  const trimmedValue = rawValue.trim();
  const jsonValue = trimmedValue.startsWith('{')
    ? trimmedValue
    : Buffer.from(trimmedValue, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(jsonValue);

  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return serviceAccount;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(parseServiceAccount()),
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

function extractBearerToken(authorizationHeader) {
  return String(authorizationHeader || '').trim().replace(/^Bearer\s+/i, '');
}

export async function verifyFirebaseIdTokenHeader(authorizationHeader) {
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    throw new FirebaseAdminError('Sign in to continue.', {
      statusCode: 401,
      code: 'firebase-admin/unauthorized',
    });
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new FirebaseAdminError('Your sign-in expired. Sign in again.', {
      statusCode: 401,
      code: 'firebase-admin/invalid-token',
    });
  }
}

async function verifyFirebaseSessionCookie(cookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  const sessionCookie = cookies.__session || cookies.resumeSyncSession || '';

  if (!sessionCookie) {
    throw new FirebaseAdminError('Sign in to continue.', {
      statusCode: 401,
      code: 'firebase-admin/missing-session',
    });
  }

  try {
    return await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    throw new FirebaseAdminError('Your browser sync session expired. Sign in again.', {
      statusCode: 401,
      code: 'firebase-admin/invalid-session',
    });
  }
}

export async function verifyRequestUser(req) {
  if (req.headers.authorization) {
    return verifyFirebaseIdTokenHeader(req.headers.authorization);
  }

  return verifyFirebaseSessionCookie(req.headers.cookie || '');
}
