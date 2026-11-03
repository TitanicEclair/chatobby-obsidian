import { vi } from 'vitest';
import type { App } from 'obsidian';
import type ChatobbyPlugin from '../../../src/main';
import type { ChatobbyTransport } from '../../../src/transport/ws-client';
import { SessionController, type SessionMutationRequest } from '../../../src/ui/controller/session-controller';
import type { FrontendSessionViewModel } from '../../../src/vendor/chatobby-client/frontend-contracts.js';
import { OperationCoordinator } from '../../../src/features/operations/public';
import type { SessionRestorationConnection } from '../../../src/ui/session/session-recovery';

interface HarnessOptions {
  dispatch?: (request: SessionMutationRequest, controller: SessionController, restoration?: SessionRestorationConnection) => Promise<boolean>;
  synchronize?: (controller: SessionController) => Promise<void>;
  renderActiveTab?: ReturnType<typeof vi.fn>;
  refreshTabBar?: () => void;
  persistLeafState?: ReturnType<typeof vi.fn>;
  settlePresentation?: () => Promise<void>;
}

export function createSessionControllerHarness(options: HarnessOptions = {}) {
  const operations = new OperationCoordinator();
  const renderActiveTab = options.renderActiveTab ?? vi.fn();
  const persistLeafState = options.persistLeafState ?? vi.fn();
  const claimSessionOwnership = vi.fn();
  const transport = {
    isConnected: true,
    getRuntimeInfo: vi.fn(async () => ({ cwd: "C:\\Different", agentDir: "C:\\Different\\.chatobby" })),
  } as unknown as ChatobbyTransport;
  const plugin = {
    transport,
    settings: { autoNameStrategy: "truncate" },
    getActiveVaultDirectory: vi.fn(() => ""),
    getSessionPreferences: vi.fn(() => ({ model: null, thinkingLevel: "medium", permissionMode: "default" })),
  } as unknown as ChatobbyPlugin;
  let controller!: SessionController;
  controller = new SessionController({
    app: {
      vault: {
        adapter: { getBasePath: () => "C:\\Vault" },
        getName: () => "Vault",
        getAbstractFileByPath: () => null,
      },
    } as unknown as App,
    plugin,
    getTransport: () => transport,
    refreshTabBar: options.refreshTabBar ?? vi.fn(),
    renderActiveTab,
    persistLeafState,
    exitSessionBrowser: vi.fn(),
    runOperation: (descriptor, operation) => operations.run(descriptor, operation),
    getActiveOperation: () => operations.current("session-transition"),
    claimSessionOwnership,
    dispatchSessionIntent: (request, restoration) => options.dispatch?.(request, controller, restoration) ?? Promise.resolve(false),
    synchronizeFrontend: () => options.synchronize?.(controller) ?? Promise.resolve(),
    settlePresentation: options.settlePresentation ?? (() => Promise.resolve()),
  });
  return { controller, operations, renderActiveTab, persistLeafState, claimSessionOwnership };
}

export async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

export function sessionViewModel(id: string, overrides: Partial<FrontendSessionViewModel> = {}): FrontendSessionViewModel {
  return {
    id,
    workingDirectory: "C:\\Vault",
		workspace: { kind: "vault", label: "Vault" },
    model: "model-1",
    thinkingLevel: "medium",
    streaming: false,
    compacting: false,
    retrying: false,
    messageCount: 0,
    forkOptions: [],
    ...overrides,
  };
}
