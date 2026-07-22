import { trimText } from '../../src/lib/text.js';
import {
  isLikelyDegreeLine,
  isLikelyInstitutionLine,
} from './educationCompiler.js';
import { isLikelyHeadlineLine } from './personal.js';
import { normalizeExtractedResumeText } from './fileText.js';
import {
  countRoleEntriesInSourceLines,
  isLikelyRoleEntryLine,
} from './roleCompiler.js';
import {
  isLikelyStandaloneRoleLine,
  splitTrailingLocationFromTitleText,
} from './roleLineParser.js';
import { countAwardsInSourceLines } from './sectionCompilers.js';
import {
  getSourceSectionHeaderInfo,
  isContactLinkGroupingLabel,
  isKnownSourceSectionHeader,
  shouldTreatAsContactGroupingLabel,
  slugifyImportId,
} from './sectionHeadings.js';
import {
  hasDateSignal,
  isDateOnlyLine,
  isLikelyLocationText,
  isLikelyPersonalContactLine,
  isLikelySourceBullet,
  isLikelyUrlText,
  isResumeContactLine,
} from './sourceSignals.js';

function getLetterCaseRatio(line) {
  const letters = Array.from(line).filter((character) => /\p{L}/u.test(character));

  if (letters.length === 0) {
    return 0;
  }

  return letters.filter((character) => character === character.toUpperCase()).length / letters.length;
}

export function classifySourceSectionKind(title, lines) {
  const text = `${title}\n${(Array.isArray(lines) ? lines : []).join('\n')}`;
  const titleText = trimText(title);

  if (/^(?:summary|profile|objective)$/i.test(titleText)) {
    return 'summary';
  }

  if (/^references?$/i.test(titleText)) {
    return 'custom';
  }

  if (/^additional information$/i.test(titleText)) {
    return 'skills';
  }

  if (/^(?:relevant\s+)?coursework$/i.test(titleText)) {
    return 'education-detail';
  }

  if (/\beducation\b/i.test(titleText)) {
    return 'education';
  }

  if (/\b(?:honors?|awards?|scholarships?|distinctions?)\b/i.test(titleText)) {
    return 'awards';
  }

  if (/\b(?:publications?|invited talks?|conferences?|patents?)\b/i.test(titleText)) {
    return 'publications';
  }

  if (/\bprojects?\b/i.test(titleText)) {
    return 'projects';
  }

  if (/\b(?:experience|employment|work|internship|leadership|volunteer|service|involvement|research|teaching|advising|industry|military|clinical|public service)\b/i.test(titleText)) {
    return 'roles';
  }

  if (countRoleEntriesInSourceLines(Array.isArray(lines) ? lines : []) >= 2) {
    return 'roles';
  }

  if (/\b(?:education|university|college|school|degree|bachelor|master|ph\.?d|doctorate|gpa|coursework)\b/i.test(text)) {
    return 'education';
  }

  if (/\b(?:skills?|toolkit|technologies|competencies)\b/i.test(titleText)) {
    return 'skills';
  }

  if (/\b(?:certifications?|licenses?)\b/i.test(titleText)) {
    return 'certifications';
  }

  if (/^(?:languages?|language skills|language proficiency)$/i.test(titleText)) {
    return 'languages';
  }

  return 'custom';
}

