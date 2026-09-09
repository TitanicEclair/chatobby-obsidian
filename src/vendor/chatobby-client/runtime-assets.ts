// Generated from packages/chatobby-runtime-contracts/src/runtime-assets.ts. Do not edit.
import { createHash } from "node:crypto";
import { LANDSTRIP_DEPENDENCIES } from "./landstrip-dependencies.ts";

/** Dependency-light package asset policy shared by staging and development adoption. */
export const RUNTIME_REQUIRED_ASSET_PATHS = [
	"assets/photon_rs_bg.wasm",
	"assets/tree-sitter-bash.wasm",
	"assets/tesseract-data/eng.traineddata.gz",
	"assets/tesseract-worker.cjs",
	"assets/web-tree-sitter.wasm",
	"export-html/template.css",
	"export-html/template.html",
	"export-html/template.js",
	"export-html/vendor/highlight.min.js",
	"export-html/vendor/marked.min.js",
	"assets/node_modules/tesseract.js-core/package.json",
	"assets/node_modules/tesseract.js-core/index.js",
	"assets/node_modules/tesseract.js-core/tesseract-core.js",
	"assets/node_modules/tesseract.js-core/tesseract-core.wasm",
	"assets/node_modules/tesseract.js-core/tesseract-core.wasm.js",
] as const;

/** Pinned upstream baseline; controlled Windows modifications ship with their complete corresponding source. */
export const LANDSTRIP_VERSION = "0.18.43";
export const LANDSTRIP_SOURCE_REVISION = "5da71c932a7e6e1c059ca2096935d0fe50e3d566";
export const LANDSTRIP_ASSET_ROOT = "assets/sandbox/landstrip";
export const LANDSTRIP_LEGAL_ASSET_PATHS = [
	`${LANDSTRIP_ASSET_ROOT}/LICENSE`,
	`${LANDSTRIP_ASSET_ROOT}/landstrip-${LANDSTRIP_VERSION}-source.tar.gz`,
] as const;
/** Optional complete locked-source legal group; these files are never executable assets. */
export const LANDSTRIP_DEPENDENCY_ASSET_PATHS: readonly string[] = Object.freeze([
	...LANDSTRIP_DEPENDENCIES.sources.map((pin) => `${LANDSTRIP_ASSET_ROOT}/crates/${pin.name}-${pin.version}.crate`),
	...LANDSTRIP_DEPENDENCIES.supplementalNotices.map((pin) => `${LANDSTRIP_ASSET_ROOT}/notices/${pin.name}`),
	`${LANDSTRIP_ASSET_ROOT}/dependencies.json`,
	`${LANDSTRIP_ASSET_ROOT}/THIRD-PARTY-NOTICES.txt`,
]);
const landstripEntries = {
	"win32-x64": `${LANDSTRIP_ASSET_ROOT}/win32-x64/landstrip.exe`,
	"linux-x64": `${LANDSTRIP_ASSET_ROOT}/linux-x64/landstrip`,
	"linux-arm64": `${LANDSTRIP_ASSET_ROOT}/linux-arm64/landstrip`,
	"darwin-x64": `${LANDSTRIP_ASSET_ROOT}/darwin-x64/landstrip`,
	"darwin-arm64": `${LANDSTRIP_ASSET_ROOT}/darwin-arm64/landstrip`,
} as const;
export type LandstripRuntimeTarget = keyof typeof landstripEntries;

/** An asset location, not executable-byte verification or evidence of native support. */
export function landstripRuntimeAssetEntry(target: string): string | undefined {
	return Object.hasOwn(landstripEntries, target) ? landstripEntries[target as LandstripRuntimeTarget] : undefined;
}

/** Non-executable qualification data authenticated by the enclosing runtime manifest. */
export function landstripRuntimeQualificationEntry(target: string): string | undefined {
	const entry = landstripRuntimeAssetEntry(target);
	return entry === undefined ? undefined : `${entry.slice(0, entry.lastIndexOf("/"))}/qualification.json`;
}
const landstripQualifications = Object.keys(landstripEntries).map(
	(target) => landstripRuntimeQualificationEntry(target)!,
);

