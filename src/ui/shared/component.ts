// ChatobbyComponent — base class for all UI components
// Every component gets a render/clear/destroy lifecycle.
// Components do NOT own state — they receive it via host interfaces.
//
// Target: all UI elements extend ChatobbyComponent with render() and destroy().
// Components are stateless renderers — data and callbacks come through host interfaces.

/**
 * Abstract base for all chatobby UI components.
 *
 * Lifecycle:
 *   render(parent) → creates container div, calls onRender()
 *   clear()        → empties container contents
 *   destroy()      → removes container from DOM, nulls reference
 *
 * Components are stateless renderers. They receive data and callbacks
 * through their constructor (host interfaces), not by owning state.
 */
export abstract class ChatobbyComponent {
  protected container: HTMLElement | null = null;

  /** Mount this component inside `parent`. Creates a container div. */
  render(parent: HTMLElement): void {
    this.container = parent.createDiv({ cls: this.componentClass() });
    this.onRender(this.container);
  }

  /** Subclasses implement this to build their DOM. */
  protected abstract onRender(container: HTMLElement): void;

  /** CSS class applied to the container div. Override for BEM naming. */
  protected abstract componentClass(): string;

  /** Empty the container's contents without removing the container itself. */
  clear(): void {
    this.container?.empty();
  }

  /** Remove the container from the DOM entirely. Called on view close. */
  destroy(): void {
    this.container?.remove();
    this.container = null;
  }

  /** Whether this component is currently mounted. */
  get isMounted(): boolean {
    return this.container !== null;
  }
}
