import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createEmptyResume,
  setPersonalContactOrder,
  setPersonalHeaderOrder,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  updatePersonalField,
  updateResumeSetting,
} from '../src/lib/resume.js';
import {
  getEffectivePersonalAlignment,
  getResumePresentationVars,
  getResumePrintPageRule,
  normalizePersonalContactOrder,
  normalizePersonalHeaderOrder,
  normalizeResumeSettings,
} from '../src/lib/resumeSettings.js';
import { calculatePreviewPageBreaks } from '../src/lib/previewPagination.js';

test('resume settings produce bounded preview and print variables', () => {
  const settings = normalizeResumeSettings({
    textSize: 99,
    horizontalMargins: -99,
    verticalMargins: 2,
    personalContactOrder: ['email', 'email', 'unknown', 'phone'],
  });
  const vars = getResumePresentationVars(settings, 'compact');

  assert.equal(settings.textSize, 5);
  assert.equal(settings.horizontalMargins, -5);
  assert.deepEqual(settings.personalContactOrder, [
    'email',
    'phone',
    'location',
    'linkedinUrl',
    'githubUrl',
    'portfolioUrl',
    'customField',
  ]);
  assert.equal(settings.summaryWidthPercent, 100);
  assert.equal(settings.personalSeparatorTone, 50);
  assert.equal(settings.sectionSeparatorWeight, 2);
  assert.equal(settings.sectionSeparatorPosition, 'aboveSectionName');
  assert.equal(settings.personalAlignment, 'template');
  assert.deepEqual(settings.personalHeaderOrder, ['headline', 'contact']);
  assert.equal(getEffectivePersonalAlignment(settings, 'compact'), 'center');
  assert.equal(getEffectivePersonalAlignment(settings, 'executive'), 'left');
  assert.match(vars['--resume-page-margin-inline'], /in$/);
  assert.match(vars['--resume-print-content-width'], /in$/);
  assert.match(vars['--resume-name-size'], /px$/);
  assert.match(vars['--resume-heading-size'], /px$/);
  assert.match(vars['--resume-body-size'], /px$/);
  assert.match(vars['--resume-detail-size'], /px$/);
  assert.match(vars['--resume-meta-size'], /px$/);
  assert.match(vars['--resume-headline-size'], /px$/);
  assert.doesNotMatch(vars['--resume-body-size'], /rem$/);
  assert.equal(vars['--resume-summary-width-percent'], '100%');
  assert.equal(vars['--resume-personal-alignment'], 'center');
  assert.equal(vars['--resume-personal-justify-content'], 'center');
  assert.equal(vars['--resume-section-separator-color'], 'rgba(0, 0, 0, 0.5)');
  assert.equal(vars['--resume-section-separator-dark-color'], 'rgba(255, 255, 255, 0.5)');
  assert.equal(vars['--resume-section-separator-weight'], '1px');
  assert.equal(vars['--resume-section-separator-gap'], '8px');
  assert.match(getResumePrintPageRule(settings, 'compact'), /^@page \{ size: letter;/);

  const updatedResume = updateResumeSetting(createEmptyResume(), 'textSize', 1);
  assert.equal(updatedResume.settings.textSize, 1);

  const narrowSummary = setResumeSummaryWidthPercent(createEmptyResume(), 10);
  assert.equal(narrowSummary.settings.summaryWidthPercent, 75);

  const wideSummary = setResumeSummaryWidthPercent(createEmptyResume(), 110);
  assert.equal(wideSummary.settings.summaryWidthPercent, 100);

  const hiddenPersonalSeparator = setResumeSettingValue(createEmptyResume(), 'personalSeparatorTone', -20);
  assert.equal(hiddenPersonalSeparator.settings.personalSeparatorTone, 0);

  const thickSectionSeparator = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorWeight', 99);
  assert.equal(thickSectionSeparator.settings.sectionSeparatorWeight, 5);

  const compactSectionGap = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorGap', -99);
  assert.equal(compactSectionGap.settings.sectionSeparatorGap, -5);

  const belowHeadingSeparator = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorPosition', 'belowSectionName');
  assert.equal(belowHeadingSeparator.settings.sectionSeparatorPosition, 'belowSectionName');

  const invalidSeparatorPosition = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorPosition', 'sideways');
  assert.equal(invalidSeparatorPosition.settings.sectionSeparatorPosition, 'aboveSectionName');

  const leftAlignedPersonal = setResumeSettingValue(createEmptyResume(), 'personalAlignment', 'left');
  assert.equal(leftAlignedPersonal.settings.personalAlignment, 'left');
  assert.equal(getResumePresentationVars(leftAlignedPersonal.settings, 'compact')['--resume-personal-alignment'], 'left');

  const invalidPersonalAlignment = setResumeSettingValue(createEmptyResume(), 'personalAlignment', 'middle');
  assert.equal(invalidPersonalAlignment.settings.personalAlignment, 'template');
});

test('personal contact order is display-only metadata for sample and real fields', () => {
  const normalizedOrder = normalizePersonalContactOrder(['githubUrl', 'email', 'githubUrl', 'bad-field']);

  assert.deepEqual(normalizedOrder, [
    'githubUrl',
    'email',
    'location',
    'phone',
    'linkedinUrl',
    'portfolioUrl',
    'customField',
  ]);

  let resume = createEmptyResume();
  resume = updatePersonalField(resume, 'email', 'person@example.com');
  resume = updatePersonalField(resume, 'phone', '(555) 111-2222');
  resume = setPersonalContactOrder(resume, ['email', 'phone']);

  assert.deepEqual(resume.settings.personalContactOrder.slice(0, 2), ['email', 'phone']);
  assert.equal(resume.personal.email, 'person@example.com');
  assert.equal(resume.personal.phone, '(555) 111-2222');

  const rejected = setPersonalContactOrder(resume, ['email', 'email']);
  assert.deepEqual(rejected.settings.personalContactOrder, resume.settings.personalContactOrder);
});

test('personal headline and contact order is display-only metadata', () => {
  assert.deepEqual(normalizePersonalHeaderOrder(['contact', 'headline']), ['contact', 'headline']);
  assert.deepEqual(normalizePersonalHeaderOrder(['headline', 'headline', 'bad-row']), ['headline', 'contact']);

  let resume = createEmptyResume();
  resume = updatePersonalField(resume, 'headline', 'Software Engineer');
  resume = updatePersonalField(resume, 'email', 'person@example.com');
  resume = setPersonalHeaderOrder(resume, ['contact', 'headline']);

  assert.deepEqual(resume.settings.personalHeaderOrder, ['contact', 'headline']);
  assert.equal(resume.personal.headline, 'Software Engineer');
  assert.equal(resume.personal.email, 'person@example.com');

  const rejected = setPersonalHeaderOrder(resume, ['contact', 'contact']);
  assert.deepEqual(rejected.settings.personalHeaderOrder, resume.settings.personalHeaderOrder);

  const resetThroughSettingValue = setResumeSettingValue(resume, 'personalHeaderOrder', ['headline', 'contact']);
  assert.deepEqual(resetThroughSettingValue.settings.personalHeaderOrder, ['headline', 'contact']);
});

test('preview mobile chrome rules do not reflow printable resume content', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');

  assert.match(indexHtml, /<meta name="format-detection" content="telephone=no, email=no, address=no, date=no" \/>/);
  assert.match(previewCss, /@media screen and \(max-width: 720px\)/);
  assert.doesNotMatch(appCss, /@media \((?:max|min)-width/);
  assert.doesNotMatch(previewCss, /@media \((?:max|min)-width/);
  assert.match(previewCss, /-webkit-text-size-adjust:\s*100%/);
  assert.match(previewCss, /\.resumePage\s*\{[\s\S]*?font-family:\s*Arial,\s*Helvetica,\s*sans-serif/);
  assert.match(previewCss, /--resume-name-size:\s*24px/);
  assert.match(previewCss, /--resume-body-size:\s*12px/);
  assert.match(previewCss, /\.previewDragOverlay h2\s*\{[\s\S]*?font-size:\s*var\(--resume-heading-size,\s*10px\)/);
  assert.match(previewCss, /\.resumePage a\[x-apple-data-detectors\],\s*\.resumePage a\[href\^="tel"\],\s*\.resumePage a\[href\^="mailto"\]\s*\{[\s\S]*?font:\s*inherit !important/);
  assert.match(previewCss, /\.resumePage h2\s*\{[\s\S]*?line-height:\s*1\.1/);
  assert.doesNotMatch(previewCss, /@media \(max-width: 720px\)[\s\S]*?\.previewEntryHeader[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(previewCss, /@media \(max-width: 720px\)[\s\S]*?\.personalDetails[\s\S]*?flex-wrap:\s*wrap/);
});

test('preview print CSS uses physical page geometry instead of mobile viewport geometry', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');
  const previewLayoutHook = fs.readFileSync('src/components/useResumePreviewLayout.js', 'utf8');
  const builderHook = fs.readFileSync('src/hooks/useResumeBuilder.js', 'utf8');
  const printStart = previewCss.indexOf('@media print');
  const pageRuleStart = previewCss.indexOf('@page', printStart);
  const printCss = printStart >= 0 && pageRuleStart > printStart
    ? previewCss.slice(printStart, pageRuleStart)
    : '';
  const appPrintStart = appCss.indexOf('@media print');
  const appPrintCss = appPrintStart >= 0 ? appCss.slice(appPrintStart) : '';

  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?position:\s*static !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?width:\s*var\(--resume-print-content-width\) !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?height:\s*auto !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?-webkit-transform:\s*none !important/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?width:\s*var\(--resume-print-content-width\)/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?-webkit-filter:\s*none !important/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?-webkit-transform:\s*none !important/);
  assert.match(previewCss, /@page\s*\{\s*size:\s*letter;\s*margin:\s*0\.5in;/);
  assert.match(appPrintCss, /\.app::before\s*\{[\s\S]*?display:\s*none !important/);
  assert.match(appPrintCss, /\.sectionAddDialogLayer,\s*\.resumePillOverlay,\s*\.tabButtonOverlay,\s*\.previewDragOverlayFrame,\s*\.mobileWorkspaceToggle/);
  assert.match(appPrintCss, /\.appShell\s*\{[\s\S]*?width:\s*auto/);
  assert.match(appPrintCss, /\.workspace\s*\{[\s\S]*?max-width:\s*none/);
  assert.match(appPrintCss, /html,\s*body,\s*#root,\s*\.app\s*\{[\s\S]*?-webkit-text-size-adjust:\s*100% !important/);
  assert.match(appPrintCss, /html,\s*body\s*\{[\s\S]*?font-size:\s*16px !important/);
  assert.match(appPrintCss, /\.workspaceColumnPreview,\s*\.previewPanel,\s*\.previewFrame\s*\{[\s\S]*?width:\s*auto/);
  assert.match(builderHook, /window\.addEventListener\('beforeprint', handleBeforePrint\)/);
  assert.match(builderHook, /function preparePrintView\(\)\s*\{[\s\S]*?setMobileView\('preview'\)/);
  assert.match(previewComponent, /className="previewPageViewport" style=\{presentationVars\}/);
  assert.match(previewComponent, /useResumePrintPageRule\(printPageRule\)/);
  assert.match(previewLayoutHook, /useLayoutEffect\(\(\) => \{\s*if \(typeof document === 'undefined'\)/);
  assert.match(previewLayoutHook, /document\.head\.appendChild\(styleElement\)/);
  assert.doesNotMatch(previewComponent, /<style media="print">/);
});

test('empty sample content is replaced with the real preview model before print', () => {
  const appComponent = fs.readFileSync('src/App.jsx', 'utf8');

  assert.match(appComponent, /const displayPreviewModel = isPrintRendering \? previewModel : \(samplePreviewModel \|\| previewModel\)/);
  assert.match(appComponent, /window\.addEventListener\('beforeprint', preparePrintPreview\)/);
  assert.match(appComponent, /flushSync\(\(\) => setIsPrintRendering\(true\)\)/);
});

test('below-heading section separators render on the final visible section', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');
  const previewSortables = fs.readFileSync('src/components/resumePreviewSortables.jsx', 'utf8');

  assert.match(previewComponent, /const showSeparator = sectionSeparatorPosition === 'belowSectionName'\s*\?\s*true\s*:\s*index < visibleSectionBlocks\.length - 1/);
  assert.match(previewSortables, /separatorPosition === 'belowSectionName'\s*\?\s*renderSectionSeparatorControl/);
  assert.match(previewCss, /\.resumeSection:not\(\.resumeSection--separatorBelowHeading\):last-child > \.sectionSeparatorControl/);
  assert.match(previewCss, /\.resumeSection:not\(\.resumeSection--separatorBelowHeading\)\.resumeSection--lastVisible > \.sectionSeparatorControl/);
});

test('preview page break helper uses printable height for raw markers', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 2200,
    printableHeight: 900,
  }), [900, 1800]);
});

test('preview page break helper moves marker before fitting cut-through entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 884, bottom: 980, priority: 2 },
    ],
  }), [884]);
});

test('preview page break helper does not jump to the top of long entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 760, bottom: 980, priority: 2 },
    ],
  }), [900]);
});

test('preview page break helper can snap first section entries farther', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 780, bottom: 980, priority: 2, snapDistance: 144 },
    ],
  }), [780]);
});

