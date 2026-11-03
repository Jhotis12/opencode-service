export interface ChatTurnPolicy {
  maxMs: number;
  idleMs: number;
  pollMs: number;
  transportRetryMs: number;
}

const DEFAULT_MAX_MS = 30 * 60_000;
const DEFAULT_IDLE_MS = 10 * 60_000;
const DEFAULT_POLL_MS = 750;
const DEFAULT_TRANSPORT_RETRY_MS = 2_000;

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function resolveChatTurnPolicy(env: Record<string, string | undefined> = process.env): ChatTurnPolicy {
  const compatibilityMax = env.AGENT_CHAT_TIMEOUT_MS ? positive(env.AGENT_CHAT_TIMEOUT_MS, DEFAULT_MAX_MS) : undefined;
  const maxMs = positive(env.AGENT_TURN_MAX_MS, compatibilityMax ?? DEFAULT_MAX_MS);
  const idleMs = Math.min(positive(env.AGENT_TURN_IDLE_MS, DEFAULT_IDLE_MS), maxMs);
  const pollMs = Math.max(100, Math.min(positive(env.AGENT_TURN_POLL_MS, DEFAULT_POLL_MS), 5_000));
  const transportRetryMs = Math.max(100, Math.min(positive(env.AGENT_TURN_RETRY_MS, DEFAULT_TRANSPORT_RETRY_MS), 30_000));
  return { maxMs, idleMs, pollMs, transportRetryMs };
}

export function assertChatTimeoutsCoverOpenCode(
  policy: ChatTurnPolicy,
  openCode: { providerMs?: number; bashMs?: number } = {},
): void {
  const shorter = [openCode.providerMs, openCode.bashMs].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  if (shorter.some((value) => value >= policy.maxMs)) {
    throw new Error(
      `chat turn max ${policy.maxMs}ms must be greater than OpenCode provider/bash timeouts (${shorter.join(", ")}ms)`,
    );
  }
}