function isLikelyGenericSourceSectionHeader(line, { index = 0, seenContact = false } = {}) {
  const text = trimText(line);

  if (
    !text ||
    isContactLinkGroupingLabel(text) ||
    isLikelySourceBullet(text) ||
    isResumeContactLine(text) ||
    hasDateSignal(text) ||
    isLikelyDegreeLine(text) ||
    text.length > 70
  ) {
    return false;
  }

  const words = text.split(/\s+/g).filter(Boolean);

  if (words.length > 7) {
    return false;
  }

  if (splitTrailingLocationFromTitleText(text, { preferShortCity: true }).location) {
    return false;
  }

  const hasSectionKeyword = /\b(?:experience|employment|education|coursework|skills?|toolkit|technologies|projects?|portfolio|certifications?|licenses?|languages?|awards|honors?|publications?|research|teaching|advising|industry|volunteer|service|community|engagement|activities|involvement|affiliations?|memberships?|summary|profile|objective|interests?|highlights|accomplishments?|conferences?|patents?|references?)\b/i.test(text);
  const isMostlyUppercase = getLetterCaseRatio(text) >= 0.76 && words.length <= 6;
  const isTitleLike = !/[,|:]/.test(text) && text.length <= 42;

  if (hasSectionKeyword) {
    return isMostlyUppercase || (isTitleLike && (seenContact || index > 2));
  }

  return (seenContact || index > 3) && isMostlyUppercase && words.length >= 1;
}

function getSourceDocumentHeaderInfo(line, context = {}) {
  const knownHeader = getSourceSectionHeaderInfo(line);

  if (knownHeader) {
    return knownHeader;
  }

  if (!isLikelyGenericSourceSectionHeader(line, context)) {
    return null;
  }

  return {
    title: trimText(line),
    kind: classifySourceSectionKind(line, []),
    roleType: '',
  };
}

