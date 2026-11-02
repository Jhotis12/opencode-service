import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { button, buttonPrimary } from "../src/ui.ts";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("motion standards", () => {
  it("keeps press feedback on shared buttons", () => {
    expect(button).toContain("active:scale-[0.97]");
    expect(buttonPrimary).toContain("active:scale-[0.97]");
  });

  it("removes press transforms and smooth movement under reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("button:active");
    expect(css).toContain("transform: none !important");
    expect(css).toContain("--motion-ease-out");
  });
});
