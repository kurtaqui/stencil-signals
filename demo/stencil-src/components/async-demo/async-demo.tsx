import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, signal, computedAsync, isPending, isResolved, isError } from '@kurtaqui/stencil-signals/tc39';

const userId = signal(1);

const user = computedAsync(async (signal) => {
  const res = await fetch(`https://jsonplaceholder.typicode.com/users/${userId.get()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { name: string; email: string; username: string };
  return data;
});

@Component({ tag: 'async-demo', shadow: false })
export class AsyncDemo extends Mixin(SignalWatcher) {
  render() {
    const result = user.get();
    const uid = userId.get();

    let content: unknown;
    if (isPending(result)) {
      content = <span style={{ color: '#888' }}>Loading user {uid}…</span>;
    } else if (isError(result)) {
      content = <span style={{ color: '#c00' }}>Error: {String(result.error)}</span>;
    } else if (isResolved(result)) {
      const u = result.value;
      content = (
        <div>
          <strong>{u.name}</strong>{' '}
          <span style={{ color: '#555', fontSize: '0.85em' }}>@{u.username}</span>
          <br />
          <span style={{ fontSize: '0.85em', color: '#777' }}>{u.email}</span>
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.9em' }}>
            User ID:{' '}
            <input
              type="number"
              value={uid}
              min={1}
              max={10}
              style={{ width: '4rem', marginLeft: '0.3rem' }}
              onInput={(e) => userId.set(Number((e.target as HTMLInputElement).value))}
            />
          </label>
          <span style={{ marginLeft: '0.75rem', fontSize: '0.8em', color: '#888', verticalAlign: 'middle' }}>
            status: <code>{result.status}</code>
            {isPending(result) && result.value ? ` (prev: ${(result.value as { name: string }).name})` : ''}
          </span>
        </div>
        <div style={{ minHeight: '3rem' }}>{content}</div>
      </div>
    );
  }
}
