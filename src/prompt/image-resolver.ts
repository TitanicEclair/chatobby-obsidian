import type { App } from "obsidian";
import type { ResolvedImage } from "../types";
import { CONTEXT_MAX_IMAGES } from "./constants";

export async function resolveImageEmbeds(embeds: string[], app: App): Promise<ResolvedImage[]> {
  void app;
  return embeds.slice(0, CONTEXT_MAX_IMAGES).map((link) => ({ link, path: link }));
}
