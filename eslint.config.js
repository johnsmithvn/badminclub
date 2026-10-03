import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // components/ds/index.js là file SINH RA từ handoff (compiled JSX) — không lint, không sửa tay.
  { ignores: ['dist', 'src/components/ds/index.js'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Luật này chỉ báo "compiler không giữ được memo thủ công" — có nghĩa khi BẬT React Compiler
      // lúc build. Repo không bật (vite.config.js không có babel-plugin-react-compiler) nên chỉ cảnh báo.
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Barrel primitive và context: cố ý export cả component lẫn helper, HMR granularity không đáng đánh đổi.
    files: ['src/components/ui/index.jsx', 'src/contexts/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]
