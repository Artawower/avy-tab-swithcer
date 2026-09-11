import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-vue'],
  manifest: ({ browser }) => ({
    name: 'Avy Tab Switcher',
    version: '0.1.0',
    description: 'Keyboard-driven tab switcher using jump labels.',
    permissions: ['tabs', 'activeTab', 'scripting'],
    commands: {
      'open-switcher': {
        description: 'Open the tab switcher',
        suggested_key: {
          default: 'Alt+Q',
        },
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: '{7d8f4387-6d71-4d69-a413-1cf5bc86c573}',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
