import { trimText } from '../../src/lib/text.js';
import { isKnownSourceSectionHeader } from './sectionHeadings.js';
import {
  extractRoleDateText,
  hasDateSignal,
  isLikelyLocationText,
  isLikelySourceBullet,
} from './sourceSignals.js';
import { splitTopLevelCommaParts } from './text.js';

export function hasRoleTitleSignal(line) {
  return /\b(?:intern|assistant|associate|manager|engineer|analyst|director|counselor|consultant|consulting|developer|coordinator|specialist|sales|student|resident|head|officer|president|co[-\s]?president|vice\s+president|treasurer|secretary|lead|participant|mentor|member|volunteer|technician|designer|architect|administrator|supervisor|scrub|full[-\s]?stack|founder|co[-\s]?founder|ceo|cto|cfo|coo|chief|owner|partner|principal|board\s+member|stakeholder|advisor|adviser|executive|chair|co[-\s]?chair|committee|captain|editor|clerk|bagger|cashier|fellow|researcher|operator|strategist)\b/i.test(trimText(line));
}

export function isLikelyStandaloneRoleLine(line) {
  const text = trimText(line);

  return (
    text.length > 1 &&
    text.length <= 80 &&
    hasRoleTitleSignal(text) &&
    !hasDateSignal(text) &&
    !isLikelySourceBullet(text) &&
    !isKnownSourceSectionHeader(text) &&
    !/[.!?]$/.test(text)
  );
}

function hasOrganizationSignal(value) {
  return /\b(?:inc|llc|ltd|corp|company|labs?|laborator(?:y|ies)|center|centre|institute|university|college|school|hospital|clinic|department|agency|foundation|studio|program|group|team|organization|association|society|club|committee|council|office|division|systems?|technologies|partners?|engineers?)\b/i.test(trimText(value));
}

function isBusinessEntitySuffix(value) {
  return /^(?:inc|inc\.|llc|l\.l\.c\.|ltd|ltd\.|co|co\.|corp|corp\.|corporation|company|plc|gmbh|s\.?a\.?|p\.?c\.?)$/i.test(trimText(value).replace(/,+$/g, ''));
}

function splitLocationFromTitleLine(line) {
  const text = trimText(line);
  const pipeParts = text.split('|').map(trimText).filter(Boolean);

  if (pipeParts.length < 2) {
    return { titleText: text, location: '' };
  }

  return {
    titleText: pipeParts.slice(0, -1).join(' | '),
    location: pipeParts[pipeParts.length - 1],
  };
}

