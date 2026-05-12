import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, computedPrevious } from '@kurtaqui/stencil-signals';
import type { DisposableSignal } from '@kurtaqui/stencil-signals';
import { count } from '../../store';

@Component({ tag: 'previous-demo', shadow: false })
export class PreviousDemo extends Mixin(SignalWatcher) {
	// computedPrevious creates a watcher — created in connectedCallback so
	// SignalWatcher auto-disposes it on disconnect.
	private prevCount?: DisposableSignal<number | undefined>;

	connectedCallback(): void {
		super.connectedCallback?.();
		this.prevCount = computedPrevious(count);
	}

	render() {
		const c = count.get();
		const prev = this.prevCount?.get();
		return (
			<div>
				<div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
					<span>current: <strong>{c}</strong></span>
					<span style={{ color: '#888' }}>previous: {prev ?? '—'}</span>
				</div>
				<div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
					<button onClick={() => count.set(c - 1)}>−</button>
					<button onClick={() => count.set(c + 1)}>+</button>
					<span style={{ marginLeft: '0.5rem', fontSize: '0.85em', color: '#555' }}>
						(shares <code>count</code> with counter-demo above)
					</span>
				</div>
			</div>
		);
	}
}
