import { useSyncExternalStore } from 'react';
import { watchEffect } from '../lib';

export function useSignalValue<T>(sig: { (): T }): T {
	return useSyncExternalStore(
		(notify) => {
			let mounted = false;
			const stop = watchEffect(() => {
				sig();
				if (mounted) notify();
			});
			mounted = true;
			return stop;
		},
		() => sig(),
		() => sig(),
	);
}
