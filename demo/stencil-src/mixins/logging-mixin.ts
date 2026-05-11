import type { MixedInCtor } from '@stencil/core';

export interface LoggingStats {
  renders: number;
  connectedAt: number | null;
  totalConnectedMs: number;
}

export function LoggingMixin<
  TBase extends MixedInCtor<{
    connectedCallback?(): void;
    disconnectedCallback?(): void;
    render?(): unknown;
  }>
>(Base: TBase) {
  return class LoggingMixinClass extends Base {
    // Use ES private fields (#) to avoid TS declaration-emit issues with anonymous mixin classes
    #renders = 0;
    #connectedAt: number | null = null;
    #totalConnectedMs = 0;

    connectedCallback(): void {
      this.#connectedAt = performance.now();
      super.connectedCallback?.();
    }

    disconnectedCallback(): void {
      if (this.#connectedAt !== null) {
        this.#totalConnectedMs += performance.now() - this.#connectedAt;
        this.#connectedAt = null;
      }
      super.disconnectedCallback?.();
    }

    render(): unknown {
      this.#renders++;
      return super.render?.();
    }

    getStats(): LoggingStats {
      return {
        renders: this.#renders,
        connectedAt: this.#connectedAt,
        totalConnectedMs:
          this.#totalConnectedMs +
          (this.#connectedAt !== null ? performance.now() - this.#connectedAt : 0),
      };
    }
  };
}
