declare const __CHATOBBY_BUILD_MODE__: "development" | "release";

export interface ChatobbyPerformanceSnapshot {
  readonly startedAt: number;
  readonly patchCount: number;
  readonly patchRatePerSecond: number;
  readonly storeNotificationCount: number;
  readonly storeNotificationTotalMs: number;
  readonly storeNotificationMaxMs: number;
  readonly pageRenderCounts: Readonly<Record<string, number>>;
  readonly markdownRenderCount: number;
  readonly markdownRenderTotalMs: number;
  readonly markdownRenderMaxMs: number;
  readonly retainedDomNodes: number;
  readonly maximumRetainedDomNodes: number;
  readonly longTaskCount: number;
  readonly longestTaskMs: number;
}

const enabled = typeof __CHATOBBY_BUILD_MODE__ === "undefined" || __CHATOBBY_BUILD_MODE__ === "development";
const startedAt = performance.now();
const state = {
  patchCount: 0,
  storeNotificationCount: 0,
  storeNotificationTotalMs: 0,
  storeNotificationMaxMs: 0,
  pageRenderCounts: new Map<string, number>(),
  markdownRenderCount: 0,
  markdownRenderTotalMs: 0,
  markdownRenderMaxMs: 0,
  retainedDomNodes: 0,
  maximumRetainedDomNodes: 0,
  longTaskCount: 0,
  longestTaskMs: 0,
};

interface ChatobbyPerformanceGlobal {
  __chatobbyPerformance?: () => ChatobbyPerformanceSnapshot;
}

export const chatobbyPerformance = {
  recordPatch(): void {
    if (enabled) state.patchCount += 1;
  },
  recordStoreNotification(durationMs: number): void {
    if (!enabled) return;
    state.storeNotificationCount += 1;
    state.storeNotificationTotalMs += durationMs;
    state.storeNotificationMaxMs = Math.max(state.storeNotificationMaxMs, durationMs);
  },
  recordPageRender(screenId: string): void {
    if (!enabled) return;
    state.pageRenderCounts.set(screenId, (state.pageRenderCounts.get(screenId) ?? 0) + 1);
  },
  recordMarkdownRender(durationMs: number): void {
    if (!enabled) return;
    state.markdownRenderCount += 1;
    state.markdownRenderTotalMs += durationMs;
    state.markdownRenderMaxMs = Math.max(state.markdownRenderMaxMs, durationMs);
  },
  recordRetainedDomNodes(count: number): void {
    if (!enabled) return;
    state.retainedDomNodes = count;
    state.maximumRetainedDomNodes = Math.max(state.maximumRetainedDomNodes, count);
  },
};

export function getChatobbyPerformanceSnapshot(): ChatobbyPerformanceSnapshot {
  const elapsedSeconds = Math.max((performance.now() - startedAt) / 1_000, 0.001);
  return {
    startedAt,
    patchCount: state.patchCount,
    patchRatePerSecond: state.patchCount / elapsedSeconds,
    storeNotificationCount: state.storeNotificationCount,
    storeNotificationTotalMs: state.storeNotificationTotalMs,
    storeNotificationMaxMs: state.storeNotificationMaxMs,
    pageRenderCounts: Object.fromEntries(state.pageRenderCounts),
    markdownRenderCount: state.markdownRenderCount,
    markdownRenderTotalMs: state.markdownRenderTotalMs,
    markdownRenderMaxMs: state.markdownRenderMaxMs,
    retainedDomNodes: state.retainedDomNodes,
    maximumRetainedDomNodes: state.maximumRetainedDomNodes,
    longTaskCount: state.longTaskCount,
    longestTaskMs: state.longestTaskMs,
  };
}

if (enabled) {
  (globalThis as typeof globalThis & ChatobbyPerformanceGlobal).__chatobbyPerformance = getChatobbyPerformanceSnapshot;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTaskCount += 1;
        state.longestTaskMs = Math.max(state.longestTaskMs, entry.duration);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // Long-task entries are optional in Obsidian's Electron version.
  }
}
