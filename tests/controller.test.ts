/**
 * tests/controller.test.ts
 *
 * Unit tests for the ReactiveController composition pattern:
 *  - ReactiveControllerHost (from the demo's reactive-controller.ts)
 *  - SignalWatcherController (from @kurtaqui/stencil-signals)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set the TC39 adapter before importing anything else.
import '../src/index';
import { signal } from '../src/index';
import { SignalWatcherController } from '../src/controllers/signal-watcher-controller';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tick = () => new Promise<void>((r) => queueMicrotask(r));
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// ─── Minimal ReactiveController / ReactiveControllerHost stubs ────────────────
// (mirrors demo/stencil-src/reactive-controller.ts, but without the
//  `forceUpdate` import so tests run in Node without jsdom)

interface ReactiveController {
	hostConnected?(): void;
	hostDisconnected?(): void;
	hostWillLoad?(): Promise<void> | void;
	hostDidLoad?(): void;
	hostWillRender?(): Promise<void> | void;
	hostDidRender?(): void;
	hostWillUpdate?(): Promise<void> | void;
	hostDidUpdate?(): void;
}

class ReactiveControllerHost {
	private __controllers = new Set<ReactiveController>();
	requestUpdate = vi.fn();

	addController(c: ReactiveController): void {
		this.__controllers.add(c);
	}
	removeController(c: ReactiveController): void {
		this.__controllers.delete(c);
	}
	connectedCallback(): void {
		for (const c of this.__controllers) c.hostConnected?.();
	}
	disconnectedCallback(): void {
		for (const c of this.__controllers) c.hostDisconnected?.();
	}
	componentWillLoad(): Promise<void> | void {
		const p: Promise<void>[] = [];
		for (const c of this.__controllers) { const r = c.hostWillLoad?.(); if (r) p.push(r); }
		if (p.length) return Promise.all(p).then(() => { });
	}
	componentDidLoad(): void {
		for (const c of this.__controllers) c.hostDidLoad?.();
	}
	componentWillRender(): Promise<void> | void {
		const p: Promise<void>[] = [];
		for (const c of this.__controllers) { const r = c.hostWillRender?.(); if (r) p.push(r); }
		if (p.length) return Promise.all(p).then(() => { });
	}
	componentDidRender(): void {
		for (const c of this.__controllers) c.hostDidRender?.();
	}
	componentWillUpdate(): Promise<void> | void {
		const p: Promise<void>[] = [];
		for (const c of this.__controllers) { const r = c.hostWillUpdate?.(); if (r) p.push(r); }
		if (p.length) return Promise.all(p).then(() => { });
	}
	componentDidUpdate(): void {
		for (const c of this.__controllers) c.hostDidUpdate?.();
	}
}

// ─── ReactiveControllerHost ───────────────────────────────────────────────────

describe('ReactiveControllerHost', () => {
	it('addController / removeController', () => {
		const host = new ReactiveControllerHost();
		const c: ReactiveController = { hostDidLoad: vi.fn() };
		host.addController(c);
		host.componentDidLoad();
		expect(c.hostDidLoad).toHaveBeenCalledOnce();

		host.removeController(c);
		(c.hostDidLoad as ReturnType<typeof vi.fn>).mockClear();
		host.componentDidLoad();
		expect(c.hostDidLoad).not.toHaveBeenCalled();
	});

	it('delegates connectedCallback → hostConnected', () => {
		const host = new ReactiveControllerHost();
		const c: ReactiveController = { hostConnected: vi.fn() };
		host.addController(c);
		host.connectedCallback();
		expect(c.hostConnected).toHaveBeenCalledOnce();
	});

	it('delegates disconnectedCallback → hostDisconnected', () => {
		const host = new ReactiveControllerHost();
		const c: ReactiveController = { hostDisconnected: vi.fn() };
		host.addController(c);
		host.disconnectedCallback();
		expect(c.hostDisconnected).toHaveBeenCalledOnce();
	});

	it('componentWillLoad awaits all async controller promises', async () => {
		const host = new ReactiveControllerHost();
		let resolveA!: () => void;
		let resolveB!: () => void;
		const a: ReactiveController = { hostWillLoad: () => new Promise<void>((r) => (resolveA = r)) };
		const b: ReactiveController = { hostWillLoad: () => new Promise<void>((r) => (resolveB = r)) };
		host.addController(a);
		host.addController(b);

		let done = false;
		const p = host.componentWillLoad()!;
		p.then(() => { done = true; });

		resolveA();
		await tick();
		expect(done).toBe(false);

		resolveB();
		await flush();
		expect(done).toBe(true);
	});

	it('componentWillLoad is sync (returns void) when no controllers are async', () => {
		const host = new ReactiveControllerHost();
		const c: ReactiveController = { hostWillLoad: () => { } };
		host.addController(c);
		expect(host.componentWillLoad()).toBeUndefined();
	});
});

// ─── SignalWatcherController ──────────────────────────────────────────────────

describe('SignalWatcherController', () => {
	let host: ReactiveControllerHost & { render: () => unknown };

	beforeEach(() => {
		const base = new ReactiveControllerHost();
		// Give the host a render method so the controller can patch it.
		(base as any).render = vi.fn(() => 'rendered');
		host = base as any;
		const ctrl = new SignalWatcherController(host);
		host.addController(ctrl);
	});

	it('hostConnected activates owner scope (no throw)', () => {
		expect(() => host.connectedCallback()).not.toThrow();
	});

	it('render wrapper is installed after hostConnected', () => {
		const original = host.render;
		host.connectedCallback();
		// The controller replaces host.render with a tracking wrapper.
		expect(host.render).not.toBe(original);
	});

	it('first render call executes the original render and returns its value', () => {
		host.connectedCallback();
		const result = host.render();
		expect(result).toBe('rendered');
	});

	it('signal change calls requestUpdate after render', async () => {
		const s = signal(0);
		(host as any).render = () => s.get(); // read signal in render

		// Re-create controller with new render.
		const fresh = new ReactiveControllerHost();
		(fresh as any).render = () => s.get();
		fresh.requestUpdate = vi.fn();
		const ctrl = new SignalWatcherController(fresh as any);
		fresh.addController(ctrl);
		fresh.connectedCallback();

		// First render — subscribes to s.
		(fresh as any).render();
		expect(fresh.requestUpdate).not.toHaveBeenCalled();

		// Mutate signal — should schedule requestUpdate.
		s.set(1);
		await tick();
		await tick();
		expect(fresh.requestUpdate).toHaveBeenCalled();
	});

	it('hostDisconnected disposes the tracking effect', async () => {
		const s = signal(0);
		const fresh = new ReactiveControllerHost();
		(fresh as any).render = () => s.get();
		fresh.requestUpdate = vi.fn();
		const ctrl = new SignalWatcherController(fresh as any);
		fresh.addController(ctrl);
		fresh.connectedCallback();
		(fresh as any).render();

		fresh.disconnectedCallback();
		await flush();

		fresh.requestUpdate.mockClear();
		s.set(99);
		await flush();
		expect(fresh.requestUpdate).not.toHaveBeenCalled();
	});

	it('DOM-move guard: disconnect + reconnect in same microtask keeps effect alive', async () => {
		const s = signal(0);
		const fresh = new ReactiveControllerHost();
		(fresh as any).render = () => s.get();
		fresh.requestUpdate = vi.fn();
		const ctrl = new SignalWatcherController(fresh as any);
		fresh.addController(ctrl);
		fresh.connectedCallback();
		(fresh as any).render();

		// Simulate DOM move: disconnect then reconnect synchronously.
		fresh.disconnectedCallback();
		fresh.connectedCallback();
		(fresh as any).render();

		// Wait for microtasks to flush (the guard runs here).
		await flush();

		fresh.requestUpdate.mockClear();
		s.set(42);
		await flush();
		// Effect should still be alive because the reconnect happened before the guard fired.
		expect(fresh.requestUpdate).toHaveBeenCalled();
	});
});
