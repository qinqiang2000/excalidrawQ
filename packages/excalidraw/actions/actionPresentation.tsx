import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { register } from "@excalidraw/excalidraw/actions/register";
import { presentIcon } from "@excalidraw/excalidraw/components/icons";
import { KEYS } from "@excalidraw/common/keys";

export const actionPresent = register({
  name: "present",
  label: "labels.present",
  icon: presentIcon,
  trackEvent: { category: "canvas" },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.code === "F5",
  perform: (_, appState, __, app) => {
    const frames = app.scene
      .getNonDeletedElements()
      .filter((e) => e.type === "frame");

    if (frames.length === 0) {
      return { captureUpdate: CaptureUpdateAction.NEVER };
    }

    const selectedElementIds = appState.selectedElementIds;
    const selectedFrames = app.scene
      .getSelectedElements({ selectedElementIds })
      .filter((e) => e.type === "frame");
    let frameIndex = 0;
    if (selectedFrames.length !== 0) {
      const minY = Math.min(...selectedFrames.map((f) => f.y));
      frameIndex = frames.reduce((count, f) => count + (f.y < minY ? 1 : 0), 0);
    }

    // Enter presentation mode in current window
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
