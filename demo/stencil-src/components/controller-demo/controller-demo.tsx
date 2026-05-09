import { Component, h } from '@stencil/core';
import { SignalWatcherController, watchEffect } from '@kurtaqui/stencil-signals';
import { ReactiveControllerHost } from '../../reactive-controller';
import { count, step, doubled } from '../../store';

@Component({ tag: 'controller-demo', shadow: false })
export class ControllerDemo extends ReactiveControllerHost {
	constructor() {
		super();
		this.addController(new SignalWatcherController(this));
	}

	connectedCallback() {
		super.connectedCallback(); // activates owner scope via SignalWatcherController
		// watchEffect auto-registers with the owner scope and is disposed on disconnect
		watchEffect(() => {
			console.log('[controller-demo] watchEffect running, count =', count.get());
			document.title = `count: ${count.get()}`;
		});
	}

	disconnectedCallback() {
		console.log('[controller-demo] disconnected — owner scope will dispose watchEffect');
		super.disconnectedCallback();
	}

	render() {
		const c = count.get();
		const s = step.get();
		return (
			<div>
				<div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', alignItems: 'baseline' }}>
					<span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{c}</span>
					<span style={{ color: '#555' }}>doubled: <strong>{doubled.get()}</strong></span>
				</div>
				<div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
					<button onClick={() => count.set(c - s)}>−{s}</button>
					<button onClick={() => count.set(0)}>Reset</button>
					<button onClick={() => count.set(c + s)}>+{s}</button>
				</div>
				<div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85em' }}>
					<label>step:
						<input
							type="number"
							value={s}
							min={1}
							style={{ width: '4rem', marginLeft: '0.4rem' }}
							onInput={(e) => step.set(Number((e.target as HTMLInputElement).value))}
						/>
					</label>
				</div>
			</div>
		);
	}
}
