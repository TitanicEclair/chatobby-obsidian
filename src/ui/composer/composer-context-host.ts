import type { ComposerKeybindings } from "../../types";
import type { FrontendFeedBlock } from "../../vendor/chatobby-client/frontend-contracts.js";
import { turnOutputMarker } from "./turn-output-marker";

export function createComposerContextHost(
  getBindings: () => ComposerKeybindings,
  getBlocks: () => readonly FrontendFeedBlock[],
): {
  getComposerKeybindings: () => ComposerKeybindings;
  getPromptHistory: () => string[];
  getTurnOutputMarker: () => string;
} {
  return {
    getComposerKeybindings: getBindings,
    getPromptHistory: () => getBlocks().flatMap((block) => block.type === "user" ? [block.text] : []),
    getTurnOutputMarker: () => turnOutputMarker(getBlocks()),
  };
}
