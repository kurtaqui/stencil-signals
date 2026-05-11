/**
 * @kurtaqui/stencil-signals/tc39 — TC39 entry point
 *
 * Import from "@kurtaqui/stencil-signals/tc39" to explicitly use the TC39
 * signals polyfill (signal-polyfill) as the backend. All primitives share the
 * same `.get()` / `.set()` / `.peek()` API regardless of backend.
 *
 * For automatic backend detection, import from "@kurtaqui/stencil-signals".
 *
 * Public API surface:
 *
 *  Primitives
 *  ──────────
 *  signal(value)              Create a writable SignalState
 *  computed(fn)               Create a read-only SignalComputed
 *  batch(fn)                  No-op on TC39 (microtask scheduler coalesces)
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

// ─── Activate TC39 adapter ────────────────────────────────────────────────────
// Must be the very first side-effect so all utilities see the adapter.
import { _setAdapter } from './adapters/active';
import { tc39Adapter } from './adapters/tc39';
_setAdapter(tc39Adapter);

// ─── TC39-specific raw namespace ─────────────────────────────────────────────
export { Signal } from 'signal-polyfill';

// ─── Primitives ───────────────────────────────────────────────────────────────
export {
  signal,
  computed,
  batch,
  scheduler,
  createWatcher,
  collectSignals,
} from './signals/core';

export type {
  SignalState,
  SignalComputed,
  SignalOptions,
  ComputedOptions,
  AdapterWatcher,
} from './adapters/types';

// ─── Component integration ────────────────────────────────────────────────────
export { SignalWatcher } from './mixins/signal-watcher-tc39';
export type { SignalWatcherApi } from './mixins/signal-watcher-tc39';

// ─── Decorators ───────────────────────────────────────────────────────────────
export { useSignal } from './directives/use-signal';

// ─── Side effects ─────────────────────────────────────────────────────────────
export { watchEffect } from './utils/watch-effect';
export type { CleanupFn, WatchEffectOptions } from './utils/watch-effect';

// ─── Derived signals ──────────────────────────────────────────────────────────
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

// ─── Store helpers ────────────────────────────────────────────────────────────
export { createStore } from './utils/create-store';
export type { Store } from './utils/create-store';
