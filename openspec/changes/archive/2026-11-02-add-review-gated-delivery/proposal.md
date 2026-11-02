# Proposal

## Why

El flujo OpenSpec actual termina cuando las tareas están completas y sugiere archivar, pero no exige commits ni una revisión humana verificable. Un cambio puede quedar archivado o mezclado en `main` sin que una persona haya revisado el diff. Necesitamos que, por defecto, todo change nazca con un plan de entrega: commits atómicos por grupo de tareas y una pull request revisada y mergeada por una persona antes de archivar.

## What Changes

- Nuevo schema local `review-gated-delivery`, derivado de `spec-driven`, que conserva los artefactos `proposal`, `specs`, `design` y `tasks` pero refuerza las instrucciones de `tasks` y `apply`.
- El artefacto `tasks` deberá incluir un bloque obligatorio `## Workflow follow-up` con el plan de entrega: un commit atómico por grupo, rama `change/<change-name>`, PR automática con `gh` y espera de aprobación humana.
- La instrucción de `apply` del schema exigirá: árbol de trabajo limpio, rama por change, commit de los artefactos de planificación, un commit por grupo numerado, push y apertura de PR al terminar. Nunca hará merge.
- `openspec/config.yaml` pasará a usar `schema: review-gated-delivery` como default y añadirá `operations.apply.guidance` y `operations.archive.guidance` con la misma política.
- El archive quedará bloqueado hasta que `gh pr view` reporte la PR mergeada. Si no hay PR o no se puede verificar, se pedirá confirmación humana explícita.
- Si `gh` no está instalado, no está autenticado o no hay remoto, el flujo se detendrá con instrucciones manuales; no simulará una entrega exitosa.
- Sin cambios en código de producto. El change declara `skip_specs: true` porque solo modifica tooling de desarrollo.

## Capabilities

### New Capabilities

Ninguna. Este change es tooling de desarrollo y no cambia comportamiento del producto; por eso `.openspec.yaml` declara `skip_specs: true`.

### Modified Capabilities

Ninguna.

## Impact

- `openspec/config.yaml`: schema default y guías de `apply`/`archive`.
- `openspec/schemas/review-gated-delivery/**`: schema local nuevo, versionado con el repo.
- Flujo de trabajo de changes futuros: `openspec new change`, `openspec instructions tasks`, `opsx-apply` y `opsx-archive`.
- Dependencia operativa: `gh` autenticado y remoto GitHub. Ambos ya están presentes en este repo (`origin` → GitHub, `gh` 2.102.0).
- Los changes existentes no migran: conservan el schema registrado en su `.openspec.yaml`.
