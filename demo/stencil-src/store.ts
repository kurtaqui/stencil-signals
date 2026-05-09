import { signal, computed } from '@kurtaqui/stencil-signals';
import { computedPrevious } from '@kurtaqui/stencil-signals/extensions';

export const count = signal(0);
export const step = signal(1);
export const doubled = computed(() => count.get() * 2);
export const prevCount = computedPrevious(count);
