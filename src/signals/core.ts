/**
 * @kurtaqui/stencil-signals — signals/core.ts
 *
 * Foundation module. All other files in this package import from here.
 *
 * Exports:
 *  signal()       — create a writable Signal.State
 *  computed()     — create a read-only Signal.Computed
 *  Signal         — raw TC39 namespace re-export (for advanced use)
 *  scheduler      — micro-task batch scheduler (same guard pattern as @lit-labs/signals)
 *  createWatcher  — thin watcher wrapper used by tests + advanced consumers
 *  collectSignals — run fn, return the set of signals it accessed (tooling/debug)
 */

import { Signal } from 'signal-polyfill';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { Signal };

// ─── Types ────────────────────────────────────────────────────────────────────

/** A writable TC39 signal (Signal.State instance). */
export type SignalState<T> = InstanceType<typeof Signal.State<T>>;

/** A read-only derived TC39 signal (Signal.Computed instance). */
export type SignalComputed<T> = InstanceType<typeof Signal.Computed<T>>;

/** Options accepted by signal() — the TC39 Signal.Options shape. */
export type SignalOptions<T> = NonNullable<ConstructorParameters<typeof Signal.State<T>>[1]>;

/** Options accepted by computed() — same shape as SignalOptions. */
export type ComputedOptions<T> = NonNullable<ConstructorParameters<typeof Signal.Computed<T>>[1]>;

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Create a writable signal holding `value`. */
export function signal<T>(value: T, options?: SignalOptions<T>): SignalState<T> {
  return new Signal.State(value, options);
}

/** Create a read-only derived signal whose value is computed by `fn`. */
export function computed<T>(fn: () => T, options?: ComputedOptions<T>): SignalComputed<T> {
  return new Signal.Computed(fn, options);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Module-level micro-task batch scheduler.
 *
 * Mirrors the `effectsPending` guard used by @lit-labs/signals: all calls to
 * `schedule(fn)` within the same synchronous frame are batched into a single
 * `queueMicrotask` flush, so a burst of signal updates produces only one
 * re-render / effect re-run.
 *
 * Drain is atomic: `pendingFns.splice(0)` copies and empties the queue before
 * the loop, so any fns pushed *during* a flush are included in the same pass
 * (they observe `effectsPending = false` because we reset it before the loop).
 */
let effectsPending = false;
const pendingFns: Array<() => void> = [];

export const scheduler = {
  schedule(fn: () => void): void {
    pendingFns.push(fn);
    if (!effectsPending) {
      effectsPending = true;
      queueMicrotask(() => {
        effectsPending = false;
        const toRun = pendingFns.splice(0);
        for (const f of toRun) f();
      });
    }
  },
};

// ─── createWatcher() ──────────────────────────────────────────────────────────

/**
 * Thin wrapper around `Signal.subtle.Watcher`.
 *
 * Returns `{ watch(sig), dispose() }`.
 *
 * The watcher re-arms pending signals automatically on each notification so
 * that `notify` is called for every subsequent change, not just the first.
 *
 * Used directly by tests and by advanced consumers who need low-level control.
 */
export function createWatcher(notify: () => void): {
  watch(sig: SignalState<unknown> | SignalComputed<unknown>): void;
  dispose(): void;
} {
  let disposed = false;

  const watcher = new Signal.subtle.Watcher(() => {
    if (disposed) return;
    notify();
    // Re-arm outside the notification phase (watcher.watch() is forbidden
    // inside notify because it calls producerAccessed which throws when
    // inNotificationPhase === true in signal-polyfill).
    queueMicrotask(() => {
      if (disposed) return;
      for (const s of Signal.subtle.introspectSources(watcher)) {
        try { watcher.watch(s as any); } catch { /* already disposed */ }
      }
    });
  });

  return {
    watch(sig) {
      watcher.watch(sig as any);
    },
    dispose() {
      disposed = true;
      for (const sig of Signal.subtle.introspectSources(watcher)) {
        try { watcher.unwatch(sig as any); } catch { /* already unwatched */ }
      }
    },
  };
}

// ─── collectSignals() ─────────────────────────────────────────────────────────

/**
 * Run `fn` inside a `Signal.Computed`, then return the set of signals it
 * accessed (its sources). The Computed is discarded after introspection.
 *
 * Useful for tooling and debugging — not on the hot render path.
 */
export function collectSignals(
  fn: () => void,
): Set<SignalState<unknown> | SignalComputed<unknown>> {
  const tracker = new Signal.Computed<null>(() => {
    fn();
    return null;
  });
  tracker.get();
  return new Set(Signal.subtle.introspectSources(tracker) as Array<SignalState<unknown> | SignalComputed<unknown>>);
}
