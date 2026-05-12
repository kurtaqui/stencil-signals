/**
 * @kurtaqui/stencil-signals — adapters/tc39.ts
 *
 * SignalAdapter implementation backed by the TC39 signals proposal
 * (signal-polyfill v0.2+).
 *
 * TC39 Signal.State / Signal.Computed already expose `.get()` and `.set()`.
 * We augment each instance with a `.peek()` method (untracked read) to
 * satisfy the SignalState / SignalComputed interfaces, then return the raw
 * instance cast to the adapter type — no wrapper object needed.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addPeek<T>(raw: Signal.State<T> | InstanceType<typeof Signal.Computed<T>>): void {
	Object.defineProperty(raw, 'peek', {
		value: () => Signal.subtle.untrack(() => (raw as any).get()),
		writable: false,
		configurable: true,
		enumerable: false,
	});
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const tc39Adapter: SignalAdapter = {

	createState<T>(value: T, options?: SignalOptions<T>): SignalState<T> {
		// TC39 options shape: { equals?: (a, b) => boolean }
		const raw = new Signal.State<T>(value, options as any);
		addPeek(raw);
		return raw as unknown as SignalState<T>;
	},

	createComputed<T>(fn: () => T, options?: SignalOptions<T>): SignalComputed<T> {
		const raw = new Signal.Computed<T>(fn, options as any);
		addPeek(raw);
		return raw as unknown as SignalComputed<T>;
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
				watcher.watch(sig as any);
			},
			unwatch(sig) {
				try { watcher.unwatch(sig as any); } catch { /* ok */ }
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
