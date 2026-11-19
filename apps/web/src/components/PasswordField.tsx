import { Field } from "./Field.tsx";

// The eye toggle is laid over the input row: the field label measures 16px and the
// `field` stack adds a 6px gap, so the control starts at 22px and is 38px tall.
const passwordToggle =
  "absolute right-1 top-[22px] z-10 grid h-[38px] w-9 place-items-center rounded-md text-muted transition hover:bg-panel-2 hover:text-slate-100";

export function PasswordEye({ hidden }: { readonly hidden: boolean }) {
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

export function PasswordField({
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
  /** Noun appended to the toggle's accessible name, e.g. "contraseña actual". */
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
  const toggleCopy = `${visible ? "Ocultar" : "Mostrar"} ${toggleLabel}`;
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
        aria-label={toggleCopy}
        title={toggleCopy}
      >
        <PasswordEye hidden={visible} />
      </button>
    </div>
  );
}
