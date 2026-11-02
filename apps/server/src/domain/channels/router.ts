import type { TriggerRef } from "../../application/ports/channels.ts";

export type ApprovalCommand = { action: "approve" | "reject"; runId: string; nodeId: string };

export type RouteDecision =
  | { type: "orchestrator"; reason: "admin" }
  | { type: "workflow"; trigger: TriggerRef; reason: "public_trigger" }
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

export function routeMessage(input: {
  senderId: string;
  text: string;
  channelSlug: string;
  allowlist: string[];
  triggers: TriggerRef[];
}): RouteDecision {
  const isAdmin = senderMatchesAllowlist(input.senderId, input.allowlist);
  if (isAdmin) {
    const command = parseApprovalCommand(input.text);
    if (command) return { type: "approval", command };
    return { type: "orchestrator", reason: "admin" };
  }
  const trigger = input.triggers.find(
    (item) => item.channelSlug === input.channelSlug && item.isPublic,
  );
  if (trigger) return { type: "workflow", trigger, reason: "public_trigger" };
  return { type: "dropped", reason: input.triggers.some((item) => item.channelSlug === input.channelSlug) ? "not_allowed" : "no_trigger" };
}
