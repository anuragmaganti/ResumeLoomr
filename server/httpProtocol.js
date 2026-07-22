const DEFAULT_MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;

export class HttpProtocolError extends Error {
  constructor(message, {
    statusCode = 400,
    code = 'http/invalid-request',
    expose = statusCode < 500,
  } = {}) {
    super(message);
    this.name = 'HttpProtocolError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
  }
}

export function sendPrivateJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

export function createPublicError(error, fallback) {
  const fallbackError = {
    code: String(fallback?.code || 'request/failed'),
    message: String(fallback?.message || 'The request could not be completed.'),
  };

  if (error?.expose !== true) {
    return fallbackError;
  }

  return {
    code: String(error?.code || fallbackError.code),
    message: String(error?.message || fallbackError.message),
  };
}

export function sendPrivateError(res, statusCode, error, fallback) {
  sendPrivateJson(res, statusCode, {
    error: createPublicError(error, fallback),
  });
}

function assertBodySize(byteLength, maxBytes) {
  if (byteLength > maxBytes) {
    throw new HttpProtocolError('The request body is too large.', {
      statusCode: 413,
      code: 'http/body-too-large',
    });
  }
}

function parseJsonText(rawBody) {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpProtocolError('The request body is not valid JSON.', {
      statusCode: 400,
      code: 'http/invalid-json',
    });
  }
}

export async function readJsonRequestBody(req, { maxBytes = DEFAULT_MAX_JSON_BODY_BYTES } = {}) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
      const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      assertBodySize(bodyBuffer.byteLength, maxBytes);
      return parseJsonText(bodyBuffer.toString('utf8'));
    }

    if (req.body !== null && typeof req.body === 'object') {
      let serializedBody;

      try {
        serializedBody = JSON.stringify(req.body);
      } catch {
        throw new HttpProtocolError('The request body is not valid JSON.', {
          statusCode: 400,
          code: 'http/invalid-json',
        });
      }

      assertBodySize(Buffer.byteLength(serializedBody), maxBytes);
      return req.body;
    }

    throw new HttpProtocolError('The request body is not valid JSON.', {
      statusCode: 400,
      code: 'http/invalid-json',
    });
  }

  const chunks = [];
  let byteLength = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    byteLength += buffer.byteLength;
    assertBodySize(byteLength, maxBytes);
    chunks.push(buffer);
  }

  return parseJsonText(Buffer.concat(chunks).toString('utf8'));
}

function decodeCookiePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseCookieHeader(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader || '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf('=');

        if (separatorIndex < 0) {
          return [decodeCookiePart(cookie), ''];
        }

        return [
          decodeCookiePart(cookie.slice(0, separatorIndex)),
          decodeCookiePart(cookie.slice(separatorIndex + 1)),
        ];
      }),
  );
}
