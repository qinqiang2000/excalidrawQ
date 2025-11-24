import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { collapseIconsIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleCollapseIcons = register({
  name: "toggleCollapseIcons",
  icon: collapseIconsIcon,
  keywords: ["mind", "mindmap", "collapse", "expand", "flowchart", "tree"],
  label: "labels.collapseIcons",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.showCollapseIcons,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showCollapseIcons: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.showCollapseIcons,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.M,
});
