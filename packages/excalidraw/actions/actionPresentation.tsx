import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { register } from "@excalidraw/excalidraw/actions/register";
import { presentIcon } from "@excalidraw/excalidraw/components/icons";
import { KEYS } from "@excalidraw/common/keys";
import { sortFramesByPresentationOrder } from "@excalidraw/element/frame";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

export const actionPresent = register({
  name: "present",
  label: "labels.present",
  icon: presentIcon,
  trackEvent: { category: "canvas" },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.code === "F5",
  perform: (_, appState, __, app) => {
    const allFrames = app.scene
      .getNonDeletedElements()
      .filter((e) => e.type === "frame") as ExcalidrawFrameLikeElement[];

    if (allFrames.length === 0) {
      return { captureUpdate: CaptureUpdateAction.NEVER };
    }

    // Sort frames using presentation order
    const sortedFrames = sortFramesByPresentationOrder(allFrames);

    const selectedElementIds = appState.selectedElementIds;
    const selectedFrames = app.scene
      .getSelectedElements({ selectedElementIds })
      .filter((e) => e.type === "frame") as ExcalidrawFrameLikeElement[];

    let frameIndex = 0;
    if (selectedFrames.length !== 0) {
      // Find the index of the first selected frame in the sorted array
      const firstSelectedId = selectedFrames[0].id;
      frameIndex = sortedFrames.findIndex((f) => f.id === firstSelectedId);
      if (frameIndex === -1) {
        frameIndex = 0;
      }
    }

    // Enter presentation mode in current window with fullscreen
    return {
      appState: {
        ...appState,
        presentationMode: {
          enabled: true,
          frameIndex,
          previousState: {
            selectedElementIds: appState.selectedElementIds,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
            frameRendering: appState.frameRendering,
          },
        },
        frameRendering: {
          ...appState.frameRendering,
          outline: false,
          name: false,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
