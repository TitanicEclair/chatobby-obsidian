import type { RuntimeLifecycleState, RuntimeMode } from "../contracts";

const DEVELOPMENT_PAIR_FAILURE_MESSAGE =
  "A staged Chatobby development pair failed verification or startup. Chatobby is paused for this plugin load. Restage a valid exact pair, then reload Chatobby.";

type DevelopmentPairFailureState = Extract<RuntimeLifecycleState, { status: "error" }>;

export interface DevelopmentPairStartupFailure {
  readonly state: DevelopmentPairFailureState;
}

/** Keep a failed development-pair load visible while denying every later start route. */
export class DevelopmentPairStartupGate {
  private failure: DevelopmentPairStartupFailure | null = null;

  get blocked(): boolean {
    return this.failure !== null;
  }

  async capture(
    mode: RuntimeMode,
    operation: () => Promise<unknown>,
    occurredAt = Date.now(),
  ): Promise<DevelopmentPairStartupFailure | null> {
    try {
      await operation();
      return null;
    } catch {
      const failure: DevelopmentPairStartupFailure = {
        state: {
          status: "error",
          mode,
          diagnostics: {
            code: "development_pair_adoption_failed",
            message: DEVELOPMENT_PAIR_FAILURE_MESSAGE,
            recentLogs: [],
            occurredAt,
          },
        },
      };
      this.failure = failure;
      return failure;
    }
  }

  runtimeState(fallback: RuntimeLifecycleState): RuntimeLifecycleState {
    return this.failure?.state ?? fallback;
  }

  assertRuntimeStartAllowed(): void {
    if (this.failure) throw new DevelopmentPairStartupBlockedError();
  }
}

export class DevelopmentPairStartupBlockedError extends Error {
  constructor() {
    super(DEVELOPMENT_PAIR_FAILURE_MESSAGE);
    this.name = "DevelopmentPairStartupBlockedError";
  }
}
