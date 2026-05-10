/**
 * demo/main.ts — browser smoke-test for @kurtaqui/stencil-signals primitives.
 * Runs entirely in-browser via Vite, no Stencil compiler needed.
 */

import { signal, computed, watchEffect, computedPrevious, computedAsync } from '../src/index';
import { createStore } from '../src/utils/create-store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function card(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function row(label: string, valueEl: HTMLElement, ...buttons: HTMLButtonElement[]): HTMLElement {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;';
  const lbl = document.createElement('span');
  lbl.style.minWidth = '120px';
  lbl.textContent = label;
  div.append(lbl, valueEl, ...buttons);
  return div;
}

function val(text: string): HTMLElement {
  const span = document.createElement('code');
  span.textContent = text;
  return span;
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function log(parent: HTMLElement, text: string) {
  const p = document.createElement('p');
  p.className = 'log';
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  parent.appendChild(p);
  // keep last 5
  const logs = parent.querySelectorAll('.log');
  if (logs.length > 5) logs[0].remove();
}

// ─── signal() + computed() ───────────────────────────────────────────────────
{
  const c = card('demo-signal');
  const count = signal(0);
  const doubled = computed(() => count.get() * 2);

  const countEl = val(String(count.get()));
  const doubledEl = val(String(doubled.get()));

  const refresh = () => {
    countEl.textContent = String(count.get());
    doubledEl.textContent = String(doubled.get());
  };

  c.appendChild(
    row(
      'count:',
      countEl,
      btn('−', () => {
        count.set(count.get() - 1);
        refresh();
      }),
      btn('+', () => {
        count.set(count.get() + 1);
        refresh();
      }),
    ),
  );
  c.appendChild(row('doubled:', doubledEl));

  const note = document.createElement('p');
  note.className = 'log';
  note.textContent =
    'Values update on button click (no reactive binding here — that requires SignalWatcher in a Stencil component).';
  c.appendChild(note);
}

// ─── watchEffect() — auto-tracking ───────────────────────────────────────────
{
  const c = card('demo-watch-auto');
  const name = signal('world');
  const inputEl = document.createElement('input');
  inputEl.value = name.get();
  inputEl.style.cssText =
    'padding:.3rem;border-radius:4px;border:1px solid #ccc;margin-right:.5rem;';
  inputEl.oninput = () => name.set(inputEl.value);

  const outEl = val('');

  const cleanup = watchEffect(() => {
    outEl.textContent = `Hello, ${name.get()}!`;
  });

  const r = row('name:', inputEl);
  const r2 = row(
    'effect output:',
    outEl,
    btn('dispose', () => {
      cleanup();
      log(c, 'disposed — effect no longer fires');
    }),
  );
  c.append(r, r2);
  log(c, 'watchEffect armed — type in the input above');
}

// ─── watchEffect() — explicit deps ───────────────────────────────────────────
{
  const c = card('demo-watch-explicit');
  const a = signal(1);
  const b = signal(10);

  const aEl = val(String(a.get()));
  const bEl = val(String(b.get()));
  const sumEl = val('');

  const cleanup = watchEffect([a, b], ([av, bv]) => {
    sumEl.textContent = `${av} + ${bv} = ${(av as number) + (bv as number)}`;
    log(c, `effect ran: a=${av} b=${bv}`);
  });

  c.append(
    row(
      'a:',
      aEl,
      btn('a++', () => {
        a.set(a.get() + 1);
        aEl.textContent = String(a.get());
      }),
    ),
    row(
      'b:',
      bEl,
      btn('b+=10', () => {
        b.set(b.get() + 10);
        bEl.textContent = String(b.get());
      }),
    ),
    row(
      'sum:',
      sumEl,
      btn('dispose', () => {
        cleanup();
        log(c, 'disposed');
      }),
    ),
  );
}

// ─── createStore() ────────────────────────────────────────────────────────────
{
  const c = card('demo-store');
  const store = createStore({ price: 10, qty: 3 }, (s) => ({
    total: computed(() => s.price * s.qty),
  }));

  const priceEl = val(String(store.price));
  const qtyEl = val(String(store.qty));
  const totalEl = val(String(store.total));

  const refresh = () => {
    priceEl.textContent = String(store.price);
    qtyEl.textContent = String(store.qty);
    totalEl.textContent = String(store.total);
  };

  c.append(
    row(
      'price:',
      priceEl,
      btn('price++', () => {
        store.price++;
        refresh();
      }),
    ),
    row(
      'qty:',
      qtyEl,
      btn('qty++', () => {
        store.qty++;
        refresh();
      }),
    ),
    row(
      'total:',
      totalEl,
      btn('reset', () => {
        store.$reset();
        refresh();
      }),
    ),
  );
}

// ─── computedAsync() ─────────────────────────────────────────────────────────
{
  const c = card('demo-async');
  const userId = signal(1);

  const user = computedAsync(
    async (abort) => {
      const id = userId.get();
      // Fake fetch — returns after 300 ms
      await new Promise<void>((res, rej) => {
        const t = setTimeout(res, 300);
        abort.addEventListener('abort', () => {
          clearTimeout(t);
          rej(new DOMException('aborted', 'AbortError'));
        });
      });
      if (abort.aborted) return null;
      return { id, name: `User #${id}` };
    },
    { initialValue: null },
  );

  const statusEl = val('');
  const valueEl = val('');

  const refresh = () => {
    const r = user.get();
    statusEl.textContent = r.status;
    valueEl.textContent = r.status === 'resolved' ? JSON.stringify(r.value) : '…';
  };

  // Poll for updates (would normally be done by SignalWatcher in a component)
  const poll = setInterval(refresh, 100);
  refresh();

  const idEl = val(String(userId.get()));
  c.append(
    row(
      'userId:',
      idEl,
      btn('next user', () => {
        userId.set(userId.get() + 1);
        idEl.textContent = String(userId.get());
        log(c, `fetching user ${userId.get()}…`);
      }),
    ),
    row('status:', statusEl),
    row('value:', valueEl),
  );

  log(c, 'polling every 100 ms to show status transitions');
}

// ─── computedPrevious() ──────────────────────────────────────────────────────
{
  const c = card('demo-prev');
  const page = signal(0);
  const prevPage = computedPrevious(page, -1);

  const curEl = val(String(page.get()));
  const prevEl = val(String(prevPage.get()));

  const refresh = () => {
    curEl.textContent = String(page.get());
    prevEl.textContent = String(prevPage.get() ?? 'undefined');
  };

  // computedPrevious updates via microtask — use a small delay for the UI
  const nav = async (delta: number) => {
    page.set(page.get() + delta);
    await new Promise((r) => setTimeout(r, 10));
    refresh();
  };

  c.append(
    row(
      'current page:',
      curEl,
      btn('← back', () => nav(-1)),
      btn('next →', () => nav(1)),
    ),
    row('previous page:', prevEl),
  );
}
