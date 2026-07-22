import { GoogleGenAI } from '@google/genai';

import { trimText } from '../../src/lib/text.js';
import { ImportResumeError } from './error.js';

export const DEFAULT_GEMINI_IMPORT_MODEL = 'gemini-3.1-flash-lite';
export const DEFAULT_GEMINI_THINKING_LEVEL = 'medium';

const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 20000;
const GEMINI_GENERATE_RETRY_DELAYS_MS = [750, 1500];
const GEMINI_THINKING_LEVELS = new Set(['minimal', 'low', 'medium', 'high']);
const GEMINI_MIN_OUTPUT_TOKENS = 1024;
const GEMINI_MAX_OUTPUT_TOKENS = 65536;

export function createGeminiClient(apiKey) {
  return new GoogleGenAI({ apiKey });
}

export function parseGeminiJson(text) {
  const rawText = trimText(text);
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch ? fencedMatch[1] : rawText;

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new ImportResumeError('The AI response could not be parsed. Try another resume file.', {
      statusCode: 502,
      code: 'import/invalid-ai-response',
    });
  }
}

function parseJsonErrorMessage(message) {
  try {
    const parsed = JSON.parse(message);
    return parsed?.error && typeof parsed.error === 'object' ? parsed.error : null;
  } catch {
    return null;
  }
}

function getNumericStatusCode(...values) {
  const numericValue = values.find((value) => {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    return Number.isFinite(Number(value));
  });

  return Number(numericValue || 0);
}

function getQuotaViolations(parsedError) {
  return (Array.isArray(parsedError?.details) ? parsedError.details : [])
    .flatMap((detail) => (Array.isArray(detail?.violations) ? detail.violations : []))
    .map((violation) => ({
      quotaMetric: trimText(violation?.quotaMetric),
      quotaId: trimText(violation?.quotaId),
    }))
    .filter((violation) => violation.quotaMetric || violation.quotaId);
}

function getGeminiErrorDetails(error) {
  const parsedError = parseJsonErrorMessage(error?.message || '');
  const statusCode = getNumericStatusCode(error?.statusCode, error?.code, parsedError?.code, error?.status);
  const status = trimText(parsedError?.status || (Number.isFinite(Number(error?.status)) ? '' : error?.status));
  const message = trimText(parsedError?.message || error?.message);
  const quotaViolations = getQuotaViolations(parsedError);
  const quotaText = [message, ...quotaViolations.flatMap((violation) => [violation.quotaMetric, violation.quotaId])]
    .filter(Boolean)
    .join(' ');
  const isDailyQuota = /(?:per\s*day|perday|requestsperday|daily|rpd)/i.test(quotaText);

  return {
    statusCode,
    status,
    message,
    quotaViolations,
    isDailyQuota,
  };
}

function isRetryableGeminiError(error) {
  const { statusCode, status } = getGeminiErrorDetails(error);

  if (statusCode === 429 || status === 'RESOURCE_EXHAUSTED') {
    return false;
  }

  return (
    [500, 502, 503, 504].includes(statusCode) ||
    ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'INTERNAL'].includes(status)
  );
}

function createGeminiUnavailableError(error, diagnostics = null) {
  const {
    statusCode,
    status,
    message,
    quotaViolations,
    isDailyQuota,
  } = getGeminiErrorDetails(error);
  const providerDiagnostics = {
    ...diagnostics,
    providerStatusCode: statusCode || undefined,
    providerStatus: status || undefined,
    providerMessage: message ? message.slice(0, 500) : undefined,
    providerQuotaViolations: quotaViolations.length > 0 ? quotaViolations : undefined,
    providerIsDailyQuota: isDailyQuota || undefined,
  };

  if (statusCode === 429 || status === 'RESOURCE_EXHAUSTED') {
    return new ImportResumeError(
      isDailyQuota
        ? 'Daily AI import quota reached. Try again after Gemini resets your daily limit.'
        : 'AI import rate limit reached. Try again in a minute.',
      {
        statusCode: 429,
        code: isDailyQuota ? 'import/ai-daily-quota' : 'import/ai-rate-limited',
        diagnostics: providerDiagnostics,
      },
    );
  }

  if (statusCode === 503 || status === 'UNAVAILABLE') {
    return new ImportResumeError('The AI import provider is temporarily unavailable. Try again in a minute.', {
      statusCode: 503,
      code: 'import/ai-unavailable',
      diagnostics: providerDiagnostics,
    });
  }

  return new ImportResumeError(message || 'The AI import service could not process this resume. Try again with another file.', {
    statusCode: statusCode >= 400 && statusCode < 500 ? 502 : 503,
    code: 'import/ai-provider-failed',
    diagnostics: providerDiagnostics,
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isGemini3Model(model) {
  return /(?:^|\/)gemini-3(?:[.-]|$)/i.test(trimText(model));
}

function getGeminiThinkingLevel(env = process.env) {
  const thinkingLevel = trimText(env.GEMINI_THINKING_LEVEL).toLowerCase();

  return GEMINI_THINKING_LEVELS.has(thinkingLevel) ? thinkingLevel : DEFAULT_GEMINI_THINKING_LEVEL;
}

function getGeminiMaxOutputTokens(env = process.env) {
  const parsedValue = Number.parseInt(trimText(env.GEMINI_MAX_OUTPUT_TOKENS), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_GEMINI_MAX_OUTPUT_TOKENS;
  }

  return Math.min(GEMINI_MAX_OUTPUT_TOKENS, Math.max(GEMINI_MIN_OUTPUT_TOKENS, parsedValue));
}

export function createGeminiImportGenerationConfig(model, env = process.env, options = {}) {
  const maxOutputTokens = getGeminiMaxOutputTokens(env);
  const baseConfig = {
    responseMimeType: 'application/json',
    maxOutputTokens,
  };
  const responseConfig = options.responseJsonSchema
    ? { ...baseConfig, responseJsonSchema: options.responseJsonSchema }
    : baseConfig;

  if (!isGemini3Model(model)) {
    return {
      ...responseConfig,
      temperature: 0.1,
    };
  }

  return {
    ...responseConfig,
    thinkingConfig: {
      thinkingLevel: options.thinkingLevel || getGeminiThinkingLevel(env),
    },
  };
}

export async function generateStructuredGeminiResponse({
  ai,
  model,
  contents,
  generationConfig,
  diagnostics = null,
  parseResponse,
}) {
  let lastError;

  for (let attempt = 0; attempt <= GEMINI_GENERATE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: generationConfig,
      });

      return parseResponse(String(response.text || ''));
    } catch (error) {
      lastError = error;

      if (error instanceof ImportResumeError) {
        throw error;
      }

      if (!isRetryableGeminiError(error) || attempt === GEMINI_GENERATE_RETRY_DELAYS_MS.length) {
        break;
      }

      await wait(GEMINI_GENERATE_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw createGeminiUnavailableError(lastError, diagnostics);
}
