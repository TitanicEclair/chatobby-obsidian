import type { PermissionRequestReview } from "../../../vendor/chatobby-client/permission-review";
import type { WsExtensionUIRequest } from "../../../types";

interface PermissionRequestHost {
  handle(request: WsExtensionUIRequest): Promise<unknown>;
  dismiss(id: string): void;
  allowPermissionRequestRetry(requestId: string): void;
}

export interface ProjectedPermissionRequest {
  readonly key: string;
  readonly review: PermissionRequestReview;
  readonly decide: (approved: boolean) => Promise<void>;
}

/** Reuse the exact-operation card for durable requests, retaining binding through asynchronous display. */
export class ProjectedPermissionRequests {
  private binding = "";
  private readonly pending = new Map<string, ProjectedPermissionRequest>();

  constructor(private readonly ui: PermissionRequestHost, private readonly onError: (error: unknown) => void) {}

  update(binding: string, requests: readonly ProjectedPermissionRequest[]): void {
    if (binding !== this.binding) { this.clear(); this.binding = binding; }
    const current = new Set(requests.map((request) => request.key));
    for (const key of this.pending.keys()) if (!current.has(key)) this.remove(key);
    for (const request of requests) {
      if (this.pending.has(request.key)) continue;
      this.pending.set(request.key, request);
      this.show(request, binding);
    }
  }

  clear(): void { for (const key of [...this.pending.keys()]) this.remove(key); }

  private show(request: ProjectedPermissionRequest, binding: string): void {
    void this.ui.handle({ id: this.id(request.key), method: "confirm", params: { title: "Permission requested", permissionRequest: request.review } }).then(async (approved) => {
      if (this.binding !== binding || this.pending.get(request.key) !== request || typeof approved !== "boolean") return;
      await request.decide(approved);
    }).catch((error: unknown) => {
      this.ui.allowPermissionRequestRetry(request.review.requestId);
      if (this.binding === binding && this.pending.get(request.key) === request) {
        this.show(request, binding);
      }
      this.onError(error);
    });
  }

  private id(key: string): string { return `projected:${this.binding}:${key}`; }
  private remove(key: string): void { this.pending.delete(key); this.ui.dismiss(this.id(key)); }
}
