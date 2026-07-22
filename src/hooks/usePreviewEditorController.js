import { startTransition, useCallback, useRef, useState } from 'react';

import {
  getPreviewEditorMutation,
  readResumeEditorTargetValue,
} from '../lib/editorTargets.js';
import { getPersistableSampleTextListMove } from '../lib/sampleResumes.js';

function getPreviewEntryOrder(previewModel, sectionId) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entries = Array.isArray(block?.entries) ? block.entries : [];

  return entries.map((entry) => entry.id).filter(Boolean);
}

function getPreviewEntry(previewModel, sectionId, entryId) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);

  return block?.entries?.find((entry) => entry.id === entryId) || null;
}

function getPreviewEntrySampleBindings(previewModel, sectionId) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entries = Array.isArray(block?.entries) ? block.entries : [];

  return Object.fromEntries(
    entries
      .map((entry) => [
        entry.id,
        Number.isInteger(entry.sampleSourceIndex) ? entry.sampleSourceIndex : null,
      ])
      .filter(([entryId, sourceIndex]) => entryId && Number.isInteger(sourceIndex)),
  );
}

function getPreviewSectionOrder(previewModel) {
  if (Array.isArray(previewModel?.sectionOrder) && previewModel.sectionOrder.length > 0) {
    return previewModel.sectionOrder.filter(Boolean);
  }

  return Array.isArray(previewModel?.sectionBlocks)
    ? previewModel.sectionBlocks.map((section) => section.id).filter(Boolean)
    : [];
}

function getPreviewTextListOrder(previewModel, sectionId, entryId, field) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entry = block?.entries?.find((sectionEntry) => sectionEntry.id === entryId);
  const items = Array.isArray(entry?.[field]) ? entry[field] : [];

  return items.map((item, index) => (
    Number.isFinite(item?.sourceIndex) ? item.sourceIndex : index
  ));
}

function moveSourceIndexWithinOrder(order, fromIndex, toIndex) {
  const fromPosition = order.indexOf(fromIndex);
  const toPosition = order.indexOf(toIndex);

  if (fromPosition < 0 || toPosition < 0 || fromPosition === toPosition) {
    return order;
  }

  const nextOrder = [...order];
  const [item] = nextOrder.splice(fromPosition, 1);
  nextOrder.splice(toPosition, 0, item);
  return nextOrder;
}

