import { normalizeSampleDisplay } from './resumeSampleState.js';
import { stableJson } from './stableJson.js';
import { trimText } from './text.js';

export const COVER_LETTER_TEMPLATE_OPTIONS = [
  { id: 'compact', label: 'Compact' },
  { id: 'executive', label: 'Executive' },
  { id: 'modern', label: 'Modern' },
];

export const COVER_LETTER_EDITOR_GROUPS = [
  { id: 'sender', label: 'Sender' },
  { id: 'recipient', label: 'Recipient' },
  { id: 'letter', label: 'Letter' },
  { id: 'closing', label: 'Closing' },
];

export const COVER_LETTER_SENDER_FIELDS = [
  'name',
  'headline',
  'location',
  'phone',
  'email',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'customField',
];

const DEFAULT_SETTINGS = {
  horizontalMargins: 0,
  verticalMargins: 0,
  textSize: 0,
  lineGap: 0,
  paragraphGap: 0,
  nameSize: 0,
};

const SETTING_MIN = -5;
const SETTING_MAX = 5;
const BODY_ROLES = new Set(['opening', 'evidence', 'closing']);
const TEMPLATE_IDS = new Set(COVER_LETTER_TEMPLATE_OPTIONS.map((option) => option.id));
const TEMPLATE_PRESENTATION = {
  compact: { margin: 0.56, body: 0.76, line: 1.46, paragraph: 12, name: 1.12 },
  executive: { margin: 0.68, body: 0.79, line: 1.55, paragraph: 14, name: 1.15 },
  modern: { margin: 0.62, body: 0.78, line: 1.52, paragraph: 15, name: 1.22 },
};

function createId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(SETTING_MIN, Math.min(SETTING_MAX, Math.trunc(numeric)));
}

