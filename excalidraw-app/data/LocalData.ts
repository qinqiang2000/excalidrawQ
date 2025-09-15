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
   * 生成唯一文件ID (包含时间戳和随机数)
   */
  private static generateUniqueId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${random}`;
  };

  /**
   * 获取下一个可用的文件序号
   */
  private static getNextFileNumber = (): number => {
    const COUNTER_KEY = 'excalidraw-file-counter';
    const stored = localStorage.getItem(COUNTER_KEY);
    const current = stored ? parseInt(stored, 10) : 1;
    localStorage.setItem(COUNTER_KEY, String(current + 1));
    return current;
  };

  /**
   * 生成基于序号的文件名
   */
  private static generateSequentialFileName = (): string => {
    const number = this.getNextFileNumber();
    return `画板-${String(number).padStart(3, '0')}`;
  };

  /**
   * 生成时间戳字符串 (YYYYMMDD_HHMM格式)
   */
  private static formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}_${hour}${minute}`;
  };

  /**
   * 基于白板内容生成简单描述
   */
  private static generateContentDescription = (elements: readonly ExcalidrawElement[]): string => {
    // 过滤掉删除的元素
    const activeElements = elements.filter(el => !el.isDeleted);

    if (activeElements.length === 0) {
      return '空白画板';
    }

    // 查找文本元素
    const textElements = activeElements.filter(el => el.type === 'text' && 'text' in el && el.text.trim());

    if (textElements.length > 0) {
      return '包含文字';
    }

    // 统计图形类型
    const elementTypes = activeElements.reduce((acc, el) => {
      acc[el.type] = (acc[el.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 基于主要图形类型生成描述
    const typeNames = {
      rectangle: '矩形',
      ellipse: '椭圆',
      diamond: '菱形',
      line: '线条',
      arrow: '箭头',
      freedraw: '手绘',
      image: '图片',
      frame: '框架'
    };

    const mainType = Object.entries(elementTypes)
      .sort(([,a], [,b]) => b - a)[0];

    if (mainType) {
      const [type, count] = mainType;
      const typeName = typeNames[type as keyof typeof typeNames] || type;
      return count > 1 ? `${typeName}图形 (${count}个)` : `${typeName}图形`;
    }

    return `${activeElements.length}个图形`;
  };

  /**
   * 生成带时间戳的描述
   */
  private static generateDescriptionWithTime = (
    elements: readonly ExcalidrawElement[],
    timestamp: number
  ): string => {
    const contentDesc = this.generateContentDescription(elements);
    const timeStr = this.formatTimestamp(timestamp);
    return `${contentDesc} ${timeStr}`;
  };

  /**
   * 为常规文件生成时间戳描述（仅时间戳）
   */
  static generateTimestampOnlyDescription = (timestamp: number): string => {
    return this.formatTimestamp(timestamp);
  };

  /**
   * 添加到最近文件列表
   */
  static addToRecentFiles = (fileInfo: {
    id?: string;
    name: string;
    lastModified: number;
    isTemporary?: boolean;
    description?: string;
  }) => {
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      const recentFiles = stored ? JSON.parse(stored) : [];

      // 生成唯一ID (如果没有提供)
      const finalFileInfo = {
        ...fileInfo,
        id: fileInfo.id || this.generateUniqueId()
      };

      // 检查是否已存在相同ID或名称的文件
      const existingIndex = recentFiles.findIndex((f: any) =>
        f.id === finalFileInfo.id || f.name === finalFileInfo.name
      );

      let updated: any[];
      if (existingIndex >= 0) {
        // 更新已存在的文件信息（更新时间戳）
        const existingFile = recentFiles[existingIndex];
        recentFiles[existingIndex] = {
          ...existingFile,
          lastModified: finalFileInfo.lastModified
        };

        // 将更新的文件移到最前面
        updated = [
          recentFiles[existingIndex],
          ...recentFiles.filter((_: any, index: number) => index !== existingIndex)
        ];
      } else {
        // 新文件，添加到最前面并限制数量（最多10个）
        updated = [
          finalFileInfo,
          ...recentFiles
        ].slice(0, 10);
      }

      localStorage.setItem(this.RECENT_FILES_KEY, JSON.stringify(updated));

      return finalFileInfo.id;
    } catch (error) {
      console.error("❌ Failed to update recent files:", error);
    }
  };

  /**
   * 获取最近文件列表 (按更新时间降序排列)
   */
  static getRecentFiles = (): Array<{
    id: string;
    name: string;
    lastModified: number;
    isTemporary?: boolean;
    description?: string;
  }> => {
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      const files = stored ? JSON.parse(stored) : [];
      // 按更新时间降序排列 (最新的在前面)
      return files.sort((a: any, b: any) => b.lastModified - a.lastModified);
    } catch {
      return [];
    }
  };

  /**
   * 清除最近文件列表及对应的场景数据
   */
  static clearRecentFiles = () => {
    // 获取现有文件列表
    const recentFiles = this.getRecentFiles();

    // 清除对应的场景数据
    recentFiles.forEach(file => {
      if (file.isTemporary) {
        localStorage.removeItem(`excalidraw-temp-scene-${file.id}`);
      }
    });

    // 清除文件列表
    localStorage.removeItem(this.RECENT_FILES_KEY);

    // 清除会话文件ID
    delete (window as any).__currentTempFileId;
  };

  /**
   * 更新最近文件的最后修改时间
   */
  static updateRecentFileTime = (fileId: string) => {
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      const recentFiles = stored ? JSON.parse(stored) : [];
      const fileIndex = recentFiles.findIndex((f: any) => f.id === fileId);

      if (fileIndex >= 0) {
        const timestamp = Date.now();
        const file = recentFiles[fileIndex];

        // 更新时间戳
        recentFiles[fileIndex].lastModified = timestamp;

        // 根据文件类型更新描述
        if (!file.isTemporary) {
          // 常规文件：只显示时间戳
          recentFiles[fileIndex].description = this.generateTimestampOnlyDescription(timestamp);
        }
        // 临时文件保持现有描述不变，因为它们通过 updateExistingTemporaryScene 更新

        // 将更新的文件移到最前面
        const updatedFile = recentFiles[fileIndex];
        const updatedList = [
          updatedFile,
          ...recentFiles.filter((_: any, index: number) => index !== fileIndex)
        ];

        localStorage.setItem(this.RECENT_FILES_KEY, JSON.stringify(updatedList));
      }
    } catch (error) {
      console.error("❌ Failed to update recent file time:", error);
    }
  };


  /**
   * 更新已存在文件的内容和描述
   */
  static updateExistingTemporaryScene = (
    fileId: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): void => {
    const timestamp = Date.now();
    const descriptionWithTime = this.generateDescriptionWithTime(elements, timestamp);

    // 更新场景数据
    this.saveTemporaryScene(fileId, elements, appState, files);

    // 更新最近文件列表中的描述和时间戳
    try {
      const stored = localStorage.getItem(this.RECENT_FILES_KEY);
      const recentFiles = stored ? JSON.parse(stored) : [];
      const fileIndex = recentFiles.findIndex((f: any) => f.id === fileId);

      if (fileIndex >= 0) {
        recentFiles[fileIndex].description = descriptionWithTime;
        recentFiles[fileIndex].lastModified = timestamp;
        localStorage.setItem(this.RECENT_FILES_KEY, JSON.stringify(recentFiles));
      }
    } catch (error) {
      // Silent error to avoid console spam
    }
  };

  /**
   * 保存临时场景数据并生成序号文件名 (用于最近文件)
   */
  static saveTemporarySceneWithSequentialName = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): { id: string; name: string } => {
    const timestamp = Date.now();

    // 生成序号文件名和带时间戳的描述
    const sequentialName = this.generateSequentialFileName();
    const descriptionWithTime = this.generateDescriptionWithTime(elements, timestamp);
    const uniqueId = this.generateUniqueId();

    // 保存场景数据
    this.saveTemporaryScene(uniqueId, elements, appState, files);

    // 添加到最近文件列表
    this.addToRecentFiles({
      id: uniqueId,
      name: sequentialName,
      description: descriptionWithTime,
      lastModified: timestamp,
      isTemporary: true
    });

    return { id: uniqueId, name: sequentialName };
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
        return sceneData;
      }
    } catch (error) {
      // Silent error to avoid console spam
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
