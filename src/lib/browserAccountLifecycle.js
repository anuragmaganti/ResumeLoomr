export async function runBrowserSignOut({
  user,
  allowSignedOutEditing,
  flushActiveCloudDraft,
  requestBackgroundSync,
  setSessionCleanupRequested,
  clearSyncSession,
  signOut,
  clearLocalWorkspace,
  reloadBrowser,
}) {
  const accountUid = user?.uid || '';
  const cloudSyncCompleted = await flushActiveCloudDraft({ reason: 'signout' });

  if (!allowSignedOutEditing && user && !cloudSyncCompleted) {
    return { status: 'cloud-sync-incomplete' };
  }

  if (allowSignedOutEditing && accountUid && !cloudSyncCompleted) {
    const sessionCleanupArmed = await setSessionCleanupRequested(accountUid, true);

    if (!sessionCleanupArmed) {
      return { status: 'session-cleanup-arm-failed' };
    }

    await requestBackgroundSync();
  }

  if (cloudSyncCompleted && !await clearSyncSession()) {
    return { status: 'session-clear-failed' };
  }

  if (!await signOut()) {
    if (accountUid && !cloudSyncCompleted) {
      await setSessionCleanupRequested(accountUid, false);
    }

    return { status: 'auth-signout-failed' };
  }

  if (!allowSignedOutEditing) {
    await clearLocalWorkspace();
    reloadBrowser();
  }

  return {
    status: 'signed-out',
    cloudSyncCompleted,
  };
}

export async function runBrowserDisconnect({
  user,
  flushActiveCloudDraft,
  disconnectAuthSession,
  clearBrowserData,
  reloadBrowser,
}) {
  if (user && !await flushActiveCloudDraft({ reason: 'disconnect-browser' })) {
    return { status: 'cloud-sync-incomplete' };
  }

  if (!await disconnectAuthSession()) {
    return { status: 'browser-disconnect-failed' };
  }

  try {
    await clearBrowserData();
  } catch {
    return { status: 'browser-data-clear-failed' };
  }

  reloadBrowser();
  return { status: 'disconnected' };
}
