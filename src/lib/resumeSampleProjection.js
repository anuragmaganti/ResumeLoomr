import { reorderItemSubsetById } from './arrayOrder.js';
import {
  createEducationCustomSection,
  createEducationProgram,
  createResumeEntry,
  ensureEducationCustomSections,
  sectionEntryHasContent,
} from './resumeEntries.js';
import { normalizeResume } from './resume.js';
import {
  applySectionSampleEntryBindings,
  inferSectionSampleEntryBindings,
  normalizeSampleEntryBindings,
} from './resumeSampleState.js';
import { normalizeStringList } from './resumeValues.js';
import { trimText } from './text.js';

export function materializeAndReorderSectionBlockEntries(
  resume,
  sectionId,
  orderedEntryIds,
  sampleEntryBindings = {},
) {
  const normalizedResume = normalizeResume(resume);
  const requestedIds = Array.isArray(orderedEntryIds)
    ? orderedEntryIds.map(trimText).filter(Boolean)
    : [];
  const requestedIdSet = new Set(requestedIds);

  if (requestedIds.length === 0 || requestedIdSet.size !== requestedIds.length) {
    return normalizedResume;
  }

  const normalizedIncomingBindings = normalizeSampleEntryBindings({
    [sectionId]: sampleEntryBindings,
  })[sectionId] || {};
  let didUpdateSection = false;
  let nextSectionEntryIds = [];
  let fallbackSectionBindings = {};

  const nextSections = normalizedResume.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    fallbackSectionBindings = inferSectionSampleEntryBindings(normalizedResume, section);
    const entryById = new Map(section.entries.map((entry) => [entry.id, entry]));
    const nextEntries = [...section.entries];

    requestedIds.forEach((entryId) => {
      if (entryById.has(entryId)) {
        return;
      }

      const entry = createResumeEntry(section.kind, { id: entryId });
      entryById.set(entryId, entry);
      nextEntries.push(entry);
    });

    const reorderedEntries = reorderItemSubsetById(nextEntries, requestedIds);
    nextSectionEntryIds = reorderedEntries.map((entry) => entry.id).filter(Boolean);
    didUpdateSection = true;

    return {
      ...section,
      entries: reorderedEntries,
    };
  });

  if (!didUpdateSection) {
    return normalizedResume;
  }

  return applySectionSampleEntryBindings({
    ...normalizedResume,
    sections: nextSections,
  }, sectionId, nextSectionEntryIds.map((entryId) => ({ id: entryId })), normalizedIncomingBindings, fallbackSectionBindings);
}

function previewTextListLength(items) {
  return (Array.isArray(items) ? items : []).reduce((length, item, index) => {
    const sourceIndex = Number.isInteger(item?.sourceIndex) ? item.sourceIndex : index;
    return Math.max(length, sourceIndex + 1);
  }, 0);
}

function extendBlankTextList(items, requiredLength) {
  const nextItems = normalizeStringList(items);

  while (nextItems.length < requiredLength) {
    nextItems.push('');
  }

  return nextItems;
}

function extendEducationPrograms(programs, requiredLength) {
  const nextPrograms = Array.isArray(programs) ? [...programs] : [];

  while (nextPrograms.length < requiredLength) {
    nextPrograms.push(createEducationProgram());
  }

  return nextPrograms;
}

function extendEducationCustomSections(customSections, requiredLength) {
  const nextSections = ensureEducationCustomSections(customSections);

  while (nextSections.length < requiredLength) {
    nextSections.push(createEducationCustomSection());
  }

  return nextSections;
}

function createTransientPreviewEntry(sectionKind, previewEntry, existingEntry) {
  const entryId = trimText(previewEntry?.id);

  if (!entryId) {
    return null;
  }

  const nextEntry = createResumeEntry(sectionKind, existingEntry || { id: entryId });
  nextEntry.id = entryId;

  if (sectionKind === 'roles') {
    nextEntry.activities = extendBlankTextList(
      nextEntry.activities,
      previewTextListLength(previewEntry?.activities),
    );
  } else if (sectionKind === 'projects' || sectionKind === 'custom') {
    nextEntry.highlights = extendBlankTextList(
      nextEntry.highlights,
      previewTextListLength(previewEntry?.highlights),
    );
  } else if (sectionKind === 'education') {
    nextEntry.programs = extendEducationPrograms(
      nextEntry.programs,
      Array.isArray(previewEntry?.programs) ? previewEntry.programs.length : 0,
    );
    nextEntry.customSections = extendEducationCustomSections(
      nextEntry.customSections,
      Array.isArray(previewEntry?.customSections) ? previewEntry.customSections.length : 0,
    );
  }

  return nextEntry;
}

