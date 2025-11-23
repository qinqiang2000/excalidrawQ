import clsx from "clsx";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getFrameLikeElements,
  getFrameLikeTitle,
  sortFramesByPresentationOrder,
  getFrameChildren,
} from "@excalidraw/element/frame";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { exportToCanvas } from "../scene/export";

import { useApp, useExcalidrawSetAppState } from "./App";

import "./FrameOrderPanel.scss";

interface DragState {
  draggedIndex: number;
  targetIndex: number;
  insertPosition: "before" | "after";
}

// Cache for frame thumbnails
const thumbnailCache = new Map<string, string>();

export const FrameOrderPanel = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const draggedItemRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Get sorted frames
  const elements = app.scene.getNonDeletedElements();
  const frames = useMemo(() => {
    const allFrames = getFrameLikeElements(elements);
    return sortFramesByPresentationOrder(allFrames);
  }, [elements]);

  // Generate thumbnails for frames
  useEffect(() => {
    const generateThumbnails = async () => {
      const newThumbnails = new Map<string, string>();
      const files = app.files;
      const appState = app.state;

      for (const frame of frames) {
        // Check cache first
        const cacheKey = `${frame.id}-${frame.version}`;
        if (thumbnailCache.has(cacheKey)) {
          newThumbnails.set(frame.id, thumbnailCache.get(cacheKey)!);
          continue;
        }

        try {
          // Get elements within this frame
          const frameElements = getFrameChildren(elements, frame.id);
          const elementsToRender = [frame, ...frameElements];

          // Create a small canvas for the thumbnail
          const canvas = await exportToCanvas(
            elementsToRender,
            appState,
            files,
            {
              exportBackground: true,
              exportPadding: 0,
              viewBackgroundColor:
                appState.viewBackgroundColor || "#ffffff",
              exportingFrame: frame,
            },
            (width, height) => {
              const thumbnailCanvas = document.createElement("canvas");
              const maxSize = 80;
              const scale = Math.min(maxSize / width, maxSize / height, 1);
              thumbnailCanvas.width = width * scale;
              thumbnailCanvas.height = height * scale;
              return { canvas: thumbnailCanvas, scale };
            },
          );

          const dataUrl = canvas.toDataURL("image/png", 0.7);
          newThumbnails.set(frame.id, dataUrl);
          thumbnailCache.set(cacheKey, dataUrl);
        } catch (error) {
          // Fallback: no thumbnail
          console.warn("Failed to generate thumbnail for frame", frame.id);
        }
      }

      setThumbnails(newThumbnails);
    };

    if (frames.length > 0) {
      generateThumbnails();
    }
  }, [frames, elements, app.files, app.state]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingFrameId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingFrameId]);

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
      // Don't select if we're editing
      if (editingFrameId) {
        return;
      }

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
    [app, setAppState, editingFrameId],
  );

  const handleDoubleClick = useCallback(
    (frame: ExcalidrawFrameLikeElement, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingFrameId(frame.id);
      setEditingName(getFrameLikeTitle(frame));
    },
    [],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingName(e.target.value);
    },
    [],
  );

  const handleNameSubmit = useCallback(
    (frameId: string) => {
      if (!editingName.trim()) {
        setEditingFrameId(null);
        return;
      }

      // Update the frame name
      const newElements = app.scene.getElementsIncludingDeleted().map((el) => {
        if (el.id === frameId) {
          return { ...el, name: editingName.trim() };
        }
        return el;
      });

      app.scene.replaceAllElements(newElements);
      setEditingFrameId(null);
    },
    [editingName, app.scene],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, frameId: string) => {
      if (e.key === "Enter") {
        handleNameSubmit(frameId);
      } else if (e.key === "Escape") {
        setEditingFrameId(null);
      }
    },
    [handleNameSubmit],
  );

  const handleBlur = useCallback(
    (frameId: string) => {
      handleNameSubmit(frameId);
    },
    [handleNameSubmit],
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
          const isEditing = editingFrameId === frame.id;
          const thumbnail = thumbnails.get(frame.id);
          const isSelected = app.state.selectedElementIds[frame.id];

          return (
            <div
              key={frame.id}
              className={clsx("frame-order-panel__item", {
                "frame-order-panel__item--dragging": isBeingDragged,
                "frame-order-panel__item--drop-before": isDropBefore,
                "frame-order-panel__item--drop-after": isDropAfter,
                "frame-order-panel__item--selected": isSelected,
              })}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onClick={() => handleFrameClick(frame)}
            >
              <div className="frame-order-panel__item-thumbnail">
                {thumbnail ? (
                  <img src={thumbnail} alt={getFrameLikeTitle(frame)} />
                ) : (
                  <div className="frame-order-panel__item-thumbnail-placeholder">
                    {index + 1}
                  </div>
                )}
              </div>
              <div className="frame-order-panel__item-content">
                <div className="frame-order-panel__item-index">{index + 1}</div>
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="frame-order-panel__item-input"
                    value={editingName}
                    onChange={handleNameChange}
                    onKeyDown={(e) => handleKeyDown(e, frame.id)}
                    onBlur={() => handleBlur(frame.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="frame-order-panel__item-name"
                    onDoubleClick={(e) => handleDoubleClick(frame, e)}
                  >
                    {getFrameLikeTitle(frame)}
                  </div>
                )}
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
