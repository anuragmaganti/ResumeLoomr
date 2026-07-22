const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function trapTabKey(event, container, { activeElement = globalThis.document?.activeElement } = {}) {
  if (event.key !== 'Tab') {
    return false;
  }

  const focusableElements = Array.from(container?.querySelectorAll?.(FOCUSABLE_SELECTOR) || []);

  if (focusableElements.length === 0) {
    return false;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  const nextElement = event.shiftKey && activeElement === firstElement
    ? lastElement
    : !event.shiftKey && activeElement === lastElement
      ? firstElement
      : null;

  if (!nextElement) {
    return false;
  }

  event.preventDefault();
  nextElement.focus();
  return true;
}
