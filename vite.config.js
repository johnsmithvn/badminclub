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

/**
 * Trang Cờ tướng với máy (/tro-choi/may-cotuong) cần "cách ly" (COOP + COEP) để engine Fairy-Stockfish chạy đa luồng
 * (SharedArrayBuffer) — chỉ bật cho đúng trang đó, các trang khác (nhúng video…) không bị ảnh hưởng.
 * Bản chạy thật: cùng header ở vercel.json. Xem src/lib/games/bots/engine.js.
 */
function isolateEnginePage() {
  // Thân hàm có ngoặc nhọn, KHÔNG trả về gì: Vite coi giá trị trả về của configureServer là hàm chạy sau, mà
  // `middlewares.use()` trả về chính app connect → Vite gọi nó không tham số và dev server sập lúc khởi động.
  const use = (server) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/tro-choi/may-cotuong')) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
      }
      // Trang cách ly chỉ được tạo Worker khi chính file Worker cũng mang COEP — thiếu là trình duyệt chặn và máy
      // chơi cờ (bots/worker.js) lẫn các luồng của engine không chạy. Header này trên file script vô hại với trang khác.
      if (req.headers['sec-fetch-dest'] === 'worker' || req.url?.startsWith('/engines/')) {
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
      }
      next()
    })
  }
  return { name: 'isolate-engine-page', configureServer: use, configurePreviewServer: use }
}

export default defineConfig({
  plugins: [stripJsonImportAttributes(), isolateEnginePage(), react()],
  esbuild: {
    target: 'es2020',
  },
  build: {
    target: 'es2020',
  },
})