export function usePreviewEditorController({
  actions,
  activeResumeId,
  displayPreviewModel,
  isSamplePreview,
  markTouched,
  reorderSections,
  resume,
  setActiveTab,
  setMobileView,
}) {
  const previewEditRequestIdRef = useRef(0);
  const responsiveProxyHandoffEntryRef = useRef(null);
  const previewPulseRequestIdRef = useRef(0);
  const [previewEditTarget, setPreviewEditTarget] = useState(null);
  const [previewPulseTarget, setPreviewPulseTarget] = useState(null);
  const [editorCaretTarget, setEditorCaretTarget] = useState(null);

  const handlePreviewEditTarget = useCallback((target) => {
    if (!target?.sectionId || !target?.path) {
      return null;
    }

    let targetResume = resume;

    if (target.preserveTransient) {
      responsiveProxyHandoffEntryRef.current = target.entryId
        ? { sectionId: target.sectionId, entryId: target.entryId }
        : null;
    } else if (isSamplePreview && target.entryId) {
      const previewEntry = getPreviewEntry(displayPreviewModel, target.sectionId, target.entryId);

      if (!previewEntry) {
        return null;
      }

      targetResume = actions.prepareTransientSampleEntry(
        target.sectionId,
        previewEntry,
        getPreviewEntryOrder(displayPreviewModel, target.sectionId),
      );
    } else {
      actions.endTransientSampleEntry();
    }

    if (!targetResume || readResumeEditorTargetValue(targetResume, target) === null) {
      return null;
    }

    if (target.stayInPreview) {
      setPreviewEditTarget(null);
      setActiveTab(target.sectionId);
      setMobileView('preview');
      return targetResume;
    }

    previewEditRequestIdRef.current += 1;
    setPreviewEditTarget({
      ...target,
      requestId: previewEditRequestIdRef.current,
    });
    setActiveTab(target.sectionId);
    setMobileView('editor');
    return targetResume;
  }, [actions, displayPreviewModel, isSamplePreview, resume, setActiveTab, setMobileView]);

  const handlePreviewEditorHandoff = useCallback((target) => {
    if (!target?.sectionId || !target?.path) {
      return;
    }

    previewEditRequestIdRef.current += 1;
    setPreviewEditTarget({
      ...target,
      stayInPreview: false,
      requestId: previewEditRequestIdRef.current,
    });
    setActiveTab(target.sectionId);
    setMobileView('editor');
  }, [setActiveTab, setMobileView]);

  const handlePreviewValueChange = useCallback((target, value) => {
    const mutation = getPreviewEditorMutation(target, value);

    if (!mutation) {
      return;
    }

    switch (mutation.type) {
      case 'personal':
        actions.updatePersonalField(...mutation.args);
        break;
      case 'sectionTitle':
        actions.updateSectionTitle(...mutation.args);
        break;
      case 'textList':
        actions.updateSectionBlockTextList(...mutation.args);
        break;
      case 'educationProgram':
        actions.updateSectionBlockEducationProgram(...mutation.args);
        break;
      case 'educationCustomSection':
        actions.updateSectionBlockEducationCustomSection(...mutation.args);
        break;
      case 'entry':
        actions.updateSectionBlockEntry(...mutation.args);
        break;
      default:
        break;
    }
  }, [actions]);

  const handlePreviewValueCommit = useCallback((target) => {
    if (!target?.path) {
      return;
    }

    markTouched(target.path);

    if (target.field === '__title' && target.sectionId !== 'personal') {
      actions.commitSectionTitle(target.sectionId);
    }

    if (target.entryId) {
      actions.endTransientSampleEntry({
        sectionId: target.sectionId,
        entryId: target.entryId,
      });
    }
  }, [actions, markTouched]);

  const handlePreviewPulseTarget = useCallback((target) => {
    if (!target?.path) {
      return;
    }

    previewPulseRequestIdRef.current += 1;
    setPreviewPulseTarget({
      path: target.path,
      requestId: previewPulseRequestIdRef.current,
    });
  }, []);

  const updateEditorCaretTarget = useCallback((target) => {
    if (!target?.path) {
      startTransition(() => {
        setEditorCaretTarget(null);
      });
      return;
    }

    const offset = Number.isFinite(target.offset) ? Math.max(0, target.offset) : 0;
    const value = typeof target.value === 'string' ? target.value : undefined;

    startTransition(() => {
      setEditorCaretTarget((currentTarget) => (
        currentTarget?.path === target.path
        && currentTarget?.offset === offset
        && currentTarget?.value === value
          ? currentTarget
          : { path: target.path, offset, value }
      ));
    });
  }, []);

  const handlePreviewReorderSectionTextList = useCallback((sectionId, entryId, field, fromIndex, toIndex) => {
    if (!isSamplePreview) {
      actions.reorderSectionTextList(sectionId, entryId, field, fromIndex, toIndex);
      return;
    }

    const orderKey = `${sectionId}.${entryId}.${field}`;
    const persistableMove = getPersistableSampleTextListMove(resume, sectionId, entryId, field, fromIndex, toIndex);

    if (persistableMove) {
      actions.reorderSectionTextList(sectionId, entryId, field, persistableMove.fromIndex, persistableMove.toIndex);
      actions.setSampleTextListOrder(orderKey, null);
      return;
    }

    const currentOrder = getPreviewTextListOrder(displayPreviewModel, sectionId, entryId, field);
    const nextOrder = moveSourceIndexWithinOrder(currentOrder, fromIndex, toIndex);

    if (nextOrder === currentOrder) {
      return;
    }

    actions.setSampleTextListOrder(orderKey, nextOrder);
  }, [actions, displayPreviewModel, isSamplePreview, resume]);

  const handlePreviewReorderSectionEntries = useCallback((sectionId, nextEntryIds) => {
    if (!isSamplePreview) {
      actions.reorderSectionEntries(sectionId, nextEntryIds);
      return;
    }

    const currentOrder = getPreviewEntryOrder(displayPreviewModel, sectionId);
    const nextOrder = Array.isArray(nextEntryIds) ? nextEntryIds.filter(Boolean) : [];

    if (
      !activeResumeId
      || currentOrder.length !== nextOrder.length
      || currentOrder.every((entryId, index) => entryId === nextOrder[index])
    ) {
      return;
    }

    const currentIdSet = new Set(currentOrder);
    if (!nextOrder.every((entryId) => currentIdSet.has(entryId))) {
      return;
    }

    actions.materializeAndReorderSectionEntries(
      sectionId,
      nextOrder,
      getPreviewEntrySampleBindings(displayPreviewModel, sectionId),
    );
  }, [actions, activeResumeId, displayPreviewModel, isSamplePreview]);

  const handlePreviewReorderSections = useCallback((nextSectionIds) => {
    if (!isSamplePreview) {
      reorderSections(nextSectionIds);
      return;
    }

    const currentOrder = getPreviewSectionOrder(displayPreviewModel);
    const nextOrder = Array.isArray(nextSectionIds) ? nextSectionIds.filter(Boolean) : [];

    if (
      currentOrder.length === 0
      || currentOrder.length !== nextOrder.length
      || currentOrder.every((sectionId, index) => sectionId === nextOrder[index])
    ) {
      return;
    }

    const currentIdSet = new Set(currentOrder);
    if (!nextOrder.every((sectionId) => currentIdSet.has(sectionId))) {
      return;
    }

    reorderSections(nextOrder);
  }, [displayPreviewModel, isSamplePreview, reorderSections]);

  const clearPreviewEditTarget = useCallback((requestId) => {
    setPreviewEditTarget((currentTarget) => {
      if (requestId && currentTarget?.requestId !== requestId) {
        return currentTarget;
      }

      return null;
    });
    actions.endTransientSampleEntry();
  }, [actions]);

  const handleEditorEntryFocus = useCallback((entryIdentity) => {
    actions.endTransientSampleEntryUnless(
      entryIdentity?.sectionId || '',
      entryIdentity?.entryId || '',
    );
  }, [actions]);

  const handleEditorEntryExit = useCallback((entryIdentity) => {
    if (!entryIdentity?.sectionId || !entryIdentity?.entryId) {
      return;
    }

    const handoffEntry = responsiveProxyHandoffEntryRef.current;

    if (
      handoffEntry?.sectionId === entryIdentity.sectionId
      && handoffEntry?.entryId === entryIdentity.entryId
    ) {
      responsiveProxyHandoffEntryRef.current = null;
      return;
    }

    actions.endTransientSampleEntry(entryIdentity);
  }, [actions]);

  return {
    clearPreviewEditTarget,
    editorCaretTarget,
    handleEditorEntryExit,
    handleEditorEntryFocus,
    handlePreviewEditTarget,
    handlePreviewEditorHandoff,
    handlePreviewPulseTarget,
    handlePreviewReorderSectionEntries,
    handlePreviewReorderSections,
    handlePreviewReorderSectionTextList,
    handlePreviewValueChange,
    handlePreviewValueCommit,
    previewEditTarget,
    previewPulseTarget,
    updateEditorCaretTarget,
  };
}
