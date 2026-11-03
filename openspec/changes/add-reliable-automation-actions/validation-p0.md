# P0 Validation Checklist

Fecha: 2026-11-02
Rama: `change/add-reliable-automation-actions`
Change: `add-reliable-automation-actions`

## Evidencia automatizada

- [x] `bun run typecheck` — shared, plugin, server y web sin errores.
- [x] `bun run test` — 13 tests shared, 225 tests server, 86 tests web; todo en verde.
- [x] `bun run build` — build de producción de la web completado.
- [x] `bun run test:e2e` — 4 tests Playwright en verde:
  - first boot, project canvas, project resources, sub-agent, external chat y health.
  - **P0: scheduled notification delivers once and is visible in the run detail.**
  - **P0: webhook approval writes the database once and rejection leaves no changes.**
  - **P0: an error route receives a failed HTTP node.**

## Evidencia funcional P0

- [x] Nodo `database` con lectura, escritura, transacción, rollback y límite de filas.
- [x] Nodo `notify` con Telegram/WhatsApp/chat externo, destinatario y ledger de entregas.
- [x] `ctx.notify` acepta destinatario.
- [x] Timeout e interrupción del nodo `agent`.
- [x] Retry con backoff para `code`, `agent`, `http`, `database` y `notify`.
- [x] Estrategias de error `stop`, `continue` y `route`, con validación de target/ciclos.
- [x] Scheduler con timezone IANA, enabled, overlap `skip`, catch-up acotado y `next_run_at`.
- [x] Aprobaciones por API/UI, notificación al canal de origen o al canal del proyecto y `autoApprove`.
- [x] Entregas visibles en el detalle de ejecución.

## Validación que debe hacer el usuario

Marca cada punto en un entorno real o staging:

- [ ] Configurar un canal de salida real (Telegram, WhatsApp o chat externo) y ejecutar un schedule.
- [ ] Confirmar que el mensaje llega una sola vez y que la entrega aparece como `Entregado` en el detalle del run.
- [ ] Configurar una base de datos del proyecto y ejecutar un flujo con nodo `database` en modo escritura.
- [ ] Configurar un canal de aprobación del proyecto y confirmar que un run manual/programado notifica al canal correcto.
- [ ] Aprobar una ejecución desde la UI y confirmar que la escritura ocurre una sola vez.
- [ ] Rechazar otra ejecución y confirmar que no hay cambios en la base.
- [ ] Forzar un fallo HTTP con ruta de error y confirmar que el flujo continúa por el nodo de error.
- [ ] Confirmar que no hay regresiones en los flujos existentes.

## Gate

No iniciar ni marcar las tareas de la fase P1 (grupos 9 a 14) hasta que el usuario confirme esta checklist y dé la validación explícita de P0.
