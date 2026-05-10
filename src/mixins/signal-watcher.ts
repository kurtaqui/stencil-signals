/**
 * @kurtaqui/stencil-signals — mixins/signal-watcher.ts
 *
 * `SignalWatcher` makes any StencilJS component automatically re-render
 * whenever a TC39 signal accessed during the last render cycle changes.
 *
 * It is a standard MixinFactory and works with BOTH usage patterns:
 *
 * ─── Pattern 1: Stencil v4.37+ Mixin() — compose with other mixins ───────────
 *
 * ```ts
 * import { Component, Mixin, h } from '@stencil/core';
 * import { SignalWatcher } from '@kurtaqui/stencil-signals';
 * import { LoggingMixin } from './logging-mixin';
 *
 * @Component({ tag: 'my-counter' })
 * export class MyCounter extends Mixin(SignalWatcher, LoggingMixin) {
 *   componentDidLoad() {
 *     super.componentDidLoad(); // Required when using Mixin()
 *   }
 *   render() { return <p>{count.get()}</p>; }
 * }
 * ```
 *
 * ─── Pattern 2: Direct extension — no other mixins needed ────────────────────
 *
 * ```ts
 * @Component({ tag: 'my-counter' })
 * export class MyCounter extends SignalWatcher(class {}) {
 *   render() { return <p>{count.get()}</p>; }
 * }
 * ```
 *
 * ─── Memory safety ────────────────────────────────────────────────────────────
 *
 * Follows @lit-labs/signals' pattern: the Watcher notify callback must NOT
 * close over `this` (the component). A reference cycle
 *
 *   component → watcher (strong) → component (closure capture)
 *
 * would prevent GC even after the component is removed from the DOM.
 *
 * We break the cycle using:
 *  - `componentForWatcher: WeakMap<Watcher, ComponentEntry>` — the callback
 *    only captures the Watcher (`this` in a regular `function()`) and the
 *    module-level WeakMap, never the component directly.
 *  - `watcherFinalizationRegistry` — if the component is GC'd before
 *    `disconnectedCallback` fires (e.g. detached subtrees), the registry
 *    cleans up the watcher automatically.
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
import { Signal } from 'signal-polyfill';
import { scheduler } from '../signals/core';

// ─── Memory management ────────────────────────────────────────────────────────
//
// The Watcher notify callback is a regular `function()` — `this` inside it
// refers to the Watcher instance, NOT the component. The component is looked
// up via the WeakMap so no strong reference from watcher → component exists.

type WatcherEntry = {
  /** Whether the component is currently connected to the DOM. */
  connected: boolean;
  /** The component instance (only needed to pass to forceUpdate). */
  self: object;
};

const componentForWatcher = new WeakMap<InstanceType<typeof Signal.subtle.Watcher>, WatcherEntry>();

const watcherFinalizationRegistry = new FinalizationRegistry<
  InstanceType<typeof Signal.subtle.Watcher>
>((watcher) => {
  // Component was GC'd — detach all signals so the watcher itself can be
  // released (signals hold strong refs to their watchers).
  for (const sig of Signal.subtle.introspectSources(watcher)) {
    try {
      watcher.unwatch(sig as any);
    } catch {
      /* already unwatched */
    }
  }
});

// ─── Mixin ────────────────────────────────────────────────────────────────────

/**
 * MixinFactory that adds TC39 signal reactivity to a StencilJS component.
 *
 * Compatible with Stencil's `Mixin()` helper (v4.37+) and with direct
 * `extends SignalWatcher(class {})` usage — same export, both work.
 */
// Stencil lifecycle shape expected by this mixin (all members optional so
// plain `class {}` bases still satisfy the constraint).
type StencilLike = {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  render?(): unknown;
};

/** Public surface added by SignalWatcher to any component. */
export interface SignalWatcherApi {
  updateEffect(fn: () => void): () => void;
}

