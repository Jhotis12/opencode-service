import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BrandLockup, BrandMark } from "../src/components/Brand.tsx";

describe("Brand", () => {
  it("renders the lockup as a project link with an accessible name", () => {
    render(
      <MemoryRouter>
        <BrandLockup to="/projects" subtitle="Agentes sobre OpenCode" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Agentic Platform/i });
    expect(link).toHaveAttribute("href", "/projects");
    expect(screen.getByText("Agentes sobre OpenCode")).toBeInTheDocument();
  });

  it("keeps the compact mark accessible when the wordmark is hidden", () => {
    render(
      <MemoryRouter>
        <BrandLockup to="/projects" compact />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Agentic Platform, ir a proyectos" })).toBeInTheDocument();
    expect(screen.queryByText("Agentic Platform")).not.toBeInTheDocument();
  });

  it("exposes a standalone mark title when requested", () => {
    render(<BrandMark title="Agentic Platform" />);
    expect(screen.getByRole("img", { name: "Agentic Platform" })).toBeInTheDocument();
  });
});
