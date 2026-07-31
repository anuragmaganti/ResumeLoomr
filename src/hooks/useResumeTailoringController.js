import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import { requestResumeTailoring } from '../lib/resumeTailoringClient.js';
import {
  createResumeTailoringCatalog,
  createResumeTailoringReview,
  updateAllTailoringDecisions,
  updateTailoringDecision,
} from '../lib/resumeTailoring.js';

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const [activeChange, setActiveChange] = useState(null);

  useEffect(() => {
    latestRef.current = { activeDocumentType, activeResumeId, authUser, catalog };
  }, [activeDocumentType, activeResumeId, authUser, catalog]);

  useEffect(() => {
    const identity = `${authUser?.uid || ''}:${activeResumeId}:${activeDocumentType}`;
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setIsDialogOpen(false);
    setIsGenerating(false);
    setError('');
    setReview(null);
    setActiveChange(null);
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
    setError('');
    setReview(null);
    setActiveChange(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    if (isGenerating) return;
    setError('');
    setIsDialogOpen(false);
  }

  async function generateSuggestions({ source, instructions }) {
    if (isGenerating) return;
    const requestUser = authUser;
    const requestResumeId = activeResumeId;
    const requestCatalog = catalog;
    if (!requestUser) {
      setIsDialogOpen(false);
      openAuthModal?.();
      return;
    }

    setError('');
    setIsGenerating(true);
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
        setIsDialogOpen(false);
        showNotice({ tone: 'success', message: 'This resume already matches the listing well. No safe edits were suggested.' });
        return;
      }

      setReview({ ...nextReview, fingerprint: requestCatalog.fingerprint });
      setIsDialogOpen(false);
      showNotice({ tone: 'success', message: `${nextReview.changes.length} tailoring suggestions are ready to review.` });
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setError(requestError?.message || 'The resume could not be tailored. Try again.');
    } finally {
      if (requestRef.current?.id === requestIdentity) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }

  function setDecision(changeId, decision) {
    startTransition(() => {
      setReview((current) => updateTailoringDecision(current, changeId, decision));
      setActiveChange((current) => (current?.changeId === changeId ? { ...current } : current));
    });
  }

  function setAllDecisions(decision) {
    startTransition(() => setReview((current) => updateAllTailoringDecisions(current, decision)));
  }

  function openChange(changeId, anchorRect) {
    setActiveChange({ changeId, anchorRect });
  }

  function closeChange() {
    setActiveChange(null);
  }

  function cancelReview() {
    setReview(null);
    setActiveChange(null);
  }

  function applyReview() {
    const approvedCount = activeReview?.changes.filter((change) => change.decision === 'approved').length || 0;
    if (!activeReview || approvedCount === 0) {
      cancelReview();
      return;
    }
    setReview(null);
    setActiveChange(null);
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
