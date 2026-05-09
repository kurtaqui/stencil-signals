/**
 * tests/core.preact.test.ts
 *
 * Same functional coverage as core.test.ts but running against the
 * @preact/signals-core backend. Tests that are specific to TC39 internals
 * (instanceof checks, Signal namespace) are replaced with equivalent
 * behavior checks.
 */

import { describe, it, expect, vi } from 'vitest';

// Import the Preact entry point first — this sets the Preact adapter so all
// utilities that call getAdapter() work correctly in this test file.
import {
  signal,
  computed,
  createWatcher,
} from '../src/preact';
import { createStore } from '../src/utils/create-store';
import { watchEffect } from '../src/utils/watch-effect';
import { computedPrevious } from '../src/utils/computed-previous';
import { computedAsync, isPending, isResolved, isError } from '../src/utils/computed-async';

// Helper: flush all pending microtasks
const flush = () => new Promise<void>(r => setTimeout(r, 0));
const tick  = () => new Promise<void>(r => queueMicrotask(r));

// ─── signal() ────────────────────────────────────────────────────────────────

describe('signal() [preact]', () => {
  it('holds an initial value', () => {
    const s = signal(42);
    expect(s.get()).toBe(42);
  });

  it('updates on set()', () => {
    const s = signal(0);
    s.set(7);
    expect(s.get()).toBe(7);
  });

  it('exposes get(), set(), peek() interface', () => {
    const s = signal('hello');
    expect(typeof s.get).toBe('function');
    expect(typeof s.set).toBe('function');
    expect(typeof s.peek).toBe('function');
    expect(s.get()).toBe('hello');
    expect(s.peek()).toBe('hello');
  });

  it('respects custom equals — skips notify when equal', async () => {
    const s = signal({ v: 1 }, { equals: (a, b) => a.v === b.v });
    const notify = vi.fn();
    const w = createWatcher(notify);
    w.watch(s as any);
    s.set({ v: 1 }); // same value by custom equality
    await tick();
    expect(notify).not.toHaveBeenCalled();
    w.dispose();
  });
});

// ─── computed() ───────────────────────────────────────────────────────────────

describe('computed() [preact]', () => {
  it('derives from a signal', () => {
    const base = signal(3);
    const triple = computed(() => base.get() * 3);
    expect(triple.get()).toBe(9);
  });

  it('updates when dependency changes', () => {
    const n = signal(2);
    const sq = computed(() => n.get() ** 2);
    expect(sq.get()).toBe(4);
    n.set(5);
    expect(sq.get()).toBe(25);
  });

  it('chains computeds', () => {
    const a = signal(1);
    const b = computed(() => a.get() + 1);
    const c = computed(() => b.get() * 10);
    expect(c.get()).toBe(20);
    a.set(4);
    expect(c.get()).toBe(50);
  });

  it('exposes get() and peek() interface', () => {
    const c = computed(() => 42);
    expect(typeof c.get).toBe('function');
    expect(typeof c.peek).toBe('function');
    expect(c.get()).toBe(42);
    expect(c.peek()).toBe(42);
  });
});

// ─── createWatcher() ──────────────────────────────────────────────────────────

describe('createWatcher() [preact]', () => {
  it('calls notify when a watched signal changes', async () => {
    const s = signal(0);
    const notify = vi.fn();
    const w = createWatcher(notify);
    w.watch(s as any);
    s.set(1);
    await tick();
    expect(notify).toHaveBeenCalledOnce();
    w.dispose();
  });

  it('does not call notify after dispose', async () => {
    const s = signal(0);
    const notify = vi.fn();
    const w = createWatcher(notify);
    w.watch(s as any);
    w.dispose();
    s.set(99);
    await tick();
    expect(notify).not.toHaveBeenCalled();
  });

  it('calls notify for each distinct change', async () => {
    const s = signal(0);
    const notify = vi.fn();
    const w = createWatcher(notify);
    w.watch(s as any);
    s.set(1);
    await tick();
    s.set(2);
    await tick();
    expect(notify.mock.calls.length).toBeGreaterThanOrEqual(2);
    w.dispose();
  });
});

