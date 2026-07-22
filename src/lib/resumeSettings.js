import {
  PRINT_PAGE_HEIGHT_PX,
  PRINT_PAGE_WIDTH_PX,
} from './previewPagination.js';
import { trimText } from './text.js';

export const DEFAULT_TEMPLATE = 'compact';
export const TEMPLATE_OPTIONS = [
  { id: 'compact', label: 'Compact' },
  { id: 'executive', label: 'Executive' },
];

export const PERSONAL_CONTACT_FIELDS = [
  'location',
  'phone',
  'email',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'customField',
];
export const PERSONAL_ALIGNMENT_OPTIONS = ['left', 'center'];
export const PERSONAL_HEADER_ROWS = ['headline', 'contact'];
const SECTION_HEADING_ALIGNMENT_OPTIONS = ['left', 'center'];

const RESUME_SETTINGS_DEFAULTS = {
  textSize: 0,
  horizontalMargins: 0,
  verticalMargins: 0,
  lineSpacing: 0,
  sectionSpacing: 0,
  entrySpacing: 0,
  headingSize: 0,
  nameSize: 0,
  summaryWidthPercent: 100,
  showSummaryTitle: false,
  personalSeparatorTone: 50,
  sectionSeparatorTone: 50,
  personalSeparatorWeight: 2,
  sectionSeparatorWeight: 2,
  personalSeparatorGap: 0,
  sectionSeparatorGap: -1,
  sectionSeparatorPosition: 'aboveSectionName',
  sectionHeadingAlignment: 'left',
  personalContactOrder: PERSONAL_CONTACT_FIELDS,
  personalAlignment: 'template',
  personalHeaderOrder: PERSONAL_HEADER_ROWS,
};

const RESUME_SETTINGS_MIN = -5;
const RESUME_SETTINGS_MAX = 5;
const SUMMARY_WIDTH_MIN = 75;
const SUMMARY_WIDTH_MAX = 100;
const SEPARATOR_TONE_MIN = 0;
const SEPARATOR_TONE_MAX = 100;
const SEPARATOR_WEIGHT_MIN = 1;
const SEPARATOR_WEIGHT_MAX = 5;
const SEPARATOR_GAP_MIN = -5;
const SEPARATOR_GAP_MAX = 5;
const SECTION_SEPARATOR_POSITION_DEFAULT = 'aboveSectionName';
const SECTION_SEPARATOR_POSITIONS = new Set(['aboveSectionName', 'belowSectionName']);
const SECTION_HEADING_ALIGNMENT_DEFAULT = 'left';
const SECTION_HEADING_ALIGNMENTS = new Set(SECTION_HEADING_ALIGNMENT_OPTIONS);
const PERSONAL_ALIGNMENT_DEFAULT = 'template';
const PERSONAL_ALIGNMENTS = new Set([PERSONAL_ALIGNMENT_DEFAULT, ...PERSONAL_ALIGNMENT_OPTIONS]);
const TEXT_SIZE_STEP = 0.03;
const HEADING_SIZE_STEP = 0.05;
const NAME_SIZE_STEP = 0.05;
const RESUME_FONT_ROOT_PX = 16;
const MARGIN_STEP_IN = 0.04;
const LINE_SPACING_STEP = 0.04;
const SECTION_SPACING_STEP = 4;
const ENTRY_SPACING_STEP = 3;
const SEPARATOR_GAP_STEP = 2;
const SETTING_RANGES = {
  summaryWidthPercent: [SUMMARY_WIDTH_MIN, SUMMARY_WIDTH_MAX],
  personalSeparatorTone: [SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX],
  sectionSeparatorTone: [SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX],
  personalSeparatorWeight: [SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX],
  sectionSeparatorWeight: [SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX],
  personalSeparatorGap: [SEPARATOR_GAP_MIN, SEPARATOR_GAP_MAX],
  sectionSeparatorGap: [SEPARATOR_GAP_MIN, SEPARATOR_GAP_MAX],
};
const BOOLEAN_SETTING_IDS = new Set(['showSummaryTitle']);

function normalizeSectionSeparatorPosition(value) {
  return SECTION_SEPARATOR_POSITIONS.has(value) ? value : SECTION_SEPARATOR_POSITION_DEFAULT;
}

function normalizeSectionHeadingAlignment(value) {
  return SECTION_HEADING_ALIGNMENTS.has(value) ? value : SECTION_HEADING_ALIGNMENT_DEFAULT;
}

