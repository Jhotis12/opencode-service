import type { Store } from "../ports/store.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import type { WorkflowRunRecord } from "../../domain/entities.ts";
import type { SendNotificationUseCase } from "./send-notification.ts";

export class NotifyApprovalUseCase {
  constructor(
    private readonly store: Store,
    private readonly notification: SendNotificationUseCase,
    private readonly logger: Logger,
  ) {}

  async execute(run: WorkflowRunRecord, nodeId: string): Promise<void> {
    const project = this.store.projects.findBySlug(run.projectSlug);
    if (!project) return;
    const text = `Ejecución ${run.id} pausada en ${nodeId}. Responde /approve ${run.id} ${nodeId} o usa la UI.`;
    const targets: Array<{ integrationId: string; recipient?: string }> = [];
    if (run.integrationId) targets.push({ integrationId: run.integrationId, recipient: run.launchedBy });
    if (project.approvalIntegrationId) {
      targets.push({ integrationId: project.approvalIntegrationId, recipient: project.approvalRecipient });
    }
    const seen = new Set<string>();
    for (const target of targets) {
      if (seen.has(target.integrationId)) continue;
      seen.add(target.integrationId);
      try {
        await this.notification.execute({
          projectSlug: run.projectSlug,
          integrationId: target.integrationId,
          recipient: target.recipient,
          text,
          actionKey: `approval:${run.id}:${nodeId}`,
          runId: run.id,
          nodeId,
        });
        return;
      } catch (error) {
        this.logger.warn({
          event: "approval_notification_failed",
          projectSlug: run.projectSlug,
          runId: run.id,
          nodeId,
          integrationId: target.integrationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.logger.warn({
      event: "approval_notification_missing",
      projectSlug: run.projectSlug,
      runId: run.id,
      nodeId,
    });
  }
}
