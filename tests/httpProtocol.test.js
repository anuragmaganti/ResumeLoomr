import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCookieHeader,
  readJsonRequestBody,
  sendPrivateJson,
} from '../server/httpProtocol.js';

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

test('JSON request parsing accepts pre-parsed and streamed bodies', async () => {
  const parsedBody = { operations: [{ id: 'one' }] };
  const streamedRequest = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{"operations":');
      yield Buffer.from('[{"id":"two"}]}');
    },
  };

  assert.equal(await readJsonRequestBody({ body: parsedBody }), parsedBody);
  assert.deepEqual(await readJsonRequestBody(streamedRequest), {
    operations: [{ id: 'two' }],
  });
});

test('JSON request parsing reports malformed and oversized bodies', async () => {
  await assert.rejects(
    readJsonRequestBody({ body: '{invalid' }),
    (error) => error?.statusCode === 400 && error?.code === 'http/invalid-json',
  );
  await assert.rejects(
    readJsonRequestBody({ body: '12345' }, { maxBytes: 4 }),
    (error) => error?.statusCode === 413 && error?.code === 'http/body-too-large',
  );
});
