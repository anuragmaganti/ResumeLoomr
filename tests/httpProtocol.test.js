import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPublicError,
  HttpProtocolError,
  parseCookieHeader,
  readJsonRequestBody,
  sendPrivateError,
  sendPrivateJson,
} from '../server/httpProtocol.js';
import { FirebaseAdminError } from '../server/firebaseAdmin.js';
import { ImportResumeError } from '../server/resumeImport/error.js';

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

test('public error responses expose only explicitly safe details', () => {
  const fallback = {
    code: 'request/failed',
    message: 'The request failed.',
  };
  const privateError = Object.assign(new Error('Database credentials are invalid.'), {
    code: 'database/internal',
  });
  const publicError = new HttpProtocolError('The request body is invalid.', {
    statusCode: 400,
    code: 'request/invalid',
  });

  assert.deepEqual(createPublicError(privateError, fallback), fallback);
  assert.deepEqual(createPublicError(publicError, fallback), {
    code: 'request/invalid',
    message: 'The request body is invalid.',
  });
});

test('server error classes default 5xx details to private', () => {
  const fallback = {
    code: 'request/failed',
    message: 'The request failed.',
  };
  const firebaseError = new FirebaseAdminError('Firebase Admin is not configured.');
  const importError = new ImportResumeError('Provider account details are invalid.', {
    statusCode: 503,
    code: 'import/provider-failed',
  });
  const curatedImportError = new ImportResumeError('The import provider is temporarily unavailable.', {
    statusCode: 503,
    code: 'import/provider-unavailable',
    expose: true,
  });

  assert.deepEqual(createPublicError(firebaseError, fallback), fallback);
  assert.deepEqual(createPublicError(importError, fallback), fallback);
  assert.deepEqual(createPublicError(curatedImportError, fallback), {
    code: 'import/provider-unavailable',
    message: 'The import provider is temporarily unavailable.',
  });
});

test('private error responses keep internal details out of the response body', () => {
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

  sendPrivateError(response, 500, new Error('FIREBASE_SERVICE_ACCOUNT_JSON is malformed.'), {
    code: 'sync/failed',
    message: 'Could not sync resumes.',
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: 'sync/failed',
      message: 'Could not sync resumes.',
    },
  });
  assert.equal(headers.get('Cache-Control'), 'private, no-store, max-age=0');
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
