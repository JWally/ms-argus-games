import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

const qualityRules = {
  'sonarjs/cognitive-complexity': ['warn', 20],
  'sonarjs/no-duplicate-string': 'warn',
  'sonarjs/no-identical-functions': 'warn',
  'unicorn/no-static-only-class': 'error',
  'unicorn/no-useless-undefined': 'error',
  'unicorn/no-unnecessary-await': 'error',
  'unicorn/no-useless-spread': 'error',
  'unicorn/no-useless-promise-resolve-reject': 'error',
  'unicorn/no-empty-file': 'error',
  'unicorn/no-useless-fallback-in-spread': 'error',
  'unicorn/no-lonely-if': 'error',
  'unicorn/no-array-for-each': 'warn',
  'unicorn/prefer-array-some': 'error',
  'unicorn/no-array-push-push': 'error',
  'import-x/no-duplicates': 'error',
  'import-x/no-cycle': ['warn', { maxDepth: 3 }],
  'import-x/order': [
    'warn',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'never',
    },
  ],
  complexity: ['warn', 25],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
};

export default [
  js.configs.recommended,
  prettier,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'cdk.out/',
      '*.js',
      '*.cjs',
      '*.min.js',
      // Standalone Node.js tool scripts (not shipped with the app) —
      // exercise-only; they intentionally use `process` and `console`.
      'scripts/',
    ],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        MouseEvent: 'readonly',
        TouchEvent: 'readonly',
        KeyboardEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        performance: 'readonly',
        ArgusBio: 'readonly',
        URLSearchParams: 'readonly',
        MessageEvent: 'readonly',
        HTMLIFrameElement: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        location: 'readonly',
        indexedDB: 'readonly',
        caches: 'readonly',
        Response: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      sonarjs,
      unicorn,
      'import-x': importX,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      ...qualityRules,
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  // CDK / Node files
  {
    files: ['cdk/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      sonarjs,
      unicorn,
      'import-x': importX,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      ...qualityRules,
    },
  },
];
