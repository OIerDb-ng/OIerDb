import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  { ignores: ['**/dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    jsx: true,
  }),
  {
    rules: {
      'no-constant-binary-expression': 'warn',
      // Match Prettier: keep `else` on the `} else {` line (1TBS), not on a new line.
      '@stylistic/brace-style': ['error', '1tbs'],
      // Match Prettier: don't wrap multiline JSX passed as a prop in extra parens.
      '@stylistic/jsx-wrap-multilines': 'off',
      // Match Prettier: allow multiple JSX children on one line (e.g. `{a} {b}`).
      '@stylistic/jsx-one-expression-per-line': 'off',
      // Match Prettier: align closing tags to the opening tag's line (accepts
      // inline-opened fragments like `{cond && <>...</>}`).
      '@stylistic/jsx-closing-tag-location': ['error', 'line-aligned'],
      // No trailing comma after the last argument/parameter in multi-line
      // function calls and definitions; keep it elsewhere (arrays, objects,
      // imports, exports, TS enums/generics/tuples).
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
          enums: 'always-multiline',
          generics: 'always-multiline',
          tuples: 'always-multiline',
        },
      ],
      '@stylistic/max-len': [
        'warn',
        {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
        },
      ],
    },
  },
);
