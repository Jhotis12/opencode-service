import { skeleton } from "../ui.ts";

export type SkeletonShape = "line" | "block" | "circle";
export type SkeletonSize = "sm" | "md" | "lg";

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  line: "w-full rounded-full",
  block: "w-full rounded-xl",
  circle: "rounded-full",
};

const SIZE_CLASS: Record<SkeletonShape, Record<SkeletonSize, string>> = {
  line: { sm: "h-2", md: "h-3", lg: "h-4" },
  block: { sm: "h-12", md: "h-20", lg: "h-32" },
  circle: { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" },
};

export function Skeleton({
  shape = "line",
  size = "md",
  className = "",
}: {
  readonly shape?: SkeletonShape;
  readonly size?: SkeletonSize;
  readonly className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${skeleton} ${SHAPE_CLASS[shape]} ${SIZE_CLASS[shape][size]} ${className}`.trim()}
    />
  );
}