export function SignalWatcher<TBase extends MixedInCtor<StencilLike>>(
  Base: TBase,
): TBase & MixedInCtor<SignalWatcherApi> {
  class SignalWatcherMixin extends Base {
    /** Signals watched during the most recent render pass. */
    private __watchedSignals = new Set<object>();
    /** Active render-tracking watcher; rebuilt each render, disposed on disconnect. */
    private __watcher: InstanceType<typeof Signal.subtle.Watcher> | null = null;
    /** Guard: suppress forceUpdate calls before the element is connected. */
    private __connected = false;

    connectedCallback(): void {
      this.__connected = true;
      super.connectedCallback?.();
    }

    disconnectedCallback(): void {
      this.__connected = false;
      // Use queueMicrotask so DOM moves (remove + re-append in the same task,
      // as `repeat()` does) don't prematurely dispose the watcher.
      queueMicrotask(() => {
        if (!this.__connected) {
          this.__disposeWatcher();
        }
      });
      super.disconnectedCallback?.();
    }

    render(): unknown {
      // Tear down the previous watcher so deps are always re-collected fresh.
      this.__disposeWatcher();
      const newlyWatched = new Set<object>();

      // Regular `function()` so `this` inside = the Watcher, not the component.
      const watcher = new Signal.subtle.Watcher(
        function (this: InstanceType<typeof Signal.subtle.Watcher>) {
          const entry = componentForWatcher.get(this);
          if (entry === undefined) return; // component was GC'd
          // Re-arm pending signals to keep receiving notifications.
          for (const s of this.getPending()) {
            this.watch(s as any);
          }
          if (entry.connected) {
            scheduler.schedule(() => forceUpdate(entry.self as any));
          }
        },
      );

      this.__watcher = watcher;
      componentForWatcher.set(watcher, {
        connected: this.__connected,
        self: this as unknown as object,
      });
      watcherFinalizationRegistry.register(this, watcher);

      // Wrap super.render() in a Computed so every signal.get() is tracked.
      let renderResult: unknown;
      const tracker = new Signal.Computed(() => {
        renderResult = super.render?.();
        return renderResult;
      });

      tracker.get();

      for (const dep of Signal.subtle.introspectSources(tracker)) {
        watcher.watch(dep as any);
        newlyWatched.add(dep);
      }

      this.__watchedSignals = newlyWatched;

      // Keep the WeakMap entry's `connected` flag in sync (it may have changed
      // between construction and first render in edge cases).
      const entry = componentForWatcher.get(watcher);
      if (entry) entry.connected = this.__connected;

      return renderResult;
    }

    /**
     * Run `fn` whenever any signal it accesses changes.
     *
     * Mirrors @lit-labs/signals' `updateEffect()` adapted for Stencil:
     * effects are scheduled through the same micro-task scheduler used for
     * re-renders, so they coalesce with any pending forceUpdate.
     *
     * ```ts
     * connectedCallback() {
     *   this._cleanup = this.updateEffect(() => {
     *     document.title = `count: ${count.get()}`;
     *   });
     * }
     * disconnectedCallback() { this._cleanup?.(); }
     * ```
     *
     * @returns A disposal function. Call it to stop the effect.
     */
    updateEffect(fn: () => void): () => void {
      let disposed = false;

      const effectSignal = new Signal.Computed<null>(() => {
        fn();
        return null;
      });

      const effectWatcher = new Signal.subtle.Watcher(
        function (this: InstanceType<typeof Signal.subtle.Watcher>) {
          if (disposed) return;
          for (const s of this.getPending()) {
            this.watch(s as any);
          }
          scheduler.schedule(() => {
            if (!disposed) {
              effectWatcher.unwatch(effectSignal);
              Signal.subtle.untrack(() => effectSignal.get());
              effectWatcher.watch(effectSignal);
              for (const dep of Signal.subtle.introspectSources(effectSignal)) {
                effectWatcher.watch(dep as any);
              }
            }
          });
        },
      );

      // Initial untracked read to arm the watcher without scheduling a render.
      Signal.subtle.untrack(() => effectSignal.get());
      effectWatcher.watch(effectSignal);
      for (const dep of Signal.subtle.introspectSources(effectSignal)) {
        effectWatcher.watch(dep as any);
      }

      return () => {
        disposed = true;
        for (const dep of Signal.subtle.introspectSources(effectSignal)) {
          try {
            effectWatcher.unwatch(dep as any);
          } catch {
            /* ok */
          }
        }
        try {
          effectWatcher.unwatch(effectSignal);
        } catch {
          /* ok */
        }
      };
    }

    private __disposeWatcher(): void {
      if (this.__watcher) {
        for (const sig of this.__watchedSignals) {
          try {
            this.__watcher.unwatch(sig as any);
          } catch {
            /* already gone */
          }
        }
        this.__watcher = null;
      }
      this.__watchedSignals = new Set();
    }
  }

  return SignalWatcherMixin as unknown as TBase & MixedInCtor<SignalWatcherApi>;
}
