function formatSavedAt(savedAt) {
  if (!savedAt) {
    return 'Autosave ready';
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return 'Autosave ready';
  }

  return `Saved ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatSaveLabel({ saveState, savedAt, cloudMode = false, syncState = 'idle', trustedDevice = false }) {
  if (saveState === 'saving') {
    return 'Saving locally…';
  }

  if (saveState === 'error') {
    return 'Autosave unavailable';
  }

  if (!cloudMode) {
    return formatSavedAt(savedAt);
  }

  if (syncState === 'syncing') {
    return 'Saved locally · Syncing…';
  }

  if (syncState === 'offline') {
    return trustedDevice ? 'Saved offline' : 'Saved in this tab';
  }

  if (syncState === 'error') {
    return 'Saved locally · Cloud unavailable';
  }

  if (syncState === 'saved') {
    return 'Synced';
  }

  return formatSavedAt(savedAt);
}

export function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}
