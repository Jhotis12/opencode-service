import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { Field } from "../components/Field.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { buttonPrimary, card, friendlyError } from "../ui.ts";

const MIN_PASSWORD_LENGTH = 12;

// The eye toggle is laid over the input row: the field label measures 16px and the
// `field` stack adds a 6px gap, so the control starts at 22px and is 38px tall.
const passwordToggle =
  "absolute right-1 top-[22px] z-10 grid h-[38px] w-9 place-items-center rounded-md text-muted transition hover:bg-panel-2 hover:text-slate-100";

function PasswordEye({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.7a2.1 2.1 0 0 0 2.8 2.8" />
          <path d="M9.5 5.3A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7 0 .8-.3 1.6-.9 2.4M6.2 6.4C4.1 8 3 10.1 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.4 3.9-1" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6.2 5.5 12 5.5 21.5 12 21.5 12 17.8 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function PasswordField({
  id,
  label,
  toggleLabel,
  value,
  onChange,
  onBlur,
  visible,
  onToggle,
  hint,
  error,
  autoComplete,
  autoFocus,
}: {
  readonly id: string;
  readonly label: string;
  readonly toggleLabel: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly visible: boolean;
  readonly onToggle: () => void;
  readonly hint?: string;
  readonly error?: string;
  readonly autoComplete: string;
  readonly autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Field id={id} label={label} hint={hint} error={error}>
        <input
          className="pr-11"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
      </Field>
      <button
        type="button"
        className={passwordToggle}
        onClick={onToggle}
        aria-label={visible ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        title={visible ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
      >
        <PasswordEye hidden={visible} />
      </button>
    </div>
  );
}

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
    <main className="grid min-h-screen place-items-center p-6">
      <form className={`${card} w-full max-w-[420px] gap-4`} onSubmit={submit} aria-label="Cambiar contraseña">
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
