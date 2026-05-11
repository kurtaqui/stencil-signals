import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher, createStore } from '@kurtaqui/stencil-signals/tc39';

const cart = createStore({ price: 10, qty: 1 });

@Component({ tag: 'store-demo', shadow: false })
export class StoreDemo extends Mixin(SignalWatcher) {
  render() {
    const total = cart.price * cart.qty;
    return (
      <div>
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', alignItems: 'baseline' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${total.toFixed(2)}</span>
          <span style={{ color: '#555', fontSize: '0.9em' }}>
            ${cart.price.toFixed(2)} × {cart.qty}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.9em' }}>
            Price:{' '}
            <input
              type="number"
              value={cart.price}
              min={0}
              step={0.5}
              style={{ width: '5rem', marginLeft: '0.3rem' }}
              onInput={(e) => { cart.price = Number((e.target as HTMLInputElement).value); }}
            />
          </label>
          <label style={{ fontSize: '0.9em' }}>
            Qty:{' '}
            <input
              type="number"
              value={cart.qty}
              min={1}
              style={{ width: '4rem', marginLeft: '0.3rem' }}
              onInput={(e) => { cart.qty = Number((e.target as HTMLInputElement).value); }}
            />
          </label>
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8em', color: '#888' }}>
          Reactive proxy — reads inside render() are tracked automatically
        </p>
      </div>
    );
  }
}
