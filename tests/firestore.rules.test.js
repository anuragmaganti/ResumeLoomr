import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

test('firestore is owner-readable and server-write-only', { skip: !FIRESTORE_EMULATOR_HOST }, async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: 'resumeloomr-test',
    firestore: {
      host: FIRESTORE_EMULATOR_HOST.split(':')[0],
      port: Number(FIRESTORE_EMULATOR_HOST.split(':')[1]),
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/user-a/workspace/main').set({ activeResumeId: 'resume-1' });
      await db.doc('users/user-a/resumes/resume-1').set({ resumeId: 'resume-1' });
      await db.doc('users/user-a/resumeTombstones/resume-2').set({ resumeId: 'resume-2' });
      await db.doc('users/user-a/syncCursors/cursor-1').set({ lastSequence: 1 });
    });

    const ownerDb = testEnv.authenticatedContext('user-a').firestore();
    const otherDb = testEnv.authenticatedContext('user-b').firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(ownerDb.doc('users/user-a/workspace/main').get());
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/resume-1').get());
    await assertFails(otherDb.doc('users/user-a/resumes/resume-1').get());
    await assertFails(anonDb.doc('users/user-a/workspace/main').get());

    await assertFails(ownerDb.doc('users/user-a/workspace/main').set({ activeResumeId: 'resume-2' }));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set({ resumeId: 'resume-1' }));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').delete());
    await assertFails(ownerDb.doc('users/user-a/resumeTombstones/resume-2').get());
    await assertFails(ownerDb.doc('users/user-a/syncCursors/cursor-1').get());
  } finally {
    await testEnv.cleanup();
  }
});

test('firestore rules file exists for emulator verification', () => {
  assert.ok(fs.existsSync('firestore.rules'));
});
