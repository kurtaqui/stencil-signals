import React from 'react';
import { signal, computedAsync, isPending, isResolved, isError } from '../lib';
import { useSignalValue } from '../hooks/useSignal';

type User = { id: number; name: string };

const userId = signal(1);
const user = computedAsync<User>(async (abort) => {
  const res = await fetch(`https://jsonplaceholder.typicode.com/users/${userId.get()}`, { signal: abort });
  return res.json() as Promise<User>;
});

export function AsyncDemo() {
  const idVal = useSignalValue(userId);
  const userVal = useSignalValue(user);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span>user ID:</span>
        <button onClick={() => userId.set(Math.max(1, idVal - 1))}>−</button>
        <span style={{ minWidth: '1.5rem', textAlign: 'center' }}>{idVal}</span>
        <button onClick={() => userId.set(Math.min(10, idVal + 1))}>+</button>
      </div>
      <div>
        {isPending(userVal) && <span style={{ color: '#888' }}>Loading…</span>}
        {isError(userVal) && <span style={{ color: '#dc2626' }}>Error loading user</span>}
        {isResolved(userVal) && (
          <span>Name: <strong>{userVal.value.name}</strong></span>
        )}
      </div>
    </div>
  );
}
