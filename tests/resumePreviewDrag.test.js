import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areCompatiblePreviewDragItems,
  bulletDragId,
  entryDragId,
  moveIdWithinOrder,
  normalizePreviewSortableTransform,
  parsePreviewDragId,
  personalContactDragId,
  previewVerticalListSortingStrategy,
  sectionDragId,
} from '../src/components/resumePreviewDrag.js';

test('preview drag ids retain their typed scope', () => {
  assert.deepEqual(parsePreviewDragId(sectionDragId('experience')), {
    type: 'section',
    sectionId: 'experience',
  });
  assert.deepEqual(parsePreviewDragId(entryDragId('experience', 'role-2')), {
    type: 'entry',
    sectionId: 'experience',
    entryId: 'role-2',
  });
  assert.deepEqual(parsePreviewDragId(bulletDragId('experience', 'role-2', 'activities', 3)), {
    type: 'bullet',
    sectionId: 'experience',
    entryId: 'role-2',
    field: 'activities',
    itemIndex: 3,
  });
  assert.deepEqual(parsePreviewDragId(personalContactDragId('email')), {
    type: 'personalContact',
    field: 'email',
  });
});

test('preview drag compatibility prevents cross-entry and cross-section moves', () => {
  assert.equal(areCompatiblePreviewDragItems(
    parsePreviewDragId(entryDragId('experience', 'role-1')),
    parsePreviewDragId(entryDragId('experience', 'role-2')),
  ), true);
  assert.equal(areCompatiblePreviewDragItems(
    parsePreviewDragId(entryDragId('experience', 'role-1')),
    parsePreviewDragId(entryDragId('education', 'school-1')),
  ), false);
  assert.equal(areCompatiblePreviewDragItems(
    parsePreviewDragId(bulletDragId('experience', 'role-1', 'activities', 0)),
    parsePreviewDragId(bulletDragId('experience', 'role-2', 'activities', 0)),
  ), false);
  assert.equal(areCompatiblePreviewDragItems(
    parsePreviewDragId(sectionDragId('experience')),
    parsePreviewDragId(sectionDragId('education')),
  ), true);
});

test('preview drag transforms compensate for page scaling without changing item scale', () => {
  assert.deepEqual(normalizePreviewSortableTransform({ x: 20, y: -12, scaleX: 1, scaleY: 1 }, 0.5), {
    x: 40,
    y: -24,
    scaleX: 1,
    scaleY: 1,
  });
  assert.deepEqual(normalizePreviewSortableTransform({ x: 20, y: -12 }, 1), { x: 20, y: -12 });
});

test('preview list reordering and variable-height displacement preserve insertion behavior', () => {
  assert.deepEqual(moveIdWithinOrder(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
  assert.deepEqual(moveIdWithinOrder(['a', 'b'], 'missing', 'b'), ['a', 'b']);

  const rects = [
    { top: 0, height: 40 },
    { top: 48, height: 80 },
    { top: 136, height: 30 },
  ];

  assert.deepEqual(previewVerticalListSortingStrategy({
    activeIndex: 0,
    activeNodeRect: rects[0],
    index: 1,
    rects,
    overIndex: 2,
  }), {
    x: 0,
    y: -48,
    scaleX: 1,
    scaleY: 1,
  });
});
