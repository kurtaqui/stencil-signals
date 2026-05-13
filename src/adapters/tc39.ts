/**
 * @kurtaqui/stencil-signals — adapters/tc39.ts
 *
 * SignalAdapter implementation backed by the TC39 signals proposal
 * (signal-polyfill v0.2+).
 *
 * Signals are callable functions: `counter()` reads the value (tracked),
 * `counter.set(v)` writes, `counter.peek()` reads without tracking.
 *
 * Because Signal.subtle.Watcher.watch() requires actual TC39 signal instances
 * (not arbitrary functions), a module-level WeakMap maps each wrapper function
 * back to its raw Signal.State / Signal.Computed so createWatcher can resolve
 * the raw signal when watch() / unwatch() is called.
 *
 * The Watcher fires synchronously when a watched signal changes. Because
 * `watcher.watch()` is forbidden inside the notify callback (it calls
 * producerAccessed which throws when inNotificationPhase === true),
 * re-arming is deferred to a queueMicrotask.
 */

import { Signal } from 'signal-polyfill';
import type {
	SignalAdapter,
	SignalState,
	SignalComputed,
	SignalOptions,
	AdapterWatcher,
} from './types';
import { scheduler } from '../signals/core';

// ─── WeakMap: wrapper fn → raw TC39 signal ────────────────────────────────────
//
// Signal.subtle.Watcher.watch() requires actual Signal.State / Signal.Computed
// instances. We store the mapping here so createWatcher can resolve raw signals.

type RawTC39 = Signal.State<any> | InstanceType<typeof Signal.Computed<any>>;
const rawMap = new WeakMap<Function, RawTC39>();

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const tc39Adapter: SignalAdapter = {

	createState<T>(value: T, options?: SignalOptions<T>): SignalState<T> {
		const raw = new Signal.State<T>(value, options as any);
		const fn = Object.assign(
			() => raw.get(),
			{
				set: (v: T) => raw.set(v),
				update: (updater: (current: T) => T) => raw.set(updater(Signal.subtle.untrack(() => raw.get()))),
				peek: () => Signal.subtle.untrack(() => raw.get()),
			},
		) as unknown as SignalState<T>;
		rawMap.set(fn as unknown as Function, raw);
		return fn;
	},

	createComputed<T>(fn: () => T, options?: SignalOptions<T>): SignalComputed<T> {
		const raw = new Signal.Computed<T>(fn, options as any);
		const wrapper = Object.assign(
			() => raw.get(),
			{
				get: () => raw.get(),
				peek: () => Signal.subtle.untrack(() => raw.get()),
			},
		) as unknown as SignalComputed<T>;
		rawMap.set(wrapper as unknown as Function, raw);
		return wrapper;
	},

	createEffect(fn: () => void | (() => void)): () => void {
		let userCleanup: CleanupFn | undefined;
		let disposed = false;
		let capturedCleanup: CleanupFn | undefined;

		// Wrap fn in a Computed so every signal.get() inside fn is tracked.
		const tracker = new Signal.Computed<null>(() => {
			const ret = fn();
			capturedCleanup = typeof ret === 'function' ? ret : undefined;
			return null;
		});

		const watcher = new Signal.subtle.Watcher(() => {
			if (disposed) return;
			scheduler.schedule(run);
		});

		function run() {
			if (disposed) return;
			userCleanup?.();
			userCleanup = undefined;
			watcher.unwatch(tracker);
			capturedCleanup = undefined;
			tracker.get();
			userCleanup = capturedCleanup;
			watcher.watch(tracker);
		}

		capturedCleanup = undefined;
		tracker.get();
		userCleanup = capturedCleanup;
		watcher.watch(tracker);

		return () => {
			disposed = true;
			userCleanup?.();
			try { watcher.unwatch(tracker); } catch { /* ok */ }
		};
	},

	untrack<T>(fn: () => T): T {
		return Signal.subtle.untrack(fn);
	},

	batch<T>(fn: () => T): T {
		// TC39 has no explicit batch; updates coalesce via the microtask scheduler.
		return fn();
	},

	createWatcher(notify: () => void): AdapterWatcher {
		let disposed = false;

		const watcher = new Signal.subtle.Watcher(() => {
			if (disposed) return;
			// NOTE: watcher.watch() is forbidden inside the notify callback (TC39
			// notification phase). Re-arm via queueMicrotask so the watcher keeps
			// firing on subsequent changes. Always unwatch before watch to avoid
			// growing liveConsumerNode arrays (memory leak prevention).
			notify();
			queueMicrotask(() => {
				if (disposed) return;
				const sources = Signal.subtle.introspectSources(watcher);
				for (const s of sources) {
					try { watcher.unwatch(s as any); } catch { /* ok */ }
				}
				for (const s of sources) {
					try { watcher.watch(s as any); } catch { /* ok */ }
				}
			});
		});

		return {
			watch(sig) {
				const raw = rawMap.get(sig as unknown as Function) ?? sig as any;
				watcher.watch(raw);
			},
			unwatch(sig) {
				const raw = rawMap.get(sig as unknown as Function) ?? sig as any;
				try { watcher.unwatch(raw); } catch { /* ok */ }
			},
			dispose() {
				disposed = true;
				for (const s of Signal.subtle.introspectSources(watcher)) {
					try { watcher.unwatch(s as any); } catch { /* ok */ }
				}
			},
		};
	},
};

type CleanupFn = () => void;
