import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let appInstance = null;
let authInstance = null;
let dbInstance = null;
let dbCacheMode = null;
let appCheckInitialized = false;

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

export function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
  }

  return appInstance;
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  if (!authInstance) {
    authInstance = getAuth(app);
  }

  return authInstance;
}

export function initializeFirebaseAppCheck() {
  const app = getFirebaseApp();
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

  if (!app || !siteKey || appCheckInitialized || typeof window === 'undefined') {
    return;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
}

export function getFirebaseDb({ trustedDevice = false } = {}) {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  const requestedMode = trustedDevice ? 'persistent' : 'memory';

  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = initializeFirestore(app, {
    localCache: trustedDevice
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
  });
  dbCacheMode = requestedMode;

  return dbInstance;
}

export function getFirebaseDbCacheMode() {
  return dbCacheMode;
}
