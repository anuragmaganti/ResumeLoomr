import { trimText } from '../../src/lib/text.js';
import {
  buildSourceRoleEntries,
} from './roleCompiler.js';
import {
  parseRoleEntryLine,
} from './roleLineParser.js';
import { isKnownSourceSectionHeader } from './sectionHeadings.js';
import {
  cleanSourceBullet,
  extractRoleDateText,
  extractTrailingDateText,
  isDateOnlyLine,
  isLikelySourceBullet,
  isLikelyUrlText,
} from './sourceSignals.js';
import { mergeUniqueText } from './text.js';

export function countAwardsInSourceLines(lines) {
  return compileAwardEntries({
    id: 'source-awards-coverage',
    lines,
  }).filter((entry) => (
    [entry.title, entry.issuer, entry.years, entry.details].some((value) => trimText(value) !== '')
  )).length;
}

export function compileSkillsEntries(section) {
  const lines = [];

  section.lines.map(trimText).filter(Boolean).forEach((line) => {
    const isBullet = isLikelySourceBullet(line);
    const text = isBullet ? cleanSourceBullet(line) : line;
    const previousIndex = lines.length - 1;
    const previousLine = lines[previousIndex] || '';

    if (
      !isBullet &&
      previousLine &&
      (
        isDateOnlyLine(text) ||
        /(?:\bin|of|using|with|and)$/i.test(previousLine) ||
        /^[a-z0-9(]/.test(text)
      )
    ) {
      lines[previousIndex] = `${previousLine} ${text}`.replace(/\s{2,}/g, ' ');
      return;
    }

    lines.push(text);
  });
  const joinSkillItems = (items) => items
    .map((item) => trimText(item).replace(/,+$/g, ''))
    .filter(Boolean)
    .join(', ');
  const colonEntries = lines
    .map((line, index) => {
      const match = line.match(/^([^:]{2,40}):\s*(.+)$/);

      if (!match) {
        return null;
      }

      return {
        id: `${section.id}-entry-${index + 1}`,
        category: trimText(match[1]),
        items: joinSkillItems([match[2]]),
      };
    })
    .filter(Boolean);

  if (colonEntries.length > 0) {
    return colonEntries;
  }

  const groupedEntries = [];
  let activeEntry = null;
  const pushActiveEntry = () => {
    if (activeEntry && (activeEntry.category || activeEntry.items.length > 0)) {
      groupedEntries.push({
        id: `${section.id}-entry-${groupedEntries.length + 1}`,
        category: activeEntry.category,
        items: joinSkillItems(activeEntry.items),
      });
    }
  };

  lines.forEach((line, index) => {
    const nextLine = lines[index + 1] || '';
    const isCategoryLine = (
      line.length <= 40 &&
      !/[,:;|]/.test(line) &&
      /^[A-Z0-9]/.test(line) &&
      nextLine &&
      /,|\b(?:javascript|typescript|react|python|ruby|kotlin|sql|aws|docker|kubernetes|graphql|node|next\.js|html|css|git|jira|agile|scrum|excel)\b/i.test(nextLine)
    );

    if (isCategoryLine) {
      pushActiveEntry();
      activeEntry = { category: line, items: [] };
      return;
    }

    if (!activeEntry) {
      activeEntry = { category: '', items: [] };
    }

    activeEntry.items.push(line);
  });

  pushActiveEntry();

  if (groupedEntries.length > 1 || trimText(groupedEntries[0]?.category) !== '') {
    return groupedEntries;
  }

  return [{
    id: `${section.id}-entry-1`,
    category: '',
    items: joinSkillItems(lines),
  }];
}

function isLikelyProjectTitleLine(line) {
  const text = trimText(line);
  const { beforeDate } = extractRoleDateText(text);
  const titleText = beforeDate || text;
  const words = titleText.split(/\s+/g).filter(Boolean);

  return (
    titleText.length > 1 &&
    titleText.length <= 90 &&
    !isLikelySourceBullet(text) &&
    !isKnownSourceSectionHeader(text) &&
    !isDateOnlyLine(text) &&
    (
      isLikelyUrlText(text) ||
      text.includes('|') ||
      (words.length <= 5 && /^[A-Z0-9]/.test(titleText) && !/[.!?]$/.test(titleText) && !/,/.test(titleText))
    )
  );
}

function buildSourceProjectEntries(lines) {
  const entries = [];
  let currentEntry = null;

  lines.forEach((line) => {
    const text = trimText(line);

    if (!text) {
      return;
    }

    if (currentEntry && isDateOnlyLine(text)) {
      currentEntry.dateLine = text;
      return;
    }

    if (!currentEntry || isLikelyProjectTitleLine(text)) {
      currentEntry = {
        titleLine: text,
        dateLine: '',
        details: [],
      };
      entries.push(currentEntry);
      return;
    }

    currentEntry.details.push(cleanSourceBullet(text));
  });

  return entries;
}

export function compileAwardEntries(section) {
  const entries = [];

  section.lines
    .map(trimText)
    .filter(Boolean)
    .forEach((line) => {
      const interestMatch = line.match(/^interests?\s+in\s+(.+)$/i);

      if (interestMatch) {
        entries.push({
          id: `${section.id}-entry-${entries.length + 1}`,
          title: 'Interests',
          issuer: '',
          years: '',
          details: trimText(interestMatch[1]),
        });
        return;
      }

      const leadingYearAwardMatch = line.match(/^((?:19|20)(?:\d{2}|XX))\s+(.+\b(?:scholarship|medal|award|honou?r|fellowship|grant|prize|recognition|distinction)\b.*)$/i);

      if (leadingYearAwardMatch) {
        entries.push({
          id: `${section.id}-entry-${entries.length + 1}`,
          title: trimText(leadingYearAwardMatch[2]),
          issuer: '',
          years: trimText(leadingYearAwardMatch[1]),
          details: '',
        });
        return;
      }

      const titledAwardMatch = line.match(/^([^,]{3,100}\b(?:scholarship|medal|award|honou?r|fellowship|grant|prize|recognition|distinction)\b[^,]*),\s*(.+)$/i);

      if (titledAwardMatch) {
        const { beforeDate, dateText } = extractRoleDateText(trimText(titledAwardMatch[1]));

        entries.push({
          id: `${section.id}-entry-${entries.length + 1}`,
          title: beforeDate || trimText(titledAwardMatch[1]),
          issuer: '',
          years: dateText,
          details: trimText(titledAwardMatch[2]),
        });
        return;
      }

      const { beforeDate, dateText } = extractRoleDateText(line);
      const isDetailLine = (
        entries.length > 0 &&
        !dateText &&
        (
          /[.!?]$/.test(line) ||
          /^(?:awarded|presented|selected|recognized|team\s+member|captain|track|football|wrestling)\b/i.test(line)
        )
      );

      if (isDetailLine) {
        const previousEntry = entries[entries.length - 1];
        previousEntry.details = mergeUniqueText([previousEntry.details, line], ' ');
        return;
      }

      entries.push({
        id: `${section.id}-entry-${entries.length + 1}`,
        title: beforeDate || line,
        issuer: '',
        years: dateText,
        details: '',
      });
    });

  return entries;
}

export function compileProjectLikeEntries(section) {
  const sourceEntries = buildSourceProjectEntries(section.lines);

  return sourceEntries
    .map((entry, index) => {
      const { beforeDate, dateText } = extractRoleDateText([entry.titleLine, entry.dateLine].filter(Boolean).join(' '));
      const pipeParts = beforeDate.split('|').map(trimText).filter(Boolean);
      const name = (pipeParts.length > 1 ? pipeParts[0] : beforeDate || entry.titleLine || section.title)
        .replace(/\(\s*\)$/g, '')
        .replace(/[,\s]+$/g, '')
        .trim();
      const detailLines = entry.details.map(trimText).filter(Boolean);
      const summary = pipeParts.length > 1 ? pipeParts.slice(1).join(' | ') : (detailLines[0] || '');
      const highlights = detailLines.slice(summary ? 1 : 0);

      return {
        id: `${section.id}-entry-${index + 1}`,
        name,
        subtitle: '',
        years: dateText,
        summary,
        highlights: highlights.length > 0 ? highlights : [''],
      };
    })
    .filter((entry) => [entry.name, entry.years].some((value) => trimText(value) !== '') || entry.highlights.some((highlight) => trimText(highlight) !== ''));
}

export function compileCertificationEntries(section) {
  return section.lines.map((line, index) => {
    const { beforeDate, dateText } = extractTrailingDateText(line);

    return {
      id: `${section.id}-entry-${index + 1}`,
      name: beforeDate || line,
      issuer: '',
      years: dateText,
      details: '',
    };
  });
}

export function compileLanguageEntries(section) {
  return section.lines.flatMap((line, lineIndex) => (
    line.split(/[,;•]/g).map(trimText).filter(Boolean).map((language, itemIndex) => {
      const [name, proficiency = ''] = language.split(/[-:]/g).map(trimText);

      return {
        id: `${section.id}-entry-${lineIndex + 1}-${itemIndex + 1}`,
        language: name,
        proficiency,
      };
    })
  ));
}

function cleanPublicationLine(line) {
  return trimText(line)
    .replace(/^\((?:lead\s+author|contributing\s+author)\)\s*/i, '')
    .replace(/^\(contributing\s+/i, '')
    .replace(/^author\)\s+/i, '')
    .replace(/\s+\((?:lead\s+author|contributing\s+author)\)\s+/i, ' ')
    .replace(/\s{2,}/g, ' ');
}

function isLikelyPublicationStartLine(line) {
  const text = cleanPublicationLine(line);

  if (!text) {
    return false;
  }

  return (
    /^(?:\(?accepted\)?|\(?submitted\)?|\(?preparation\)?)/i.test(text) ||
    (
      /\b[A-Z][A-Za-z.'-]+,\s+[A-Z]\./.test(text) &&
      /\([^)]*(?:19|20)(?:\d{2}|XX)[^)]*\)/.test(text)
    ) ||
    /\bU\.S\.\s+Patent\s+No\./i.test(text)
  );
}

