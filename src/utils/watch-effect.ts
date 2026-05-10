/**
 * @kurtaqui/stencil-signals — utils/watch-effect.ts
 *
 * Two signatures, one function:
 *
 * ─── Auto-tracking (original behaviour) ──────────────────────────────────────
 *
 *   watchEffect(fn)
 *
 * Runs `fn` immediately, tracks every signal `.get()` called inside it, and
 * re-runs `fn` whenever any of those signals change.
 *
 * ```ts
 * connectedCallback() {
 *   this._cleanup = watchEffect(() => {
 *     console.log('count is now', count.get());
 *   });
 * }
 * disconnectedCallback() { this._cleanup?.(); }
 * ```
 *
 * ─── Explicit deps (new) ──────────────────────────────────────────────────────
 *
 *   watchEffect(deps, fn, options?)
 *
 * Only re-runs when the signals listed in `deps` change. The callback receives
 * their current values as typed arguments — no `.get()` required inside `fn`.
 * Signal reads *inside* `fn` that are NOT in `deps` are untracked.
 *
 * This mirrors ngxtension's `explicitEffect` and React's `useEffect` with a
 * dependency array, giving you precise control over what triggers the effect.
 *
 * ```ts
 * const a = signal(1);
 * const b = signal('hello');
 *
 * connectedCallback() {
 *   this._cleanup = watchEffect([a, b], ([aVal, bVal]) => {
 *     console.log(aVal, bVal);
 *   });
 * }
 * ```
 *
 * Options:
 *   `defer: true` — skip the initial synchronous run; only execute on first change.
 *
 * ```ts
 * watchEffect([userId], ([id]) => fetchUser(id), { defer: true });
 * ```
 *
 * In both modes `fn` may return a cleanup function that is called before each
 * re-run and on final disposal.
 */

import { Signal } from 'signal-polyfill';
import { scheduler } from '../signals/core';
import type { SignalState, SignalComputed } from '../signals/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CleanupFn = () => void;

type AnySignal<T = unknown> = SignalState<T> | SignalComputed<T>;

/** Infer the tuple of value types from a tuple of signals. */
type SignalValues<T extends readonly AnySignal[]> = {
  [K in keyof T]: T[K] extends AnySignal<infer V> ? V : never;
};

export interface WatchEffectOptions {
  /**
   * When `true`, the effect does NOT run immediately on creation.
   * It only runs the first time one of the deps signals changes.
   * Only applicable in explicit-deps mode.
   */
  defer?: boolean;
}

// ─── Overloads ────────────────────────────────────────────────────────────────

/** Auto-tracking: re-runs whenever any signal read inside `fn` changes. */
export function watchEffect(fn: () => void | CleanupFn): CleanupFn;

/** Explicit-deps: re-runs only when signals in `deps` change. */
export function watchEffect<const Deps extends readonly AnySignal[]>(
  deps: Deps,
  fn: (values: SignalValues<Deps>, onCleanup: (fn: CleanupFn) => void) => void | CleanupFn,
  options?: WatchEffectOptions,
): CleanupFn;

// ─── Implementation ───────────────────────────────────────────────────────────

export function watchEffect(
  fnOrDeps: (() => void | CleanupFn) | readonly AnySignal[],
  explicitFn?: (values: unknown[], onCleanup: (fn: CleanupFn) => void) => void | CleanupFn,
  options: WatchEffectOptions = {},
): CleanupFn {
  if (typeof fnOrDeps === 'function') {
    return autoTrackingEffect(fnOrDeps);
  }
  return explicitDepsEffect(fnOrDeps as readonly AnySignal[], explicitFn!, options);
}

// ─── Auto-tracking implementation ─────────────────────────────────────────────

function autoTrackingEffect(fn: () => void | CleanupFn): CleanupFn {
  let userCleanup: CleanupFn | undefined;
  let disposed = false;

  // Wrap fn in a Computed so every signal.get() inside fn is tracked as a dep.
  // We capture the return value (optional cleanup) via a closure variable rather
  // than the Computed's return type to keep types simple.
  let capturedCleanup: CleanupFn | undefined;
  const tracker = new Signal.Computed<null>(() => {
    const ret = fn();
    capturedCleanup = typeof ret === 'function' ? ret : undefined;
    return null;
  });

  // In the notify callback we MUST NOT call watcher.watch() — it triggers
  // producerAccessed() which throws during inNotificationPhase.
  // Just schedule the re-run; the watcher will re-arm itself in run().
  const watcher = new Signal.subtle.Watcher(() => {
    if (disposed) return;
    scheduler.schedule(run);
  });

  function run() {
    if (disposed) return;
    // Call previous cleanup before re-running
    userCleanup?.();
    userCleanup = undefined;
    // Unwatch → re-evaluate (collects fresh deps) → re-watch
    watcher.unwatch(tracker);
    capturedCleanup = undefined;
    tracker.get(); // runs fn(), tracks deps
    userCleanup = capturedCleanup;
    watcher.watch(tracker); // arm watcher on the Computed
  }

  // Initial run: evaluate once, arm watcher.
  capturedCleanup = undefined;
  tracker.get();
  userCleanup = capturedCleanup;
  watcher.watch(tracker);

  return () => {
    disposed = true;
    userCleanup?.();
    try {
      watcher.unwatch(tracker);
    } catch {
      /* ok */
    }
  };
}

// ─── Explicit-deps implementation ─────────────────────────────────────────────

function explicitDepsEffect(
  deps: readonly AnySignal[],
  fn: (values: unknown[], onCleanup: (fn: CleanupFn) => void) => void | CleanupFn,
  options: WatchEffectOptions,
): CleanupFn {
  let userCleanup: void | CleanupFn;
  let registeredCleanup: CleanupFn | undefined;
  let disposed = false;

  // onCleanup() lets users register a teardown inside the fn body itself
  // (alternative to returning a cleanup function).
  function onCleanup(cb: CleanupFn) {
    registeredCleanup = cb;
  }

  function readDeps(): unknown[] {
    // Read all dep values inside untrack so we don't accidentally subscribe
    // the watcher to signals called elsewhere.
    return Signal.subtle.untrack(() => deps.map((d) => d.get()));
  }

  function runCleanups() {
    if (typeof userCleanup === 'function') {
      userCleanup();
      userCleanup = undefined;
    }
    if (typeof registeredCleanup === 'function') {
      registeredCleanup();
      registeredCleanup = undefined;
    }
  }

  function run() {
    if (disposed) return;
    runCleanups();
    const values = readDeps();
    userCleanup = fn(values, onCleanup) as void | CleanupFn;
    // Re-arm all dep watchers
    for (const dep of deps) {
      try {
        watcher.watch(dep as any);
      } catch {}
    }
  }

  // Do NOT call watcher.watch() here — triggers producerAccessed during notify phase.
  const watcher = new Signal.subtle.Watcher(() => {
    if (disposed) return;
    scheduler.schedule(run);
  });

  // Arm watchers on each dep
  for (const dep of deps) {
    watcher.watch(dep as any);
  }

  // Initial run (unless deferred)
  if (!options.defer) {
    const values = readDeps();
    userCleanup = fn(values, onCleanup) as void | CleanupFn;
  }

  return () => {
    disposed = true;
    runCleanups();
    for (const dep of deps) {
      try {
        watcher.unwatch(dep as any);
      } catch {}
    }
  };
}
