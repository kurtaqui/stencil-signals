/**
 * demo/src/store.ts
 *
 * Shared signals used across all demo components.
 */

import { signal, computed } from '../../src/index';

export const count   = signal(0);
export const step    = signal(1);
export const doubled = computed(() => count.get() * 2);
