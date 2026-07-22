import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEditorEntryIdentity,
  getPreviewEditorInputMode,
  getPreviewEditorMutation,
  isPreviewEditorTargetMultiline,
  mapDisplayedCaretOffsetToSource,
  parseEditorTargetPath,
  readResumeEditorTargetValue,
} from '../src/lib/editorTargets.js';

test('displayed caret offsets map to exact and trimmed source values', () => {
  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'Frontend Engineer',
    sourceValue: 'Frontend Engineer',
    displayOffset: 8,
  }), 8);

  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'Frontend Engineer',
    sourceValue: '  Frontend Engineer  ',
    displayOffset: 8,
  }), 10);
});

test('displayed caret offsets account for hidden URL parts and bullet markers', () => {
  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'example.com/work',
    sourceValue: 'https://www.example.com/work/',
    displayOffset: 7,
  }), 'https://www.'.length + 7);

  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'Built an accessible editor',
    sourceValue: '• Built an accessible editor',
    displayOffset: 5,
  }), 7);
});

test('displayed caret offset mapping handles Unicode, samples, and invalid offsets safely', () => {
  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'A😀B',
    sourceValue: 'A😀B',
    displayOffset: 3,
  }), 3);

  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'Sample Name',
    sourceValue: '',
    displayOffset: 8,
    isPlaceholder: true,
  }), 0);

  assert.equal(mapDisplayedCaretOffsetToSource({
    displayText: 'Short',
    sourceValue: 'Short',
    displayOffset: 100,
  }), 5);
});

test('preview editor mutations cover every existing resume update path', () => {
  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'personal',
    field: 'name',
  }, 'Ada'), {
    type: 'personal',
    args: ['name', 'Ada'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'personal',
    field: 'summaryTitle',
  }, 'Profile'), {
    type: 'personal',
    args: ['summaryTitle', 'Profile'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'experience',
    field: '__title',
  }, 'Work'), {
    type: 'sectionTitle',
    args: ['experience', 'Work'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'experience',
    entryId: 'role-1',
    field: 'activities',
    itemIndex: 2,
  }, 'Shipped it'), {
    type: 'textList',
    args: ['experience', 'role-1', 'activities', 2, 'Shipped it'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'education',
    entryId: 'school-1',
    field: 'degree',
    nestedPath: 'programs.1.degree',
  }, 'M.S. Computer Science'), {
    type: 'educationProgram',
    args: ['education', 'school-1', 1, 'degree', 'M.S. Computer Science'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'education',
    entryId: 'school-1',
    field: 'content',
    nestedPath: 'customSections.0.content',
  }, 'Robotics club'), {
    type: 'educationCustomSection',
    args: ['education', 'school-1', 0, 'content', 'Robotics club'],
  });

  assert.deepEqual(getPreviewEditorMutation({
    sectionId: 'projects',
    entryId: 'project-1',
    field: 'summary',
  }, 'Built a compiler'), {
    type: 'entry',
    args: ['projects', 'project-1', 'summary', 'Built a compiler'],
  });
});

test('preview editor values resolve personal, section, entry, list, and nested fields', () => {
  const resume = {
    personal: { name: 'Ada Lovelace', summaryTitle: 'Profile' },
    sections: [{
      id: 'education',
      title: 'Education',
      entries: [{
        id: 'school-1',
        school: 'University of London',
        highlights: ['Mathematics'],
        programs: [{ degree: 'Mathematics' }],
      }],
    }],
  };

  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'personal',
    field: 'name',
  }), 'Ada Lovelace');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'personal',
    field: 'summaryTitle',
  }), 'Profile');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'education',
    field: '__title',
  }), 'Education');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'education',
    entryId: 'school-1',
    field: 'school',
  }), 'University of London');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'education',
    entryId: 'school-1',
    field: 'highlights',
    itemIndex: 0,
  }), 'Mathematics');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'education',
    entryId: 'school-1',
    field: 'degree',
    nestedPath: 'programs.0.degree',
  }), 'Mathematics');
  assert.equal(readResumeEditorTargetValue(resume, {
    sectionId: 'education',
    entryId: 'missing',
    field: 'school',
  }), null);
});

test('preview proxy metadata preserves multiline and keyboard intent', () => {
  assert.equal(isPreviewEditorTargetMultiline({ field: 'aboutMe' }), true);
  assert.equal(isPreviewEditorTargetMultiline({ field: 'activities', itemIndex: 0 }), true);
  assert.equal(isPreviewEditorTargetMultiline({ field: 'content', nestedPath: 'customSections.0.content' }), true);
  assert.equal(isPreviewEditorTargetMultiline({ field: 'company' }), false);

  assert.equal(getPreviewEditorInputMode({ sectionId: 'personal', field: 'email' }), 'email');
  assert.equal(getPreviewEditorInputMode({ sectionId: 'personal', field: 'phone' }), 'tel');
  assert.equal(getPreviewEditorInputMode({ sectionId: 'personal', field: 'portfolioUrl' }), 'url');
  assert.equal(getPreviewEditorInputMode({ sectionId: 'experience', field: 'company' }), 'text');
});

test('editor entry identities cover entry, list, and nested paths', () => {
  assert.deepEqual(
    getEditorEntryIdentity('sections.experience.entry-2.activities.1'),
    { sectionId: 'experience', entryId: 'entry-2' },
  );
  assert.deepEqual(
    getEditorEntryIdentity('sections.education.entry-3.programs.0.degree'),
    { sectionId: 'education', entryId: 'entry-3' },
  );
  assert.equal(getEditorEntryIdentity('sections.experience.__title'), null);
  assert.equal(getEditorEntryIdentity('personal.name'), null);

  assert.deepEqual(parseEditorTargetPath('sections.education.entry-3.programs.0.degree'), {
    sectionId: 'education',
    entryId: 'entry-3',
    field: 'degree',
    nestedPath: 'programs.0.degree',
    path: 'sections.education.entry-3.programs.0.degree',
  });
  assert.deepEqual(parseEditorTargetPath('sections.experience.entry-2.activities.1'), {
    sectionId: 'experience',
    entryId: 'entry-2',
    field: 'activities',
    itemIndex: 1,
    path: 'sections.experience.entry-2.activities.1',
  });
});
