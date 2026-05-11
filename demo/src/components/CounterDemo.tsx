import React from 'react';
import { count, step, doubled } from '../store';
import { useSignalValue } from '../hooks/useSignal';

export function CounterDemo() {
  const c = useSignalValue(count);
  const s = useSignalValue(step);
  const d = useSignalValue(doubled);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{c}</span>
        <span style={{ color: '#888' }}>doubled: {d}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <button onClick={() => count.set(c - s)}>−{s}</button>
        <button onClick={() => count.set(0)}>Reset</button>
        <button onClick={() => count.set(c + s)}>+{s}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span>step:</span>
        <button onClick={() => step.set(s - 1)}>−</button>
        <span style={{ minWidth: '1.5rem', textAlign: 'center' }}>{s}</span>
        <button onClick={() => step.set(s + 1)}>+</button>
      </div>
    </div>
  );
}
