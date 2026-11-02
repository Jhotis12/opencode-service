import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { button, card } from "../ui.ts";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center p-6">
          <section className={`${card} w-full max-w-lg`}>
            <h1 className="text-xl font-semibold">Algo salió mal</h1>
            <p className="text-sm text-muted">
              La interfaz encontró un error inesperado. El incidente quedó registrado.
            </p>
            <pre>{this.state.error.message}</pre>
            <button className={button} onClick={() => window.location.reload()}>
              Recargar
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
