/**
 * @kurtaqui/stencil-signals
 *
 * TC39 Signals Proposal integration for StencilJS.
 *
 * Public API surface:
 *
 *  Primitives
 *  ──────────
 *  signal(value)              Create a writable Signal.State
 *  computed(fn)               Create a read-only Signal.Computed
 *  Signal                     The raw TC39 Signal namespace (for advanced use)
 *
 *  Component integration
 *  ─────────────────────
 *  SignalWatcher(Base)         Class mixin — auto-rerenders on signal change
 *  @useSignal(sig)             Property decorator — binds signal ↔ class property
 *
 *  Side effects
 *  ────────────
 *  watchEffect(fn)             Auto-tracking effect; re-runs on any accessed signal change
 *  watchEffect(deps, fn, opts) Explicit-deps effect; re-runs only when listed signals change
 *
 *  Derived / async signals
 *  ───────────────────────
 *  computedPrevious(sig)       Signal holding the previous value of another signal
 *  computedAsync(fn, opts)     Async derived signal with status tracking + AbortSignal
 *
 *  Store helpers
 *  ─────────────
 *  createStore(init)           Wraps a plain object in signals; returns a reactive Proxy
 */

// Primitives
export {
  Signal,
  signal,
  computed,
  scheduler,
  createWatcher,
  collectSignals,
} from './signals/core';

export type { SignalState, SignalComputed, SignalOptions, ComputedOptions } from './signals/core';

// Mixin
export { SignalWatcher } from './mixins/signal-watcher';

// Decorators
export { useSignal } from './directives/use-signal';

// Effects
export { watchEffect } from './utils/watch-effect';
export type { CleanupFn, WatchEffectOptions } from './utils/watch-effect';

// Derived signals
export { computedPrevious } from './utils/computed-previous';
export { computedAsync, isPending, isResolved, isError } from './utils/computed-async';
export type {
  AsyncResult,
  AsyncPending,
  AsyncResolved,
  AsyncError,
  AsyncStatus,
  ComputedAsyncOptions,
} from './utils/computed-async';

// Store
export { createStore } from './utils/create-store';
