import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import { requestResumeTailoring } from '../lib/resumeTailoringClient.js';
import {
  createResumeTailoringCatalog,
  createResumeTailoringReview,
  updateAllTailoringDecisions,
  updateTailoringDecision,
} from '../lib/resumeTailoring.js';

const INITIAL_STATE = {
  activeChange: null, error: '', isDialogOpen: false, isGenerating: false, review: null,
};

export function useResumeTailoringController({
  actions,
  activeDocumentType,
  activeResumeId,
  authUser,
  openAuthModal,
  resume,
  showNotice,
}) {
  const catalog = useMemo(() => createResumeTailoringCatalog(resume), [resume]);
  const latestRef = useRef({ activeDocumentType, activeResumeId, authUser, catalog });
  const identityRef = useRef(`${authUser?.uid || ''}:${activeResumeId}:${activeDocumentType}`);
  const requestRef = useRef(null);
  const [state, setState] = useState(INITIAL_STATE);
  const { activeChange, error, isDialogOpen, isGenerating, review } = state;

  const updateState = (patch) => setState((current) => ({ ...current, ...patch }));

  useEffect(() => {
    latestRef.current = { activeDocumentType, activeResumeId, authUser, catalog };
  }, [activeDocumentType, activeResumeId, authUser, catalog]);

  useEffect(() => {
    const identity = `${authUser?.uid || ''}:${activeResumeId}:${activeDocumentType}`;
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setState(INITIAL_STATE);
  }, [activeDocumentType, activeResumeId, authUser?.uid]);

  useEffect(() => () => requestRef.current?.controller.abort(), []);

  const activeReview = review?.fingerprint === catalog.fingerprint ? review : null;

  function openDialog() {
    if (activeDocumentType !== 'resume') return;
    if (!authUser) {
      openAuthModal?.();
      return;
    }
    if (catalog.targets.length === 0) {
      showNotice({ tone: 'warning', message: 'Add resume content before tailoring it to a job.' });
      return;
    }
    updateState({ activeChange: null, error: '', isDialogOpen: true, review: null });
  }

  function closeDialog() {
    if (isGenerating) return;
    updateState({ error: '', isDialogOpen: false });
  }

  async function generateSuggestions({ source, instructions }) {
    if (isGenerating) return;
    const requestUser = authUser;
    const requestResumeId = activeResumeId;
    const requestCatalog = catalog;
    if (!requestUser) {
      updateState({ isDialogOpen: false });
      openAuthModal?.();
      return;
    }

    updateState({ error: '', isGenerating: true });
    const controller = new AbortController();
    const requestIdentity = Symbol('resume-tailoring-request');
    requestRef.current = { controller, id: requestIdentity };
    try {
      const idToken = await requestUser.getIdToken();
      const payload = await requestResumeTailoring({
        catalogRequest: requestCatalog.request,
        source,
        instructions,
        idToken,
        signal: controller.signal,
      });
      const latest = latestRef.current;
      if (
        latest.authUser?.uid !== requestUser.uid
        || latest.activeResumeId !== requestResumeId
        || latest.activeDocumentType !== 'resume'
        || latest.catalog.fingerprint !== requestCatalog.fingerprint
      ) {
        throw new Error('The account or resume changed before tailoring finished. No suggestions were applied.');
      }

      const nextReview = createResumeTailoringReview(requestCatalog, payload);
      if (nextReview.changes.length === 0) {
        updateState({ isDialogOpen: false });
        showNotice({ tone: 'success', message: 'This resume already matches the listing well. No safe edits were suggested.' });
        return;
      }

      updateState({
        isDialogOpen: false,
        review: { ...nextReview, fingerprint: requestCatalog.fingerprint },
      });
      showNotice({ tone: 'success', message: `${nextReview.changes.length} tailoring suggestions are ready to review.` });
    } catch (requestError) {
      if (controller.signal.aborted) return;
      updateState({ error: requestError?.message || 'The resume could not be tailored. Try again.' });
    } finally {
      if (requestRef.current?.id === requestIdentity) {
        requestRef.current = null;
        updateState({ isGenerating: false });
      }
    }
  }

  function updateReview(updater) {
    startTransition(() => setState((current) => ({ ...current, review: updater(current.review) })));
  }

  function setDecision(changeId, decision) {
    updateReview((current) => updateTailoringDecision(current, changeId, decision));
  }

  function setAllDecisions(decision) {
    updateReview((current) => updateAllTailoringDecisions(current, decision));
  }

  function openChange(changeId, anchorRect) { updateState({ activeChange: { changeId, anchorRect } }); }

  function closeChange() { updateState({ activeChange: null }); }

  function cancelReview() { updateState({ activeChange: null, review: null }); }

  function applyReview() {
    const approvedCount = activeReview?.changes.filter((change) => change.decision === 'approved').length || 0;
    if (!activeReview || approvedCount === 0) {
      cancelReview();
      return;
    }
    updateState({ activeChange: null, review: null });
    actions.applyTailoringReview(activeReview);
    showNotice({
      tone: 'success',
      message: `${approvedCount} approved ${approvedCount === 1 ? 'change' : 'changes'} saved to this resume.`,
    });
  }

  return {
    activeChange,
    applyReview,
    cancelReview,
    canTailor: activeDocumentType === 'resume' && catalog.targets.length > 0,
    closeChange,
    closeDialog,
    error,
    generateSuggestions,
    isDialogOpen,
    isGenerating,
    openChange,
    openDialog,
    review: activeReview,
    setAllDecisions,
    setDecision,
  };
}
