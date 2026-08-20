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
| Dữ liệu | **Supabase** (Postgres + Auth + RLS), local qua Docker | không còn chế độ dữ liệu mẫu: thiếu `.env.local` là app không chạy. Xem §6 |
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
    AuthContext.jsx   phiên đăng nhập, profile, danh sách CLB của tôi, activeClubId
    AppContext.jsx    db + ui state của MỘT CLB, Context
    appActions.js     MỌI hành động ghi dữ liệu (một chỗ duy nhất)
    storage.js        ĐIỂM CHẠM MẠNG DUY NHẤT: load(clubId) / save(db)
    dbmap.js          map thuần client ↔ 30 bảng Postgres + diff()
  data/schema.js      mô tả schema để render trang Sơ đồ dữ liệu
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

Mọi bảng nghiệp vụ thuộc về một CLB. Client giữ dữ liệu của **đúng một** CLB — CLB đang xem.
`activeClubId` nằm ở `AuthContext` (persist trong localStorage, chỉ đúng cái id đó). Đổi CLB →
`AppContext` đẩy nốt thay đổi đang chờ, quên ảnh chụp đồng bộ, rồi `load(clubId)` lại từ đầu.

Không có `clubStore`: giữ nhiều CLB trong bộ nhớ chỉ để đổi nhanh không đáng đổi lấy nguy cơ
ghi lẫn dữ liệu giữa hai CLB.

---

## 4. Actions (`contexts/appActions.js`)

`makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast, reload })` trả về một object phẳng các hành động.
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

`db.myRole` là vai THẬT, lấy từ `club_members.role` qua RPC `my_clubs`. `db.viewAs` là công cụ
xem-như, chỉ cho chọn vai của mình hoặc **yếu hơn** (`viewAsOptions` trong `lib/roles.js`) — cho
tự nâng quyền thì UI mở ra nhưng RLS ở Supabase vẫn chặn, người dùng chỉ nhận lỗi không hiểu.
Ẩn UI luôn chỉ là lớp thứ hai; RLS là lớp thật.

---

## 6. Đồng bộ với Supabase

`contexts/storage.js` là **điểm chạm mạng duy nhất**. Hai hàm:

| Hàm | Việc |
| --- | --- |
| `load(clubId)` | ~20 query song song (dùng embed của PostgREST cho bảng con) → `dbmap.toDb()` → state `db` |
| `save(db)` | hẹn giờ `sync.debounceMs` → `dbmap.toRows()` → `dbmap.diff()` so với ảnh chụp lần đồng bộ trước → ghi/xoá **đúng những dòng đã đổi** |

Vì sao đồng bộ ngầm theo dòng, không phải mỗi action tự `await` Supabase:

- 78 action giữ nguyên hình đồng bộ, UI phản hồi tức thì, 13 màn không phải thêm trạng thái
  chờ/lỗi/rollback. Chỗ nào đúng sai chỉ nằm trong **một** file map, không rải ra 50 action.
- Đơn vị ghi là **từng dòng**, nên hai người sửa hai buổi khác nhau không đè nhau. Đổi lại: hai
  người sửa **cùng một dòng** thì người ghi sau thắng. Không có validate phía server ngoài RLS.

Ba chế độ ghi, khai báo ở `TABLES` trong `dbmap.js`:

| mode | Dùng cho | Cách ghi |
| --- | --- | --- |
| `id` | bảng mà client tự sinh `crypto.randomUUID()` cho từng dòng | thêm/sửa/xoá theo `id` |
| `key` | dòng con có khoá tự nhiên (`session_id` + `member_id`…) | `upsert onConflict`, dọn dòng thừa bằng `scope` + `child` |
| `scope` | dòng con không có khoá ổn định, tập nhỏ (`schedule_slots`, `match_players`…) | scope nào đổi thì xoá sạch scope đó rồi ghi lại |

Hai bất biến bắt buộc, có test khoá ở `src/__tests__/dbmap.test.js`:

1. **`db` không đổi ⇒ `diff()` rỗng.** Sai chỗ này là mỗi lần bấm phím ghi lại cả CLB.
2. **Ảnh chụp dựng bằng chính `toRows()`**, không dựng từ dòng đọc về. Nhờ vậy `load` và `save`
   luôn cùng một hàm map; lệch nhau thì lộ ngay ở lần save đầu chứ không âm thầm xoá dòng.

Hai hành động **không** đi qua đồng bộ ngầm mà gọi RPC rồi `reload()`: `approveJoin` và
`rejectJoin` — người xin vào CLB chưa phải thành viên nên client không có quyền ghi thẳng.

Điều cần giữ: **tiền lưu `bigint` VND, không lưu số đã làm tròn**; ngày buổi lưu `date`, tháng
lưu `char(7)`.

Còn lại: RPC sinh `transactions` khi chốt buổi (hiện `lib/ledger.js` tính phía client), realtime
theo `session_id` cho `session_lineups` + `matches`, trigger `audit_logs`.

---

## 7. Điều đã cố tình không làm

| Không làm | Vì | Làm khi nào |
| --- | --- | --- |
| Đăng nhập / Supabase Auth | chưa có project, và `viewAs` đủ để dựng và kiểm 5 vai | ngay khi có Supabase |
| i18n | tiếng Việt là ngôn ngữ gốc, handoff chốt nguyên văn copy | khi có ngôn ngữ thứ hai |
| Bản mobile riêng cho vai `member` | desktop console là ưu tiên 1 của chủ quỹ | handoff `02` §Responsive đã chốt 3 màn cần làm trước |
| `notifications` / Zalo OA / `audit_logs` | giai đoạn 2 trong handoff `03` | bảng đã có sẵn trong SQL |
| Code-split theo route | 13 màn, bundle 110 KB gzip là chấp nhận được | khi bundle vượt ~300 KB gzip |
