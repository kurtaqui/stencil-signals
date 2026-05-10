/**
 * @kurtaqui/stencil-signals — utils/computed-async.ts
 *
 * `computedAsync(fn, options?)` is a derived signal whose value comes from an
 * async operation (Promise or async function). It re-runs whenever any signal
 * accessed inside `fn` changes, automatically cancelling the in-flight
 * operation via AbortSignal.
 *
 * The returned signal holds an `AsyncResult<T>` discriminated union:
 *
 *   { status: 'pending', value: T | undefined }
 *   { status: 'resolved', value: T }
 *   { status: 'error', error: unknown, value: T | undefined }
 *
 * `value` is always present so templates can safely render the last known
 * good value while a new fetch is in-flight.
 *
 * ## Basic usage — data fetching
 *
 * ```ts
 * const userId = signal(1);
 *
 * const user = computedAsync(async (signal) => {
 *   const res = await fetch(`/api/users/${userId.get()}`, { signal });
 *   return res.json();
 * });
 *
 * // In render():
 * render() {
 *   const { status, value, error } = user.get();
 *   if (status === 'pending') return <Spinner />;
 *   if (status === 'error')   return <Error message={error.message} />;
 *   return <UserCard user={value} />;
 * }
 * ```
 *
 * ## With initial value
 *
 * ```ts
 * const posts = computedAsync(
 *   async (signal) => fetchPosts(signal),
 *   { initialValue: [] },
 * );
 * // posts.get().value is [] before the first resolve
 * ```
 *
 * ## Returning a plain value (sync fallback)
 *
 * The callback may also return a plain value synchronously — useful for
 * conditional branching where you sometimes have the answer immediately.
 *
 * ```ts
 * const result = computedAsync(() => {
 *   if (cache.has(id.get())) return cache.get(id.get());
 *   return fetch(`/api/${id.get()}`).then(r => r.json());
 * });
 * ```
 *
 * ## Options
 *
 * | Option | Type | Default | Description |
 * |---|---|---|---|
 * | `initialValue` | `T` | `undefined` | Value before first resolution |
 * | `equal` | `(a,b) => boolean` | `Object.is` | Skip update if resolved value is the same |
 */

import { Signal } from 'signal-polyfill';
import type { SignalComputed } from '../signals/core';
import { scheduler } from '../signals/core';

// ─── Public types ─────────────────────────────────────────────────────────────

export type AsyncStatus = 'pending' | 'resolved' | 'error';

export interface AsyncPending<T> {
  status: 'pending';
  /** Last resolved value, or `initialValue` if never resolved. */
  value: T | undefined;
  error?: undefined;
}

export interface AsyncResolved<T> {
  status: 'resolved';
  value: T;
  error?: undefined;
}

export interface AsyncError<T> {
  status: 'error';
  error: unknown;
  /** Last resolved value so templates can show stale data. */
  value: T | undefined;
}

export type AsyncResult<T> = AsyncPending<T> | AsyncResolved<T> | AsyncError<T>;

export interface ComputedAsyncOptions<T> {
  /** Value of `result.value` while the first fetch is pending. Default: `undefined`. */
  initialValue?: T;
  /** Custom equality for resolved values. If equal, the result signal is not updated. */
  equal?: (a: T, b: T) => boolean;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Create a signal whose value is derived from an async computation.
 * The computation re-runs whenever any signal accessed inside `fn` changes.
 * In-flight requests are cancelled via AbortSignal.
 */
export function computedAsync<T>(
  fn: (abortSignal: AbortSignal) => Promise<T> | T,
  options: ComputedAsyncOptions<T> = {},
): SignalComputed<AsyncResult<T>> {
  const { initialValue, equal = Object.is } = options;

  // Internal state signal — holds the current AsyncResult
  const result = new Signal.State<AsyncResult<T>>({
    status: 'pending',
    value: initialValue,
  });

  // Track the currently active abort controller so we can cancel stale requests
  let currentController: AbortController | null = null;
  // Track last resolved value for stale-while-revalidate behaviour
  let lastResolved: T | undefined = initialValue;
  let disposed = false;

  // A computed that tracks signal deps inside `fn`. We never expose this
  // directly — it's only used to collect dependencies.
  const depTracker = new Signal.Computed<void>(() => {
    // Calling fn inside a computed records all signal.get() calls as deps.
    // We discard the return value here; actual execution happens in `run()`.
    try {
      // We need to call fn to record deps, but we use a dummy AbortSignal
      // and ignore the promise. This is intentional — dep tracking only.
      const dummy = new AbortController();
      const maybePromise = fn(dummy.signal);
      // Immediately abort the dummy fetch if it was a real request
      dummy.abort();
      // suppress unhandled rejection from the aborted dummy
      if (maybePromise && typeof (maybePromise as any).catch === 'function') {
        (maybePromise as any).catch(() => {});
      }
    } catch {
      // ignore errors during dep-tracking pass
    }
  });

  // Do NOT call watcher.watch() inside notify — producerAccessed throws during
  // inNotificationPhase. Re-arm is done inside the scheduled task instead.
  const watcher = new Signal.subtle.Watcher(() => {
    if (disposed) return;
    scheduler.schedule(() => {
      if (disposed) return;
      // Re-arm: unwatch → re-evaluate depTracker (fresh dep tracking) → re-watch
      watcher.unwatch(depTracker);
      depTracker.get();
      watcher.watch(depTracker);
      run();
    });
  });

  async function run() {
    if (disposed) return;

    // Cancel any in-flight request
    currentController?.abort();
    const controller = new AbortController();
    currentController = controller;

    // Mark as pending, keeping the last resolved value
    Signal.subtle.untrack(() => result.set({ status: 'pending', value: lastResolved }));

    try {
      // Run the actual async function
      const value = await fn(controller.signal);

      // If aborted while awaiting, ignore the result
      if (controller.signal.aborted || disposed) return;

      // Skip update if the resolved value is unchanged
      const cur = Signal.subtle.untrack(() => result.get());
      if (cur.status === 'resolved' && equal(cur.value as T, value)) return;

      lastResolved = value;
      Signal.subtle.untrack(() => result.set({ status: 'resolved', value }));
    } catch (error) {
      if (controller.signal.aborted || disposed) return;
      Signal.subtle.untrack(() => result.set({ status: 'error', error, value: lastResolved }));
    }
  }

  // Arm watcher — initial dep collection
  depTracker.get();
  watcher.watch(depTracker);

  // Kick off the first run
  run();

  // Return a computed that reads the internal result state.
  // We also attach a `dispose` method so long-lived uses can clean up.
  const output = new Signal.Computed<AsyncResult<T>>(() => result.get()) as SignalComputed<
    AsyncResult<T>
  > & { dispose(): void };

  (output as any).dispose = () => {
    disposed = true;
    currentController?.abort();
    for (const dep of Signal.subtle.introspectSources(depTracker)) {
      try {
        watcher.unwatch(dep as any);
      } catch {}
    }
    try {
      watcher.unwatch(depTracker);
    } catch {}
  };

  return output;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Type-guard: result is pending. */
export function isPending<T>(r: AsyncResult<T>): r is AsyncPending<T> {
  return r.status === 'pending';
}

/** Type-guard: result is resolved. */
export function isResolved<T>(r: AsyncResult<T>): r is AsyncResolved<T> {
  return r.status === 'resolved';
}

/** Type-guard: result has errored. */
export function isError<T>(r: AsyncResult<T>): r is AsyncError<T> {
  return r.status === 'error';
}
