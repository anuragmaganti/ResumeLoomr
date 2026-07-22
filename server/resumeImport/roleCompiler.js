import { trimText } from '../../src/lib/text.js';
import { isKnownSourceSectionHeader } from './sectionHeadings.js';
import {
  cleanSourceBullet,
  extractEndingDateText,
  extractRoleDateText,
  hasDateSignal,
  isDateOnlyLine,
  isLikelySourceBullet,
} from './sourceSignals.js';
import {
  hasRoleTitleSignal,
  isLikelyStandaloneRoleLine,
  parseRoleEntryLine,
  splitOrganizationRoleTitle,
  splitTrailingLocationFromTitleText,
} from './roleLineParser.js';

export function isLikelyRoleEntryLine(line) {
  const text = trimText(line);
  const { beforeDate, dateText } = extractRoleDateText(text);

  return (
    text.length > 2 &&
    !isLikelySourceBullet(text) &&
    !isKnownSourceSectionHeader(text) &&
    !isDateOnlyLine(text) &&
    (
      (
        Boolean(dateText) &&
        beforeDate.length > 1 &&
        beforeDate.length <= 120 &&
        !/[.!?]$/.test(beforeDate)
      ) ||
      (text.length <= 110 && hasRoleTitleSignal(text) && /(?:,\s*\S|\s+\|\s+|\s[-–—]\s)/.test(text))
    )
  );
}

export function countRoleEntriesInSourceLines(lines) {
  return buildSourceRoleEntries(lines).filter((entry) => (
    [entry.titleLine, entry.roleLine, entry.dateLine].some((value) => trimText(value) !== '') ||
    entry.bullets.some((bullet) => trimText(bullet) !== '')
  )).length;
}

function isLikelyRoleHeaderLine(line, nextLine = '', followingLine = '') {
  const text = trimText(line);

  if (!text || isLikelySourceBullet(text) || isDateOnlyLine(text) || isKnownSourceSectionHeader(text)) {
    return false;
  }

  if (isLikelyRoleEntryLine(text)) {
    return true;
  }

  const splitTrailingLocation = splitTrailingLocationFromTitleText(text, { preferShortCity: true });
  const nextLineRoleDate = extractRoleDateText(nextLine);

  if (
    splitTrailingLocation.location &&
    nextLineRoleDate.dateText &&
    hasRoleTitleSignal(nextLineRoleDate.beforeDate)
  ) {
    return true;
  }

  if (
    nextLineRoleDate.dateText &&
    !isLikelySourceBullet(nextLine) &&
    text.length <= 100 &&
    !hasDateSignal(text) &&
    !/[.!?]$/.test(text)
  ) {
    return true;
  }

  if (
    isLikelyStandaloneRoleLine(nextLine) &&
    text.length <= 100 &&
    !/[.!?]$/.test(text)
  ) {
    return true;
  }

  if (
    isDateOnlyLine(nextLine) &&
    text.length <= 100 &&
    !/[.!?]$/.test(text) &&
    (
      isLikelyStandaloneRoleLine(followingLine) ||
      /(?:\.com|\.org|\.net|\.io|\.dev)$/i.test(text) ||
      /\b(?:inc|llc|ltd|corp|company|labs?|group|program|department|university|college|school|foundation|studio)\b/i.test(text)
    )
  ) {
    return true;
  }

  const { beforeDate, dateText } = extractEndingDateText(text);

  return (
    Boolean(dateText) &&
    beforeDate.length >= 2 &&
    beforeDate.length <= 100 &&
    !/[.!?]$/.test(beforeDate) &&
    (
      hasRoleTitleSignal(beforeDate) ||
      Boolean(splitOrganizationRoleTitle(beforeDate)) ||
      isLikelyStandaloneRoleLine(nextLine) ||
      /(?:\.com|\.org|\.net|\.io|\.dev)$/i.test(beforeDate) ||
      /\b(?:inc|llc|ltd|corp|company|labs?|group|program|department|university|college|school|foundation|studio)\b/i.test(beforeDate)
    )
  );
}

