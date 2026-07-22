import { useEffect, useRef, useState } from 'react';
import {
  clearBrowserResumeConnectionData,
  clearLocalResumeWorkspaceData,
  readSignedOutEditingPreference,
  writeSignedOutEditingPreference,
} from '../lib/browserConnection.js';
import { requestResumeBackgroundSync } from '../lib/backgroundSync.js';
import {
  runBrowserDisconnect,
  runBrowserSignOut,
} from '../lib/browserAccountLifecycle.js';
import { setSyncSessionCleanupRequested } from '../lib/localWorkspaceDb.js';
import { clearResumeSyncSession } from '../lib/syncSession.js';

const SIGN_OUT_ERROR_MESSAGES = {
  'cloud-sync-incomplete': 'Cloud sync did not finish, so this browser was not cleared. Reconnect and try again.',
  'session-cleanup-arm-failed': 'Secure background sync could not be prepared, so you are still signed in. Reload and try again.',
  'session-clear-failed': 'Secure sign-out could not finish. Check your connection and try again.',
  'auth-signout-failed': 'Sign-out could not finish. Check your connection and try again.',
};

const DISCONNECT_ERROR_MESSAGES = {
  'cloud-sync-incomplete': 'Cloud sync did not finish, so this browser was not cleared. Reconnect and try again.',
  'browser-disconnect-failed': 'This browser could not be disconnected securely. Check your connection and try again.',
};

export function useSignOutController({
  auth,
  flushActiveCloudDraft,
  showNotice,
  syncState,
}) {
  const disconnectingRef = useRef(false);
  const signingOutRef = useRef(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [editingPreference, setEditingPreference] = useState(() => readSignedOutEditingPreference());

  useEffect(() => {
    if (!auth.user || editingPreference.allow) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      if (syncState !== 'syncing' && syncState !== 'error' && syncState !== 'offline') {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [auth.user, editingPreference.allow, syncState]);

  function updateEditingPreference(nextPreference) {
    setEditingPreference(writeSignedOutEditingPreference(nextPreference));
  }

  async function completeSignOut({ allowSignedOutEditing }) {
    if (signingOutRef.current) {
      return false;
    }

    signingOutRef.current = true;
    setIsSigningOut(true);

    try {
      const result = await runBrowserSignOut({
        user: auth.user,
        allowSignedOutEditing,
        flushActiveCloudDraft,
        requestBackgroundSync: requestResumeBackgroundSync,
        setSessionCleanupRequested: setSyncSessionCleanupRequested,
        clearSyncSession: clearResumeSyncSession,
        signOut: auth.signOut,
        clearLocalWorkspace: clearLocalResumeWorkspaceData,
        reloadBrowser: () => window.location.reload(),
      });
      const errorMessage = SIGN_OUT_ERROR_MESSAGES[result.status];

      if (errorMessage) {
        showNotice({ tone: 'error', message: errorMessage });
        return false;
      }

      return result.status === 'signed-out';
    } catch {
      showNotice({
        tone: 'error',
        message: 'Sign-out could not finish. Reload and verify this browser before leaving it.',
      });
      return false;
    } finally {
      signingOutRef.current = false;
      setIsSigningOut(false);
      setIsPromptOpen(false);
    }
  }

  async function requestSignOut() {
    if (signingOutRef.current) {
      return;
    }

    if (editingPreference.skipPrompt) {
      await completeSignOut({ allowSignedOutEditing: editingPreference.allow });
      return;
    }

    setIsPromptOpen(true);
  }

  async function chooseSignOutBehavior(choice) {
    if (choice.skipPrompt) {
      updateEditingPreference(choice);
    } else {
      updateEditingPreference({
        ...editingPreference,
        allow: choice.allow,
      });
    }

    await completeSignOut({ allowSignedOutEditing: choice.allow });
  }

  function cancelSignOut() {
    if (!isSigningOut) {
      setIsPromptOpen(false);
    }
  }

  async function disconnectBrowser() {
    if (disconnectingRef.current) {
      return false;
    }

    disconnectingRef.current = true;
    setIsDisconnecting(true);

    try {
      const result = await runBrowserDisconnect({
        user: auth.user,
        flushActiveCloudDraft,
        disconnectAuth: auth.clearBrowserConnection,
        clearBrowserData: clearBrowserResumeConnectionData,
        reloadBrowser: () => window.location.reload(),
      });
      const errorMessage = DISCONNECT_ERROR_MESSAGES[result.status];

      if (errorMessage) {
        showNotice({ tone: 'error', message: errorMessage });
        return false;
      }

      return result.status === 'disconnected';
    } catch {
      showNotice({
        tone: 'error',
        message: 'This browser could not be disconnected completely. Reload and verify it before leaving.',
      });
      return false;
    } finally {
      disconnectingRef.current = false;
      setIsDisconnecting(false);
    }
  }

  return {
    cancelSignOut,
    chooseSignOutBehavior,
    disconnectBrowser,
    editingPreference,
    isDisconnecting,
    isPromptOpen,
    isSigningOut,
    requestSignOut,
    updateEditingPreference,
  };
}
