import { cloneElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { field, fieldError, fieldLabel, smallMuted } from "../ui.ts";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  readonly id: string;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [children.props["aria-describedby"], hint ? hintId : "", error ? errorId : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={field}>
      <label className={fieldLabel} htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": Boolean(error),
      })}
      {hint && (
        <p id={hintId} className={smallMuted}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
