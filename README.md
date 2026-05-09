# @kurtaqui/stencil-signals

> TC39 Signals Proposal integration for StencilJS — inspired by `@lit-labs/signals`

Auto-reactive StencilJS components powered by the [TC39 Signals Proposal](https://github.com/tc39/proposal-signals). Share observable state across any components without prop drilling, event buses, or manual subscription wiring.

```
npm install @kurtaqui/stencil-signals signal-polyfill
```

---

## Why signals + Stencil?

StencilJS is already reactive via `@State()` and `@Prop()` — but that reactivity is **push-based and local**. To share state between components you need stores, events, or context APIs.

TC39 Signals are **pull-based and global** by nature: any component that reads a signal during render automatically subscribes to it. This makes cross-component state trivially simple.

| Feature | `@State()` | `@kurtaqui/stencil-signals` |
|---|---|---|
| Triggers re-render | ✅ | ✅ |
| Shared across components | ❌ | ✅ |
| Computed/derived values | ❌ | ✅ |
| Side effects (auto-tracking) | ❌ | ✅ `watchEffect(fn)` |
| Side effects (explicit deps) | ❌ | ✅ `watchEffect(deps, fn)` |
| Async derived state | ❌ | ✅ `computedAsync` |
| Previous value tracking | ❌ | ✅ `computedPrevious` |
| Standard (TC39) | ❌ | ✅ |

---

## Quick start

```ts
// signals.ts — define shared state once
import { signal, computed } from '@kurtaqui/stencil-signals';

export const count   = signal(0);
export const doubled = computed(() => count.get() * 2);
```

```tsx
// my-counter.tsx — consume in any component
import { Component, h } from '@stencil/core';
import { SignalWatcher, useSignal } from '@kurtaqui/stencil-signals';
import { count, doubled } from './signals';

@Component({ tag: 'my-counter', shadow: true })
export class MyCounter extends SignalWatcher(class {}) {
  @useSignal(count) count!: number;   // this.count ↔ count signal

  render() {
    return (
      <button onClick={() => this.count++}>
        Clicks: {this.count} — doubled: {doubled.get()}
      </button>
    );
  }
}
```

Any other component reading `count` or `doubled` will also re-render when the value changes.

---

## API reference

### `signal<T>(initialValue, options?)`

Creates a writable `Signal.State<T>`.

```ts
const name = signal('world');
name.get();        // 'world'
name.set('Alice');
name.get();        // 'Alice'
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `equals` | `(a, b) => boolean` | Custom equality. Return `true` to skip notification. |

---

### `computed<T>(fn, options?)`

Creates a read-only derived `Signal.Computed<T>`. Lazily recomputes when any accessed signal changes.

```ts
const count    = signal(5);
const squared  = computed(() => count.get() ** 2);
squared.get(); // 25
```

---

### `SignalWatcher`

A **MixinFactory** that wraps `render()` to track every signal `.get()` call and schedule a re-render via `forceUpdate()` whenever any of those signals change.

`SignalWatcher` is typed as a proper `MixedInCtor`-compatible factory, so it works identically with **both** usage patterns — no separate export needed.

#### Pattern 1 — direct extension (Stencil < v4.37 or no other mixins)

```ts
@Component({ tag: 'my-comp', shadow: true })
export class MyComp extends SignalWatcher(class {}) {
  render() {
    return <p>{someSignal.get()}</p>;
  }
}
```

#### Pattern 2 — `Mixin()` composition (Stencil v4.37+)

Use this when composing `SignalWatcher` with other controller mixins via Stencil's official `Mixin()` helper. Put `SignalWatcher` first so it wraps the outermost `render()`.

```ts
import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher } from '@kurtaqui/stencil-signals';
import { LoggingMixin } from './logging-mixin';

@Component({ tag: 'my-comp', shadow: true })
export class MyComp extends Mixin(SignalWatcher, LoggingMixin) {
  componentDidLoad() {
    super.componentDidLoad(); // required when using Mixin()
  }

