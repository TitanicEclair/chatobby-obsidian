// Generated from packages/chatobby/src/guide-release-asset.ts. Do not edit.
export const CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION = 1 as const;
export const CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION = 2 as const;
export const CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION = 1 as const;
export const CHATOBBY_GUIDE_CHANNEL_CONSUMER_SCHEMA_VERSION = 1 as const;
export const CHATOBBY_GUIDE_ASSET_FORMAT = "chatobby-guide-file-set-v1" as const;
export const CHATOBBY_GUIDE_PRODUCT = "Chatobby Guide" as const;
export const CHATOBBY_GUIDE_CHANNEL_PRODUCT = "Chatobby Guide Channel" as const;
export const CHATOBBY_GUIDE_CHANNEL_NAME = "stable" as const;
export const CHATOBBY_GUIDE_CHANNEL_FILE = "guide-channel.json" as const;
export const CHATOBBY_GUIDE_DIRECTORY = "Chatobby Guide" as const;
export const CHATOBBY_GUIDE_MAX_ASSET_BYTES = 2 * 1024 * 1024;
export const CHATOBBY_GUIDE_MAX_FILES = 64;
export const CHATOBBY_GUIDE_MAX_FILE_BYTES = 256 * 1024;
export const CHATOBBY_GUIDE_MAX_PATH_LENGTH = 180;

export interface ChatobbyGuideAssetFile {
	path: string;
	title: string;
	content: string;
}

export interface ChatobbyGuideAsset {
	schemaVersion: typeof CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION;
	product: typeof CHATOBBY_GUIDE_PRODUCT;
	productVersion: string;
	guideRevision: string;
	format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
	indexPath: string;
	title: string;
	earlyAccess: boolean;
	confirmationNotice: string;
	files: ChatobbyGuideAssetFile[];
}

/** Version-independent guide bytes accepted only through a signed compatible channel. */
export interface ChatobbyGuideChannelAsset {
	schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION;
	product: typeof CHATOBBY_GUIDE_PRODUCT;
	guideRevision: string;
	format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
	indexPath: string;
	title: string;
	earlyAccess: boolean;
	confirmationNotice: string;
	files: ChatobbyGuideAssetFile[];
}

export type ChatobbyGuideFileSet = ChatobbyGuideAsset | ChatobbyGuideChannelAsset;

export interface ChatobbyGuideReleaseDescriptor {
	schemaVersion: typeof CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION;
	product: typeof CHATOBBY_GUIDE_PRODUCT;
	productVersion: string;
	guideRevision: string;
	format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
	file: string;
	size: number;
	sha256: string;
	fileCount: number;
}

export interface ChatobbyGuideChannelAssetDescriptor {
	schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION;
	product: typeof CHATOBBY_GUIDE_PRODUCT;
	guideRevision: string;
	format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
	file: string;
	size: number;
	sha256: string;
	fileCount: number;
}

export interface ChatobbyGuideChannel {
	schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION;
	product: typeof CHATOBBY_GUIDE_CHANNEL_PRODUCT;
	channel: typeof CHATOBBY_GUIDE_CHANNEL_NAME;
	minimumConnectorVersion: string;
	maximumConnectorVersion: string;
	minimumConsumerSchemaVersion: number;
	maximumConsumerSchemaVersion: number;
	guide: ChatobbyGuideChannelAssetDescriptor;
	signatureAlgorithm: "ed25519";
	signature: string;
}

/** Parse the exact-version guide file set before any vault write is considered. */
export function parseChatobbyGuideAsset(value: unknown, expectedProductVersion: string): ChatobbyGuideAsset {
	const record = strictRecord(value, [
		"schemaVersion",
		"product",
		"productVersion",
		"guideRevision",
		"format",
		"indexPath",
		"title",
		"earlyAccess",
		"confirmationNotice",
		"files",
	]);
	if (
		record.schemaVersion !== CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION ||
		record.product !== CHATOBBY_GUIDE_PRODUCT ||
		record.format !== CHATOBBY_GUIDE_ASSET_FORMAT
	) {
		throw new Error("guide asset identity is unsupported");
	}
	const productVersion = requiredBoundedString(record.productVersion, "productVersion", 64);
	if (productVersion !== expectedProductVersion)
		throw new Error("guide asset product version does not match connector");
	const files = parseGuideFiles(record.files);
	const indexPath = validateChatobbyGuidePath(
		requiredBoundedString(record.indexPath, "indexPath", CHATOBBY_GUIDE_MAX_PATH_LENGTH),
	);
	if (!files.some((file) => file.path === indexPath)) throw new Error("guide asset indexPath is not present in files");
	return {
		schemaVersion: CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION,
		product: CHATOBBY_GUIDE_PRODUCT,
		productVersion,
		guideRevision: requiredBoundedString(record.guideRevision, "guideRevision", 128),
		format: CHATOBBY_GUIDE_ASSET_FORMAT,
		indexPath,
		title: requiredBoundedString(record.title, "title", 160),
		earlyAccess: requiredBoolean(record.earlyAccess, "earlyAccess"),
		confirmationNotice: requiredBoundedString(record.confirmationNotice, "confirmationNotice", 2_000),
		files,
	};
}

