// Retrieval operations — Graphify artifact + Smart Connections semantic
// retrieval, with Obsidian lexical/link fallback.

import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { getVaultRetrievalService, type RetrievalPrimitiveProvider } from "../retrieval/service";

export const handleRetrievalExplore: OperationHandler = async (args, signal, app) => {
  const query = stringArg(args, "query");
  const subjectPath = optionalStringArg(args, "subjectPath") ?? optionalStringArg(args, "path");
  const limit = numberArg(args, "limit", 50);
  const folder = optionalStringArg(args, "folder");
  const provider = providerArg(args);
  const service = getVaultRetrievalService(app);

  if (subjectPath) return service.explain(subjectPath, provider, limit);
  if (!query) throw new BridgeError("INVALID_INPUT", "retrieval.explore requires 'query'");
  return service.explore(query, provider, limit, folder, signal);
};

export const handleRetrievalTrace: OperationHandler = async (args, _signal, app) => {
  const fromRef = optionalStringArg(args, "fromRef") ?? optionalStringArg(args, "fromPath");
  const toRef = optionalStringArg(args, "toRef") ?? optionalStringArg(args, "toPath");
  if (!fromRef || !toRef) throw new BridgeError("INVALID_INPUT", "retrieval.trace requires 'fromRef' and 'toRef'");
  return getVaultRetrievalService(app).trace(fromRef, toRef, graphProviderArg(args));
};

export const handleRetrievalRelated: OperationHandler = async (args, _signal, app) => {
  const subjectPath = optionalStringArg(args, "subjectPath") ?? optionalStringArg(args, "path");
  if (!subjectPath) throw new BridgeError("INVALID_INPUT", "retrieval.related requires 'subjectPath'");
  return getVaultRetrievalService(app).related(subjectPath, providerArg(args), numberArg(args, "limit", 50));
};

export const handleRetrievalHubs: OperationHandler = async (args, _signal, app) => {
  return getVaultRetrievalService(app).hubs(
    graphProviderArg(args),
    numberArg(args, "limit", 50),
    optionalStringArg(args, "folder"),
    optionalStringArg(args, "communityId"),
  );
};

export const handleRetrievalCommunities: OperationHandler = async (args, _signal, app) => {
  return getVaultRetrievalService(app).communities(
    graphProviderArg(args),
    numberArg(args, "limit", 50),
    args.labeled === true,
  );
};

export const handleRetrievalExplain: OperationHandler = async (args, _signal, app) => {
  const subjectPath = optionalStringArg(args, "subjectPath") ?? optionalStringArg(args, "path");
  if (!subjectPath) throw new BridgeError("INVALID_INPUT", "retrieval.explain requires 'subjectPath'");
  return getVaultRetrievalService(app).explain(subjectPath, providerArg(args), numberArg(args, "limit", 50));
};

function providerArg(args: Record<string, unknown>): RetrievalPrimitiveProvider {
  const provider = optionalStringArg(args, "provider");
  if (provider === "graphify" || provider === "smart-connections" || provider === "lexical" || provider === "obsidian-links") {
    return provider;
  }
  throw new BridgeError("INVALID_INPUT", "retrieval operation requires a supported primitive 'provider'");
}

function graphProviderArg(args: Record<string, unknown>): "graphify" | "obsidian-links" {
  const provider = providerArg(args);
  if (provider === "graphify" || provider === "obsidian-links") return provider;
  throw new BridgeError("INVALID_INPUT", "graph retrieval requires provider 'graphify' or 'obsidian-links'");
}

function optionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  return optionalStringArg(args, key);
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(500, Math.trunc(value)));
}
