// Mock bridge WebSocket server for integration tests.
// Provides a minimal WS server that responds to Hello and Invoke frames.

import type { Server } from "http";

/** Minimal mock bridge WS for integration testing. */
export class MockBridgeWs {
  private wss: unknown = null;
  private messages: unknown[] = [];
  private outboundFrames: unknown[] = []; // Frames plugin sends back to server
  private closeCode: number | null = null;
  private port: number | null = null;
  private pendingInvokes: Map<string, { resolve: (result: unknown) => void; reject: (error: unknown) => void; deadline: string }> = new Map();
  private connectedClients: Set<{ send: (data: string) => void; readyState: number; close: (code?: number, reason?: string) => void }> = new Set();

  /** Start the mock server on a random port. Returns the ws:// URL. */
  async start(): Promise<string> {
    // Dynamic import to avoid issues in non-Node environments
    const { WebSocketServer } = await import("ws");
    const wss = new WebSocketServer({ port: 0 });
    this.wss = wss;

    this.port = (wss.address() as { port: number }).port;

    wss.on("connection", (ws: unknown) => {
      const typedWs = ws as { on: (event: string, handler: (data: unknown) => void) => void; send: (data: string) => void; close: (code?: number, reason?: string) => void; readyState: number };

      // Track connected client so we can send frames to it
      this.connectedClients.add(typedWs);
      typedWs.on("close", () => this.connectedClients.delete(typedWs));

      typedWs.on("message", (data: unknown) => {
        const buffer = data as Buffer;
        const msg = JSON.parse(buffer.toString());
        this.messages.push(msg);

        // Track outbound frames (result/error/ping from plugin back to server)
        if (msg.type === "result" || msg.type === "error" || msg.type === "ping") {
          this.outboundFrames.push(msg);
        }

        // Reply to pings with pong
        if (msg.type === "ping") {
          typedWs.send(JSON.stringify({
            type: "pong",
            requestId: (msg as { requestId: string }).requestId,
            sentAt: new Date().toISOString(),
          }));
        }

        // Track invoke frames for testing
        if (msg.type === "invoke") {
          this.pendingInvokes.set((msg as { requestId: string }).requestId, {
            resolve: (result: unknown) => {
              typedWs.send(JSON.stringify({
                type: "result",
                requestId: (msg as { requestId: string }).requestId,
                result,
              }));
            },
            reject: () => {
              typedWs.send(JSON.stringify({
                type: "error",
                requestId: (msg as { requestId: string }).requestId,
                error: {
                  code: "UNKNOWN",
                  message: "Mock error",
                  retryable: false,
                },
              }));
            },
            deadline: (msg as { deadline: string }).deadline,
          });
        }

        // Handle cancel frames
        if (msg.type === "cancel") {
          const pending = this.pendingInvokes.get((msg as { requestId: string }).requestId);
          if (pending) {
            this.pendingInvokes.delete((msg as { requestId: string }).requestId);
            // In the new protocol, cancel emits nothing - the in-flight invoke will emit DEADLINE_EXCEEDED
          }
        }

        // Reply to hello with nothing (no hello_ack in protocol)
        // Reply to result/error with nothing
      });

      // If closeCode is set, close the connection after a brief delay
      if (this.closeCode !== null) {
        setTimeout(() => {
          // Close with the specified code and reason
          typedWs.close(this.closeCode, "Test close");
        }, 50);
      }
    });

    return `ws://127.0.0.1:${this.port}`;
  }

  /** Stop the mock server. */
  async stop(): Promise<void> {
    if (this.wss) {
      const typedWss = this.wss as { close: (callback: () => void) => void };
      for (const client of this.connectedClients) client.close();
      this.connectedClients.clear();
      await new Promise<void>((resolve) => typedWss.close(() => resolve()));
      this.wss = null;
      this.port = null;
      this.pendingInvokes.clear();
    }
  }

  /** Get all messages received by the server. */
  getReceivedMessages(): unknown[] {
    return [...this.messages];
  }

  /** Get all outbound frames sent by the plugin back to the server. */
  getOutboundFrames(): unknown[] {
    return [...this.outboundFrames];
  }

  /** Resolve a pending invoke with a result. */
  resolveInvoke(requestId: string, result: unknown): void {
    const pending = this.pendingInvokes.get(requestId);
    if (pending) {
      this.pendingInvokes.delete(requestId);
      pending.resolve(result);
    }
  }

  /** Reject a pending invoke with an error. */
  rejectInvoke(requestId: string): void {
    const pending = this.pendingInvokes.get(requestId);
    if (pending) {
      this.pendingInvokes.delete(requestId);
      pending.reject();
    }
  }

  /** Set a close code to send on next connection. */
  setCloseCode(code: number | null): void {
    this.closeCode = code;
  }

  /** Clear received messages. */
  clearMessages(): void {
    this.messages = [];
    this.outboundFrames = [];
  }

  /** Send a frame to all connected clients (simulates server→plugin communication). */
  sendToClients(frame: { type: string; requestId: string; operation?: string; arguments?: Record<string, unknown>; deadline?: string; reason?: string }): void {
    for (const client of this.connectedClients) {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(frame));
      }
    }
  }
}