export function normalizePersonalContactOrder(order) {
  const requestedFields = Array.isArray(order) ? order.map(trimText).filter(Boolean) : [];
  const nextFields = [];

  requestedFields.forEach((field) => {
    if (PERSONAL_CONTACT_FIELDS.includes(field) && !nextFields.includes(field)) {
      nextFields.push(field);
    }
  });

  PERSONAL_CONTACT_FIELDS.forEach((field) => {
    if (!nextFields.includes(field)) {
      nextFields.push(field);
    }
  });

  return nextFields;
}

function normalizePersonalAlignment(alignment) {
  return PERSONAL_ALIGNMENTS.has(alignment) ? alignment : PERSONAL_ALIGNMENT_DEFAULT;
}

export function getEffectivePersonalAlignment(settings, template = DEFAULT_TEMPLATE) {
  const alignment = normalizePersonalAlignment(settings?.personalAlignment);

  if (alignment !== PERSONAL_ALIGNMENT_DEFAULT) {
    return alignment;
  }

  return template === 'executive' ? 'left' : 'center';
}

export function normalizePersonalHeaderOrder(order) {
  const requestedRows = Array.isArray(order) ? order.map(trimText).filter(Boolean) : [];
  const nextRows = [];

  requestedRows.forEach((row) => {
    if (PERSONAL_HEADER_ROWS.includes(row) && !nextRows.includes(row)) {
      nextRows.push(row);
    }
  });

  PERSONAL_HEADER_ROWS.forEach((row) => {
    if (!nextRows.includes(row)) {
      nextRows.push(row);
    }
  });

  return nextRows;
}

const RESUME_PRESENTATION_BASES = {
  executive: {
    pageMarginInlineIn: 0.5,
    pageMarginTopIn: 0.5,
    pageMarginBottomIn: 0.5,
    nameSizeRem: 1.5,
    headingSizeRem: 0.625,
    bodySizeRem: 0.75,
    detailSizeRem: 0.6875,
    metaSizeRem: 0.6875,
    headlineSizeRem: 0.8125,
    bodyLineHeight: 1.3,
    detailLineHeight: 1.45,
    listLineHeight: 1.4,
    sectionGapPx: 12,
    sectionHeadingGapPx: 8,
    entryGapPx: 6,
    repeatedEntryGapPx: 8,
    detailGapPx: 4,
    listGapPx: 4,
  },
  compact: {
    pageMarginInlineIn: 0.4375,
    pageMarginTopIn: 0.4375,
    pageMarginBottomIn: 0.4375,
    nameSizeRem: 1.3125,
    headingSizeRem: 0.625,
    bodySizeRem: 0.75,
    detailSizeRem: 0.6875,
    metaSizeRem: 0.6875,
    headlineSizeRem: 0.8125,
    bodyLineHeight: 1.4,
    detailLineHeight: 1.4,
    listLineHeight: 1.4,
    sectionGapPx: 10,
    sectionHeadingGapPx: 8,
    entryGapPx: 6,
    repeatedEntryGapPx: 8,
    detailGapPx: 4,
    listGapPx: 4,
  },
};

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function clampInteger(value, min, max) {
  return Math.trunc(clampNumber(value, min, max));
}

export function normalizeResumeTemplate(template) {
  return TEMPLATE_OPTIONS.some((option) => option.id === template) ? template : DEFAULT_TEMPLATE;
}

