const FAILURE_WINDOW_MS = 60_000;
const STABILITY_RESET_MS = 60_000;
const RESTART_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export interface RestartDecision {
  crashLoop: boolean;
  delayMs?: number;
}

/** Bounded five-attempt restart circuit breaker. */
export class RuntimeRestartPolicy {
  private failures: number[] = [];

  recordFailure(now = Date.now()): RestartDecision {
    this.failures = this.failures.filter((timestamp) => now - timestamp < FAILURE_WINDOW_MS);
    this.failures.push(now);
    if (this.failures.length >= RESTART_DELAYS_MS.length) return { crashLoop: true };
    return { crashLoop: false, delayMs: RESTART_DELAYS_MS[this.failures.length - 1] };
  }

  reset(): void {
    this.failures = [];
  }

  get stabilityResetMs(): number {
    return STABILITY_RESET_MS;
  }
}
