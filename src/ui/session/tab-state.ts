import type { SessionTab } from "../../features/session/public";

export class TabMap {
  private readonly map = new Map<string, SessionTab>();
  private activeId: string | null = null;

  add(tab: SessionTab): void {
    this.set(tab);
    this.activeId ??= tab.sessionId;
  }

	/** Replace this leaf's sole session. Obsidian leaves own session multiplicity. */
	reset(tab: SessionTab): void {
		this.map.clear();
		this.map.set(tab.sessionId, tab);
		this.activeId = tab.sessionId;
	}

  set(tab: SessionTab): void {
    this.map.set(tab.sessionId, tab);
  }

  replace(id: string, tab: SessionTab): void {
    this.map.delete(id);
    this.map.set(tab.sessionId, tab);
    if (this.activeId === id) this.activeId = tab.sessionId;
  }

  remove(id: string): void {
    const nextActive = this.activeId === id ? this.nextAfterClose(id)?.sessionId ?? null : this.activeId;
    this.map.delete(id);
    this.activeId = nextActive;
  }

  get(id: string): SessionTab | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  active(): SessionTab | null {
    return this.activeId ? this.map.get(this.activeId) ?? null : null;
  }

  activeTabId(): string | null {
    return this.activeId;
  }

  setActive(id: string): void {
    if (this.map.has(id)) this.activeId = id;
  }

  all(): SessionTab[] {
    return Array.from(this.map.values());
  }

  nextAfterClose(id: string): SessionTab | null {
    const tabs = this.all();
    if (tabs.length === 0) return null;
    const index = tabs.findIndex((tab) => tab.sessionId === id);
    if (index === -1) return tabs[0] ?? null;
    return tabs[index + 1] ?? tabs[index - 1] ?? null;
  }
}
