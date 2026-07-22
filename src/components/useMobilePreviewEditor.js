import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  getPreviewCaretOffsetFromPoint,
  getPreviewEditorInputMode,
  isPreviewEditorTargetMultiline,
  mapDisplayedCaretOffsetToSource,
  parseEditorTargetPath,
  readResumeEditorTargetValue,
} from '../lib/editorTargets.js';
import {
  getMobileEditorProxyStyle,
  mobileProxyStylesMatch,
} from './resumePreviewGeometry.js';

export function useMobilePreviewEditor({
  activeEditorCaret,
  isPrintRendering,
  onEditTarget,
  onPreviewCaretChange,
  onPreviewEditorHandoff,
  onPreviewValueChange,
  onPreviewValueCommit,
  pageScale,
  resume,
  resumeId,
  resumeRootRef,
}) {
  const inputRef = useRef(null);
  const sessionRef = useRef(null);
  const caretFrameRef = useRef(0);
  const blurTimerRef = useRef(0);
  const valueChangeRef = useRef(onPreviewValueChange);
  const valueCommitRef = useRef(onPreviewValueCommit);
  const caretChangeRef = useRef(onPreviewCaretChange);
  const [session, setSession] = useState(null);

  useEffect(() => {
    valueChangeRef.current = onPreviewValueChange;
    valueCommitRef.current = onPreviewValueCommit;
    caretChangeRef.current = onPreviewCaretChange;
  }, [onPreviewCaretChange, onPreviewValueChange, onPreviewValueCommit]);

  const findPreviewValueElement = useCallback((path) => {
    if (!path || !resumeRootRef.current) {
      return null;
    }

    return Array.from(resumeRootRef.current.querySelectorAll('[data-preview-caret-text="true"]'))
      .find((element) => element.dataset.previewCaretPath === path) || null;
  }, [resumeRootRef]);

  const updateProxyPosition = useCallback(() => {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      return false;
    }

    const valueElement = findPreviewValueElement(currentSession.target.path);
    const proxyStyle = getMobileEditorProxyStyle(valueElement, resumeRootRef.current);

    if (!valueElement || !proxyStyle) {
      return false;
    }

    if (!mobileProxyStylesMatch(currentSession.proxyStyle, proxyStyle)) {
      const nextSession = { ...currentSession, proxyStyle };
      sessionRef.current = nextSession;
      setSession(nextSession);
    }

    return true;
  }, [findPreviewValueElement, resumeRootRef]);

  const scheduleCaretSync = useCallback((inputElement = inputRef.current) => {
    window.cancelAnimationFrame(caretFrameRef.current);
    caretFrameRef.current = window.requestAnimationFrame(() => {
      caretFrameRef.current = 0;
      const currentSession = sessionRef.current;

      if (!currentSession || !inputElement || document.activeElement !== inputElement) {
        return;
      }

      caretChangeRef.current?.({
        path: currentSession.target.path,
        offset: Number.isFinite(inputElement.selectionStart)
          ? inputElement.selectionStart
          : currentSession.value.length,
        value: currentSession.value,
      });
    });
  }, []);

  const closeSession = useCallback(({ commit = true } = {}) => {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      return;
    }

    window.clearTimeout(blurTimerRef.current);
    window.cancelAnimationFrame(caretFrameRef.current);
    blurTimerRef.current = 0;
    caretFrameRef.current = 0;

    if (commit) {
      valueCommitRef.current?.(currentSession.target);
    }

    sessionRef.current = null;
    setSession(null);
    caretChangeRef.current?.(null);

    if (document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  }, []);

  const openSession = useCallback((
    target,
    valueElement,
    sourceResume = resume,
    sourceOffsetOverride = null,
    { synchronous = true } = {},
  ) => {
    const sourceValue = readResumeEditorTargetValue(sourceResume, target);

    if (sourceValue === null) {
      return false;
    }

    const sourceOffset = Number.isFinite(sourceOffsetOverride)
      ? Math.max(0, Math.min(sourceOffsetOverride, sourceValue.length))
      : mapDisplayedCaretOffsetToSource({
        displayText: target.displayText,
        sourceValue,
        displayOffset: target.displayOffset,
        isPlaceholder: sourceValue.trim() === '',
      });
    const nextSession = {
      target,
      resumeId,
      value: sourceValue,
      selectionOffset: sourceOffset,
      isMultiline: isPreviewEditorTargetMultiline(target),
      inputMode: getPreviewEditorInputMode(target),
      proxyStyle: getMobileEditorProxyStyle(valueElement, resumeRootRef.current),
    };

    const commitSession = () => {
      sessionRef.current = nextSession;
      setSession(nextSession);
    };

    if (synchronous) {
      flushSync(commitSession);
    } else {
      commitSession();
    }
    return true;
  }, [resume, resumeId, resumeRootRef]);

  useLayoutEffect(() => {
    if (!session?.target.path) {
      return;
    }

    const inputElement = inputRef.current;

    if (!inputElement) {
      return;
    }

    const sourceOffset = Number.isFinite(session.selectionOffset)
      ? session.selectionOffset
      : 0;

    inputElement.focus({ preventScroll: true });

    try {
      inputElement.setSelectionRange(sourceOffset, sourceOffset);
    } catch {
      // The textarea supports selection ranges; retain the start fallback if a browser refuses it.
    }

    scheduleCaretSync(inputElement);
  }, [session?.resumeId, session?.selectionOffset, session?.target.path, scheduleCaretSync]);

  function handleChange(event) {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      return;
    }

    const rawValue = event.target.value;
    const nextValue = currentSession.isMultiline
      ? rawValue
      : rawValue.replace(/[\r\n]+/g, '');
    const nextSession = { ...currentSession, value: nextValue };

    sessionRef.current = nextSession;
    setSession(nextSession);
    valueChangeRef.current?.(currentSession.target, nextValue);
    scheduleCaretSync(event.currentTarget);
  }

  function handleBlur() {
    const blurredSession = sessionRef.current;

    window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => {
      if (
        blurredSession
        && sessionRef.current === blurredSession
        && document.activeElement !== inputRef.current
      ) {
        closeSession();
      }
    }, 0);
  }

  function handleProxyTap(event) {
    const currentSession = sessionRef.current;
    const inputElement = event.currentTarget;

    if (!currentSession || !inputElement) {
      return;
    }

    const previousPointerEvents = inputElement.style.pointerEvents;
    inputElement.style.pointerEvents = 'none';
    const underlyingElement = document.elementFromPoint(event.clientX, event.clientY);
    const clickedValueElement = underlyingElement?.closest?.('[data-preview-caret-text="true"]');
    const valueElement = clickedValueElement?.dataset.previewCaretPath === currentSession.target.path
      ? clickedValueElement
      : findPreviewValueElement(currentSession.target.path);
    const displayText = valueElement?.dataset.previewCaretDisplay
      ?? valueElement?.textContent
      ?? currentSession.value;
    const displayOffset = valueElement
      ? getPreviewCaretOffsetFromPoint(valueElement, event.clientX, event.clientY)
      : null;
    inputElement.style.pointerEvents = previousPointerEvents;

    const sourceOffset = mapDisplayedCaretOffsetToSource({
      displayText,
      sourceValue: currentSession.value,
      displayOffset: Number.isFinite(displayOffset) ? displayOffset : currentSession.value.length,
      isPlaceholder: currentSession.value.trim() === '',
    });

    inputElement.focus({ preventScroll: true });
    inputElement.setSelectionRange(sourceOffset, sourceOffset);
    scheduleCaretSync(inputElement);
  }

  useEffect(() => {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      return;
    }

    if (isPrintRendering || currentSession.resumeId !== resumeId) {
      closeSession();
    }
  }, [closeSession, isPrintRendering, resumeId]);

  useLayoutEffect(() => {
    if (!session?.target.path || typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    let missingTargetReads = 0;
    const viewport = window.visualViewport;
    const mediaQuery = window.matchMedia('(max-width: 980px)');

    function readPosition() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (!mediaQuery.matches) {
          const currentSession = sessionRef.current;
          const inputElement = inputRef.current;

          if (currentSession) {
            const sourceOffset = Number.isFinite(inputElement?.selectionStart)
              ? inputElement.selectionStart
              : currentSession.value.length;

            closeSession({ commit: false });
            onPreviewEditorHandoff?.({
              ...currentSession.target,
              sourceOffset,
            });
          }
          return;
        }

        if (updateProxyPosition()) {
          missingTargetReads = 0;
          return;
        }

        missingTargetReads += 1;

        if (missingTargetReads >= 2) {
          closeSession();
        }
      });
    }

    readPosition();
    window.addEventListener('resize', readPosition);
    window.addEventListener('scroll', readPosition, true);
    viewport?.addEventListener('resize', readPosition);
    viewport?.addEventListener('scroll', readPosition);
    mediaQuery.addEventListener?.('change', readPosition);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(readPosition);
    if (resizeObserver && resumeRootRef.current) {
      resizeObserver.observe(resumeRootRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', readPosition);
      window.removeEventListener('scroll', readPosition, true);
      viewport?.removeEventListener('resize', readPosition);
      viewport?.removeEventListener('scroll', readPosition);
      mediaQuery.removeEventListener?.('change', readPosition);
      resizeObserver?.disconnect();
    };
  }, [closeSession, onPreviewEditorHandoff, pageScale, resumeRootRef, session?.target.path, session?.value, updateProxyPosition]);

  useEffect(() => {
    if (typeof window === 'undefined' || !activeEditorCaret?.path) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 980px)');

    function handoffEditorToMobile() {
      if (!mediaQuery.matches || sessionRef.current || isPrintRendering) {
        return;
      }

      const parsedTarget = parseEditorTargetPath(activeEditorCaret.path);
      const valueElement = findPreviewValueElement(activeEditorCaret.path);

      if (!parsedTarget || !valueElement) {
        return;
      }

      const displayText = valueElement.dataset.previewCaretDisplay
        ?? valueElement.textContent
        ?? '';
      const target = {
        ...parsedTarget,
        displayText,
        displayOffset: Number.isFinite(activeEditorCaret.offset) ? activeEditorCaret.offset : 0,
        stayInPreview: true,
        preserveTransient: true,
      };
      const targetResume = onEditTarget?.(target);

      if (targetResume) {
        openSession(
          target,
          valueElement,
          targetResume,
          activeEditorCaret.offset,
          { synchronous: false },
        );
      }
    }

    handoffEditorToMobile();
    window.addEventListener('resize', handoffEditorToMobile);
    mediaQuery.addEventListener?.('change', handoffEditorToMobile);

    return () => {
      window.removeEventListener('resize', handoffEditorToMobile);
      mediaQuery.removeEventListener?.('change', handoffEditorToMobile);
    };
  }, [activeEditorCaret, findPreviewValueElement, isPrintRendering, onEditTarget, openSession]);

  useEffect(() => {
    if (!session?.target.path || typeof document === 'undefined') {
      return undefined;
    }

    function handleOutsidePointerDown(event) {
      if (event.target.closest?.('[data-mobile-preview-editor="true"]')) {
        return;
      }

      const editTarget = event.target.closest?.('[data-edit-section-id][data-edit-path]');

      if (editTarget && resumeRootRef.current?.contains(editTarget)) {
        return;
      }

      closeSession();
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [closeSession, resumeRootRef, session?.target.path]);

  useEffect(() => () => {
    window.clearTimeout(blurTimerRef.current);
    window.cancelAnimationFrame(caretFrameRef.current);
  }, []);

  return {
    closeSession,
    handleBlur,
    handleChange,
    handleProxyTap,
    inputRef,
    openSession,
    scheduleCaretSync,
    session,
    sessionRef,
  };
}
