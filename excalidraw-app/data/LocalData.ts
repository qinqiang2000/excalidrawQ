/**
 * This file deals with saving data state (appState, elements, images, ...)
 * locally to the browser.
 *
 * Notes:
 *
 * - DataState refers to full state of the app: appState, elements, images,
 *   though some state is saved separately (collab username, library) for one
 *   reason or another. We also save different data to different storage
 *   (localStorage, indexedDB).
 */

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  debounce,
} from "@excalidraw/common";
import { clearElementsForLocalStorage } from "@excalidraw/element";
import { saveAsJSON } from "@excalidraw/excalidraw/data";
import { isImageFileHandle } from "@excalidraw/excalidraw/data/blob";
import {
  createStore,
  entries,
  del,
  getMany,
  set,
  setMany,
  get,
} from "idb-keyval";

import type { LibraryPersistedData } from "@excalidraw/excalidraw/data/library";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";
import type { MaybePromise } from "@excalidraw/common/utility-types";
import type { FileSystemHandle } from "@excalidraw/excalidraw/data/filesystem";

import {
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  STORAGE_KEYS,
  getSessionStorageKey,
  isPWAMode,
  getWindowId,
} from "../app_constants";

import { FileManager } from "./FileManager";
import { Locker } from "./Locker";
import { updateBrowserStateVersion } from "./tabSync";

// Get storage ID for IndexedDB isolation (PWA window ID or URL session)
const getStorageId = () => {
  if (isPWAMode()) {
    return `pwa-${getWindowId()}`;
  }

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("session") || "default";
};

const storageId = getStorageId();
const filesStore = createStore(`files-db-${storageId}`, "files-store");
const fileHandleStore = createStore(
  `fileHandle-db-${storageId}`,
  "fileHandle-store",
);

class LocalFileManager extends FileManager {
  clearObsoleteFiles = async (opts: { currentFileIds: FileId[] }) => {
    await entries(filesStore).then((entries) => {
      for (const [id, imageData] of entries as [FileId, BinaryFileData][]) {
        // if image is unused (not on canvas) & is older than 1 day, delete it
        // from storage. We check `lastRetrieved` we care about the last time
        // the image was used (loaded on canvas), not when it was initially
        // created.
        if (
          (!imageData.lastRetrieved ||
            Date.now() - imageData.lastRetrieved > 24 * 3600 * 1000) &&
          !opts.currentFileIds.includes(id as FileId)
        ) {
          del(id, filesStore);
        }
      }
    });
  };
}

const saveDataStateToLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  try {
    const _appState = clearAppStateForLocalStorage(appState);

    if (
      _appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      _appState.openSidebar.tab === CANVAS_SEARCH_TAB
    ) {
      _appState.openSidebar = null;
    }

    localStorage.setItem(
      getSessionStorageKey(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      JSON.stringify(clearElementsForLocalStorage(elements)),
    );
    localStorage.setItem(
      getSessionStorageKey(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
      JSON.stringify(_appState),
    );
    updateBrowserStateVersion("VERSION_DATA_STATE");
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

type SavingLockTypes = "collaboration";

export class LocalData {
  // Content hash cache to prevent unnecessary saves
  private static lastSavedContentHash: string | null = null;
  private static lastFileContentHash: string | null = null;

  // Simple hash function for content comparison
  private static hashContent(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): string {
    // Create a simplified representation for hashing
    const contentToHash = {
      elements: elements.map((el) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        isDeleted: el.isDeleted,
        // Include other properties that affect content
        ...("text" in el && { text: el.text }),
        ...("fileId" in el && { fileId: el.fileId }),
      })),
      appState: {
        name: appState.name,
        fileHandle: appState.fileHandle ? "has_file" : null,
        // Add other relevant appState properties
      },
      fileIds: Object.keys(files).sort(),
    };

    // Simple hash using JSON stringify and basic hash function
    const str = JSON.stringify(contentToHash);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  // Auto-save to associated file with longer debounce to avoid frequent file writes
  private static _saveToFile = debounce(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      // Only auto-save to file if we have a fileHandle and it's not an image file
      if (appState.fileHandle && !isImageFileHandle(appState.fileHandle)) {
        // Calculate current content hash for file saving
        const currentFileHash = this.hashContent(elements, appState, files);

        // Skip saving if content hasn't changed
        if (this.lastFileContentHash === currentFileHash) {
          return;
        }

        try {
          await saveAsJSON(
            elements,
            appState,
            files,
            appState.name || "Untitled",
          );
          // Update file content hash after successful save
          this.lastFileContentHash = currentFileHash;
        } catch (error: any) {
          // Silent failure to avoid disrupting user experience
          // Only log to console for debugging
          console.warn("Auto-save to file failed:", error);
        }
      }
    },
    2000, // 2 second debounce to avoid frequent file writes
  );

  private static _save = debounce(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      onFilesSaved: () => void,
    ) => {
      // Calculate current content hash
      const currentHash = this.hashContent(elements, appState, files);

      // Skip saving if content hasn't changed
      if (this.lastSavedContentHash === currentHash) {
        onFilesSaved(); // Still call callback to maintain expected behavior
        return;
      }

      saveDataStateToLocalStorage(elements, appState);

      // Save FileHandle to IndexedDB separately since it can't be JSON serialized
      await this.saveFileHandle(appState.fileHandle);

      // Trigger auto-save to associated file (non-blocking)
      this._saveToFile(elements, appState, files);

      await this.fileStorage.saveFiles({
        elements,
        files,
      });

      // Update content hash after successful save
      this.lastSavedContentHash = currentHash;

      onFilesSaved();
    },
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

  /** Saves DataState, including files. Bails if saving is paused */
  static save = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    onFilesSaved: () => void,
  ) => {
    // we need to make the `isSavePaused` check synchronously (undebounced)
    if (!this.isSavePaused()) {
      this._save(elements, appState, files, onFilesSaved);
    }
  };

  static flushSave = () => {
    this._save.flush();
  };

  static flushFileAutoSave = () => {
    this._saveToFile.flush();
  };

  private static locker = new Locker<SavingLockTypes>();

  static pauseSave = (lockType: SavingLockTypes) => {
    this.locker.lock(lockType);
  };

  static resumeSave = (lockType: SavingLockTypes) => {
    this.locker.unlock(lockType);
  };

  static isSavePaused = () => {
    return document.hidden || this.locker.isLocked();
  };

  // ---------------------------------------------------------------------------
  // FileHandle storage methods
  // ---------------------------------------------------------------------------

  /** Save FileHandle to IndexedDB */
  static saveFileHandle = async (fileHandle: FileSystemHandle | null) => {
    try {
      if (fileHandle) {
        await set("currentFileHandle", fileHandle, fileHandleStore);
      } else {
        await del("currentFileHandle", fileHandleStore);
      }
    } catch (error) {
      console.warn("Failed to save fileHandle to IndexedDB:", error);
    }
  };

  /** Load FileHandle from IndexedDB */
  static loadFileHandle = async (): Promise<FileSystemHandle | null> => {
    try {
      return (await get("currentFileHandle", fileHandleStore)) || null;
    } catch (error) {
      console.warn("Failed to load fileHandle from IndexedDB:", error);
      return null;
    }
  };

  // ---------------------------------------------------------------------------

  static fileStorage = new LocalFileManager({
    getFiles(ids) {
      return getMany(ids, filesStore).then(
        async (filesData: (BinaryFileData | undefined)[]) => {
          const loadedFiles: BinaryFileData[] = [];
          const erroredFiles = new Map<FileId, true>();

          const filesToSave: [FileId, BinaryFileData][] = [];

          filesData.forEach((data, index) => {
            const id = ids[index];
            if (data) {
              const _data: BinaryFileData = {
                ...data,
                lastRetrieved: Date.now(),
              };
              filesToSave.push([id, _data]);
              loadedFiles.push(_data);
            } else {
              erroredFiles.set(id, true);
            }
          });

          try {
            // save loaded files back to storage with updated `lastRetrieved`
            setMany(filesToSave, filesStore);
          } catch (error) {
            console.warn(error);
          }

          return { loadedFiles, erroredFiles };
        },
      );
    },
    async saveFiles({ addedFiles }) {
      const savedFiles = new Map<FileId, BinaryFileData>();
      const erroredFiles = new Map<FileId, BinaryFileData>();

      // before we use `storage` event synchronization, let's update the flag
      // optimistically. Hopefully nothing fails, and an IDB read executed
      // before an IDB write finishes will read the latest value.
      updateBrowserStateVersion("VERSION_FILES");

      await Promise.all(
        [...addedFiles].map(async ([id, fileData]) => {
          try {
            await set(id, fileData, filesStore);
            savedFiles.set(id, fileData);
          } catch (error: any) {
            console.error(error);
            erroredFiles.set(id, fileData);
          }
        }),
      );

      return { savedFiles, erroredFiles };
    },
  });

  // ---------------------------------------------------------------------------
  // Recent files management
  // ---------------------------------------------------------------------------

  // 存储最近文件的 key
  private static RECENT_FILES_KEY = "excalidraw-recent-files";

  /**
   * 添加到最近文件列表
   */
  static addToRecentFiles = (fileInfo: {
    id: string;
    name: string;
    lastModified: number;
    isTemporary?: boolean;
  }) => {
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      const recentFiles = stored ? JSON.parse(stored) : [];

      // 去重并限制数量（最多10个）
      const updated = [
        fileInfo,
        ...recentFiles.filter((f: any) => f.id !== fileInfo.id)
      ].slice(0, 10);

      localStorage.setItem(this.RECENT_FILES_KEY, JSON.stringify(updated));
      console.log('✅ 成功添加到最近文件:', fileInfo.name);
    } catch (error) {
      console.error("❌ Failed to update recent files:", error);
    }
  };

  /**
   * 获取最近文件列表
   */
  static getRecentFiles = (): Array<{
    id: string;
    name: string;
    lastModified: number;
    isTemporary?: boolean;
  }> => {
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  /**
   * 清除最近文件列表
   */
  static clearRecentFiles = () => {
    localStorage.removeItem(this.RECENT_FILES_KEY);
  };

  /**
   * 保存临时场景数据 (用于最近文件)
   */
  static saveTemporaryScene = (
    id: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    try {
      const sceneData = {
        elements: clearElementsForLocalStorage(elements),
        appState: clearAppStateForLocalStorage(appState),
        files: Object.fromEntries(
          Object.entries(files).map(([fileId, fileData]) => [
            fileId,
            {
              mimeType: fileData.mimeType,
              id: fileData.id,
              dataURL: fileData.dataURL,
              created: fileData.created,
            },
          ])
        ),
      };
      localStorage.setItem(`excalidraw-temp-scene-${id}`, JSON.stringify(sceneData));
    } catch (error) {
      console.error("❌ Failed to save temporary scene:", error);
    }
  };

  /**
   * 加载临时场景数据 (用于最近文件)
   */
  static loadTemporaryScene = (id: string): {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  } | null => {
    try {
      const key = `excalidraw-temp-scene-${id}`;
      const stored = localStorage.getItem(key);

      if (stored) {
        const sceneData = JSON.parse(stored);
        console.log('📂 成功加载场景数据:', id, '元素数量:', sceneData.elements?.length || 0);
        return sceneData;
      } else {
        console.warn('📂 找不到场景数据:', id, '存储键:', key);

        // 调试：列出所有相关的存储键
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('excalidraw-temp-scene-'));
        console.log('🔍 现有场景存储键:', allKeys);
      }
    } catch (error) {
      console.error("❌ 加载场景数据出错:", error);
    }
    return null;
  };
}
export class LibraryIndexedDBAdapter {
  /** IndexedDB database and store name */
  private static idb_name = STORAGE_KEYS.IDB_LIBRARY;
  /** library data store key */
  private static key = "libraryData";

