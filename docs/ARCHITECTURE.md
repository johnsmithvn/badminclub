# ARCHITECTURE.md — Quản lý CLB cầu lông

**Version:** v0.1.0 · **Updated:** 2026-08-19

Tài liệu này nói **codebase này được dựng thế nào**. Đặc tả nghiệp vụ gốc nằm trong bộ handoff
(`design_handoff_clb_cau_long/01..06`) — không lặp lại ở đây; chỗ nào cần thì trỏ sang.

---

## 1. Stack và lý do chọn

| Lớp | Chọn | Lý do |
| --- | --- | --- |
| Build | **Vite 8** | Rolldown, build nhanh; đồng bộ với dự án khác của team |
| UI | **React 19.2**, JavaScript thuần (`.jsx`) | prototype handoff là JS; test chạy file `.js` bằng `node` trực tiếp nên thêm TypeScript là thêm bước build cho test. DS bundle không dùng `defaultProps`/`propTypes` nên React 19 chạy được nguyên trạng |
| Router | **React Router 7** | URL thật (`/buoi-tap/B5`) chia sẻ và deep-link được, nút back của browser đúng |
| Design system | **TDMS trích từ handoff** → `src/components/ds/` | `_ds_bundle.js` đã có 29 component React build sẵn đúng thiết kế. Trích lại rẻ hơn và khớp hơn viết lại |
| Icon | **lucide-react** + bảng static `ds/icons.js` | bundled, chạy offline. Giữ đúng bộ icon Lucide mà handoff `06` đã chốt |
| State | **không lib** — 1 Context + 2 `useState` | đúng hình dạng prototype (một cây state), không cần Redux/Zustand |
| Chữ và hằng số | `src/i18n/vi.json` + `src/config/*.json` | xem `docs/RULES.md` §3 |
| Dữ liệu | localStorage (giai đoạn 1) → Supabase (giai đoạn 2) | chưa có Supabase project. Xem §6 |
| Lint | ESLint 9 + `react-hooks` | bắt lỗi hook thật |
| Test | `node:assert/strict`, không framework | theo `docs/RULES.md` §5 |

**Dependency runtime: đúng 4** — `react`, `react-dom`, `react-router-dom`, `lucide-react`.
Không thêm dependency UI nào khác (không Tailwind, không MUI, không styled-components).

---

## 2. Cây file

```
index.html            jsconfig.json (alias cho editor)   vercel.json
public/favicon.svg
src/
  main.jsx            mount React + BrowserRouter + StoreProvider
  App.jsx             đăng ký route, gác quyền, đưa navigate cho actions
  components/
    ds/               DESIGN SYSTEM TDMS — trích từ handoff, KHÔNG sửa tay
    layout/           AppLayout · Sidebar · AppHeader · ToastHost
    ui/               primitive của app: Mono, LevelChip, SessionPill, Empty, Bar…
  config/             app.json (hằng số) · permissions.json (ma trận quyền)
  contexts/
    AppContext.jsx    db + ui state, localStorage, Context
    appActions.js     MỌI hành động ghi dữ liệu (một chỗ duy nhất)
  data/seed.js        dữ liệu mẫu 2 CLB (chỉ dùng lần chạy đầu)
  hooks/useClock.js   đồng hồ bấm giờ sân
  i18n/               index.js (hàm t) + vi.json (toàn bộ chữ)
  lib/                LOGIC THUẦN — không React, không I/O, test bằng node
    money.js          mọi công thức tiền + tra cứu + màu/nhãn trạng thái
    ledger.js         sổ quỹ (ledger, số dư, gộp dòng, tổng hợp ngày)
    assign.js         chia sân: slot, 5 chế độ xếp, chia đều, số trận
    roles.js          tra cứu ma trận quyền
  pages/              1 file 1 màn hình, chỉ render + gọi actions
  routes/index.js     bảng route key ↔ URL
  styles/             index.css + tokens/*.css
  utils/dates.js      ngày, tháng, giờ thập phân, lưới lịch
  __tests__/          test cho lib/ và utils/
supabase/migrations/   SQL cho bản chạy thật
docs/                  RULES · ARCHITECTURE · DATABASE · FEATURES · TASKS (+ DESIGN.md ở gốc)
```

### Import alias

`package.json` field `imports` khai báo `#lib/*`, `#ui`, `#ds`, `#i18n`, `#routes`, `#config/*`…
Đây là **subpath imports của Node**, không phải alias của bundler — nên **cùng một cú pháp chạy ở
cả Vite và `node` chạy test**. Đừng thêm `resolve.alias` trong `vite.config.js`: `node` không đọc
được và test sẽ vỡ.

### Quy tắc phân lớp (quan trọng)

```
pages/*.jsx          →  đọc db qua useApp(), gọi selector trong lib/, gọi a.<action>()
appActions.js        →  hàm duy nhất được ghi state; mỗi hành động bắn 1 toast
lib/*, utils/*       →  hàm THUẦN: (db, args) => giá trị. Không setState, không fetch
AppContext.jsx       →  giữ state, persist, không chứa nghiệp vụ
i18n/ + config/      →  toàn bộ chữ và hằng số (xem docs/RULES.md §3)
```

Màn hình **không** được tự `setDb`. Công thức tiền **không** được viết trong màn hình.
Chữ tiếng Việt **không** được viết trong `.jsx`.
Lý do: mọi con số phải giải thích được nguồn gốc, tiền phải test được mà không cần render UI, và
đổi câu chữ hay thêm ngôn ngữ không được phải sửa 13 màn hình.

## 3. Hai cây state

`contexts/AppContext.jsx` giữ hai thứ tách nhau:

