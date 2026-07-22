export function sendPrivateJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
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
