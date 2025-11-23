import { isElbowArrow, isFlowchartNodeElement } from "./typeChecks";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFlowchartNodeElement,
  ExcalidrawTextElement,
  FixedPointBinding,
} from "./types";
import type { Scene } from "./Scene";

export type LinkDirection = "up" | "right" | "down" | "left";

export type CollapseIconPosition = {
  x: number;
  y: number;
  nodeId: string;
  direction: LinkDirection;
};

/**
 * Get all outgoing arrows from a flowchart node.
 * An outgoing arrow is one where the node is the start binding.
 */
const getOutgoingArrows = (
  nodeId: string,
  elementsMap: ElementsMap,
): ExcalidrawArrowElement[] => {
  const arrows: ExcalidrawArrowElement[] = [];

  for (const [, element] of elementsMap) {
    if (
      isElbowArrow(element) &&
      element.startBinding?.elementId === nodeId &&
      element.endBinding
    ) {
      arrows.push(element);
    }
  }

  return arrows;
};

/**
 * Get all incoming arrows to a flowchart node.
 * An incoming arrow is one where the node is the end binding.
 */
const getIncomingArrows = (
  nodeId: string,
  elementsMap: ElementsMap,
): ExcalidrawArrowElement[] => {
  const arrows: ExcalidrawArrowElement[] = [];

  for (const [, element] of elementsMap) {
    if (
      isElbowArrow(element) &&
      element.endBinding?.elementId === nodeId &&
      element.startBinding
    ) {
      arrows.push(element);
    }
  }

  return arrows;
};

/**
 * Get the direct child elements of a flowchart node.
 * A child is an element connected via an arrow where the current node is the start binding.
 */
export const getChildElements = (
  nodeId: string,
  elementsMap: ElementsMap,
): ExcalidrawElement[] => {
  const children: ExcalidrawElement[] = [];
  const arrows = getOutgoingArrows(nodeId, elementsMap);

  for (const arrow of arrows) {
    const childElement = elementsMap.get(arrow.endBinding!.elementId);
    if (childElement && !childElement.isDeleted) {
      children.push(childElement);
    }
  }

  return children;
};

/**
 * Get all descendant elements of a flowchart node recursively.
 * This includes all children, grandchildren, etc., plus their connecting arrows.
 */
export const getDescendantElements = (
  nodeId: string,
  elementsMap: ElementsMap,
  visited: Set<string> = new Set(),
): ExcalidrawElement[] => {
  if (visited.has(nodeId)) {
    return [];
  }
  visited.add(nodeId);

  const descendants: ExcalidrawElement[] = [];
  const arrows = getOutgoingArrows(nodeId, elementsMap);

  for (const arrow of arrows) {
    // Add the arrow
    descendants.push(arrow);

    const childId = arrow.endBinding!.elementId;
    const childElement = elementsMap.get(childId);

    if (childElement && !childElement.isDeleted) {
      // Add the child node
      descendants.push(childElement);

      // Also add any bound text elements
      if (childElement.boundElements) {
        for (const bound of childElement.boundElements) {
          if (bound.type === "text") {
            const textElement = elementsMap.get(bound.id);
            if (textElement && !textElement.isDeleted) {
              descendants.push(textElement);
            }
          }
        }
      }

      // Recursively get descendants
      const childDescendants = getDescendantElements(
        childId,
        elementsMap,
        visited,
      );
      descendants.push(...childDescendants);
    }
  }

  return descendants;
};

/**
 * Get the direction from parent to child element.
 */
const getDirectionFromParentToChild = (
  parent: ExcalidrawFlowchartNodeElement,
  child: ExcalidrawElement,
): LinkDirection => {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  } else {
    return dy > 0 ? "down" : "up";
  }
};

/**
 * Get the direction based on the arrow's start binding fixedPoint.
 * fixedPoint is [x, y] where x and y are ratios (0-1) on the parent element.
 */
const getDirectionFromBindingPoint = (
  fixedPoint: [number, number],
): LinkDirection => {
  const [fx, fy] = fixedPoint;

  // Determine which edge the binding point is closest to
  const distToTop = fy;
  const distToBottom = 1 - fy;
  const distToLeft = fx;
  const distToRight = 1 - fx;

  const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

  if (minDist === distToTop) {
    return "up";
  } else if (minDist === distToBottom) {
    return "down";
  } else if (minDist === distToLeft) {
    return "left";
  } else {
    return "right";
  }
};