**`db`** — dữ liệu nghiệp vụ, **có** persist:
`users, clubs, club, clubId, clubStore, currentUserId, viewAs, joinRequests, invites,`
`courts, groups, members, guests, sessions, attendance, sessionGuests, dues, guestPrices,`
`shuttleTypes, schedules, purchases, stockChecks, courtBills, manual, backPaid, roster,`
`locked, changes, lineups, matches, playing, courtMin, courtGroups, groupMode, seq,`
`sessionId, month, today`

**`ui`** — trạng thái màn hình, **không** persist:
`tab, dialog, form, toast, picked, expanded, assignId, asnMode`
(route không nằm ở đây — React Router giữ, đọc bằng `useLocation()` + `keyOfPath()`)

Vì sao `lineups` / `playing` / `matches` nằm ở `db`: `matches` là bản ghi thật (số trận từng
người); `lineups` và `playing` cần sống qua F5 để hai người điều phối cùng thấy — handoff `05`
nói rõ bản thật nên lưu server và bật realtime theo `session_id`.

Vì sao `today` **không** dùng bản đã lưu: `load()` luôn ghi đè `today` bằng đồng hồ thật, nếu
không thì "buổi sắp tới" và "buổi xếp được" sẽ đứng yên ở ngày cũ.

### Nhiều CLB

Mọi bảng nghiệp vụ thuộc về một CLB. Client giữ **một** bộ dữ liệu của CLB đang xem ở gốc `db`,
bộ của các CLB khác nằm trong `db.clubStore[clubId]`. `switchClub(id)` stash bộ hiện tại vào
`clubStore` rồi nạp bộ mới (danh sách key: `CLUB_KEYS` trong `data/seed.js`).

Khi lên Supabase, cấu trúc này biến mất: chỉ cần `club_id` trong mọi query + một `activeClubId`.
`CLUB_KEYS` khi đó là danh sách bảng cần refetch.

---

## 4. Actions (`contexts/appActions.js`)

`makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast })` trả về một object phẳng các hành động.
Màn hình dùng: `const { a } = useApp(); a.setSessionStatus(id, 'closed')`.

Ba quy ước:

1. **Đọc state qua ref, ghi qua updater.** `dbRef.current` / `uiRef.current` để tính text toast
   và giá trị dẫn xuất; `setDb`/`setUi` để ghi. Không đọc state trong updater rồi gây side effect
   ở đó — React 19 StrictMode gọi updater hai lần.
2. **Mỗi hành động ghi dữ liệu bắn đúng một toast**, tiếng Việt, nói **đã làm gì và hệ quả**
   (`"Đã ghi 1 trận · 4 người · 22 phút"`). Chặn hành động cũng bằng toast, không disable im lặng.
3. **Không xoá cứng.** Dùng `status` / `active`. Ngoại lệ đã cân nhắc: bỏ khách khỏi buổi và bỏ
   trận vừa ghi — hai thứ này là sửa sai lúc nhập, không phải xoá lịch sử.

---

## 5. Route và quyền

Route key (xem `routes/index.js`) là một trong: `home sessions session assign schedules calendar members debts fund
shuttles profile settings schema`.

Quyền lấy từ `lib/roles.js` + `config/permissions.json` (5 vai, xem handoff `01` §5):

- Sidebar **ẩn** mục không được phép; section rỗng cũng ẩn.
- Route không được phép → `effRoute()` fallback về `home`, **không** hiện trang lỗi.
- Nút hành động ở header chỉ hiện khi có cờ `sessions`.

`viewAs` là công cụ xem-như của prototype, giữ lại làm preview cho `owner`. **Bản thật phải lấy
vai từ `club_members.role` của user đang đăng nhập, và backend phải kiểm lại quyền** — ẩn UI chỉ
là lớp thứ hai.

---

## 6. Đường lên Supabase (giai đoạn 2)

Hiện tại `contexts/AppContext.jsx` có đúng hai điểm chạm I/O: `load()` và `save(db)`. Đó là chỗ duy nhất phải
thay.

Thứ tự làm:

1. Chạy `supabase/migrations/0001_init.sql` (xem `docs/DATABASE.md`) — **bằng `psql -f`, không
   dùng `supabase db reset`**.
2. `load()` → fetch song song các bảng theo `activeClubId`, map về đúng shape `db` hiện tại.
3. `save(db)` biến mất. Thay bằng: mỗi action gọi thẳng Supabase rồi cập nhật state tại chỗ.
   `appActions.js` đã là chỗ duy nhất ghi dữ liệu nên không phải sửa màn hình nào.
4. RLS theo `club_members` (một user nhìn được CLB mình tham gia) + kiểm cờ quyền server-side.
5. Realtime channel theo `session_id` cho `session_lineups` + `matches` (chia sân nhiều người).

Điều cần giữ khi chuyển: **tiền lưu `bigint` VND, không lưu số đã làm tròn**; mọi thay đổi tiền
ghi vào `transactions` (append-only); ngày buổi lưu `date`, tháng lưu `char(7)`.

---

## 7. Điều đã cố tình không làm

| Không làm | Vì | Làm khi nào |
| --- | --- | --- |
| Đăng nhập / Supabase Auth | chưa có project, và `viewAs` đủ để dựng và kiểm 5 vai | ngay khi có Supabase |
| i18n | tiếng Việt là ngôn ngữ gốc, handoff chốt nguyên văn copy | khi có ngôn ngữ thứ hai |
| Bản mobile riêng cho vai `member` | desktop console là ưu tiên 1 của chủ quỹ | handoff `02` §Responsive đã chốt 3 màn cần làm trước |
| `notifications` / Zalo OA / `audit_logs` | giai đoạn 2 trong handoff `03` | bảng đã có sẵn trong SQL |
| Code-split theo route | 13 màn, bundle 110 KB gzip là chấp nhận được | khi bundle vượt ~300 KB gzip |