  render() {
    return <p>{someSignal.get()} — renders: {this.getStats().renders}</p>;
  }
}
```

Writing your own MixinFactory to compose alongside `SignalWatcher` follows the standard Stencil pattern:

```ts
import type { MixedInCtor } from '@stencil/core';

export function LoggingMixin<TBase extends MixedInCtor>(Base: TBase) {
  return class extends Base {
    private __renders = 0;

    render(): unknown {
      this.__renders++;
      return super.render?.();
    }

    getStats() {
      return { renders: this.__renders };
    }
  };
}
```

**How re-rendering works:**
- `connectedCallback` — marks the component as connected
- `disconnectedCallback` — disposes the watcher (no memory leaks)
- `render()` — wraps `super.render()` in a `Signal.Computed` to collect deps, arms a `Signal.subtle.Watcher` on those deps; rebuilt fresh each render so conditional branches are always correct

---

### `@useSignal(sig)`

A **property decorator** that binds a signal to a class property. Reading `this.prop` calls `sig.get()`; writing `this.prop = x` calls `sig.set(x)`.

```ts
const theme = signal<'light' | 'dark'>('light');

@Component({ tag: 'my-comp' })
export class MyComp extends SignalWatcher(class {}) {
  @useSignal(theme) theme!: 'light' | 'dark';

  render() {
    return (
      <button onClick={() => this.theme = this.theme === 'light' ? 'dark' : 'light'}>
        Toggle ({this.theme})
      </button>
    );
  }
}
```

> `@useSignal` works on both `Signal.State` and `Signal.Computed`. Assigning to a computed property throws a helpful error.

---

### `watchEffect(fn): CleanupFn` — auto-tracking

Runs `fn` immediately and re-runs whenever any signal accessed inside changes. Returns a cleanup function.

```ts
connectedCallback() {
  this._cleanup = watchEffect(() => {
    localStorage.setItem('count', String(count.get()));
  });
}

disconnectedCallback() {
  this._cleanup?.();
}
```

If `fn` returns a function, that function is called as cleanup before the next re-run.

---

### `watchEffect(deps, fn, options?): CleanupFn` — explicit deps

Only re-runs when the signals listed in `deps` change. The callback receives their current values as a typed tuple — no `.get()` calls needed inside `fn`. Signal reads *inside* `fn` that are not in `deps` are untracked, giving you precise control over what triggers the effect.

Mirrors ngxtension's `explicitEffect` and React's `useEffect` dependency array.

```ts
const userId = signal(1);
const theme  = signal('light');

connectedCallback() {
  this._cleanup = watchEffect(
    [userId, theme],
    ([id, currentTheme]) => {
      console.log(`User ${id} prefers ${currentTheme}`);
      return () => console.log('cleanup before next run');
    }
  );
}
```

**`onCleanup` inside the callback** — alternative to returning a cleanup function:

```ts
watchEffect([userId], ([id], onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  fetch(`/api/users/${id}`, { signal: controller.signal });
});
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `defer` | `boolean` | `false` | Skip the initial run; only execute on first change |

```ts
// Only runs when userId changes, not immediately on mount
watchEffect([userId], ([id]) => fetchUser(id), { defer: true });
```

**Choosing between the two signatures:**

| | Auto-tracking | Explicit deps |
|---|---|---|
| Dep declaration | Implicit (any `.get()` inside fn) | Explicit array |
| Risk of unexpected re-runs | Higher | None |
| Values passed to fn | No — use `.get()` manually | Yes, typed tuple |
| Best for | Simple reactive side-effects | Precise control, async work |

---

### `computedPrevious<T>(source, initialValue?)`

Returns a read-only signal that always holds the *previous* value of `source` — the value it held before the most recent change.

Before any change has occurred the value is `undefined`, or the `initialValue` you supply.

```ts
const count     = signal(0);
const prevCount = computedPrevious(count);

prevCount.get(); // undefined  (no change yet)
count.set(5);
prevCount.get(); // 0
count.set(10);
prevCount.get(); // 5
```

