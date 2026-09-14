/**
 * Minimal typings for the Keyboard API (`navigator.keyboard`), which is not
 * yet part of TypeScript's DOM lib. Only the surface we use is declared.
 * Spec: https://wicg.github.io/keyboard-map/
 */
interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}

interface Keyboard extends EventTarget {
  getLayoutMap(): Promise<KeyboardLayoutMap>;
}

interface Navigator {
  readonly keyboard?: Keyboard;
}