export function splitTrailingLocationFromTitleText(line, { preferShortCity = false } = {}) {
  const text = trimText(line);
  const andLocationMatch = text.match(/^(.+?)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*,\s*[A-Z]{2}\s+and\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*,\s*[A-Z]{2})$/i);

  if (andLocationMatch) {
    return {
      titleText: trimText(andLocationMatch[1]).replace(/[,\s]*[-–—]?\s*$/g, ''),
      location: trimText(andLocationMatch[2]),
    };
  }

  const slashLocationMatch = text.match(/^(.+?)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*,\s*[A-Z]{2}\s*\/\s*[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Za-z0-9.'-]+)*,\s*[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*)$/);

  if (slashLocationMatch) {
    return {
      titleText: trimText(slashLocationMatch[1]).replace(/\s*[-–—]\s*$/g, ''),
      location: trimText(slashLocationMatch[2]).replace(/\s*\/\s*/g, '/'),
    };
  }

  const match = text.match(/^(.+)\s+([^,]+,\s*(?:[A-Z]{2}|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*))$/);

  if (!match) {
    return { titleText: text, location: '' };
  }

  const beforeLocation = trimText(match[1]);
  const locationTail = trimText(match[2]);
  const commaIndex = locationTail.lastIndexOf(',');
  const rightSide = trimText(locationTail.slice(commaIndex + 1));
  const leftWords = `${beforeLocation} ${trimText(locationTail.slice(0, commaIndex))}`.split(/\s+/g).filter(Boolean);
  const maxCityWords = /^[A-Z]{2}(?:\s+\d{5})?$/.test(rightSide) ? 3 : 2;

  const cityWordCounts = preferShortCity
    ? Array.from({ length: maxCityWords }, (_, index) => index + 1)
    : Array.from({ length: maxCityWords }, (_, index) => maxCityWords - index);

  for (const cityWordCount of cityWordCounts) {
    if (leftWords.length <= cityWordCount) {
      continue;
    }

    const cityWords = leftWords.slice(-cityWordCount);
    const city = trimText(cityWords.join(' '));
    const titleText = trimText(leftWords.slice(0, -cityWordCount).join(' '));
    const location = `${city}, ${rightSide}`;

    if (
      preferShortCity &&
      cityWordCount === 1 &&
      /\b(?:los|new|san|santa|st\.?|fort|las)$/i.test(titleText)
    ) {
      continue;
    }

    if (
      titleText &&
      !(cityWordCount > 1 && cityWords[0].toLowerCase() === rightSide.toLowerCase()) &&
      cityWords.every((word) => /^[A-Z][A-Za-z.'-]*$/.test(word)) &&
      isLikelyLocationText(location)
    ) {
      return { titleText: titleText.replace(/\s*[-–—]\s*$/g, ''), location };
    }
  }

  return { titleText: text, location: '' };
}

function splitParentheticalOrganizationRole(line) {
  const text = trimText(line);
  const match = text.match(/^(.+?)\s+\(([^)]{2,120})\)$/);

  if (!match) {
    return null;
  }

  const role = trimText(match[1]);
  const company = trimText(match[2]);

  if (!hasRoleTitleSignal(role) || hasDateSignal(company)) {
    return null;
  }

  return { company, role };
}

function splitMemberOfRole(line) {
  const match = trimText(line).match(/^member\s+of\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    company: trimText(match[1]),
    role: 'Member',
  };
}

export function splitOrganizationRoleTitle(line) {
  const text = trimText(line);
  const roleMatch = text.match(/^(.+?)\s+((?:co[-\s]?president|president|vice\s+president|treasurer|secretary|chair|co[-\s]?chair|director|manager|advisor|adviser|mentor|member|participant|volunteer|captain|lead|coordinator|representative|assistant|associate|fellow|intern|researcher|engineer|analyst|consultant|developer|designer|teacher|instructor|tutor|founder|co[-\s]?founder|owner|partner|principal|officer|board\s+member)\b.*)$/i);

  if (!roleMatch) {
    return null;
  }

  const company = trimText(roleMatch[1]);
  const role = trimText(roleMatch[2]);

  if (
    !company ||
    hasRoleTitleSignal(company) ||
    !hasRoleTitleSignal(role) ||
    (company.split(/\s+/g).filter(Boolean).length <= 1 && !hasOrganizationSignal(company))
  ) {
    return null;
  }

  return { company, role };
}

export function parseRoleEntryLine(line) {
  const { beforeDate, dateText } = extractRoleDateText(line);
  const titleBeforeDate = beforeDate.replace(/[,\s]+$/g, '');
  const pipeParts = titleBeforeDate.split('|').map(trimText).filter(Boolean);
  let titleText;
  let location = '';
  let pipeRole = '';

  if (pipeParts.length >= 3) {
    titleText = pipeParts[0];
    pipeRole = pipeParts[1];
    location = pipeParts.slice(2).join(' | ');
  } else if (pipeParts.length === 2) {
    const [left, right] = pipeParts;

    if (isLikelyLocationText(right)) {
      titleText = left;
      location = right;
    } else {
      titleText = left;
      pipeRole = right;
    }
  } else {
    const splitTitle = splitLocationFromTitleLine(titleBeforeDate);
    titleText = splitTitle.titleText;
    location = splitTitle.location;
  }

  if (!location && !pipeRole) {
    const splitTrailingLocation = splitTrailingLocationFromTitleText(titleText, { preferShortCity: true });
    titleText = splitTrailingLocation.titleText;
    location = splitTrailingLocation.location;
  }

  const commaParts = splitTopLevelCommaParts(titleText);
  const hasOnlyBusinessSuffixCommaParts = commaParts.length > 1 && commaParts.slice(1).every(isBusinessEntitySuffix);
  let role = pipeRole;
  let company = titleText;

  if (
    !role &&
    commaParts.length > 1 &&
    !hasOnlyBusinessSuffixCommaParts &&
    !hasRoleTitleSignal(commaParts[0]) &&
    hasRoleTitleSignal(commaParts.slice(1).join(', '))
  ) {
    role = commaParts.slice(1).join(', ').replace(/[,\s]+$/g, '');
    company = commaParts[0];
  }

  if (!role) {
    const organizationRole = splitOrganizationRoleTitle(titleText);

    if (organizationRole) {
      role = organizationRole.role;
      company = organizationRole.company;
    }
  }

  if (!role && commaParts.length > 1 && !hasOnlyBusinessSuffixCommaParts) {
    const [left, right] = [commaParts[0], commaParts.slice(1).join(', ')];

    if (hasRoleTitleSignal(left) && (hasOrganizationSignal(right) || !hasRoleTitleSignal(right))) {
      role = left;
      company = right;
    } else if (hasRoleTitleSignal(right) && !hasOrganizationSignal(right)) {
      role = right;
      company = left;
    }
  }

  if (!role) {
    const parentheticalOrganizationRole = splitParentheticalOrganizationRole(titleText);

    if (parentheticalOrganizationRole) {
      role = parentheticalOrganizationRole.role;
      company = parentheticalOrganizationRole.company;
    }
  }

  if (!role) {
    const memberOfRole = splitMemberOfRole(titleText);

    if (memberOfRole) {
      role = memberOfRole.role;
      company = memberOfRole.company;
    }
  }

  if (!role) {
    const organizationRole = splitOrganizationRoleTitle(titleText);

    if (organizationRole) {
      role = organizationRole.role;
      company = organizationRole.company;
    }
  }

  if (!role) {
    const atMatch = titleText.match(/^(.+?)\s+at\s+(.+)$/i);

    if (atMatch && hasRoleTitleSignal(atMatch[1])) {
      role = trimText(atMatch[1]);
      company = trimText(atMatch[2]);
    }
  }

  if (!role) {
    const dashParts = titleText.split(/\s[-–—]\s/).map(trimText).filter(Boolean);

    if (dashParts.length === 2 && hasRoleTitleSignal(dashParts[1])) {
      company = dashParts[0];
      role = dashParts[1];
    }
  }

  if (!role && isLikelyStandaloneRoleLine(titleText)) {
    role = titleText;
    company = '';
  }

  return {
    company,
    role,
    location,
    yearsExp: dateText,
  };
}
