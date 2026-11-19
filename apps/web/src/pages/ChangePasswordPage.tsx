import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { PasswordField } from "../components/PasswordField.tsx";
import { buttonPrimary, card, friendlyError } from "../ui.ts";

const MIN_PASSWORD_LENGTH = 12;

function describeChangePasswordError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/invalid credentials|current password is incorrect/i.test(message)) {
    return "La contraseña actual no es correcta.";
  }
  const policy = /at least (\d+) characters/i.exec(message);
  if (policy) {
    return `La nueva contraseña necesita al menos ${policy[1]} caracteres.`;
  }
  if (/differ from the initial default/i.test(message)) {
    return "La nueva contraseña debe ser distinta de la contraseña inicial.";
  }
  if (/must not be blank/i.test(message)) {
    return "La nueva contraseña no puede estar vacía.";
  }
  return friendlyError(error, "No se pudo cambiar la contraseña.");
}

export function ChangePasswordPage({
  changePassword = api.changePassword,
}: {
  changePassword?: typeof api.changePassword;
}) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentVisible, setCurrentVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [currentTouched, setCurrentTouched] = useState(false);
  const [newTouched, setNewTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (result) => {
      setUser(result.user ?? undefined);
      navigate("/projects", { replace: true });
    },
  });

  const currentError =
    currentTouched && currentPassword.length === 0 ? "Introduce tu contraseña actual." : undefined;
  const newError =
    newTouched && newPassword.length < MIN_PASSWORD_LENGTH
      ? `La nueva contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      : undefined;
  const confirmError =
    newPassword.length > 0 && confirm.length > 0 && confirm !== newPassword
      ? "Las contraseñas no coinciden."
      : undefined;

  const complete =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirm.length > 0 &&
    confirm === newPassword;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || mutation.isPending) return;
    mutation.mutate();
  }

  const greeting = user?.username ? `Hola ${user.username}. ` : "";

  return (
    <main className="flex min-h-dvh flex-col overflow-y-auto p-6">
      <form className={`${card} m-auto w-full max-w-[420px] gap-4`} onSubmit={submit} aria-label="Cambiar contraseña">
        <BrandLockup size={32} subtitle={false} />
        <PageHeader
          title="Cambia tu contraseña inicial"
          description={`${greeting}Antes de continuar, define una contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        />
        <PasswordField
          id="change-password-current"
          label="Contraseña actual"
          toggleLabel="contraseña actual"
          value={currentPassword}
          onChange={setCurrentPassword}
          onBlur={() => setCurrentTouched(true)}
          visible={currentVisible}
          onToggle={() => setCurrentVisible((value) => !value)}
          hint="La contraseña con la que iniciaste sesión."
          error={currentError}
          autoComplete="current-password"
          autoFocus
        />
        <PasswordField
          id="change-password-new"
          label="Nueva contraseña"
          toggleLabel="nueva contraseña"
          value={newPassword}
          onChange={setNewPassword}
          onBlur={() => setNewTouched(true)}
          visible={newVisible}
          onToggle={() => setNewVisible((value) => !value)}
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          error={newError}
          autoComplete="new-password"
        />
        <PasswordField
          id="change-password-confirm"
          label="Confirmar nueva contraseña"
          toggleLabel="confirmación de la contraseña"
          value={confirm}
          onChange={setConfirm}
          visible={confirmVisible}
          onToggle={() => setConfirmVisible((value) => !value)}
          error={confirmError}
          autoComplete="new-password"
        />
        {mutation.error && (
          <p
            className="text-sm text-danger"
            role="alert"
            title={mutation.error instanceof Error ? mutation.error.message : undefined}
          >
            {describeChangePasswordError(mutation.error)}
          </p>
        )}
        <button className={buttonPrimary} type="submit" disabled={mutation.isPending || !complete}>
          {mutation.isPending ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </main>
  );
}
