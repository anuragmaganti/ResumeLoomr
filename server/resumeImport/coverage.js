import { normalizeDraftPayload } from '../../src/lib/resume.js';
import { getPreviewModel } from '../../src/lib/resumePreviewModel.js';
import { trimText } from '../../src/lib/text.js';
import { isLikelyStandaloneRoleLine } from './roleLineParser.js';
import { normalizeComparisonKey } from './text.js';

function countDelimitedDetails(value) {
  return trimText(value)
    .split(/\n|,|;/g)
    .map(trimText)
    .filter(Boolean)
    .length;
}

function getImportedListItemText(item) {
  return trimText(typeof item === 'object' && item !== null ? item.text : item);
}

function countDraftListItems(entries, field) {
  return entries.reduce((count, entry) => (
    count + (Array.isArray(entry?.[field]) ? entry[field].filter((item) => getImportedListItemText(item) !== '').length : 0)
  ), 0);
}

function analyzeImportedDraftCoverage(draft) {
  const normalized = normalizeDraftPayload(draft);
  const previewModel = getPreviewModel(normalized.resume);
  const sectionBlocks = previewModel.sectionBlocks;
  const educationBlocks = sectionBlocks.filter((section) => section.kind === 'education');
  const roleBlocks = sectionBlocks.filter((section) => section.kind === 'roles');
  const projectBlocks = sectionBlocks.filter((section) => section.kind === 'projects');
  const skillBlocks = sectionBlocks.filter((section) => section.kind === 'skills');
  const customBlocks = sectionBlocks.filter((section) => section.kind === 'custom');
  const awardBlocks = sectionBlocks.filter((section) => section.kind === 'awards');
  const educationCustomDetailCount = educationBlocks.reduce((count, section) => (
    count + section.entries.reduce((entryCount, entry) => (
      entryCount + entry.customSections.filter((customSection) => trimText(customSection.content) !== '').length
    ), 0)
  ), 0);
  const educationAwardCount = educationBlocks.reduce((count, section) => (
    count + section.entries.reduce((entryCount, entry) => entryCount + countDelimitedDetails(entry.awards), 0)
  ), 0);
  const roleDetailCount = roleBlocks.reduce((count, section) => count + countDraftListItems(section.entries, 'activities'), 0);
  const projectDetailCount = projectBlocks.reduce((count, section) => count + countDraftListItems(section.entries, 'highlights'), 0);
  const skillDetailCount = skillBlocks.reduce((count, section) => (
    count + section.entries.reduce((entryCount, entry) => (
      entryCount + trimText(entry.items).split(/[,;•]/g).map(trimText).filter(Boolean).length
    ), 0)
  ), 0);
  const customDetailCount = customBlocks.reduce((count, section) => count + countDraftListItems(section.entries, 'highlights'), 0);
  const topLevelAwardCount = awardBlocks.reduce((count, section) => (
    count + section.entries.filter((entry) => (
      [entry.title, entry.issuer, entry.years, entry.details].some((value) => trimText(value) !== '')
    )).length
  ), 0);

  return {
    bulletLikeDetailCount: educationCustomDetailCount + roleDetailCount + projectDetailCount + skillDetailCount + customDetailCount,
    awardCount: topLevelAwardCount + educationAwardCount,
    hasGpa: educationBlocks.some((section) => section.entries.some((entry) => trimText(entry.gpa) !== '')),
    hasCoursework: educationBlocks.some((section) => section.entries.some((entry) => trimText(entry.coursework) !== '')),
    sections: {
      education: educationBlocks.length > 0,
      roles: roleBlocks.length > 0,
      awards: topLevelAwardCount + educationAwardCount > 0,
    },
  };
}

function getImportedSectionBlocks(draft) {
  const normalized = normalizeDraftPayload(draft);
  return getPreviewModel(normalized.resume).sectionBlocks;
}

