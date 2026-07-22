import { useRef, useState } from 'react';

import {
  sanitizeWorkspaceFolderName,
  sanitizeWorkspaceResumeName,
} from '../lib/workspace.js';

export function useWorkspaceRailRename({
  onRenameResume,
  onRenameResumeFolder,
}) {
  const skipRenameCommitRef = useRef(false);
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  function startRename(type, item) {
    skipRenameCommitRef.current = false;
    setRenamingItem({ type, id: item.id });
    setRenameValue(type === 'folder'
      ? sanitizeWorkspaceFolderName(item.name)
      : sanitizeWorkspaceResumeName(item.name));
  }

  function cancelRename() {
    skipRenameCommitRef.current = true;
    setRenamingItem(null);
    setRenameValue('');
  }

  function commitRename() {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false;
      return;
    }

    if (!renamingItem) {
      return;
    }

    if (renamingItem.type === 'folder') {
      onRenameResumeFolder(renamingItem.id, renameValue);
    } else {
      onRenameResume(renamingItem.id, renameValue);
    }
    cancelRename();
  }

  return {
    cancelRename,
    commitRename,
    renameValue,
    renamingItem,
    setRenameValue,
    startRename,
  };
}
