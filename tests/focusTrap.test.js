import assert from 'node:assert/strict';
import test from 'node:test';

import { trapTabKey } from '../src/lib/focusTrap.js';

function createFocusable() {
  return {
    focusCount: 0,
    focus() {
      this.focusCount += 1;
    },
  };
}

function createKeyEvent({ key = 'Tab', shiftKey = false } = {}) {
  return {
    key,
    shiftKey,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

test('focus trap wraps Tab and Shift+Tab at dialog boundaries', () => {
  const first = createFocusable();
  const middle = createFocusable();
  const last = createFocusable();
  const container = { querySelectorAll: () => [first, middle, last] };
  const forwardEvent = createKeyEvent();
  const backwardEvent = createKeyEvent({ shiftKey: true });

  assert.equal(trapTabKey(forwardEvent, container, { activeElement: last }), true);
  assert.equal(forwardEvent.prevented, true);
  assert.equal(first.focusCount, 1);
  assert.equal(trapTabKey(backwardEvent, container, { activeElement: first }), true);
  assert.equal(backwardEvent.prevented, true);
  assert.equal(last.focusCount, 1);
});

test('focus trap leaves non-boundary and non-Tab events untouched', () => {
  const first = createFocusable();
  const middle = createFocusable();
  const last = createFocusable();
  const container = { querySelectorAll: () => [first, middle, last] };
  const middleEvent = createKeyEvent();
  const escapeEvent = createKeyEvent({ key: 'Escape' });

  assert.equal(trapTabKey(middleEvent, container, { activeElement: middle }), false);
  assert.equal(middleEvent.prevented, false);
  assert.equal(trapTabKey(escapeEvent, container, { activeElement: last }), false);
  assert.equal(escapeEvent.prevented, false);
});