function isLikelyWrappedSourceContinuation(previousLine, line) {
  const previous = trimText(previousLine);
  const text = trimText(line);

  if (
    !previous ||
    !text ||
    isContactLinkGroupingLabel(previous) ||
    isContactLinkGroupingLabel(text) ||
    isLikelySourceBullet(text) ||
    isResumeContactLine(text) ||
    isLikelyUrlText(text) ||
    isKnownSourceSectionHeader(text)
  ) {
    return false;
  }

  if (isLikelySourceBullet(previous)) {
    return (
      (/^[a-z(]/u.test(text) || /[,;:&]$/.test(previous) || !/[.!?]$/.test(previous)) &&
      !hasDateSignal(text) &&
      !isLikelyRoleEntryLine(text) &&
      !isLikelyInstitutionLine(text) &&
      !isKnownSourceSectionHeader(text)
    );
  }

  if (isLikelyGenericSourceSectionHeader(text, { seenContact: true }) || isLikelyRoleEntryLine(text)) {
    return false;
  }

  return (
    isLikelySourceBullet(previous) ||
    /[,;:&]$/.test(previous) ||
    (/^[a-z(]/.test(text) && !/[.!?]$/.test(previous))
  );
}

function mergeWrappedSourceLines(lines) {
  const mergedLines = [];

  lines.forEach((line) => {
    const text = trimText(line);

    if (!text) {
      return;
    }

    const previousIndex = mergedLines.length - 1;
    const previousLine = mergedLines[previousIndex];

    if (previousLine && isLikelyWrappedSourceContinuation(previousLine, text)) {
      mergedLines[previousIndex] = `${previousLine} ${text}`.replace(/\s{2,}/g, ' ');
      return;
    }

    mergedLines.push(text);
  });

  return mergedLines;
}

function splitInlineSourceSectionHeadingLines(lines) {
  const expandedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const text = trimText(lines[index]);
    const nextText = trimText(lines[index + 1] || '');

    if (!text) {
      continue;
    }

    if (isLikelySourcePageHeader(text)) {
      continue;
    }

    if (/^Research\s+My\s+broad\s+research\s+interests?\s+are:?$/i.test(text)) {
      continue;
    }

    const pairedExperienceMatch = text.match(/^(Research|Teaching|Advising|Industry)\s+(.+)$/i);
    const pairedExperienceNextMatch = nextText.match(/^Experience\s+(.+)$/i);

    if (pairedExperienceMatch && pairedExperienceNextMatch) {
      const pairedTitle = trimText(pairedExperienceMatch[1]).replace(/^./, (character) => character.toUpperCase());
      expandedLines.push(`${pairedTitle} Experience`);
      expandedLines.push(trimText(pairedExperienceMatch[2]));
      expandedLines.push(trimText(pairedExperienceNextMatch[1]));
      index += 1;
      continue;
    }

    const pairedHeadingPatterns = [
      {
        first: /^Leadership\s+(.+)$/i,
        second: /^Experience\s+(.+)$/i,
        title: 'Leadership Experience',
      },
      {
        first: /^Work\s+(.+)$/i,
        second: /^Experience\s+(.+)$/i,
        title: 'Work Experience',
      },
      {
        first: /^Activities\s+(.+)$/i,
        second: /^(?:&|and|\+)\s*Awards\s+(.+)$/i,
        title: 'Activities & Awards',
      },
      {
        first: /^Awards\s*(?:&|and|\+)\s+(.+)$/i,
        second: /^Interests?\s+(.+)$/i,
        title: 'Awards & Interests',
      },
    ];
    const pairedMatch = pairedHeadingPatterns
      .map((pattern) => ({
        title: pattern.title,
        firstMatch: text.match(pattern.first),
        secondMatch: nextText.match(pattern.second),
      }))
      .find((match) => match.firstMatch && match.secondMatch);

    if (pairedMatch) {
      expandedLines.push(pairedMatch.title);
      expandedLines.push(trimText(pairedMatch.firstMatch[1]));
      expandedLines.push(trimText(pairedMatch.secondMatch[1]));
      index += 1;
      continue;
    }

    const singleHeadingMatch = text.match(/^(Invited\s+talks?|Conferences?|Patents?|References?|Education|Experience|Leadership|Skills|Projects|Certifications?|Languages?|Awards(?:\s*(?:&|and|\+)\s*Interests?)?|Interests?|Publications?)\s+(.+)$/i);

    if (singleHeadingMatch) {
      if (/^(?:&|and|\+)/i.test(trimText(singleHeadingMatch[2]))) {
        expandedLines.push(text);
        continue;
      }

      if (/^Research$/i.test(singleHeadingMatch[1]) && /^My\s+broad\s+research\s+interests?\s+are:?$/i.test(trimText(singleHeadingMatch[2]))) {
        continue;
      }

      expandedLines.push(singleHeadingMatch[1]);
      expandedLines.push(trimText(singleHeadingMatch[2]));
      continue;
    }

    expandedLines.push(text);
  }

  return expandedLines;
}

function isLikelySourcePageHeader(line) {
  const text = trimText(line);

  return (
    text.length <= 80 &&
    /^.+\s+\d+\s*\/\s*\d+$/.test(text) &&
    !isLikelySourceBullet(text) &&
    !isResumeContactLine(text)
  );
}

function splitTrailingNameFromSkillLine(line) {
  const text = trimText(line);
  const match = text.match(/^(.+?)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})$/);

  if (!match) {
    return null;
  }

  let prefix = trimText(match[1]);
  let candidateName = trimText(match[2]);
  const candidateWords = candidateName.split(/\s+/g).filter(Boolean);

  if (
    candidateWords.length === 4 &&
    /^(?:student|engineer|developer|designer|researcher|analyst|manager|consultant|architect)$/i.test(candidateWords[1])
  ) {
    prefix = `${prefix} ${candidateWords[0]}`;
    candidateName = candidateWords.slice(1).join(' ');
  }

  if (
    !prefix ||
    !candidateName ||
    !/\b(?:using|with|model(?:ing)?|calculations?|software|tools?|exam|certifications?|training|skills?)\b/i.test(prefix) ||
    !isLikelyHeadlineLine(candidateName) ||
    isLikelyLocationText(candidateName) ||
    hasDateSignal(candidateName)
  ) {
    return null;
  }

  return {
    line: prefix,
    name: candidateName,
  };
}

