/**
 * demo/src/components/mixin-demo/mixin-demo.tsx
 *
 * Demonstrates Stencil v4.37+ Mixin() composition:
 *
 *   Mixin(SignalWatcher, LoggingMixin)
 *
 * Both mixins wrap render() and the lifecycle callbacks — Stencil's Mixin()
 * helper chains them correctly so neither steps on the other.
 *
 *  - SignalWatcher  → auto-subscribes to TC39 signals accessed in render()
 *  - LoggingMixin   → counts renders, tracks connected time, exposes getStats()
 *
 * The component itself stays clean: no manual subscriptions, no lifecycle
 * boilerplate, just signals and JSX.
 *
 * Compare with counter-demo which uses the legacy SignalWatcher(class {}) form.
 * The rendered output is identical — only the composition mechanism differs.
 */

import { Component, Mixin, h } from '@stencil/core';
import { SignalWatcher } from '../../../../src/index';
import { LoggingMixin } from '../../mixins/logging-mixin';
import { count, step, doubled } from '../../store';
import { computedPrevious } from '../../../../src/index';

// Derived signals local to this component
const prevCount = computedPrevious(count, 0);

@Component({
  tag: 'mixin-demo',
  styleUrl: 'mixin-demo.css',
  shadow: true,
})
export class MixinDemo extends Mixin(SignalWatcher, LoggingMixin) {
  /**
   * Stencil requires super.componentDidLoad() when using Mixin().
   * This is the only extra line compared to the legacy pattern.
   */
  componentDidLoad() {
    super.componentDidLoad?.();
  }

  render() {
    const stats = this.getStats(); // from LoggingMixin
    const current = count.get(); // tracked by SignalWatcher
    const prev = prevCount.get() ?? 0; // also tracked
    const delta = current - prev;
    const direction = delta > 0 ? '↑' : delta < 0 ? '↓' : '—';

    return (
      <div class="card">
        <h2>
          Mixin composition
          <span class="badge">v4.37+</span>
        </h2>
        <p class="hint">
          <code>Mixin(SignalWatcher, LoggingMixin)</code>
        </p>

        {/* Signal-reactive display */}
        <div class="display">
          <span class="big">{current}</span>
          <span class={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
            {direction} {delta !== 0 ? Math.abs(delta) : ''}
          </span>
        </div>

        <div class="row">
          <button class="btn minus" onClick={() => count.set(count.get() - step.get())}>
            −
          </button>
          <button class="btn reset" onClick={() => count.set(0)}>
            Reset
          </button>
          <button class="btn plus" onClick={() => count.set(count.get() + step.get())}>
            +
          </button>
        </div>

        <div class="derived">
          <div class="chip">
            previous: <strong>{prev}</strong>
          </div>
          <div class="chip">
            doubled: <strong>{doubled.get()}</strong>
          </div>
        </div>

        {/* LoggingMixin stats */}
        <div class="stats">
          <p class="stats-title">LoggingMixin stats</p>
          <div class="stat-row">
            <span>Render count</span>
            <strong>{stats.renders}</strong>
          </div>
          <div class="stat-row">
            <span>Status</span>
            <strong class="connected">
              {stats.connectedAt !== null ? 'connected' : 'disconnected'}
            </strong>
          </div>
        </div>

        <p class="note">
          Both mixins wrap <code>render()</code> and lifecycle callbacks. Open DevTools console to
          see LoggingMixin output.
        </p>
      </div>
    );
  }
}
