import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, signal } from '@kurtaqui/stencil-signals';
import type { SignalWatcherApi } from '@kurtaqui/stencil-signals';

const name = signal('World');
const disposed = signal(false);

@Component({ tag: 'watch-effect-demo', shadow: false })
export class WatchEffectDemo extends Mixin(SignalWatcher) {
	private _stop?: () => void;

	connectedCallback() {
		super.connectedCallback?.();
		disposed.set(false);
		this._stop = (this as unknown as SignalWatcherApi).updateEffect(() => {
			document.title = `Hello, ${name.get()}!`;
		});
	}

	disconnectedCallback() {
		this._stop?.();
		disposed.set(true);
		super.disconnectedCallback?.();
	}

	render() {
		return (
			<div>
				<div style={{ marginBottom: '0.5rem' }}>
					<label>
						Name:{' '}
						<input
							value={name.get()}
							onInput={(e) => name.set((e.target as HTMLInputElement).value)}
							style={{ marginLeft: '0.4rem' }}
						/>
					</label>
				</div>
				<p style={{ margin: '0.25rem 0', fontSize: '0.9em', color: '#555' }}>
					Browser tab title: <em>&ldquo;Hello, {name.get()}!&rdquo;</em>
				</p>
				<p style={{ margin: '0.25rem 0', fontSize: '0.85em', color: disposed.get() ? '#c00' : '#080' }}>
					Effect: {disposed.get() ? 'disposed' : 'active'}
				</p>
				<button
					style={{ marginTop: '0.4rem', fontSize: '0.85em' }}
					onClick={() => { this._stop?.(); disposed.set(true); }}
					disabled={disposed.get()}
				>
					Dispose effect
				</button>
			</div>
		);
	}
}
