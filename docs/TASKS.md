# TASKS.md

**Version:** v0.2.0 · **Updated:** 2026-08-20

Trạng thái thật của việc dựng app. Cập nhật file này khi xong một mục — đừng để nó nói dối.

Ký hiệu: `[x]` xong và đã kiểm · `[~]` đang làm · `[ ]` chưa làm.

---

## Phase 0 — Nền

- [x] Chọn stack, scaffold Vite + React 19 + React Router 7 (`package.json`, `vite.config.js`, `index.html`)
- [x] Trích design system TDMS từ handoff → `src/ds/index.js` (29 component) + `src/ds/tokens/*.css`
- [x] Thay `Icon` CDN jsDelivr bằng `lucide-react` bundled → `src/ds/icons.js` (app chạy offline)
- [x] ESLint 9 flat config + `react-hooks`
- [x] `vercel.json` (SPA rewrite)
- [x] Bộ docs: `ARCHITECTURE.md`, `DATABASE.md`, `FEATURES.md`, `TASKS.md`, `DESIGN.md`, `RULES.md`
- [x] Tầng i18n: `src/i18n/index.js` + `vi.json` (779 key) — không còn chữ cứng trong `.jsx`
- [x] Tầng config: `src/config/app.json` (hằng số) + `permissions.json` (ma trận quyền)
- [x] Cấu trúc chuẩn: `components/{ds,layout,ui}` · `config` · `contexts` · `data` · `hooks` ·
      `i18n` · `lib` · `pages` · `routes` · `styles` · `utils` + alias subpath `#...`
- [x] `hooks/useClock.js` · `lib/forms.js` · `contexts/storage.js`

## Phase 1 — Logic thuần (test được bằng `node`, không cần render)

- [x] `logic/dates.js` — ngày/tháng/giờ thập phân/lưới lịch/sinh ngày theo thứ
- [x] `logic/money.js` — mọi công thức tiền + tra cứu + màu trạng thái
- [x] `logic/ledger.js` — sổ quỹ, số dư, gộp dòng, tổng hợp theo ngày
- [x] `logic/assign.js` — slot, 5 chế độ xếp, chia đều, số trận, cân trình độ
- [x] `logic/roles.js` — ma trận quyền 5 vai
- [x] `__tests__/fixture.js` — bộ dữ liệu cố định cho test (trước là `data/seed.js`, app không import)
- [x] `store.js` + `actions.js` — state, persist, mọi hành động ghi dữ liệu
- [x] `__tests__/dates.test.js`
- [x] `__tests__/money.test.js`
- [x] `__tests__/ledger.test.js`
- [x] `__tests__/assign.test.js`

## Phase 2 — App shell

- [x] `main.jsx` + router
- [x] `AppLayout` + `Sidebar` + `AppHeader` + `ToastHost`: sidebar (logo, switcher CLB, nav theo quyền, footer user) + header (tên trang,
      chọn tháng, nút hành động, dải "Xem như: <vai>") + toast + dialog host

## Phase 3 — Màn hình vận hành

- [x] `Home.jsx` — tab Tổng quan + tab Báo cáo
- [x] `Sessions.jsx` — 4 StatCard + bảng buổi (tab Tất cả/Chưa chốt/Đã chốt)
- [x] `SessionDetail.jsx` — điểm danh · sân buổi · khách giao lưu · chốt tiền
- [x] `Assign.jsx` — chia sân, 5 chế độ, cố định người theo sân, bấm giờ, ghi trận
- [x] `Calendar.jsx` — lưới tháng
- [x] `Schedules.jsx` — lịch cố định + dialog tạo hàng loạt
- [x] `Members.jsx` — danh sách + 2 hàng chờ duyệt

## Phase 4 — Màn hình tiền

- [x] `Debts.jsx` — 4 nhóm: theo người rủ · theo khách · quỹ tháng · back tiền
- [x] `Fund.jsx` — tab Tổng hợp tháng / Chi tiết thu chi + hoá đơn sân
- [x] `Shuttles.jsx` — mua cầu · tiêu thụ · kiểm kho cuối tháng

