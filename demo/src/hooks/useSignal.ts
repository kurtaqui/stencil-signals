import { useSyncExternalStore } from 'react';
import { effect } from '../lib';

export function useSignalValue<T>(sig: { (): T }): T {
	return useSyncExternalStore(
		(notify) => {
			let mounted = false;
			const stop = effect(() => {
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
