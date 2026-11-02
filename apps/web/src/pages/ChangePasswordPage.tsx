import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandLockup } from "../components/Brand.tsx";
import { buttonPrimary, card } from "../ui.ts";

export function ChangePasswordPage({
  changePassword = api.changePassword,
}: {
  changePassword?: typeof api.changePassword;
} = {}) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string>();

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (result) => {
      setUser(result.user ?? undefined);
      navigate("/projects", { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setLocalError("La confirmación no coincide");
      return;
    }
    setLocalError(undefined);
    mutation.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form className={`${card} w-full max-w-[420px] gap-4`} onSubmit={submit} aria-label="Cambiar contraseña">
        <BrandLockup size={32} subtitle={false} />
        <h1 className="text-xl font-semibold text-slate-100">Cambia tu contraseña inicial</h1>
        <p className="text-sm text-muted">
          Hola {user?.username}. Antes de continuar, define una contraseña de al menos 12 caracteres.
        </p>
        <label>
          Contraseña actual
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label>
          Nueva contraseña
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label>
          Confirmar nueva contraseña
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        {(localError || mutation.error) && (
          <p className="text-sm text-danger">
            {localError ?? (mutation.error instanceof Error ? mutation.error.message : "No se pudo cambiar la contraseña")}
          </p>
        )}
        <button className={buttonPrimary} type="submit" disabled={mutation.isPending || newPassword.length < 12}>
          {mutation.isPending ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </main>
  );
}
