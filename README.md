# Quản lý CLB cầu lông

Web app quản lý một hoặc nhiều câu lạc bộ cầu lông sinh hoạt định kỳ: lịch tập cố định → điểm danh
từng buổi → khách giao lưu → chốt tiền buổi → quỹ tháng, công nợ, back tiền → báo cáo tài chính.
Kèm module **Chia sân** (kéo thả, xếp thông minh, bấm giờ, đếm số trận), **Hệ thống Thi đấu & Kèo đấu**
(Challenge, Elo Rating, 8 bậc Rank, Ma trận H2H) và hệ **tài khoản – nhiều CLB – phân quyền 3 vai (Chủ CLB, Thủ quỹ, Thành viên)**.

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

CLB mới tạo ra gần như **rỗng**: chỉ có bạn (vai `owner`) và thang trình độ mặc định. Sân · nhóm
cố định · thành viên · giá khách tự nhập ở **Cài đặt**. Đó là dữ liệu thật của CLB bạn, app không bịa hộ.

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
| `npm test` | test logic tiền / sổ quỹ / chia sân / ngày tháng / CSV / map ↔ Postgres / Elo |
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
    challenge/         CreateChallengeModal · ScoreModal · EditScoreModal · RatingLineChart · AttachVideoModal · MatchVideoPlayerModal · VideoTimelineEditor
    home/              ActivityTab
    notification/      NotificationBell · NotificationPanel
    session/           CourtAssignmentTab · SessionMatchesTab · PlannerModal · VoiceMatchModal
    settings/          SettingsComponents.jsx · tabs/ (Access · Courts · General · Groups · Money · Schedules)
    ds/                design system TDMS (VENDORED — không sửa tay)
    layout/            AppLayout · Sidebar · AppHeader · MobileFooterNav · MoreSheet · ToastHost
    ui/                primitive của app (Mono, LevelChip, Empty, Bar, AvatarUpload, BankAccountSection, QrModal, SearchSelect…)
  config/              app.json (hằng số, rating cfg) · permissions.json (ma trận quyền)
  contexts/            AuthContext.jsx (phiên + CLB của tôi) · AppContext.jsx (state 1 CLB)
                       ThemeContext.jsx (Dark / Light / System mode)
                       appActions.js (mọi hành động ghi) · storage.js (I/O duy nhất) · dbmap.js (map ↔ Postgres)
  data/                schema.js · rankThemes.js · rankThemes.json
  hooks/               useClock.js · useMobile.js
  i18n/                index.js · vi.json            ← MỌI chữ
  lib/                 activity · assign · badge · challenge · csv · forms · ledger · matchSearch · members · money · planner · rating · roles · schedules · season · supabase · xp (THUẦN, test được)
  pages/               14 màn trong CLB (kèm Leaderboard, Matches) + Account · Clubs · Login · Register + Dialogs
  routes/              bảng route key ↔ URL
  styles/              index.css + tokens/ (dark.css, semantic.css, base.css…)
  utils/               dates.js · image.js · vietqr.js · voiceMatchParser.js
  __tests__/           60+ file test cho components/ · lib/ · money/ · ledger/ · sync/ · smoke/ · backtest/ · activity/ (357 tests pass 100%)
supabase/migrations/   SQL cho bản chạy thật (0001..0039)
docs/                  RULES · ARCHITECTURE · DATABASE · FEATURES · TASKS · BACKTEST · HE_THONG_RATING_VA_DIEM_MUA (+ DESIGN.md ở gốc)
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
| [docs/BACKTEST.md](docs/BACKTEST.md) | Hướng dẫn chạy lại lịch sử thật để kiểm tra công thức Elo & Điểm mùa |
| [docs/HE_THONG_RATING_VA_DIEM_MUA.md](docs/HE_THONG_RATING_VA_DIEM_MUA.md) | Đặc tả chuyên sâu toán học và kiến trúc 3 trục điểm độc lập |
| [DESIGN.md](DESIGN.md) | Token màu/chữ/spacing, khung app, copywriting |

## Tính năng đã hoàn thành

