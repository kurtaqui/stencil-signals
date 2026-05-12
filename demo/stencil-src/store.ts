import { signal, computed, computedPrevious } from '@kurtaqui/stencil-signals';

export const count = signal(0);
export const step = signal(1);
export const doubled = computed(() => count.get() * 2);
export const prevCount = computedPrevious(count);