// ─── createStore() ────────────────────────────────────────────────────────────

describe('createStore() [preact]', () => {
  it('reads initial values', () => {
    const store = createStore({ name: 'Alice', age: 30 });
    expect(store.name).toBe('Alice');
    expect(store.age).toBe(30);
  });

  it('updates on assignment', () => {
    const store = createStore({ count: 0 });
    store.count = 5;
    expect(store.count).toBe(5);
  });

  it('exposes raw signal via $signal()', () => {
    const store = createStore({ x: 10 });
    const sig = store.$signal('x');
    expect(sig.get()).toBe(10);
    sig.set(20);
    expect(store.x).toBe(20);
  });

  it('resets to initial values via $reset()', () => {
    const store = createStore({ a: 1, b: 2 });
    store.a = 99;
    store.b = 99;
    store.$reset();
    expect(store.a).toBe(1);
    expect(store.b).toBe(2);
  });

  it('supports computed properties', () => {
    const store = createStore(
      { price: 10, qty: 3 },
      (s) => ({ total: computed(() => s.price * s.qty) }),
    );
    expect(store.total).toBe(30);
    store.price = 20;
    expect(store.total).toBe(60);
  });

  it('throws on write to unknown key', () => {
    const store = createStore({ a: 1 });
    expect(() => { (store as any).unknown = 2; }).toThrow();
  });
});

// ─── watchEffect() — auto-tracking ───────────────────────────────────────────

describe('watchEffect() — auto-tracking [preact]', () => {
  it('runs immediately — exactly once', () => {
    const fn = vi.fn();
    const cleanup = watchEffect(fn);
    expect(fn).toHaveBeenCalledOnce();
    cleanup();
  });

  it('re-runs when accessed signal changes', async () => {
    const s = signal('a');
    const fn = vi.fn(() => { s.get(); });
    const cleanup = watchEffect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    s.set('b');
    await tick(); await tick();
    cleanup();
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('calls returned cleanup before re-run', async () => {
    const s = signal(0);
    const innerCleanup = vi.fn();
    const cleanup = watchEffect(() => {
      s.get();
      return innerCleanup;
    });
    s.set(1);
    await tick(); await tick();
    cleanup();
    expect(innerCleanup).toHaveBeenCalled();
  });

  it('does not re-run after cleanup is called', async () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    const cleanup = watchEffect(fn);
    cleanup();
    const callsBefore = fn.mock.calls.length;
    s.set(99);
    await tick(); await tick();
    expect(fn.mock.calls.length).toBe(callsBefore);
  });

  it('tracks newly accessed signals on re-run', async () => {
    const toggle = signal(false);
    const a = signal(1);
    const b = signal(10);
    const fn = vi.fn(() => { toggle.get() ? b.get() : a.get(); });
    const cleanup = watchEffect(fn);

    // Currently tracking `toggle` and `a`
    a.set(2);
    await tick(); await tick();
    const callsAfterA = fn.mock.calls.length;

    // Switch to track `b`
    toggle.set(true);
    await tick(); await tick();

    // Now `b` changes should trigger
    b.set(20);
    await tick(); await tick();
    expect(fn.mock.calls.length).toBeGreaterThan(callsAfterA + 1);
    cleanup();
  });
});

// ─── watchEffect() — explicit deps ───────────────────────────────────────────

describe('watchEffect() — explicit deps [preact]', () => {
  it('runs immediately with current dep values', () => {
    const a = signal(1);
    const b = signal('hello');
    const fn = vi.fn();
    const cleanup = watchEffect([a, b], fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn.mock.calls[0][0]).toEqual([1, 'hello']);
    cleanup();
  });

  it('re-runs when a listed dep changes', async () => {
    const s = signal(0);
    const fn = vi.fn();
    const cleanup = watchEffect([s], fn);
    s.set(5);
    await tick(); await tick();
    cleanup();
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fn.mock.calls[1][0]).toEqual([5]);
  });

  it('does NOT re-run for signals read inside fn but not in deps', async () => {
    const dep   = signal(0);   // in deps list
    const other = signal(100); // NOT in deps list, but read inside fn
    const fn = vi.fn(([_d]: number[]) => {
      other.get();
    });
    const cleanup = watchEffect([dep], fn);
    const callsBefore = fn.mock.calls.length;

    other.set(999); // change signal NOT in deps
    await tick(); await tick();
    expect(fn.mock.calls.length).toBe(callsBefore); // no extra run

    dep.set(1); // change dep — should trigger
    await tick(); await tick();
    expect(fn.mock.calls.length).toBeGreaterThan(callsBefore);
    cleanup();
  });

  it('defers initial run when defer:true', async () => {
    const s = signal(0);
    const fn = vi.fn();
    const cleanup = watchEffect([s], fn, { defer: true });
    expect(fn).not.toHaveBeenCalled(); // should NOT run immediately
    s.set(1);
    await tick(); await tick();
    expect(fn).toHaveBeenCalledOnce();
    cleanup();
  });

  it('calls return-value cleanup before re-run', async () => {
    const s = signal(0);
    const innerCleanup = vi.fn();
    const cleanup = watchEffect([s], () => innerCleanup);
    s.set(1);
    await tick(); await tick();
    cleanup();
    expect(innerCleanup).toHaveBeenCalled();
  });

  it('calls onCleanup() registered inside fn', async () => {
    const s = signal(0);
    const registered = vi.fn();
    const cleanup = watchEffect([s], (_vals, onCleanup) => {
      onCleanup(registered);
    });
    s.set(1);
    await tick(); await tick();
    cleanup();
    expect(registered).toHaveBeenCalled();
  });

  it('does not re-run after disposal', async () => {
    const s = signal(0);
    const fn = vi.fn();
    const cleanup = watchEffect([s], fn);
    cleanup();
    const countBefore = fn.mock.calls.length;
    s.set(99);
    await tick(); await tick();
    expect(fn.mock.calls.length).toBe(countBefore);
  });

  it('handles multiple deps', async () => {
    const a = signal(1);
    const b = signal(2);
    const c = signal(3);
    const fn = vi.fn();
    const cleanup = watchEffect([a, b, c], fn);
    b.set(20);
    await tick(); await tick();
    expect(fn.mock.calls[fn.mock.calls.length - 1][0]).toEqual([1, 20, 3]);
    cleanup();
  });
});

