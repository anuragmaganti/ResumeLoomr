import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* global process */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

function createWorkspaceDoc() {
  return {
    schemaVersion: 1,
    activeResumeId: 'resume-1',
    resumeIds: ['resume-1'],
    meta: {
      'resume-1': {
        name: 'Resume 1',
        updatedAt: '2026-06-23T12:00:00.000Z',
      },
    },
    updatedAt: '2026-06-23T12:00:00.000Z',
    version: 1,
    deviceId: 'device-1',
  };
}

function createResumeDoc() {
  return {
    schemaVersion: 1,
    resumeId: 'resume-1',
    name: 'Resume 1',
    template: 'modern',
    sectionOrder: ['personal', 'education', 'experience'],
    resume: {
      settings: {
        textSize: 0,
        horizontalMargins: 0,
        verticalMargins: 0,
        lineSpacing: 0,
        sectionSpacing: 0,
        entrySpacing: 0,
        headingSize: 0,
        nameSize: 0,
      },
      personal: {
        name: 'Ada Lovelace',
      },
    },
    savedAt: '2026-06-23T12:00:00.000Z',
    updatedAt: '2026-06-23T12:00:00.000Z',
    version: 1,
    deviceId: 'device-1',
    deletedAt: null,
  };
}

test('firestore rules protect user resume data', { skip: !FIRESTORE_EMULATOR_HOST }, async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: 'resumeloomr-test',
    firestore: {
      host: FIRESTORE_EMULATOR_HOST.split(':')[0],
      port: Number(FIRESTORE_EMULATOR_HOST.split(':')[1]),
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const ownerDb = testEnv.authenticatedContext('user-a').firestore();
    const otherDb = testEnv.authenticatedContext('user-b').firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc()));
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc()));
    await assertFails(otherDb.doc('users/user-a/resumes/resume-1').get());
    await assertFails(anonDb.doc('users/user-a/workspace/main').get());
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set({
      ...createResumeDoc(),
      template: 'unknown',
    }));
  } finally {
    await testEnv.cleanup();
  }
});

test('firestore rules file exists for emulator verification', () => {
  assert.ok(fs.existsSync('firestore.rules'));
});
