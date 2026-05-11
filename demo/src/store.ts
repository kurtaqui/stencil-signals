import { signal, computed, computedPrevious } from './lib';

export const count = signal(0);
export const step = signal(1);
export const doubled = computed(() => count.get() * 2);
export const prevCount = computedPrevious(count, 0);