/** Parse content-addressed guide bytes without tying them to an application release. */
export function parseChatobbyGuideChannelAsset(
	value: unknown,
	expectedGuideRevision: string,
): ChatobbyGuideChannelAsset {
	const record = strictRecord(value, [
		"schemaVersion",
		"product",
		"guideRevision",
		"format",
		"indexPath",
		"title",
		"earlyAccess",
		"confirmationNotice",
		"files",
	]);
	if (
		record.schemaVersion !== CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION ||
		record.product !== CHATOBBY_GUIDE_PRODUCT ||
		record.format !== CHATOBBY_GUIDE_ASSET_FORMAT
	) {
		throw new Error("guide channel asset identity is unsupported");
	}
	const guideRevision = validateGuideRevision(requiredBoundedString(record.guideRevision, "guideRevision", 128));
	if (guideRevision !== expectedGuideRevision)
		throw new Error("guide channel asset revision does not match descriptor");
	const files = parseGuideFiles(record.files);
	const indexPath = validateChatobbyGuidePath(
		requiredBoundedString(record.indexPath, "indexPath", CHATOBBY_GUIDE_MAX_PATH_LENGTH),
	);
	if (!files.some((file) => file.path === indexPath)) throw new Error("guide asset indexPath is not present in files");
	return {
		schemaVersion: CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
		product: CHATOBBY_GUIDE_PRODUCT,
		guideRevision,
		format: CHATOBBY_GUIDE_ASSET_FORMAT,
		indexPath,
		title: requiredBoundedString(record.title, "title", 160),
		earlyAccess: requiredBoolean(record.earlyAccess, "earlyAccess"),
		confirmationNotice: requiredBoundedString(record.confirmationNotice, "confirmationNotice", 2_000),
		files,
	};
}

/** Parse the stable signed channel before checking its signature or compatibility. */
export function parseChatobbyGuideChannel(value: unknown): ChatobbyGuideChannel {
	const record = strictRecord(value, [
		"schemaVersion",
		"product",
		"channel",
		"minimumConnectorVersion",
		"maximumConnectorVersion",
		"minimumConsumerSchemaVersion",
		"maximumConsumerSchemaVersion",
		"guide",
		"signatureAlgorithm",
		"signature",
	]);
	if (
		record.schemaVersion !== CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION ||
		record.product !== CHATOBBY_GUIDE_CHANNEL_PRODUCT ||
		record.channel !== CHATOBBY_GUIDE_CHANNEL_NAME ||
		record.signatureAlgorithm !== "ed25519"
	) {
		throw new Error("guide channel identity is unsupported");
	}
	const minimumConnectorVersion = validateConnectorVersion(
		requiredBoundedString(record.minimumConnectorVersion, "minimumConnectorVersion", 64),
		false,
	);
	const maximumConnectorVersion = validateConnectorVersion(
		requiredBoundedString(record.maximumConnectorVersion, "maximumConnectorVersion", 64),
		true,
	);
	if (compareVersionTuples(versionTuple(minimumConnectorVersion), versionTuple(maximumConnectorVersion)) > 0) {
		throw new Error("guide channel connector compatibility range is invalid");
	}
	const minimumConsumerSchemaVersion = requiredPositiveSafeInteger(
		record.minimumConsumerSchemaVersion,
		"minimumConsumerSchemaVersion",
	);
	const maximumConsumerSchemaVersion = requiredPositiveSafeInteger(
		record.maximumConsumerSchemaVersion,
		"maximumConsumerSchemaVersion",
	);
	if (minimumConsumerSchemaVersion > maximumConsumerSchemaVersion) {
		throw new Error("guide channel consumer schema range is invalid");
	}
	const guide = parseGuideChannelDescriptor(record.guide);
	const signature = requiredBoundedString(record.signature, "signature", 128);
	if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(signature)) throw new Error("guide channel signature is invalid");
	return {
		schemaVersion: CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION,
		product: CHATOBBY_GUIDE_CHANNEL_PRODUCT,
		channel: CHATOBBY_GUIDE_CHANNEL_NAME,
		minimumConnectorVersion,
		maximumConnectorVersion,
		minimumConsumerSchemaVersion,
		maximumConsumerSchemaVersion,
		guide,
		signatureAlgorithm: "ed25519",
		signature,
	};
}

