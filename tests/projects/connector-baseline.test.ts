import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toPromptContextPacket } from "../../src/prompt";
import { resolveChatobbyPlatformPaths } from "../../src/runtime/infrastructure/platform-paths";
import { deriveLegacyRuntimeVaultId } from "../../src/vault-runtime";
import { resolveVaultDirectoryCwd } from "../../src/ui/session/session-directory";

interface ConnectorBaselineEvidence {
  schemaVersion: number;
  normative: boolean;
  authority: string;
  requirements: Array<{
    id: string;
    summary: string;
    disposition: "preserve" | "migrate" | "replace" | "deprecate" | "reject";
    evidence: string[];
  }>;
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const evidencePath = join(import.meta.dirname, "connector-baseline.evidence.json");

describe("Projects Phase 0 connector baseline", () => {
  it("maps every connector-owned baseline requirement to checked repository evidence", () => {
    const manifest = JSON.parse(readFileSync(evidencePath, "utf8")) as ConnectorBaselineEvidence;

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      normative: false,
    });
    expect(manifest.authority).toContain("source repository Projects SRS");
    expect(manifest.requirements.map(({ id }) => id)).toEqual([
      "PRJ-BASE-002",
      "PRJ-BASE-003",
      "PRJ-BASE-009",
      "PRJ-BASE-010",
      "PRJ-BASE-012",
    ]);
    for (const requirement of manifest.requirements) {
      expect(requirement.summary.trim().length).toBeGreaterThan(20);
      expect(requirement.evidence.length).toBeGreaterThan(0);
      for (const path of requirement.evidence) {
        expect(existsSync(join(repositoryRoot, path)), `${requirement.id}: ${path}`).toBe(true);
      }
    }
  });

  it("keeps the path-derived runtime identity only as a migration alias", () => {
    const original = deriveLegacyRuntimeVaultId("C:/Vault/Research");

    expect(original).toBe(deriveLegacyRuntimeVaultId("C:/Vault/Research/."));
    expect(original).not.toBe(deriveLegacyRuntimeVaultId("C:/Vault/Renamed Research"));
    expect(original).not.toBe(deriveLegacyRuntimeVaultId("c:/vault/research"));
    expect(original).toMatch(/^vault-[a-f0-9]{24}$/u);
  });

  it("records current Linux runtime locations with and without XDG overrides", () => {
    expect(resolveChatobbyPlatformPaths({
      platform: "linux",
      home: "/home/tester",
      xdgDataHome: "/data/tester",
      xdgRuntimeDir: "/run/user/1000",
    })).toEqual({
      applicationSupportRoot: "/data/tester/Chatobby",
      runtimeInstallRoot: "/data/tester/Chatobby/runtime",
      runtimeLeasesRoot: "/data/tester/Chatobby/runtimes",
      runtimeLogsRoot: "/home/tester/.local/state/Chatobby",
    });

    expect(resolveChatobbyPlatformPaths({
      platform: "linux",
      home: "/home/tester",
    })).toEqual({
      applicationSupportRoot: "/home/tester/.local/share/Chatobby",
      runtimeInstallRoot: "/home/tester/.local/share/Chatobby/runtime",
      runtimeLeasesRoot: "/home/tester/.local/share/Chatobby/runtimes",
      runtimeLogsRoot: "/home/tester/.local/state/Chatobby",
    });
  });

  it("keeps the prompt workspace relative while session creation resolves an absolute cwd", () => {
    const packet = toPromptContextPacket({ frontend: "obsidian", vault: "Work" }, {
      workingDirectory: "Projects/Research",
      sessionMessageCount: 0,
    });
    const controllerSource = readFileSync(join(repositoryRoot, "src/ui/controller/session-controller.ts"), "utf8");

    expect(packet.workspace?.workingDirectory).toBe("Projects/Research");
    expect(resolveVaultDirectoryCwd("C:\\Vault", "Projects/Research")).toBe("C:\\Vault\\Projects\\Research");
    expect(controllerSource).toContain("cwdOverride: scope.cwd");
  });

