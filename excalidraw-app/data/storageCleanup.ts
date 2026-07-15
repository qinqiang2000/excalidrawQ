/**
 * Cleanup of orphaned session-scoped browser storage.
 *
 * Historically, a bug in session detection created a fresh isolated session
 * (`?session=...` / PWA `window_...`) on every direct visit. Each session
 * writes a full copy of the scene under its own localStorage keys and its own
 * IndexedDB databases. Those copies become unreachable the moment the window
 * closes (the session id lives only in the URL / sessionStorage), so they
 * accumulate until localStorage exceeds its quota — at which point every
 * save (auto-save, recent files, library) starts throwing QuotaExceededError.
 *
 * This module garbage-collects such orphans and provides a quota-recovering
 * setItem wrapper so a poisoned browser heals itself.
 */

import { isPWAMode, getWindowId } from "../app_constants";

/** session/window ids embed their creation timestamp:
 *  `session_1757696957762_un80p99o9`, `window_1757812087642_6xlomlfcm` */
const SESSION_SCOPED_KEY_RE =
  /^[\w-]+:(?:pwa:)?((?:session|window)_(\d+)_[a-z0-9]+)$/i;

const TEMP_SCENE_PREFIX = "excalidraw-temp-scene-";
const RECENT_FILES_KEY = "excalidraw-recent-files";

/** sessions older than this and not belonging to the current window are
 * considered dead (their id is unrecoverable once the window closed) */
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const getCurrentSessionSuffix = (): string | null => {
  if (isPWAMode()) {
    return getWindowId();
  }
  return new URLSearchParams(window.location.search).get("session");
};

export const isQuotaExceededError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === "QuotaExceededError" ||
    // legacy Firefox name
    error.name === "NS_ERROR_DOM_QUOTA_REACHED");

/**
 * Remove localStorage keys belonging to dead sessions and temp scenes no
 * longer referenced by the recent-files list.
 *
 * @param opts.aggressive when recovering from a full quota, also drop
 *   session-scoped keys younger than the age threshold (any concurrently
 *   open window re-writes its keys on the next change, so worst case is
 *   losing a copy that was about to be orphaned anyway)
 */
export const cleanupOrphanedLocalStorage = (
  opts: { aggressive?: boolean } = {},
): number => {
  let removed = 0;
  try {
    const currentSuffix = getCurrentSessionSuffix();
    const now = Date.now();

    let referencedTempSceneKeys: Set<string> | null = null;
    try {
      const recentFiles = JSON.parse(
        localStorage.getItem(RECENT_FILES_KEY) || "[]",
      ) as { id?: string }[];
      referencedTempSceneKeys = new Set(
        recentFiles
          .filter((file) => file.id)
          .map((file) => `${TEMP_SCENE_PREFIX}${file.id}`),
      );
    } catch {
      // unparsable recent-files list — keep temp scenes to be safe
      referencedTempSceneKeys = null;
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) {
        continue;
      }

      const sessionMatch = key.match(SESSION_SCOPED_KEY_RE);
      if (sessionMatch) {
        const [, sessionId, timestamp] = sessionMatch;
        if (sessionId === currentSuffix) {
          continue;
        }
        const age = now - Number(timestamp);
        if (opts.aggressive || age > ORPHAN_MAX_AGE_MS) {
          keysToRemove.push(key);
        }
        continue;
      }

      if (
        referencedTempSceneKeys &&
        key.startsWith(TEMP_SCENE_PREFIX) &&
        !referencedTempSceneKeys.has(key)
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
      removed++;
    }
    if (removed > 0) {
      console.info(
        `storageCleanup: removed ${removed} orphaned localStorage key(s)`,
      );
    }
  } catch (error) {
    console.warn("storageCleanup: localStorage cleanup failed", error);
  }
  return removed;
};

/** matches `files-db-…`, `fileHandle-db-…`, `excalidraw-library-db-…`
 *  suffixed with a session/pwa-window storage id */
const SESSION_SCOPED_IDB_RE =
  /^[\w-]+-db-(?:pwa-)?((?:session|window)_(\d+)_[a-z0-9]+)$/i;

/** Delete IndexedDB databases created for dead sessions (images, file
 * handles, per-session libraries). Fire-and-forget; requires
 * indexedDB.databases() (Chromium / recent Safari & Firefox). */
export const cleanupOrphanedIndexedDB = async (): Promise<void> => {
  try {
    if (!indexedDB?.databases) {
      return;
    }
    const currentSuffix = getCurrentSessionSuffix();
    const now = Date.now();
    const databases = await indexedDB.databases();

    for (const db of databases) {
      const match = db.name?.match(SESSION_SCOPED_IDB_RE);
      if (!match) {
        continue;
      }
      const [, sessionId, timestamp] = match;
      if (sessionId === currentSuffix) {
        continue;
      }
      if (now - Number(timestamp) > ORPHAN_MAX_AGE_MS) {
        indexedDB.deleteDatabase(db.name!);
      }
    }
  } catch (error) {
    console.warn("storageCleanup: IndexedDB cleanup failed", error);
  }
};

/**
 * localStorage.setItem that recovers from a full quota by aggressively
 * garbage-collecting orphaned session data and retrying once.
 * Throws if the write still fails after cleanup.
 */
export const setLocalStorageItemWithQuotaRecovery = (
  key: string,
  value: string,
): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }
    console.warn(
      `storageCleanup: quota exceeded writing "${key}", cleaning up orphaned data and retrying`,
    );
    cleanupOrphanedLocalStorage({ aggressive: true });
    localStorage.setItem(key, value);
  }
};

/** Run the full garbage collection. Safe to call on every startup. */
export const runStorageCleanup = (): void => {
  cleanupOrphanedLocalStorage();
  // async, non-blocking
  cleanupOrphanedIndexedDB();
};
