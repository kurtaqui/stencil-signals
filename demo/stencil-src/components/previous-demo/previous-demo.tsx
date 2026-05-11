import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher } from '@kurtaqui/stencil-signals/tc39';
import { count, prevCount } from '../../store';

@Component({ tag: 'previous-demo', shadow: false })
export class PreviousDemo extends Mixin(SignalWatcher) {
  render() {
    const c = count.get();
    const prev = prevCount.get();
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
