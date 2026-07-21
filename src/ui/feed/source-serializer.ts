import type { FeedBlock } from "../../types";

export function blocksToSource(blocks: readonly FeedBlock[]): string {
  return blocks.map(blockToSource).filter(Boolean).join("\n\n");
}

function blockToSource(block: FeedBlock): string {
  switch (block.type) {
    case "user": return section("User", messageText(block.message.content));
    case "system": return section("System", messageText(block.message.content));
    case "text": return block.text;
    case "thinking": return section("Thinking", block.text);
    case "tools": return section("Tools", block.items.map(toolToSource).join("\n\n"));
    case "summary": return section("Summary", [block.text, blocksToSource(block.blocks)].filter(Boolean).join("\n\n"));
    case "queued": return section(block.kind === "steer" ? "Queued steer" : "Queued follow-up", block.text);
    case "divider": return [block.activityLabel, block.detail, block.label].filter(Boolean).join("\n");
    case "subagent": return section("Subagent", [
      block.activity.type,
      block.activity.description,
      block.activity.resultPreview,
      block.activity.errorMessage,
      block.activity.outputFile,
    ].filter(Boolean).join("\n"));
    case "subagent-communication": return section("Subagent communication", block.message.text);
    case "extension-panel": return section(block.title, [block.source, block.body].filter(Boolean).join("\n\n"));
  }
}

function section(title: string, body: string): string {
  return [`## ${title}`, body.trim()].filter(Boolean).join("\n\n");
}

function messageText(content: string | { type: string; text?: string; mimeType?: string }[]): string {
  if (typeof content === "string") return content;
  return content.map((item) => {
    if (item.type === "text") return item.text ?? "";
    if (item.type === "image") return `[image${item.mimeType ? `: ${item.mimeType}` : ""}]`;
    return "";
  }).filter(Boolean).join("\n\n");
}

function toolToSource(item: { name: string; status: string; arguments: string; result?: unknown; isError?: boolean }): string {
  const lines = [`- ${item.name} (${item.status}${item.isError ? ", error" : ""})`];
  if (item.arguments) lines.push(indentCode("arguments", item.arguments));
  if (item.result !== undefined) lines.push(indentCode("result", stringifyUnknown(item.result)));
  return lines.join("\n");
}

function indentCode(label: string, value: string): string {
  return `  ${label}:\n\n${value.split("\n").map((line) => `    ${line}`).join("\n")}`;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
