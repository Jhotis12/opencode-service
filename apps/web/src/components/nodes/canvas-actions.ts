import { createContext, useContext } from "react";

export interface CanvasActions {
  onDuplicateNode(nodeId: string): void;
  onStartConnect(nodeId: string): void;
  onDeleteNode(nodeId: string): void;
  onDeleteEdge(edgeId: string): void;
  onChangeEdgeCondition(edgeId: string, condition: "true" | "false"): void;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions | null {
  return useContext(CanvasActionsContext);
}
