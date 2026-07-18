/**
 * Normalize a user-facing vault folder reference to an Obsidian-relative path.
 * Root aliases become the empty path expected by Obsidian's Vault API.
 */
export function normalizeVaultFolderPath(input: string): string {
  if (input.includes("\0")) throw new TypeError("Vault folder paths cannot contain null bytes.");
  const path = input.replace(/\\/gu, "/");
  if (path === "" || path === "/" || path === "." || path === "./") return "";
  const pathWithoutRootMarkers = path.replace(/^(?:\/+|\.\/)+/u, "");
  if (/^[A-Za-z]:/u.test(pathWithoutRootMarkers) || path.startsWith("//")) {
    throw new TypeError("Vault folder paths must be vault-relative, not operating-system absolute paths.");
  }
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") throw new TypeError("Vault folder paths cannot contain '..' traversal segments.");
    segments.push(segment);
  }
  return segments.join("/");
}
