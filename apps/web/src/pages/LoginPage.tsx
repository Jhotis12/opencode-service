import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { Field } from "../components/Field.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { PasswordField } from "../components/PasswordField.tsx";
import { buttonPrimary, card, friendlyError } from "../ui.ts";

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
        <PasswordField
          id="login-password"
          label="Contraseña"
          toggleLabel="contraseña"
          value={password}
          onChange={setPassword}
          onBlur={() => setPasswordTouched(true)}
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((visible) => !visible)}
          error={passwordError}
          autoComplete="current-password"
          autoFocus
        />
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
