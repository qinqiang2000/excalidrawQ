import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState, useEffect } from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { LocalData } from "../data/LocalData";
import { t } from "@excalidraw/excalidraw/i18n";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
}> = React.memo((props) => {
  const [recentFiles, setRecentFiles] = useState<Array<{
    id: string;
    name: string;
    lastModified: number;
    isTemporary?: boolean;
  }>>([]);

  // 刷新最近文件列表
  const refreshRecentFiles = () => {
    const files = LocalData.getRecentFiles();
    console.log('🔄 AppMainMenu 刷新最近文件:', files);
    setRecentFiles(files);
  };

  useEffect(() => {
    console.log('🚀 AppMainMenu useEffect 初始化');
    // 初始加载最近文件列表
    refreshRecentFiles();

    // 监听 storage 事件以获取其他标签页的更新
    const handleStorageChange = (e: StorageEvent) => {
      console.log('📡 Storage 事件:', e.key);
      if (e.key === 'excalidraw-recent-files') {
        console.log('🔄 检测到 recent files 变化，刷新菜单');
        refreshRecentFiles();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 定期检查更新（用于同一标签页内的更新）
    const interval = setInterval(() => {
      console.log('⏰ 定期检查最近文件更新');
      refreshRecentFiles();
    }, 5000); // 改为5秒检查一次，减少刷屏

    return () => {
      console.log('🧹 AppMainMenu 清理事件监听器');
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />

      {/* Open Recent 菜单 */}
      {recentFiles.length > 0 && (
        <>
          <MainMenu.Group>
            <MainMenu.Item>
              <strong>打开最近文件</strong>
            </MainMenu.Item>
            {recentFiles.slice(0, 5).map((file) => (
              <MainMenu.Item
                key={file.id}
                onSelect={() => {
                  // 创建一个新的画布来加载最近的文件
                  // 这里简单地刷新页面，实际可以实现更复杂的加载逻辑
                  window.location.reload();
                }}
              >
                {file.name}
                <span style={{
                  fontSize: "0.8em",
                  opacity: 0.7,
                  marginLeft: "8px"
                }}>
                  {new Date(file.lastModified).toLocaleDateString()}
                </span>
              </MainMenu.Item>
            ))}
            {recentFiles.length > 5 && (
              <MainMenu.Item>
                <em>... and {recentFiles.length - 5} more</em>
              </MainMenu.Item>
            )}
            <MainMenu.Item
              onSelect={() => {
                LocalData.clearRecentFiles();
                setRecentFiles([]);
              }}
            >
              清除最近文件
            </MainMenu.Item>
          </MainMenu.Group>
          <MainMenu.Separator />
        </>
      )}

      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={ExcalLogo}
        href={`${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className=""
      >
        Excalidraw+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.ItemLink
        icon={loginIcon}
        href={`${import.meta.env.VITE_APP_PLUS_APP}${
          isExcalidrawPlusSignedUser ? "" : "/sign-up"
        }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
        className="highlighted"
      >
        {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
      </MainMenu.ItemLink>
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onClick={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
