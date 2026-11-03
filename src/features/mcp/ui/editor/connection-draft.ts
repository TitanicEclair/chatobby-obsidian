import type { FrontendMcpServerDraft } from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { safeExternalUrl } from "../links";

/** Transient form values, never persisted separately from the runtime draft. */
export interface ConnectionFields {
  readonly name: string;
  readonly transport: string;
  readonly command: string;
  readonly arguments: string;
  readonly workingDirectory: string;
  readonly url: string;
  readonly authentication: string;
  readonly credential: string;
  readonly lifecycle: string;
  readonly environment: string;
  readonly headers: string;
}

export interface ConnectionFieldError {
  readonly field: keyof ConnectionFields;
  readonly message: string;
}

export type ConnectionValidation =
  | { readonly draft: FrontendMcpServerDraft; readonly errors: readonly [] }
  | { readonly draft: null; readonly errors: readonly ConnectionFieldError[] };

/** Form validation only: saving, credentials, execution and exposure remain separate. */
export function validateConnectionDraft(fields: ConnectionFields): ConnectionValidation {
  const errors: ConnectionFieldError[] = [];
  const reject = (field: keyof ConnectionFields, message: string): void => {
    errors.push({ field, message });
  };
  const local = fields.transport === "local";
  if (!fields.name.trim()) reject("name", "Enter a connection name.");
  if (local) {
    if (!fields.command.trim()) reject("command", "Enter the program or command to run.");
  } else {
    if (!fields.url.trim()) reject("url", "Enter the server address.");
    else if (!safeExternalUrl(fields.url.trim())) reject("url", "Use a complete server address starting with http:// or https://.");
    if (fields.authentication === "bearer" && !fields.credential)
      reject("credential", "Choose a saved access token.");
  }
  const mappingField = local ? "environment" : "headers";
  let references: FrontendMcpServerDraft["environment"] = [];
  try { references = mappings(fields[mappingField]); }
  catch { reject(mappingField, "Use NAME=ENV_VARIABLE, one mapping per line."); }
  if (errors.length) return { draft: null, errors };
  return {
    errors: [],
    draft: {
      name: fields.name.trim(), scope: "user", enabled: false,
      lifecycle: isLifecycle(fields.lifecycle) ? fields.lifecycle : "lazy",
      transport: local ? "local" : "remote",
      command: fields.command.trim() || undefined,
      arguments: lines(fields.arguments),
      workingDirectory: fields.workingDirectory.trim() || undefined,
      url: fields.url.trim() || undefined,
      authentication: isAuthentication(fields.authentication) ? fields.authentication : "oauth",
      bearerCredentialReference: fields.credential || undefined,
      environment: local ? references : [],
      headers: local ? [] : references,
    },
  };
}

function lines(value: string): readonly string[] {
  return value.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
}

function mappings(value: string): FrontendMcpServerDraft["environment"] {
  return lines(value).map((entry) => {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error("Use NAME=ENV_VARIABLE for each mapping.");
    }
    return {
      name: entry.slice(0, separator).trim(),
      sourceEnvironmentVariable: entry.slice(separator + 1).trim(),
    };
  });
}

function isLifecycle(value: string): value is FrontendMcpServerDraft["lifecycle"] {
  return value === "lazy" || value === "eager" || value === "keep-alive";
}

function isAuthentication(value: string): value is NonNullable<FrontendMcpServerDraft["authentication"]> {
  return value === "oauth" || value === "bearer" || value === "none";
}
