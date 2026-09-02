# RULES.md — Quản lý CLB cầu lông

**Version:** v6.6.0 · **Updated:** 2026-09-02

Quy tắc hiện hành cho human developer và coding agent. `CLAUDE.md` là entrypoint ngắn; file này là
policy chi tiết. Lịch sử rule cũ nằm trong git/CHANGELOG, không lặp ở đây.

## 1. Sự thật trước giả định

Trước khi sửa:

1. Kiểm tra file/caller/schema thật đang tồn tại.
2. Đọc flow từ UI → data owner → Supabase/API → state trở lại.
3. Phân biệt rõ:
   - **Verified:** đọc trực tiếp từ source/log/test.
   - **Assumption:** giả định cần xác nhận.
   - **Proposed:** thay đổi chưa triển khai.
4. Không tuyên bố production/deploy/database đã thay đổi nếu không có bằng chứng từ chính môi trường đó.

Nếu thiếu quyết định làm đổi phạm vi hoặc có nguy cơ mất dữ liệu, dừng và hỏi. Không dùng `TODO` để che
một blocker mà user phải quyết định.

## 2. Scope và workflow

- Chỉ sửa file liên quan đến yêu cầu; giữ nguyên thay đổi đang có của user.
- Không chạm `node_modules`, `dist`, `.git` hoặc secret.
- Không đọc/sửa `.env.local`; chỉ dùng `.env.local.example` để biết tên biến.
- Không refactor/rename/move file ngoài phạm vi.
- Ưu tiên xóa code/tài liệu dư, dùng helper/pattern có sẵn và giải pháp native trước dependency mới.
- Task đụng hơn năm file, kiến trúc hoặc schema phải có plan và user duyệt trước khi triển khai.
- Không stage, commit, push, deploy hoặc mở PR nếu user chưa yêu cầu.

## 3. Không hard-code chữ và dữ liệu

> **Luật cứng.** Mọi chữ người dùng đọc được và mọi hằng số nghiệp vụ phải nằm ở một nơi quản lý
> tập trung, không nằm rải rác trong code.

### 3.1 Chữ → `src/i18n/<locale>.json`

- **Cấm** viết chuỗi tiếng Việt trực tiếp trong `.jsx` / `.js`. Dùng `t('key')` từ `#i18n`.
- Chèn biến bằng `{{ten}}`: `t('toast.matchSaved', { n: 4, min: 22 })`.
- Key đặt theo **vùng chức năng**, không theo chỗ nó xuất hiện:
  `common.*` `units.*` `nav.*` `pages.*` `roles.*` `toast.*` `ledger.*` `assign.*` `home.*` …
- Thiếu key thì `t()` trả về chính key và `console.warn` ở DEV — **không** im lặng trả rỗng.
- Thêm ngôn ngữ: tạo `src/i18n/en.json` cùng bộ key, thêm vào `LOCALES` trong `src/i18n/index.js`.
  Không cần sửa màn hình nào.
- Ngoại lệ duy nhất được viết chữ trực tiếp: comment trong code, `console.warn`, và message của
  `throw new Error` dành cho developer.

### 3.2 Hằng số và cấu hình → `src/config/*.json`

- Số nghiệp vụ (`quotaMin`, `defaultMinutes`, `roundTo`, `shuttleUnitFallback`, `toastMs`,
  ngưỡng cân trình độ…) nằm ở `src/config/app.json`. **Cấm** số ma thuật trong logic.
- Ma trận quyền 3 vai (`owner`, `treasurer`, `member`) nằm ở `src/config/permissions.json`
  — tương ứng bảng `role_permissions` trong DB, app không cho sửa.
- Danh sách enum (`genders`, `sessionStates`, `shuttleModes`…) lấy từ config, không viết lại
  mảng ở nhiều file. **Ngoại lệ:** `levels` là dữ liệu của từng CLB (`db.levels`), `app.json`
  chỉ giữ `levelsDefault` cho CLB mới — xem §3.4.

### 3.3 Dữ liệu ghi vào DB phải là KEY, không phải chữ hiển thị

Đây là chỗ dễ sai nhất và hậu quả nặng nhất:

- `transactions.category` lưu **key** (`dues`, `court`, `shuttle`…), xem `CATS` trong
  `src/lib/ledger.js`. Hiển thị bằng `catLabel(cat)`.
- Lý do: đổi ngôn ngữ hoặc sửa câu chữ **không được** làm đổi dữ liệu tiền đã ghi. Nếu lưu chữ
  hiển thị, một lần sửa copy là mọi bản ghi cũ mồ côi.
- Cùng nguyên tắc cho `status`, `role`, `level`, `shuttleMode`, `dir`, `effective`.

### 3.4 KHÔNG có dữ liệu mẫu trong app

App lấy 100% dữ liệu từ Supabase. Thiếu `.env.local` thì app hiện màn hướng dẫn chạy lệnh, chứ
**không** rơi về dữ liệu mẫu — chạy trên dữ liệu bịa rồi tưởng là thật là cách nhanh nhất để
đưa ra kết luận sai về tiền.

Bộ dữ liệu cố định của prototype nằm ở `src/__tests__/fixture.js`, **chỉ test import**. App
không import file đó và nó không vào bundle. **Cấm** rải dữ liệu mẫu trong component.

