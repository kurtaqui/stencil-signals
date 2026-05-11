// JSX type declarations for Stencil custom elements used in the React shell.
// React treats unknown element names as HTMLElement by default; these entries
// add explicit typings so TypeScript is happy with <counter-demo /> etc.

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'counter-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'watch-effect-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'watch-explicit-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'store-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'async-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'previous-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'mixin-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
