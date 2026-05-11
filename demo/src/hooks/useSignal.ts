import { useSyncExternalStore } from 'react';
import { watchEffect } from '../lib';

export function useSignalValue<T>(sig: { get(): T }): T {
  return useSyncExternalStore(
    (notify) => {
      let mounted = false;
      const stop = watchEffect(() => {
        sig.get();
        if (mounted) notify();
      });
      mounted = true;
      return stop;
    },
    () => sig.get(),
    () => sig.get(),
  );
}
