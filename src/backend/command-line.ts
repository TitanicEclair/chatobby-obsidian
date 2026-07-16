export function splitCommandArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  return args;
}

export function formatCommandArgs(args: readonly string[]): string {
  return args.map(formatArg).join(" ");
}

function formatArg(arg: string): string {
  if (!arg) return "\"\"";
  return /\s/.test(arg) ? `"${arg.replaceAll("\"", "\\\"")}"` : arg;
}