Trình độ (`levels`) là **dữ liệu của từng CLB** (`clubs.levels`), không phải hằng số:
`app.json → levelsDefault` chỉ là danh sách khởi tạo cho CLB mới. Thứ tự trong mảng chính là
thứ tự mạnh dần mà thuật toán cân sân dùng.

## 4. Cấu trúc thư mục và import

```
src/
  App.jsx              route + gác quyền, không chứa UI
  main.jsx             mount React
  components/
    ds/                design system TDMS (VENDORED — không sửa tay)
    layout/            AppLayout · Sidebar · AppHeader · ToastHost
    ui/                primitive dùng chung của app (Mono, LevelChip, Empty…)
  config/              app.json · permissions.json
  contexts/            AuthContext.jsx (phiên + CLB của tôi) · AppContext.jsx (state 1 CLB)
                       appActions.js (mọi hành động ghi) · storage.js (I/O) · dbmap.js (map)
  data/                schema.js (mô tả schema cho trang Sơ đồ dữ liệu)
  hooks/               hook dùng chung (useClock…)
  i18n/                index.js + <locale>.json
  lib/                 logic nghiệp vụ THUẦN: money · ledger · assign · roles · members · schedules · csv · forms
  pages/               1 file 1 màn hình
  routes/              bảng route key ↔ URL
  styles/              index.css + tokens/*.css
  utils/               helper chung không dính nghiệp vụ (dates)
  __tests__/           test — xem README.md trong đó để biết file nào ở đâu
```

**Luật phân lớp** (vi phạm là bug kiến trúc, không phải style):

| Tầng | Được làm | Cấm |
| --- | --- | --- |
| `pages/*` | đọc state qua `useApp()`, gọi selector của `lib/`, gọi `a.<action>()` | tự `setDb`, tự viết công thức tiền |
| `contexts/appActions.js` | chỗ **duy nhất** được ghi state | chứa công thức tiền |
| `lib/*`, `utils/*` | hàm thuần `(db, args) => giá trị` | `setState`, `fetch`, import React |
| `contexts/AppContext.jsx` | giữ state, nạp/đồng bộ | chứa nghiệp vụ |
| `contexts/storage.js` | **điểm chạm mạng duy nhất** | chứa nghiệp vụ hoặc công thức |
| `contexts/dbmap.js` | map thuần client ↔ Postgres | gọi mạng, import React |
| `components/ds/*` | — | **sửa tay** (file sinh ra từ handoff) |

**Import:** dùng alias subpath của `package.json` (`#lib/…`, `#ui`, `#ds`, `#i18n`, `#routes`…).
Chạy được ở cả Vite và `node` chạy test — **cấm** thêm alias riêng trong `vite.config.js`, vì
`node` không đọc được và test sẽ vỡ. Không dùng `../../..`.

## 5. Test

- Logic nghiệp vụ không tầm thường (date math, chain/cascade, tiền, thuật toán xếp sân) phải có
  test trong `src/__tests__/`, chạy bằng `node:assert/strict`, không framework.
- `npm test` = `node --test "src/**/*.test.js"` — runner sẵn có của Node, tự tìm mọi file
  `*.test.js`. **Không phải khai báo file mới ở đâu cả.** Đặt đúng thư mục theo bản đồ ở
  `src/__tests__/README.md` là đủ; đặt sai thư mục thì vẫn chạy nhưng người sau không tìm ra.
- Chạy một file khi đang sửa: `node src/__tests__/money/dues.test.js`.
- Thông điệp của mỗi `assert` phải nói **vì sao sai là tốn tiền**, không chỉ nói "sai" — đó là
  chỗ người sau đọc để hiểu luật nghiệp vụ.
- Viết xong phải **mutation-test**: tắt nhánh logic vừa khoá, chạy lại, phải ĐỎ. Test không bắt
  được lỗi nào chỉ là dòng chữ trang trí.
- **Test fail thì DỪNG** và báo user trước khi sửa test hoặc sửa logic. Không tự chọn cái nào dễ
  sửa hơn. User quyết định bên nào sai.

## 6. Build và verify

- Agent **không** tự chạy `npm run build`. User build tay. Chỉ chạy khi user báo có lỗi build.
- Agent **không** tự mở Browser để tự nghiệm UI. Liệt kê thay đổi + checklist để user tự bấm.
- Không tuyên bố "UI chạy đúng" hay "build pass" nếu chưa có bằng chứng từ chính môi trường đó.

## 7. 🚨 CẤM TUYỆT ĐỐI: XOÁ / RESET DATABASE

> **⛔ LUẬT ƯU TIÊN CAO NHẤT — KHÔNG NGOẠI LỆ.**

**KHÔNG BAO GIỜ được chạy** mà không hỏi user:

- `supabase db reset` — xoá sạch DB
- `DROP DATABASE` / `DROP SCHEMA ... CASCADE`
- `TRUNCATE` / `DELETE FROM ... WHERE true`

**PHẢI** giải thích lệnh làm gì → cảnh báo mất data → **xin phép** trước khi chạy.

Cách đúng để cập nhật DB: thêm file migration mới (`supabase/migrations/000N_*.sql`) rồi chạy
`psql -f`. **Không** sửa file migration đã chạy, **không** reset.
