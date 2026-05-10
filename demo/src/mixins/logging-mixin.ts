/**
 * demo/src/mixins/logging-mixin.ts
 *
 * A simple lifecycle-logging mixin written as a proper Stencil MixinFactory.
 * It is intentionally framework-agnostic — no signal awareness — to show how
 * SignalWatcher composes cleanly alongside unrelated mixins via Mixin().
 *
 * It tracks:
 *  - how many times the component has rendered
 *  - total connected / disconnected lifetime in ms
 *  - exposes getStats() for the component to display
 */

import type { MixedInCtor } from '@stencil/core';

export interface LoggingStats {
  renders: number;
  connectedAt: number | null;
  totalConnectedMs: number;
}

export function LoggingMixin<TBase extends MixedInCtor>(Base: TBase) {
  return class LoggingMixinClass extends Base {
    private __renders = 0;
    private __connectedAt: number | null = null;
    private __totalConnectedMs = 0;
    private __tag = (this.constructor as any).__proto__?.name ?? 'component';

    connectedCallback(): void {
      this.__connectedAt = performance.now();
      console.debug(`[${this.__tag}] connected`);
      super.connectedCallback?.();
    }

    disconnectedCallback(): void {
      if (this.__connectedAt !== null) {
        this.__totalConnectedMs += performance.now() - this.__connectedAt;
        this.__connectedAt = null;
      }
      console.debug(
        `[${this.__tag}] disconnected — total connected: ${this.__totalConnectedMs.toFixed(1)}ms`,
      );
      super.disconnectedCallback?.();
    }

    render(): unknown {
      this.__renders++;
      console.debug(`[${this.__tag}] render #${this.__renders}`);
      return super.render?.();
    }

    /** Call from the component to surface stats into the UI. */
    getStats(): LoggingStats {
      return {
        renders: this.__renders,
        connectedAt: this.__connectedAt,
        totalConnectedMs: this.__totalConnectedMs,
      };
    }
  };
}
