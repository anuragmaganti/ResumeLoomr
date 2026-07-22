import { useCallback, useEffect, useRef, useState } from 'react';

export function useSeparatorSettingsController({ activeResumeId, onSettingChange }) {
  const pointerExitTimerRef = useRef(null);
  const [anchorState, setAnchorState] = useState({ resumeId: activeResumeId, value: null });
  const anchor = anchorState.resumeId === activeResumeId ? anchorState.value : null;

  const cancelPointerExit = useCallback(() => {
    if (pointerExitTimerRef.current) {
      window.clearTimeout(pointerExitTimerRef.current);
      pointerExitTimerRef.current = null;
    }
  }, []);

  const close = useCallback(({ restoreFocus = true } = {}) => {
    const triggerElement = anchor?.triggerElement;

    cancelPointerExit();
    setAnchorState({ resumeId: activeResumeId, value: null });

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerElement?.focus?.();
      });
    }
  }, [activeResumeId, anchor, cancelPointerExit]);

  const open = useCallback((nextAnchor) => {
    cancelPointerExit();
    setAnchorState({ resumeId: activeResumeId, value: nextAnchor });
  }, [activeResumeId, cancelPointerExit]);

  const schedulePointerExit = useCallback(() => {
    cancelPointerExit();
    pointerExitTimerRef.current = window.setTimeout(() => {
      pointerExitTimerRef.current = null;

      if (document.querySelector('.resumePage:hover, .separatorSettingsPopup:hover')) {
        return;
      }

      close({ restoreFocus: false });
    }, 120);
  }, [cancelPointerExit, close]);

  useEffect(() => {
    if (!anchor) {
      return undefined;
    }

    function handleInteractiveRegionMouseMove(event) {
      const target = event.target;
      const isInsideInteractiveRegion = target instanceof Element && (
        target.closest('.resumePage') || target.closest('.separatorSettingsPopup')
      );

      if (isInsideInteractiveRegion) {
        cancelPointerExit();
        return;
      }

      schedulePointerExit();
    }

    document.addEventListener('mousemove', handleInteractiveRegionMouseMove, { passive: true });
    document.addEventListener('mouseleave', schedulePointerExit);

    return () => {
      document.removeEventListener('mousemove', handleInteractiveRegionMouseMove);
      document.removeEventListener('mouseleave', schedulePointerExit);
    };
  }, [anchor, cancelPointerExit, schedulePointerExit]);

  useEffect(() => () => cancelPointerExit(), [activeResumeId, cancelPointerExit]);

  const handleSettingChange = useCallback((settingId, value) => {
    onSettingChange(settingId, value);
  }, [onSettingChange]);

  return {
    anchor,
    close,
    handleSettingChange,
    open,
  };
}