function groupPublicationLines(lines) {
  const entries = [];
  let activeLines = [];

  const pushActiveLines = () => {
    if (activeLines.length > 0) {
      entries.push(activeLines.join(' ').replace(/\s{2,}/g, ' '));
    }
  };

  lines.map(cleanPublicationLine).filter(Boolean).forEach((line) => {
    if (activeLines.length === 0 || isLikelyPublicationStartLine(line)) {
      pushActiveLines();
      activeLines = [line];
      return;
    }

    activeLines.push(line);
  });

  pushActiveLines();

  return entries;
}

export function compilePublicationEntries(section) {
  return groupPublicationLines(section.lines).map((line, index) => {
    const { beforeDate, dateText } = extractTrailingDateText(line);

    return {
      id: `${section.id}-entry-${index + 1}`,
      title: beforeDate || line,
      publisher: '',
      years: dateText,
      details: '',
    };
  });
}

export function compileCustomEntries(section) {
  const sourceEntries = buildSourceRoleEntries(section.lines);

  if (sourceEntries.length === 0) {
    return [{
      id: `${section.id}-entry-1`,
      title: section.title,
      subtitle: '',
      location: '',
      years: '',
      details: '',
      highlights: [''],
    }];
  }

  return sourceEntries.map((entry, index) => {
    const parsedTitle = parseRoleEntryLine([entry.titleLine, entry.dateLine].filter(Boolean).join(' '));

    return {
      id: `${section.id}-entry-${index + 1}`,
      title: parsedTitle.company || entry.titleLine || section.title,
      subtitle: parsedTitle.role || trimText(entry.roleLine),
      location: parsedTitle.location,
      years: parsedTitle.yearsExp,
      details: '',
      highlights: entry.bullets.length > 0 ? entry.bullets : [''],
    };
  });
}