export function normalizeSourceDocument(sourceDocument) {
  const source = sourceDocument && typeof sourceDocument === 'object' ? sourceDocument : {};
  const usedIds = new Set();
  const personalLines = Array.isArray(source.personalLines)
    ? source.personalLines.map(trimText).filter(Boolean)
    : [];
  const sections = (Array.isArray(source.sections) ? source.sections : [])
    .map((section, index) => {
      const title = trimText(section?.title) || `Imported Section ${index + 1}`;
      const rawId = trimText(section?.id) || `source-${slugifyImportId(title)}-${index + 1}`;
      let id = rawId;
      let duplicateIndex = 2;

      while (usedIds.has(id)) {
        id = `${rawId}-${duplicateIndex}`;
        duplicateIndex += 1;
      }

      usedIds.add(id);

      return {
        id,
        title,
        lines: Array.isArray(section?.lines)
          ? section.lines.map(trimText).filter(Boolean)
          : [],
      };
    })
    .filter((section) => section.title || section.lines.length > 0);

  return {
    hasSourceText: personalLines.length > 0 || sections.some((section) => section.lines.length > 0),
    personalLines,
    sections,
  };
}

export function createSourceDocumentFromText(text) {
  const normalizedText = normalizeExtractedResumeText(text);
  const lines = mergeWrappedSourceLines(
    splitInlineSourceSectionHeadingLines(normalizedText
      .split(/\n+/g)
      .map(trimText)
      .filter(Boolean))
  );
  const personalLines = [];
  const sections = [];
  let currentSection = null;
  let seenContact = false;
  let contactGroupActive = false;

  lines.forEach((line, index) => {
    const nextLine = lines[index + 1] || '';

    if (shouldTreatAsContactGroupingLabel(line, nextLine)) {
      contactGroupActive = true;
      return;
    }

    if (contactGroupActive && isLikelyPersonalContactLine(line)) {
      personalLines.push(line);
      seenContact = true;
      return;
    }

    if (isResumeContactLine(line)) {
      seenContact = true;
    }

    if (
      currentSection &&
      classifySourceSectionKind(currentSection.title, currentSection.lines) === 'roles' &&
      isLikelyStandaloneRoleLine(line) &&
      (isLikelySourceBullet(nextLine) || currentSection.lines.length > 0)
    ) {
      contactGroupActive = false;
      currentSection.lines.push(line);
      return;
    }

    const headerInfo = getSourceDocumentHeaderInfo(line, { index, seenContact });

    if (headerInfo) {
      contactGroupActive = false;
      const id = `source-${slugifyImportId(headerInfo.title)}-${sections.length + 1}`;
      currentSection = {
        id,
        title: headerInfo.title,
        lines: [],
      };
      sections.push(currentSection);
      return;
    }

    if (currentSection) {
      contactGroupActive = false;
      currentSection.lines.push(line);
    } else {
      personalLines.push(line);
    }
  });

  const trailingSection = sections[sections.length - 1];

  if (
    trailingSection &&
    trailingSection.lines.length > 0 &&
    trailingSection.lines.every((line) => isLikelyPersonalContactLine(line) && !isLikelySourceBullet(line)) &&
    isLikelyHeadlineLine(trailingSection.title)
  ) {
    sections.pop();
    personalLines.unshift(trailingSection.title, ...trailingSection.lines);
  }

  const finalSection = sections[sections.length - 1];
  const finalLine = trimText(finalSection?.lines?.[finalSection.lines.length - 1] || '');
  const trailingNameFromSkillLine = /(?:skills?|certifications?|licenses?)/i.test(finalSection?.title || '')
    ? splitTrailingNameFromSkillLine(finalLine)
    : null;

  if (finalSection && trailingNameFromSkillLine) {
    finalSection.lines = [
      ...finalSection.lines.slice(0, -1),
      trailingNameFromSkillLine.line,
    ];
    personalLines.unshift(trailingNameFromSkillLine.name);
  }

  if (
    finalSection &&
    personalLines.some(isLikelyPersonalContactLine) &&
    /(?:skills?|certifications?|licenses?)/i.test(finalSection.title) &&
    finalSection.lines.length > 1 &&
    finalLine &&
    !isLikelySourceBullet(finalLine) &&
    !isDateOnlyLine(finalLine) &&
    !/[,:;|]/.test(finalLine) &&
    isLikelyHeadlineLine(finalLine)
  ) {
    finalSection.lines = finalSection.lines.slice(0, -1);
    personalLines.unshift(finalLine);
  }

  if (sections.length === 0 && lines.length > 0) {
    return normalizeSourceDocument({
      personalLines: lines.slice(0, 4),
      sections: [{
        id: 'source-imported-resume-1',
        title: 'Imported Resume',
        lines: lines.slice(4),
      }],
    });
  }

  return normalizeSourceDocument({ personalLines, sections });
}

