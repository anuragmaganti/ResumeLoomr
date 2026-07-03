import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

function createWorkspaceDoc(overrides = {}) {
  const resumeIds = overrides.resumeIds || ['resume-1'];
  const activeResumeId = overrides.activeResumeId || resumeIds[0];
  const meta = overrides.meta || Object.fromEntries(
    resumeIds.map((resumeId, index) => [
      resumeId,
      {
        name: `Resume ${index + 1}`,
        updatedAt: '2026-06-23T12:00:00.000Z',
      },
    ]),
  );

  return {
    schemaVersion: 1,
    activeResumeId,
    resumeIds,
    meta,
    updatedAt: '2026-06-23T12:00:00.000Z',
    version: 1,
    deviceId: 'device-1',
    sessionId: 'session-1',
  };
}

function createResumeDoc(overrides = {}) {
  const resumeId = overrides.resumeId || 'resume-1';
  const baseDoc = {
    schemaVersion: 1,
    resumeId,
    name: 'Resume 1',
    template: 'compact',
    resume: {
      personal: {
        name: 'Ada Lovelace',
        headline: '',
        location: '',
        phone: '',
        email: '',
        linkedinUrl: '',
        portfolioUrl: '',
        githubUrl: '',
        customField: '',
        aboutMe: '',
      },
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
      sampleDisplay: {
        hasStarted: false,
        showInformation: true,
      },
      sections: [
        {
          id: 'experience',
          kind: 'roles',
          title: 'Experience',
          entries: [],
        },
      ],
    },
    savedAt: '2026-06-23T12:00:00.000Z',
    updatedAt: '2026-06-23T12:00:00.000Z',
    version: 1,
    deviceId: 'device-1',
    sessionId: 'session-1',
    deletedAt: null,
  };

  return {
    ...baseDoc,
    ...overrides,
    name: overrides.name || baseDoc.name,
    resume: overrides.resume || baseDoc.resume,
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
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc({
      resume: Object.fromEntries(
        Object.entries(createResumeDoc().resume).filter(([key]) => key !== 'sampleDisplay'),
      ),
    })));
    await assertFails(otherDb.doc('users/user-a/resumes/resume-1').get());
    await assertFails(anonDb.doc('users/user-a/workspace/main').get());
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set({
      ...createResumeDoc(),
      template: 'unknown',
    }));
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/resume-1').delete());
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/missing-resume').delete());
    await assertFails(otherDb.doc('users/user-a/resumes/resume-2').delete());
    await assertSucceeds(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc({
      activeResumeId: 'resume-2',
      resumeIds: ['resume-2'],
    })));
    await assertSucceeds(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc({
      activeResumeId: 'resume-100',
      resumeIds: Array.from({ length: 100 }, (_, index) => `resume-${index + 1}`),
    })));
    await assertFails(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc({
      activeResumeId: 'resume-101',
      resumeIds: Array.from({ length: 101 }, (_, index) => `resume-${index + 1}`),
    })));
    await assertFails(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc({
      activeResumeId: 'resume-1',
      resumeIds: ['resume-2'],
    })));
    await assertFails(ownerDb.doc('users/user-a/workspace/main').set(createWorkspaceDoc({
      meta: {
        'resume-1': {
          name: 'Resume 1',
          updatedAt: '2026-06-23T12:00:00.000Z',
        },
        'resume-extra': {
          name: 'Extra',
          updatedAt: '2026-06-23T12:00:00.000Z',
        },
      },
    })));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc({
      resume: {
        ...createResumeDoc().resume,
        sections: [],
      },
    })));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc({
      resume: {
        ...createResumeDoc().resume,
        sampleDisplay: {
          hasStarted: 'yes',
          showInformation: true,
        },
      },
    })));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set({
      ...createResumeDoc(),
      ['section' + 'Order']: ['personal', 'experience'],
    }));
    await assertSucceeds(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc({
      resume: {
        ...createResumeDoc().resume,
        sections: Array.from({ length: 100 }, (_, index) => ({
          id: `section-${index}`,
          kind: 'custom',
          title: `Section ${index}`,
          entries: [],
        })),
      },
    })));
    await assertFails(ownerDb.doc('users/user-a/resumes/resume-1').set(createResumeDoc({
      resume: {
        ...createResumeDoc().resume,
        sections: Array.from({ length: 101 }, (_, index) => ({
          id: `section-${index}`,
          kind: 'custom',
          title: `Section ${index}`,
          entries: [],
        })),
      },
    })));
  } finally {
    await testEnv.cleanup();
  }
});

test('firestore rules file exists for emulator verification', () => {
  assert.ok(fs.existsSync('firestore.rules'));
});
