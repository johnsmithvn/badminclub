# Quản lý CLB cầu lông

Web app quản lý một hoặc nhiều câu lạc bộ cầu lông sinh hoạt định kỳ: lịch tập cố định → điểm danh
từng buổi → khách giao lưu → chốt tiền buổi → quỹ tháng, công nợ, back tiền → kho cầu → báo cáo.
Kèm module **Chia sân** (kéo thả, xếp thông minh, bấm giờ, đếm số trận) và hệ **tài khoản – nhiều
CLB – phân quyền 3 vai (Chủ CLB, Thủ quỹ, Thành viên)**.

Bài toán gốc: CLB đang quản lý bằng Excel + Zalo. Người dùng chính là chủ quỹ, làm việc trên điện
thoại/laptop ngay tại sân. Vì vậy: **không ai phải nhập thứ mà app tự suy ra được**, và **mọi con
số đều phải giải thích được nguồn gốc**.

## Chạy

**Không có chế độ dữ liệu mẫu.** Toàn bộ dữ liệu nằm ở Supabase; thiếu `.env.local` thì app hiện
màn hướng dẫn chứ không chạy trên dữ liệu bịa.

Cần **Docker Desktop đang chạy**.

### 1. Dựng DB (lần đầu, mất vài phút tải image)

```bash
npm install
```

```bash
npm run db:start
```

`supabase start` tự chạy hết `supabase/migrations/` khi dựng container lần đầu — không cần làm gì
thêm. DB đã dựng từ trước mà repo có migration mới thì áp bằng:

```bash
npm run db:migrate
```

Muốn xem migration nào đã chạy:

```bash
npx supabase migration list
```

### 2. Lấy key vào `.env.local`

```bash
npm run db:env > .env.local
```

Kiểm tra file có đúng hai dòng, `VITE_SUPABASE_ANON_KEY` phải là chuỗi `eyJ…` chứ không rỗng.

### 3. Chạy dev server

```bash
npm run dev
```

Mở http://localhost:5173 → `/dang-ky` tạo tài khoản → `/clb` tạo CLB (hoặc nhập mã mời) → vào app.

CLB mới tạo ra gần như **rỗng**: chỉ có bạn (vai `owner`), một loại cầu mặc định, và thang trình
độ mặc định. Sân · nhóm cố định · thành viên · giá khách phải tự nhập ở **Cài đặt**. Đó là dữ liệu
thật của CLB bạn, app không bịa hộ.

### Muốn xoá sạch DB làm lại từ đầu

Lệnh dưới **xoá toàn bộ dữ liệu** (tài khoản, CLB, buổi, tiền) rồi chạy lại toàn bộ migration từ đầu.
Không hoàn lại được:

```bash
npx supabase db reset
```

| Cổng | Địa chỉ | Việc |
| --- | --- | --- |
| API | http://127.0.0.1:55321 | REST + Auth |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` | nối bằng client SQL |
| Studio | http://127.0.0.1:55323 | xem/sửa data bằng giao diện |

> Dải port là **553xx**, không phải 543xx mặc định — để chạy song song với stack Supabase của dự án khác
> trên cùng máy. Container `analytics` đã tắt vì port 54327 bị Windows chặn.

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | dev server tại http://localhost:5173 |
| `npm run build` | build production vào `dist/` |
| `npm run preview` | xem thử bản build |
| `npm test` | test logic tiền / sổ quỹ / chia sân / ngày tháng / CSV / map ↔ Postgres |
| `npm run lint` | ESLint |
| `npm run db:start` · `db:stop` · `db:status` | quản lý Supabase local |
| `npm run db:migrate` | áp migration còn thiếu lên DB đang chạy (không xoá data) |
| `npm run db:env` | in env để ghi vào `.env.local` |


### Đăng nhập / đăng ký

- Đăng ký **bắt buộc**: email, mật khẩu. Tên gọi, tên đầy đủ, SĐT **không bắt buộc**. Email chính là tên đăng nhập; `profiles.username` được tự động sinh ngầm từ phần trước dấu @.
- Đăng nhập bằng **email hoặc tên đăng nhập hoặc SĐT** (nếu đã điền) + mật khẩu.
- **Không** gửi email xác thực, **không** OTP — chưa cần chi phí SMS/SMTP. Bật sau ở `supabase/config.toml`.
- Quản lý hồ sơ tài khoản dùng chung mọi CLB tại `/tai-khoan` (ngoài CLB).
- Phê duyệt người xin vào CLB nằm ở **Cài đặt → Tài khoản & quyền** của từng CLB (chọn lọc 6 trường khi ghép).

## Stack

React 19 · Vite 8 · React Router 7 · Supabase · JavaScript thuần · lucide-react · jsqr · ESLint 9.
Design system **TDMS** trích từ bộ handoff (29 component). 6 dependency runtime.

