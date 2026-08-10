import type { App } from "obsidian";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	getChatobbyVaultRuntimePaths,
	initializeChatobbyVaultIdentity,
} from "../../src/vault-runtime";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const path of temporaryDirectories.splice(0)) await rm(path, { recursive: true, force: true });
});

describe("stable Chatobby Vault identity", () => {
	it("persists across connector instances and a Vault directory rename", async () => {
		const parent = await mkdtemp(join(tmpdir(), "chatobby-vault-identity-"));
		temporaryDirectories.push(parent);
		let currentRoot = join(parent, "Original Vault");
		await mkdir(currentRoot, { recursive: true });
		const firstApp = appAt(() => currentRoot);

		const created = await initializeChatobbyVaultIdentity(firstApp);
		const originalPaths = getChatobbyVaultRuntimePaths(firstApp);
		expect(originalPaths?.vaultId).toBe(created.vaultId);
		expect(JSON.parse(await readFile(join(currentRoot, ".chatobby", "vault.json"), "utf8"))).toEqual(created);

		const renamedRoot = join(parent, "Renamed Vault");
		await rename(currentRoot, renamedRoot);
		currentRoot = renamedRoot;
		const movedPaths = getChatobbyVaultRuntimePaths(firstApp);
		expect(movedPaths?.vaultId).toBe(created.vaultId);
		expect(movedPaths?.legacyVaultId).not.toBe(originalPaths?.legacyVaultId);

		const reopened = await initializeChatobbyVaultIdentity(appAt(() => renamedRoot));
		expect(reopened).toEqual(created);
	});
});

function appAt(root: () => string): App {
	return {
		vault: {
			adapter: { getBasePath: root },
		},
	} as unknown as App;
}
