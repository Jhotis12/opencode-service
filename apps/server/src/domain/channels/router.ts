import type { ChannelMode } from "@platform/shared";
import type { TriggerRef } from "../../application/ports/channels.ts";

export type ApprovalCommand = { action: "approve" | "reject"; runId: string; nodeId: string };

export type ProjectRouteDecision =
  | { type: "agent"; reason: "allowlisted" | "agent_mode" }
  | { type: "workflow"; trigger: TriggerRef; reason: "workflow_mode" | "public_trigger" }
  | { type: "approval"; command: ApprovalCommand }
  | { type: "dropped"; reason: "not_allowed" | "no_trigger" };

export function normalizeSender(sender: string): string {
  return sender.trim().toLowerCase();
}

export function senderMatchesAllowlist(sender: string, allowlist: string[]): boolean {
  const normalized = normalizeSender(sender);
  const digits = normalized.replace(/\D/g, "");
  return allowlist.some((entry) => {
    const candidate = normalizeSender(entry);
    const candidateDigits = candidate.replace(/\D/g, "");
    return candidate === normalized || (digits.length > 0 && candidateDigits === digits);
  });
}

export function parseApprovalCommand(text: string): ApprovalCommand | undefined {
  const match = /^\/(approve|reject)\s+([a-zA-Z0-9-]{8,80})\s+([a-z0-9][a-z0-9-]*)\s*$/.exec(text.trim());
  if (!match) return undefined;
  return { action: match[1] === "approve" ? "approve" : "reject", runId: match[2]!, nodeId: match[3]! };
}

export function routeProjectMessage(input: {
  senderId: string;
  text: string;
  mode: ChannelMode;
  allowlist: string[];
  publicTriggers: boolean;
  triggers: TriggerRef[];
}): ProjectRouteDecision {
  const isAdmin = senderMatchesAllowlist(input.senderId, input.allowlist);
  if (isAdmin) {
    const command = parseApprovalCommand(input.text);
    if (command) return { type: "approval", command };
  }
  if (input.mode === "agent") {
    if (isAdmin || input.publicTriggers) return { type: "agent", reason: isAdmin ? "allowlisted" : "agent_mode" };
    return { type: "dropped", reason: "not_allowed" };
  }
  if (input.mode === "hybrid") {
    if (isAdmin) return { type: "agent", reason: "allowlisted" };
    if (!input.publicTriggers) return { type: "dropped", reason: "not_allowed" };
    const trigger = input.triggers[0];
    return trigger
      ? { type: "workflow", trigger, reason: "public_trigger" }
      : { type: "dropped", reason: "no_trigger" };
  }
  if (!isAdmin && !input.publicTriggers) return { type: "dropped", reason: "not_allowed" };
  const trigger = input.triggers[0];
  return trigger
    ? { type: "workflow", trigger, reason: "workflow_mode" }
    : { type: "dropped", reason: "no_trigger" };
}

export function routeGlobalMessage(input: {
  senderId: string;
  allowlist: string[];
}): { type: "orchestrator" } | { type: "dropped"; reason: "not_allowed" } {
  return senderMatchesAllowlist(input.senderId, input.allowlist)
    ? { type: "orchestrator" }
    : { type: "dropped", reason: "not_allowed" };
}
