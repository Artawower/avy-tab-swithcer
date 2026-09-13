declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  // Loose props keep non-Volar TypeScript servers (e.g. plain tsserver used by
  // editor tooling) usable for test files; vue-tsc resolves real SFC prop types
  // and ignores this shim, so the canonical typecheck stays strict.
  const component: DefineComponent<Record<string, unknown>>;
  export default component;
}
