import test from 'node:test';
import assert from 'node:assert/strict';

import importResumeHandler from '../api/import-resume.js';
import syncSessionHandler from '../api/sync-session.js';
import syncWorkspaceHandler from '../api/sync-workspace.js';

function createResponse() {
  const headers = new Map();

  return {
    body: '',
    headers,
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name, value);
    },
    end(body = '') {
      this.body = body;
    },
  };
}

async function expectMethodNotAllowed(handler, method, allowedMethods) {
  const response = createResponse();

  await handler({ headers: {}, method }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.get('Allow'), allowedMethods);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.match(JSON.parse(response.body).error.code, /method-not-allowed$/);
}

test('deployed API routes reject unsupported methods before authentication', async () => {
  await expectMethodNotAllowed(importResumeHandler, 'GET', 'POST');
  await expectMethodNotAllowed(syncSessionHandler, 'PATCH', 'POST, DELETE');
  await expectMethodNotAllowed(syncWorkspaceHandler, 'DELETE', 'GET, POST');
});

test('deleting a sync session clears the private HTTP-only cookie', async () => {
  const response = createResponse();

  await syncSessionHandler({ headers: {}, method: 'DELETE' }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.match(response.headers.get('Set-Cookie'), /^__session=;/);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly/);
  assert.match(response.headers.get('Set-Cookie'), /SameSite=Strict/);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
});