export function summarizeSourceDocument(sourceDocument) {
  const normalizedDocument = normalizeSourceDocument(sourceDocument);

  return {
    hasSourceText: normalizedDocument.hasSourceText,
    personalLineCount: normalizedDocument.personalLines.length,
    sections: normalizedDocument.sections.map((section) => ({
      sourceSectionId: section.id,
      title: section.title,
      lineCount: section.lines.length,
      bulletCount: section.lines.filter(isLikelySourceBullet).length,
      roleEntryCount: countRoleEntriesInSourceLines(section.lines),
    })),
  };
}

export function shouldUseVisualPdfFallbackForSourceText(text, sourceDocument) {
  const normalizedDocument = normalizeSourceDocument(sourceDocument);
  const normalizedText = normalizeExtractedResumeText(text);
  const lines = normalizedText.split(/\n+/g).map(trimText).filter(Boolean);
  const hasContactSignals = lines.some(isLikelyPersonalContactLine);
  const zeroLineSectionCount = normalizedDocument.sections.filter((section) => section.lines.length === 0).length;
  const emptyGenericSectionCount = normalizedDocument.sections.filter((section) => (
    section.lines.length === 0 &&
    !isKnownSourceSectionHeader(section.title)
  )).length;

  return (
    (hasContactSignals && normalizedDocument.personalLines.length === 0) ||
    zeroLineSectionCount >= 2 ||
    emptyGenericSectionCount >= 1
  );
}

export function createSourceDocumentCoverage(sourceDocument) {
  const normalizedDocument = normalizeSourceDocument(sourceDocument);
  const blocks = [];
  let lastEducationBlock = null;

  normalizedDocument.sections.forEach((section) => {
    const kind = classifySourceSectionKind(section.title, section.lines);
    const text = section.lines.join('\n');

    if (kind === 'summary') {
      return;
    }

    if (kind === 'education-detail') {
      if (lastEducationBlock) {
        lastEducationBlock.hasCoursework = lastEducationBlock.hasCoursework || section.lines.some((line) => trimText(line) !== '');
      }

      return;
    }

    const block = {
      id: section.id,
      title: section.title,
      kind,
      bulletCount: section.lines.filter(isLikelySourceBullet).length,
      roleEntryCount: kind === 'roles' ? countRoleEntriesInSourceLines(section.lines) : 0,
      awardCount: kind === 'awards' ? countAwardsInSourceLines(section.lines) : 0,
      hasGpa: /\bGPA\b\s*:?\s*\d/i.test(text),
      hasCoursework: false,
    };

    blocks.push(block);

    if (kind === 'education') {
      lastEducationBlock = block;
    }
  });

  return {
    hasSourceText: normalizedDocument.hasSourceText,
    blocks,
    bulletCount: blocks.reduce((count, block) => count + block.bulletCount, 0),
    awardCount: blocks.reduce((count, block) => count + block.awardCount, 0),
    hasGpa: blocks.some((block) => block.hasGpa),
    hasCoursework: blocks.some((block) => block.hasCoursework),
    sections: {
      education: blocks.some((block) => block.kind === 'education'),
      roles: blocks.some((block) => block.kind === 'roles'),
      awards: blocks.some((block) => block.kind === 'awards'),
    },
  };
}

export function sourceDocumentToText(sourceDocument) {
  const normalizedDocument = normalizeSourceDocument(sourceDocument);

  return [
    ...normalizedDocument.personalLines,
    ...normalizedDocument.sections.flatMap((section) => [
      section.title,
      ...section.lines,
    ]),
  ].join('\n');
}
