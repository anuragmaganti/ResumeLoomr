import { trimText } from '../../src/lib/text.js';
import { splitTrailingLocationFromTitleText } from './roleLineParser.js';
import {
  cleanSourceBullet,
  extractEndingDateText,
  extractRoleDateText,
  extractTrailingDateText,
  hasDateSignal,
  isDateOnlyLine,
  isLikelyLocationText,
  isLikelySourceBullet,
} from './sourceSignals.js';
import {
  mergeUniqueText,
  splitTopLevelCommaParts,
} from './text.js';

function parseInstitutionLine(line) {
  const text = normalizeGluedInstitutionLocationText(line);
  const stateMatch = text.match(/,\s*([A-Z]{2}(?:\s+\d{5})?)$/);

  if (!stateMatch) {
    return {
      school: text,
      location: '',
    };
  }

  const beforeState = text.slice(0, stateMatch.index);
  const institutionLocationMatch = beforeState.match(/^(.*\b(?:university|coll[eè]ge|college|institute|academy|school)(?:\s+of\s+[A-Z][A-Za-z.'-]+)?)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)$/i);

  if (institutionLocationMatch) {
    return {
      school: trimText(institutionLocationMatch[1]),
      location: `${trimText(institutionLocationMatch[2])}, ${trimText(stateMatch[1])}`,
    };
  }

  const cityMatch = beforeState.match(/\s([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?)$/);

  if (!cityMatch) {
    return {
      school: text,
      location: '',
    };
  }

  let city = trimText(cityMatch[1]);

  if (/^(?:honors|program|college|school)\s+/i.test(city)) {
    city = city.split(/\s+/g).pop();
  }

  const cityStartIndex = beforeState.lastIndexOf(city);

  return {
    school: trimText(beforeState.slice(0, cityStartIndex)),
    location: `${city}, ${trimText(stateMatch[1])}`,
  };
}

function normalizeGluedInstitutionLocationText(line) {
  return trimText(line).replace(/([a-z])([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s+\d{5})?)$/g, '$1 $2');
}

function isEducationDetailLabelLine(line) {
  const label = trimText(line).match(/^([^:]{3,60}):/)?.[1] || '';

  return /^(?:relevant\s+coursework|coursework|additional\s+academic\s+exposure|academic\s+exposure|honors?|awards?|activities|concentrations?|study\s+abroad|certificates?|certifications?)$/i.test(label);
}

export function isLikelyInstitutionLine(line) {
  const text = trimText(line);

  if (
    isLikelySourceBullet(text) ||
    isEducationDetailLabelLine(text) ||
    /\b(?:awarded|achieved|authored|publications?|concentrations?|minors?|semester\s+abroad|visited?|foreign\s+study|study\s+abroad|exchange|coursework|relevant\s+courses?|scholar|scholarship|distinction|six\s+week|summer|spring|fall)\b/i.test(text)
  ) {
    return false;
  }

  const { beforeDate, dateText } = extractEndingDateText(text);
  const textWithoutDate = normalizeGluedInstitutionLocationText(dateText ? beforeDate : text);

  return (
    /\b(?:university|coll[eè]ge|college|institute|academy|school)\b/i.test(textWithoutDate) &&
    !/\b(?:bachelor|master|doctor|ph\.?d|degree|certificate|coursework|study abroad|exchange)\b/i.test(textWithoutDate)
  );
}

export function isLikelyDegreeLine(line) {
  if (/^[A-Z]{2}$/.test(trimText(line))) {
    return false;
  }

  if (/\b(?:concentrations?|minors?)\b/i.test(line)) {
    return false;
  }

  if (isLikelyLocationText(line)) {
    return false;
  }

  if (
    /\b(?:university|coll[eè]ge|college|institute|academy|school)\b/i.test(line) &&
    splitTrailingLocationFromTitleText(line, { preferShortCity: true }).location
  ) {
    return false;
  }

  return /(?:\b(?:bachelor|master|doctor|ph\.?d|associate|degree|major|minor|diploma|certificate|certification|bootcamp|ba|bs)\b|(?:^|\s)(?:b\.?a\.?|b\.?s\.?|m\.?a\.?|m\.?s\.?)(?:\s|$))/i.test(line);
}

function isLikelyEducationInstitutionStart(line, nextLine = '', followingLine = '') {
  const text = trimText(line);

  if (
    !text ||
    /^(?:schools?|districts?|organizations?|companies?),/i.test(text) ||
    isLikelySourceBullet(text) ||
    isLikelyDegreeLine(text) ||
    isDateOnlyLine(text) ||
    /:/.test(text) ||
    /\b(?:concentrations?|minors?|publications?|coursework|relevant\s+courses?)\b/i.test(text)
  ) {
    return false;
  }

  if (isLikelyInstitutionLine(text)) {
    const nextCredentialText = [nextLine, followingLine].map(trimText).filter(Boolean).join(' ');
    const parsedInstitution = parseInstitutionLine(text);

    return Boolean(
      parsedInstitution.location ||
      hasDateSignal(text) ||
      isLikelyDegreeLine(nextCredentialText)
    );
  }

  const words = text.split(/\s+/g).filter(Boolean);
  const isShortTitle = words.length > 0 && words.length <= 6 && /^[A-Z0-9]/.test(text) && !/[.,;|]/.test(text);
  const nextCredentialText = [nextLine, followingLine].map(trimText).filter(Boolean).join(' ');

  return isShortTitle && isLikelyDegreeLine(nextCredentialText);
}

function splitEducationGroups(lines) {
  const groups = [];
  let currentGroup = null;

  lines.forEach((line, index) => {
    const text = trimText(line);
    const previousLine = lines[index - 1] || '';
    const nextLine = lines[index + 1] || '';
    const followingLine = lines[index + 2] || '';
    const thirdLine = lines[index + 3] || '';

    if (!text) {
      return;
    }

    const currentGroupHasCredential = currentGroup?.lines?.some((groupLine, groupIndex, groupLines) => (
      isLikelyDegreeLine(groupLine) ||
      isLikelyDegreeLine(`${groupLine} ${groupLines[groupIndex + 1] || ''}`)
    ));
    const startsEducationInstitution = isLikelyEducationInstitutionStart(text, nextLine, followingLine);
    const isLikelyWrappedEducationDetail = (
      isLikelySourceBullet(previousLine) &&
      !isLikelyDegreeLine(text) &&
      !hasDateSignal(text) &&
      isLikelyEducationInstitutionStart(nextLine, followingLine, thirdLine)
    );

    if (
      !currentGroup ||
      (
        currentGroup.lines.length > 0 &&
        currentGroupHasCredential &&
        startsEducationInstitution &&
        !isLikelyWrappedEducationDetail
      ) ||
      (
        currentGroup.lines.length > 0 &&
        isLikelyInstitutionLine(currentGroup.lines[0]) &&
        startsEducationInstitution &&
        !isLikelyWrappedEducationDetail
      )
    ) {
      currentGroup = { lines: [] };
      groups.push(currentGroup);
    }

    currentGroup.lines.push(text);
  });

  return groups.length > 0 ? groups : [{ lines }];
}

function extractGpa(lines) {
  return lines.join(' ').match(/GPA\s*:?\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i)?.[1] || '';
}

function stripGpa(text) {
  return trimText(text).replace(/\s*GPA\s*:?\s*[0-9.]+(?:\s*\/\s*[0-9.]+)?/ig, '').replace(/[,\s]+$/g, '').trim();
}

function cleanEducationDegreeText(text) {
  return stripGpa(text)
    .replace(/\(\s*expected\s*\)/ig, '')
    .replace(/\bexpected\b\s*,?/ig, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function mergeEducationDetailLines(lines) {
  const mergedLines = [];

  lines.forEach((line) => {
    const text = trimText(line);

    if (!text) {
      return;
    }

    const previousIndex = mergedLines.length - 1;
    const previousLine = mergedLines[previousIndex];

    if (
      previousLine &&
      !isLikelyDegreeLine(previousLine) &&
      isLikelyDegreeLine(`${previousLine} ${text}`)
    ) {
      mergedLines[previousIndex] = `${previousLine} ${text}`;
      return;
    }

    mergedLines.push(text);
  });

  return mergedLines;
}

function parseInlineEducationLine(line) {
  const text = trimText(line);
  const { beforeDate, dateText } = extractRoleDateText(text);
  const commaParts = splitTopLevelCommaParts(beforeDate).map((part) => part.replace(/[,\s]+$/g, '').trim()).filter(Boolean);

  if (commaParts.length < 3 || !commaParts.some(isLikelyDegreeLine)) {
    return null;
  }

  const locationIndex = commaParts.findIndex((part, index) => (
    index > 0 &&
    isLikelyLocationText(`${part}, ${commaParts[index + 1] || ''}`)
  ));
  const degreePart = commaParts.find((part, index) => (
    index !== locationIndex &&
    index !== locationIndex + 1 &&
    isLikelyDegreeLine(part)
  )) || '';
  const gpa = extractGpa([text]);

  return {
    school: commaParts[0],
    degree: cleanEducationDegreeText(degreePart),
    yearsEdu: dateText,
    location: locationIndex >= 0 ? `${commaParts[locationIndex]}, ${commaParts[locationIndex + 1]}` : '',
    gpa,
  };
}

function compileEducationEntryFromGroup(group, section, groupIndex, attachedCourseworkLines) {
  const lines = group.lines.map(trimText).filter(Boolean);
  const firstLine = lines.find((line) => !isLikelySourceBullet(line)) || '';
  const inlineEducation = parseInlineEducationLine(firstLine);

  if (inlineEducation) {
    return {
      id: `${section.id}-entry-${groupIndex + 1}`,
      school: inlineEducation.school.replace(/[,\s]*[-–—]?\s*$/g, ''),
      degree: inlineEducation.degree,
      yearsEdu: inlineEducation.yearsEdu,
      location: inlineEducation.location,
      gpa: inlineEducation.gpa,
      honors: '',
      coursework: attachedCourseworkLines.join(', '),
      awards: '',
      programs: inlineEducation.degree ? [{
        id: `${section.id}-program-${groupIndex + 1}-1`,
        degree: inlineEducation.degree,
        yearsEdu: inlineEducation.yearsEdu,
        gpa: inlineEducation.gpa,
        honors: '',
      }] : [],
      customSections: [{ label: '', content: '' }],
    };
  }

  const firstLineDate = extractEndingDateText(firstLine);
  const institution = parseInstitutionLine(firstLineDate.beforeDate || firstLine);
  const gpa = extractGpa(lines);
  let location = institution.location;
  const detailLines = mergeEducationDetailLines(
    lines
      .filter((line) => line !== firstLine)
      .map((line) => (isLikelySourceBullet(line) ? cleanSourceBullet(line) : line))
  ).map((line) => {
    if (location) {
      return line;
    }

    const splitLocation = splitTrailingLocationFromTitleText(line);

    if (!splitLocation.location || !splitLocation.titleText) {
      return line;
    }

    location = splitLocation.location;
    return splitLocation.titleText;
  });
  const degreeLines = detailLines.filter((line) => isLikelyDegreeLine(line));
  const programs = degreeLines.map((line, index) => {
    const { beforeDate, dateText } = extractTrailingDateText(cleanEducationDegreeText(line));

    return {
      id: `${section.id}-program-${groupIndex + 1}-${index + 1}`,
      degree: cleanEducationDegreeText(beforeDate),
      yearsEdu: dateText,
      gpa: index === 0 ? gpa : '',
      honors: '',
    };
  });
  const customSections = [];
  let activeCustomSection = null;
  let activeCourseworkSection = false;
  let coursework = attachedCourseworkLines.join(', ');
  const addEducationDetail = (line) => {
    const labelMatch = line.match(/^([^:]{3,40}):\s*(.+)$/);
    const label = labelMatch ? trimText(labelMatch[1]) : 'Details';
    const content = labelMatch ? trimText(labelMatch[2]) : line;

    if (/^(?:relevant\s+coursework|coursework|relevant\s+courses?)$/i.test(label)) {
      coursework = mergeUniqueText([coursework, content], ' ');
      activeCustomSection = null;
      activeCourseworkSection = true;
      return;
    }

    activeCustomSection = {
      id: `${section.id}-education-detail-${groupIndex + 1}-${customSections.length + 1}`,
      label,
      content,
    };
    activeCourseworkSection = false;
    customSections.push(activeCustomSection);
  };

  detailLines.forEach((line) => {
    if (degreeLines.includes(line)) {
      return;
    }

    const hasDetailLabel = /^([^:]{3,40}):\s*(.+)$/.test(line);

    if (!hasDetailLabel && activeCourseworkSection) {
      coursework = mergeUniqueText([coursework, line], ' ');
      return;
    }

    if (!hasDetailLabel && activeCustomSection && activeCustomSection.label !== 'Details') {
      activeCustomSection.content = mergeUniqueText([activeCustomSection.content, line], ' ');
      return;
    }

    addEducationDetail(line);
  });

  return {
    id: `${section.id}-entry-${groupIndex + 1}`,
    school: institution.school.replace(/[,\s]*[-–—]?\s*$/g, ''),
    degree: programs[0]?.degree || cleanEducationDegreeText(degreeLines[0] || ''),
    yearsEdu: programs[0]?.yearsEdu || firstLineDate.dateText,
    location,
    gpa,
    honors: '',
    coursework,
    awards: '',
    programs,
    customSections: customSections.length > 0 ? customSections : [{ label: '', content: '' }],
  };
}

export function compileEducationEntries(section, attachedCourseworkSections = []) {
  const courseworkLines = attachedCourseworkSections.flatMap((courseworkSection) => courseworkSection.lines);
  const groups = splitEducationGroups(section.lines);

  return groups
    .map((group, index) => compileEducationEntryFromGroup(group, section, index, index === 0 ? courseworkLines : []))
    .filter((entry) => (
      [entry.school, entry.degree, entry.yearsEdu, entry.location, entry.gpa, entry.coursework].some((value) => trimText(value) !== '') ||
      entry.customSections.some((customSection) => trimText(customSection.content) !== '')
    ));
}
