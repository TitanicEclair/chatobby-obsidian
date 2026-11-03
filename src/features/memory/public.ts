/** Binds runtime Memory projections and intents to an owned native screen. */
export { MemoryScreenController } from "./application/memory-screen-controller";
/** Live store/protocol and host lifecycle ports for the Memory screen. */
export type { MemoryScreenControllerOptions } from "./application/memory-screen-controller";
/** Native Memory page presentation and legacy extension action validation. */
export { MemoryView, isMemoryActionId } from "./ui/memory-view";
/** Local presentation actions; runtime models remain the authority. */
export type { MemoryViewIntent, MemoryViewProps, MemoryActionId, MemoryTab } from "./ui/memory-view";
