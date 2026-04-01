/**
 * ESLint v9 Flat Config
 * @see https://eslint.org/docs/latest/use/migrate-to-9.0.0
 */
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // 注意: 禁用 stylistic-type-checked 因为原来 .eslintrc.js 声明了但依赖没装全从未生效
  // 如果需要严格样式检查，可以单独启用需要的规则

  // 项目配置
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 关闭一些不必要的规则
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // 忽略模式
  {
    ignores: ['dist/', 'node_modules/', '*.js', 'dist/**/*.js'],
  }
);
