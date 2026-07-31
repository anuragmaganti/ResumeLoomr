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
export const TAILORING_OPERATIONS = ['replace', 'remove', 'add', 'move'];

const TARGET_OPERATIONS = {
  scalar: ['replace'],
  list: ['add'],
  listItem: ['replace', 'remove', 'move'],
};
const REVIEW_DECISIONS = ['pending', 'approved', 'rejected'];

const ENTRY_TARGETS = {
  roles: {
    context: [['organization', 'company'], ['role', 'role']],
    scalars: [['role', 'role-title']],
    lists: [['activities', 'bullet', 'array']],
  },
  skills: {
    context: [['category', 'category']],
    lists: [['items', 'skill', 'commaText']],
  },
  projects: {
    context: [['project', 'name']],
    scalars: [['subtitle', 'projects-subtitle'], ['summary', 'projects-summary']],
    lists: [['highlights', 'bullet', 'array']],
  },
  certifications: {
    context: [['certification', 'name'], ['issuer', 'issuer']],
    scalars: [['details', 'certifications-details']],
  },
  awards: {
    context: [['award', 'title'], ['issuer', 'issuer']],
    scalars: [['details', 'awards-details']],
  },
  publications: {
    context: [['publication', 'title'], ['publisher', 'publisher']],
    scalars: [['details', 'publications-details']],
  },
  custom: {
    context: [['title', 'title'], ['subtitle', 'subtitle']],
    scalars: [['subtitle', 'custom-subtitle'], ['details', 'custom-details']],
    lists: [['highlights', 'bullet', 'array']],
  },
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

export function isTailoringOperationAllowed(targetType, operation) {
  return TARGET_OPERATIONS[targetType]?.includes(operation) === true;
}

function publicTarget(target) {
  const { locator: _locator, originalValues: _originalValues, path: _path, ...safeTarget } = target;
  return safeTarget;
}

function addTarget(targets, candidate) {
  const target = { id: `target-${targets.length + 1}`, ...candidate };
  targets.push(target);
  return target;
}

function addScalarTarget(targets, { value, fieldType, locator, sectionTitle = '', entryContext = {} }) {
  const currentValue = toText(value);
  if (!trimText(currentValue)) return;

  addTarget(targets, {
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

function addListTargets(targets, { values, fieldType, locator, sectionTitle, entryContext }) {
  const originalValues = values.map(toText).map(trimText).filter(Boolean);
  if (originalValues.length === 0) return;
  const metadata = {
    fieldType,
    listLength: originalValues.length,
    sectionTitle: trimText(sectionTitle),
    entryContext,
  };

  const listTarget = addTarget(targets, {
    ...metadata,
    type: 'list',
    currentValue: '',
    locator,
    originalValues,
  });

  originalValues.forEach((currentValue, itemIndex) => {
    addTarget(targets, {
      ...metadata,
      type: 'listItem',
      currentValue,
      itemIndex,
      listTargetId: listTarget.id,
      locator: { ...locator, itemIndex },
    });
  });
}

export function createResumeTailoringCatalog(candidateResume) {
  const resume = normalizeResume(candidateResume);
  const targets = [];

  for (const [field, fieldType] of [['headline', 'headline'], ['aboutMe', 'professional-summary']]) {
    addScalarTarget(targets, {
      value: resume.personal[field],
      fieldType,
      locator: { scope: 'personal', field },
    });
  }

  resume.sections.forEach((section) => {
    const config = ENTRY_TARGETS[section.kind];
    if (!config) return;

    section.entries.forEach((entry) => {
      const entryLocator = { sectionId: section.id, entryId: entry.id };
      const entryContext = Object.fromEntries(
        config.context.map(([label, field]) => [label, trimText(entry[field])]),
      );

      for (const [field, fieldType] of config.scalars || []) {
        addScalarTarget(targets, {
          value: entry[field],
          fieldType,
          locator: { ...entryLocator, scope: 'entry', field },
          sectionTitle: section.title,
          entryContext,
        });
      }

      for (const [field, fieldType, format] of config.lists || []) {
        addListTargets(targets, {
          values: format === 'commaText'
            ? splitSkills(entry[field])
            : (Array.isArray(entry[field]) ? entry[field] : []),
          fieldType,
          locator: { ...entryLocator, scope: 'list', field, format },
          sectionTitle: section.title,
          entryContext,
        });
      }
    });
  });

  const requestTargets = targets.map(publicTarget);

  return {
    targets,
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
    if (!isTailoringOperationAllowed(target.type, operation)) continue;

    const value = toText(proposal?.value).trim();
    if ((operation === 'replace' || operation === 'add') && !value) continue;
    if (operation === 'replace' && value === target.currentValue && !Number.isInteger(proposal?.position)) continue;

    if (!isAdd) seenExistingTargets.add(target.id);
    changes.push({
      id: `change-${changes.length + 1}`,
      target,
      operation,
      value,
      position: Number.isInteger(proposal?.position) ? Math.max(0, proposal.position) : null,
      labels: normalizeLabels(proposal?.labels, operation),
      note: trimText(proposal?.note).slice(0, 240),
      decision: 'pending',
    });
  }

  return { catalog, changes };
}

function updateReviewChanges(review, validDecision, update) {
  if (!review || !validDecision) return review;
  return { ...review, changes: review.changes.map(update) };
}

export function updateTailoringDecision(review, changeId, decision) {
  return updateReviewChanges(review, REVIEW_DECISIONS.includes(decision), (change) => (
    change.id === changeId ? { ...change, decision } : change
  ));
}

export function updateAllTailoringDecisions(review, decision) {
  return updateReviewChanges(review, decision !== 'pending' && REVIEW_DECISIONS.includes(decision), (change) => ({
    ...change,
    decision,
  }));
}

function findEntry(model, locator) {
  const section = (model.sectionBlocks || model.sections)
    .find((candidate) => candidate.id === locator.sectionId);
  return section?.entries.find((candidate) => candidate.id === locator.entryId) || null;
}

function findValueOwner(model, locator) {
  return locator.scope === 'personal' ? model.personal : findEntry(model, locator);
}

function createListRecords(listTarget, changes, annotate = false) {
  const records = listTarget.originalValues.map((text, sourceIndex) => ({
    text,
    sourceIndex,
    originalPosition: sourceIndex,
    desiredPosition: sourceIndex,
  }));

  for (const change of changes) {
    if (change.operation === 'add') {
      records.push({
        text: change.value,
        sourceIndex: null,
        originalPosition: Number.MAX_SAFE_INTEGER,
        desiredPosition: change.position ?? records.length,
        ...(annotate ? { tailoringChange: change } : {}),
      });
      continue;
    }

    const record = records[change.target.itemIndex];
    if (!record) continue;

    if (annotate) record.tailoringChange = change;
    if (change.operation === 'replace') record.text = change.value;
    if (change.operation === 'remove') {
      record.removed = true;
      if (annotate) record.tailoringRemoved = true;
    }
    if (Number.isInteger(change.position)) record.desiredPosition = change.position;
  }

  return records
    .sort((left, right) => (
      left.desiredPosition - right.desiredPosition
      || left.originalPosition - right.originalPosition
    ));
}

function groupListChanges(review, changes) {
  const targets = new Map(
    review.catalog.targets.filter((target) => target.type === 'list').map((target) => [target.id, target]),
  );
  const groups = new Map();

  for (const change of changes) {
    if (change.target.type === 'scalar') continue;
    const targetId = change.target.type === 'list' ? change.target.id : change.target.listTargetId;
    const target = targets.get(targetId);
    if (!target) continue;
    const group = groups.get(targetId) || { target, changes: [] };
    group.changes.push(change);
    groups.set(targetId, group);
  }

  return groups.values();
}

export function createTailoringPreviewModel(previewModel, review) {
  if (!review?.changes?.length) {
    return { previewModel, changeByPath: new Map() };
  }

  const nextPreviewModel = cloneValue(previewModel);
  const changeByPath = new Map();
  const visibleChanges = review.changes.filter((change) => change.decision !== 'rejected');

  for (const change of visibleChanges) {
    if (change.target.type !== 'scalar') continue;
    const { locator } = change.target;
    const owner = findValueOwner(nextPreviewModel, locator);
    if (owner) owner[locator.field] = change.value;
    changeByPath.set(change.target.path, change);
  }

  for (const { target, changes } of groupListChanges(review, visibleChanges)) {
    const entry = findEntry(nextPreviewModel, target.locator);
    if (!entry) continue;
    const items = createListRecords(target, changes, true);

    if (target.locator.format === 'commaText') {
      entry.tailoringSkillItems = items;
      entry.items = items.filter((item) => !item.tailoringRemoved).map((item) => item.text).join(', ');
    } else {
      entry[target.locator.field] = items;
    }
  }

  return { previewModel: nextPreviewModel, changeByPath };
}

export function applyApprovedTailoringChanges(candidateResume, review) {
  if (!review?.changes?.length) return normalizeResume(candidateResume);
  const resume = cloneValue(normalizeResume(candidateResume));
  const approved = review.changes.filter((change) => change.decision === 'approved');

  for (const change of approved.filter((candidate) => candidate.target.type === 'scalar')) {
    const { locator } = change.target;
    const owner = findValueOwner(resume, locator);
    if (owner && toText(owner[locator.field]) === locator.sourceValue) {
      owner[locator.field] = change.value;
    }
  }

  for (const { target, changes } of groupListChanges(review, approved)) {
    const entry = findEntry(resume, target.locator);
    if (!entry) continue;
    const current = entry[target.locator.field];
    const currentValues = target.locator.format === 'commaText'
      ? splitSkills(current)
      : (Array.isArray(current) ? current.map(trimText).filter(Boolean) : []);
    if (JSON.stringify(currentValues) !== JSON.stringify(target.originalValues)) continue;
    const values = createListRecords(target, changes)
      .filter((record) => !record.removed)
      .map((record) => record.text);
    entry[target.locator.field] = target.locator.format === 'commaText'
      ? values.join(', ')
      : (values.length > 0 ? values : ['']);
  }

  return normalizeResume(resume);
}
