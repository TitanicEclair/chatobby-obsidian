type DomConstructor<T extends Node> = { new (): T; prototype: T };

/**
 * Narrow DOM values using Obsidian's cross-window helper when available, with
 * a prototype-chain fallback for standards-only DOM implementations.
 */
export function isDomNodeOfType<T extends Node>(
  value: unknown,
  constructor: DomConstructor<T>,
): value is T {
  if (value === null || typeof value !== "object") return false;
  const node = value as Node & { instanceOf?: (expected: DomConstructor<T>) => boolean };
  return typeof node.instanceOf === "function"
    ? node.instanceOf(constructor)
    : prototypeChainContains(node, constructor.prototype);
}

function prototypeChainContains(value: object, expected: object): boolean {
  let prototype = Reflect.getPrototypeOf(value);
  while (prototype) {
    if (prototype === expected) return true;
    prototype = Reflect.getPrototypeOf(prototype);
  }
  return false;
}
