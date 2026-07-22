import { useEffect, useRef, useState } from 'react';
import {
  clearLocalResumeWorkspaceData,
  readConnectedAccount,
} from '../lib/browserConnection.js';
import { readDurableLocalBrowserContext } from '../lib/localWorkspaceDb.js';

function createAccountSnapshot(user) {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
  };
}

export function deriveAccountSwitchGate({ user, durableContext, resolvedAccountUid }) {
  const accountContextReady = !user || durableContext.checkedForUid === user.uid;
  const previousAccount = user && durableContext.previousAccount?.uid !== user.uid
    ? durableContext.previousAccount
    : null;
  const isSwitchPending = Boolean(
    user
    && accountContextReady
    && previousAccount?.uid
    && resolvedAccountUid !== user.uid
    && durableContext.hasWorkspaceData
  );

  return {
    builderUser: accountContextReady && !isSwitchPending ? user : null,
    isSwitchPending,
    previousAccount,
  };
}

export function useAccountSwitchGate({ user, authReady, connectedAccount }) {
  const preSignInConnectedAccountRef = useRef(readConnectedAccount());
  const clearingRef = useRef(false);
  const [isClearing, setIsClearing] = useState(false);
  const [resolvedAccountUid, setResolvedAccountUid] = useState('');
  const [durableContext, setDurableContext] = useState(() => ({
    checkedForUid: '',
    previousAccount: preSignInConnectedAccountRef.current,
    hasWorkspaceData: false,
  }));

  useEffect(() => {
    if (!user) {
      preSignInConnectedAccountRef.current = connectedAccount;
      setResolvedAccountUid('');
    }
  }, [connectedAccount, user]);

  useEffect(() => {
    let cancelled = false;

    if (!authReady) {
      return undefined;
    }

    readDurableLocalBrowserContext()
      .then((context) => {
        if (cancelled) {
          return;
        }

        const previousAccount = context.accountBinding
          || preSignInConnectedAccountRef.current
          || connectedAccount;

        if (!user && previousAccount) {
          preSignInConnectedAccountRef.current = previousAccount;
        }

        setDurableContext({
          checkedForUid: user?.uid || '',
          previousAccount,
          hasWorkspaceData: context.hasWorkspaceData,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const previousAccount = preSignInConnectedAccountRef.current || connectedAccount;

        setDurableContext({
          checkedForUid: user?.uid || '',
          previousAccount,
          hasWorkspaceData: Boolean(
            user
            && previousAccount?.uid
            && previousAccount.uid !== user.uid
          ),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, connectedAccount, user]);

  const gate = deriveAccountSwitchGate({ user, durableContext, resolvedAccountUid });

  function importLocalData() {
    if (!user) {
      return false;
    }

    const nextAccount = createAccountSnapshot(user);
    preSignInConnectedAccountRef.current = nextAccount;
    setDurableContext((current) => ({
      ...current,
      checkedForUid: user.uid,
      previousAccount: nextAccount,
    }));
    setResolvedAccountUid(user.uid);
    return true;
  }

  async function clearLocalData() {
    if (!user || clearingRef.current) {
      return false;
    }

    clearingRef.current = true;
    setIsClearing(true);

    try {
      await clearLocalResumeWorkspaceData();
      const nextAccount = createAccountSnapshot(user);
      preSignInConnectedAccountRef.current = nextAccount;
      setDurableContext({
        checkedForUid: user.uid,
        previousAccount: nextAccount,
        hasWorkspaceData: false,
      });
      setResolvedAccountUid(user.uid);
      window.location.reload();
      return true;
    } catch {
      return false;
    } finally {
      clearingRef.current = false;
      setIsClearing(false);
    }
  }

  return {
    ...gate,
    clearLocalData,
    importLocalData,
    isClearing,
  };
}
