# Quản lý CLB cầu lông

Web app quản lý một hoặc nhiều câu lạc bộ cầu lông sinh hoạt định kỳ: lịch tập cố định → điểm danh
từng buổi → khách giao lưu → chốt tiền buổi → quỹ tháng, công nợ, back tiền → kho cầu → báo cáo.
Kèm module **Chia sân** (kéo thả, xếp thông minh, bấm giờ, đếm số trận) và hệ **tài khoản – nhiều
CLB – phân quyền 5 vai**.

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

Lệnh dưới **xoá toàn bộ dữ liệu** (tài khoản, CLB, buổi, tiền) rồi chạy lại 3 migration từ đầu.
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
| `npm test` | test logic tiền / sổ quỹ / chia sân / ngày tháng / map ↔ Postgres |
| `npm run lint` | ESLint |
| `npm run db:start` · `db:stop` · `db:status` | quản lý Supabase local |
| `npm run db:migrate` | áp migration còn thiếu lên DB đang chạy (không xoá data) |
| `npm run db:env` | in env để ghi vào `.env.local` |


### Đăng nhập / đăng ký

- Đăng ký **bắt buộc**: email, tên đăng nhập, mật khẩu. SĐT **không bắt buộc**.
- Đăng nhập bằng **email hoặc tên đăng nhập hoặc SĐT** (nếu đã điền) + mật khẩu.
- **Không** gửi email xác thực, **không** OTP — chưa cần chi phí SMS/SMTP. Bật sau ở `supabase/config.toml`.
- Phê duyệt người xin vào CLB nằm ở **Cài đặt → Tài khoản & quyền** của từng CLB, không phải màn riêng.

## Stack

React 19 · Vite 8 · React Router 7 · Supabase · JavaScript thuần · lucide-react · ESLint 9.
Design system **TDMS** trích từ bộ handoff (29 component). 5 dependency runtime.

## Cấu trúc

```
src/
  App.jsx              route + gác quyền          main.jsx  mount
  components/
    ds/                design system TDMS (VENDORED — không sửa tay)
    layout/            AppLayout · Sidebar · AppHeader · ToastHost
    ui/                primitive của app (Mono, LevelChip, Empty, Bar…)
  config/              app.json · permissions.json   ← MỌI hằng số
  contexts/            AuthContext.jsx (phiên + CLB của tôi) · AppContext.jsx (state 1 CLB)
                       appActions.js (mọi hành động ghi) · storage.js (I/O duy nhất) · dbmap.js (map ↔ Postgres)
  data/                schema.js
  hooks/               useClock.js
  i18n/                index.js · vi.json            ← MỌI chữ
  lib/                 money · ledger · assign · roles · forms  (THUẦN, test được)
  pages/               13 màn trong CLB + Login · Register · Clubs + Dialogs
  routes/              bảng route key ↔ URL
  styles/              index.css + tokens/
  utils/               dates.js
  __tests__/           test cho lib/ · utils/ · dbmap + fixture.js (dữ liệu test, app KHÔNG import)
supabase/               config.toml · migrations/0001_init.sql · 0002_auth_rls.sql · 0003_levels_and_client_sync.sql
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
3. **Buổi chỉ ảnh hưởng tiền khi `status='closed'`.** Chia sân và số trận không bao giờ ảnh hưởng tiền.

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

## Đang làm tiếp

Đã xong: schema + RLS + RPC, đăng ký/đăng nhập, màn CLB, phê duyệt, và **cả 13 màn trong CLB đọc
ghi thẳng Supabase** qua `contexts/storage.js` + `contexts/dbmap.js` (đồng bộ ngầm theo từng dòng
— xem `docs/ARCHITECTURE.md` §6).

Còn lại: kiểm RLS bằng hai tài khoản khác CLB, realtime cho chia sân, RPC sinh `transactions` khi
chốt buổi, `audit_logs`, rồi đẩy lên Supabase cloud. Xem `docs/TASKS.md` Phase 7.
