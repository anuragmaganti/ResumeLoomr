export async function fetchWithTimeout(input, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const sourceSignal = init.signal;
  const timeout = Number.isFinite(Number(timeoutMs)) ? Math.max(0, Number(timeoutMs)) : 30_000;
  let removeSourceAbortListener = null;

  if (sourceSignal) {
    const forwardAbort = () => controller.abort(sourceSignal.reason);

    if (sourceSignal.aborted) {
      forwardAbort();
    } else {
      sourceSignal.addEventListener('abort', forwardAbort, { once: true });
      removeSourceAbortListener = () => sourceSignal.removeEventListener('abort', forwardAbort);
    }
  }

  const timeoutId = timeout > 0
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    removeSourceAbortListener?.();
  }
}
