/**
 * @kurtaqui/stencil-signals — utils/computed-previous.ts
 *
 * `computedPrevious(sig)` returns a read-only signal whose value is always
 * the *previous* value of the source signal — i.e. the value it held before
 * the most recent change.
 *
 * On the very first read, before any change has occurred, the previous value
 * is `undefined` (or the explicit `initialValue` you supply).
 *
 * ## Usage
 *
 * ```ts
 * const count = signal(0);
 * const prevCount = computedPrevious(count);
 *
 * prevCount.get(); // undefined  (no prior value yet)
 * count.set(5);
 * prevCount.get(); // 0          (the value before the last set)
 * count.set(10);
 * prevCount.get(); // 5
 * ```
 *
 * ### With an explicit initial value
 *
 * ```ts
 * const prevCount = computedPrevious(count, -1);
 * prevCount.get(); // -1  (before any change)
 * ```
 *
 * ### In a component (e.g. for transition direction)
 *
 * ```ts
 * const page = signal(0);
 * const prevPage = computedPrevious(page);
 *
 * render() {
 *   const direction = page.get() > (prevPage.get() ?? 0) ? 'forward' : 'back';
 *   return <div class={direction}>...</div>;
 * }
 * ```
 */

import { Signal } from 'signal-polyfill';
import { scheduler } from '../signals/core';
import type { SignalState, SignalComputed } from '../signals/core';

type AnyReadableSignal<T> = SignalState<T> | SignalComputed<T>;

/**
 * Returns a signal that always holds the previous value of `source`.
 *
 * @param source  Any readable TC39 signal (State or Computed).
 * @param initialValue  Value returned before the first change. Defaults to `undefined`.
 */
export function computedPrevious<T>(
  source: AnyReadableSignal<T>,
  initialValue?: T,
): SignalComputed<T | undefined> {
  // We store previous in a plain Signal.State so the computed can read it
  // without creating a circular dependency.
  const prev = new Signal.State<T | undefined>(initialValue);

  // A watcher fires whenever `source` changes. In the callback we capture the
  // current value (which is still the old one, before re-evaluation) as the
  // new "previous".
  let lastSeen: T | undefined = initialValue;

  const watcher = new Signal.subtle.Watcher(() => {
    // Do NOT call watcher.watch() here — triggers producerAccessed during
    // inNotificationPhase and throws in signal-polyfill.
    // Schedule the prev update in the same micro-task batch as re-renders,
    // and re-arm the watcher there (safe: outside notification phase).
    scheduler.schedule(() => {
      const current = Signal.subtle.untrack(() => source.get());
      if (!Object.is(current, lastSeen)) {
        prev.set(lastSeen);
        lastSeen = current;
      }
      // Re-arm for the next change
      try { watcher.watch(source as any); } catch { /* disposed */ }
    });
  });

  // Seed lastSeen with the current value so the first change is tracked correctly
  lastSeen = Signal.subtle.untrack(() => source.get());

  watcher.watch(source as any);

  // The returned computed simply reads `prev` — it is reactive so any
  // component/effect that reads it will re-run when prev changes.
  return new Signal.Computed<T | undefined>(() => prev.get());
}
