import React, { useEffect, useRef } from 'react';
import { signal, watchEffect } from '../lib';
import { useSignalValue } from '../hooks/useSignal';

const name = signal('world');
const disposed = signal(false);

export function WatchEffectDemo() {
  const nameVal = useSignalValue(name);
  const disposedVal = useSignalValue(disposed);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    disposed.set(false);
    stopRef.current = watchEffect(() => {
      document.title = `Hello, ${name.get()}!`;
    });
    return () => {
      stopRef.current?.();
      document.title = '@kurtaqui/stencil-signals demo';
    };
  }, []);

  const handleDispose = () => {
    if (!disposedVal) {
      stopRef.current?.();
      stopRef.current = null;
      disposed.set(true);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <label>name:</label>
        <input
          value={nameVal}
          onInput={(e) => name.set((e.target as HTMLInputElement).value)}
          style={{ padding: '0.2rem 0.4rem' }}
        />
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        Output: <strong>Hello, {nameVal}!</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button onClick={handleDispose}>dispose effect</button>
        <span style={{ fontSize: '0.85em', color: '#555' }}>
          {disposedVal
            ? 'disposed — title no longer updates'
            : 'effect active — watch the browser tab title'}
        </span>
      </div>
    </div>
  );
}
