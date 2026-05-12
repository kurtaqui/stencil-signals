/**
 * @kurtaqui/stencil-signals — utils/watch-effect.ts
 *
 * Two signatures, one function:
 *
 * ─── Auto-tracking ────────────────────────────────────────────────────────────
 *
 *   watchEffect(fn)
 *
 * Runs `fn` immediately, tracks every signal `.get()` called inside it, and
 * re-runs `fn` whenever any of those signals change.
 *
 * ─── Explicit deps ────────────────────────────────────────────────────────────
 *
 *   watchEffect(deps, fn, options?)
 *
 * Only re-runs when the signals listed in `deps` change. The callback receives
 * their current values as typed arguments. Signal reads *inside* `fn` that
 * are NOT in `deps` are untracked.
 *
 * Options:
 *   `defer: true` — skip the initial synchronous run; only fire on first change.
 *
 * In both modes `fn` may return a cleanup function called before each re-run
 * and on final disposal.
 */

import { getAdapter } from '../adapters/active';
import { scheduler, getActiveOwner } from '../signals/core';
import type { SignalState, SignalComputed } from '../adapters/types';
import type { WatcherRegistrar } from '../mixins/signal-watcher';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CleanupFn = () => void;

type AnySignal<T = unknown> = SignalState<T> | SignalComputed<T>;

type SignalValues<T extends readonly AnySignal[]> = {
	[K in keyof T]: T[K] extends AnySignal<infer V> ? V : never;
};

export interface WatchEffectOptions {
	/**
	 * When `true`, the effect does NOT run immediately on creation.
	 * Only fires on first dep change. Applicable to explicit-deps mode only.
	 */
	defer?: boolean;
}

// ─── Overloads ────────────────────────────────────────────────────────────────

/** Auto-tracking: re-runs whenever any signal read inside `fn` changes. */
export function watchEffect(fn: () => void | CleanupFn, host?: WatcherRegistrar): CleanupFn;

/** Explicit-deps: re-runs only when signals in `deps` change. */
export function watchEffect<const Deps extends readonly AnySignal[]>(
	deps: Deps,
	fn: (values: SignalValues<Deps>, onCleanup: (fn: CleanupFn) => void) => void | CleanupFn,
	options: WatchEffectOptions,
	host?: WatcherRegistrar,
): CleanupFn;
export function watchEffect<const Deps extends readonly AnySignal[]>(
	deps: Deps,
	fn: (values: SignalValues<Deps>, onCleanup: (fn: CleanupFn) => void) => void | CleanupFn,
	host?: WatcherRegistrar,
): CleanupFn;

// ─── Implementation ───────────────────────────────────────────────────────────

export function watchEffect(
	fnOrDeps: (() => void | CleanupFn) | readonly AnySignal[],
	fnOrHost?: ((values: unknown[], onCleanup: (fn: CleanupFn) => void) => void | CleanupFn) | WatcherRegistrar,
	optionsOrHost: WatchEffectOptions | WatcherRegistrar = {},
	maybeHost?: WatcherRegistrar,
): CleanupFn {
	if (typeof fnOrDeps === 'function') {
		// Auto-tracking overload: watchEffect(fn, host?)
		const fn = fnOrDeps;
		const host = typeof (fnOrHost as WatcherRegistrar)?.__addWatcher === 'function'
			? fnOrHost as WatcherRegistrar
			: undefined;
		if (host) {
			return _watchEffectWithHost(() => autoTrackingEffect(fn), host);
		}
		const stop = autoTrackingEffect(fn);
		getActiveOwner()?.push(stop);
		return stop;
	}

	// Explicit-deps overload: watchEffect(deps, fn, options?, host?)
	const deps = fnOrDeps as readonly AnySignal[];
	const explicitFn = fnOrHost as (values: unknown[], onCleanup: (fn: CleanupFn) => void) => void | CleanupFn;

	let options: WatchEffectOptions = {};
	let host: WatcherRegistrar | undefined;

	if (typeof (optionsOrHost as WatcherRegistrar)?.__addWatcher === 'function') {
		host = optionsOrHost as WatcherRegistrar;
	} else {
		options = (optionsOrHost as WatchEffectOptions) ?? {};
		host = maybeHost;
	}

	if (host) {
		return _watchEffectWithHost(() => explicitDepsEffect(deps, explicitFn, options), host);
	}
	const stop = explicitDepsEffect(deps, explicitFn, options);
	getActiveOwner()?.push(stop);
	return stop;
}

// ─── Host path ────────────────────────────────────────────────────────────────

function _watchEffectWithHost(
	factory: () => CleanupFn,
	host: WatcherRegistrar,
): CleanupFn {
	let stop = factory();
	let isDisposed = false;

	function dispose(): void {
		if (isDisposed) return;
		isDisposed = true;
		stop();
	}

	function reinit(): void {
		if (!isDisposed) return;
		stop = factory();
		isDisposed = false;
	}

	host.__addWatcher({ dispose, reinit });

	// Return the stable dispose — callers can also manually stop the effect.
	return dispose;
}

// ─── Auto-tracking implementation ─────────────────────────────────────────────
//
// Delegates to the adapter's createEffect() which handles dep tracking
// internally for both TC39 (Signal.Computed + Watcher) and Preact (effect()).

function autoTrackingEffect(fn: () => void | CleanupFn): CleanupFn {
	return getAdapter().createEffect(fn as () => void | (() => void));
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

	function onCleanup(cb: CleanupFn) {
		registeredCleanup = cb;
	}

	function readDeps(): unknown[] {
		// Read dep values without creating tracking subscriptions.
		return getAdapter().untrack(() => deps.map((d) => d()));
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

	// Watcher is created before run() so the closure captures it.
	// Do NOT call watcher.watch() inside the notify callback.
	const watcher = getAdapter().createWatcher(() => {
		if (disposed) return;
		scheduler.schedule(run);
	});

	function run() {
		if (disposed) return;
		runCleanups();
		const values = readDeps();
		userCleanup = fn(values, onCleanup) as void | CleanupFn;
		// Re-arm all dep watchers (safe here — we are in a microtask, not in notify).
		// Unwatch first to avoid duplicate entries in TC39's liveConsumerNode array
		// (calling watch() multiple times on the same signal without unwatching grows
		// the array unboundedly, causing the memory leak).
		for (const dep of deps) {
			try {
				watcher.unwatch(dep);
				watcher.watch(dep);
			} catch {
				/* ok */
			}
		}
	}

	// Arm watcher on each dep.
	for (const dep of deps) {
		watcher.watch(dep);
	}

	// Initial run (unless deferred).
	if (!options.defer) {
		const values = readDeps();
		userCleanup = fn(values, onCleanup) as void | CleanupFn;
	}

	return () => {
		disposed = true;
		runCleanups();
		watcher.dispose();
		console.debug('[watchEffect] disposed');
	};
}
