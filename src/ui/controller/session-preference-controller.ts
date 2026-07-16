import type { SessionPreferences } from "../../types";
import type { FrontendComposerViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";

interface SessionPreferenceControllerOptions {
  remember: (patch: Partial<SessionPreferences>) => Promise<void>;
  refreshControls: () => void;
  getComposer: () => FrontendComposerViewModel | null;
  applyRuntimeControl: (id: "model" | "effort", value: string) => Promise<void>;
}

/** Persists defaults while runtime intents atomically mutate the active session. */
export class SessionPreferenceController {
  constructor(private readonly options: SessionPreferenceControllerOptions) {}

  async apply(patch: Partial<SessionPreferences>): Promise<void> {
    await this.options.remember(patch);
    if (patch.model) await this.options.applyRuntimeControl("model", patch.model);
    if (patch.thinkingLevel) await this.options.applyRuntimeControl("effort", patch.thinkingLevel);
    this.options.refreshControls();
  }

  async cycleModel(): Promise<void> {
    const control = this.options.getComposer()?.controls.find((candidate) => candidate.id === "model");
    if (!control || control.options.length === 0) return;
    const currentIndex = control.options.findIndex((option) => option.value === control.value);
    const next = control.options[(currentIndex + 1 + control.options.length) % control.options.length];
    if (!next || next.disabledReason) return;
    await this.apply({ model: next.value });
  }

  async cycleThinking(): Promise<void> {
    const control = this.options.getComposer()?.controls.find((candidate) => candidate.id === "effort");
    if (!control || control.options.length === 0) return;
    const currentIndex = control.options.findIndex((option) => option.value === control.value);
    const next = control.options[(currentIndex + 1 + control.options.length) % control.options.length];
    if (!next || next.disabledReason || !isThinkingLevel(next.value)) return;
    await this.apply({ thinkingLevel: next.value });
  }
}

function isThinkingLevel(value: string): value is SessionPreferences["thinkingLevel"] {
  return value === "off" || value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh";
}
