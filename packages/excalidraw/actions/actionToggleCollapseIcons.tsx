import { CaptureUpdateAction } from "@excalidraw/element";

import { collapseIconsIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleCollapseIcons = register({
  name: "toggleCollapseIcons",
  icon: collapseIconsIcon,
  keywords: ["collapse", "expand", "flowchart", "tree"],
  label: "labels.showCollapseIcons",
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
});