- **Quản lý vận hành & Tài chính**: Lịch cố định, Buổi tập, Điểm danh, Khách giao lưu, Quỹ CLB, Công nợ chi tiết, Tự khai nợ/chuyển khoản (`payment_claims`), Nhãn số sân (`court_label`), Ưu đãi giảm trừ đi thêm cho hội viên (`member_extra_discount`), Báo cáo Zalo, Nhập danh sách CSV, Sao lưu cấu hình JSON. Đơn giản hóa dòng tiền (gỡ bỏ kho cầu phức tạp theo Migration 0023, chi tiền mua cầu trực tiếp ở sổ quỹ).
- **Hợp nhất Buổi tập & Chia sân**: Gộp Chi tiết buổi tập và Chia sân thành 3 tabs trực quan (Chia sân kéo thả/xếp tự động, Kèo đấu & lịch sử trận đấu, Điểm danh & Giá thành).
- **Phân hệ Lập Dây Trận (Session Match Planner)**: Lập lịch vòng đấu ca tập đa sân theo vòng (`planner.js`), tự động ưu tiên Kèo thách đấu đã nhận (`ACCEPTED`), giải quyết xung đột Nguyện vọng người chơi, luân chuyển công bằng lượt đấu và loại trừ người vắng mặt/noshow.
- **Hệ thống Kèo đấu & Sàn Đấu (Challenge & Matches)**: Gạ kèo 1v1 / 2v2, dự báo Elo win%, cảnh báo lệch trình, xếp kèo trực tiếp lên sân trống, gác hết hạn kèo (`expiresAt`), chống đè slot 1v1->2v2, hỗ trợ tạo kèo tự do ngoài buổi và gán vào buổi chơi thực tế (`linkChallengeToSession`).
- **Trận đấu Video Replay & Mốc Timeline**: Hỗ trợ gắn link video (YouTube, Facebook, Google Drive), nhận diện thumbnail, phát video replay trực tiếp, gắn mốc thời gian nổi bật (`video_timeline`) và bộ đếm lượt xem an toàn qua RPC.
- **Bảng xếp hạng Elo & Thống kê nâng cao (Leaderboard)**: Khởi điểm 0 Elo, tính điểm chuẩn quốc tế kèm thưởng upset, 5 cấp độ tin cậy R1–R5, Dynamic K-Factor, Margin of Victory, Elo Floor >= 0, 8 bậc Slang Rank Tiers (Gà Con -> Độc Cô Cầu Bại), Inactivity Decay, Playstyle Badges, Tìm trận đa năng, Sửa điểm trực tiếp có lưu vết kiểm toán và cascade tính lại Elo, Ma trận đối đầu CLB (H2H matrix), Thống kê hiệu chỉnh chéo giới tính (Cross-gender calibration).
- **Đua Top Mùa Giải & Trục Gắn Bó (Season Race & Badges)**: Cày rank 5 dải delta theo Quý, sàn Floor = 0, thưởng chuỗi thắng, thưởng Upset, Vua Lì Đòn (Bounty Player) và thưởng phá chuỗi (`bounty_broken`), hệ thống XP & Cấp bậc vĩnh viễn, Kệ 3 huy hiệu danh dự (`badge_shelf`) trên hồ sơ cá nhân.
- **Framework Backtest Lịch sử Thật**: Bộ công cụ chạy lại toàn bộ trận đấu lịch sử của CLB đối chiếu với mốc chuẩn (baseline), bảo đảm tính ổn định tuyệt đối của công thức tính điểm (Rule §0).
- **Thông Báo Cá Nhân & Bảng Tin Hoạt Động (Notifications & Social Activity Feed)**: Chuông thông báo cá nhân (`NotificationBell`) với huy hiệu unread theo thời gian thực, 13 loại thông báo cá nhân có điều hướng tức thời kèm nút bấm tương tác RSVP 1 chạm (lời mời điểm danh `session_rsvp_invite`, thông báo điểm danh gửi riêng Chủ CLB `attendance_reported`, thách đấu, nhận/từ chối/kết thúc kèo, kết quả trận, sửa điểm, phá chuỗi thắng đối thủ, duyệt/từ chối tiền khai, duyệt/từ chối gia nhập CLB), thẻ tự điểm danh (`SelfAttendanceCard`) trực quan trong buổi chơi, 5 khối điểm nhấn thành tích cá nhân (Personal Highlights) tính on-demand không lưu DB (cặp bài trùng ăn ý nhất, cạ cứng mới toàn thắng, kỳ phùng địch thủ, rửa hận phá dớp kỵ giơ, chuỗi thắng phong độ cao). Tab Bảng tin hoạt động (`ActivityTab`) tại Trang chủ lazy-load trực tiếp từ `activity_events` theo dòng thời gian phân trang, thuật toán nhận diện kịch tính trận đấu (Match Narratives: Nghẹt thở/Clutch, Áp đảo/Blowout, Lội ngược dòng/Comeback, Tiêu chuẩn/Normal), tuân thủ nghiêm ngặt chuẩn payload thuần ID/key (Rule §3.3) và cách ly RLS an toàn.
- **357/357 automated test cases pass 100%**.
- `npm run lint` sạch (0 warning, 0 error). Responsive tối ưu trên màn hình điện thoại từ 390px đến máy tính bảng/desktop.
