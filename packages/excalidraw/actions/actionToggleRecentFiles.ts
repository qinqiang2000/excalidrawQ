import { KEYS } from "@excalidraw/common";

import { register } from "./register";

export const actionToggleRecentFiles = register({
  name: "toggleRecentFiles",
  keywords: ["recent", "files", "open", "history"],
  label: "buttons.toggleRecentFiles",
  viewMode: true,
  trackEvent: {
    category: "menu",
    action: "toggle",
  },
  perform(elements, appState, _, app) {
    if (appState.openDialog) {
      return false;
    }

    // 触发最近文件弹窗的显示
    // 这里我们需要与 RecentFilesButton 组件通信
    // 通过自定义事件的方式触发
    const event = new CustomEvent("toggle-recent-files");
    window.dispatchEvent(event);

    return false; // 不改变 appState，由组件自己处理显示状态
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.E,
});