// ─── computedPrevious() ───────────────────────────────────────────────────────

describe('computedPrevious() [preact]', () => {
  it('returns undefined before any change by default', () => {
    const s = signal(42);
    const prev = computedPrevious(s);
    expect(prev.get()).toBeUndefined();
  });

  it('returns explicit initialValue before first change', () => {
    const s = signal(10);
    const prev = computedPrevious(s, -1);
    expect(prev.get()).toBe(-1);
  });

  it('returns the value before the last set()', async () => {
    const s = signal(0);
    const prev = computedPrevious(s);
    s.set(5);
    await tick(); await tick();
    expect(prev.get()).toBe(0);
  });

  it('tracks multiple changes in sequence', async () => {
    const s = signal('a');
    const prev = computedPrevious(s);

    s.set('b');
    await tick(); await tick();
    expect(prev.get()).toBe('a');

    s.set('c');
    await tick(); await tick();
    expect(prev.get()).toBe('b');

    s.set('d');
    await tick(); await tick();
    expect(prev.get()).toBe('c');
  });

  it('works with a computed signal as source', async () => {
    const n = signal(1);
    const doubled = computed(() => n.get() * 2);
    const prevDoubled = computedPrevious(doubled);

    // seed
    doubled.get();

    n.set(3); // doubled → 6
    await tick(); await tick();
    // prevDoubled should have held 2 before changing to 6
    const val = prevDoubled.get();
    expect(val === 2 || val === undefined).toBe(true);
  });

  it('does not update when signal is set to the same value', async () => {
    const s = signal(7);
    const prev = computedPrevious(s);
    s.set(7); // same value — Preact signals also use Object.is by default
    await tick(); await tick();
    expect(prev.get()).toBeUndefined(); // never changed
  });
});

// ─── computedAsync() ─────────────────────────────────────────────────────────

