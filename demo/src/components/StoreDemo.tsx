import React, { useEffect, useState } from 'react';
import { createStore, watchEffect } from '../lib';

const cart = createStore({ price: 10, qty: 1 });

function useStore<T extends object>(store: T): T {
  const [, setTick] = useState(0);
  useEffect(() => {
    let mounted = false;
    const stop = watchEffect(() => {
      for (const key of Object.keys(store as object)) {
        (store as Record<string, unknown>)[key];
      }
      if (mounted) setTick((n) => n + 1);
    });
    mounted = true;
    return stop;
  }, [store]);
  return store;
}

export function StoreDemo() {
  useStore(cart);
  const total = cart.price * cart.qty;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <label>price:</label>
        <input
          type="number"
          value={cart.price}
          onChange={(e) => { cart.price = +e.target.value; }}
          style={{ width: '80px', padding: '0.2rem 0.4rem' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <label>qty:</label>
        <input
          type="number"
          value={cart.qty}
          onChange={(e) => { cart.qty = +e.target.value; }}
          style={{ width: '80px', padding: '0.2rem 0.4rem' }}
        />
      </div>
      <div>
        total: <strong>{total}</strong>
      </div>
    </div>
  );
}
