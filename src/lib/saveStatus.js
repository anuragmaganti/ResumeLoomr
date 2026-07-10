export function getSaveStatusPresentation({
  saveState = 'idle',
  syncState = 'idle',
  cloudMode = false,
} = {}) {
  if (saveState === 'saving') {
    return { id: 'saving-local', label: 'Saving locally' };
  }

  if (saveState === 'error') {
    return { id: 'local-error', label: 'Local save unavailable' };
  }

  if (saveState === 'conflict') {
    return { id: 'conflict', label: 'Save conflict' };
  }

  if (cloudMode) {
    if (syncState === 'syncing') {
      return { id: 'syncing', label: 'Syncing' };
    }

    if (syncState === 'offline') {
      return { id: 'queued', label: 'Queued' };
    }

    if (syncState === 'error') {
      return { id: 'sync-error', label: 'Sync unavailable' };
    }

    if (syncState === 'stale') {
      return { id: 'stale', label: 'Review sync' };
    }

    if (syncState === 'saved') {
      return { id: 'synced', label: 'Synced' };
    }
  }

  if (saveState === 'saved') {
    return { id: 'saved-local', label: 'Saved locally' };
  }

  return { id: 'ready', label: 'Autosave ready' };
}