/** Exact self-contained win-x64 .NET 8.0.30 publish closure; no adjacent DLL wildcard. */
export const WINDOWS_SANDBOX_RUNTIME_VERSION = "8.0.30";
export const WINDOWS_SANDBOX_ASSET_ROOT = "assets/sandbox/win-x64";
export const WINDOWS_SANDBOX_HELPER_ENTRY = `${WINDOWS_SANDBOX_ASSET_ROOT}/Chatobby.SandboxHost.exe`;
export const WINDOWS_SANDBOX_SETUP_ENTRY = `${WINDOWS_SANDBOX_ASSET_ROOT}/Chatobby.SandboxSetup.exe`;
/** Historical Host-only inventory remains readable for preservation and rollback, not new native admission. */
export const WINDOWS_SANDBOX_HOST_ASSET_NAMES = [
	"Chatobby.SandboxHost.deps.json",
	"Chatobby.SandboxHost.dll",
	"Chatobby.SandboxHost.exe",
	"Chatobby.SandboxHost.runtimeconfig.json",
	"clretwrc.dll",
	"clrgc.dll",
	"clrjit.dll",
	"coreclr.dll",
	"createdump.exe",
	"hostfxr.dll",
	"hostpolicy.dll",
	"LICENSE.dotnet.txt",
	"Microsoft.CSharp.dll",
	"Microsoft.DiaSymReader.Native.amd64.dll",
	"Microsoft.VisualBasic.Core.dll",
	"Microsoft.VisualBasic.dll",
	"Microsoft.Win32.Primitives.dll",
	"Microsoft.Win32.Registry.dll",
	"mscordaccore_amd64_amd64_8.0.3026.36720.dll",
	"mscordaccore.dll",
	"mscordbi.dll",
	"mscorlib.dll",
	"mscorrc.dll",
	"msquic.dll",
	"netstandard.dll",
	"System.AppContext.dll",
	"System.Buffers.dll",
	"System.Collections.Concurrent.dll",
	"System.Collections.dll",
	"System.Collections.Immutable.dll",
	"System.Collections.NonGeneric.dll",
	"System.Collections.Specialized.dll",
	"System.ComponentModel.Annotations.dll",
	"System.ComponentModel.DataAnnotations.dll",
	"System.ComponentModel.dll",
	"System.ComponentModel.EventBasedAsync.dll",
	"System.ComponentModel.Primitives.dll",
	"System.ComponentModel.TypeConverter.dll",
	"System.Configuration.dll",
	"System.Console.dll",
	"System.Core.dll",
	"System.Data.Common.dll",
	"System.Data.DataSetExtensions.dll",
	"System.Data.dll",
	"System.Diagnostics.Contracts.dll",
	"System.Diagnostics.Debug.dll",
	"System.Diagnostics.DiagnosticSource.dll",
	"System.Diagnostics.FileVersionInfo.dll",
	"System.Diagnostics.Process.dll",
	"System.Diagnostics.StackTrace.dll",
	"System.Diagnostics.TextWriterTraceListener.dll",
	"System.Diagnostics.Tools.dll",
	"System.Diagnostics.TraceSource.dll",
	"System.Diagnostics.Tracing.dll",
	"System.dll",
	"System.Drawing.dll",
	"System.Drawing.Primitives.dll",
	"System.Dynamic.Runtime.dll",
	"System.Formats.Asn1.dll",
	"System.Formats.Tar.dll",
	"System.Globalization.Calendars.dll",
	"System.Globalization.dll",
	"System.Globalization.Extensions.dll",
	"System.IO.Compression.Brotli.dll",
	"System.IO.Compression.dll",
	"System.IO.Compression.FileSystem.dll",
	"System.IO.Compression.Native.dll",
	"System.IO.Compression.ZipFile.dll",
	"System.IO.dll",
	"System.IO.FileSystem.AccessControl.dll",
	"System.IO.FileSystem.dll",
	"System.IO.FileSystem.DriveInfo.dll",
	"System.IO.FileSystem.Primitives.dll",
	"System.IO.FileSystem.Watcher.dll",
	"System.IO.IsolatedStorage.dll",
	"System.IO.MemoryMappedFiles.dll",
	"System.IO.Pipes.AccessControl.dll",
	"System.IO.Pipes.dll",
	"System.IO.UnmanagedMemoryStream.dll",
	"System.Linq.dll",
	"System.Linq.Expressions.dll",
	"System.Linq.Parallel.dll",
	"System.Linq.Queryable.dll",
	"System.Memory.dll",
	"System.Net.dll",
	"System.Net.Http.dll",
	"System.Net.Http.Json.dll",
	"System.Net.HttpListener.dll",
	"System.Net.Mail.dll",
	"System.Net.NameResolution.dll",
	"System.Net.NetworkInformation.dll",
	"System.Net.Ping.dll",
	"System.Net.Primitives.dll",
	"System.Net.Quic.dll",
	"System.Net.Requests.dll",
	"System.Net.Security.dll",
	"System.Net.ServicePoint.dll",
	"System.Net.Sockets.dll",
	"System.Net.WebClient.dll",
	"System.Net.WebHeaderCollection.dll",
	"System.Net.WebProxy.dll",
	"System.Net.WebSockets.Client.dll",
	"System.Net.WebSockets.dll",
	"System.Numerics.dll",
	"System.Numerics.Vectors.dll",
	"System.ObjectModel.dll",
	"System.Private.CoreLib.dll",
	"System.Private.DataContractSerialization.dll",
	"System.Private.Uri.dll",
	"System.Private.Xml.dll",
	"System.Private.Xml.Linq.dll",
	"System.Reflection.DispatchProxy.dll",
	"System.Reflection.dll",
	"System.Reflection.Emit.dll",
	"System.Reflection.Emit.ILGeneration.dll",
	"System.Reflection.Emit.Lightweight.dll",
	"System.Reflection.Extensions.dll",
	"System.Reflection.Metadata.dll",
	"System.Reflection.Primitives.dll",
	"System.Reflection.TypeExtensions.dll",
	"System.Resources.Reader.dll",
	"System.Resources.ResourceManager.dll",
	"System.Resources.Writer.dll",
	"System.Runtime.CompilerServices.Unsafe.dll",
	"System.Runtime.CompilerServices.VisualC.dll",
	"System.Runtime.dll",
	"System.Runtime.Extensions.dll",
	"System.Runtime.Handles.dll",
	"System.Runtime.InteropServices.dll",
	"System.Runtime.InteropServices.JavaScript.dll",
	"System.Runtime.InteropServices.RuntimeInformation.dll",
	"System.Runtime.Intrinsics.dll",
	"System.Runtime.Loader.dll",
	"System.Runtime.Numerics.dll",
	"System.Runtime.Serialization.dll",
	"System.Runtime.Serialization.Formatters.dll",
	"System.Runtime.Serialization.Json.dll",
	"System.Runtime.Serialization.Primitives.dll",
	"System.Runtime.Serialization.Xml.dll",
	"System.Security.AccessControl.dll",
	"System.Security.Claims.dll",
	"System.Security.Cryptography.Algorithms.dll",
	"System.Security.Cryptography.Cng.dll",
	"System.Security.Cryptography.Csp.dll",
	"System.Security.Cryptography.dll",
	"System.Security.Cryptography.Encoding.dll",
	"System.Security.Cryptography.OpenSsl.dll",
	"System.Security.Cryptography.Primitives.dll",
	"System.Security.Cryptography.X509Certificates.dll",
	"System.Security.dll",
	"System.Security.Principal.dll",
	"System.Security.Principal.Windows.dll",
	"System.Security.SecureString.dll",
	"System.ServiceModel.Web.dll",
	"System.ServiceProcess.dll",
	"System.Text.Encoding.CodePages.dll",
	"System.Text.Encoding.dll",
	"System.Text.Encoding.Extensions.dll",
	"System.Text.Encodings.Web.dll",
	"System.Text.Json.dll",
	"System.Text.RegularExpressions.dll",
	"System.Threading.Channels.dll",
	"System.Threading.dll",
	"System.Threading.Overlapped.dll",
	"System.Threading.Tasks.Dataflow.dll",
	"System.Threading.Tasks.dll",
	"System.Threading.Tasks.Extensions.dll",
	"System.Threading.Tasks.Parallel.dll",
	"System.Threading.Thread.dll",
	"System.Threading.ThreadPool.dll",
	"System.Threading.Timer.dll",
	"System.Transactions.dll",
	"System.Transactions.Local.dll",
	"System.ValueTuple.dll",
	"System.Web.dll",
	"System.Web.HttpUtility.dll",
	"System.Windows.dll",
	"System.Xml.dll",
	"System.Xml.Linq.dll",
	"System.Xml.ReaderWriter.dll",
	"System.Xml.Serialization.dll",
	"System.Xml.XDocument.dll",
	"System.Xml.XmlDocument.dll",
	"System.Xml.XmlSerializer.dll",
	"System.Xml.XPath.dll",
	"System.Xml.XPath.XDocument.dll",
	"THIRD-PARTY-NOTICES.dotnet.txt",
	"WindowsBase.dll",
] as const;
/** Fixed production Setup entry files; runtime and legal bytes are shared with Host. */
export const WINDOWS_SANDBOX_SETUP_ASSET_NAMES = [
	"Chatobby.SandboxSetup.deps.json",
	"Chatobby.SandboxSetup.dll",
	"Chatobby.SandboxSetup.exe",
	"Chatobby.SandboxSetup.runtimeconfig.json",
] as const;
export const WINDOWS_SANDBOX_ASSET_NAMES = [
	...WINDOWS_SANDBOX_HOST_ASSET_NAMES,
	...WINDOWS_SANDBOX_SETUP_ASSET_NAMES,
] as const;
export const WINDOWS_SANDBOX_ASSET_PATHS = WINDOWS_SANDBOX_ASSET_NAMES.map(
	(name) => `${WINDOWS_SANDBOX_ASSET_ROOT}/${name}`,
);