  private static getStorageId = () => {
    if (isPWAMode()) {
      return `pwa-${getWindowId()}`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("session") || "default";
  };

  private static store = createStore(
    `${
      LibraryIndexedDBAdapter.idb_name
    }-db-${LibraryIndexedDBAdapter.getStorageId()}`,
    `${LibraryIndexedDBAdapter.idb_name}-store`,
  );

  static async load() {
    const IDBData = await get<LibraryPersistedData>(
      LibraryIndexedDBAdapter.key,
      LibraryIndexedDBAdapter.store,
    );

    return IDBData || null;
  }

  static save(data: LibraryPersistedData): MaybePromise<void> {
    return set(
      LibraryIndexedDBAdapter.key,
      data,
      LibraryIndexedDBAdapter.store,
    );
  }
}

/** LS Adapter used only for migrating LS library data
 * to indexedDB */
export class LibraryLocalStorageMigrationAdapter {
  static load() {
    const LSData = localStorage.getItem(
      getSessionStorageKey(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY),
    );
    if (LSData != null) {
      const libraryItems: ImportedDataState["libraryItems"] =
        JSON.parse(LSData);
      if (libraryItems) {
        return { libraryItems };
      }
    }
    return null;
  }
  static clear() {
    localStorage.removeItem(
      getSessionStorageKey(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY),
    );
  }
}
