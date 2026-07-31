import { useEffect } from 'react';

import { trapTabKey } from '../lib/focusTrap.js';

export function useDialogKeyboard({
  busy = false,
  dialogRef,
  initialFocus = 'button',
  isOpen = true,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const frameId = window.requestAnimationFrame(() => (
      dialogRef.current?.querySelector(initialFocus)?.focus()
    ));

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      trapTabKey(event, dialogRef.current);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, dialogRef, initialFocus, isOpen, onClose]);
}