## Phase 5 — Tài khoản

- [x] `Profile.jsx`
- [x] `Settings.jsx` — 6 tab, gồm tab Tài khoản & quyền (ghép/mời/gợi ý trùng SĐT)
- [x] `Schema.jsx` — trang tài liệu data model trong app

## Phase 6 — Chốt

- [x] Dialog: tạo lịch hàng loạt · buổi đột xuất · thêm sân · nhập kho · kiểm kho · hoá đơn sân ·
      ghi thu/chi · thêm/sửa thành viên · báo cáo Zalo
- [x] `npm test` xanh
- [x] `npm run lint` sạch
- [x] `npm run build` chạy được (agent đã chạy để kiểm compile — user vẫn nên build lại lần cuối)
- [x] Smoke test: 12 mục sidebar render đủ, 0 console error, 0 icon thiếu
- [ ] **User bấm thử 13 màn, xác nhận UI** ← việc tiếp theo

## Phase 7 — Supabase

- [x] `supabase init` + `config.toml` dải port **553xx** (chạy song song stack dự án khác), tắt `analytics`
      (port 54327 bị Windows chặn), tắt `local_smtp` (không gửi email)
- [x] Sửa `0001_init.sql`: `public.users` → `profiles` gắn `auth.users`, thêm `username`, `phone` nullable
- [x] `0002_auth_rls.sql`: trigger tạo profile, `resolve_login` (email/username/SĐT), `username_available`,
      `create_club`, `join_club_by_code`, `approve_join_request`, `reject_join_request`, `my_clubs`,
      `my_join_requests`, RLS toàn bộ bảng theo `is_club_member` / `has_club_perm`
- [x] Cả hai migration **đã apply thành công** trên Postgres 17 local
- [x] `@supabase/supabase-js` + `src/lib/supabase.js` (thiếu env thì app hiện màn hướng dẫn, không crash)
- [x] `contexts/AuthContext.jsx`: phiên, profile, `my_clubs`, `activeClubId`
- [x] Màn **Đăng ký** (email + username + mật khẩu bắt buộc, SĐT tuỳ chọn) và **Đăng nhập**
      (email / username / SĐT), không OTP không xác thực email
- [x] Màn **CLB của tôi**: chọn CLB · tạo CLB · tham gia bằng mã · xem yêu cầu đang chờ
- [x] Gác cổng: chưa đăng nhập → `/dang-nhap`; đã đăng nhập chưa chọn CLB → `/clb`
- [x] Sidebar dùng CLB thật (`my_clubs`); bỏ dải cảnh báo dữ liệu mẫu vì không còn dữ liệu mẫu
- [x] `0003_levels_and_client_sync.sql`: trình độ theo từng CLB (bỏ enum `skill_level`),
      `club_member_groups`, `sessions.group_mode`, `session_courts.default_minutes`,
      `transactions.payer_name`, RPC `club_pending_requests`, sửa `create_club` +
      `approve_join_request` + `handle_new_user`
- [x] `contexts/dbmap.js` — map thuần client ↔ 30 bảng + `diff()` (3 chế độ ghi: `id` / `key` / `scope`)
- [x] `contexts/storage.js` — `load(clubId)` fetch song song + `save(db)` đồng bộ ngầm theo từng dòng
- [x] `contexts/AppContext.jsx` — nạp async theo `activeClubId`, `reload()`, báo lỗi đồng bộ ra toast
- [x] Id client đổi sang `crypto.randomUUID()`, bỏ sạch bộ đếm `seq`
- [x] Bỏ chế độ dữ liệu mẫu: `data/seed.js` → `__tests__/fixture.js`; thiếu `.env.local` thì app
      hiện màn hướng dẫn thay vì chạy dữ liệu bịa
- [x] `db.myRole` là vai thật; "Xem như" chỉ chọn được vai của mình hoặc yếu hơn
- [x] Cài đặt → Chung: sửa thang trình độ của CLB (thay ô "Xoá dữ liệu local" đã bỏ)
- [x] `__tests__/dbmap.test.js` — khoá hai bất biến: không đổi thì không ghi, đổi một chỗ thì
      ghi đúng một chỗ
