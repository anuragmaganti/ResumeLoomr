export const CLOUD_WORKSPACE_RESUME_LIMIT = 100;
export const CLOUD_TRUSTED_DEVICE_KEY = 'resumeloomr:firebase-trusted-device';
export const CLOUD_DEVICE_ID_KEY = 'resumeloomr:firebase-device-id';
export const CLOUD_SESSION_ID_KEY = 'resumeloomr:firebase-session-id';

function createCloudId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function getCloudDeviceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingDeviceId = window.localStorage.getItem(CLOUD_DEVICE_ID_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId = createCloudId('device');
  window.localStorage.setItem(CLOUD_DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
}

export function getCloudSessionId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingSessionId = window.sessionStorage.getItem(CLOUD_SESSION_ID_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createCloudId('session');
  window.sessionStorage.setItem(CLOUD_SESSION_ID_KEY, nextSessionId);
  return nextSessionId;
}

export function getTrustedDevicePreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CLOUD_TRUSTED_DEVICE_KEY) === 'true';
}

export function setTrustedDevicePreference(value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CLOUD_TRUSTED_DEVICE_KEY, value ? 'true' : 'false');
}
