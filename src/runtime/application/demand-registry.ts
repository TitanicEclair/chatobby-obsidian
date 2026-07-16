import type {
  RuntimeDemandHandle,
  RuntimeDemandKind,
  RuntimeDemandRegistry,
  RuntimeDemandSnapshot,
} from "../public";

/** Track semantic runtime demand without coupling lifecycle ownership to DOM objects. */
export class DefaultRuntimeDemandRegistry implements RuntimeDemandRegistry {
  private readonly demands = new Map<string, RuntimeDemandSnapshot>();

  acquire(kind: RuntimeDemandKind, ownerId: string): RuntimeDemandHandle {
    const id = `${kind}:${ownerId}`;
    if (!this.demands.has(id)) {
      this.demands.set(id, { id, kind, ownerId, acquiredAt: Date.now() });
    }
    let released = false;
    return {
      id,
      kind,
      release: () => {
        if (released) return;
        released = true;
        this.demands.delete(id);
      },
    };
  }

  hasDemand(kind?: RuntimeDemandKind): boolean {
    if (kind === undefined) return this.demands.size > 0;
    return [...this.demands.values()].some((demand) => demand.kind === kind);
  }

  snapshot(): readonly RuntimeDemandSnapshot[] {
    return [...this.demands.values()];
  }
}
