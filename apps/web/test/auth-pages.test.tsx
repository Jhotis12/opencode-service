import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { setUser } = vi.hoisted(() => ({ setUser: vi.fn() }));

vi.mock("../src/auth.tsx", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "admin", mustChangePassword: true, createdAt: "2026-01-01T00:00:00.000Z" },
    loading: false,
    refresh: vi.fn(),
    setUser,
    logout: vi.fn(),
  }),
}));

import { LoginPage } from "../src/pages/LoginPage.tsx";
import { ChangePasswordPage } from "../src/pages/ChangePasswordPage.tsx";
import { renderWithProviders } from "./render.tsx";

const user = { id: "u1", username: "admin", mustChangePassword: false, createdAt: "2026-01-01T00:00:00.000Z" };

function renderLogin(login = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <LoginPage login={login} />
    </MemoryRouter>,
  );
  return login;
}

function renderChangePassword(changePassword = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <ChangePasswordPage changePassword={changePassword} />
    </MemoryRouter>,
  );
  return changePassword;
}

describe("LoginPage", () => {
  it("mantiene el acceso bloqueado hasta que hay contraseña", async () => {
    const login = renderLogin(vi.fn().mockResolvedValue({ user, mustChangePassword: false }));
    const submit = screen.getByRole("button", { name: "Entrar" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Contraseña"), "admin123!");
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith("admin", "admin123!");
  });

  it("enfoca la contraseña al abrir el acceso", () => {
    renderLogin();
    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
  });

  it("alterna la visibilidad de la contraseña", async () => {
    renderLogin();
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(password).toHaveAttribute("type", "password");
  });
});

describe("ChangePasswordPage", () => {
  it("envía el cambio una sola vez cuando el formulario es válido", async () => {
    const changePassword = renderChangePassword(vi.fn().mockResolvedValue({ user }));
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "admin123!");
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "plataforma-segura-2026");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "plataforma-segura-2026");

    const submit = screen.getByRole("button", { name: "Guardar y continuar" });
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    expect(changePassword).toHaveBeenCalledWith("admin123!", "plataforma-segura-2026");
  });

  it("no envía nada mientras falte la contraseña actual", async () => {
    const changePassword = renderChangePassword();
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "plataforma-segura-2026");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "plataforma-segura-2026");

    const submit = screen.getByRole("button", { name: "Guardar y continuar" });
    expect(submit).toBeDisabled();

    await userEvent.click(submit);
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "{Enter}");
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("muestra el aviso en línea cuando la confirmación no coincide", async () => {
    renderChangePassword();
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "plataforma-segura-2026");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "otra-clave-distinta");

    const confirm = screen.getByLabelText("Confirmar nueva contraseña");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect((confirm.getAttribute("aria-describedby") ?? "").split(" ")).toContain(
      "change-password-confirm-error",
    );
    expect(document.getElementById("change-password-confirm-error")).toHaveTextContent(
      "Las contraseñas no coinciden.",
    );
    expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeDisabled();
  });

  it("explica el mínimo de 12 caracteres y marca la contraseña corta", async () => {
    renderChangePassword();
    const newPassword = screen.getByLabelText("Nueva contraseña");
    expect((newPassword.getAttribute("aria-describedby") ?? "").split(" ")).toContain(
      "change-password-new-hint",
    );
    expect(document.getElementById("change-password-new-hint")).toHaveTextContent(
      "Mínimo 12 caracteres.",
    );

    await userEvent.type(newPassword, "corta");
    await userEvent.tab();
    expect(newPassword).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("change-password-new-error")).toHaveTextContent(
      "La nueva contraseña necesita al menos 12 caracteres.",
    );
  });

  it("alterna la visibilidad de la contraseña actual", async () => {
    renderChangePassword();
    const current = screen.getByLabelText("Contraseña actual");
    expect(current).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña actual" }));
    expect(current).toHaveAttribute("type", "text");
  });
});
