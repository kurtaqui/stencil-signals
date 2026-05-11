/**
 * @kurtaqui/stencil-signals — mixins/signal-watcher.ts
 *
 * Unified `SignalWatcher` facade — works with whichever backend was activated
 * by the entry point (TC39 or Preact). Delegates entirely to the adapter layer
 * via `getAdapter().createEffect()` so no backend-specific imports are needed.
 *
 * Exported by the default entry point ("@kurtaqui/stencil-signals").
 * The backend-specific entry points (/tc39 and /preact) export their own
 * implementations instead — see signal-watcher-tc39.ts / signal-watcher-preact.ts.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 * Each call to `render()` disposes any previous tracking effect, then creates a
 * fresh effect via `getAdapter().createEffect()` that:
 *  - On its first (synchronous) run: calls `super.render()` to collect all
 *    signal reads as subscriptions.
 *  - On subsequent runs (a dep changed): schedules a `forceUpdate()` via the
 *    shared microtask scheduler.
 *
 * ─── updateEffect() ───────────────────────────────────────────────────────────
 *
 * ```ts
 * connectedCallback() {
 *   this._cleanup = this.updateEffect(() => {
 *     document.title = `count: ${count.get()}`;
 *   });
 * }
 * disconnectedCallback() { this._cleanup?.(); }
 * ```
 */

import { forceUpdate } from '@stencil/core';
import type { MixedInCtor } from '@stencil/core';
import { getAdapter } from '../adapters/active';
import { scheduler } from '../signals/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type StencilLike = {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  render?(): unknown;
};

/** Public surface added by SignalWatcher to any component. */
export interface SignalWatcherApi {
  updateEffect(fn: () => void): () => void;
}

// ─── Mixin ────────────────────────────────────────────────────────────────────

export function SignalWatcher<TBase extends MixedInCtor<StencilLike>>(
  Base: TBase,
): TBase & MixedInCtor<SignalWatcherApi> {
  class SignalWatcherMixin extends Base {
    /** Cleanup for the current render-tracking effect. */
    private __disposeEffect: (() => void) | null = null;
    /** Guard: suppress forceUpdate calls before the element is connected. */
    private __connected = false;

    connectedCallback(): void {
      this.__connected = true;
      super.connectedCallback?.();
    }

    disconnectedCallback(): void {
      this.__connected = false;
      // queueMicrotask so DOM moves (remove + re-append in the same task)
      // don't prematurely dispose the tracking effect.
      queueMicrotask(() => {
        if (!this.__connected) {
          this.__disposeEffect?.();
          this.__disposeEffect = null;
        }
      });
      super.disconnectedCallback?.();
    }

    render(): unknown {
      // Tear down the previous tracking effect so deps are re-collected fresh.
      this.__disposeEffect?.();
      this.__disposeEffect = null;

      let renderResult: unknown;
      let firstRun = true;

      // Arrow function captures `this` from the enclosing render() scope.
      // createEffect fires synchronously on creation (first run) then again
      // whenever any signal accessed during the first run changes.
      this.__disposeEffect = getAdapter().createEffect(() => {
        if (firstRun) {
          firstRun = false;
          renderResult = super.render?.();
        } else if (this.__connected) {
          scheduler.schedule(() => forceUpdate(this as any));
        }
      });

      return renderResult;
    }

    /**
     * Run `fn` immediately and re-run it whenever any signal it reads changes.
     * Mirrors @lit-labs/signals' `updateEffect()` adapted for Stencil.
     *
     * @returns A disposal function. Call it to stop the effect.
     */
    updateEffect(fn: () => void): () => void {
      return getAdapter().createEffect(fn);
    }
  }

  return SignalWatcherMixin as unknown as TBase & MixedInCtor<SignalWatcherApi>;
}