function findTransientEntryInsertionIndex(entries, previewEntryOrder, entryId) {
  const order = Array.isArray(previewEntryOrder) ? previewEntryOrder.filter(Boolean) : [];
  const targetIndex = order.indexOf(entryId);

  if (targetIndex < 0) {
    return entries.length;
  }

  const entryIndexById = new Map(entries.map((entry, index) => [entry.id, index]));

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousEntryIndex = entryIndexById.get(order[index]);

    if (Number.isInteger(previousEntryIndex)) {
      return previousEntryIndex + 1;
    }
  }

  for (let index = targetIndex + 1; index < order.length; index += 1) {
    const nextEntryIndex = entryIndexById.get(order[index]);

    if (Number.isInteger(nextEntryIndex)) {
      return nextEntryIndex;
    }
  }

  return entries.length;
}

export function projectTransientSampleEntry(resume, sectionId, previewEntry, previewEntryOrder = []) {
  const normalizedResume = normalizeResume(resume);
  const entryId = trimText(previewEntry?.id);
  let transient = null;

  if (!entryId) {
    return { resume: normalizedResume, transient };
  }

  const sections = normalizedResume.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    const existingEntryIndex = section.entries.findIndex((entry) => entry.id === entryId);
    const baselineEntry = existingEntryIndex >= 0 ? section.entries[existingEntryIndex] : null;
    const projectedEntry = createTransientPreviewEntry(section.kind, previewEntry, baselineEntry);

    if (!projectedEntry) {
      return section;
    }

    const entries = [...section.entries];

    if (existingEntryIndex >= 0) {
      entries[existingEntryIndex] = projectedEntry;
    } else {
      const insertionIndex = findTransientEntryInsertionIndex(entries, previewEntryOrder, entryId);
      entries.splice(insertionIndex, 0, projectedEntry);
    }

    transient = {
      sectionId,
      entryId,
      sectionKind: section.kind,
      baselineEntry,
      projectedEntry,
    };

    return {
      ...section,
      entries,
    };
  });

  return {
    resume: transient ? { ...normalizedResume, sections } : normalizedResume,
    transient,
  };
}

export function resolveTransientSampleEntry(resume, transient) {
  if (!transient?.sectionId || !transient?.entryId) {
    return resume;
  }

  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);

  if (!section) {
    return resume;
  }

  const currentEntryIndex = section.entries.findIndex((entry) => entry.id === transient.entryId);
  const hasTargetMutation = didTransientSampleEntryChange(resume, transient);

  if (currentEntryIndex < 0) {
    return hasTargetMutation ? resume : restoreTransientSampleEntry(resume, transient);
  }

  const currentEntry = section.entries[currentEntryIndex];
  const baselineHasContent = Boolean(
    transient.baselineEntry && sectionEntryHasContent(transient.sectionKind, transient.baselineEntry),
  );
  const currentHasContent = sectionEntryHasContent(transient.sectionKind, currentEntry);

  if (hasTargetMutation && (baselineHasContent || currentHasContent)) {
    return resume;
  }

  return restoreTransientSampleEntry(resume, transient);
}

function restoreTransientSampleEntry(resume, transient) {
  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);

  if (!section) {
    return resume;
  }

  const currentEntryIndex = section.entries.findIndex((entry) => entry.id === transient.entryId);
  const entries = [...section.entries];

  if (transient.baselineEntry) {
    if (currentEntryIndex >= 0) {
      entries[currentEntryIndex] = transient.baselineEntry;
    } else {
      entries.push(transient.baselineEntry);
    }
  } else if (currentEntryIndex >= 0) {
    entries.splice(currentEntryIndex, 1);
  }

  return {
    ...resume,
    sections: resume.sections.map((candidate) => (
      candidate.id === transient.sectionId
        ? { ...candidate, entries }
        : candidate
    )),
  };
}

function compactTransientEntryValue(value, key = '') {
  if (key === 'id') {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalizedValue = trimText(value);
    return normalizedValue || undefined;
  }

  if (Array.isArray(value)) {
    const compactedItems = value
      .map((item) => compactTransientEntryValue(item))
      .filter((item) => item !== undefined);

    return compactedItems.length > 0 ? compactedItems : undefined;
  }

  if (value && typeof value === 'object') {
    const compactedEntries = Object.entries(value)
      .map(([entryKey, entryValue]) => [entryKey, compactTransientEntryValue(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined);

    return compactedEntries.length > 0 ? Object.fromEntries(compactedEntries) : undefined;
  }

  return value === undefined || value === null ? undefined : value;
}

export function didTransientSampleEntryChange(resume, transient) {
  if (!transient?.sectionId || !transient?.entryId || !transient.projectedEntry) {
    return false;
  }

  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);
  const currentEntry = section?.entries?.find((entry) => entry.id === transient.entryId);

  if (!currentEntry) {
    return true;
  }

  return JSON.stringify(compactTransientEntryValue(currentEntry) || null)
    !== JSON.stringify(compactTransientEntryValue(transient.projectedEntry) || null);
}
