import type { CSSProperties } from "react";
import type { NodeType } from "@platform/shared";

export interface NodeShape {
  name: string;
  style: CSSProperties;
}

export const NODE_SHAPES: Record<NodeType, NodeShape> = {
  trigger: { name: "stadium", style: { borderRadius: "999px" } },
  http: { name: "rounded-card", style: { borderRadius: "14px" } },
  code: {
    name: "notched-card",
    style: { clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px))" },
  },
  transform: { name: "tag", style: { clipPath: "polygon(0 0, 86% 0, 100% 50%, 86% 100%, 0 100%)" } },
  delay: { name: "d-shape", style: { borderRadius: "0 999px 999px 0 / 0 50% 50% 0" } },
  validate: {
    name: "octagon",
    style: {
      clipPath:
        "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
    },
  },
  agent: {
    name: "hexagon",
    style: { clipPath: "polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)" },
  },
  decision: {
    name: "flattened-diamond",
    style: { clipPath: "polygon(50% 0, 100% 30%, 100% 70%, 50% 100%, 0 70%, 0 30%)" },
  },
  approval: { name: "shield", style: { clipPath: "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)" } },
};

export function nodeShapeStyle(type: NodeType): CSSProperties {
  return NODE_SHAPES[type].style;
}
