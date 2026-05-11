import React, { useEffect, useRef } from 'react';
import { signal, watchEffect } from '../lib';
import { useSignalValue } from '../hooks/useSignal';

const a = signal(1);
const b = signal(10);
const log = signal<string[]>([]);

export function WatchExplicitDemo() {
  const aVal = useSignalValue(a);
  const bVal = useSignalValue(b);
  const logVal = useSignalValue(log);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stopRef.current = watchEffect([a, b] as const, ([av, bv]) => {
      const entry = `${av} + ${bv} = ${(av as number) + (bv as number)}`;
      log.set([...log.get().slice(-4), entry]);
    });
    return () => {
      stopRef.current?.();
      stopRef.current = null;
      log.set([]);
    };
  }, []);

  const handleDispose = () => {
    stopRef.current?.();
    stopRef.current = null;
    log.set([...logVal, '(disposed)']);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ minWidth: '40px' }}>a: {aVal}</span>
        <button onClick={() => a.set(aVal + 1)}>a++</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ minWidth: '40px' }}>b: {bVal}</span>
        <button onClick={() => b.set(bVal + 10)}>b+=10</button>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <strong>Effect log</strong> (last 5 runs):
        {logVal.length === 0
          ? <p style={{ fontSize: '0.85em', color: '#555', margin: '0.25rem 0' }}>— increment a or b to trigger —</p>
          : logVal.map((entry, i) => (
            <p key={i} style={{ fontSize: '0.85em', color: '#555', margin: '0.25rem 0' }}>{entry}</p>
          ))}
      </div>
      <button style={{ marginTop: '0.5rem' }} onClick={handleDispose}>
        dispose effect
      </button>
    </div>
  );
}
