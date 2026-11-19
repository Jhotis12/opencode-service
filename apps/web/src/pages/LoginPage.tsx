import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { Field } from "../components/Field.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { buttonPrimary, card, friendlyError } from "../ui.ts";

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

export function LoginPage({ login = api.login }: { login?: typeof api.login } = {}) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: (result) => {
      setUser(result.user ?? undefined);
      navigate(result.mustChangePassword ? "/change-password" : "/projects", { replace: true });
    },
  });

  const passwordError =
    passwordTouched && password.length === 0 ? "Introduce tu contraseña para entrar." : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length === 0 || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form className={`${card} w-full max-w-[420px] gap-4`} onSubmit={submit} aria-label="Iniciar sesión">
        <BrandLockup size={40} compact />
        <PageHeader
          title="Agentic Platform"
          description="Automatizaciones agénticas sobre OpenCode."
        />
        <Field id="login-username" label="Usuario">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <div className="relative">
          <Field id="login-password" label="Contraseña" error={passwordError}>
            <input
              className="pr-11"
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setPasswordTouched(true)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
          <button
            type="button"
            className={passwordToggle}
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <PasswordEye hidden={passwordVisible} />
          </button>
        </div>
        {mutation.error && (
          <p
            className="text-sm text-danger"
            role="alert"
            title={mutation.error instanceof Error ? mutation.error.message : undefined}
          >
            {friendlyError(mutation.error, "No se pudo iniciar sesión.")}
          </p>
        )}
        <button className={buttonPrimary} type="submit" disabled={mutation.isPending || password.length === 0}>
          {mutation.isPending ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-xs text-muted">
          Primer arranque: usuario <code>admin</code> y la clave inicial del contenedor.
        </p>
      </form>
    </main>
  );
}
