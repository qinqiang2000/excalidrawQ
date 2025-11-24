import {
  CODES,
  DEFAULT_SIDEBAR,
  FRAME_ORDER_TAB,
  KEYS,
  LIBRARY_SIDEBAR_TAB,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getFrameLikeElements,
} from "@excalidraw/element";

import { SidebarIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleSidebar = register({
  name: "toggleSidebar",
  icon: SidebarIcon,
  keywords: ["sidebar", "panel", "library"],
  label: "toolBar.sidebar",
  viewMode: true,
  trackEvent: {
    category: "menu",
    action: "toggleSidebar",
  },
  perform(elements, appState, _, app) {
    const isOpen = appState.openSidebar?.name === DEFAULT_SIDEBAR.name;

    if (isOpen) {
      return {
        appState: {
          ...appState,
          openSidebar: null,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    // 当画布有多个frame时，默认显示"演示顺序"tab
    const frames = getFrameLikeElements(elements);
    const defaultTab =
      frames.length > 1 ? FRAME_ORDER_TAB : LIBRARY_SIDEBAR_TAB;

    return {
      appState: {
        ...appState,
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: defaultTab },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) =>
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.B,
});