export function chatobbyGuideChannelSigningPayload(
	value: Omit<ChatobbyGuideChannel, "signatureAlgorithm" | "signature"> | ChatobbyGuideChannel,
): string {
	return JSON.stringify({
		schemaVersion: value.schemaVersion,
		product: value.product,
		channel: value.channel,
		minimumConnectorVersion: value.minimumConnectorVersion,
		maximumConnectorVersion: value.maximumConnectorVersion,
		minimumConsumerSchemaVersion: value.minimumConsumerSchemaVersion,
		maximumConsumerSchemaVersion: value.maximumConsumerSchemaVersion,
		guide: value.guide,
	});
}

export function isChatobbyGuideChannelCompatible(
	channel: ChatobbyGuideChannel,
	connectorVersion: string,
	consumerSchemaVersion: number,
): boolean {
	let actual: readonly [number, number, number];
	try {
		actual = versionTuple(validateConnectorVersion(connectorVersion, false));
	} catch {
		return false;
	}
	return (
		compareVersionTuples(actual, versionTuple(channel.minimumConnectorVersion)) >= 0 &&
		compareVersionTuples(actual, versionTuple(channel.maximumConnectorVersion)) <= 0 &&
		consumerSchemaVersion >= channel.minimumConsumerSchemaVersion &&
		consumerSchemaVersion <= channel.maximumConsumerSchemaVersion
	);
}

export function parseChatobbyGuideReleaseDescriptor(
	value: unknown,
	expectedProductVersion: string,
): ChatobbyGuideReleaseDescriptor {
	const record = strictRecord(value, [
		"schemaVersion",
		"product",
		"productVersion",
		"guideRevision",
		"format",
		"file",
		"size",
		"sha256",
		"fileCount",
	]);
	if (
		record.schemaVersion !== CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION ||
		record.product !== CHATOBBY_GUIDE_PRODUCT ||
		record.format !== CHATOBBY_GUIDE_ASSET_FORMAT ||
		record.productVersion !== expectedProductVersion
	) {
		throw new Error("guide release descriptor identity does not match connector");
	}
	const file = requiredBoundedString(record.file, "file", 180);
	if (file.includes("/") || file.includes("\\") || !/^chatobby-guide-[0-9A-Za-z.-]+\.json$/u.test(file)) {
		throw new Error("guide release descriptor file is invalid");
	}
	if (
		!Number.isSafeInteger(record.size) ||
		(record.size as number) <= 0 ||
		(record.size as number) > CHATOBBY_GUIDE_MAX_ASSET_BYTES
	) {
		throw new Error("guide release descriptor size is invalid");
	}
	if (
		!Number.isSafeInteger(record.fileCount) ||
		(record.fileCount as number) <= 0 ||
		(record.fileCount as number) > CHATOBBY_GUIDE_MAX_FILES
	) {
		throw new Error("guide release descriptor fileCount is invalid");
	}
	const sha256 = requiredBoundedString(record.sha256, "sha256", 64);
	if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new Error("guide release descriptor sha256 is invalid");
	return {
		schemaVersion: CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION,
		product: CHATOBBY_GUIDE_PRODUCT,
		productVersion: expectedProductVersion,
		guideRevision: requiredBoundedString(record.guideRevision, "guideRevision", 128),
		format: CHATOBBY_GUIDE_ASSET_FORMAT,
		file,
		size: record.size as number,
		sha256,
		fileCount: record.fileCount as number,
	};
}

function parseGuideChannelDescriptor(value: unknown): ChatobbyGuideChannelAssetDescriptor {
	const record = strictRecord(value, [
		"schemaVersion",
		"product",
		"guideRevision",
		"format",
		"file",
		"size",
		"sha256",
		"fileCount",
	]);
	if (
		record.schemaVersion !== CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION ||
		record.product !== CHATOBBY_GUIDE_PRODUCT ||
		record.format !== CHATOBBY_GUIDE_ASSET_FORMAT
	) {
		throw new Error("guide channel descriptor identity is unsupported");
	}
	const guideRevision = validateGuideRevision(requiredBoundedString(record.guideRevision, "guideRevision", 128));
	const file = requiredBoundedString(record.file, "file", 180);
	if (file !== `guides/chatobby-guide-${guideRevision}.json`) {
		throw new Error("guide channel descriptor file is invalid");
	}
	const size = requiredPositiveSafeInteger(record.size, "size");
	if (size > CHATOBBY_GUIDE_MAX_ASSET_BYTES) throw new Error("guide channel descriptor size is invalid");
	const fileCount = requiredPositiveSafeInteger(record.fileCount, "fileCount");
	if (fileCount > CHATOBBY_GUIDE_MAX_FILES) throw new Error("guide channel descriptor fileCount is invalid");
	const sha256 = requiredBoundedString(record.sha256, "sha256", 64);
	if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new Error("guide channel descriptor sha256 is invalid");
	return {
		schemaVersion: CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
		product: CHATOBBY_GUIDE_PRODUCT,
		guideRevision,
		format: CHATOBBY_GUIDE_ASSET_FORMAT,
		file,
		size,
		sha256,
		fileCount,
	};
}