function normalizeString(value, maxLength = 12_000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function getTemplatePresentation(template) {
  return TEMPLATE_PRESENTATION[template] || TEMPLATE_PRESENTATION.compact;
}

function reorderExact(items, orderedIds) {
  const requested = Array.isArray(orderedIds) ? orderedIds : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  if (requested.length !== byId.size || requested.some((id) => !byId.has(id))) return null;
  return requested.map((id) => byId.get(id));
}

function normalizeAddressLines(value) {
  return (Array.isArray(value) ? value : [])
    .map((line) => normalizeString(line, 300))
    .slice(0, 6);
}

export function createCoverLetterParagraphBlock(role = 'evidence') {
  return { id: createId('paragraph'), kind: 'paragraph', role, text: '' };
}

export function createCoverLetterBulletItem() {
  return { id: createId('bullet'), text: '' };
}

export function createCoverLetterBulletListBlock() {
  return { id: createId('bullets'), kind: 'bulletList', items: [createCoverLetterBulletItem()] };
}

function createEmptyCoverLetter(resumeId = '') {
  return {
    resumeId: trimText(resumeId),
    sender: { mode: 'resume', overrides: {} },
    recipient: {
      date: '',
      hiringManagerName: '',
      hiringManagerTitle: '',
      company: '',
      addressLines: [''],
    },
    greeting: '',
    bodyBlocks: [
      createCoverLetterParagraphBlock('opening'),
      createCoverLetterParagraphBlock('evidence'),
      createCoverLetterParagraphBlock('closing'),
    ],
    signOff: 'Sincerely,',
    signatureName: '',
    sampleDisplay: normalizeSampleDisplay(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

function normalizeSender(candidate = {}) {
  const rawOverrides = candidate?.overrides && typeof candidate.overrides === 'object'
    ? candidate.overrides
    : {};
  const overrides = {};

  COVER_LETTER_SENDER_FIELDS.forEach((field) => {
    if (Object.hasOwn(rawOverrides, field)) {
      overrides[field] = normalizeString(rawOverrides[field], 500);
    }
  });

  return {
    mode: candidate?.mode === 'custom' ? 'custom' : 'resume',
    overrides,
  };
}

function normalizeBodyBlock(block, index) {
  const kind = block?.kind === 'bulletList' ? 'bulletList' : 'paragraph';
  const id = trimText(block?.id) || createId(kind === 'paragraph' ? 'paragraph' : 'bullets');

  if (kind === 'bulletList') {
    const items = (Array.isArray(block?.items) ? block.items : [])
      .slice(0, 30)
      .map((item) => ({
        id: trimText(item?.id) || createId('bullet'),
        text: normalizeString(item?.text, 2_000),
      }));
    return { id, kind, items: items.length > 0 ? items : [{ id: createId('bullet'), text: '' }] };
  }

  const fallbackRole = index === 0 ? 'opening' : index === 2 ? 'closing' : 'evidence';
  return {
    id,
    kind,
    role: BODY_ROLES.has(block?.role) ? block.role : fallbackRole,
    text: normalizeString(block?.text),
  };
}

export function normalizeCoverLetter(candidate = {}, resumeId = '') {
  const fallback = createEmptyCoverLetter(resumeId);
  const bodyBlocks = (Array.isArray(candidate?.bodyBlocks) ? candidate.bodyBlocks : fallback.bodyBlocks)
    .slice(0, 20)
    .map(normalizeBodyBlock);

  return {
    resumeId: trimText(candidate?.resumeId || resumeId),
    sender: normalizeSender(candidate?.sender),
    recipient: {
      date: normalizeString(candidate?.recipient?.date, 120),
      hiringManagerName: normalizeString(candidate?.recipient?.hiringManagerName, 300),
      hiringManagerTitle: normalizeString(candidate?.recipient?.hiringManagerTitle, 300),
      company: normalizeString(candidate?.recipient?.company, 300),
      addressLines: normalizeAddressLines(candidate?.recipient?.addressLines),
    },
    greeting: normalizeString(candidate?.greeting, 300),
    bodyBlocks: bodyBlocks.length > 0 ? bodyBlocks : fallback.bodyBlocks,
    signOff: normalizeString(candidate?.signOff, 160),
    signatureName: normalizeString(candidate?.signatureName, 300),
    sampleDisplay: normalizeSampleDisplay(candidate?.sampleDisplay),
    settings: Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((key) => [
        key,
        normalizeInteger(candidate?.settings?.[key], DEFAULT_SETTINGS[key]),
      ]),
    ),
  };
}

export function normalizeCoverLetterDraft(candidate = {}, resumeId = '') {
  return {
    coverLetter: normalizeCoverLetter(candidate?.coverLetter, resumeId),
    template: TEMPLATE_IDS.has(candidate?.template) ? candidate.template : 'compact',
    savedAt: typeof candidate?.savedAt === 'string' ? candidate.savedAt : null,
    localRevision: trimText(candidate?.localRevision),
    cloudVersion: Math.max(0, Number(candidate?.cloudVersion || 0) || 0),
    importWarnings: Array.isArray(candidate?.importWarnings)
      ? candidate.importWarnings.map((warning) => trimText(warning)).filter(Boolean).slice(0, 20)
      : [],
  };
}

export function createBlankCoverLetterDraft(resumeId = '', template = 'compact') {
  return normalizeCoverLetterDraft({
    coverLetter: createEmptyCoverLetter(resumeId),
    template,
  }, resumeId);
}

export function createSavedCoverLetterDraft(candidate, savedAt = new Date().toISOString()) {
  return {
    ...normalizeCoverLetterDraft(candidate, candidate?.coverLetter?.resumeId),
    savedAt,
  };
}

export function serializeCoverLetterDraft(candidate) {
  const draft = normalizeCoverLetterDraft(candidate, candidate?.coverLetter?.resumeId);
  return { version: 1, ...draft };
}

export function coverLetterHasContent(candidate) {
  const letter = normalizeCoverLetter(candidate, candidate?.resumeId);
  const recipientValues = [
    letter.recipient.date,
    letter.recipient.hiringManagerName,
    letter.recipient.hiringManagerTitle,
    letter.recipient.company,
    ...letter.recipient.addressLines,
  ];
  const bodyHasContent = letter.bodyBlocks.some((block) => (
    block.kind === 'bulletList'
      ? block.items.some((item) => trimText(item.text))
      : trimText(block.text)
  ));

  return Boolean(
    Object.values(letter.sender.overrides).some((value) => trimText(value))
    || recipientValues.some((value) => trimText(value))
    || trimText(letter.greeting)
    || bodyHasContent
    || trimText(letter.signatureName)
  );
}

export function getCoverLetterWordCount(candidate) {
  const letter = normalizeCoverLetter(candidate, candidate?.resumeId);
  const bodyText = letter.bodyBlocks.flatMap((block) => (
    block.kind === 'bulletList' ? block.items.map((item) => item.text) : [block.text]
  ));
  const text = [letter.greeting, ...bodyText, letter.signOff, letter.signatureName]
    .map(trimText)
    .filter(Boolean)
    .join(' ');
  return text ? text.split(/\s+/).length : 0;
}

function hashValue(value) {
  const serialized = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createCoverLetterContentHash(candidate) {
  const draft = normalizeCoverLetterDraft(candidate, candidate?.coverLetter?.resumeId);
  return hashValue({ coverLetter: draft.coverLetter, template: draft.template });
}

export function resolveCoverLetterSender(candidate, resume = {}) {
  const letter = normalizeCoverLetter(candidate, candidate?.resumeId);
  const personal = resume?.personal || {};
  const linked = {
    name: personal.name || '',
    headline: personal.headline || '',
    location: personal.location || '',
    phone: personal.phone || '',
    email: personal.email || '',
    linkedinUrl: personal.linkedinUrl || '',
    githubUrl: personal.githubUrl || '',
    portfolioUrl: personal.portfolioUrl || '',
    customField: personal.customField || '',
  };

  if (letter.sender.mode === 'custom') {
    return Object.fromEntries(COVER_LETTER_SENDER_FIELDS.map((field) => [field, letter.sender.overrides[field] || '']));
  }

  return Object.fromEntries(COVER_LETTER_SENDER_FIELDS.map((field) => [
    field,
    Object.hasOwn(letter.sender.overrides, field) ? letter.sender.overrides[field] : linked[field],
  ]));
}

function normalizeSharedFieldValue(value) {
  return trimText(value)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export function reconcileImportedCoverLetterSender({
  resumeDraft,
  coverLetterDraft,
  allowResumeBackfill = false,
} = {}) {
  const nextResumeDraft = resumeDraft ? structuredClone(resumeDraft) : null;
  const nextCoverLetterDraft = normalizeCoverLetterDraft(
    coverLetterDraft,
    coverLetterDraft?.coverLetter?.resumeId,
  );
  const overrides = { ...nextCoverLetterDraft.coverLetter.sender.overrides };
  const warnings = [...nextCoverLetterDraft.importWarnings];
  const personal = nextResumeDraft?.resume?.personal || {};

  COVER_LETTER_SENDER_FIELDS.forEach((field) => {
    if (!Object.hasOwn(overrides, field) || !trimText(overrides[field])) return;
    const importedValue = overrides[field];
    const resumeValue = personal[field] || '';
    if (normalizeSharedFieldValue(importedValue) === normalizeSharedFieldValue(resumeValue)) {
      delete overrides[field];
      return;
    }
    if (!trimText(resumeValue) && allowResumeBackfill && nextResumeDraft) {
      nextResumeDraft.resume.personal[field] = importedValue;
      delete overrides[field];
      return;
    }
    if (trimText(resumeValue)) {
      warnings.push(`${field} differs from the attached resume, so the cover letter keeps its imported value.`);
    }
  });

  if (
    normalizeSharedFieldValue(nextCoverLetterDraft.coverLetter.signatureName)
    === normalizeSharedFieldValue(nextResumeDraft?.resume?.personal?.name)
  ) {
    nextCoverLetterDraft.coverLetter.signatureName = '';
  }

  nextCoverLetterDraft.coverLetter.sender = {
    mode: 'resume',
    overrides,
  };
  nextCoverLetterDraft.importWarnings = [...new Set(warnings)];
  return { resumeDraft: nextResumeDraft, coverLetterDraft: nextCoverLetterDraft };
}

export function updateCoverLetter(candidate, updater) {
  const normalized = normalizeCoverLetter(candidate, candidate?.resumeId);
  return normalizeCoverLetter(updater(normalized), normalized.resumeId);
}

export function reorderCoverLetterBodyBlocks(candidate, orderedIds) {
  return updateCoverLetter(candidate, (letter) => {
    const bodyBlocks = reorderExact(letter.bodyBlocks, orderedIds);
    return bodyBlocks ? { ...letter, bodyBlocks } : letter;
  });
}

export function reorderCoverLetterBullets(candidate, blockId, orderedIds) {
  return updateCoverLetter(candidate, (letter) => ({
    ...letter,
    bodyBlocks: letter.bodyBlocks.map((block) => {
      if (block.id !== blockId || block.kind !== 'bulletList') return block;
      const items = reorderExact(block.items, orderedIds);
      return items ? { ...block, items } : block;
    }),
  }));
}

export function getCoverLetterPresentationVars(candidate, template = 'compact') {
  const settings = normalizeCoverLetter(candidate, candidate?.resumeId).settings;
  const base = getTemplatePresentation(template);

  const marginInline = `${base.margin + settings.horizontalMargins * 0.04}in`;
  const marginBlock = `${base.margin + settings.verticalMargins * 0.04}in`;

  return {
    '--cover-letter-margin-inline': marginInline,
    '--cover-letter-margin-block': marginBlock,
    '--resume-page-margin-inline': marginInline,
    '--resume-page-margin-top': marginBlock,
    '--resume-page-margin-bottom': marginBlock,
    '--cover-letter-body-size': `${base.body + settings.textSize * 0.025}rem`,
    '--cover-letter-line-height': base.line + settings.lineGap * 0.04,
    '--cover-letter-paragraph-gap': `${base.paragraph + settings.paragraphGap * 2}px`,
    '--cover-letter-name-size': `${base.name + settings.nameSize * 0.05}rem`,
  };
}

export function getCoverLetterPrintPageRule(candidate, template = 'compact') {
  const settings = normalizeCoverLetter(candidate, candidate?.resumeId).settings;
  const { margin } = getTemplatePresentation(template);
  const marginInline = margin + settings.horizontalMargins * 0.04;
  const marginBlock = margin + settings.verticalMargins * 0.04;

  return `
    @page { size: Letter; margin: ${marginBlock}in ${marginInline}in; }
    :root { --resume-print-content-width: ${8.5 - marginInline * 2}in; }
  `;
}
