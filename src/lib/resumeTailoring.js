import {
  personalEditorPath,
  sectionEntryEditorPath,
} from './editorTargets.js';
import { normalizeResume } from './resume.js';
import { trimText } from './text.js';

export const TAILORING_LABELS = [
  'role-focused',
  'keyword-alignment',
  'impact',
  'clarity',
  'concise',
  'grammar',
  'spelling',
  'reworded',
  'reordered',
  'added',
  'removed',
];

const TAILORABLE_ENTRY_FIELDS = {
  roles: ['role'],
  projects: ['subtitle', 'summary'],
  certifications: ['details'],
  awards: ['details'],
  publications: ['details'],
  custom: ['subtitle', 'details'],
};

const TAILORABLE_LIST_FIELDS = {
  roles: ['activities'],
  projects: ['highlights'],
  custom: ['highlights'],
};

function toText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function cloneValue(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function splitSkills(value) {
  return toText(value)
    .split(/[,;\n]/)
    .map(trimText)
    .filter(Boolean);
}

function createEntryContext(kind, entry) {
  if (kind === 'roles') {
    return {
      organization: trimText(entry.company),
      role: trimText(entry.role),
    };
  }

  if (kind === 'education') {
    return {
      institution: trimText(entry.school),
      program: trimText(entry.degree),
    };
  }

  if (kind === 'skills') {
    return { category: trimText(entry.category) };
  }

  if (kind === 'projects') {
    return { project: trimText(entry.name) };
  }

  if (kind === 'certifications') {
    return { certification: trimText(entry.name), issuer: trimText(entry.issuer) };
  }

  if (kind === 'awards') {
    return { award: trimText(entry.title), issuer: trimText(entry.issuer) };
  }

  if (kind === 'publications') {
    return { publication: trimText(entry.title), publisher: trimText(entry.publisher) };
  }

  return { title: trimText(entry.title), subtitle: trimText(entry.subtitle) };
}

function locatorKey(locator) {
  return [locator.sectionId, locator.entryId, locator.field].join(':');
}

function publicTarget(target) {
  const {
    locator: _locator,
    originalValues: _originalValues,
    path: _path,
    ...safeTarget
  } = target;

  return safeTarget;
}

function createCatalogBuilder() {
  const targets = [];

  function addTarget(candidate) {
    const target = {
      id: `target-${targets.length + 1}`,
      ...candidate,
    };
    targets.push(target);
    return target;
  }

  return { addTarget, targets };
}

function addScalarTarget(builder, {
  value,
  fieldType,
  locator,
  sectionTitle = '',
  entryContext = {},
  allowEmpty = false,
}) {
  const currentValue = toText(value);

  if (!allowEmpty && !trimText(currentValue)) return;

  builder.addTarget({
    type: 'scalar',
    fieldType,
    currentValue,
    sectionTitle: trimText(sectionTitle),
    entryContext,
    locator: { ...locator, sourceValue: currentValue },
    path: locator.scope === 'personal'
      ? personalEditorPath(locator.field)
      : sectionEntryEditorPath(locator.sectionId, locator.entryId, locator.field),
  });
}

function addListTargets(builder, {
  values,
  fieldType,
  locator,
  sectionTitle,
  entryContext,
}) {
  const originalValues = values.map(toText).map(trimText).filter(Boolean);
  if (originalValues.length === 0) return;

  const listTarget = builder.addTarget({
    type: 'list',
    fieldType,
    currentValue: '',
    listLength: originalValues.length,
    sectionTitle: trimText(sectionTitle),
    entryContext,
    locator,
    originalValues,
  });

  originalValues.forEach((currentValue, itemIndex) => {
    builder.addTarget({
      type: 'listItem',
      fieldType,
      currentValue,
      itemIndex,
      listTargetId: listTarget.id,
      listLength: originalValues.length,
      sectionTitle: trimText(sectionTitle),
      entryContext,
      locator: { ...locator, itemIndex, sourceValue: currentValue },
      path: sectionEntryEditorPath(locator.sectionId, locator.entryId, locator.field),
    });
  });
}

export function createResumeTailoringCatalog(candidateResume) {
  const resume = normalizeResume(candidateResume);
  const builder = createCatalogBuilder();

  addScalarTarget(builder, {
    value: resume.personal.headline,
    fieldType: 'headline',
    locator: { scope: 'personal', field: 'headline' },
  });

  if (trimText(resume.personal.aboutMe)) {
    addScalarTarget(builder, {
      value: resume.personal.aboutMe,
      fieldType: 'professional-summary',
      locator: { scope: 'personal', field: 'aboutMe' },
    });
  }

  resume.sections.forEach((section) => {
    section.entries.forEach((entry) => {
      const entryContext = createEntryContext(section.kind, entry);

      for (const field of TAILORABLE_ENTRY_FIELDS[section.kind] || []) {
        addScalarTarget(builder, {
          value: entry[field],
          fieldType: field === 'role' ? 'role-title' : `${section.kind}-${field}`,
          locator: {
            scope: 'entry',
            sectionId: section.id,
            entryId: entry.id,
            field,
          },
          sectionTitle: section.title,
          entryContext,
        });
      }

      for (const field of TAILORABLE_LIST_FIELDS[section.kind] || []) {
        addListTargets(builder, {
          values: Array.isArray(entry[field]) ? entry[field] : [],
          fieldType: field === 'activities' || field === 'highlights' ? 'bullet' : field,
          locator: {
            scope: 'list',
            sectionId: section.id,
            entryId: entry.id,
            field,
            format: 'array',
          },
          sectionTitle: section.title,
          entryContext,
        });
      }

      if (section.kind === 'skills') {
        addListTargets(builder, {
          values: splitSkills(entry.items),
          fieldType: 'skill',
          locator: {
            scope: 'list',
            sectionId: section.id,
            entryId: entry.id,
            field: 'items',
            format: 'commaText',
          },
          sectionTitle: section.title,
          entryContext,
        });
      }
    });
  });

  const requestTargets = builder.targets.map(publicTarget);

  return {
    targets: builder.targets,
    request: { targets: requestTargets },
    fingerprint: JSON.stringify(requestTargets),
  };
}

function normalizeLabels(labels, operation) {
  const normalized = [...new Set((Array.isArray(labels) ? labels : [])
    .map(trimText)
    .filter((label) => TAILORING_LABELS.includes(label)))];
  const operationLabel = {
    add: 'added',
    move: 'reordered',
    remove: 'removed',
    replace: 'reworded',
  }[operation];

  if (operationLabel && !normalized.includes(operationLabel)) normalized.unshift(operationLabel);
  return normalized.slice(0, 6);
}

export function createResumeTailoringReview(catalog, payload) {
  const targetById = new Map(catalog.targets.map((target) => [target.id, target]));
  const seenExistingTargets = new Set();
  const changes = [];

  for (const proposal of Array.isArray(payload?.changes) ? payload.changes : []) {
    const target = targetById.get(trimText(proposal?.targetId));
    const operation = trimText(proposal?.operation);
    const isAdd = operation === 'add' && target?.type === 'list';

    if (!target || (!isAdd && seenExistingTargets.has(target.id))) continue;
    if (target.type === 'scalar' && operation !== 'replace') continue;
    if (target.type === 'listItem' && !['replace', 'remove', 'move'].includes(operation)) continue;
    if (target.type === 'list' && operation !== 'add') continue;

    const value = toText(proposal?.value).trim();
    if ((operation === 'replace' || operation === 'add') && !value) continue;
    if (operation === 'replace' && value === target.currentValue && !Number.isInteger(proposal?.position)) continue;

    if (!isAdd) seenExistingTargets.add(target.id);
    changes.push({
      id: `change-${changes.length + 1}`,
      targetId: target.id,
      target,
      operation,
      value,
      position: Number.isInteger(proposal?.position) ? Math.max(0, proposal.position) : null,
      labels: normalizeLabels(proposal?.labels, operation),
      note: trimText(proposal?.note).slice(0, 240),
      decision: 'pending',
    });
  }

  return {
    catalog,
    changes,
    createdAt: new Date().toISOString(),
  };
}

export function updateTailoringDecision(review, changeId, decision) {
  if (!review || !['pending', 'approved', 'rejected'].includes(decision)) return review;

  return {
    ...review,
    changes: review.changes.map((change) => (
      change.id === changeId ? { ...change, decision } : change
    )),
  };
}

export function updateAllTailoringDecisions(review, decision) {
  if (!review || !['approved', 'rejected'].includes(decision)) return review;
  return {
    ...review,
    changes: review.changes.map((change) => ({ ...change, decision })),
  };
}

function findPreviewEntry(previewModel, locator) {
  const section = previewModel.sectionBlocks.find((candidate) => candidate.id === locator.sectionId);
  return section?.entries.find((candidate) => candidate.id === locator.entryId) || null;
}

function createListPreviewItems(listTarget, itemTargets, changes) {
  const records = listTarget.originalValues.map((text, sourceIndex) => ({
    text,
    sourceIndex,
    originalPosition: sourceIndex,
    desiredPosition: sourceIndex,
  }));

  for (const change of changes) {
    if (change.decision === 'rejected') continue;

    if (change.operation === 'add') {
      records.push({
        text: change.value,
        sourceIndex: null,
        originalPosition: Number.MAX_SAFE_INTEGER,
        desiredPosition: change.position ?? records.length,
        tailoringChange: change,
      });
      continue;
    }

    const itemTarget = itemTargets.get(change.targetId);
    const record = records.find((candidate) => candidate.sourceIndex === itemTarget?.itemIndex);
    if (!record) continue;

    record.tailoringChange = change;
    if (change.operation === 'replace') record.text = change.value;
    if (change.operation === 'remove') record.tailoringRemoved = true;
    if (Number.isInteger(change.position)) record.desiredPosition = change.position;
  }

  return records
    .sort((left, right) => (
      left.desiredPosition - right.desiredPosition
      || left.originalPosition - right.originalPosition
    ))
    .map((record, index) => ({ ...record, reviewIndex: index }));
}

export function createTailoringPreviewModel(previewModel, review) {
  if (!review?.changes?.length) {
    return { previewModel, changeByPath: new Map() };
  }

  const nextPreviewModel = cloneValue(previewModel);
  const changeByPath = new Map();
  const visibleChanges = review.changes.filter((change) => change.decision !== 'rejected');
  const itemTargets = new Map(
    review.catalog.targets.filter((target) => target.type === 'listItem').map((target) => [target.id, target]),
  );
  const listTargets = new Map(
    review.catalog.targets.filter((target) => target.type === 'list').map((target) => [locatorKey(target.locator), target]),
  );

  for (const change of visibleChanges.filter((candidate) => candidate.target.type === 'scalar')) {
    const { locator } = change.target;
    if (locator.scope === 'personal') {
      nextPreviewModel.personal[locator.field] = change.value;
    } else {
      const entry = findPreviewEntry(nextPreviewModel, locator);
      if (entry) entry[locator.field] = change.value;
    }
    changeByPath.set(change.target.path, change);
  }

  const listChangesByKey = new Map();
  for (const change of visibleChanges.filter((candidate) => candidate.target.type !== 'scalar')) {
    const key = locatorKey(change.target.locator);
    const listChanges = listChangesByKey.get(key) || [];
    listChanges.push(change);
    listChangesByKey.set(key, listChanges);
  }

  for (const [key, changes] of listChangesByKey) {
    const referencedListTarget = review.catalog.targets.find(
      (target) => target.id === changes[0]?.target.listTargetId && target.type === 'list',
    );
    const listTarget = listTargets.get(key) || referencedListTarget || null;
    if (!listTarget) continue;
    const entry = findPreviewEntry(nextPreviewModel, listTarget.locator);
    if (!entry) continue;
    const items = createListPreviewItems(listTarget, itemTargets, changes);

    if (listTarget.locator.format === 'commaText') {
      entry.tailoringSkillItems = items;
      entry.items = items.filter((item) => !item.tailoringRemoved).map((item) => item.text).join(', ');
    } else {
      entry[listTarget.locator.field] = items;
    }
  }

  return { previewModel: nextPreviewModel, changeByPath };
}

function findResumeEntry(resume, locator) {
  const section = resume.sections.find((candidate) => candidate.id === locator.sectionId);
  return section?.entries.find((candidate) => candidate.id === locator.entryId) || null;
}

function applyListChanges(entry, listTarget, changes) {
  const records = listTarget.originalValues.map((text, sourceIndex) => ({
    text,
    sourceIndex,
    desiredPosition: sourceIndex,
    originalPosition: sourceIndex,
  }));

  for (const change of changes) {
    if (change.operation === 'add') {
      records.push({
        text: change.value,
        sourceIndex: null,
        desiredPosition: change.position ?? records.length,
        originalPosition: Number.MAX_SAFE_INTEGER,
      });
      continue;
    }

    const sourceIndex = change.target.locator.itemIndex;
    const record = records.find((candidate) => candidate.sourceIndex === sourceIndex);
    if (!record) continue;
    if (change.operation === 'remove') record.removed = true;
    if (change.operation === 'replace') record.text = change.value;
    if (Number.isInteger(change.position)) record.desiredPosition = change.position;
  }

  const values = records
    .filter((record) => !record.removed)
    .sort((left, right) => (
      left.desiredPosition - right.desiredPosition
      || left.originalPosition - right.originalPosition
    ))
    .map((record) => record.text);

  entry[listTarget.locator.field] = listTarget.locator.format === 'commaText'
    ? values.join(', ')
    : (values.length > 0 ? values : ['']);
}

export function applyApprovedTailoringChanges(candidateResume, review) {
  if (!review?.changes?.length) return normalizeResume(candidateResume);
  const resume = cloneValue(normalizeResume(candidateResume));
  const approved = review.changes.filter((change) => change.decision === 'approved');

  for (const change of approved.filter((candidate) => candidate.target.type === 'scalar')) {
    const { locator } = change.target;
    if (locator.scope === 'personal') {
      if (toText(resume.personal[locator.field]) === locator.sourceValue) {
        resume.personal[locator.field] = change.value;
      }
      continue;
    }

    const entry = findResumeEntry(resume, locator);
    if (entry && toText(entry[locator.field]) === locator.sourceValue) {
      entry[locator.field] = change.value;
    }
  }

  const listTargets = review.catalog.targets.filter((target) => target.type === 'list');
  for (const listTarget of listTargets) {
    const changes = approved.filter((change) => locatorKey(change.target.locator) === locatorKey(listTarget.locator));
    if (changes.length === 0) continue;
    const entry = findResumeEntry(resume, listTarget.locator);
    if (!entry) continue;
    const currentValues = listTarget.locator.format === 'commaText'
      ? splitSkills(entry[listTarget.locator.field])
      : (Array.isArray(entry[listTarget.locator.field]) ? entry[listTarget.locator.field].map(trimText).filter(Boolean) : []);
    if (JSON.stringify(currentValues) !== JSON.stringify(listTarget.originalValues)) continue;
    applyListChanges(entry, listTarget, changes);
  }

  return normalizeResume(resume);
}

export function summarizeTailoringReview(review) {
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const change of review?.changes || []) {
    if (counts[change.decision] !== undefined) counts[change.decision] += 1;
  }
  return { ...counts, total: counts.pending + counts.approved + counts.rejected };
}
