// time constants (ms)
export const SAVE_TO_LOCAL_STORAGE_TIMEOUT = 300;
export const INITIAL_SCENE_UPDATE_TIMEOUT = 5000;
export const FILE_UPLOAD_TIMEOUT = 300;
export const LOAD_IMAGES_TIMEOUT = 500;
export const SYNC_FULL_SCENE_INTERVAL_MS = 20000;
export const SYNC_BROWSER_TABS_TIMEOUT = 50;
export const CURSOR_SYNC_TIMEOUT = 33; // ~30fps
export const DELETED_ELEMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 1 day

// should be aligned with MAX_ALLOWED_FILE_BYTES
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB
// 1 year (https://stackoverflow.com/a/25201898/927631)
export const FILE_CACHE_MAX_AGE_SEC = 31536000;

export const WS_EVENTS = {
  SERVER_VOLATILE: "server-volatile-broadcast",
  SERVER: "server-broadcast",
  USER_FOLLOW_CHANGE: "user-follow",
  USER_FOLLOW_ROOM_CHANGE: "user-follow-room-change",
} as const;

export enum WS_SUBTYPES {
  INVALID_RESPONSE = "INVALID_RESPONSE",
  INIT = "SCENE_INIT",
  UPDATE = "SCENE_UPDATE",
  MOUSE_LOCATION = "MOUSE_LOCATION",
  IDLE_STATUS = "IDLE_STATUS",
  USER_VISIBLE_SCENE_BOUNDS = "USER_VISIBLE_SCENE_BOUNDS",
}

export const FIREBASE_STORAGE_PREFIXES = {
  shareLinkFiles: `/files/shareLinks`,
  collabFiles: `/files/rooms`,
};

export const ROOM_ID_BYTES = 10;

export const STORAGE_KEYS = {
  LOCAL_STORAGE_ELEMENTS: "excalidraw",
  LOCAL_STORAGE_APP_STATE: "excalidraw-state",
  LOCAL_STORAGE_COLLAB: "excalidraw-collab",
  LOCAL_STORAGE_THEME: "excalidraw-theme",
  LOCAL_STORAGE_DEBUG: "excalidraw-debug",
  VERSION_DATA_STATE: "version-dataState",
  VERSION_FILES: "version-files",

  IDB_LIBRARY: "excalidraw-library",

  // do not use apart from migrations
  __LEGACY_LOCAL_STORAGE_LIBRARY: "excalidraw-library",
} as const;

/**
 * Check if running in PWA mode (standalone display)
 */
export const isPWAMode = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true || // iOS Safari
    document.referrer.includes("android-app://")
  );
};

/**
 * Generate or get unique window ID for PWA window isolation
 */
export const getWindowId = (): string => {
  const WINDOW_ID_KEY = "excalidraw-window-id";

  // Try to get existing window ID from sessionStorage
  let windowId = sessionStorage.getItem(WINDOW_ID_KEY);

  if (!windowId) {
    // Generate new unique window ID
    windowId = `window_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    sessionStorage.setItem(WINDOW_ID_KEY, windowId);
  }

  return windowId;
};

/**
 * Generate a unique session ID for new windows
 */
export const generateUniqueSessionId = (): string => {
  return `session_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 11)}`;
};

/**
 * Determine if a new session should be created
 * This detects scenarios where content should be isolated
 */
export const shouldCreateNewSession = (): boolean => {
  // Check if this window was opened via launchQueue (file associations)
  // This is indicated by the presence of certain referrer patterns or window.name
  const referrer = document.referrer;
  const windowName = window.name;
  
  // If opened from OS file association or drag-and-drop, create new session
  if (!referrer || windowName.includes("_blank") || window.opener) {
    return true;
  }
  
  // Check if there's a pending file operation in sessionStorage
  // This indicates the window was opened specifically to handle a file
  if (sessionStorage.getItem("pendingFileHandle")) {
    return true;
  }
  
  return false;
};

/**
 * Get session-aware storage keys with PWA window isolation
 * Uses a function-based approach to avoid circular dependencies
 */
export const getSessionStorageKey = (
  baseKey: keyof typeof STORAGE_KEYS | string,
): string => {
  // Avoid circular dependency by accessing sessionManager only when needed
  const actualKey =
    typeof baseKey === "string" ? baseKey : STORAGE_KEYS[baseKey];

  // If in PWA mode, use window ID for isolation
  if (isPWAMode()) {
    const windowId = getWindowId();
    return `${actualKey}:pwa:${windowId}`;
  }

  // For browser tabs, check if we need to create a new session
  const urlParams = new URLSearchParams(window.location.search);
  let sessionId = urlParams.get("session");

  // If no session parameter and this is a new window, create one
  if (!sessionId) {
    // Check if this is a new window that should have its own session
    // This happens when opening files via launchQueue or file associations
    const isNewWindow = shouldCreateNewSession();
    
    if (isNewWindow) {
      sessionId = generateUniqueSessionId();
      // Update the URL to include the new session ID
      urlParams.set("session", sessionId);
      const newUrl = `${window.location.pathname}?${urlParams.toString()}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    } else {
      sessionId = "default";
    }
  }

  if (sessionId === "default") {
    return actualKey; // Backward compatibility for default session
  }

  return `${actualKey}:${sessionId}`;
};

export const COOKIES = {
  AUTH_STATE_COOKIE: "excplus-auth",
} as const;

export const isExcalidrawPlusSignedUser = document.cookie.includes(
  COOKIES.AUTH_STATE_COOKIE,
);
