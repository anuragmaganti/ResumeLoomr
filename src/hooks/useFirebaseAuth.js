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
  getFirebaseAuth,
  hasFirebaseConfig,
  initializeFirebaseAppCheck,
} from '../lib/firebaseClient.js';
import {
  clearConnectedAccount,
  readConnectedAccount,
  writeConnectedAccount,
} from '../lib/browserConnection.js';
import {
  clearResumeSyncSession,
  createResumeSyncSession,
} from '../lib/backgroundSync.js';
import { setSyncSessionCleanupRequested } from '../lib/localWorkspaceDb.js';

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
  const [connectedAccount, setConnectedAccount] = useState(() => readConnectedAccount());

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
        const account = writeConnectedAccount(nextUser);
        setConnectedAccount(account);
        setSyncSessionCleanupRequested(nextUser.uid, false)
          .then(() => nextUser.getIdToken())
          .then((idToken) => createResumeSyncSession(idToken))
          .catch((error) => {
            if (import.meta.env.DEV) {
              console.warn('Could not start resume sync session', error);
            }
          });
      } else {
        setConnectedAccount(readConnectedAccount());
      }

      setUser(nextUser);
      setAuthReady(true);
    });
  }, [firebaseEnabled]);

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
    openAuthModal() {
      setAuthError('');
      setIsAuthModalOpen(true);
    },
    closeAuthModal() {
      setAuthError('');
      setIsAuthModalOpen(false);
    },
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
        const sessionCleared = await clearResumeSyncSession();

        if (!sessionCleared) {
          throw new Error('Secure browser disconnect could not finish. Check your connection and try again.');
        }

        if (auth?.currentUser) {
          await signOut(auth);
        }

        clearConnectedAccount();
        setConnectedAccount(null);
        return true;
      } catch (error) {
        setAuthError(getFriendlyAuthError(error));
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
  };
}
