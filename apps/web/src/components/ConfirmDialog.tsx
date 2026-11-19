import { useId, useState, type ReactNode } from "react";
import { buttonDangerSolid, buttonGhost } from "../ui.ts";
import { Field } from "./Field.tsx";
import { Modal } from "./Modal.tsx";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmationText,
  confirmationLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly confirmationText?: string;
  readonly confirmationLabel?: ReactNode;
  readonly pending?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const inputId = useId();
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const confirmed = confirmationText === undefined || typedConfirmation === confirmationText;

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonGhost} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={buttonDangerSolid} disabled={pending || !confirmed} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      {children}
      {confirmationText !== undefined && (
        <Field id={inputId} label={confirmationLabel ?? `Escribe ${confirmationText} para confirmar`}>
          <input
            value={typedConfirmation}
            onChange={(event) => setTypedConfirmation(event.target.value)}
            autoComplete="off"
          />
        </Field>
      )}
    </Modal>
  );
}
