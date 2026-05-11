import { _setAdapter } from '../../src/adapters/active';
import { tc39Adapter } from '../../src/adapters/tc39';
_setAdapter(tc39Adapter);

export { signal, computed, batch } from '../../src/signals/core';
export { watchEffect } from '../../src/utils/watch-effect';
export { createStore } from '../../src/utils/create-store';
export { computedPrevious } from '../../src/utils/computed-previous';
export { computedAsync, isPending, isResolved, isError } from '../../src/utils/computed-async';
export type { SignalState, SignalComputed } from '../../src/adapters/types';
export type { AsyncResult } from '../../src/utils/computed-async';