## Cấu trúc

```
src/
  App.jsx              route + gác quyền          main.jsx  mount
  components/
    challenge/         CreateChallengeModal · ScoreModal · EditScoreModal · ChallengeDetailModal
    session/           SessionTabs · CourtAssignmentTab · SessionMatchesTab · SessionCostTab
    ds/                design system TDMS (VENDORED — không sửa tay)
    layout/            AppLayout · Sidebar · AppHeader · ToastHost
    ui/                primitive của app (Mono, LevelChip, Empty, Bar…)
  config/              app.json · permissions.json   ← MỌI hằng số
  contexts/            AuthContext.jsx (phiên + CLB của tôi) · AppContext.jsx (state 1 CLB)
                       appActions.js (mọi hành động ghi) · storage.js (I/O duy nhất) · dbmap.js (map ↔ Postgres)
  data/                schema.js
  hooks/               useClock.js · useMobile.js
  i18n/                index.js · vi.json            ← MỌI chữ
  lib/                 assign · challenge · csv · forms · ledger · matchSearch · members · money · rating · roles · schedules · supabase (THUẦN, test được)
  pages/               14 màn trong CLB (kèm Leaderboard) + Account · Clubs · Login · Register + Dialogs
  routes/              bảng route key ↔ URL
  styles/              index.css + tokens/
  utils/               dates.js
  __tests__/           37 file test cho components/ · lib/ · money/ · ledger/ · sync/ · smoke/ (100 tests)
supabase/               config.toml · migrations/ (0001..0021)
docs/                   RULES · ARCHITECTURE · DATABASE · FEATURES · TASKS
DESIGN.md
```

Import bằng alias subpath của Node (`#lib/…`, `#ui`, `#ds`, `#i18n`) — chạy được ở cả Vite và
`node` chạy test.

## Ba luật không được vi phạm

1. **Không hard-code chữ hay hằng số.** Chữ ở `src/i18n/vi.json`, số ở `src/config/*.json`.
   Dữ liệu ghi vào DB (như `transactions.category`) lưu **key**, không lưu chữ hiển thị.
   Thang trình độ là dữ liệu của từng CLB (`clubs.levels`), sửa ở Cài đặt → Chung.
2. **Tiền là `bigint` VND, không lưu số đã làm tròn.** `transactions` là sổ quỹ duy nhất.
3. **Buổi chỉ ảnh hưởng tiền khi `status='closed'`.** Chia sân, Kèo đấu và Bảng xếp hạng Elo hoàn toàn độc lập với dòng tiền.

Chi tiết: [docs/RULES.md](docs/RULES.md).

## Đọc tài liệu theo thứ tự

| File | Nội dung |
| --- | --- |
| [docs/RULES.md](docs/RULES.md) | Policy cho người và cho agent — đọc trước khi sửa gì |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, cây file, phân lớp, đường lên Supabase |
| [docs/FEATURES.md](docs/FEATURES.md) | Chức năng từng màn + luật nghiệp vụ dễ sai |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, nguồn của từng con số, map state client ↔ Postgres |
| [docs/TASKS.md](docs/TASKS.md) | Trạng thái thật của việc dựng app |
| [DESIGN.md](DESIGN.md) | Token màu/chữ/spacing, khung app, copywriting |

## Tính năng đã hoàn thành

- **Quản lý vận hành & Tài chính**: Lịch cố định, Buổi tập, Điểm danh, Khách giao lưu, Quỹ CLB, Công nợ chi tiết, Báo cáo Zalo, Nhập danh sách CSV, Kho cầu.
- **Hợp nhất Buổi tập & Chia sân**: Gộp Chi tiết buổi tập và Chia sân thành 3 tabs trực quan (Chia sân kéo thả/xếp tự động, Kèo đấu & lịch sử trận đấu, Giá thành & Điểm danh).
- **Hệ thống Kèo đấu & Thi đấu (Challenge)**: Gạ kèo 1v1 / 2v2, dự báo Elo win%, cảnh báo lệch trình (>250 Elo), xếp kèo trực tiếp lên sân trống (`deployChallenge`), nhập điểm nhiều set (Best of 1/3/5), dự báo biến động Elo.
- **Bảng xếp hạng Elo & Thống kê nâng cao (Leaderboard)**: Khởi điểm 0 Elo, tính điểm chuẩn quốc tế kèm thưởng upset, 5 cấp độ tin cậy R1–R5, Tìm trận đa năng, Sửa điểm trực tiếp có lưu vết kiểm toán và cascade tính lại Elo, Ma trận đối đầu CLB (H2H matrix), Thống kê hiệu chỉnh chéo giới tính (Cross-gender calibration).
- **100/100 automated test cases pass 100%**.
- `npm run build` pass (2026-09-02). Responsive tối ưu trên màn hình điện thoại từ 390px đến máy tính bảng/desktop.
