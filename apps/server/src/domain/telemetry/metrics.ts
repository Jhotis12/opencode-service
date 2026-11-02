import type { Metrics, MetricsSnapshot } from "./index.ts";

const MAX_SAMPLES = 2000;

export class InMemoryMetrics implements Metrics {
  private durations: number[] = [];
  private requests = 0;
  private errors = 0;
  private counters = new Map<string, number>();

  recordRequest(_route: string, status: number, durationMs: number): void {
    this.requests += 1;
    if (status >= 500) this.errors += 1;
    this.durations.push(durationMs);
    if (this.durations.length > MAX_SAMPLES) this.durations.shift();
  }

  increment(name: string): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  snapshot(): MetricsSnapshot {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const at = (q: number) =>
      sorted.length === 0 ? 0 : Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
    return {
      requests: this.requests,
      errors: this.errors,
      errorRate: this.requests === 0 ? 0 : this.errors / this.requests,
      p50Ms: at(0.5),
      p95Ms: at(0.95),
      p99Ms: at(0.99),
    };
  }
}
