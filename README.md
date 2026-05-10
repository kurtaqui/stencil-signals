# stencil-signals

> TC39 Signals integration for StencilJS — auto-reactive components without prop drilling or manual subscriptions.

[![npm version](https://img.shields.io/npm/v/@kurtaqui/stencil-signals.svg)](https://www.npmjs.com/package/@kurtaqui/stencil-signals)
[![license](https://img.shields.io/npm/l/@kurtaqui/stencil-signals.svg)](LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/kurtaqui/stencil-signals/ci.yml?label=tests)](https://github.com/kurtaqui/stencil-signals/actions)

`stencil-signals` brings reactive signal-based state management to StencilJS components. Any signal accessed during `render()` is automatically tracked — when that signal changes, the component re-renders. No `@Watch`, no event buses, no manual subscription wiring.

The library is inspired by [`@lit-labs/signals`](https://github.com/lit/lit/tree/main/packages/labs/signals) and supports two backends: the [TC39 Signals Proposal](https://github.com/tc39/proposal-signals) (via `signal-polyfill`, default) and [Preact Signals](https://github.com/preactjs/signals). Both expose the same API; the backend is selected by import path.

## Why stencil-signals?

StencilJS is already reactive — but `@State` and `@Prop` are **local and push-based**. Sharing state between unrelated components requires stores, events, or context APIs. TC39 Signals are **global and pull-based**: any component that reads a signal during render automatically subscribes to it.

**Traditional StencilJS:**

```tsx
// State is isolated per component; sharing requires prop drilling or a shared service
@Component({ tag: 'my-counter' })
export class MyCounter {
  @State() count = 0;
  @State() doubled = 0;

  @Watch('count')
  syncDoubled(next: number) { this.doubled = next * 2; } // manual derived state

  render() {
    return <button onClick={() => this.count++}>{this.count} (×2: {this.doubled})</button>;
  }
}
```

**With stencil-signals:**

```tsx
// Shared reactive state — any component reading these signals re-renders on change
export const count = signal(0);
export const doubled = computed(() => count.get() * 2);

@Component({ tag: 'my-counter' })
export class MyCounter extends SignalWatcher(class {}) {
  render() {
    return (
      <button onClick={() => count.set(count.get() + 1)}>
        {count.get()} (×2: {doubled.get()})
      </button>
    );
  }
}
```

| Feature | `@State()` | stencil-signals |
|---------|-----------|-----------------|
| Triggers re-render | ✅ | ✅ |
| Shared across components | ❌ | ✅ |
| Computed/derived values | ❌ | ✅ `computed()` |
| Auto-tracking side effects | ❌ | ✅ `watchEffect(fn)` |
| Explicit-dep side effects | ❌ | ✅ `watchEffect(deps, fn)` |
| Async derived state | ❌ | ✅ `computedAsync` |
| Previous value tracking | ❌ | ✅ `computedPrevious` |
| TC39 standard | ❌ | ✅ |

## Features

- **`SignalWatcher` mixin** — wraps `render()` to auto-track signal dependencies and re-render when they change
- **`@useSignal` decorator** — bind a signal directly to a class property for ergonomic reads and writes
- **`watchEffect`** — side effects with auto-tracking or explicit dependencies, with cleanup support
- **`computedAsync`** — async derived signals with `pending`/`resolved`/`error` status and automatic `AbortSignal` cancellation
- **`computedPrevious`** — derived signal that holds the previous value of another signal
- **`createStore`** — wrap a plain object in per-property signals via a reactive Proxy
- **Dual-backend** — TC39 (`signal-polyfill`, default) or Preact Signals; same API, swap by import
- **Stencil `Mixin()` compatible** — composes with other Stencil controller mixins (v4.37+)

## Installation

```bash
npm install @kurtaqui/stencil-signals signal-polyfill
```

To use the Preact Signals backend instead:

```bash
npm install @kurtaqui/stencil-signals @preact/signals-core
```

**Peer requirements:** `@stencil/core >=4.43.0`

## Quick Start

```ts
// store.ts — define shared state once, outside any component
import { signal, computed } from '@kurtaqui/stencil-signals';

export const count = signal(0);
export const doubled = computed(() => count.get() * 2);
```

```tsx
// my-counter.tsx
import { Component } from '@stencil/core';
import { SignalWatcher, useSignal } from '@kurtaqui/stencil-signals';
import { count, doubled } from './store';

@Component({ tag: 'my-counter', shadow: true })
export class MyCounter extends SignalWatcher(class {}) {
  @useSignal(count) count!: number;

  render() {
    return (
      <div>
        <p>Count: {this.count} — doubled: {doubled.get()}</p>
        <button onClick={() => this.count++}>+1</button>
      </div>
    );
  }
}
```

Any other component that reads `count` or `doubled` will also re-render when those signals change.

## Usage

### `SignalWatcher`

`SignalWatcher` is a mixin factory that patches `render()` to collect signal dependencies and schedule a re-render whenever those signals change.

**Direct extension** (no other mixins, or Stencil < 4.37):

```tsx
@Component({ tag: 'my-comp', shadow: true })
export class MyComp extends SignalWatcher(class {}) {
  render() {
    return <p>{mySignal.get()}</p>;
  }
}
```

**`Mixin()` composition** (Stencil v4.37+, when combining with other mixins):

```tsx
import { Component, Mixin } from '@stencil/core';
import { SignalWatcher } from '@kurtaqui/stencil-signals';
import { LoggingMixin } from './mixins/logging-mixin';

@Component({ tag: 'my-comp', shadow: true })
export class MyComp extends Mixin(SignalWatcher, LoggingMixin) {
  componentDidLoad() {
    super.componentDidLoad?.();
  }

  render() {
    return <p>{mySignal.get()}</p>;
  }
}
```

Put `SignalWatcher` first in `Mixin()` so it wraps the outermost `render()`.

**How re-rendering works:**

- `connectedCallback` — marks the component as active
- `render()` — wraps `super.render()` in a `Signal.Computed` to collect deps, then arms a `Signal.subtle.Watcher` on those deps; rebuilt fresh each render so conditional branches are always tracked correctly
- When any dep changes — `forceUpdate(this)` is queued via a shared microtask scheduler
- `disconnectedCallback` — disposes the watcher

### `@useSignal`

Bind a signal to a class property. Reads call `signal.get()`; writes call `signal.set()`.

```tsx
const theme = signal<'light' | 'dark'>('light');

@Component({ tag: 'my-comp' })
export class MyComp extends SignalWatcher(class {}) {
  @useSignal(theme) theme!: 'light' | 'dark';

  render() {
    return (
      <button onClick={() => (this.theme = this.theme === 'light' ? 'dark' : 'light')}>
        Toggle ({this.theme})
      </button>
    );
  }
}
```

> [!NOTE]
> Writing to a property bound to a `computed` signal throws at runtime. Use `@useSignal` only with writable signals.

### `watchEffect`

**Auto-tracking** — any signal read inside the callback is tracked automatically:

```ts
const stop = watchEffect(() => {
  document.title = `Count: ${count.get()}`;
});

stop(); // dispose
```

If the callback returns a function, it is called as cleanup before the next re-run.

**Explicit dependencies** — list the signals you care about; values are passed as a typed tuple (no `.get()` needed inside `fn`):

```ts
const stop = watchEffect(
  [userId, theme],
  ([id, currentTheme], onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());

    fetch(`/api/users/${id}?theme=${currentTheme}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => userStore.set(data));
  },
  { defer: true }, // skip the initial run, fire only on first change
);
```

Signal reads *inside* `fn` that are not in `deps` are untracked — giving you precise control over what triggers the effect.

| | Auto-tracking | Explicit deps |
|---|---|---|
| Dep declaration | Implicit (any `.get()` inside fn) | Explicit array |
| Risk of unexpected re-runs | Higher | None |
| Values passed to fn | No — use `.get()` manually | Yes, typed tuple |
| Best for | Simple reactive side-effects | Precise control, async work |

### `computedAsync`

An async derived signal. `fn` receives an `AbortSignal` and returns `Promise<T>`. The result is a `Signal.Computed` holding a discriminated union with `status`, `value`, and optional `error`.

When a tracked signal changes, the previous in-flight request is automatically cancelled before the new one starts — no stale responses, no race conditions.

```tsx
const userId = signal(1);

const user = computedAsync(async (abortSignal) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<User>;
}, { initialValue: null });

// In a SignalWatcher component:
render() {
  const result = user.get();

  if (isPending(result))  return <p>Loading…</p>;
  if (isError(result))    return <p>Error: {String(result.error)}</p>;
  return <UserCard user={result.value} />;
}
```

`value` is always present so templates can show stale data while a reload is in progress.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialValue` | `T` | `undefined` | `result.value` before the first resolution |
| `equal` | `(a, b) => boolean` | `Object.is` | Skip update when resolved value is unchanged |

> [!NOTE]
> Call `(user as any).dispose()` in `disconnectedCallback()` to cancel any pending request when the component unmounts.

### `computedPrevious`

A derived signal that holds the value a signal had before its most recent change.

```ts
const page = signal(1);
const prevPage = computedPrevious(page); // undefined until first change

page.set(2);
prevPage.get(); // 1
page.set(3);
prevPage.get(); // 2
```

Useful for transitions and animations where you need to know the direction of a change:

```tsx
render() {
  const direction = page.get() > (prevPage.get() ?? 0) ? 'forward' : 'back';
  return <div class={`slide slide--${direction}`}>{page.get()}</div>;
}
```

An optional second argument sets the value returned before any change has occurred:

```ts
const prevPage = computedPrevious(page, 0); // 0 instead of undefined
```

### `createStore`

Wrap a plain object in per-property signals exposed through a reactive Proxy. Read and write properties as if it were a plain object — every access and mutation goes through a signal automatically.

```ts
const store = createStore(
  { count: 0, theme: 'light' as 'light' | 'dark', user: null as User | null },
  (s) => ({
    isLoggedIn: computed(() => s.user !== null),
    label: computed(() => `Count is ${s.count}`),
  }),
);

store.count++;              // calls the underlying signal's set()
store.theme = 'dark';       // same
store.isLoggedIn;           // reads the computed signal
store.$signal('count');     // raw SignalState<number> for interop
store.$reset();             // reset all state keys to initial values
```

## Adapters

The adapter (signal backend) is selected by the import path — no runtime configuration needed.

| Import | Backend | Required peer dep |
|--------|---------|-------------------|
| `@kurtaqui/stencil-signals` | TC39 (`signal-polyfill`) | `signal-polyfill ^0.2.0` |
| `@kurtaqui/stencil-signals/tc39` | TC39 (explicit) | `signal-polyfill ^0.2.0` |
| `@kurtaqui/stencil-signals/preact` | Preact Signals | `@preact/signals-core ^1.0.0` |

All three paths export the same API surface — `signal`, `computed`, `batch`, `SignalWatcher`, `watchEffect`, `createStore`, etc.

> [!IMPORTANT]
> Pick one adapter per application. Mixing adapters in the same bundle is not supported.

## API Reference

### Primitives

| Export | Signature | Description |
|--------|-----------|-------------|
| `signal(value, options?)` | `<T>(value: T, options?: SignalOptions<T>) => SignalState<T>` | Writable signal. Accepts an optional `equals` function to skip identical updates. |
| `computed(fn, options?)` | `<T>(fn: () => T, options?: SignalOptions<T>) => SignalComputed<T>` | Read-only derived signal. Lazily recomputes when dependencies change. |
| `batch(fn)` | `<T>(fn: () => T) => T` | Batch multiple signal writes into one update cycle. |
| `Signal` | namespace | Low-level TC39 `Signal` namespace re-export (`Signal.subtle.untrack`, `Signal.subtle.Watcher`, etc.). |

### Component integration

| Export | Description |
|--------|-------------|
| `SignalWatcher(Base)` | Mixin factory. Wraps `render()` for automatic dependency tracking and re-rendering. |
| `@useSignal(sig)` | Property decorator. Proxies reads/writes to the given signal. |

### Effects

| Export | Description |
|--------|-------------|
| `watchEffect(fn)` | Auto-tracking effect. Re-runs whenever any signal accessed inside changes. Returns a dispose function. |
| `watchEffect(deps, fn, options?)` | Explicit-dep effect. `fn` receives signal values as a typed tuple. Supports `{ defer: true }` and `onCleanup`. |

### Derived signals

| Export | Description |
|--------|-------------|
| `computedAsync(fn, options?)` | Async derived signal with automatic cancellation. Returns `SignalComputed<AsyncResult<T>>`. |
| `computedPrevious(source, initialValue?)` | Signal holding the previous value of `source`. |
| `isPending(result)` | Type guard — narrows `AsyncResult<T>` to `{ status: 'pending' }`. |
| `isResolved(result)` | Type guard — narrows `AsyncResult<T>` to `{ status: 'resolved', value: T }`. |
| `isError(result)` | Type guard — narrows `AsyncResult<T>` to `{ status: 'error', error: unknown }`. |

### Store

| Export | Description |
|--------|-------------|
| `createStore(init, computedFactory?)` | Reactive Proxy over a plain object. Each property is backed by a signal. Includes `$signal(key)` and `$reset()` escape hatches. |

### Low-level

| Export | Description |
|--------|-------------|
| `createWatcher(notify)` | Low-level watcher. `notify` fires when any watched signal changes. Returns `{ watch(sig), unwatch(sig), dispose() }`. |
| `collectSignals(fn)` | Run `fn` in a tracking context and return the `Set` of accessed signals. Useful for debugging. |

## Development

```bash
npm run build        # compile TypeScript → dist/
npm run test         # run unit tests with Vitest
npm run test:watch   # run tests in watch mode
npm run typecheck    # type-check without emitting
npm run lint         # lint with Oxlint
npm run format       # format with Oxfmt
npm run demo         # start the Vite demo app
```
