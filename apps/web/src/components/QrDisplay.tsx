import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "./Modal.tsx";
import { buttonGhost, skeleton } from "../ui.ts";

type QrState =
  | { readonly phase: "loading" }
  | { readonly phase: "error"; readonly message: string; readonly rawMessage: string }
  | { readonly phase: "ready"; readonly image: string };

const QR_ERROR_MESSAGE =
  "Todavía no hay un QR disponible para esta integración. Conéctala y vuelve a intentarlo.";

export function QrDisplay({
  title,
  integrationName,
  integrationId,
  loadQr,
  onClose,
}: {
  readonly title: string;
  readonly integrationName: string;
  readonly integrationId: string;
  readonly loadQr: (id: string) => Promise<string>;
  onClose(): void;
}) {
  const [state, setState] = useState<QrState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(loadQr);

  useEffect(() => {
    loadRef.current = loadQr;
  }, [loadQr]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ phase: "loading" });
      try {
        const payload = await loadRef.current(integrationId);
        const image = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
        if (!cancelled) setState({ phase: "ready", image });
      } catch (cause) {
        if (!cancelled) {
          setState({
            phase: "error",
            message: QR_ERROR_MESSAGE,
            rawMessage: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [integrationId, attempt]);

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-xs text-muted">
        {integrationName} · <code>{integrationId}</code>
      </p>
      {state.phase === "loading" && (
        <div className="flex flex-col items-center gap-3" aria-busy="true" aria-label="Cargando código QR">
          <div className={skeleton + " h-[220px] w-[220px] rounded-lg"} aria-hidden="true" />
          <p className="text-xs text-muted">Generando el código QR…</p>
        </div>
      )}
      {state.phase === "error" && (
        <div className="flex flex-col gap-2" role="alert">
          <p className="text-sm text-danger" title={state.rawMessage}>
            {state.message}
          </p>
          <button type="button" className={buttonGhost} onClick={() => setAttempt((current) => current + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state.phase === "ready" && (
        <img
          className="h-[220px] w-[220px] rounded-lg bg-white"
          src={state.image}
          alt={"Código QR de " + integrationName}
          data-testid="qr-image"
        />
      )}
    </Modal>
  );
}
