import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'signals-demo',
  srcDir: 'stencil-src',
  tsconfig: 'tsconfig.stencil.json',
  hashFileNames: false,
  outputTargets: [
    {
      type: 'dist-custom-elements',
      dir: 'stencil-dist',
      customElementsExportBehavior: 'auto-define-custom-elements',
    },
  ],
};