/**
 * Check if an element should be hidden because one of its ancestors is collapsed.
 */
export const isElementCollapsedByAncestor = (
  elementId: string,
  elementsMap: ElementsMap,
): boolean => {
  const element = elementsMap.get(elementId);
  if (!element) {
    return false;
  }

  // Special handling for arrows: hide if start node is collapsed in that direction
  if (isElbowArrow(element)) {
    const startBinding = element.startBinding;
    const endBinding = element.endBinding;

    if (startBinding && endBinding) {
      const startElement = elementsMap.get(startBinding.elementId);

      if (startElement && isFlowchartNodeElement(startElement)) {
        // Check if start node is collapsed in the direction of the binding point
        const direction =
          "fixedPoint" in startBinding
            ? getDirectionFromBindingPoint(startBinding.fixedPoint)
            : getDirectionFromParentToChild(
                startElement,
                elementsMap.get(endBinding.elementId)!,
              );
        if (startElement.collapsed?.[direction]) {
          return true;
        }
      }

      // Also check if the start element itself is hidden
      if (isElementCollapsedByAncestor(startBinding.elementId, elementsMap)) {
        return true;
      }
    }
    // Also hide arrow if end node is hidden
    if (endBinding) {
      if (isElementCollapsedByAncestor(endBinding.elementId, elementsMap)) {
        return true;
      }
    }
    return false;
  }

  // Handle bound text elements: if container is hidden, text should also be hidden
  if (element.type === "text") {
    const textElement = element as ExcalidrawTextElement;
    if (textElement.containerId) {
      if (isElementCollapsedByAncestor(textElement.containerId, elementsMap)) {
        return true;
      }
    }
  }

  // For regular elements, check parent relationships with direction
  const incomingArrows = getIncomingArrows(elementId, elementsMap);

  for (const arrow of incomingArrows) {
    const parentElement = elementsMap.get(arrow.startBinding!.elementId);
    if (
      parentElement &&
      !parentElement.isDeleted &&
      isFlowchartNodeElement(parentElement)
    ) {
      // Check if parent is collapsed in the direction of the binding point
      const direction =
        arrow.startBinding && "fixedPoint" in arrow.startBinding
          ? getDirectionFromBindingPoint(
              (arrow.startBinding as FixedPointBinding).fixedPoint,
            )
          : getDirectionFromParentToChild(parentElement, element);
      if (parentElement.collapsed?.[direction]) {
        return true;
      }

      // Also check grandparents
      if (isElementCollapsedByAncestor(parentElement.id, elementsMap)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Get all parent nodes of an element (nodes that connect to this element via arrows).
 */
const getParentNodes = (
  elementId: string,
  elementsMap: ElementsMap,
): ExcalidrawFlowchartNodeElement[] => {
  const parents: ExcalidrawFlowchartNodeElement[] = [];
  const incomingArrows = getIncomingArrows(elementId, elementsMap);

  for (const arrow of incomingArrows) {
    const parentElement = elementsMap.get(arrow.startBinding!.elementId);
    if (
      parentElement &&
      !parentElement.isDeleted &&
      isFlowchartNodeElement(parentElement)
    ) {
      parents.push(parentElement);
      // Also check grandparents
      const grandparents = getParentNodes(parentElement.id, elementsMap);
      parents.push(...grandparents);
    }
  }

  return parents;
};

/**
 * Toggle the collapsed state of a flowchart node in a specific direction.
 */
export const toggleCollapse = (
  nodeId: string,
  direction: LinkDirection,
  scene: Scene,
): void => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const element = elementsMap.get(nodeId);

  if (!element || !isFlowchartNodeElement(element)) {
    return;
  }

  const currentCollapsed = element.collapsed || {};
  const newCollapsed = {
    ...currentCollapsed,
    [direction]: !currentCollapsed[direction],
  };

  scene.mutateElement(element, {
    collapsed: newCollapsed,
  });
};

/**
 * Check if a flowchart node has any children.
 */
export const hasChildren = (
  nodeId: string,
  elementsMap: ElementsMap,
): boolean => {
  return getOutgoingArrows(nodeId, elementsMap).length > 0;
};

/**
 * Get collapse icon positions for all flowchart nodes that have children.
 * Returns the positions where collapse/expand icons should be rendered.
 */
export const getCollapseIconPositions = (
  elementsMap: ElementsMap,
): CollapseIconPosition[] => {
  const positions: CollapseIconPosition[] = [];

  for (const [, element] of elementsMap) {
    if (!isFlowchartNodeElement(element) || element.isDeleted) {
      continue;
    }

    // Check if this node has children
    if (!hasChildren(element.id, elementsMap)) {
      continue;
    }

    // Skip if this element is hidden by an ancestor
    if (isElementCollapsedByAncestor(element.id, elementsMap)) {
      continue;
    }

    // Find all directions that have children
    const childDirections = getChildDirections(element.id, elementsMap);

    if (childDirections.length === 0) {
      continue;
    }

    // Get all unique directions (instead of just the primary direction)
    const uniqueDirections = [...new Set(childDirections)];

    // Create an icon for each direction that has children
    for (const direction of uniqueDirections) {
      const iconPosition = calculateIconPosition(element, direction);
      positions.push({
        ...iconPosition,
        nodeId: element.id,
        direction,
      });
    }
  }

  return positions;
};

/**
 * Get the directions of all children relative to the parent node.
 * Uses the arrow's start binding point to determine direction.
 */
const getChildDirections = (
  nodeId: string,
  elementsMap: ElementsMap,
): LinkDirection[] => {
  const directions: LinkDirection[] = [];
  const parentElement = elementsMap.get(nodeId);

  if (!parentElement || !isFlowchartNodeElement(parentElement)) {
    return directions;
  }

  const arrows = getOutgoingArrows(nodeId, elementsMap);

  for (const arrow of arrows) {
    const childElement = elementsMap.get(arrow.endBinding!.elementId);
    if (childElement && !childElement.isDeleted) {
      // Use the arrow's start binding fixedPoint to determine direction
      if (arrow.startBinding && "fixedPoint" in arrow.startBinding) {
        directions.push(
          getDirectionFromBindingPoint(
            (arrow.startBinding as FixedPointBinding).fixedPoint,
          ),
        );
      } else {
        // Fallback to coordinate-based direction
        directions.push(
          getDirectionFromParentToChild(parentElement, childElement),
        );
      }
    }
  }

  return directions;
};

/**
 * Calculate the position for the collapse icon based on node and direction.
 */
const calculateIconPosition = (
  element: ExcalidrawFlowchartNodeElement,
  direction: LinkDirection,
): { x: number; y: number } => {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  switch (direction) {
    case "up":
      return { x: cx, y: element.y - 10 };
    case "down":
      return { x: cx, y: element.y + element.height + 10 };
    case "left":
      return { x: element.x - 10, y: cy };
    case "right":
      return { x: element.x + element.width + 10, y: cy };
  }
};

/**
 * Check if a point is within a collapse icon's click area.
 */
export const isPointInCollapseIcon = (
  point: { x: number; y: number },
  iconPosition: CollapseIconPosition,
  zoom: number,
): boolean => {
  const iconSize = 16 / zoom;
  const halfSize = iconSize / 2;

  return (
    point.x >= iconPosition.x - halfSize &&
    point.x <= iconPosition.x + halfSize &&
    point.y >= iconPosition.y - halfSize &&
    point.y <= iconPosition.y + halfSize
  );
};

/**
 * Filter elements to exclude those that are hidden due to collapsed ancestors.
 */
export const filterCollapsedElements = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
): ExcalidrawElement[] => {
  return elements.filter((element) => {
    // Check if this element's parent is collapsed
    return !isElementCollapsedByAncestor(element.id, elementsMap);
  });
};

/**
 * Get the arrow elements that connect a collapsed node to its hidden children.
 */
export const getCollapsedArrows = (
  nodeId: string,
  elementsMap: ElementsMap,
): ExcalidrawArrowElement[] => {
  return getOutgoingArrows(nodeId, elementsMap);
};
