import {
  FirebaseAdminError,
  verifyFirebaseIdTokenHeader,
} from '../firebaseAdmin.js';
import { ImportResumeError } from './error.js';

export async function verifyFirebaseIdToken(authorizationHeader) {
  try {
    return await verifyFirebaseIdTokenHeader(authorizationHeader);
  } catch (error) {
    throw new ImportResumeError(error?.message || 'Your sign-in expired. Sign in again to import a resume.', {
      statusCode: error instanceof FirebaseAdminError ? error.statusCode : 401,
      code: error instanceof FirebaseAdminError ? error.code : 'import/invalid-token',
    });
  }
}
