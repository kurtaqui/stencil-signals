/**
 * demo/stencil-src/reactive-controller.ts
 *
 * Consumer-owned boilerplate for the ReactiveController composition pattern.
 * Stencil does not ship these types — copy this into your own project.
 *
 * Pairs with `SignalWatcherController` from `@kurtaqui/stencil-signals`:
 *
 * ```ts
 * @Component({ tag: 'my-counter', shadow: false })
 * export class MyCounter extends ReactiveControllerHost {
 *   constructor() {
 *     super();
 *     this.addController(new SignalWatcherController(this));
 *   }
 *   render() { return <p>{count.get()}</p>; }
 * }
 * ```
 */

import { ComponentInterface, forceUpdate } from '@stencil/core';

// ─── Interface ────────────────────────────────────────────────────────────────

/** Lifecycle hooks a reactive controller can implement. All are optional. */
export interface ReactiveController {
	hostConnected?(): void;
	hostDisconnected?(): void;
	hostWillLoad?(): Promise<void> | void;
	hostDidLoad?(): void;
	hostWillRender?(): Promise<void> | void;
	hostDidRender?(): void;
	hostWillUpdate?(): Promise<void> | void;
	hostDidUpdate?(): void;
}

// ─── Host base class ──────────────────────────────────────────────────────────

/**
 * Base class for Stencil components that want to use the composition pattern.
 * Bridges all Stencil lifecycle hooks to registered `ReactiveController`s.
 */
export class ReactiveControllerHost implements ComponentInterface {
	private __controllers = new Set<ReactiveController>();

	addController(controller: ReactiveController): void {
		this.__controllers.add(controller);
	}

	removeController(controller: ReactiveController): void {
		this.__controllers.delete(controller);
	}

	/** Trigger a re-render of this component. */
	requestUpdate(): void {
		forceUpdate(this as any);
	}

	// ─── Stencil lifecycle bridges ──────────────────────────────────────────

	connectedCallback(): void {
		for (const c of this.__controllers) c.hostConnected?.();
	}

	disconnectedCallback(): void {
		for (const c of this.__controllers) c.hostDisconnected?.();
	}

	componentWillLoad(): Promise<void> | void {
		const promises: Promise<void>[] = [];
		for (const c of this.__controllers) {
			const r = c.hostWillLoad?.();
			if (r) promises.push(r);
		}
		if (promises.length) return Promise.all(promises).then(() => { });
	}

	componentDidLoad(): void {
		for (const c of this.__controllers) c.hostDidLoad?.();
	}

	componentWillRender(): Promise<void> | void {
		const promises: Promise<void>[] = [];
		for (const c of this.__controllers) {
			const r = c.hostWillRender?.();
			if (r) promises.push(r);
		}
		if (promises.length) return Promise.all(promises).then(() => { });
	}

	componentDidRender(): void {
		for (const c of this.__controllers) c.hostDidRender?.();
	}

	componentWillUpdate(): Promise<void> | void {
		const promises: Promise<void>[] = [];
		for (const c of this.__controllers) {
			const r = c.hostWillUpdate?.();
			if (r) promises.push(r);
		}
		if (promises.length) return Promise.all(promises).then(() => { });
	}

	componentDidUpdate(): void {
		for (const c of this.__controllers) c.hostDidUpdate?.();
	}
}
