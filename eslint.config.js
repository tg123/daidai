// Flat ESLint config for the DaiDai codebase.
// Goals: catch real bugs (unused vars, accidental globals, equality, etc.)
// without nitpicking style. Format/whitespace is intentionally not enforced.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'gh-pages/**', 'public/**', 'src-tauri/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                DAIDAI: 'writable',
            },
        },
        rules: {
            // Real-bug rules — keep on
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': ['warn', { destructuring: 'all' }],
            'no-throw-literal': 'error',

            // Pragmatic relaxations — this is a game with a lot of legitimate any/_/console
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/ban-ts-comment': [
                'warn',
                {
                    'ts-ignore': 'allow-with-description',
                    'ts-expect-error': 'allow-with-description',
                },
            ],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-prototype-builtins': 'off',
            'no-cond-assign': ['error', 'except-parens'],
            'no-inner-declarations': 'off',
        },
    },
    {
        files: ['tests/e2e/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        files: ['tests/unit/**/*.{js,ts}'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
    },
    {
        files: ['vite.config.js', 'eslint.config.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    // Must come last: disables every ESLint stylistic rule that would
    // fight with Prettier (we own formatting via `npm run format`).
    prettier,
];