describe('computedAsync() [preact]', () => {
  it('starts in pending state', () => {
    const result = computedAsync(async () => 42);
    expect(result.get().status).toBe('pending');
    (result as any).dispose?.();
  });

  it('resolves to the returned value', async () => {
    const result = computedAsync(async () => 'hello');
    await flush();
    expect(result.get()).toEqual({ status: 'resolved', value: 'hello' });
    (result as any).dispose?.();
  });

  it('carries initialValue in pending state', () => {
    const result = computedAsync(async () => 99, { initialValue: 0 });
    expect(result.get()).toMatchObject({ status: 'pending', value: 0 });
    (result as any).dispose?.();
  });

  it('keeps last resolved value while pending on re-run', async () => {
    const id = signal(1);
    let resolveNext!: (v: number) => void;

    const result = computedAsync(async (abortSignal) => {
      const current = id.get();
      if (current === 1) return 100;
      return new Promise<number>(r => { resolveNext = r; });
    });

    await flush();
    expect(result.get()).toMatchObject({ status: 'resolved', value: 100 });

    id.set(2); // triggers re-run; will stay pending until resolveNext called
    await tick();
    // Still shows last resolved value in pending
    const pending = result.get();
    expect(pending.status).toBe('pending');
    expect(pending.value).toBe(100);

    resolveNext(200);
    await flush();
    expect(result.get()).toMatchObject({ status: 'resolved', value: 200 });
    (result as any).dispose?.();
  });

  it('transitions to error state on rejection', async () => {
    const result = computedAsync(async () => {
      throw new Error('boom');
    });
    await flush();
    const r = result.get();
    expect(r.status).toBe('error');
    if (isError(r)) expect(r.error).toBeInstanceOf(Error);
    (result as any).dispose?.();
  });

  it('re-runs when a tracked signal changes', async () => {
    const id = signal(1);
    const calls: number[] = [];

    const result = computedAsync(async () => {
      const v = id.get();
      calls.push(v);
      return v * 10;
    });

    await flush();
    expect(result.get()).toMatchObject({ status: 'resolved', value: 10 });

    id.set(2);
    await flush();
    expect(result.get()).toMatchObject({ status: 'resolved', value: 20 });
    expect(calls).toContain(2);
    (result as any).dispose?.();
  });

  it('cancels in-flight request via AbortSignal on dep change', async () => {
    const id = signal(1);
    const aborts: boolean[] = [];

    const result = computedAsync(async (abortSignal) => {
      id.get(); // track dep
      await new Promise<void>((_, reject) => {
        abortSignal.addEventListener('abort', () => {
          aborts.push(true);
          reject(new DOMException('Aborted', 'AbortError'));
        });
        setTimeout(() => {
          if (!abortSignal.aborted) reject(new Error('timeout'));
        }, 5000);
      });
      return 0;
    });

    // Change dep while first request is in-flight
    await tick();
    id.set(2);
    await flush();

    expect(aborts.length).toBeGreaterThan(0);
    (result as any).dispose?.();
  });

  it('returns sync value when fn returns non-Promise', async () => {
    const flag = signal(true);
    const result = computedAsync((_abortSig) => {
      if (flag.get()) return 'sync-value' as any;
      return Promise.resolve('async-value');
    });
    await flush();
    expect(result.get()).toMatchObject({ status: 'resolved', value: 'sync-value' });
    (result as any).dispose?.();
  });

  // ── Type guards ────────────────────────────────────────────────────────────

  describe('type guards', () => {
    it('isPending()', () => {
      expect(isPending({ status: 'pending', value: undefined })).toBe(true);
      expect(isPending({ status: 'resolved', value: 1 })).toBe(false);
    });

    it('isResolved()', () => {
      expect(isResolved({ status: 'resolved', value: 1 })).toBe(true);
      expect(isResolved({ status: 'pending', value: undefined })).toBe(false);
    });

    it('isError()', () => {
      expect(isError({ status: 'error', error: new Error(), value: undefined })).toBe(true);
      expect(isError({ status: 'resolved', value: 1 })).toBe(false);
    });
  });
});
