import { describe, expect, it, vi } from "vitest";
import type {
  SubagentAgentEditorDraft,
  SubagentScreenActions,
} from "../../src/features/subagents/domain/screen-model";
import type { SubagentViewState } from "../../src/features/subagents/state/subagent-store";
import { renderAgentsPanel } from "../../src/features/subagents/ui/catalog-panels";
import type {
  FrontendSubagentAgentDefinition,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("subagent role catalogue", () => {
  it("shows Vault or Project availability and keeps internal role ids out of the editor", () => {
    const host = document.body.createDiv();
    const drafts = new Map<string, SubagentAgentEditorDraft>();
    const actions = {
      openPermissions: vi.fn(),
      getAgentEditorDraft: (id: string) => drafts.get(id),
      setAgentEditorDraft: (id: string, draft: SubagentAgentEditorDraft) => drafts.set(id, draft),
      clearAgentEditorDraft: (id: string) => drafts.delete(id),
      deleteDefinition: vi.fn(async () => {}),
      saveDefinition: vi.fn(async () => {}),
    } as unknown as SubagentScreenActions;
    const definitions: FrontendSubagentAgentDefinition[] = [
      definition({ id: "project-role", name: "Project role", scope: "directory", scopeId: "C:/vault/project" }),
      definition({ id: "session-role", name: "Resolved session role", scope: "session", scopeId: "session-1" }),
      definition({
        id: "researcher",
        name: "Researcher",
        scope: "global",
        scopeId: "default",
        builtIn: true,
      }),
    ];
    const state = {
      definitions,
      models: [],
      skills: [],
      permissionSnapshot: null,
    } as unknown as SubagentViewState;

    renderAgentsPanel(host, state, actions);

    expect([...host.querySelectorAll(".chatobby-subagents__scope")].map((item) => item.textContent)).toEqual([
      "Project",
      "Session",
      "Chatobby role",
    ]);
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].filter((button) => button.textContent === "Edit"))
      .toHaveLength(1);
    const newRole = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "New");
    if (!newRole) throw new Error("New-role button missing");
    newRole.click();
    expect(host.textContent).toContain("Available in");
    expect(host.textContent).not.toContain("Role key");
    expect(host.textContent).not.toContain("Availability");
    const availability = host.querySelector<HTMLSelectElement>('select[aria-label="Role availability"]');
    expect([...(availability?.options ?? [])].map((option) => [option.text, option.value])).toEqual([
      ["This vault", "vault"],
      ["This project", "directory"],
    ]);
    expect(availability?.value).toBe("vault");
    expect(host.textContent).toContain(
      "Fresh starts with Chatobby guidance, this role's instructions, and the assignment.",
    );
  });
});

function definition(
  overrides: Partial<FrontendSubagentAgentDefinition>,
): FrontendSubagentAgentDefinition {
  return {
    id: "role",
    name: "Role",
    description: "Does bounded work",
    scope: "vault",
    scopeId: "vault-1",
    systemPrompt: "Work carefully.",
    enabled: true,
    policy: {},
    revision: 1,
    updatedAt: 1,
    ...overrides,
  };
}
