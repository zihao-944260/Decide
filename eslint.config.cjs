const vuePlugin = require('eslint-plugin-vue')
const vueParser = require('vue-eslint-parser')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = [
  // Vue SFC 文件
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: { vue: vuePlugin, '@typescript-eslint': tsPlugin },
    rules: {
      ...vuePlugin.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // TypeScript / JavaScript 文件
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // 排除构建产物和云函数
  {
    ignores: [
      'dist/**',
      'dist-cloud/**',
      'unpackage/**',
      'cloudfunctions/**',
      'node_modules/**',
      '*.js.map',
    ],
  },
  // 关闭与 Prettier 冲突的规则
  eslintConfigPrettier,
]
