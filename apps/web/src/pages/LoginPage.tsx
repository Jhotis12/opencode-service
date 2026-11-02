import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { buttonPrimary, card, friendlyError } from "../ui.ts";

export function LoginPage({ login = api.login }: { login?: typeof api.login } = {}) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: (result) => {
      setUser(result.user ?? undefined);
      navigate(result.mustChangePassword ? "/change-password" : "/projects", { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form className={`${card} w-full max-w-[420px] gap-4`} onSubmit={submit} aria-label="Iniciar sesión">
        <BrandLockup
          size={40}
          asHeading
          subtitle="Automatizaciones agénticas sobre OpenCode"
        />
        <label>
          Usuario
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {mutation.error && (
          <p
            className="text-sm text-danger"
            role="alert"
            title={mutation.error instanceof Error ? mutation.error.message : undefined}
          >
            {friendlyError(mutation.error, "No se pudo iniciar sesión.")}
          </p>
        )}
        <button className={buttonPrimary} type="submit" disabled={mutation.isPending || !password}>
          {mutation.isPending ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-xs text-muted">
          Primer arranque: usuario <code>admin</code> y la clave inicial del contenedor.
        </p>
      </form>
    </main>
  );
}