  it("records current new, resume, leaf-state, focus, and multi-view routing", () => {
    const mainSource = readFileSync(join(repositoryRoot, "src/main.ts"), "utf8");
    const viewSource = readFileSync(join(repositoryRoot, "src/ui/view.ts"), "utf8");
    const routerSource = readFileSync(join(repositoryRoot, "src/ui/session/leaf-directory-router.ts"), "utf8");
    const registrySource = readFileSync(join(repositoryRoot, "src/runtime/application/frontend-session-registry.ts"), "utf8");

    expect(mainSource).toContain("await this.openBlankView(vaultDirectoryPath)");
		expect(mainSource).toContain("await this.startSessionFromVaultDirectory(vaultDirectoryPath)");
		expect(mainSource).toContain("await this.openSessionsFromVaultDirectory(vaultDirectoryPath)");
		expect(mainSource).toContain('view.commandOpenPage("projects")');
		expect(mainSource).toContain("await view.openProjectSessions(canonical.projectId)");
		expect(mainSource).toContain("project.canonicalVaultRelativePath");
		expect(mainSource).toContain("directoryProjectLaunchBehavior");
		expect(viewSource).toContain("this.overlayScreens.projects.open(state.projectId)");
    expect(mainSource).toContain("find((view) => view.getWorkingDirectoryPath() === normalized)");
    expect(mainSource).toContain("find((view) => view.hasSessionPath(sessionPath))");
    expect(viewSource).toContain("vaultDirectoryPath: this.sessions.workingDirectoryPath()");
    expect(viewSource).toContain("sessionPath: this.activeTab()?.sessionFile");
    expect(routerSource).toContain("if (this.options.canReuseCurrentTarget())");
    expect(routerSource).toContain("this.options.focusTarget(target)");
    expect(registrySource).toContain("private readonly entries = new Map<string, FrontendSessionEntry>()");
  });

  it("routes session browsing through the runtime-owned Projects projection", () => {
    const projectsSource = readFileSync(join(repositoryRoot, "src/features/projects/ui/projects-view.ts"), "utf8");
    const controllerSource = readFileSync(join(repositoryRoot, "src/features/projects/application/projects-screen-controller.ts"), "utf8");

    expect(projectsSource).toContain('type: "session.create"');
    expect(projectsSource).toContain('type: "session.resume-by-id"');
    expect(controllerSource).toContain('screenId: "projects"');
    expect(controllerSource).toContain("preferredEntityId: projectId");
  });

  it("classifies vault-prefs as inactive legacy code rather than current persistence", () => {
    const sourceFiles = sourceTypeScriptFiles(join(repositoryRoot, "src"));
    const consumers = sourceFiles.filter((path) => {
      if (path.endsWith("ui/session/vault-prefs.ts")) return false;
      return readFileSync(join(repositoryRoot, path), "utf8").includes("vault-prefs");
    });

    expect(consumers).toEqual([]);
    expect(existsSync(join(repositoryRoot, "docs/vault-session-prefs.md"))).toBe(false);
  });

  it("contains no authoritative Project-state writes in the characterized connector routes", () => {
    const routes = [
      "src/main.ts",
      "src/ui/view.ts",
      "src/ui/controller/session-controller.ts",
      "src/ui/session/file-explorer-session-menu.ts",
      "src/ui/session/leaf-directory-router.ts",
      "src/ui/session/session-directory.ts",
      "src/features/projects/application/projects-screen-controller.ts",
      "src/runtime/infrastructure/platform-paths.ts",
      "src/runtime/infrastructure/runtime-lease-store.ts",
    ];
    const forbiddenAuthorities = [
      ".chatobby-root.json",
      ".chatobby/projects",
      ".chatobby\\projects",
      ".chatobby/vault.json",
      ".chatobby\\vault.json",
    ];

    for (const route of routes) {
      const source = readFileSync(join(repositoryRoot, route), "utf8");
      for (const forbidden of forbiddenAuthorities) {
        expect(source, `${route} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

function sourceTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceTypeScriptFiles(path));
    else if (entry.name.endsWith(".ts")) files.push(relative(repositoryRoot, path).replaceAll("\\", "/"));
  }
  return files;
}
