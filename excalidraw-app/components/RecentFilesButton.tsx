import React, { useState, useEffect, useRef } from "react";
import { clockIcon } from "@excalidraw/excalidraw/components/icons";
import { LocalData } from "../data/LocalData";
import { t } from "@excalidraw/excalidraw/i18n";

import "./RecentFilesButton.scss";

interface RecentFile {
  id: string;
  name: string;
  lastModified: number;
  isTemporary?: boolean;
  description?: string;
}

export const RecentFilesButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
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

  const handleFileSelect = (file: RecentFile) => {
    console.log('🖱️ 点击最近文件:', { id: file.id, name: file.name });

    // 检查 excalidrawAPI 是否可用
    const api = (window as any).excalidrawAPI;
    if (!api) {
      console.error('❌ excalidrawAPI 不可用');
      window.location.reload();
      return;
    }

    // 加载临时场景数据
    const sceneData = LocalData.loadTemporaryScene(file.id);
    console.log('📂 场景数据加载结果:', sceneData ? '成功' : '失败');

    if (sceneData) {
      console.log('📊 场景数据详情:', {
        elements: sceneData.elements?.length || 0,
        appState: Object.keys(sceneData.appState || {}),
        files: Object.keys(sceneData.files || {}).length
      });

      try {
        // 使用 excalidrawAPI 加载场景
        api.updateScene({
          elements: sceneData.elements || [],
          appState: {
            ...sceneData.appState,
            name: file.name,
          }
        });

        // 如果有文件数据，也要加载
        if (sceneData.files && Object.keys(sceneData.files).length > 0) {
          api.addFiles(Object.values(sceneData.files));
        }

        console.log('✅ 场景加载完成:', file.name);
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
            {recentFiles.slice(0, 8).map((file) => {
              return (
                <div
                  key={file.id}
                  className="recent-files-menu-item"
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="recent-file-name">
                    <span className="file-name-text">{file.name}</span>
                    <span className="recent-file-date"> ({file.description || '图形画板'})</span>
                  </div>
                </div>
              );
            })}
            {recentFiles.length > 8 && (
              <div className="recent-files-menu-item recent-files-more">
                <em>还有 {recentFiles.length - 8} 个文件</em>
              </div>
            )}
            <div className="recent-files-menu-separator"></div>
            <div
              className="recent-files-menu-item recent-files-clear"
              onClick={handleClearRecentFiles}
            >
              清除最近文件
            </div>
          </div>
        </div>
      )}
    </div>
  );
};