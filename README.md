# Quản lý CLB cầu lông

Web app quản lý một hoặc nhiều câu lạc bộ cầu lông sinh hoạt định kỳ: lịch tập cố định → điểm danh
từng buổi → khách giao lưu → chốt tiền buổi → quỹ tháng, công nợ, back tiền → kho cầu → báo cáo.
Kèm module **Chia sân** (kéo thả, xếp thông minh, bấm giờ, đếm số trận) và hệ **tài khoản – nhiều
CLB – phân quyền 5 vai**.

Bài toán gốc: CLB đang quản lý bằng Excel + Zalo. Người dùng chính là chủ quỹ, làm việc trên điện
thoại/laptop ngay tại sân. Vì vậy: **không ai phải nhập thứ mà app tự suy ra được**, và **mọi con
số đều phải giải thích được nguồn gốc**.

## Chạy

App có **hai chế độ**, tự nhận biết theo `.env.local`:

| Chế độ | Khi nào | Dữ liệu |
| --- | --- | --- |
| **Dữ liệu mẫu** | chưa có `.env.local` | localStorage, seed 2 CLB mẫu tháng 08/2026. Không cần đăng nhập, vào thẳng app |
| **Thật** | có `.env.local` | Supabase local (Docker). Phải đăng ký / đăng nhập, rồi chọn CLB |

### Chế độ dữ liệu mẫu — chạy ngay

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Xem trước màn đăng nhập/đăng ký tại `/dang-nhap`, `/dang-ky`, `/clb`.

### Chế độ thật — cần Docker Desktop đang chạy

```bash
npm run db:start
```

Lần đầu sẽ tải image (vài phút). Xong thì lấy key và ghi vào `.env.local`:

```bash
npm run db:env > .env.local
```

Khởi động lại dev server để Vite đọc env mới:

```bash
npm run dev
```

Sau đó: `/dang-ky` tạo tài khoản → `/clb` tạo CLB hoặc nhập mã → vào app.

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
| `npm test` | test logic tiền / sổ quỹ / chia sân / ngày tháng |
| `npm run lint` | ESLint |
| `npm run db:start` · `db:stop` · `db:status` | quản lý Supabase local |
| `npm run db:env` | in env để ghi vào `.env.local` |

Xoá dữ liệu mẫu trong trình duyệt: Cài đặt → Chung → *Xoá dữ liệu local*.

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
  contexts/            AuthContext.jsx (phiên + CLB của tôi) · AppContext.jsx · appActions.js · storage.js
  data/                seed.js · schema.js
  hooks/               useClock.js
  i18n/                index.js · vi.json            ← MỌI chữ
  lib/                 money · ledger · assign · roles · forms  (THUẦN, test được)
  pages/               13 màn trong CLB + Login · Register · Clubs + Dialogs
  routes/              bảng route key ↔ URL
  styles/              index.css + tokens/
  utils/               dates.js
  __tests__/           test cho lib/ và utils/
supabase/               config.toml · migrations/0001_init.sql · 0002_auth_rls.sql
docs/                   RULES · ARCHITECTURE · DATABASE · FEATURES · TASKS
DESIGN.md
```

Import bằng alias subpath của Node (`#lib/…`, `#ui`, `#ds`, `#i18n`) — chạy được ở cả Vite và
`node` chạy test.

## Ba luật không được vi phạm

1. **Không hard-code chữ hay hằng số.** Chữ ở `src/i18n/vi.json`, số ở `src/config/*.json`.
   Dữ liệu ghi vào DB (như `transactions.category`) lưu **key**, không lưu chữ hiển thị.
2. **Tiền là `bigint` VND, không lưu số đã làm tròn.** `transactions` là sổ quỹ duy nhất.
3. **Buổi chỉ ảnh hưởng tiền khi `status='closed'`.** Chia sân và số trận không bao giờ ảnh hưởng tiền.

Chi tiết: [docs/RULES.md](docs/RULES.md).

## Đọc tài liệu theo thứ tự

| File | Nội dung |
| --- | --- |
| [docs/RULES.md](docs/RULES.md) | Policy cho người và cho agent — đọc trước khi sửa gì |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, cây file, phân lớp, đường lên Supabase |
| [docs/FEATURES.md](docs/FEATURES.md) | Chức năng từng màn + luật nghiệp vụ dễ sai |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, nguồn của từng con số, map localStorage ↔ Postgres |
| [docs/TASKS.md](docs/TASKS.md) | Trạng thái thật của việc dựng app |
| [DESIGN.md](DESIGN.md) | Token màu/chữ/spacing, khung app, copywriting |

## Đang làm tiếp

Đã xong: schema + RLS + RPC trên Supabase local, đăng ký/đăng nhập, màn CLB (tạo · tham gia bằng mã),
phê duyệt trong Cài đặt.

Còn lại: **13 màn trong CLB vẫn đọc dữ liệu mẫu ở localStorage.** Việc còn lại là thay `load()`/`save()`
trong `src/contexts/storage.js` bằng query Supabase theo `activeClubId`, và cho từng action trong
`appActions.js` ghi thẳng DB. Không màn hình nào phải sửa. Xem `docs/TASKS.md` Phase 7.