function isTitleCaseResumePhrase(value) {
  const text = trimText(value);
  const words = text.split(/\s+/g).filter(Boolean);

  if (words.length < 3 || words.length > 8) {
    return false;
  }

  return words.every((word, index) => {
    const cleanedWord = word.replace(/^[("']+|[)"',.]+$/g, '');

    if (/^(?:and|or|of|in|for|to|the|with|&|\/)$/i.test(cleanedWord)) {
      return index > 0 && index < words.length - 1;
    }

    return /^[A-Z0-9]/.test(cleanedWord);
  });
}

function splitTrailingEntryTitleFromBullet(value) {
  const text = trimText(value);
  const words = text.split(/\s+/g).filter(Boolean);

  for (let startIndex = Math.max(1, words.length - 8); startIndex <= words.length - 3; startIndex += 1) {
    const activity = trimText(words.slice(0, startIndex).join(' '));
    const title = trimText(words.slice(startIndex).join(' '));

    if (
      activity.length >= 30 &&
      isTitleCaseResumePhrase(title) &&
      !/[.!?]$/.test(title)
    ) {
      return { activity, title };
    }
  }

  return null;
}

function splitGluedRoleLines(lines) {
  const expandedLines = [];

  lines.forEach((line, index) => {
    const text = trimText(line);
    const nextLine = trimText(lines[index + 1] || '');

    if (!isLikelySourceBullet(text) || !extractRoleDateText(nextLine).dateText) {
      expandedLines.push(text);
      return;
    }

    const splitLine = splitTrailingEntryTitleFromBullet(cleanSourceBullet(text));

    if (!splitLine) {
      expandedLines.push(text);
      return;
    }

    expandedLines.push(`• ${splitLine.activity}`);
    expandedLines.push(splitLine.title);
  });

  return expandedLines;
}

export function buildSourceRoleEntries(lines) {
  const entries = [];
  let currentEntry = null;

  splitGluedRoleLines(lines).forEach((line, index, expandedLines) => {
    const text = trimText(line);
    const nextLine = expandedLines[index + 1] || '';
    const followingLine = expandedLines[index + 2] || '';

    if (!text) {
      return;
    }

    if (currentEntry && currentEntry.bullets.length === 0) {
      const currentTitleDate = extractRoleDateText(currentEntry.titleLine);
      const currentLineDate = extractRoleDateText(text);

      if (
        currentTitleDate.dateText &&
        currentLineDate.dateText &&
        hasRoleTitleSignal(currentLineDate.beforeDate)
      ) {
        currentEntry = {
          titleLine: text,
          roleLine: '',
          dateLine: '',
          bullets: [],
        };
        entries.push(currentEntry);
        return;
      }
    }

    if (isLikelySourceBullet(text)) {
      if (!currentEntry) {
        currentEntry = {
          titleLine: '',
          dateLine: '',
          bullets: [],
        };
        entries.push(currentEntry);
      }

      currentEntry.bullets.push(cleanSourceBullet(text));
      return;
    }

    if (
      currentEntry &&
      currentEntry.bullets.length > 0 &&
      /^[a-z(]/.test(text) &&
      !isDateOnlyLine(text) &&
      !isKnownSourceSectionHeader(text)
    ) {
      currentEntry.bullets[currentEntry.bullets.length - 1] = `${currentEntry.bullets[currentEntry.bullets.length - 1]} ${text}`.replace(/\s{2,}/g, ' ');
      return;
    }

    if (
      currentEntry &&
      !currentEntry.roleLine &&
      currentEntry.bullets.length === 0 &&
      isLikelyStandaloneRoleLine(text)
    ) {
      currentEntry.roleLine = text;
      return;
    }

    if (
      currentEntry &&
      currentEntry.titleLine &&
      !currentEntry.roleLine &&
      currentEntry.bullets.length === 0 &&
      extractRoleDateText(currentEntry.titleLine).dateText &&
      isLikelySourceBullet(nextLine) &&
      !isDateOnlyLine(text) &&
      !isLikelySourceBullet(text) &&
      !isLikelyRoleHeaderLine(text, nextLine, followingLine)
    ) {
      currentEntry.roleLine = text;
      return;
    }

    if (isDateOnlyLine(text) && currentEntry && !currentEntry.dateLine) {
      currentEntry.dateLine = text;
      return;
    }

    if (
      currentEntry &&
      currentEntry.titleLine &&
      !currentEntry.roleLine &&
      !currentEntry.dateLine &&
      currentEntry.bullets.length === 0
    ) {
      const { beforeDate, dateText } = extractRoleDateText(text);

      if (dateText && beforeDate && hasRoleTitleSignal(beforeDate)) {
        currentEntry.roleLine = beforeDate;
        currentEntry.dateLine = dateText;
        return;
      }

      if (dateText) {
        if (beforeDate) {
          currentEntry.titleLine = trimText(`${currentEntry.titleLine} ${beforeDate}`);
        }
        currentEntry.dateLine = dateText;
        return;
      }
    }

    if (!currentEntry || isLikelyRoleHeaderLine(text, nextLine, followingLine)) {
      currentEntry = {
        titleLine: text,
        roleLine: '',
        dateLine: '',
        bullets: [],
      };
      entries.push(currentEntry);
      return;
    }

    currentEntry.bullets.push(cleanSourceBullet(text));
  });

  return entries;
}

function extractLocationFromActivities(activities) {
  let location = '';
  const cleanedActivities = activities.map((activity) => {
    if (location) {
      return activity;
    }

    const splitLocation = splitTrailingLocationFromTitleText(activity, { preferShortCity: true });

    if (!splitLocation.location || !splitLocation.titleText) {
      return activity;
    }

    location = splitLocation.location;
    return splitLocation.titleText;
  });

  return { location, activities: cleanedActivities };
}

export function compileRoleEntries(section) {
  const sourceEntries = buildSourceRoleEntries(section.lines);
  let lastRoleContext = { company: '', location: '' };

  return sourceEntries
    .map((entry, index) => {
      const explicitRoleLine = trimText(entry.roleLine);
      const parsedTitle = parseRoleEntryLine(explicitRoleLine ? entry.titleLine : [entry.titleLine, entry.dateLine].filter(Boolean).join(' '));
      const fallbackTitle = trimText(entry.titleLine);
      let role = parsedTitle.role || explicitRoleLine;
      let company = parsedTitle.company || (role ? '' : fallbackTitle);
      let location = parsedTitle.location;
      const yearsExp = entry.dateLine || parsedTitle.yearsExp;
      let activities = entry.bullets.filter(Boolean);

      if (!role && activities.length > 0 && isLikelyStandaloneRoleLine(activities[0])) {
        role = activities[0];
        activities = activities.slice(1);
      }

      if (!company && role && lastRoleContext.company) {
        company = lastRoleContext.company;
        location = location || lastRoleContext.location;
      }

      const activityLocation = location ? { location: '', activities } : extractLocationFromActivities(activities);
      const compiledEntry = {
        id: `${section.id}-entry-${index + 1}`,
        company: company.replace(/[,\s]*[-–—]?\s*$/g, ''),
        role,
        location: (location || activityLocation.location).replace(/[.]+$/g, ''),
        groupLabel: section.title,
        yearsExp,
        activities: activityLocation.activities.length > 0 ? activityLocation.activities : [''],
      };

      if (compiledEntry.company) {
        lastRoleContext = {
          company: compiledEntry.company,
          location: compiledEntry.location,
        };
      }

      return compiledEntry;
    })
    .filter((entry) => [entry.company, entry.role, entry.location, entry.yearsExp].some((value) => trimText(value) !== '') || entry.activities.some((activity) => trimText(activity) !== ''));
}
