import React, { useState, useEffect, useRef } from "react";
import { clockIcon } from "@excalidraw/excalidraw/components/icons";
import { LocalData } from "../data/LocalData";
import { t } from "@excalidraw/excalidraw/i18n";
import { KEYS } from "@excalidraw/common";

import "./RecentFilesButton.scss";

interface RecentFile {
  id: string;
  name: string;
  lastModified: number;
  isTemporary?: boolean;
  description?: string;
}

interface RecentFilesButtonProps {
  isOpenedByKeyboard?: boolean;
  onKeyboardClose?: () => void;
}

export const RecentFilesButton: React.FC<RecentFilesButtonProps> = ({
  isOpenedByKeyboard = false,
  onKeyboardClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [keyboardNavigationIndex, setKeyboardNavigationIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 刷新最近文件列表
  const refreshRecentFiles = () => {
    const files = LocalData.getRecentFiles();
    setRecentFiles(files);
  };

  useEffect(() => {
    // 初始加载最近文件列表
    refreshRecentFiles();

    // 监听 storage 事件以获取其他标签页的更新
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'excalidraw-recent-files') {
        refreshRecentFiles();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 定期检查更新（用于同一标签页内的更新）
    const interval = setInterval(() => {
      refreshRecentFiles();
    }, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 创建与显示顺序一致的文件数组
  const getDisplayFiles = () => {
    const normalFiles = recentFiles.filter(file => !file.isTemporary);
    const tempFiles = recentFiles.filter(file => file.isTemporary);
    const maxDisplayFiles = 6;

    const displayedNormalFiles = normalFiles.slice(0, Math.ceil(maxDisplayFiles / 2));
    const displayedTempFiles = tempFiles.slice(0, Math.floor(maxDisplayFiles / 2));

    return [...displayedNormalFiles, ...displayedTempFiles];
  };

  // 键盘导航处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      const allFiles = getDisplayFiles();

      switch (event.key) {
        case KEYS.ARROW_DOWN:
          event.preventDefault();
          setKeyboardNavigationIndex((prevIndex) => {
            const nextIndex = prevIndex >= allFiles.length - 1 ? 0 : prevIndex + 1;
            return nextIndex;
          });
          break;

        case KEYS.ARROW_UP:
          event.preventDefault();
          setKeyboardNavigationIndex((prevIndex) => {
            const nextIndex = prevIndex <= 0 ? allFiles.length - 1 : prevIndex - 1;
            return nextIndex;
          });
          break;

        case KEYS.ENTER:
          event.preventDefault();
          event.stopPropagation();
          if (keyboardNavigationIndex >= 0 && keyboardNavigationIndex < allFiles.length) {
            handleFileSelect(allFiles[keyboardNavigationIndex]);
          }
          break;

        case KEYS.ESCAPE:
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          setKeyboardNavigationIndex(-1);
          if (onKeyboardClose) {
            onKeyboardClose();
          }
          break;
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  }, [isOpen, keyboardNavigationIndex, recentFiles, onKeyboardClose]);

  // 监听来自 action 的打开事件
  useEffect(() => {
    const handleToggleRecentFiles = () => {
      setIsOpen(prevOpen => {
        if (!prevOpen) {
          // 打开时重置键盘导航索引
          setKeyboardNavigationIndex(getDisplayFiles().length > 0 ? 0 : -1);
        }
        return !prevOpen;
      });
    };

    window.addEventListener('toggle-recent-files', handleToggleRecentFiles);
    return () => window.removeEventListener('toggle-recent-files', handleToggleRecentFiles);
  }, [recentFiles.length]);

  // 当通过键盘快捷键打开时
  useEffect(() => {
    if (isOpenedByKeyboard && !isOpen) {
      setIsOpen(true);
      setKeyboardNavigationIndex(getDisplayFiles().length > 0 ? 0 : -1);
    }
  }, [isOpenedByKeyboard, isOpen, recentFiles.length]);

  const handleFileSelect = async (file: RecentFile) => {
    // 检查 excalidrawAPI 是否可用
    const api = (window as any).excalidrawAPI;
    if (!api) {
      console.error('❌ excalidrawAPI 不可用');
      window.location.reload();
      return;
    }

    // 加载临时场景数据
    const sceneData = LocalData.loadTemporaryScene(file.id);

    if (sceneData) {
      try {
        // 尝试恢复该文件的 fileHandle
        const fileHandle = await LocalData.loadFileHandleForFile(file.id);

        // 使用 excalidrawAPI 加载场景
        api.updateScene({
          elements: sceneData.elements || [],
          appState: {
            ...sceneData.appState,
            name: file.name,
            fileHandle: fileHandle || null,  // 恢复该文件的 fileHandle，如果没有则为 null
          }
        });

        // 如果有文件数据，也要加载
        if (sceneData.files && Object.keys(sceneData.files).length > 0) {
          api.addFiles(Object.values(sceneData.files));
        }

        // 关键修复：更新当前文件ID追踪，防止文件内容相互覆盖
        (window as any).__currentTempFileId = file.id;

        setIsOpen(false); // 加载成功后关闭菜单
      } catch (error) {
        console.error('❌ 场景加载失败:', error);
        window.location.reload();
      }
    } else {
      console.warn('❌ 无法找到场景数据，刷新页面');
      window.location.reload();
    }
  };

  const handleClearRecentFiles = () => {
    LocalData.clearRecentFiles();
    setRecentFiles([]);
    setIsOpen(false);
  };

  // 如果没有最近文件，不显示按钮
  if (recentFiles.length === 0) {
    return null;
  }

  return (
    <div className="recent-files-button-container">
      <button
        ref={buttonRef}
        className="recent-files-button"
        onClick={() => setIsOpen(!isOpen)}
        title="打开最近文件"
        aria-label="打开最近文件"
      >
        {clockIcon}
      </button>

      {isOpen && (
        <div ref={menuRef} className="recent-files-menu">
          <div className="recent-files-menu-header">
            <strong>最近文件</strong>
          </div>
          <div className="recent-files-menu-content">
            {(() => {
              // 分离正式文件和临时文件
              const normalFiles = recentFiles.filter(file => !file.isTemporary);
              const tempFiles = recentFiles.filter(file => file.isTemporary);
              const maxDisplayFiles = 6;
              const displayFiles = getDisplayFiles();

              return (
                <>
                  {/* 正式文件区域 */}
                  {normalFiles.length > 0 && (
                    <>
                      <div className="recent-files-section-header">
                        <span className="section-icon">📄</span>
                        <span className="section-title">最近打开</span>
                      </div>
                      {normalFiles.slice(0, Math.ceil(maxDisplayFiles / 2)).map((file, index) => {
                        const globalIndex = displayFiles.findIndex(f => f.id === file.id);
                        const isKeyboardSelected = keyboardNavigationIndex === globalIndex;
                        return (
                          <div
                            key={file.id}
                            className={`recent-files-menu-item normal-file ${isKeyboardSelected ? 'keyboard-selected' : ''}`}
                            onClick={() => handleFileSelect(file)}
                          >
                            <div className="recent-file-name">
                              <span className="file-icon">📄</span>
                              <span className="file-name-text">{file.name}</span>
                              <span className="recent-file-date"> ({file.description || '图形画板'})</span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* 临时文件区域 */}
                  {tempFiles.length > 0 && (
                    <>
                      {normalFiles.length > 0 && <div className="recent-files-section-separator"></div>}
                      <div className="recent-files-section-header">
                        <span className="section-icon">🕐</span>
                        <span className="section-title">临时文件</span>
                      </div>
                      {tempFiles.slice(0, Math.floor(maxDisplayFiles / 2)).map((file, index) => {
                        const globalIndex = displayFiles.findIndex(f => f.id === file.id);
                        const isKeyboardSelected = keyboardNavigationIndex === globalIndex;
                        return (
                          <div
                            key={file.id}
                            className={`recent-files-menu-item temp-file ${isKeyboardSelected ? 'keyboard-selected' : ''}`}
                            onClick={() => handleFileSelect(file)}
                          >
                            <div className="recent-file-name">
                              <span className="file-icon">🕐</span>
                              <span className="file-name-text">{file.name}</span>
                              <span className="recent-file-date"> ({file.description || '图形画板'})</span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* 显示更多文件的提示 */}
                  {recentFiles.length > maxDisplayFiles && (
                    <div className="recent-files-menu-item recent-files-more">
                      <em>还有 {recentFiles.length - maxDisplayFiles} 个文件</em>
                    </div>
                  )}

                  {/* 底部操作 */}
                  <div className="recent-files-menu-separator"></div>
                  <div
                    className="recent-files-menu-item recent-files-clear"
                    onClick={handleClearRecentFiles}
                  >
                    清除最近文件
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};