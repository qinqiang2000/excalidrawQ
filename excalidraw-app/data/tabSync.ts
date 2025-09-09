import { STORAGE_KEYS, getSessionStorageKey } from "../app_constants";

// in-memory state (this tab's current state) versions. Currently just
// timestamps of the last time the state was saved to browser storage.
// Session-aware versions to support multi-window independence
const LOCAL_STATE_VERSIONS: { [key: string]: number } = {};

// Initialize session-specific version keys
const initVersionKeys = () => {
  const sessionVersionDataKey = getSessionStorageKey(
    STORAGE_KEYS.VERSION_DATA_STATE,
  );
  const sessionVersionFilesKey = getSessionStorageKey(
    STORAGE_KEYS.VERSION_FILES,
  );

  if (!(sessionVersionDataKey in LOCAL_STATE_VERSIONS)) {
    LOCAL_STATE_VERSIONS[sessionVersionDataKey] = -1;
  }
  if (!(sessionVersionFilesKey in LOCAL_STATE_VERSIONS)) {
    LOCAL_STATE_VERSIONS[sessionVersionFilesKey] = -1;
  }
};

// Initialize on module load
initVersionKeys();

type BrowserStateTypes = keyof typeof STORAGE_KEYS;

export const isBrowserStorageStateNewer = (type: BrowserStateTypes) => {
  initVersionKeys(); // Ensure keys are initialized
  const sessionKey = getSessionStorageKey(STORAGE_KEYS[type]);
  const storageTimestamp = JSON.parse(localStorage.getItem(sessionKey) || "-1");
  return storageTimestamp > LOCAL_STATE_VERSIONS[sessionKey];
};

export const updateBrowserStateVersion = (type: BrowserStateTypes) => {
  initVersionKeys(); // Ensure keys are initialized
  const timestamp = Date.now();
  const sessionKey = getSessionStorageKey(STORAGE_KEYS[type]);
  try {
    localStorage.setItem(sessionKey, JSON.stringify(timestamp));
    LOCAL_STATE_VERSIONS[sessionKey] = timestamp;
  } catch (error) {
    console.error("error while updating browser state verison", error);
  }
};

export const resetBrowserStateVersions = () => {
  initVersionKeys(); // Ensure keys are initialized
  try {
    const keys: BrowserStateTypes[] = ["VERSION_DATA_STATE", "VERSION_FILES"];
    for (const key of keys) {
      const sessionKey = getSessionStorageKey(STORAGE_KEYS[key]);
      const timestamp = -1;
      localStorage.setItem(sessionKey, JSON.stringify(timestamp));
      LOCAL_STATE_VERSIONS[sessionKey] = timestamp;
    }
  } catch (error) {
    console.error("error while resetting browser state verison", error);
  }
};
