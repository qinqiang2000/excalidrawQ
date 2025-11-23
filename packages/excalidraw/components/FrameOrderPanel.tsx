import clsx from "clsx";
import React, { useCallback, useMemo, useRef, useState } from "react";

import {
  getFrameLikeElements,
  getFrameLikeTitle,
  sortFramesByPresentationOrder,
} from "@excalidraw/element/frame";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import { useApp, useExcalidrawSetAppState } from "./App";

import "./FrameOrderPanel.scss";

interface DragState {
  draggedIndex: number;
  targetIndex: number;
  insertPosition: "before" | "after";
}

export const FrameOrderPanel = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const [dragState, setDragState] = useState<DragState | null>(null);
  const draggedItemRef = useRef<HTMLDivElement | null>(null);

  // Get sorted frames
  const elements = app.scene.getNonDeletedElements();
  const frames = useMemo(() => {
    const allFrames = getFrameLikeElements(elements);
    return sortFramesByPresentationOrder(allFrames);
  }, [elements]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      setDragState({
        draggedIndex: index,
        targetIndex: index,
        insertPosition: "after",
      });
      draggedItemRef.current = e.currentTarget;

      // Add dragging class after a short delay to allow the drag image to be captured
      requestAnimationFrame(() => {
        if (draggedItemRef.current) {
          draggedItemRef.current.classList.add("dragging");
        }
      });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    if (draggedItemRef.current) {
      draggedItemRef.current.classList.remove("dragging");
    }
    setDragState(null);
    draggedItemRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (!dragState) {
        return;
      }

      // Calculate insert position based on mouse Y position relative to target element
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseY = e.clientY;
      const elementMiddle = rect.top + rect.height / 2;
      const insertPosition: "before" | "after" =
        mouseY < elementMiddle ? "before" : "after";

      // Only update state if something changed
      if (
        dragState.targetIndex !== index ||
        dragState.insertPosition !== insertPosition
      ) {
        setDragState({ ...dragState, targetIndex: index, insertPosition });
      }
    },
    [dragState],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (!dragState) {
        return;
      }

      const { draggedIndex, targetIndex, insertPosition } = dragState;

      // Calculate the actual insert index based on insertPosition
      let actualInsertIndex = targetIndex;
      if (insertPosition === "after") {
        actualInsertIndex = targetIndex + 1;
      }

      // Adjust for the removal of the dragged item
      if (draggedIndex < actualInsertIndex) {
        actualInsertIndex -= 1;
      }

      // No change needed if position is the same
      if (draggedIndex === actualInsertIndex) {
        return;
      }

      // Reorder frames
      const newFrames = [...frames];
      const [draggedFrame] = newFrames.splice(draggedIndex, 1);
      newFrames.splice(actualInsertIndex, 0, draggedFrame);

      // Create a map of frame id to new presentation order
      const frameOrderMap = new Map<string, number>();
      newFrames.forEach((frame, index) => {
        frameOrderMap.set(frame.id, index + 1);
      });

      // Create new elements with updated presentation order
      const newElements = app.scene.getElementsIncludingDeleted().map((el) => {
        const newOrder = frameOrderMap.get(el.id);
        if (newOrder !== undefined) {
          return { ...el, presentationOrder: newOrder };
        }
        return el;
      });

      // Update scene with new elements
      app.scene.replaceAllElements(newElements);
    },
    [dragState, frames, app.scene],
  );

  const handleFrameClick = useCallback(
    (frame: ExcalidrawFrameLikeElement) => {
      // Select the frame and scroll to it
      setAppState({
        selectedElementIds: { [frame.id]: true },
      });

      // Scroll to the frame
      app.scrollToContent(frame, {
        fitToViewport: false,
        animate: true,
      });
    },
    [app, setAppState],
  );

  if (frames.length === 0) {
    return (
      <div className="frame-order-panel">
        <div className="frame-order-panel__empty">
          {t("frameOrderPanel.noFrames")}
        </div>
      </div>
    );
  }

  return (
    <div className="frame-order-panel">
      <div className="frame-order-panel__header">
        {t("frameOrderPanel.title")}
      </div>
      <div className="frame-order-panel__hint">{t("frameOrderPanel.hint")}</div>
      <div className="frame-order-panel__list">
        {frames.map((frame, index) => {
          const isBeingDragged = dragState?.draggedIndex === index;
          const isDropTarget =
            dragState &&
            dragState.targetIndex === index &&
            dragState.draggedIndex !== index;
          const isDropBefore =
            isDropTarget && dragState?.insertPosition === "before";
          const isDropAfter =
            isDropTarget && dragState?.insertPosition === "after";

          return (
            <div
              key={frame.id}
              className={clsx("frame-order-panel__item", {
                "frame-order-panel__item--dragging": isBeingDragged,
                "frame-order-panel__item--drop-before": isDropBefore,
                "frame-order-panel__item--drop-after": isDropAfter,
              })}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onClick={() => handleFrameClick(frame)}
            >
              <div className="frame-order-panel__item-index">{index + 1}</div>
              <div className="frame-order-panel__item-name">
                {getFrameLikeTitle(frame)}
              </div>
              <div className="frame-order-panel__item-handle">
                <DragHandleIcon />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DragHandleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </svg>
);
