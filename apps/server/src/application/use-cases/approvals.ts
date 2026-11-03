import type { Store } from "../ports/store.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";
import type { WorkflowRunRecord } from "../../domain/entities.ts";

export class ApprovalDecisionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ApprovalDecisionError";
  }
}

export class DecideApprovalUseCase {
  constructor(
    private readonly store: Store,
    private readonly executor: Pick<ExecuteWorkflowRunUseCase, "resumeWithApproval">,
  ) {}

  async execute(input: {
    projectSlug: string;
    runId: string;
    nodeId: string;
    decision: "approve" | "reject";
    decidedBy: string;
  }): Promise<WorkflowRunRecord> {
    const run = this.store.runs.findById(input.runId);
    if (!run || run.projectSlug !== input.projectSlug) {
      throw new ApprovalDecisionError("NOT_FOUND", "run not found in this project");
    }
    const approval = this.store.runs.findApproval(input.runId, input.nodeId);
    if (!approval) throw new ApprovalDecisionError("NOT_FOUND", "approval not found");
    if (approval.status !== "pending") {
      throw new ApprovalDecisionError("CONFLICT", `approval already ${approval.status}`);
    }
    return this.executor.resumeWithApproval(
      input.runId,
      input.nodeId,
      input.decision === "approve",
      input.decidedBy,
    );
  }
}
