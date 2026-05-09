import React from 'react';
import { createRoot } from 'react-dom/client';
// Side-effect imports: register Stencil custom elements before React mounts.
// These files are pre-built by `stencil build` into demo/stencil-dist/.
import '../stencil-dist/counter-demo.js';
import '../stencil-dist/controller-demo.js';
import '../stencil-dist/watch-effect-demo.js';
import '../stencil-dist/watch-explicit-demo.js';
import '../stencil-dist/store-demo.js';
import '../stencil-dist/async-demo.js';
import '../stencil-dist/previous-demo.js';
import '../stencil-dist/mixin-demo.js';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
