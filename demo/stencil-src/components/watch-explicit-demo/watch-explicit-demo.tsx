import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, signal, watchEffect } from '@kurtaqui/stencil-signals';

@Component({ tag: 'watch-explicit-demo', shadow: false })
export class WatchExplicitDemo extends Mixin(SignalWatcher) {

	readonly a = signal(2);
	readonly b = signal(3);
	readonly log = signal<string[]>([]);

	// watchEffect with explicit deps — registered with `this` for auto lifecycle management.
	readonly watchLogger = watchEffect([this.a, this.b], ([av, bv]) => {
		this.log.set([...this.log.get(), `${av} × ${bv} = ${av * bv}`].slice(-5));
	}, this);

	render() {
		const av = this.a.get();
		const bv = this.b.get();
		const entries = this.log.get();
		return (
			<div>
				<div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
					<label>
						a:{' '}
						<input
							type="number"
							value={av}
							style={{ width: '4rem', marginLeft: '0.3rem' }}
							onInput={(e) => this.a.set(Number((e.target as HTMLInputElement).value))}
						/>
					</label>
					<label>
						b:{' '}
						<input
							type="number"
							value={bv}
							style={{ width: '4rem', marginLeft: '0.3rem' }}
							onInput={(e) => this.b.set(Number((e.target as HTMLInputElement).value))}
						/>
					</label>
					<span>product: <strong>{av * bv}</strong></span>
				</div>
				<div style={{ fontSize: '0.85em', color: '#555' }}>
					<strong>Effect log</strong> (explicit deps: [a, b]):
					<ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
						{entries.map((e, i) => <li key={i}>{e}</li>)}
					</ul>
				</div>
			</div>
		);
	}
}
