import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, signal } from '@kurtaqui/stencil-signals';
import { computedAsync, isPending, isResolved, isError } from '@kurtaqui/stencil-signals/extensions';
import type { AsyncResult } from '@kurtaqui/stencil-signals/extensions';

// userId is module-level — just a value, no watcher, no cleanup needed.
const userId = signal(1);

type User = { name: string; email: string; username: string };

@Component({ tag: 'async-demo', shadow: false })
export class AsyncDemo extends Mixin(SignalWatcher) {
	// computedAsync registers with `this` — auto-disposed on disconnect,
	// automatically reinited (re-fetches) on reconnect.
	readonly user = computedAsync<User>(async (abortSignal) => {
		const res = await fetch(`https://jsonplaceholder.typicode.com/users/${userId()}`, { signal: abortSignal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json() as Promise<User>;
	}, this);

	render() {
		const result: AsyncResult<User> = this.user() ?? { status: 'pending', value: undefined };
		const uid = userId();

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
