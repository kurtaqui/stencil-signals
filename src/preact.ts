/**
 * @kurtaqui/stencil-signals/preact — Preact entry point
 *
 * Import from "@kurtaqui/stencil-signals/preact" to use @preact/signals-core
 * as the backend. All primitives share the same `.get()` / `.set()` / `.peek()`
 * API as the TC39 entry point — only the import path changes.
 *
 * Public API surface:
 *
 *  Primitives
 *  ──────────
 *  signal(value)              Create a writable SignalState
 *  computed(fn)               Create a read-only SignalComputed
 *  batch(fn)                  Batch multiple signal writes (native Preact feature)
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

// ─── Activate Preact adapter ─────────────────────────────────────────────────
// Must be the very first side-effect so all utilities see the adapter.
import { _setAdapter } from './adapters/active';
import { preactAdapter } from './adapters/preact';
_setAdapter(preactAdapter);

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
export { SignalWatcher } from './mixins/signal-watcher-preact';
export type { SignalWatcherApi } from './mixins/signal-watcher-preact';

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