export function normalizeResumeSettings(settings) {
  return Object.fromEntries(
    Object.keys(RESUME_SETTINGS_DEFAULTS).map((key) => {
      if (key === 'personalContactOrder') {
        return [
          key,
          normalizePersonalContactOrder(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'personalHeaderOrder') {
        return [
          key,
          normalizePersonalHeaderOrder(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'personalAlignment') {
        return [
          key,
          normalizePersonalAlignment(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'sectionSeparatorPosition') {
        return [
          key,
          normalizeSectionSeparatorPosition(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'sectionHeadingAlignment') {
        return [
          key,
          normalizeSectionHeadingAlignment(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (BOOLEAN_SETTING_IDS.has(key)) {
        return [key, settings?.[key] === true];
      }

      const [min, max] = SETTING_RANGES[key] || [RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX];

      return [
        key,
        clampInteger(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key], min, max),
      ];
    }),
  );
}

export function hasResumeSettingId(settingId) {
  return Object.hasOwn(RESUME_SETTINGS_DEFAULTS, settingId);
}

export function adjustResumeSettings(settings, settingId, delta) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const currentValue = normalizedSettings[settingId] ?? 0;

  if (
    !hasResumeSettingId(settingId) ||
    SETTING_RANGES[settingId] ||
    BOOLEAN_SETTING_IDS.has(settingId) ||
    settingId === 'sectionSeparatorPosition' ||
    settingId === 'sectionHeadingAlignment' ||
    settingId === 'personalContactOrder' ||
    settingId === 'personalAlignment' ||
    settingId === 'personalHeaderOrder'
  ) {
    return normalizedSettings;
  }

  return {
    ...normalizedSettings,
    [settingId]: clampInteger(currentValue + delta, RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX),
  };
}

export function setResumeSettingsValue(settings, settingId, value) {
  const normalizedSettings = normalizeResumeSettings(settings);

  if (!hasResumeSettingId(settingId)) {
    return normalizedSettings;
  }

  if (settingId === 'personalContactOrder') {
    return {
      ...normalizedSettings,
      personalContactOrder: normalizePersonalContactOrder(value),
    };
  }

  if (settingId === 'personalHeaderOrder') {
    return {
      ...normalizedSettings,
      personalHeaderOrder: normalizePersonalHeaderOrder(value),
    };
  }

  if (settingId === 'personalAlignment') {
    return {
      ...normalizedSettings,
      personalAlignment: normalizePersonalAlignment(value),
    };
  }

  if (settingId === 'sectionSeparatorPosition') {
    return {
      ...normalizedSettings,
      sectionSeparatorPosition: normalizeSectionSeparatorPosition(value),
    };
  }

  if (settingId === 'sectionHeadingAlignment') {
    return {
      ...normalizedSettings,
      sectionHeadingAlignment: normalizeSectionHeadingAlignment(value),
    };
  }

  if (BOOLEAN_SETTING_IDS.has(settingId)) {
    return {
      ...normalizedSettings,
      [settingId]: value === true,
    };
  }

  const [min, max] = SETTING_RANGES[settingId] || [RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX];

  return {
    ...normalizedSettings,
    [settingId]: clampInteger(value, min, max),
  };
}

function resolvePresentationBase(template) {
  return RESUME_PRESENTATION_BASES[template] || RESUME_PRESENTATION_BASES[DEFAULT_TEMPLATE];
}

function formatFontPxFromRem(value) {
  return formatPx(value * RESUME_FONT_ROOT_PX);
}

function formatPx(value) {
  return `${Number(value.toFixed(2))}px`;
}

function formatInches(value) {
  return `${Number(value.toFixed(3))}in`;
}

function formatUnitless(value) {
  return `${Number(value.toFixed(3))}`;
}

function formatSeparatorColor(tone) {
  const normalizedTone = clampInteger(tone, SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX);

  if (normalizedTone <= 0) {
    return 'transparent';
  }

  return `rgba(0, 0, 0, ${Number((normalizedTone / 100).toFixed(2))})`;
}

function formatDarkSeparatorColor(tone) {
  const normalizedTone = clampInteger(tone, SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX);

  if (normalizedTone <= 0) {
    return 'transparent';
  }

  return `rgba(255, 255, 255, ${Number((normalizedTone / 100).toFixed(2))})`;
}

function formatSeparatorWeight(weight) {
  const normalizedWeight = clampInteger(weight, SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX);
  const weightMap = {
    1: 0.5,
    2: 1,
    3: 1.5,
    4: 2,
    5: 3,
  };

  return formatPx(weightMap[normalizedWeight] || 1);
}

function personalAlignmentToJustifyContent(alignment) {
  if (alignment === 'left') {
    return 'flex-start';
  }

  return 'center';
}

function personalAlignmentToSummaryMargins(alignment) {
  if (alignment === 'left') {
    return { left: '0', right: 'auto' };
  }

  return { left: 'auto', right: 'auto' };
}

export function getResumePresentationVars(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const personalAlignment = getEffectivePersonalAlignment(normalizedSettings, template);
  const summaryMargins = personalAlignmentToSummaryMargins(personalAlignment);
  const textScale = 1 + (normalizedSettings.textSize * TEXT_SIZE_STEP);
  const headingScale = 1 + (normalizedSettings.headingSize * HEADING_SIZE_STEP);
  const nameScale = 1 + (normalizedSettings.nameSize * NAME_SIZE_STEP);
  const bodyLineHeight = clampNumber(base.bodyLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.2);
  const detailLineHeight = clampNumber(base.detailLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const listLineHeight = clampNumber(base.listLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const sectionGap = Math.max(0, base.sectionGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const sectionHeadingGap = Math.max(0, base.sectionHeadingGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const personalSeparatorGap = Math.max(0, sectionGap + (normalizedSettings.personalSeparatorGap * SEPARATOR_GAP_STEP));
  const sectionSeparatorGap = Math.max(0, sectionGap + (normalizedSettings.sectionSeparatorGap * SEPARATOR_GAP_STEP));
  const entryGap = Math.max(0, base.entryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const repeatedEntryGap = Math.max(0, base.repeatedEntryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const detailGap = Math.max(0, base.detailGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const listGap = Math.max(0, base.listGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const pageMarginInline = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const pageMarginTop = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const pageMarginBottom = Math.max(0.2, base.pageMarginBottomIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const printContentWidth = Math.max(0, 8.5 - (pageMarginInline * 2));
  const printMinHeight = Math.max(0, 11 - pageMarginTop - pageMarginBottom);

  return {
    '--resume-page-width': `${PRINT_PAGE_WIDTH_PX}px`,
    '--resume-page-height': `${PRINT_PAGE_HEIGHT_PX}px`,
    '--resume-page-min-height': `${PRINT_PAGE_HEIGHT_PX}px`,
    '--resume-page-margin-inline': formatInches(pageMarginInline),
    '--resume-page-margin-top': formatInches(pageMarginTop),
    '--resume-page-margin-bottom': formatInches(pageMarginBottom),
    '--resume-print-content-width': formatInches(printContentWidth),
    '--resume-name-size': formatFontPxFromRem(base.nameSizeRem * nameScale),
    '--resume-heading-size': formatFontPxFromRem(base.headingSizeRem * headingScale),
    '--resume-body-size': formatFontPxFromRem(base.bodySizeRem * textScale),
    '--resume-detail-size': formatFontPxFromRem(base.detailSizeRem * textScale),
    '--resume-meta-size': formatFontPxFromRem(base.metaSizeRem * textScale),
    '--resume-headline-size': formatFontPxFromRem(base.headlineSizeRem * textScale),
    '--resume-body-line-height': formatUnitless(bodyLineHeight),
    '--resume-detail-line-height': formatUnitless(detailLineHeight),
    '--resume-list-line-height': formatUnitless(listLineHeight),
    '--resume-section-gap': formatPx(sectionGap),
    '--resume-personal-separator-gap': formatPx(personalSeparatorGap),
    '--resume-section-separator-gap': formatPx(sectionSeparatorGap),
    '--resume-personal-separator-color': formatSeparatorColor(normalizedSettings.personalSeparatorTone),
    '--resume-section-separator-color': formatSeparatorColor(normalizedSettings.sectionSeparatorTone),
    '--resume-personal-separator-dark-color': formatDarkSeparatorColor(normalizedSettings.personalSeparatorTone),
    '--resume-section-separator-dark-color': formatDarkSeparatorColor(normalizedSettings.sectionSeparatorTone),
    '--resume-personal-separator-weight': formatSeparatorWeight(normalizedSettings.personalSeparatorWeight),
    '--resume-section-separator-weight': formatSeparatorWeight(normalizedSettings.sectionSeparatorWeight),
    '--resume-section-heading-gap': formatPx(sectionHeadingGap),
    '--resume-entry-gap': formatPx(entryGap),
    '--resume-repeated-entry-gap': formatPx(repeatedEntryGap),
    '--resume-detail-gap': formatPx(detailGap),
    '--resume-list-gap': formatPx(listGap),
    '--resume-summary-width-percent': `${normalizedSettings.summaryWidthPercent}%`,
    '--resume-personal-alignment': personalAlignment,
    '--resume-personal-justify-content': personalAlignmentToJustifyContent(personalAlignment),
    '--resume-summary-margin-left': summaryMargins.left,
    '--resume-summary-margin-right': summaryMargins.right,
    '--resume-print-min-height': formatInches(printMinHeight),
  };
}

export function getResumePrintPageRule(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const horizontalMargin = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const verticalMargin = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));

  return `@page { size: letter; margin: ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)} ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)}; }`;
}
