import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Safari 15 (iOS 15 / iPhone 7) không hỗ trợ Import Attributes (`with { type: 'json' }`),
 * cú pháp này chỉ có từ Safari 17.2+.
 * Plugin này strip bỏ `with { type: "json" }` khi Vite serve / build để Safari 15 hiểu được,
 * trong khi `npm test` (Node.js) vẫn đọc trực tiếp file gốc trên ổ đĩa.
 */
function stripJsonImportAttributes() {
  return {
    name: 'strip-json-import-attributes',
    enforce: 'pre',
    transform(code) {
      if (!code) return null
      if (code.includes("with { type: 'json' }") || code.includes('with { type: "json" }')) {
        return {
          code: code.replace(/\s+with\s*\{\s*type:\s*['"]json['"]\s*\}/g, ''),
          map: null,
        }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [stripJsonImportAttributes(), react()],
  esbuild: {
    target: 'es2020',
  },
  build: {
    target: 'es2020',
  },
})