**With an explicit initial value:**

```ts
const prevCount = computedPrevious(count, -1);
prevCount.get(); // -1 before any change
```

**Common use-cases:**

```tsx
// Slide direction in a paginated view
const page     = signal(0);
const prevPage = computedPrevious(page, 0);

render() {
  const direction = page.get() > (prevPage.get() ?? 0) ? 'forward' : 'back';
  return <div class={`slide slide--${direction}`}>{page.get()}</div>;
}
```

Works with both `Signal.State` and `Signal.Computed` as the source.

---

### `computedAsync<T>(fn, options?)`

An async derived signal. `fn` receives an `AbortSignal` and returns a `Promise<T>` (or a plain `T` for synchronous fast-paths). The result is a `Signal.Computed<AsyncResult<T>>` holding a discriminated union:

```ts
{ status: 'pending',  value: T | undefined }
{ status: 'resolved', value: T }
{ status: 'error',    error: unknown, value: T | undefined }
```

`value` is always present so templates can safely show stale data during a reload.

```ts
const userId = signal(1);

const userResult = computedAsync(async (abortSignal) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<User>;
});
```

```tsx
render() {
  const result = userResult.get();

  if (result.status === 'pending')  return <p>Loading…</p>;
  if (result.status === 'error')    return <p>Error: {String(result.error)}</p>;
  return <UserCard user={result.value} />;
}
```

**Automatic cancellation** — when a tracked signal changes (e.g. `userId` above), the previous in-flight request is cancelled via `AbortSignal` before the new one starts. No stale responses, no race conditions.

**With an initial value** — avoid a blank loading state on first render:

```ts
const posts = computedAsync(
  async (sig) => fetchPosts(sig),
  { initialValue: [] as Post[] },
);
// posts.get().value is [] immediately while pending
```

**Sync fast-path** — return a plain value when you have it cached:

```ts
const result = computedAsync((sig) => {
  if (cache.has(id.get())) return cache.get(id.get())!;
  return fetch(`/api/${id.get()}`).then(r => r.json());
});
```

**Type guards** — narrow the union cleanly:

```ts
import { isPending, isResolved, isError } from '@kurtaqui/stencil-signals';

const r = userResult.get();
if (isResolved(r)) console.log(r.value);  // typed as T
if (isError(r))    console.error(r.error);
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `initialValue` | `T` | `undefined` | `result.value` before first resolution |
| `equal` | `(a, b) => boolean` | `Object.is` | Skip update if resolved value is unchanged |

**Cleanup** — call `.dispose()` in `disconnectedCallback()` to cancel any in-flight request and stop watching deps:

```ts
private _result = computedAsync(async (sig) => fetchUser(userId.get(), sig));

disconnectedCallback() {
  (this._result as any).dispose();
}
```

---

### `createStore<S>(initialState, computedFactory?)`

Wraps a plain object in signals and returns a **reactive Proxy**. Read and write properties as if it were a plain object; every access or mutation goes through a signal.

```ts
// store.ts
export const appStore = createStore(
  {
    user: null as User | null,
    theme: 'light' as 'light' | 'dark',
    count: 0,
  },
  (s) => ({
    isLoggedIn: computed(() => s.user !== null),
    doubleCount: computed(() => s.count * 2),
  }),
);

// From any component or module:
appStore.theme = 'dark';
appStore.count++;
appStore.isLoggedIn; // computed
```

**Special methods on the store:**

| Method | Description |
|---|---|
| `store.$signal(key)` | Returns the raw `Signal.State` for a key (for interop) |
| `store.$reset()` | Resets all state keys to their initial values |

---

### `Signal`

The raw TC39 `Signal` namespace, re-exported from `signal-polyfill`. Use for advanced cases like `Signal.subtle.Watcher`, `Signal.subtle.untrack`, etc.

```ts
import { Signal } from '@kurtaqui/stencil-signals';

