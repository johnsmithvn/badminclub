# ARCHITECTURE.md — Quản lý CLB cầu lông

**Version:** v0.4.0 · **Updated:** 2026-09-02

Tài liệu này nói **codebase này được dựng thế nào**. Đặc tả nghiệp vụ gốc nằm trong bộ handoff
(`design_handoff_clb_cau_long/01..06`) — không lặp lại ở đây; chỗ nào cần thì trỏ sang.

---

## 1. Stack và lý do chọn

| Lớp | Chọn | Lý do |
| --- | --- | --- |
| Build | **Vite 8** | Rolldown, build nhanh; đồng bộ với dự án khác của team |
| UI | **React 19.2**, JavaScript thuần (`.jsx`) | prototype handoff là JS; test chạy file `.js` bằng `node` trực tiếp nên thêm TypeScript là thêm bước build cho test. DS bundle không dùng `defaultProps`/`propTypes` nên React 19 chạy được nguyên trạng |
| Router | **React Router 7** | URL thật (`/buoi-tap/B5`, `/tai-khoan`) chia sẻ và deep-link được, nút back của browser đúng |
| Design system | **TDMS trích từ handoff** → `src/components/ds/` | `_ds_bundle.js` đã có 29 component React build sẵn đúng thiết kế. Trích lại rẻ hơn và khớp hơn viết lại |
| Icon | **lucide-react** + bảng static `ds/icons.js` | bundled, chạy offline. Giữ đúng bộ icon Lucide mà handoff `06` đã chốt |
| State | **không lib** — 1 Context + 2 `useState` | đúng hình dạng prototype (một cây state), không cần Redux/Zustand |
| Chữ và hằng số | `src/i18n/vi.json` + `src/config/*.json` | xem `docs/RULES.md` §3 |
| Dữ liệu | **Supabase** (Postgres + Auth + RLS), local qua Docker | không còn chế độ dữ liệu mẫu: thiếu `.env.local` là app không chạy. Xem §6 |
| Lint | ESLint 9 + `react-hooks` | bắt lỗi hook thật |
| Test | `node --test` + `node:assert/strict`, không framework | runner sẵn có của Node, tự tìm `*.test.js`; xem `docs/RULES.md` §5 |

**Dependency runtime: đúng 6** — `@supabase/supabase-js`, `jsqr`, `lucide-react`, `react`, `react-dom`, `react-router-dom`.
Không thêm dependency UI nào khác (không Tailwind, không MUI, không styled-components).

---

## 2. Cây file

