import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  clearFirebaseBrowserCache,
  getFirebaseAuth,
  getFirebaseDbCacheMode,
  hasFirebaseConfig,
  initializeFirebaseAppCheck,
  isFirebaseDbInitialized,
} from '../lib/firebaseClient.js';
import {
  clearConnectedAccount,
  readConnectedAccount,
  writeConnectedAccount,
} from '../lib/browserConnection.js';
import {
  getTrustedDevicePreference,
  setTrustedDevicePreference,
} from '../lib/firebaseWorkspace.js';

function getFriendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password does not look right.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup was closed before finishing.';
    case 'auth/weak-password':
      return 'Use a stronger password with at least six characters.';
    default:
      return error?.message || 'Sign-in failed. Try again.';
  }
}

export function useFirebaseAuth() {
  const firebaseEnabled = hasFirebaseConfig();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState(() => getTrustedDevicePreference());
  const [connectedAccount, setConnectedAccount] = useState(() => readConnectedAccount());
  const trustedDeviceLocked = Boolean(user) || isFirebaseDbInitialized();

  useEffect(() => {
    if (!firebaseEnabled) {
      return undefined;
    }

    initializeFirebaseAppCheck();
    const auth = getFirebaseAuth();

    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      if (nextUser) {
        const account = writeConnectedAccount(nextUser, {
          trustedDevice,
          cacheMode: getFirebaseDbCacheMode(),
        });
        setConnectedAccount(account);
      } else {
        setConnectedAccount(readConnectedAccount());
      }

      setUser(nextUser);
      setAuthReady(true);
    });
  }, [firebaseEnabled, trustedDevice]);

  function updateTrustedDevice(nextValue) {
    if (trustedDeviceLocked) {
      setAuthError('Sign out and back in to change offline cache.');
      return;
    }

    setTrustedDevice(nextValue);
    setTrustedDevicePreference(nextValue);
  }

  async function runAuthAction(action) {
    setAuthError('');

    if (!firebaseEnabled) {
      setAuthError('Firebase is not configured for this deployment yet.');
      return;
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      setAuthError('Firebase is not available in this browser session.');
      return;
    }

    setAuthBusy(true);

    try {
      await action(auth);
      setIsAuthModalOpen(false);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  return {
    user,
    connectedAccount,
    authReady,
    authBusy,
    authError,
    firebaseEnabled,
    isAuthModalOpen,
    trustedDevice,
    trustedDeviceLocked,
    dbCacheMode: getFirebaseDbCacheMode(),
    openAuthModal() {
      setAuthError('');
      setIsAuthModalOpen(true);
    },
    closeAuthModal() {
      setAuthError('');
      setIsAuthModalOpen(false);
    },
    setTrustedDevice: updateTrustedDevice,
    signInWithGoogle() {
      return runAuthAction((auth) => signInWithPopup(auth, new GoogleAuthProvider()));
    },
    signInWithEmail(email, password) {
      return runAuthAction((auth) => signInWithEmailAndPassword(auth, email, password));
    },
    signUpWithEmail(email, password) {
      return runAuthAction((auth) => createUserWithEmailAndPassword(auth, email, password));
    },
    async signOut() {
      setAuthError('');
      const auth = getFirebaseAuth();

      if (!auth) {
        return;
      }

      setAuthBusy(true);

      try {
        await signOut(auth);
        return true;
      } catch (error) {
        setAuthError(getFriendlyAuthError(error));
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    async clearBrowserConnection() {
      setAuthError('');
      const auth = getFirebaseAuth();

      setAuthBusy(true);

      try {
        if (auth?.currentUser) {
          await signOut(auth);
        }

        await clearFirebaseBrowserCache();
        clearConnectedAccount();
        setTrustedDevice(false);
        setTrustedDevicePreference(false);
        setConnectedAccount(null);
      } catch (error) {
        setAuthError(getFriendlyAuthError(error));
      } finally {
        setAuthBusy(false);
      }
    },
  };
}
