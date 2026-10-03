// Cửa vào app.json cho component và hook — import `#config/app.js`, KHÔNG import thẳng `.json`.
//
// Vì sao có file này: Node (`npm test`) bắt buộc `with { type: 'json' }` khi import JSON, mà luật
// React Compiler của eslint-plugin-react-hooks gặp cú pháp đó là IM LẶNG bỏ qua cả file — lỗi hook
// trong component bị giấu hết. Gom cú pháp đó về đây (không có component nào) thì lint đọc được
// mọi component. Gác bởi smoke/json_import.test.js. Vite tự bỏ thuộc tính khi build (vite.config.js).
import cfg from './app.json' with { type: 'json' }

export default cfg