// Enumerate the same finite OCR variants as the former expression.
const tesseractCorePaths = [
	"package.json",
	"index.js",
	...["", "-relaxedsimd", "-simd"].flatMap((variant) =>
		["", "-lstm"].flatMap((model) =>
			["js", "wasm", "wasm.js"].map((extension) => `tesseract-core${variant}${model}.${extension}`),
		),
	),
].map((name) => `assets/node_modules/tesseract.js-core/${name}`);
const allowedPaths = new Set<string>([
	...RUNTIME_REQUIRED_ASSET_PATHS,
	...tesseractCorePaths,
	...WINDOWS_SANDBOX_ASSET_PATHS,
	...Object.values(landstripEntries),
	...landstripQualifications,
	...LANDSTRIP_LEGAL_ASSET_PATHS,
	...LANDSTRIP_DEPENDENCY_ASSET_PATHS,
]);
// Roles belong to this finite inventory, never an extension, source mode or caller-provided manifest kind.
const executableAssetPaths = new Set<string>([
	WINDOWS_SANDBOX_HELPER_ENTRY,
	WINDOWS_SANDBOX_SETUP_ENTRY,
	`${WINDOWS_SANDBOX_ASSET_ROOT}/createdump.exe`,
	...Object.values(landstripEntries),
]);
/** Finite union of common, legacy Windows and reviewed Landstrip asset groups. */
export const RUNTIME_MAX_ASSET_FILES = allowedPaths.size;
const assetDirectories = new Set(
	[...allowedPaths].flatMap((path) => {
		const parts = path.split("/");
		return parts.slice(1).map((_part, index) => parts.slice(0, index + 1).join("/"));
	}),
);

