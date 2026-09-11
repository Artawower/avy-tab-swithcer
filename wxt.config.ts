import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Avy Tab Switcher',
    version: '0.1.0',
    description: 'Keyboard-driven tab switcher using jump labels.',
  },
});