function countImportedEducationDetails(block) {
  return block.entries.reduce((count, entry) => (
    count +
    entry.customSections.filter((section) => trimText(section.content) !== '').length +
    (trimText(entry.coursework) ? 1 : 0) +
    (trimText(entry.gpa) ? 1 : 0)
  ), 0);
}

function countImportedBlockDetails(block) {
  if (block.kind === 'roles') {
    return countDraftListItems(block.entries, 'activities');
  }

  if (block.kind === 'education') {
    return countImportedEducationDetails(block);
  }

  if (block.kind === 'projects' || block.kind === 'custom') {
    return countDraftListItems(block.entries, 'highlights');
  }

  if (block.kind === 'skills') {
    return block.entries.reduce((count, entry) => (
      count + trimText(entry.items).split(/[,;•]/g).map(trimText).filter(Boolean).length
    ), 0);
  }

  if (block.kind === 'certifications' || block.kind === 'languages' || block.kind === 'publications') {
    return block.entries.filter((entry) => (
      Object.values(entry).some((value) => typeof value === 'string' && trimText(value) !== '')
    )).length;
  }

  return 0;
}

function countImportedAwardEntries(block) {
  if (block.kind !== 'awards') {
    return 0;
  }

  return block.entries.filter((entry) => (
    [entry.title, entry.issuer, entry.years, entry.details].some((value) => trimText(value) !== '')
  )).length;
}

function countImportedRoleEntries(block) {
  if (block.kind !== 'roles') {
    return 0;
  }

  return block.entries.filter((entry) => (
    [entry.company, entry.role, entry.location, entry.yearsExp].some((value) => trimText(value) !== '') ||
    entry.activities.some((activity) => getImportedListItemText(activity) !== '')
  )).length;
}

function importedRoleBlockHasMergedEntries(block) {
  if (block.kind !== 'roles') {
    return false;
  }

  return block.entries.some((entry) => (
    [entry.company, entry.location, entry.yearsExp].some((value) => /;\s*\S/.test(trimText(value)))
  ));
}

function importedRoleBlockHasRoleLikeFirstActivity(block) {
  if (block.kind !== 'roles') {
    return false;
  }

  return block.entries.some((entry) => (
    !trimText(entry.role) &&
    Array.isArray(entry.activities) &&
    isLikelyStandaloneRoleLine(getImportedListItemText(entry.activities[0] || ''))
  ));
}

function importedAwardBlockHasMergedEntries(block) {
  if (block.kind !== 'awards') {
    return false;
  }

  return block.entries.some((entry) => (
    [entry.title, entry.issuer, entry.years].some((value) => /;\s*\S/.test(trimText(value)))
  ));
}

function findImportedBlockForSource(importedBlocks, sourceBlock) {
  const sourceTitleKey = normalizeComparisonKey(sourceBlock.title);

  return importedBlocks.find((block) => (
    block.kind === sourceBlock.kind &&
    normalizeComparisonKey(block.title) === sourceTitleKey
  ));
}