export interface RuntimeAssetFile {
	path: string;
	size: number;
	sha256: string;
}

/** Existing schema-3 cache identity, byte-for-byte unchanged. This digest is not a signature or native proof. */
export function fingerprintRuntimeBundle(runtimeSha256: string, assets: unknown): string {
	if (!/^[a-f0-9]{64}$/u.test(runtimeSha256)) throw new Error("Runtime executable hash is invalid");
	return createHash("sha256")
		.update(JSON.stringify({ runtime: runtimeSha256, assets: parseRuntimeAssetInventory(assets) }))
		.digest("hex");
}

export function isRuntimeAssetPath(path: string): boolean {
	return allowedPaths.has(path);
}

export function isRuntimeExecutableAssetPath(path: string): boolean {
	return allowedPaths.has(path) && executableAssetPaths.has(path);
}

/** POSIX package modes only. This classification neither admits a path nor proves native support. */
export function runtimePackageFileMode(path: string, executable?: string): 0o700 | 0o600 {
	if (executable !== undefined && executable !== "chatobby" && executable !== "chatobby.exe") {
		throw new Error("Runtime package executable is invalid");
	}
	return (executable !== undefined && path === executable) || isRuntimeExecutableAssetPath(path) ? 0o700 : 0o600;
}

export function isRuntimeAssetDirectory(path: string): boolean {
	return assetDirectories.has(path);
}

/** No arbitrary files, aliases, traversal, duplicates, or unbounded inventories. */
function parseAssetEntries(value: unknown): RuntimeAssetFile[] {
	if (!Array.isArray(value) || value.length > RUNTIME_MAX_ASSET_FILES)
		throw new Error("Runtime asset inventory is invalid");
	let previous = "";
	let total = 0;
	const inventory = value.map((entry: unknown): RuntimeAssetFile => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry))
			throw new Error("Runtime asset entry is invalid");
		const record = entry as Record<string, unknown>;
		const { path, size, sha256 } = record;
		if (typeof path !== "string" || !isRuntimeAssetPath(path))
			throw new Error("Runtime asset path is not allowlisted");
		if (previous && previous >= path) throw new Error("Runtime asset inventory must be unique and sorted");
		if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0 || size > 64 * 1024 * 1024) {
			throw new Error("Runtime asset size is invalid");
		}
		if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sha256))
			throw new Error("Runtime asset hash is invalid");
		previous = path;
		total += size;
		return { path, size, sha256 };
	});
	if (total > 512 * 1024 * 1024) throw new Error("Runtime asset inventory exceeds its byte limit");
	return inventory;
}