test('preview page break helper does not move marker above oversized sections', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1800,
    printableHeight: 900,
    breakCandidates: [
      { top: 200, bottom: 1300, priority: 1 },
    ],
  }), [900]);
});

test('preview page break helper falls back to bullet candidates for oversized entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1600,
    printableHeight: 900,
    breakCandidates: [
      { top: 300, bottom: 1250, priority: 2 },
      { top: 884, bottom: 930, priority: 3 },
    ],
  }), [884]);
});

test('preview page break helper keeps raw marker when no clean candidate is valid', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1100,
    printableHeight: 900,
    breakCandidates: [
      { top: 920, bottom: 1020, priority: 2 },
    ],
  }), [900]);
});

test('preview page markers measure rendered content instead of fixed page scroll height', () => {
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');
  const previewGeometry = fs.readFileSync('src/components/resumePreviewGeometry.js', 'utf8');
  const previewLayoutHook = fs.readFileSync('src/components/useResumePreviewLayout.js', 'utf8');
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');

  assert.match(previewGeometry, /export function measurePreviewContentFlowHeight/);
  assert.match(previewComponent, /useResumePreviewPageMetrics\(/);
  assert.match(previewLayoutHook, /measurePreviewContentFlowHeight\(/);
  assert.match(previewComponent, /data-preview-page-content="true"/);
  assert.doesNotMatch(
    `${previewComponent}\n${previewGeometry}\n${previewLayoutHook}`,
    /Math\.max\(printableHeight,\s*resumeElement\.scrollHeight - paddingTop - paddingBottom\)/,
  );
  assert.match(previewCss, /\.resumePageContent\s*\{/);
});
