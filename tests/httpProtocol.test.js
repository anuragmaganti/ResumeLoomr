import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCookieHeader, sendPrivateJson } from '../server/httpProtocol.js';

test('private JSON responses disable caching and content sniffing', () => {
  const headers = new Map();
  const response = {
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      headers.set(name, value);
    },
    end(body) {
      this.body = body;
    },
  };

  sendPrivateJson(response, 200, { ok: true });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '{"ok":true}');
  assert.equal(headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
});

test('cookie parsing tolerates malformed percent encoding', () => {
  const cookies = parseCookieHeader('__session=valid%20value; malformed=%E0%A4%A; flag');

  assert.equal(cookies.__session, 'valid value');
  assert.equal(cookies.malformed, '%E0%A4%A');
  assert.equal(cookies.flag, '');
});
