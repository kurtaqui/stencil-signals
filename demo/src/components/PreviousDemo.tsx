import React from 'react';
import { count, prevCount } from '../store';
import { useSignalValue } from '../hooks/useSignal';

export function PreviousDemo() {
  const c = useSignalValue(count);
  const prev = useSignalValue(prevCount);

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <span>current: <strong>{c}</strong></span>
        <span style={{ color: '#888' }}>previous: {prev ?? '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={() => count.set(c - 1)}>−</button>
        <button onClick={() => count.set(c + 1)}>+</button>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.85em', color: '#555', alignSelf: 'center' }}>
          (shares count with Counter above)
        </span>
      </div>
    </div>
  );
}
