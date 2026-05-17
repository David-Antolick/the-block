// Namespaced localStorage wrapper (D003). Parse failures and missing keys
// fall back to caller defaults rather than throw — bid persistence should
// never break the page.

const NAMESPACE = 'openlane-block:';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(NAMESPACE + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // Quota / serialization failure. In-memory state remains valid.
  }
}