function parseGuideFiles(value: unknown): ChatobbyGuideAssetFile[] {
	if (!Array.isArray(value) || value.length === 0 || value.length > CHATOBBY_GUIDE_MAX_FILES) {
		throw new Error("guide asset file count is invalid");
	}
	const paths = new Set<string>();
	const pathKeys = new Set<string>();
	const files = value.map((item, index) => {
		const file = strictRecord(item, ["path", "title", "content"]);
		const path = validateChatobbyGuidePath(
			requiredBoundedString(file.path, `files[${index}].path`, CHATOBBY_GUIDE_MAX_PATH_LENGTH),
		);
		const pathKey = path.normalize("NFC").toLowerCase();
		if (paths.has(path) || pathKeys.has(pathKey)) throw new Error(`guide asset contains duplicate path ${path}`);
		paths.add(path);
		pathKeys.add(pathKey);
		const content = requiredBoundedString(file.content, `files[${index}].content`, CHATOBBY_GUIDE_MAX_FILE_BYTES);
		if (!content.startsWith("# ")) throw new Error(`guide page must start with an H1: ${path}`);
		return { path, title: requiredBoundedString(file.title, `files[${index}].title`, 160), content };
	});
	const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
	if (JSON.stringify([...paths]) !== JSON.stringify(sortedPaths)) throw new Error("guide asset paths are not sorted");
	return files;
}

function validateGuideRevision(value: string): string {
	if (!/^[0-9A-Za-z][0-9A-Za-z.-]*$/u.test(value)) throw new Error("guide guideRevision is invalid");
	return value;
}

function validateConnectorVersion(value: string, allowWildcard: boolean): string {
	const pattern = allowWildcard ? /^(\d+)\.(\d+)\.(\d+|x)$/u : /^(\d+)\.(\d+)\.(\d+)$/u;
	const match = pattern.exec(value);
	if (!match) throw new Error("guide connector version is invalid");
	for (const component of match.slice(1)) {
		if (component === "x") continue;
		if (!Number.isSafeInteger(Number(component))) throw new Error("guide connector version is invalid");
	}
	return value;
}

function versionTuple(value: string): readonly [number, number, number] {
	const [major, minor, patch] = value.split(".");
	return [Number(major), Number(minor), patch === "x" ? Number.MAX_SAFE_INTEGER : Number(patch)];
}

function compareVersionTuples(left: readonly number[], right: readonly number[]): number {
	for (let index = 0; index < 3; index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function requiredPositiveSafeInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`guide ${label} is invalid`);
	return value as number;
}

export function validateChatobbyGuidePath(path: string): string {
	if (
		path.includes("\\") ||
		path.startsWith("/") ||
		/[\u0000-\u001f\u007f<>:"|?*]/u.test(path) ||
		path.length > CHATOBBY_GUIDE_MAX_PATH_LENGTH ||
		!path.startsWith(`${CHATOBBY_GUIDE_DIRECTORY}/`) ||
		!path.endsWith(".md")
	) {
		throw new Error(`guide path is outside ${CHATOBBY_GUIDE_DIRECTORY}: ${path}`);
	}
	const segments = path.split("/");
	if (segments.length !== 2 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
		throw new Error(`guide path is invalid: ${path}`);
	}
	const fileName = segments[1] ?? "";
	const stem = fileName.slice(0, -3);
	const portableStem = stem.replace(/[ .]+$/u, "");
	if (portableStem !== stem || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(portableStem)) {
		throw new Error(`guide path is not portable: ${path}`);
	}
	return path;
}

function strictRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error("guide value must be an object");
	const record = value as Record<string, unknown>;
	const actual = Object.keys(record).sort();
	const expected = [...keys].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("guide value contains unexpected fields");
	return record;
}

function requiredBoundedString(value: unknown, label: string, maximumBytes: number): string {
	if (typeof value !== "string" || value.length === 0 || new TextEncoder().encode(value).byteLength > maximumBytes) {
		throw new Error(`guide ${label} is invalid`);
	}
	return value;
}

function requiredBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") throw new Error(`guide ${label} is invalid`);
	return value;
}
