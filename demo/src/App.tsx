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

const destroyBtn: React.CSSProperties = {
	fontSize: '0.75rem',
	marginLeft: '0.75rem',
	padding: '0.15rem 0.5rem',
	cursor: 'pointer',
	verticalAlign: 'middle',
};

export function App() {
	const [explicitMounted, setExplicitMounted] = React.useState(true);
	const [asyncMounted, setAsyncMounted] = React.useState(true);
	const [previousMounted, setPreviousMounted] = React.useState(true);

	return (
		<div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '680px', margin: '2rem auto', padding: '0 1rem' }}>
			<h1>@kurtaqui/stencil-signals</h1>
			<p style={{ color: '#555' }}>TC39 Signals integration for StencilJS — React shell + real Stencil web components</p>

			<h2 style={h2Style}>signal() + computed() — <code>Mixin(SignalWatcher)</code> + <code>.get()</code></h2>
			<div style={card}><counter-demo /></div>

			<h2 style={h2Style}>watchEffect() — auto-tracking via <code>updateEffect()</code></h2>
			<div style={card}><watch-effect-demo /></div>

			<h2 style={h2Style}>
				watchEffect() — explicit deps
				<button style={destroyBtn} onClick={() => setExplicitMounted((m: boolean) => !m)}>
					{explicitMounted ? 'Destroy' : 'Remount'}
				</button>
			</h2>
			<div style={card}>{explicitMounted && <watch-explicit-demo />}</div>

			<h2 style={h2Style}>createStore() — reactive proxy</h2>
			<div style={card}><store-demo /></div>

			<h2 style={h2Style}>
				computedAsync() — async derived signal
				<button style={destroyBtn} onClick={() => setAsyncMounted((m: boolean) => !m)}>
					{asyncMounted ? 'Destroy' : 'Remount'}
				</button>
			</h2>
			<div style={card}>{asyncMounted && <async-demo />}</div>

			<h2 style={h2Style}>
				computedPrevious() — previous value tracking
				<button style={destroyBtn} onClick={() => setPreviousMounted((m: boolean) => !m)}>
					{previousMounted ? 'Destroy' : 'Remount'}
				</button>
			</h2>
			<div style={card}>{previousMounted && <previous-demo />}</div>

			<h2 style={h2Style}>Mixin(SignalWatcher, LoggingMixin) — two-mixin composition</h2>
			<div style={card}><mixin-demo /></div>
		</div>
	);
}
