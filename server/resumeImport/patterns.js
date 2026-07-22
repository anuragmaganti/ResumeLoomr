export const PHONE_TEXT_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?[\dxX]{3}\)?[\s.-]?)[\dxX]{3}[\s.-]?[\dxX]{4}/;

export const RESUME_SIGNAL_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  PHONE_TEXT_PATTERN,
  /(?<!@)\b(?:https?:\/\/|www\.|linkedin\.com|github\.com|portfolio|behance\.net|[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}(?:\/\S*)?)\S*/i,
  /\b(?:19|20)\d{2}\b|\b(?:present|current)\b/i,
  /\b(?:education|university|college|bachelor|master|degree|gpa|coursework|honors|certificate)\b/i,
  /\b(?:experience|employment|work|company|engineer|manager|developer|analyst|intern|consultant|led|built|managed|designed|implemented|improved)\b/i,
  /\b(?:skills|javascript|typescript|react|python|sql|excel|figma|aws|node|project management|communication|leadership)\b/i,
];

export const BULLET_MARKER_PATTERN = /(?:[•●▪◦‣∙*➢➤▸►→◆◇■□▪▫]|\d+[.)]|[-–—])/;
export const YEAR_TOKEN_SOURCE = '(?:19|20)(?:\\d{2}|XX)';
export const MONTH_NAME_SOURCE = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
export const SEASON_NAME_SOURCE = '(?:spring|summer|fall|winter|autumn)';
export const DATE_TOKEN_SOURCE = `(?:(?:(?:${MONTH_NAME_SOURCE}|${SEASON_NAME_SOURCE})\\s*,?\\s*)?${YEAR_TOKEN_SOURCE}|(?:0?[1-9]|1[0-2])[/.-]${YEAR_TOKEN_SOURCE}|\\b(?:present|current)\\b)`;
export const DATE_RANGE_SOURCE = `(?:${MONTH_NAME_SOURCE}\\s*(?:[-–—]|to)\\s*${MONTH_NAME_SOURCE}\\s+${YEAR_TOKEN_SOURCE}|${DATE_TOKEN_SOURCE}\\s*(?:[-–—]|to|&|and)\\s*${DATE_TOKEN_SOURCE})`;
export const DATE_TEXT_PATTERN = new RegExp(`(?:${DATE_RANGE_SOURCE}|${DATE_TOKEN_SOURCE})`, 'i');
export const DATE_TEXT_PATTERN_GLOBAL = new RegExp(`(?:${DATE_RANGE_SOURCE}|${DATE_TOKEN_SOURCE})`, 'gi');