export function parseWindowsSandboxAssetInventory(value: unknown): RuntimeAssetFile[] {
	const inventory = parseAssetEntries(value);
	const paths = new Set(inventory.map((entry) => entry.path));
	if (
		inventory.length !== WINDOWS_SANDBOX_ASSET_PATHS.length ||
		WINDOWS_SANDBOX_ASSET_PATHS.some((path) => !paths.has(path))
	) {
		throw new Error("Complete Windows sandbox helper asset group is missing");
	}
	return inventory;
}

/** Build preflight for one native target and its optional complete locked-source group. */
export function parseLandstripAssetInventory(value: unknown, target: string): RuntimeAssetFile[] {
	if (landstripRuntimeAssetEntry(target) === undefined) throw new Error("Unsupported Landstrip product target");
	const inventory = parseAssetEntries(value);
	if (inventory.some((file) => !file.path.startsWith(`${LANDSTRIP_ASSET_ROOT}/`)))
		throw new Error("Landstrip preflight contains another asset group");
	validateLandstripAssets(new Set(inventory.map((file) => file.path)), target);
	return inventory;
}

export function parseRuntimeAssetInventory(
	value: unknown,
	options: { requireWindowsSandboxHelper?: boolean; requireLandstripTarget?: string } = {},
): RuntimeAssetFile[] {
	const inventory = parseAssetEntries(value);
	const paths = new Set(inventory.map((entry) => entry.path));
	if (RUNTIME_REQUIRED_ASSET_PATHS.some((path) => !paths.has(path)))
		throw new Error("Required runtime asset is missing");
	validateLandstripAssets(paths, options.requireLandstripTarget);
	const helperCount = WINDOWS_SANDBOX_ASSET_PATHS.filter((path) => paths.has(path)).length;
	const historicalHostOnly =
		options.requireWindowsSandboxHelper !== true &&
		helperCount === WINDOWS_SANDBOX_HOST_ASSET_NAMES.length &&
		WINDOWS_SANDBOX_HOST_ASSET_NAMES.every((name) => paths.has(`${WINDOWS_SANDBOX_ASSET_ROOT}/${name}`));
	if (
		(helperCount > 0 || options.requireWindowsSandboxHelper === true) &&
		helperCount !== WINDOWS_SANDBOX_ASSET_PATHS.length &&
		!historicalHostOnly
	) {
		throw new Error("Complete Windows sandbox helper asset group is missing");
	}
	return inventory;
}

function validateLandstripAssets(paths: ReadonlySet<string>, requireTarget?: string): void {
	for (const target of Object.keys(landstripEntries)) {
		if (paths.has(landstripRuntimeQualificationEntry(target)!) && !paths.has(landstripRuntimeAssetEntry(target)!))
			throw new Error("Native release qualification has no matching target executable");
	}
	const landstripCount = Object.values(landstripEntries).filter((path) => paths.has(path)).length;
	const landstripLegalCount = LANDSTRIP_LEGAL_ASSET_PATHS.filter((path) => paths.has(path)).length;
	const dependencyCount = LANDSTRIP_DEPENDENCY_ASSET_PATHS.filter((path) => paths.has(path)).length;
	if (dependencyCount > 0 && dependencyCount !== LANDSTRIP_DEPENDENCY_ASSET_PATHS.length)
		throw new Error("Complete Landstrip locked-source legal group is missing");
	if (landstripCount > 0 || landstripLegalCount > 0 || dependencyCount > 0 || requireTarget !== undefined) {
		const requested = requireTarget === undefined ? undefined : landstripRuntimeAssetEntry(requireTarget);
		if (
			landstripCount !== 1 ||
			landstripLegalCount !== LANDSTRIP_LEGAL_ASSET_PATHS.length ||
			(requireTarget !== undefined && (requested === undefined || !paths.has(requested)))
		)
			throw new Error("Complete target-matched Landstrip asset group is missing");
	}
}
