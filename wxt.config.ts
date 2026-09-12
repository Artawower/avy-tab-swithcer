import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-vue'],
  zip: {
    excludeSources: [
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      '.vitest/**',
      '.cache/**',
      '.playwright-profile/**',
      'user-data-dir/**',
    ],
  },
  manifest: ({ browser }) => ({
    name: 'Avy Tab Switcher',
    description: 'Keyboard-driven tab switcher using jump labels.',
    permissions: ['tabs', 'activeTab', 'scripting'],
    web_accessible_resources: [
      {
        resources: ['frame.html'],
        matches: ['<all_urls>'],
      },
    ],
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
