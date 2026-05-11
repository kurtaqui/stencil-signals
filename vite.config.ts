import { defineConfig } from 'vite';

// The demo uses @useSignal (legacy TS property decorators) which define getters on
// the class prototype. With ES2022's useDefineForClassFields:true, the class field
// initializer in the constructor creates an own property that shadows the prototype
// getter. Setting target to ES2019 (where useDefineForClassFields defaults to false)
// prevents the constructor from emitting the shadowing own-property define.
export default defineConfig({
  esbuild: {
    target: 'ES2019',
  },
});
