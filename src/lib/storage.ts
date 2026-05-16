// Tiny localStorage wrapper. Every key gets the `openlane-block:` namespace
// (per D003) so we never collide with anything else hosted on the same
// origin. Parse failures and missing keys fall back to the caller's default
// rather than throwing — bid persistence should never break the page.

const NAMESPACE = 'openlane-block:';

function getStorage(): Storage | null {
  // SSR / non-browser guard. The prototype is client-only, but importing
  // this module from a test or build-time tool shouldn't crash.
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read a namespaced JSON value. Returns `fallback` on missing key, parse
 * failure, or when localStorage is unavailable. The returned shape is not
 * validated against `T` — callers should treat untrusted reads accordingly.
 */
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

/**
 * Write a namespaced JSON value. Silently no-ops if localStorage is
 * unavailable or throws (e.g. quota exceeded, Safari private mode).
 */
export function writeJSON<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // Quota or serialization failure. Bids in memory remain valid for the
    // session; future writes can succeed once space is freed.
  }
}
