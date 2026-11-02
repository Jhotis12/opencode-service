# Tasks

## 1. Crear el schema local

- [x] 1.1 Ejecutar `openspec schema fork spec-driven review-gated-delivery` y verificar que existen `openspec/schemas/review-gated-delivery/schema.yaml` y las cuatro plantillas en `templates/`; `openspec schema which review-gated-delivery --json` debe reportar `source: "project"`.
- [x] 1.2 Editar en `openspec/schemas/review-gated-delivery/schema.yaml` la instrucción del artefacto `tasks` y `templates/tasks.md` para exigir el bloque `## Workflow follow-up` con commits por grupo, rama, PR y revisión humana; verificar con `openspec schema validate review-gated-delivery --json` que el schema sigue siendo válido.
- [x] 1.3 Editar `apply.instruction` del mismo `schema.yaml` para exigir compuerta de árbol limpio, rama `change/<change-name>`, commit de planificación, un commit por grupo, push, `gh pr create` y prohibición de merge; verificar que `openspec schema validate review-gated-delivery --json` sigue pasando y que la instrucción menciona `gh pr create` y `git status --short`.

## 2. Configurar los defaults del proyecto

- [x] 2.1 Cambiar `openspec/config.yaml` a `schema: review-gated-delivery` y verificar con `openspec schemas --json` que el schema aparece con `source: "project"` y con `openspec schema which review-gated-delivery --json` que resuelve al directorio del repo.
- [x] 2.2 Añadir `operations.apply.guidance` en `openspec/config.yaml` con las reglas de árbol limpio, commit por grupo, push, PR y espera de revisión; verificar que el YAML parsea con `openspec config get schema` (o `openspec list --json`) sin warnings de configuración.
- [x] 2.3 Añadir `operations.archive.guidance` en `openspec/config.yaml` para bloquear el archive hasta que `gh pr view <rama> --json state,mergedAt` reporte `mergedAt` no nulo, con confirmación humana explícita si no hay PR; verificar que el YAML parsea sin warnings.

## 3. Smoke test del flujo por defecto

- [x] 3.1 Crear un change temporal con `openspec new change zz-review-gated-smoke` sin `--schema` y verificar con `openspec status --change zz-review-gated-smoke --json` que `schemaName` es `review-gated-delivery`.
- [x] 3.2 Pedir `openspec instructions tasks --change zz-review-gated-smoke --json` y verificar que la instrucción exige commits por grupo, rama y PR; pedir `openspec instructions apply --change zz-review-gated-smoke --json` y verificar que la guía de `apply` incluye commits, push y PR.
- [x] 3.3 Pedir `openspec instructions archive --change zz-review-gated-smoke --json` y verificar que la guía de `archive` exige la PR mergeada antes de archivar.
- [x] 3.4 Eliminar `openspec/changes/zz-review-gated-smoke/` y verificar con `openspec list --json` que solo queda `add-review-gated-delivery`; confirmar que no quedan archivos temporales con `git status --short`.

## 4. Validación final

- [ ] 4.1 Ejecutar `openspec schema validate review-gated-delivery --json` y `openspec validate add-review-gated-delivery --strict --json`; ambos deben reportar `valid: true` sin findings de error.
- [ ] 4.2 Ejecutar `openspec doctor --json` y verificar que el root y la relación de stores reportan estado saludable (sin errores).
- [ ] 4.3 Revisar `git diff` y `git status --short` y confirmar que solo cambiaron `openspec/config.yaml`, `openspec/schemas/review-gated-delivery/**` y los artefactos de este change; no debe haber cambios en código de producto ni archivos temporales.

## Workflow follow-up

- Antes de la primera tarea, verificar que el árbol esté limpio; si hay cambios ajenos, detenerse y pedir al usuario que los commitee o los guarde en stash.
- Crear la rama `change/add-review-gated-delivery` desde la rama base del remoto y confirmar con `git branch --show-current`.
- Crear el commit de planificación `docs(openspec): plan add-review-gated-delivery` antes de empezar la implementación.
- Al terminar cada grupo numerado, crear un commit atómico `<type>(add-review-gated-delivery): <resumen>` y verificar con `git log --oneline -1` y `git status --short` que no quedan cambios pendientes.
- Al terminar la última tarea, hacer push de la rama y abrir la PR con `gh pr create` contra la rama base del remoto; reportar la URL y no ejecutar merge.
- Esperar la revisión y el merge de una persona. No archivar hasta que `gh pr view change/add-review-gated-delivery --json state,mergedAt` reporte `mergedAt` no nulo.
- Archivar solo después del merge, con `/opsx-archive`.
