import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher } from '@kurtaqui/stencil-signals';
import { LoggingMixin } from '../../mixins/logging-mixin';
import { count, step, doubled, prevCount } from '../../store';

@Component({ tag: 'mixin-demo', styleUrl: 'mixin-demo.css', shadow: true })
export class MixinDemo extends Mixin(SignalWatcher, LoggingMixin) {
	render() {
		const stats = this.getStats();
		const c = count.get();
		const s = step.get();
		const d = doubled.get();
		const prev = prevCount.get() ?? 0;
		const delta = c - prev;

		return (
			<div class="card">
				<p class="hint">
					<code>Mixin(SignalWatcher, LoggingMixin)</code>
					<span class="badge">v4.37+</span>
					{' — two mixins composed, LoggingMixin tracks every render'}
				</p>

				<div class="display">
					<span class="big">{c}</span>
					{delta !== 0 && (
						<span class={`delta ${delta > 0 ? 'up' : 'down'}`}>
							{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
						</span>
					)}
				</div>

				<div class="derived">
					<span class="chip">doubled: {d}</span>
					<span class="chip">prev: {prev}</span>
					<span class="chip">step: {s}</span>
				</div>

				<div class="row">
					<button class="btn minus" onClick={() => count.set(c - s)}>−{s}</button>
					<button class="btn reset" onClick={() => count.set(0)}>Reset</button>
					<button class="btn plus" onClick={() => count.set(c + s)}>+{s}</button>
				</div>

				<div class="stats">
					<div class="stats-title">LoggingMixin stats</div>
					<div class="stat-row">
						<span>renders: <strong>{stats.renders}</strong></span>
						<span>connected: <span class="connected">{stats.connectedAt !== null ? '✓' : '✗'}</span></span>
						<span>uptime: <strong>{(stats.totalConnectedMs / 1000).toFixed(1)}s</strong></span>
					</div>
					<p class="note">Stats update on every signal-driven re-render via the mixin chain.</p>
				</div>
			</div>
		);
	}
}
