import React from 'react';

const card: React.CSSProperties = {
  background: '#f9f9f9',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem',
};

const h2Style: React.CSSProperties = {
  marginTop: '2rem',
  borderBottom: '1px solid #eee',
  paddingBottom: '0.4rem',
};

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '680px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1>@kurtaqui/stencil-signals</h1>
      <p style={{ color: '#555' }}>TC39 Signals integration for StencilJS — React shell + real Stencil web components</p>

      <h2 style={h2Style}>signal() + computed() — <code>Mixin(SignalWatcher)</code> + <code>.get()</code></h2>
      <div style={card}><counter-demo /></div>

      <h2 style={h2Style}>watchEffect() — auto-tracking via <code>updateEffect()</code></h2>
      <div style={card}><watch-effect-demo /></div>

      <h2 style={h2Style}>watchEffect() — explicit deps</h2>
      <div style={card}><watch-explicit-demo /></div>

      <h2 style={h2Style}>createStore() — reactive proxy</h2>
      <div style={card}><store-demo /></div>

      <h2 style={h2Style}>computedAsync() — async derived signal</h2>
      <div style={card}><async-demo /></div>

      <h2 style={h2Style}>computedPrevious() — previous value tracking</h2>
      <div style={card}><previous-demo /></div>

      <h2 style={h2Style}>Mixin(SignalWatcher, LoggingMixin) — two-mixin composition</h2>
      <div style={card}><mixin-demo /></div>
    </div>
  );
}
