import React from 'react';
import { CounterDemo } from './components/CounterDemo';
import { WatchEffectDemo } from './components/WatchEffectDemo';
import { WatchExplicitDemo } from './components/WatchExplicitDemo';
import { StoreDemo } from './components/StoreDemo';
import { AsyncDemo } from './components/AsyncDemo';
import { PreviousDemo } from './components/PreviousDemo';

const card: React.CSSProperties = {
  background: '#f9f9f9',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem',
};

const h2: React.CSSProperties = {
  marginTop: '2rem',
  borderBottom: '1px solid #eee',
  paddingBottom: '0.4rem',
};

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '640px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1>@kurtaqui/stencil-signals</h1>
      <p>TC39 Signals integration for StencilJS — live React demo</p>

      <h2 style={h2}>signal() + computed() — <code>useSignalValue</code></h2>
      <div style={card}><CounterDemo /></div>

      <h2 style={h2}>watchEffect() — auto-tracking</h2>
      <div style={card}><WatchEffectDemo /></div>

      <h2 style={h2}>watchEffect() — explicit deps</h2>
      <div style={card}><WatchExplicitDemo /></div>

      <h2 style={h2}>createStore()</h2>
      <div style={card}><StoreDemo /></div>

      <h2 style={h2}>computedAsync()</h2>
      <div style={card}><AsyncDemo /></div>

      <h2 style={h2}>computedPrevious()</h2>
      <div style={card}><PreviousDemo /></div>
    </div>
  );
}