function validateImportedDraftAgainstSourceCoverage(draft, sourceCoverage) {
  if (!sourceCoverage?.hasSourceText || !Array.isArray(sourceCoverage.blocks) || sourceCoverage.blocks.length === 0) {
    return [];
  }

  const importedBlocks = getImportedSectionBlocks(draft);
  const issues = [];
  const titleCounts = new Map();

  importedBlocks.forEach((block) => {
    const titleKey = normalizeComparisonKey(block.title);

    if (!titleKey) {
      return;
    }

    titleCounts.set(titleKey, (titleCounts.get(titleKey) || 0) + 1);
  });

  for (const [titleKey, count] of titleCounts.entries()) {
    if (count > 1) {
      issues.push(`Duplicate "${titleKey}" section headings were imported.`);
    }
  }

  let lastMatchedIndex = -1;

  sourceCoverage.blocks.forEach((sourceBlock) => {
    const importedBlockIndex = importedBlocks.findIndex((block) => block === findImportedBlockForSource(importedBlocks, sourceBlock));
    const importedBlock = importedBlockIndex >= 0 ? importedBlocks[importedBlockIndex] : null;

    if (!importedBlock) {
      issues.push(`${sourceBlock.title} section was detected in the source but not imported as its own section.`);
      return;
    }

    if (importedBlockIndex < lastMatchedIndex) {
      issues.push(`${sourceBlock.title} was imported out of source order.`);
    }

    lastMatchedIndex = Math.max(lastMatchedIndex, importedBlockIndex);

    if (sourceBlock.bulletCount >= 2) {
      const importedDetailCount = countImportedBlockDetails(importedBlock);
      const requiredDetailCount = Math.ceil(sourceBlock.bulletCount * 0.9);

      if (importedDetailCount < requiredDetailCount) {
        issues.push(`${sourceBlock.title} imported ${importedDetailCount} of ${sourceBlock.bulletCount} source bullets/details.`);
      }
    }

    if (sourceBlock.roleEntryCount >= 2) {
      const importedRoleEntryCount = countImportedRoleEntries(importedBlock);

      if (importedRoleEntryCount < sourceBlock.roleEntryCount) {
        issues.push(`${sourceBlock.title} imported ${importedRoleEntryCount} of ${sourceBlock.roleEntryCount} source entries.`);
      }

      if (importedRoleBlockHasMergedEntries(importedBlock)) {
        issues.push(`${sourceBlock.title} merged multiple roles into one semicolon-delimited entry.`);
      }

      if (importedRoleBlockHasRoleLikeFirstActivity(importedBlock)) {
        issues.push(`${sourceBlock.title} imported a role title as a bullet instead of the role field.`);
      }
    }

    if (sourceBlock.awardCount >= 2) {
      const importedAwardCount = countImportedAwardEntries(importedBlock);

      if (importedAwardCount < sourceBlock.awardCount) {
        issues.push(`${sourceBlock.title} imported ${importedAwardCount} of ${sourceBlock.awardCount} source awards.`);
      }

      if (importedAwardBlockHasMergedEntries(importedBlock)) {
        issues.push(`${sourceBlock.title} merged multiple awards into one semicolon-delimited entry.`);
      }
    }
  });

  return issues;
}

export function validateImportedDraftCoverage(draft, sourceCoverage) {
  if (!sourceCoverage?.hasSourceText) {
    return { ok: true, issues: [] };
  }

  const importedCoverage = analyzeImportedDraftCoverage(draft);
  const issues = [];

  if (sourceCoverage.sections.education && !importedCoverage.sections.education) {
    issues.push('Education section was detected in the source but not imported.');
  }

  if (sourceCoverage.sections.roles && !importedCoverage.sections.roles) {
    issues.push('Role sections were detected in the source but not imported.');
  }

  if (sourceCoverage.sections.awards && !importedCoverage.sections.awards) {
    issues.push('Honors and awards were detected in the source but not imported.');
  }

  if (sourceCoverage.hasGpa && !importedCoverage.hasGpa) {
    issues.push('GPA was detected in the source but not imported.');
  }

  if (sourceCoverage.hasCoursework && !importedCoverage.hasCoursework) {
    issues.push('Relevant coursework was detected in the source but not imported.');
  }

  const requiredDetailCount = Math.ceil(sourceCoverage.bulletCount * 0.9);

  if (sourceCoverage.bulletCount >= 4 && importedCoverage.bulletLikeDetailCount < requiredDetailCount) {
    issues.push(`Only ${importedCoverage.bulletLikeDetailCount} of ${sourceCoverage.bulletCount} source bullets/details were imported.`);
  }

  if (sourceCoverage.awardCount >= 2 && importedCoverage.awardCount < sourceCoverage.awardCount) {
    issues.push(`Only ${importedCoverage.awardCount} of ${sourceCoverage.awardCount} awards were imported.`);
  }

  issues.push(...validateImportedDraftAgainstSourceCoverage(draft, sourceCoverage));

  return {
    ok: issues.length === 0,
    issues: Array.from(new Set(issues)),
  };
}
