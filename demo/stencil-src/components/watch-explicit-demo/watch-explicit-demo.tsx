import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, signal, watchEffect } from '@kurtaqui/stencil-signals/tc39';

const a = signal(2);
const b = signal(3);
const log = signal<string[]>([]);

// watchEffect with explicit deps — only re-runs when a or b change
const _stop = watchEffect([a, b], ([av, bv]) => {
  log.set([...log.get(), `${av} × ${bv} = ${av * bv}`].slice(-5));
});

@Component({ tag: 'watch-explicit-demo', shadow: false })
export class WatchExplicitDemo extends Mixin(SignalWatcher) {
  render() {
    const av = a.get();
    const bv = b.get();
    const entries = log.get();
    return (
      <div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <label>
            a:{' '}
            <input
              type="number"
              value={av}
              style={{ width: '4rem', marginLeft: '0.3rem' }}
              onInput={(e) => a.set(Number((e.target as HTMLInputElement).value))}
            />
          </label>
          <label>
            b:{' '}
            <input
              type="number"
              value={bv}
              style={{ width: '4rem', marginLeft: '0.3rem' }}
              onInput={(e) => b.set(Number((e.target as HTMLInputElement).value))}
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
