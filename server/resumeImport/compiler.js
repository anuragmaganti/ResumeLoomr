import { normalizeDraftPayload } from '../../src/lib/resume.js';
import { trimText } from '../../src/lib/text.js';
import { sanitizeWorkspaceResumeName } from '../../src/lib/workspace.js';
import { IMPORT_SECTION_KINDS } from './constants.js';
import { compileEducationEntries } from './educationCompiler.js';
import {
  detectPersonalFromSourceLines,
  mergeMappedPersonal,
} from './personal.js';
import { compileRoleEntries } from './roleCompiler.js';
import { slugifyImportId } from './sectionHeadings.js';
import {
  compileAwardEntries,
  compileCertificationEntries,
  compileCustomEntries,
  compileLanguageEntries,
  compileProjectLikeEntries,
  compilePublicationEntries,
  compileSkillsEntries,
} from './sectionCompilers.js';
import {
  classifySourceSectionKind,
  normalizeSourceDocument,
} from './sourceDocument.js';
import { mergeUniqueText } from './text.js';

function getSourceMappingById(sourceMapping) {
  const mappings = new Map();

  (Array.isArray(sourceMapping?.sections) ? sourceMapping.sections : []).forEach((section) => {
    mappings.set(section.sourceSectionId, section);
  });

  return mappings;
}

function compileSourceSectionBlock(section, mapping, attachedCourseworkSections) {
  const mappedKind = IMPORT_SECTION_KINDS.includes(mapping?.kind) ? mapping.kind : '';
  const detectedKind = classifySourceSectionKind(section.title, section.lines);
  const kind = detectedKind === 'custom'
    ? (mappedKind || 'custom')
    : (detectedKind === 'education-detail' ? (mappedKind || 'custom') : detectedKind);
  const title = section.title || trimText(mapping?.title);
  const block = {
    id: `${kind}-${slugifyImportId(title)}-${section.id.replace(/^source-/, '')}`,
    kind,
    title,
    entries: [],
  };

  if (kind === 'education') {
    block.entries = compileEducationEntries(section, attachedCourseworkSections);
  } else if (kind === 'roles') {
    block.entries = compileRoleEntries({ ...section, title });
  } else if (kind === 'skills') {
    block.entries = compileSkillsEntries(section);
  } else if (kind === 'projects') {
    block.entries = compileProjectLikeEntries(section);
  } else if (kind === 'certifications') {
    block.entries = compileCertificationEntries(section);
  } else if (kind === 'languages') {
    block.entries = compileLanguageEntries(section);
  } else if (kind === 'awards') {
    block.entries = compileAwardEntries(section);
  } else if (kind === 'publications') {
    block.entries = compilePublicationEntries(section);
  } else {
    block.entries = compileCustomEntries({ ...section, title });
  }

  if (block.entries.length === 0) {
    block.kind = 'custom';
    block.entries = compileCustomEntries({ ...section, title });
  }

  return block;
}

export function compileSourceDocumentToImportedDraft(sourceDocument, sourceMapping = null, { sourceFileName = '' } = {}) {
  const normalizedDocument = normalizeSourceDocument(sourceDocument);
  const mappingById = getSourceMappingById(sourceMapping);
  const detectedPersonal = detectPersonalFromSourceLines(normalizedDocument.personalLines);
  let personal = mergeMappedPersonal(detectedPersonal, sourceMapping?.personal);
  let settings;
  const sections = [];
  const pendingEducationDetails = [];
  let lastEducationBlock = null;

  normalizedDocument.sections.forEach((section) => {
    const mapping = mappingById.get(section.id);
    const detectedKind = classifySourceSectionKind(section.title, section.lines);

    if (detectedKind === 'summary') {
      personal = {
        ...personal,
        aboutMe: mergeUniqueText([personal.aboutMe, section.lines.join(' ')], ' '),
        summaryTitle: personal.summaryTitle || section.title,
      };
      settings = {
        ...settings,
        showSummaryTitle: true,
      };
      return;
    }

    if (detectedKind === 'education-detail') {
      if (lastEducationBlock?.kind === 'education' && lastEducationBlock.entries.length > 0) {
        const coursework = section.lines.join(', ');
        lastEducationBlock.entries[0] = {
          ...lastEducationBlock.entries[0],
          coursework: mergeUniqueText([lastEducationBlock.entries[0].coursework, coursework], ', '),
        };
        return;
      }

      pendingEducationDetails.push(section);
      return;
    }

    const attachedCourseworkSections = detectedKind === 'education' ? pendingEducationDetails.splice(0) : [];
    const block = compileSourceSectionBlock(section, mapping, attachedCourseworkSections);
    sections.push(block);

    if (block.kind === 'education') {
      lastEducationBlock = block;
    }
  });

  pendingEducationDetails.forEach((section) => {
    sections.push(compileSourceSectionBlock(section, mappingById.get(section.id), []));
  });

  return finalizeSourceImportDraft({
    suggestedName: personal.name || sourceMapping?.suggestedName,
    personal,
    settings,
    sections,
    sourceFileName,
  });
}

function finalizeSourceImportDraft({
  personal,
  settings,
  sections,
  suggestedName = '',
  sourceFileName = '',
}) {
  const normalizedDraft = normalizeDraftPayload({
    resume: {
      personal,
      sections,
      settings,
    },
  });
  const personalName = normalizedDraft.resume.personal.name;
  const fallbackName = trimText(sourceFileName).replace(/\.[^.]+$/, '') || 'Imported resume';

  return {
    suggestedName: sanitizeWorkspaceResumeName(suggestedName || personalName || fallbackName, fallbackName),
    draft: {
      ...normalizedDraft,
      savedAt: null,
    },
  };
}