```
index.html            jsconfig.json (alias cho editor)   vercel.json
public/favicon.svg
src/
  main.jsx            mount React + BrowserRouter + AuthProvider + StoreProvider
  App.jsx             đăng ký route, gác quyền, đưa navigate cho actions
  components/
    ds/               DESIGN SYSTEM TDMS — trích từ handoff, KHÔNG sửa tay (icons.js + index.js)
    layout/           AppLayout · Sidebar · AppHeader · ToastHost · AuthLayout
    challenge/        CreateChallengeModal · ScoreModal · EditScoreModal
    session/          CourtAssignmentTab · SessionMatchesTab
    ui/               primitive của app: Mono, LevelChip, SessionPill, Empty, Bar, AvatarUpload, BankAccountSection, QrModal, SearchSelect…
  config/             app.json (hằng số, rating cfg) · permissions.json (ma trận quyền)
  contexts/
    AuthContext.jsx   phiên đăng nhập, profile, danh sách CLB của tôi, activeClubId
    AppContext.jsx    db + ui state của MỘT CLB, Context
    appActions.js     MỌI hành động ghi dữ liệu (thi đấu, chia sân, tiền, sổ quỹ)
    storage.js        ĐIỂM CHẠM MẠNG DUY NHẤT: load(clubId) / save(db)
    dbmap.js          map thuần client ↔ 34+ bảng Postgres + diff()
  data/schema.js      mô tả schema để render trang Sơ đồ dữ liệu
  hooks/
    useClock.js       đồng hồ bấm giờ sân
    useMobile.js      kiểm tra breakpoint màn hình di động (<= 768px)
  i18n/               index.js (hàm t) + vi.json (toàn bộ chữ)
  lib/                LOGIC THUẦN — không React, không I/O, test bằng node
    assign.js         chia sân: slot, 5 chế độ xếp, chia đều, số trận
    challenge.js      kèo đấu: mã kèo, hướng xem (creator/teamA/teamB), độ cân, điều kiện nhận/đẩy sân
    csv.js            đọc/sinh CSV thành viên, RFC 4180, validate, phát hiện cột
    forms.js          giá trị mặc định an toàn cho các dialog
    ledger.js         sổ quỹ (ledger, số dư, gộp dòng, tổng hợp ngày, hoàn tác)
    matchSearch.js    tìm kiếm trận đấu, lọc đối đầu/đồng đội, ma trận H2H, cặp chưa từng gặp
    members.js        lọc/tìm/sắp xếp thành viên, chọn trường ghép tài khoản (0009/0010)
    money.js          mọi công thức tiền + tra cứu + màu/nhãn trạng thái + đối chiếu
    rating.js         Elo Engine: tính delta, win%, đánh giá độ cân, độ tin cậy R1-R5, hiệu chỉnh chéo giới, replay cascade
    roles.js          tra cứu ma trận quyền 3 vai
    schedules.js      kế hoạch SỬA/XOÁ lịch cố định: buổi nào được đụng, tháng nào đổi đơn giá
    supabase.js       khởi tạo client Supabase từ biến môi trường
  pages/              1 file 1 màn hình, chỉ render + gọi actions
    Account.jsx       hồ sơ tài khoản (profiles, NGOÀI CLB)
    Clubs.jsx         danh sách CLB, tạo CLB, tham gia bằng mã
    Login.jsx         đăng nhập (email / username / SĐT)
    Register.jsx      đăng ký (email + mật khẩu, auto-username, tên gọi)
    Dialogs.jsx       host toàn bộ dialog nhập liệu của app
    Home.jsx · Calendar.jsx · Sessions.jsx · SessionDetail.jsx (hợp nhất Chia sân & Kèo) · Assign.jsx
    Leaderboard.jsx   Bảng xếp hạng Elo 5 tabs (Mùa giải, Biểu đồ/Profile, Tìm trận, Ma trận H2H, Chéo giới)
    Schedules.jsx · Members.jsx · Debts.jsx · Fund.jsx
    Profile.jsx · Settings.jsx · Schema.jsx
  routes/index.js     bảng route key ↔ URL (PUBLIC_PATHS + 13 in-club routes)
  styles/             index.css + tokens/*.css (base.css hỗ trợ utility classes responsive mobile)
  utils/dates.js      ngày, tháng, giờ thập phân, lưới lịch
  __tests__/          100 test cases: lib/ (14) · money/ (12) · components/ (7) · ledger/ (2) · sync/ (2) · smoke/ (2)
supabase/migrations/   SQL cho bản chạy thật (0001..0021)
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

---

## 3. Hai cây state

`contexts/AppContext.jsx` giữ hai thứ tách nhau:

**`db`** — dữ liệu nghiệp vụ của MỘT CLB, đồng bộ ngầm xuống Supabase (không còn persist
localStorage). Đúng những khoá `dbmap.toDb()` sinh ra:
`club, levels, courts, groups, members, guests, schedules, sessions, attendance, sessionGuests,`
`lineups, courtGroups, groupMode, courtMin, matches, roster, locked, adjustments, guestPrices,`
`dues, courtBills, manual, changes, users, joinRequests,`
`playing`
cộng `clubId, today, month` do `load()` gắn và `currentUserId, myRole, viewAs, sessionId` do
`reload()` gắn.

- `members[i]` có thêm `fullName`, `email`, `note`, `linkedAt`, `pendingLevel`, `pendingLevelFrom`.
- `adjustments` thay cho `back_credits` (migration 0007).
- `dues[i]` có `paidAmount` (migration 0009).

Không có `clubStore` · `seq` · `backPaid` · `invites` — bốn khoá này đã bỏ: nhiều CLB trong bộ
nhớ (xem dưới), bộ đếm id thay bằng `crypto.randomUUID()`, `back_credits` thay bằng
`member_adjustments` (migration 0007), mời qua SĐT gỡ khỏi client (xem `TASKS.md` Đợt 1).

**`ui`** — trạng thái màn hình, **không** persist:
`tab, dialog, form, toast, picked, expanded, assignId, asnMode`
(route không nằm ở đây — React Router giữ, đọc bằng `useLocation()` + `keyOfPath()`)

Vì sao `lineups` / `playing` / `matches` nằm ở `db`: `matches` là bản ghi thật (số trận từng
người) và `lineups` cần sống qua F5 để hai người điều phối cùng thấy — handoff `05` nói rõ bản
thật nên lưu server và bật realtime theo `session_id`. Riêng `playing` (đồng hồ đang chạy)
**không** xuống DB: `toDb` luôn trả `playing: {}`, mất khi F5. Cần nhiều người cùng thấy thì
thêm `sessions.timer_started_at` — xem `DATABASE.md` §4.

Vì sao `today` **không** dùng bản đã lưu: `load()` luôn ghi đè `today` bằng đồng hồ thật, nếu
không thì "buổi sắp tới" và "buổi xếp được" sẽ đứng yên ở ngày cũ.

### Nhiều CLB

Mọi bảng nghiệp vụ thuộc về một CLB. Client giữ dữ liệu của **đúng một** CLB — CLB đang xem.
`activeClubId` nằm ở `AuthContext` (persist trong localStorage, chỉ đúng cái id đó). Đổi CLB →
`AppContext` đẩy nốt thay đổi đang chờ, quên ảnh chụp đồng bộ, rồi `load(clubId)` lại từ đầu.

Giữ nhiều CLB trong bộ nhớ chỉ để đổi nhanh không đáng đổi lấy nguy cơ ghi lẫn dữ liệu giữa
hai CLB — đó là lý do bỏ `clubStore`.

### Tầng C: Hệ thống Thi đấu, Kèo đấu & Bảng xếp hạng Elo (Rating Engine)

Bên cạnh **Sổ quỹ**, hệ thống có **Thi đấu & Đẳng cấp** hoàn toàn tách biệt:
- **Độc lập luồng tiền**: Toàn bộ dữ liệu `challenges`, `matches`, `player_ratings`, `match_edits` không bao giờ sinh dòng ở sổ quỹ và không làm thay đổi tiền sân hay thu khách của buổi (được kiểm chứng bởi test suite `src/__tests__/money/isolation.test.js`).
- **Elo Engine thuần túy (`src/lib/rating.js`)**:
  - Điểm khởi đầu mặc định: `0` cho toàn bộ thành viên.
  - Công thức tính xác suất thắng dự kiến: $P(A) = 1 / (1 + 10^{(R_B - R_A) / 400})$.
  - Hệ số biến thiên $K = 32$, bảo toàn tổng điểm (zero-sum $\Delta A + \Delta B = 0$).
  - Thưởng điểm khi lật kèo (Underdog upset win nhận thưởng điểm Elo cao hơn).
  - Thang độ tin cậy R1 -> R5: R1 (<5 trận), R2 (5-14 trận), R3 (15-29 trận), R4 (30-49 trận), R5 (50+ trận).
  - Hiệu chỉnh chéo giới (Gender Calibration): Học từ phân bố tỷ lệ thắng thực tế của CLB để cân bằng tương quan nam-nữ.
  - Cascade Replay: Khi sửa điểm trận đấu trong quá khứ, `replayRatingCascade` tự động phát lại chuỗi kết quả để cập nhật chính xác rating của toàn bộ thành viên.

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

**Route công khai / Ngoài CLB (`PUBLIC_PATHS`):**
- `/dang-nhap` (`Login`)
- `/dang-ky` (`Register`)
- `/clb` (`Clubs` — chọn CLB, tạo CLB, nhập mã tham gia)
- `/tai-khoan` (`Account` — quản lý hồ sơ tài khoản `profiles` dùng chung)

**Route trong CLB (12 màn hình trong `AppLayout`):**
Route key (xem `routes/index.js`) là một trong: `home sessions session assign schedules calendar members debts fund profile settings schema`.

Quyền lấy từ `lib/roles.js` + `config/permissions.json` (3 vai: `owner`, `treasurer`, `member`):

- Sidebar **ẩn** mục không được phép; section rỗng cũng ẩn.
- Route không được phép → `effRoute()` fallback về `home`, **không** hiện trang lỗi.
- Nút hành động ở header chỉ hiện khi có cờ `sessions`.

`db.myRole` là vai THẬT, lấy từ `club_members.role` qua RPC `my_clubs`. `db.viewAs` là công cụ
xem-như, chỉ cho chọn vai của mình hoặc **yếu hơn** (`viewAsOptions` trong `lib/roles.js`) — cho
tự nâng quyền thì UI mở ra nhưng RLS ở Supabase vẫn chặn, người dùng chỉ nhận lỗi không hiểu.
Ẩn UI luôn chỉ là lớp thứ hai; RLS là lớp thật.

---

## 6. Đồng bộ với Supabase

`contexts/storage.js` là **điểm chạm mạng duy nhất** cho việc tải và lưu dữ liệu nền. Hai hàm:

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

Hai bất biến bắt buộc, có test khoá ở `src/__tests__/sync/dbmap.test.js`:

1. **`db` không đổi ⇒ `diff()` rỗng.** Sai chỗ này là mỗi lần bấm phím ghi lại cả CLB.
2. **Ảnh chụp dựng bằng chính `toRows()`**, không dựng từ dòng đọc về. Nhờ vậy `load` và `save`
   luôn cùng một hàm map; lệch nhau thì lộ ngay ở lần save đầu chứ không âm thầm xoá dòng.

**Các hành động đặc biệt ghi trực tiếp DB rồi `reload()`:**
1. `approveJoin` và `rejectJoin`: người xin vào chưa phải thành viên nên client không có quyền ghi thẳng.
2. `renameMe` (`a.renameMe`): thành viên tự đổi tên hiển thị / tên đầy đủ qua `.update()` trực tiếp với policy `cm_update_self_name` + trigger guard (0010), do sync ngầm dùng upsert đòi quyền INSERT mà thành viên thường không có.

Điều cần giữ: **tiền lưu `bigint` VND, không lưu số đã làm tròn**; ngày buổi lưu `date`, tháng
lưu `char(7)`.

Còn lại: RPC sinh `transactions` khi chốt buổi (hiện `lib/ledger.js` tính phía client), realtime
theo `session_id` cho `session_lineups` + `matches`, trigger `audit_logs`.

---

## 7. Điều đã hoàn thành & việc tiếp theo

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Đăng ký / Supabase Auth | ✅ **Đã làm** | Đăng ký bằng email (auto-username) · đăng nhập email/username/SĐT · quản lý hồ sơ tại `/tai-khoan` |
| i18n & Config | ✅ **Đã làm** | `src/i18n/vi.json`, `src/config/*.json`, hỗ trợ đa ngôn ngữ không sửa UI |
| Tách 2 hồ sơ & Ghép chọn lọc | ✅ **Đã làm** | Hồ sơ tài khoản (`profiles`) vs Hồ sơ CLB (`club_members`), ghép 6 trường chọn lọc (0009/0010) |
| Thành viên tự đổi tên | ✅ **Đã làm** | Policy `cm_update_self_name` + trigger guard chỉ cho đổi `name` và `full_name` (0010) |
| CSV Import & JSON Settings | ✅ **Đã làm** | Nhập/xuất danh sách thành viên bằng CSV (`src/lib/csv.js`), backup/restore cài đặt CLB |
| Hệ thống Kèo & Chia sân hợp nhất | ✅ **Đã làm** | Tab bar 3 tabs (`SessionDetail.jsx`): Điểm danh, Chia sân & Kèo chờ, Trận đấu. Ghi điểm và tạo kèo độc lập |
| Bảng xếp hạng Elo & Độ tin cậy | ✅ **Đã làm** | Màn `Leaderboard.jsx` (5 tabs): BXH Mùa giải, Hồ sơ Rating (R1-R5), Tìm trận & Sửa điểm inline, Ma trận H2H, Hiệu chỉnh chéo giới |
| Responsive Mobile (390px - 768px) | ✅ **Đã làm** | Hook `useMobile.js`, layout stack tự động, cuộn ngang cảm ứng chống tràn cho bảng dữ liệu, tối ưu modal |
| Mời vào CLB qua SĐT | **KHÔNG LÀM** (user chốt 2026-09-02) | Phần NHẬN phải gửi SMS thật — tốn tiền, không làm. Người mới vào bằng **mã CLB**. Bảng `club_invites` và cột `clubs.allow_invite` để nguyên dưới DB (xoá schema là việc riêng, phải xin phép), client không đọc |
| `notifications` / Zalo OA / `audit_logs` | Giai đoạn 2 | Bảng đã có sẵn trong SQL |
| Realtime cho chia sân | Giai đoạn 2 | Realtime channel theo `session_id` cho `session_lineups` + `matches` |