const watcher = new Signal.subtle.Watcher(() => { ... });
```

---

## Comparison to `@lit-labs/signals` and ngxtension

| Feature | `@lit-labs/signals` | ngxtension | `@kurtaqui/stencil-signals` |
|---|---|---|---|
| `SignalWatcher` mixin | ✅ | ✅ | ✅ |
| Stencil `Mixin()` compatible | n/a | n/a | ✅ same export, both patterns |
| Property decorator | ❌ | ❌ | ✅ `@useSignal` |
| Auto-tracking effect | Planned | ✅ `effect()` | ✅ `watchEffect(fn)` |
| Explicit-deps effect | ❌ | ✅ `explicitEffect` | ✅ `watchEffect(deps, fn)` |
| Async derived signal | ❌ | ✅ `computedAsync` | ✅ `computedAsync` |
| Previous value | ❌ | ✅ `computedPrevious` | ✅ `computedPrevious` |
| Structured store | ❌ | ❌ | ✅ `createStore` |
| Template directive | ✅ `watch()` | — | — (Stencil uses JSX) |
| TC39 polyfill | ✅ | ✅ | ✅ |
| Framework | Lit | Angular | StencilJS |

---

## Project structure

```
@kurtaqui/stencil-signals/
├── src/
│   ├── signals/
│   │   └── core.ts              # signal(), computed(), createWatcher(), scheduler
│   ├── mixins/
│   │   └── signal-watcher.ts    # SignalWatcher — MixedInCtor-compatible MixinFactory
│   ├── directives/
│   │   └── use-signal.ts        # @useSignal property decorator
│   ├── utils/
│   │   ├── watch-effect.ts      # watchEffect() — auto-tracking + explicit deps
│   │   ├── computed-previous.ts # computedPrevious()
│   │   ├── computed-async.ts    # computedAsync() + type guards
│   │   └── create-store.ts      # createStore()
│   └── index.ts                 # Public API barrel
├── demo/
│   └── src/
│       ├── store.ts              # Shared demo signals
│       ├── mixins/
│       │   └── logging-mixin.ts  # Example MixinFactory to compose with SignalWatcher
│       └── components/
│           ├── counter-demo/    # Pattern 1: SignalWatcher(class {}) + @useSignal
│           ├── todo-demo/       # Signal arrays + watchEffect
│           ├── theme-demo/      # createStore + computedAsync
│           └── mixin-demo/      # Pattern 2: Mixin(SignalWatcher, LoggingMixin)
├── tests/
│   └── core.test.ts             # ~47 unit tests across all utilities
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## How re-rendering works

```
render() called by Stencil
  │
  └─► render() wrapped in Signal.Computed (dependency tracking)
         │
         ├─ any signal.get() inside render → recorded as dependency
         │
         └─► Signal.subtle.Watcher armed on all dependencies
                │
                when any dep changes:
                └─► scheduler.schedule(() => forceUpdate(this))
                       │
                       └─► Stencil re-renders → cycle repeats
```

Old watcher is disposed at the start of each render, new one built from fresh deps. This means conditionally accessed signals (e.g. inside an `if`) are correctly tracked each render.

---

## Limitations

- Requires `signal-polyfill` (TC39 proposal is not yet native in any browser)
- StencilJS compiler analyzes decorators statically; `SignalWatcher` intercepts `render()` at runtime (prototype wrapping), which is compatible but bypasses Stencil's static analysis for that method
- `@useSignal` on a `Signal.Computed` is read-only; writes throw a helpful error
- `watchEffect` re-runs are batched to the next microtask via `queueMicrotask` — not synchronous
- `computedAsync` dep tracking works by running `fn` once with a dummy `AbortController` to collect signal deps; if your `fn` has side effects on the first call (e.g. writing to a DB), guard them with `abortSignal.aborted`
- `computedAsync` returns a `Signal.Computed` with a `.dispose()` method attached at runtime — TypeScript requires a cast (`as any`) to call it unless you widen the type yourself

---

## License

MIT
