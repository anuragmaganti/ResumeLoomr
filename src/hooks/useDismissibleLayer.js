import { useEffect } from 'react';

export function useDismissibleLayer({
  closeOnResize = false,
  enabled = true,
  eventTarget = 'document',
  layerRef,
  onDismiss,
  preventEscapeDefault = false,
}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const target = eventTarget === 'window' ? window : document;

    function handlePointerDown(event) {
      if (!layerRef.current?.contains(event.target)) onDismiss();
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (preventEscapeDefault) event.preventDefault();
      onDismiss();
    }

    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('keydown', handleKeyDown);
    if (closeOnResize) window.addEventListener('resize', onDismiss);
    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('keydown', handleKeyDown);
      if (closeOnResize) window.removeEventListener('resize', onDismiss);
    };
  }, [closeOnResize, enabled, eventTarget, layerRef, onDismiss, preventEscapeDefault]);
}
