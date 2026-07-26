import { startTransition, useCallback, useRef, useState } from 'react';
import {
  applyCoverLetterTargetValue,
  readCoverLetterTargetValue,
} from '../lib/coverLetterEditorTargets.js';

export function useCoverLetterPreviewEditorController({
  actions,
  coverLetter,
  resolvedSender,
  setActiveGroup,
  setMobileView,
}) {
  const requestIdRef = useRef(0);
  const pulseIdRef = useRef(0);
  const [previewEditTarget, setPreviewEditTarget] = useState(null);
  const [editorCaretTarget, setEditorCaretTarget] = useState(null);
  const [previewPulseTarget, setPreviewPulseTarget] = useState(null);

  const handlePreviewEditTarget = useCallback((target) => {
    if (!target?.path || readCoverLetterTargetValue(coverLetter, resolvedSender, target) === null) {
      return null;
    }
    if (target.stayInPreview) {
      setPreviewEditTarget(null);
      setActiveGroup(target.group || 'letter');
      setMobileView('preview');
      return coverLetter;
    }
    requestIdRef.current += 1;
    setPreviewEditTarget({ ...target, requestId: requestIdRef.current });
    setActiveGroup(target.group || 'letter');
    setMobileView('editor');
    return coverLetter;
  }, [coverLetter, resolvedSender, setActiveGroup, setMobileView]);

  const handlePreviewEditorHandoff = useCallback((target) => {
    if (!target?.path) return;
    requestIdRef.current += 1;
    setPreviewEditTarget({ ...target, stayInPreview: false, requestId: requestIdRef.current });
    setActiveGroup(target.group || 'letter');
    setMobileView('editor');
  }, [setActiveGroup, setMobileView]);

  const handlePreviewValueChange = useCallback((target, value) => {
    applyCoverLetterTargetValue(actions, target, value);
  }, [actions]);

  const updateEditorCaretTarget = useCallback((target) => {
    startTransition(() => {
      setEditorCaretTarget(target?.path ? {
        path: target.path,
        offset: Number.isFinite(target.offset) ? Math.max(0, target.offset) : 0,
        value: typeof target.value === 'string' ? target.value : undefined,
      } : null);
    });
  }, []);

  const pulsePreviewTarget = useCallback((target) => {
    if (!target?.path) return;
    pulseIdRef.current += 1;
    setPreviewPulseTarget({ path: target.path, requestId: pulseIdRef.current });
  }, []);

  const clearPreviewEditTarget = useCallback(() => setPreviewEditTarget(null), []);

  return {
    clearPreviewEditTarget,
    editorCaretTarget,
    handlePreviewEditTarget,
    handlePreviewEditorHandoff,
    handlePreviewValueChange,
    previewEditTarget,
    previewPulseTarget,
    pulsePreviewTarget,
    updateEditorCaretTarget,
  };
}