- [ ] **User chạy `npm run db:migrate` (hoặc `db reset`) rồi bấm thử 13 màn trên DB thật** ← việc tiếp theo
- [ ] Kiểm RLS bằng 2 tài khoản khác CLB
- [ ] Realtime channel theo `session_id` cho `session_lineups` + `matches`
- [ ] Trigger `audit_logs`; RPC sinh `transactions` khi chốt buổi (không phụ thuộc client)
- [ ] Đẩy lên Supabase cloud: đổi `VITE_SUPABASE_URL` + `ANON_KEY`, chạy migration bằng `supabase db push`

## Phase 8 — Sau đó (đã có bảng, chưa cần code)

- [ ] Nhắc điểm danh / đóng quỹ / nợ (`notifications`)
- [ ] Zalo OA (`zalo_links`) — hiện tại chỉ có "copy báo cáo Zalo" dạng text
- [ ] Bản mobile cho vai `member`: 3 màn Trang chủ · Chia sân · Cá nhân (density Driver App)

---

## Bug đã tìm và sửa trong lúc dựng

| Bug | Triệu chứng nếu để nguyên | Đã sửa |
| --- | --- | --- |
| `db0Form()` đọc `ui.form` qua `setUi(u => u)` | updater React không chạy đồng bộ → mọi action dùng form (thêm khách, tạo lịch, nhập kho…) đọc được `{}` | dùng `uiRef.current.form` |
| Ghi ref trong lúc render (`dbRef.current = db`) | render bị bỏ dưới concurrent rendering → ref trỏ vào state chưa commit | chuyển vào `useLayoutEffect` |
| Toast của `toggleSchedule` bị ngược | tắt lịch mà toast báo "Đã bật lịch" | đọc state TRƯỚC khi ghi |
| Thiếu 5 icon mà component TDMS tự dùng (`info`, `truck`, `triangle-alert`, `circle-pause`, `ellipsis`) | Alert/StatusPill/DataTable hiện ô icon trống | thêm vào `ds/icons.js`, có audit tự động |
| Test `fmtK(-2500)` kỳ vọng sai | — (test sai, không phải code sai) | sửa test, ghi chú quirk `Math.round` làm tròn .5 về +∞ |
| `DROP TYPE skill_level` mà không sửa `handle_new_user` | thân hàm plpgsql chỉ là text nên Postgres KHÔNG chặn; đăng ký tài khoản mới sẽ chết lúc chạy | `0003` tạo lại `handle_new_user` trước khi drop type |
| Đổi CLB giữa lúc đang đồng bộ | ảnh chụp của CLB cũ đè lên CLB mới → lần save sau **xoá dữ liệu CLB cũ** | `flush()` kiểm lại `synced.clubId === cid` trước mỗi lần ghi ảnh chụp |
| "Xem như" cho chọn cả vai mạnh hơn vai thật | UI mở ra nhưng RLS chặn → người dùng chỉ thấy lỗi không hiểu | `viewAsOptions()` chỉ trả vai của mình và yếu hơn |
| `createSchedule` / `createAdhoc` gán cứng `shuttleTypeId: 'S1'` | id của dữ liệu mẫu, trên DB thật là khoá ngoại chết | lấy `d.shuttleTypes[0]`, không có thì `null` |

---

## Quyết định đang chờ user

| Việc | Vì sao cần user | Chặn cái gì |
| --- | --- | --- |
| Chạy `npm run db:start` + `db:migrate` + `db:env > .env.local` | agent không tự cài/chạy hạ tầng trên máy user | chạy được app |
| Có xoá sạch DB (`npx supabase db reset`) hay giữ tài khoản cũ | mất data, phải user quyết — `docs/RULES.md` §7 | bắt đầu sạch |
| Dữ liệu thật của CLB (Excel) | cần số quỹ mang sang + danh sách thật | nhập liệu ban đầu |
