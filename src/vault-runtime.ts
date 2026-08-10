import type { App } from "obsidian";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
	parseVaultId,
	parseVaultIdentityV1,
	type VaultIdentityV1,
} from "./vendor/@chatobby/project-contracts/index.js";
import { getVaultBasePath } from "./ui/session/session-directory";

export interface ChatobbyVaultRuntimePaths {
  vaultRoot: string;
  chatobbyRoot: string;
  agentDir: string;
  attachmentDir: string;
	/** Stable, path-independent identity persisted inside the vault. */
	vaultId: string;
	/** Pre-Projects lease key retained only for one-time authenticated retirement. */
	legacyVaultId: string;
}

const identities = new WeakMap<App, VaultIdentityV1>();

/**
 * Activate the portable Vault identity before any runtime lease or bridge is
 * created. Existing identities are validated and never rotated implicitly.
 */
export async function initializeChatobbyVaultIdentity(app: App): Promise<VaultIdentityV1> {
	const cached = identities.get(app);
	if (cached) return cached;
	const vaultRoot = getVaultBasePath(app);
	if (!vaultRoot) throw new Error("Chatobby requires a filesystem-backed vault.");
	const chatobbyRoot = join(vaultRoot, ".chatobby");
	const identityPath = join(chatobbyRoot, "vault.json");
	await prepareIdentityParent(chatobbyRoot);

	const current = await readVaultIdentity(identityPath);
	if (current) {
		identities.set(app, current);
		return current;
	}

	const proposed = parseVaultIdentityV1({
		schemaVersion: 1,
		vaultId: parseVaultId(`vault_${randomUUID()}`),
		createdAt: new Date().toISOString(),
	});
	if (!(await createVaultIdentity(identityPath, proposed))) {
		const raced = await readVaultIdentity(identityPath);
		if (!raced) throw new Error("Stable Vault identity creation lost a race without a readable result.");
		identities.set(app, raced);
		return raced;
	}
	identities.set(app, proposed);
	return proposed;
}

export function getCachedChatobbyVaultIdentity(app: App): VaultIdentityV1 | null {
	return identities.get(app) ?? null;
}

export function getChatobbyVaultRuntimePaths(app: App): ChatobbyVaultRuntimePaths | null {
  const vaultRoot = getVaultBasePath(app);
  if (!vaultRoot) return null;
	const identity = identities.get(app);
	if (!identity) return null;
  const chatobbyRoot = join(vaultRoot, ".chatobby");
  return {
    vaultRoot,
    chatobbyRoot,
    agentDir: join(chatobbyRoot, "agent"),
    attachmentDir: join(chatobbyRoot, "attachments"),
		vaultId: identity.vaultId,
		legacyVaultId: deriveLegacyRuntimeVaultId(vaultRoot),
  };
}

export function deriveLegacyRuntimeVaultId(vaultRoot: string): string {
	// Kept in one connector-owned compatibility function so it can be removed
	// after the one-time Projects migration retires all path-addressed leases.
	return `vault-${createLegacyVaultHash(vaultRoot)}`;
}

export function hasAgentDirArg(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--agent-dir" || arg.startsWith("--agent-dir="));
}

async function prepareIdentityParent(path: string): Promise<void> {
	await mkdir(path, { recursive: true, mode: 0o700 });
	const snapshot = await lstat(path);
	if (!snapshot.isDirectory() || snapshot.isSymbolicLink()) {
		throw new Error("The vault .chatobby path must be an ordinary directory.");
	}
	if (process.platform !== "win32") await chmod(path, 0o700);
}

async function readVaultIdentity(path: string): Promise<VaultIdentityV1 | null> {
	let snapshot: Awaited<ReturnType<typeof lstat>>;
	try {
		snapshot = await lstat(path);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return null;
		throw error;
	}
	if (!snapshot.isFile() || snapshot.isSymbolicLink()) {
		throw new Error("The stable Vault identity must be an ordinary file.");
	}
	if (snapshot.size > 64 * 1024) throw new Error("The stable Vault identity is unexpectedly large.");
	const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
	const handle = await open(path, constants.O_RDONLY | noFollow);
	try {
		const opened = await handle.stat();
		if (!opened.isFile() || opened.dev !== snapshot.dev || opened.ino !== snapshot.ino) {
			throw new Error("The stable Vault identity changed while it was opened.");
		}
		return parseVaultIdentityV1(JSON.parse(await handle.readFile("utf8")));
	} finally {
		await handle.close();
	}
}

async function createVaultIdentity(path: string, identity: VaultIdentityV1): Promise<boolean> {
	const temporary = `${path}.create-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(temporary, "wx", 0o600);
		await handle.writeFile(`${JSON.stringify(identity)}\n`, "utf8");
		await handle.sync();
		if (process.platform !== "win32") await handle.chmod(0o600);
		try {
			await link(temporary, path);
		} catch (error) {
			if (isNodeError(error) && error.code === "EEXIST") return false;
			throw error;
		}
		return true;
	} finally {
		await handle?.close().catch(() => undefined);
		await rm(temporary, { force: true }).catch(() => undefined);
	}
}

function createLegacyVaultHash(vaultRoot: string): string {
	return createHash("sha256").update(resolve(vaultRoot)).digest("hex").slice(0, 24);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
