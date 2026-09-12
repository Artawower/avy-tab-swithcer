import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      'node_modules/**',
      '.wxt/**',
      '.output/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/.playwright-profile/**',
      '**/user-data-dir/**',
      '**/*.log',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...vuePlugin.configs['flat/recommended'],
  vuePlugin.configs['no-layout-rules'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: ['Switcher'],
        },
      ],
    },
  },
  {
    files: ['src/**/*', 'entrypoints/**/*'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      complexity: ['error', 10],
    },
  },
  {
    files: ['*.config.{js,ts,mjs}', 'e2e/server.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['e2e/**/*', 'tests/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['e2e/**/*'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
