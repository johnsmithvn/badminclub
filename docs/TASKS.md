# TASKS.md

**Version:** v0.9.0 · **Updated:** 2026-08-31

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
- [x] Tầng i18n: `src/i18n/index.js` + `vi.json` (943 chuỗi) — không còn chữ cứng trong `.jsx`
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
- [x] `npm test` xanh — 7 bộ: dates · money · ledger · assign · dbmap · empty · i18n
- [x] `npm run lint` sạch
- [x] Audit icon: 0 icon thiếu (kể cả icon component TDMS tự dùng bên trong)
- [ ] `npm run build` — **CHƯA ai chạy sau khi nối DB.** Lần chạy được ghi nhận là ở phiên dựng
      UI với dữ liệu mẫu, từ đó code đã đổi gần hết tầng dữ liệu. Lint đã parse hết JSX nên lỗi
      cú pháp thì không còn, nhưng đó không phải bằng chứng build pass
- [ ] Smoke test lại 13 màn — bản cũ chạy trên dữ liệu mẫu, giờ không còn chế độ đó nữa

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
- [x] Thêm sân · thêm nhóm cố định · thêm loại cầu ngay trong Cài đặt (prototype không có, CLB rỗng
      trước đây là ngõ cụt: không sân → không nhóm → không lịch → không buổi)
- [x] Thẻ "CLB mới — năm bước để dùng được" ở Trang chủ (sân → nhóm → thành viên → lịch → giá khách),
      tự ẩn khi đủ dữ liệu nền
- [x] Skeleton lúc nạp CLB (handoff 02: "Tải: skeleton, không spinner")
- [x] Thành viên tự xin đổi trình độ / SĐT ở Trang cá nhân → `member_changes` chờ duyệt
      (handoff 01 §6 — trước đây không có chỗ nào TẠO ra bản ghi này, tab duyệt là màn chết)
- [x] `__tests__/empty.test.js` — gọi toàn bộ selector thuần với CLB rỗng, chặn throw / NaN / Infinity
- [x] `__tests__/i18n.test.js` — hai phần: (a) quét regex 732 key viết THẲNG trong code, (b) các
      **họ key ghép động** (`nav.*` `roles.*` `assign.modes.*` `ledger.cat.*` `setup.step.*`
      `settings.tab*` `sessionState.*` `gender.*` `rosterState.*` `schema.group*`) — loại thiếu key
      mà regex không thấy và màn hình sẽ hiện thẳng chuỗi `nav.shuttles`. Cộng luật: giá trị trong
      `vi.json` chỉ được là chuỗi / mảng chuỗi / object lồng — số lọt vào là hằng số đặt sai chỗ
- [ ] **User chạy `npm run db:migrate` (hoặc `db reset`), `npm run build`, rồi bấm thử 13 màn trên DB thật** ← việc tiếp theo
- [x] **Kiểm RLS bằng 2 tài khoản khác CLB — ĐẠT 2026-09-01.** Không cần script node và không
      đụng DB của user: dựng Postgres 17 sạch trong container dùng một lần, áp schema, tạo 2 tài
      khoản qua trigger `handle_new_user`, mỗi người một CLB, rồi đóng vai B bằng
      `SET ROLE authenticated` + `request.jwt.claim.sub`.
      B thấy **0** dòng của A ở mọi bảng (kể cả `profiles`); chèn giao dịch / thêm sân vào CLB A
      bị `new row violates row-level security policy`; `UPDATE` · `DELETE` · tự phong `owner`
      đều trả **0 dòng**. Chi tiết ở `DATABASE.md` §7.

- [x] **Gộp 12 migration thành một `0001_init.sql` — 2026-09-01.** Chưa có dữ liệu thật nên gộp
      được; user chốt dựng lại sạch. Kiểm chứng bằng cách chạy song song hai DB (12 file gốc vs
      file gộp) rồi so 920 dòng kê khai schema + md5 của 14 hàm — khớp tuyệt đối, khác đúng một
      dòng comment. File chạy lại nhiều lần không đổi gì. Xem `DATABASE.md` §6.1.
      **Từ đây DB có dữ liệu thật thì thêm file mới, không sửa `0001`.**

### Cố ý hoãn — có lý do, không phải quên

- [ ] **Realtime channel theo `session_id`** cho `session_lineups` + `matches` (handoff 05).
      Hoãn vì: `reload()` từ server giữa lúc người điều phối đang kéo thả sẽ ăn mất thao tác
      đang làm. Phần chống xung đột cần thiết kế riêng, không phải mấy dòng `subscribe`.
- [ ] **Nhận lời mời qua SĐT** (handoff 01 §4.2). Phần TẠO đã xong đúng spec: bản ghi
      `club_invites` + pill "Đã mời DD/MM" trên dòng thành viên. Phần NHẬN (mở link → tạo
      tài khoản → tự ghép vào đúng bản ghi) cần gửi SMS — chưa có kinh phí. Hai cách ghép còn
      lại (mã CLB, gợi ý trùng SĐT) chạy được nên không chặn ai.
- [x] ~~**RPC sinh `transactions` khi chốt buổi**~~ — đã chốt hướng: sổ quỹ lấy sự thật từ
      `transactions`, ghi tại mỗi sự kiện tiền. Chuyển thành **Phase 9 · P6**, làm sau P3–P5.
- [ ] ~~Trigger ghi `audit_logs` cho mọi bảng dính tiền.~~ **Hoãn vô thời hạn 2026-08-24:** sau P6
      thì `transactions` đã là bản ghi bất biến có ngày, có người, có nguồn gốc — `audit_logs` ghi
      lại gần đúng cùng thứ đó lần thứ hai. Mở lại khi thật sự cần truy vết ai sửa gì.
- [ ] Đẩy lên Supabase cloud: đổi `VITE_SUPABASE_URL` + `ANON_KEY`, chạy migration bằng `supabase db push`

## Phase 9 — Rà dòng tiền (đợt 2026-08-20)

Kết quả đối chiếu toàn bộ tầng tiền với đặc tả hỏi-đáp dòng tiền. Luật đã chốt nằm ở
`DATABASE.md` §3 · §3.1 · §8 — đọc trước khi làm bất kỳ mục nào dưới đây.

**Kết luận rà:** 10/12 luồng đã chạy đúng đặc tả. Hai luồng tự nhận là issue (sổ quỹ suy ra ·
giá thành trôi), cộng 5 chỗ lệch tìm thêm khi đọc code.

### Thứ tự đã chốt

`P1 → P2 → P3 → P4 → P5 → P6 → P7`. Issue 2 (sổ quỹ ghi thật) để **sau cùng** vì P3/P4/P5 đổi
chính tập sự kiện sinh tiền — viết tầng ghi trước là viết lại lần hai.

### P1 · Lệch nhỏ + Issue 6 + N1–N4 — không đụng schema · **XONG 2026-08-20** (chờ user bấm thử)

- [x] **L1 · "Quỹ bù" hai màn hình ra hai số.** `SessionDetail.jsx` tính `cost − rev − sold`,
      `money.js: costRow` tính `cost − rev`. `courtNet` đã loại sân bán khỏi chi phí rồi, trừ
      thêm `soldAmount` là tính lợi ích bán sân lần thứ hai. **Chốt theo đặc tả:**
      `quỹ bù = chi phí − thu khách`; SessionDetail gọi thẳng `costRow()`, bỏ công thức riêng.
- [x] **L2 · `session.closeRule` nói ngược đặc tả.** Câu hiện tại — *"Buổi chỉ vào sổ quỹ khi đã
      chốt"* — chính là câu gây ra hiểu nhầm N1. Chốt buổi chỉ ghi sổ sân bán · sân thuê thêm ·
      tiền sân mode `session`.
- [x] **Issue 6 · Kiểm kho lấy sai tháng.** `appActions.js: applyCheck` dùng `d0.month` (tháng
      đang chọn ở header) thay vì tháng của `ckDate`. Kiểm ngày 31/08 khi header ở tháng 09 →
      lệch tháng 8 chia vào buổi tháng 9, sai hai tháng cùng lúc và không ai biết.
      Kèm dòng xem trước trong dialog: *"Chia vào 8 buổi ước tính của tháng 08/2026 · +2 quả mỗi buổi"*.
- [x] **N1 · Card "Chốt tiền buổi này" trông y như hoá đơn.** Đổi nhãn → "Giá thành buổi này",
      subtitle *"Chỉ để biết buổi tốn bao nhiêu — không ghi vào sổ quỹ"*, caption dưới bốn ô nói
      rõ tiền sân đã trả theo hoá đơn tháng, tiền cầu đã trả khi nhập kho.
- [x] **N2 · "Quỹ phải bù" đọc như quỹ đã trả** → "Quỹ đang gánh".
- [x] **N3 · Tiền cầu hiện trên buổi mà ngày đó không có tiền ra.** Ghi nguồn ngay cạnh số:
      *"34 quả × 27.500 đ/quả · giá bình quân kho"*.
- [x] **N4 · Tiền sân từng buổi ≠ hoá đơn tháng.** Khi `court_pay_mode='month'`, badge nhỏ
      *"theo hoá đơn tháng"* cạnh ô tiền sân của buổi.
- [x] **L5 · Bảng "Giá thành từng buổi" chỉ liệt kê buổi `closed`** (`Home.jsx`) — đã làm ở **P2**
      cùng badge trạng thái, giờ liệt kê mọi buổi trong tháng trừ buổi huỷ.
- [x] Test: khoá `costRow` (bán sân không trừ vào quỹ bù) và `checkPreview` (tháng lấy từ ngày
      kiểm) trong `__tests__/money.test.js`; `checkPreview` thêm vào `__tests__/empty.test.js`.

### P2 · Issue 5 + 7 · Đóng băng giá thành — migration `0005` · **XONG 2026-08-20**

- [x] `sessions` thêm 7 cột `cost_*` (`DATABASE.md` §8) + `stock_checks UNIQUE (club_id, month)`
      — `0005_cost_freeze.sql`, chạy lại được nhiều lần.
- [x] Chốt buổi → đóng băng (`money.js: freezeCost`); mở lại / huỷ → `unfrozenCost()` cho số sống
      lại. `costRow` đọc số đã lưu khi `costFrozenAt` khác NULL, **không tính lại**.
- [x] Kiểm kho → chỉnh số cầu rồi đóng băng CỨNG lại các buổi đó. Nút Kiểm kho và ô "còn lại
      trong tủ" dùng chung một hàm `stockCheckPatch` — hai lối vào, một logic.
- [x] Badge 3 trạng thái (`money.js: costState` → `đang tính` · `đóng băng tạm` · `số chốt`) ở
      card buổi và bảng Báo cáo, kèm caption giải thích dưới bảng.
- [x] Banner nhắc kiểm kho (`money.js: checkDue` → `never` · `stale` · `low`). Ngưỡng ở
      `app.json: shuttle.checkRemindMonths / checkLowStock`, không phải số ma thuật trong code.
- [x] Dialog "Nhập đợt cầu" thêm ô tuỳ chọn *"Còn lại trong tủ trước khi nhập"* → sinh luôn một
      `stock_checks`. Đếm TRƯỚC khi nhập, nên tính trên tồn cũ và giá bình quân cũ. Tháng đó đã
      kiểm rồi thì ẩn ô đi (mỗi tháng một lần).

- [x] Test: đóng băng rồi thì mua đợt cầu giá khác / chủ sân tăng giá đều KHÔNG làm đổi số;
      buổi chưa đóng băng thì vẫn trôi (đúng như cũ). `spreadDiff` tổng khớp tuyệt đối. `checkDue`
      đủ 4 nhánh. `dbmap` ghi được `cost_*` xuống DB và buổi chưa chốt xuống NULL chứ không phải 0.
      Đã mutation-test: tắt nhánh đóng băng và làm hỏng mapping đều bị test bắt.

### P3 · B8 + Issue 1 · Đơn giá đúng + back hai chiều — migration `0007` · **XONG 2026-08-20**

- [x] **B8 · Back tiền tính theo giá hiện tại.** `unitPrice` giờ đọc `monthly_dues.amount` của
      chính người đó; chỉ khi tháng chưa chốt danh sách (chưa có dòng dues) mới rơi về cấu hình nhóm.
- [x] **Issue 1 · Back tiền chỉ chạy một chiều.** `member_adjustments` + `attend_state='extra'` +
      `settle_mode`. `money.js: adjustRows` trả cả hai chiều, dấu ÂM = quỹ nợ người, DƯƠNG = người
      nợ quỹ. Dòng đã chốt thì ĐỌC số đã lưu, không tính lại.
- [x] `settle='offset_next_dues'`: không ghi giao dịch nào. `lockRoster` cộng thẳng dấu vào
      `monthly_dues.amount` tháng sau rồi đánh dấu khoản đó đã xử lý.
- [x] **L4 · `back_credits` xuống DB với `amount = 0`** — bảng mới ghi ĐỦ số. `back_credits`
      giữ nguyên không xoá, dữ liệu cũ được `0007` chuyển sang; app thôi không đọc bảng đó nữa.
- [x] Điểm danh thêm trạng thái **Đi thêm** + ô chọn người đi thêm ngay dưới danh sách. Tab
      "Back tiền" đổi thành **Đối chiếu buổi**: hai chiều, có cột chọn cách trả (tiền mặt / trừ
      tháng sau), hai con số tổng riêng cho phải-trả và phải-thu.

- [x] Test: đơn giá không đổi khi sửa quỹ nhóm giữa chừng · người đi thêm sinh khoản DƯƠNG đúng
      đơn giá của nhóm BUỔI · người đã cố định nhóm đó thì KHÔNG bị tính tiền đi thêm · khoản đã
      lưu đứng yên khi điểm danh đổi · `offset_next_dues` không sinh dòng nào ở sổ quỹ.
      Đã mutation-test cả bốn.

### P3.5 · Chặn vận hành thật — migration `0008` · **XONG 2026-08-20**

Sáu chỗ user gặp ngay khi dựng CLB thật giữa tháng. Không nằm trong đặc tả dòng tiền nhưng chặn
đường dùng, nên chen vào trước P4.

- [x] **Không chốt được danh sách THÁNG NÀY.** Tab cố định hard-code `addMonth(db.month, 1)` nên
      chỉ thấy tháng sau. Dựng CLB giữa tháng thì không sinh được `monthly_dues` tháng này →
      không có gì để thu, không có gì để nhắc. Thêm nút chuyển **Tháng này / Tháng sau**.
- [x] **Thêm người "cố định từ tháng này" mà không sinh khoản thu.** Hai lỗi chồng nhau:
      (a) chỉ ghi cố định cho tháng SAU nên người mới không hiện ở màn điểm danh tháng này;
      (b) tiền tính theo "số buổi còn lại", mà CLB mới dựng chưa có buổi nào → 0 buổi → 0 đồng.
      `money.js: joinDues` xử lý cả hai cảnh: chưa có buổi thì thu trọn gói, có rồi thì thu theo
      số buổi còn lại.
- [x] **Tạo xong không sửa được cố định / không cố định** — cùng gốc với mục đầu, nút chuyển
      tháng giải quyết luôn.
- [x] **Hoá đơn sân và nhập kho gõ tay người trả.** `payer_member_id` trỏ về bản ghi thành viên;
      địa điểm chọn từ danh sách sân ở Cài đặt. Dọn luôn chỗ ghi TÊN người vào cột
      `shuttle_purchases.funded_by` (L3) — tên cũ dồn vào `note`, cột đó trả lại đúng nghĩa
      "nguồn tiền" để P5 `ALTER TYPE` được.
- [x] **Thang trình độ 9 bậc**: Newbie · Y · Y+ · TBY · TBY+ · TB- · TB · TB+ · TBK.
      `levelStyle` chuyển sang chia màu theo VỊ TRÍ trong thang của CLB, không map cứng theo tên
      — map theo tên hỏng ngay khi CLB đặt thang riêng, mà thang là dữ liệu của từng CLB.
- [x] **Người đi lẻ không biết thêm ở đâu.** Hai đường khác nhau, giờ nói rõ trên UI:
      thành viên CLB đi lẻ → "Thêm người đi lẻ" ở khối Điểm danh, trả theo **đơn giá buổi**;
      người ngoài CLB → khối Khách giao lưu, trả theo **bảng giá khách**.

### P4 · Issue 3 · Đóng thiếu — migration `0009` · **XONG 2026-08-20**

- [x] `monthly_dues.paid_amount bigint`. Trạng thái suy ra bằng `money.js: dueState` —
      `none` / `partial` / `full`. KHÔNG drop cột `paid`: giữ lại làm bản sao suy ra
      (`paid_amount >= amount`) để báo cáo SQL cũ không nói dối, drop sau khi chắc.
- [x] Sổ quỹ ghi số **đã nhận**, không phải số phải đóng. Nhãn nói rõ còn thiếu bao nhiêu.
- [ ] Tách từng LẦN thu thành từng dòng riêng — cần bảng `transactions` thật, làm ở **P6**.
      Hiện một khoản = một dòng mang tổng đã nhận.
- [x] UI: ô nhập số tiền ở tab Quỹ tháng (để trống = thu nốt phần còn thiếu) · nút thu nhanh ở
      Trang chủ · nhãn "Thiếu {{amount}}" ở màn điểm danh.
- [x] Test: `dueState` đủ 4 nhánh kể cả đưa dư và số âm rác · sổ quỹ ghi đúng tổng đã nhận ·
      đóng thiếu 150/250 thì sổ chỉ thấy 150. Đã mutation-test.

### P4.5 · Cố định ↔ vãng lai + sửa/xoá thành viên — **XONG 2026-08-20** · không đụng schema

- [x] **`adjustRows` đánh mất khoản đã lưu khi người đó thôi cố định.** Khoản ĐÃ trả thì sổ quỹ
      còn dòng chi mà không còn dòng nào giải thích (đối chiếu ra khoản mồ côi); khoản CHƯA trả
      thì quỹ vẫn nợ mà không ai nhắc. Giờ dòng đã lưu luôn hiện, kèm nhãn `không còn cố định`.
- [x] **Thu hai lần cùng một buổi.** Guard cũ là "có trong danh sách cố định không" — lách được
      bằng cách chuyển sang vãng lai giữa tháng. Điều kiện đúng là **đã có quỹ tháng cho nhóm đó
      chưa**: đóng trọn gói 250.000 đầu tháng thì các buổi tháng đó đã trả rồi.
- [x] **Sửa nhóm cố định ngay trong dialog sửa thành viên** + chọn áp dụng từ tháng này / tháng
      sau (mặc định tháng sau). Gỡ hết nhóm = thành đi lẻ.
- [x] Gỡ nhóm mà tháng đó **chưa đóng đồng nào** → xoá khoản quỹ treo (khỏi bị nhắc oan);
      **đã đóng một phần** → giữ nguyên trong sổ quỹ và ghi chú lý do. Tiền đã vào quỹ thật thì
      không được tự bốc hơi.
- [x] Vào nhóm ở tháng ĐÃ chốt danh sách → sinh khoản quỹ bằng `joinDues`, không thì thu hụt.
- [x] **Ngưng hoạt động** (giữ nguyên lịch sử) và **xoá cứng** (chỉ khi `memberRefs` rỗng — chưa
      dính điểm danh, tiền, trận, tài khoản nào). Xoá cứng dọn luôn bản ghi danh sách cố định,
      không thì khoá ngoại `group_memberships` chặn lúc ghi.
- [x] **`intOf` cho mọi ô nhập số.** `parseInt('1.650.000')` ra **1** — 18 ô nhập tiền trong app
      đang dính, gõ có dấu phân cách nghìn là mất tiền im lặng. Ô thu quỹ tháng điền sẵn số còn
      thiếu.
- [x] Test + mutation-test cả bốn: dòng mồ côi · thu hai lần · `memberRefs` · `intOf`.

### P4.6 · Trình độ + giá khách + đơn giá tự đặt — migration `0010` · **XONG 2026-08-20**

- [x] **CLB tạo trước khi đổi thang mặc định vẫn giữ thang cũ 4 bậc.** Thêm nút *Dùng thang gợi ý
      9 bậc* ở Cài đặt → Chung, khỏi gõ tay. Bảng giá khách vốn đã bám `db.levels` nên tự nở ra
      theo.
- [x] **Gán giá khách hàng loạt.** Thang 9 bậc = 18 ô nhập tay, CLB thực tế chỉ có vài mức giá.
      Nhập một giá → chọn nhiều trình độ → chọn nam / nữ / cả hai → Áp. Bảng chi tiết vẫn còn
      để chỉnh lẻ.
- [x] **`member_groups.unit_male` / `unit_female`** — đơn giá MỘT BUỔI do CLB tự chốt. Nhiều CLB
      không chia theo `quỹ tháng ÷ số buổi` mà chốt thẳng "một buổi 60.000". Điền vào thì đối
      chiếu buổi ưu tiên dùng nó, để trống thì app tự chia như cũ. **Không làm tròn lại** số
      người ta gõ. Màn Đối chiếu gắn nhãn `CLB tự đặt` để không ai đi dò lại phép chia.
- [x] **`setGroupField` nhét chuỗi vào cột số.** Nó đoán kiểu bằng `typeof g[k] === 'number'` —
      sai ngay khi giá trị đang là `null` (đơn giá để trống), lúc đó chuỗi thô đi thẳng xuống
      cột `bigint`. Thay bằng danh sách khoá số khai tay.
- [x] Test + mutation-test đơn giá tự đặt.

### ⚖️ LUẬT NGƯỜI GIỮ QUỸ — user chốt 2026-08-24, chi phối cả P5 và P6

> **Chỉ tiền đi qua tay chủ CLB mới là thu / chi. Tiền ở tay bất kỳ ai khác đều là NỢ.**

Nguyên văn: *"tiền trả dòng tiền từ chủ CLB mới tính là nguồn thu chi nhé, các thành viên khác
đều là nợ hoặc gì đó."*

Hệ quả — mọi khoản sau đây **không** còn sinh dòng thu/chi ngay nữa, mà sinh khoản nợ hai chiều:

| Sự kiện | Trước | Sau luật này |
| --- | --- | --- |
| Thành viên ứng tiền mua cầu | ghi CHI ngay | CLB **nợ** người đó · ghi CHI khi trả họ |
| Thành viên trả hoá đơn sân | ghi CHI ngay | CLB **nợ** người đó · ghi CHI khi trả họ |
| Chủ CLB / thủ quỹ trực tiếp thu, chi | ghi thu/chi | **giữ nguyên** — đây là két thật |

**CHỈ MỘT CHIỀU — user chốt 2026-08-24.** Chiều ngược lại (quản trò thu hộ tiền khách → người đó
nợ quỹ) **KHÔNG làm**. Nguyên văn: *"kiểu gì chủ CLB thu tiền xong mới ghi vào quỹ, nghĩa là thu
xong của người nhận hộ rồi mới thu quỹ, bản chất vẫn là khách nợ. Không cần rườm rà phức tạp
quá."* Tiền quản trò đang cầm cứ để nguyên là **khách nợ** cho tới lúc vào két — không sinh thêm
loại bản ghi nào. Kéo theo: **không** cần cột "người thu" ở `session_guests`.

Việc này biến P5 từ "một tính năng ứng tiền" thành **mô hình chung của mọi khoản tiền không
qua két**.

**Két là ai — user chốt 2026-08-24:** mọi người có vai **`owner` hoặc `treasurer`** (tức có flag
`money` trong `permissions.json`). Không thêm cột `treasurer_member_id`, dùng luôn ma trận quyền
đã có: đổi thủ quỹ thì không phải sửa cấu hình nào.

**Két tự ứng tiền — user chốt 2026-08-24:** ghi **CHI thẳng, KHÔNG tạo khoản nợ**. Tiền túi chủ
CLB và tiền quỹ coi như một. Đánh đổi đã biết và chấp nhận: không đọc được chủ CLB đang bỏ ra
bao nhiêu tiền túi.

### P5 · Issue 4 + L3 · Thành viên ứng tiền — migration `0011` · **XONG 2026-08-24** (chờ user bấm thử)

- [x] ~~**L3 · Dọn dữ liệu trước.**~~ Đã làm ở `0008_payer_link.sql` cùng P3.5: tên gõ tay dồn
      vào `note`, `dbmap.js` ghi `funded_by` = nguồn tiền, người trả sang `payer_member_id`.
- [x] **`0011_advance_repaid.sql` — hai cột, không bảng mới.** `shuttle_purchases.repaid_at` +
      `court_bills.repaid_at`. Khoản nợ CHÍNH LÀ bản ghi mua cầu / hoá đơn đã có, chỉ thiếu ngày
      CLB trả lại người ta.
- [x] `money.js: isVault(db, payerId)` = `can(role,'money')` — không thêm cột nào, vai đã có sẵn ở
      `club_members.role`. `payerId` rỗng = quỹ trả thẳng, cũng là két. Id chết → `false`, thà giữ
      một khoản nợ để người ta thấy còn hơn nuốt mất im lặng.
- [x] `money.js: advanceRows(db)` gộp mua cầu + hoá đơn sân thành một danh sách. Không lọc theo
      tháng: quỹ nợ từ tháng 6 thì tháng 8 vẫn còn nợ.
- [x] `ledger.js: paidOn()` — két trả thì chi vào sổ ngày mua; thành viên ứng thì **chưa có dòng
      nào** cho tới khi `repaidAt` có, và dòng đó mang **ngày trả**, không phải ngày mua. Nhãn
      `ledger.label.repay` nhắc lại ngày mua gốc, không thì đọc tưởng hôm đó mới đi mua cầu.
- [x] `appActions.js: repayAdvance(kind, id)` — bấm lại lần nữa thì gỡ đánh dấu. Đọc trạng thái
      TRƯỚC khi ghi (bài học `toggleSchedule`).
- [x] Tab **Quỹ nợ** ở màn Công nợ, kèm Alert giải thích vì sao khoản này chưa có trong sổ quỹ.
- [x] Test + mutation-test 4 nhánh (`paidOn` · nhánh purchases · `isVault` · lọc két trong
      `advanceRows`); `dbmap` khoá `repaid_at` hai chiều (chưa trả → NULL, không phải chuỗi rỗng).

**Ba thứ đặc tả Issue 4 đề xuất mà KHÔNG làm** — cắt 2026-08-24, có lý do, đừng thêm lại:

| Cắt | Vì sao |
| --- | --- |
| Bảng `member_payables` | dữ liệu đã nằm ở `shuttle_purchases` / `court_bills`; chép sang bảng thứ hai là lưu một sự thật ở hai chỗ |
| `dir` / nợ hai chiều | chỉ còn một chiều (xem luật ⚖️) |
| `ref_type` + `ref_id` + `settled_tx_id` | bản ghi mua cầu **chính là** nguồn gốc, không cần trỏ đi đâu. P6 cần id thì `ALTER` một dòng |
| `ALTER TYPE funded_by → enum fund_source` | thừa — "quỹ trả hay thành viên ứng" suy ra từ `payer_member_id` + vai. Hai cột nói cùng một điều là chỗ để chỏi nhau |

**Đánh đổi đã báo user:** sau P5 số dư quỹ **cao hơn** trước đúng bằng tổng khoản đang nợ — vì
tiền đó thật sự còn trong két. Cho tới khi có T2 ("số dư khả dụng") thì phải tự nhớ trừ.

### P6a · Sổ quỹ thôi nhảy số khi giá sân đổi — migration `0012` · **XONG 2026-09-01** (chờ user bấm thử)

Rà lại 7 nhánh suy ra của `ledger()` trước khi làm P6 đầy đủ: **chỉ 2/7 nhánh thật sự trôi.** Năm
nhánh kia (`dues` · `guest` · `courtSold` · `courtBills` · `shuttle` · `adjustments`) đều đọc số
đã lưu sẵn trong bản ghi. Hai nhánh trôi là **`court` mode `session`** và **`courtExtra`** — cả
hai gọi `courtCost()` / `courtExtraCost()`, cộng từ `rowCost` = số giờ × giá sân **hiện tại**.

Nghĩa là phần lớn lý do tồn tại của P6 (*"số tháng đã chốt tự nhảy"*, `DATABASE.md` §1 luật 3) đã
được P2 giải quyết từ 2026-08-20, chỉ sót đúng đường tiền sân — **cùng một lớp lỗi với L1
(`SessionDetail`) và `copyZalo`, đã sửa hai lần ở chỗ khác, sót chỗ thứ ba này.**

- [x] **`0012_court_cost_freeze.sql` — một cột, không bảng mới.** `session_courts.cost`. NULL =
      chưa chốt, đọc giá sống.
- [x] **Đóng băng ở tầng DÒNG, không thêm cột cho từng hàm.** Cả 5 hàm tiền sân (`rowCost` ·
      `courtCost` · `courtBase` · `courtExtraCost` · `courtNet`) cộng từ đúng một chỗ, nên khoá
      `rowCost` là cả 5 đứng yên cùng lúc và **`lib/ledger.js` không phải sửa dòng nào**. Cách kia
      (thêm `cost_court_gross` + `cost_court_extra` vào `sessions`) thì mỗi hàm mới lại một cột,
      và ba nguồn số (dòng · buổi · sổ) phải tự khớp nhau.
- [x] `freezeCost` đóng dấu `cost` vào từng dòng sân; `rowCost` đọc `cost` trước nên **chốt lại
      lần nữa (kiểm kho cuối tháng) là idempotent**, không ăn giá sân mới.
- [x] `unfrozenCost(s)` thả băng cả từng dòng. Gọi trần `unfrozenCost()` vẫn chỉ thả 7 số tầng
      buổi — cố ý, để gọi thiếu tham số KHÔNG hoá thành `courts: []` xoá sạch sân của buổi.
- [x] `dbmap` map hai chiều; buổi chưa chốt xuống **NULL chứ không phải 0** (0 = "sân này 0 đồng").
- [x] Test: chủ sân tăng gấp đôi giá → dòng chi tiền sân của buổi đã chốt **đứng yên**, buổi chưa
      chốt vẫn trôi (giữ hành vi cũ, không backfill) · sân thuê thêm cũng đứng yên · mở lại buổi
      thì số sống lại · `unfrozenCost()` trần không xoá sân. **Mutation-test 6 nhánh, cả 6 bị bắt.**

**Chưa làm, cố ý:** buổi `closed` có sẵn trong DB mà `cost_frozen_at IS NULL` (dữ liệu dựng trước
0005) vẫn trôi như cũ. Không backfill — xem mục cutoff ở P6b.

### P6b · Issue 2 · Sổ quỹ ghi thật — migration `0013` + đổi `lib/ledger.js`

> **Hoãn 2026-09-01 sau khi rà lại.** Sau P6a thì phần *"tiền đang sai"* đã hết; phần còn lại của
> P6 là *"đọc sổ minh bạch hơn"*: dấu vết ai ghi lúc nào · tách từng lần thu thành từng dòng ·
> xoá mềm khi tick nhầm · link tiền ứng ↔ tiền trả nợ. Đánh giá lại sau khi có P7 — lúc đó màn
> Đối chiếu quỹ sẽ chỉ ra sổ còn thiếu gì thật.
>
> **Mốc cutoff: chưa cần quyết.** User xác nhận 2026-09-01 **chưa có dữ liệu thật** — không có
> lịch sử nào để bảo tồn, nên khi làm P6b cứ ghi thật từ đầu. Câu hỏi cutoff chỉ có nghĩa khi sổ
> đã chạy vài tháng.

- [ ] Mỗi sự kiện ở `DATABASE.md` §3.1 ghi ngay một dòng `transactions` kèm `ref_type` + `ref_id`.
- [ ] **Bỏ tick → XOÁ MỀM, không ghi dòng đảo chiều — chốt 2026-08-24.** Bỏ tick hầu hết là sửa
      nhầm chứ không phải giao dịch hoàn tiền; ghi đảo chiều thì sổ đầy cặp +250k/−250k của người
      bấm nhầm. Xoá mềm (`deleted_at` + ai xoá) vẫn giữ đủ lịch sử mà không rác. User đã nêu:
      *"vụ tích nhầm gây rác có thể xảy ra, sau này có thể làm UX chặt chẽ chỗ đấy sau cũng được."*
- [ ] `ledger()` chuyển thành đọc một bảng. Xoá dần **7 nhánh suy ra** (`dues` · `sessionGuests` ·
      `sessions` bán sân · `sessions` sân thuê thêm · `courtBills` · `purchases` · `adjustments`).
      Chỉ `db.manual` và số dư mang sang là dòng thật. **Đếm lại 2026-08-24 — trước ghi nhầm là 5,
      sót `courtBills` và `purchases`, mà đó chính là hai nhánh luật người giữ quỹ đụng vào.**
- [ ] **CUTOFF, không backfill — user chốt 2026-08-24.** Lấy một mốc ngày: từ mốc trở đi sổ ghi
      thật, trước mốc giữ nguyên số suy ra. Backfill là sinh ra chứng từ chưa từng tồn tại.
- [ ] **Áp luật người giữ quỹ** (xem khối ⚖️ trên): dòng `transactions` chỉ sinh khi tiền qua két
      chủ CLB; còn lại vào `member_payables` / khoản nợ ngược.
- [ ] **Link hai chiều tiền ứng ↔ tiền trả nợ** — user yêu cầu 2026-08-24: transaction trả nợ
      phải trỏ ngược về khoản ứng (`ref_type` + `ref_id`) để đọc được *"chi 3.300.000 này là trả
      khoản Thúy ứng mua cầu ngày 05/08"*. Đây là lý do P5 phải để sẵn chỗ móc.
- [ ] Đây là mục đã treo ở "Quyết định đang chờ user" — **đã chốt: làm, nhưng sau cùng.**

### P7 · Mục 4 · Chống sai im lặng

Mười một lỗi nhóm B đều cùng một đặc điểm: **im lặng**, không có gì để so nên không ai phát hiện.
Hai việc dưới bắt được gần hết.

- [x] **Màn "Đối chiếu quỹ" — XONG 2026-09-01** (chờ user bấm thử). Thủ quỹ gõ số tiền thật đang
      giữ, app so với sổ và **liệt kê nghi vấn cụ thể** sắp theo mức khớp, không chỉ báo lệch.
      Bắt: ~~B1~~ (xong ở P7 nhẹ) · ~~B2~~ (xong ở P5) · B3 · B4 · B9 · B10 · B11.
      **KHÔNG có bảng `fund_reconciliations`** (đặc tả đề xuất, cắt 2026-08-24): đối chiếu là một
      phép trừ, tính lại từ đầu mỗi lần cũng tức thì. Lưu lại chỉ để "lần sau đối chiếu phần phát
      sinh" là một bảng nuôi cho một tối ưu không ai cần. Không đụng schema, không migration.

      Một hàm thuần `ledger.js: reconcile(db, counted)` → `{ book, counted, diff, gap, suspects }`
      + tab **Đối chiếu** ở `Fund.jsx`. Bảy nghi vấn, sáu trong số đó tái dùng logic đã có
      (`billsOf` · `dueState` · `availableBalance.back` · `advanceRows` · sân bán để trống ô tiền).

      **`dir` là thứ làm màn này khác một danh sách chung chung.** Mỗi nghi vấn khai chiều nó giải
      thích được: `in` = tiền đã vào két mà sổ chưa ghi thu (quên tick quỹ tháng, quên tick khách) ·
      `out` = tiền đã rời két mà sổ chưa ghi chi (quên hoá đơn sân, đã trả back, đã trả người ứng).
      Không có `dir` thì quỹ đang THIẾU tiền mà câu gợi ý đầu bảng lại là *"quên tick quỹ tháng"* —
      chỉ đúng chiều ngược lại. Sắp xếp: **cùng chiều trước → gần số lệch nhất → `opening` cuối cùng.**

      **`amount = null`** = biết có chuyện nhưng không quy ra tiền được (sân bán để trống chính ô
      tiền đó; chưa từng có hoá đơn sân nào để lấy mốc). Xếp cuối *trong cùng chiều* và không bao
      giờ được đánh dấu "khớp". Đoán 0 thay cho null thì dòng đó khớp với **mọi** độ lệch và chiếm
      đầu bảng vĩnh viễn.

      **KHÔNG cộng tồn kho quy tiền vào đây** — số cầu trong tủ không phải tiền mặt, cộng vào là
      đối chiếu với sao kê ngân hàng lệch đúng bằng giá trị kho. Ô đó đứng riêng ở đầu màn Sổ quỹ.

      `ledger/reconcile.test.js` — mutation-test 6 nhánh (chiều · null · `opening` xếp cuối ·
      quỹ tháng lấy phần còn thiếu · `noBill` không đoán 0 · chưa gõ số ≠ đếm được 0 đồng), cả 6 bị bắt.
- [x] **Cảnh báo quanh việc chốt buổi — XONG 2026-08-24** (chờ user bấm thử). Đặc tả muốn một
      **dialog buộc xử lý**; đã hạ xuống **cảnh báo không chặn** và tách làm hai thời điểm.

      **Trước khi chốt** (`money.js: closeWarnings`, buổi `open`) — 2 mục:
      chưa điểm danh ai · sân đánh dấu bán mà ô tiền để trống (hai ô chỏi nhau).
      KHÔNG chặn nút Chốt: chặn thì có ngày bán sân cho CLB khác mà chưa biết họ trả bao nhiêu là
      không chốt được buổi, trong khi chẳng có lỗi gì.

      **Bỏ khỏi checklist, user chỉ ra là thừa:**
      - *khách còn ghi nợ* — nợ khách lọc theo THÁNG của buổi, chốt hay không đều hiện nguyên ở
        màn Công nợ. Nguyên văn user: *"bản chất việc khách nợ trả hay chưa nó nằm trong công nợ
        mà, chốt hay không ảnh hưởng gì"*. Đúng.
      - *số cầu đang là định mức* — CLB không đếm cầu, định mức là bình thường, nhắc là phiền.

      **Sau khi chốt** (`money.js: costDrift`) — **mục này KHÔNG có trong đặc tả**, tìm ra khi user
      hỏi "sửa được sau khi chốt không". Chốt buổi đóng băng 7 con số; sửa điểm danh / khách / số
      cầu sau đó thì **số tiền không đổi theo và không có gì báo** — sửa vô ích mà tưởng đã xong.
      Cảnh báo liệt kê từng thứ lệch (`chốt X → hiện Y`) + nút **Chốt lại theo số mới**.

      Chỉ so **ba thứ đếm được**: số người · thu khách · số cầu. **KHÔNG so tiền sân** — giá sân
      đổi là đủ làm nó lệch mà chẳng ai sửa gì, cảnh báo ở đó là nhắc oan đúng vào cái mà đóng
      băng sinh ra để chống. Có test khoá: mua đợt cầu đắt gấp 3 → `costDrift` vẫn trả `null`.

      Test + mutation-test 5 nhánh, cả 5 bị bắt. Bắt: B4 · B6, xử lý luôn N1.
- [x] **B1 · Quên nhập hoá đơn sân tháng — 1.920.000, sai nặng nhất.** Alert đỏ ở Trang chủ khi
      tháng có buổi `closed` mà `court_bills` tháng đó trống. **Chỉ khi `courtPayMode = 'month'`**
      — mode `session` ghi tiền sân ngay lúc chốt buổi, nhắc hoá đơn tháng là nhắc sai.
- [x] **B5 · Buổi huỷ không đánh `cancelled`** → `n` cao hơn thật → `unit` thấp → back trả thiếu.
      Buổi quá ngày còn `draft` thì nhắc ở Trang chủ, buộc chọn *đã đánh* hoặc *đã huỷ*.
- [x] **B7 · Buổi để `open` mãi** → sai tồn kho, sai back, sai tiền sân mode `session`, mất khỏi
      báo cáo. Trang chủ hiện số buổi quá hạn chưa chốt.
- [x] Ba mục trên nằm chung `money.js: homeAlerts(db)` (thuần) + `Home.jsx: <Warnings/>`. B5/B7
      quét MỌI tháng, không theo tháng ở header: buổi tháng trước quên chốt vẫn đang làm sai tồn
      kho tháng đó. Test + mutation-test cả bốn nhánh.
- [x] ~~**T1 · `wallets` + `transactions.wallet_id`**~~ — **CẮT KHỎI PHẠM VI, user chốt 2026-08-24:**
      *"cái này kệ nhé không phải issue, chỉ đang quan tâm tới lịch sử minh bạch dòng tiền thôi."*
      Không tách ví / ngân hàng. Đừng bàn lại.
- [x] ~~**T1b · Vai `host` không tick được "khách đã trả"**~~ — **KHÔNG CẦN LÀM. Đặc tả `07` nói
      sai với code hiện tại**, kiểm 2026-08-24:
      - `permissions.json` và seed `role_permissions` (`0001:151`) đều cho `host` cờ **`sessions`**
      - RLS của `session_guests` gác bằng flag **`'sessions'`**, không phải `'money'` (`0002:408`)
      - UI: `<Switch>` tick khách ở `SessionDetail.jsx:245` **không** có `disabled={!canMoney}`
      - route `session` nằm trong danh sách của `host`

      Tức là quản trò **đã** tick được khách đã trả, cả ở UI lẫn RLS. B9 không phải do bị chặn
      quyền — chỉ là **quên tick**. Xử lý bằng checklist chốt buổi + màn Đối chiếu quỹ, đúng chỗ.
- [x] **T2 · Số dư sổ vs số dư khả dụng — XONG 2026-08-24** (chờ user bấm thử).
      `ledger.js: availableBalance(db)` trả `{balance, advance, back, owed, available}`.
      Trừ đúng hai thứ, đều là tiền đã hứa trả và sẽ rời két: **quỹ nợ thành viên ứng tiền** (P5)
      và **back tiền đã chốt, trả tiền mặt, chưa trả**.
      KHÔNG trừ khách nợ / quỹ tháng chưa đóng — đó là phải THU. KHÔNG trừ back
      `offset_next_dues` — trừ thẳng vào quỹ tháng sau, không đồng nào rời két.
      **Sổ quỹ:** StatCard "Số dư khả dụng" cạnh "Số dư quỹ", chỉ hiện khi `owed > 0` (không nợ ai
      thì hai ô nói cùng một số).
      **Trang chủ:** không thêm ô — trang đã 8 ô — mà đổi caption của chính ô số dư.
      Test + mutation-test 4 nhánh (`settle` · `paid` · chiều dấu · bỏ khoản ứng).
- [x] **N5 / mục 8 · Tồn kho quy tiền** ở màn Sổ quỹ (`số quả còn × giá bình quân`) — user đang
      đọc quỹ **thấp hơn** thực tế vì quên số cầu trong tủ. StatCard cạnh "Số dư quỹ".
- [ ] **Gộp 3 mức nhắc kiểm kho (`checkDue`: `never` · `stale` · `low`) còn một câu.** CLB này
      không đếm cầu nên ba sắc thái nhắc chỉ là ba cách nói cùng một việc. Không đáng làm riêng —
      nhặt lúc nào sửa `Shuttles.jsx` vì việc khác. Ghi 2026-08-24.

---

## Phase 10 — Khách giao lưu (đặc tả `08-khach-giao-luu.md`)

> **🕐 LÀM SAU — user chốt 2026-08-24:** *"việc thiết kế khách thì cần làm sau khi hoàn thành các
> issue đã rồi nghĩ cách thiết kế theo issue 08, cần phải thảo luận đã."*
> Thứ tự: xong **P5 → P6 → P7** rồi mới mở lại mục này, và **thảo luận thiết kế trước khi code**
> — phần dưới là hiện trạng đã rà, không phải kế hoạch đã duyệt.

**Rà 2026-08-24.** Đợt Phase 9 chỉ bám file `07-hoi-dap-dong-tien.md`. Sáu issue **K1–K6** của
file `08` chưa từng có mặt trong file này — không phải hoãn có lý do, là **bỏ quên**. K1 tình cờ
đã đúng nhờ dựng schema đúng từ đầu; năm mục còn lại chưa làm.

- [x] **K1 · `invited_by` xuống từng lượt — P0.** `session_guests.invited_by` có sẵn từ
      `0001_init.sql:305`, `dbmap.js` map hai chiều, `money.js: guestDebtByInviter` đọc
      `sg.invitedBy` trước rồi mới rơi về `guests.invitedBy`. Nợ tháng cũ không đổi chủ khi
      tháng sau người khác rủ cùng khách đó nữa.
      **Chưa có test khoá** — đúng do may, không có gì chặn ai đó sửa ngược lại.
- [ ] **K2 · `collectDebt` thu quá tay — P1** (đặc tả ghi P0, hạ xuống vì lối kích hoạt nguy hiểm
      chưa tồn tại). `appActions.js: collectDebt(gid)` set `paid = true` cho MỌI lượt của khách
      đó trong tháng đang xem. Kịch bản đặc tả mô tả — bấm ở dòng NGƯỜI RỦ thì xoá luôn nợ lượt
      của người rủ khác — hiện chưa xảy ra được: nút Thu chỉ có ở dòng KHÁCH
      (`Debts.jsx:98` · `Home.jsx:208`), nơi "thu mọi lượt của khách đó" đúng ngữ nghĩa.
      Còn lại vẫn sai: **không có dialog xác nhận**, mà `paid = true` thì không có nút hoàn tác.
      Làm: dialog nói rõ *n lượt · tổng tiền · tên người rủ*, và nếu sau này thêm nút thu ở dòng
      người rủ thì phải lọc theo `invitedBy`.
- [ ] **K3 · Ô tên khách tự do → danh bạ phình — P1.** `addGuest` dedupe bằng
      `name.toLowerCase()` khớp tuyệt đối: `Thắng` / `Thắng em` / `thắng ` thành ba bản ghi,
      ba dòng công nợ không cộng lại được. Cả hai nhánh (nối khách cũ / tạo mới) đều xảy ra
      **im lặng**. Làm: ô tìm trong danh bạ, so khớp sau khi bỏ dấu + hạ chữ + gộp khoảng trắng;
      chọn chip = nối, bấm `＋` = tạo mới.
- [ ] **K4 · Không có gì để nhận biết khách — P1.** Form không hỏi `phone` nên cột luôn rỗng;
      chưa có `guests.note`. Làm: định danh hai lớp (có số → số là khoá; không có → tên chuẩn
      hoá), **xin số từ buổi thứ 3** chứ không xin ngay buổi đầu, `ALTER TABLE guests ADD COLUMN
      note text`. KHÔNG `UNIQUE(phone)`, KHÔNG lưu `sessions_count` / `last_seen` thành cột.
- [ ] **K5 · Khách CLB tự tuyển bị gán vào tên chủ CLB — P1.** `addGuest` chặn cứng
      `if (!f.gBy) return toast(t('toast.needGuestInviter'))`. CLB đăng tin tuyển người lạ thì
      cách duy nhất là chọn chủ CLB → bảng "ai rủ nhiều khách nhất" thành bảng của chủ CLB và
      nợ khách lạ treo dưới tên họ. Làm: thêm **một giá trị** `CLB tuyển` vào dropdown người rủ
      (lưu `invited_by = NULL`). Không thêm cột `source`, không nhánh xử lý thứ hai.
- [ ] **K6 · Không có chỗ nào nhìn thấy toàn bộ khách — P1.** Khách chỉ hiện gián tiếp ở màn
      Công nợ và **chỉ người còn nợ**. Làm: tab **Khách giao lưu** trong màn Thành viên
      (hiện chỉ có 3 tab: tất cả / cố định tháng sau / chờ duyệt), lọc theo trình độ + giới tính.
- [ ] **Bung từng buổi kèm ngày ở màn Công nợ — P2.**
- [ ] **Chuỗi tiếng Việt cứng trong `money.js:281`** — `'Chưa rõ người rủ'` viết thẳng trong `.js`,
      vi phạm `RULES.md` §3.1. `i18n.test.js` không bắt được loại lỗi này (nó quét `t('key')` có
      tồn tại không, không quét chữ cứng). Sửa cùng K5 vì đó chính là nhãn của nhóm `CLB tuyển`.

**Đã cắt khỏi phạm vi** (đặc tả `08` §Cắt khỏi phạm vi — không bàn lại): cột `source` phân loại
khách · `paid_amount` cho khách · `pay_mode` · xếp khách cùng sân người rủ. **Hoãn:** gộp hai
khách trùng · chuyển khách thành thành viên.

---

## Đợt 1 — Sửa mất dữ liệu + luồng thành viên · **XONG 2026-08-31** (chờ user bấm thử)

Kết quả đợt đọc code đối chiếu logic. Tám mục, **không đụng schema**, không migration mới.

- [x] **Xoá thành viên làm kẹt CẢ hàng đợi đồng bộ.** `diff()` phát op theo thứ tự mảng `TABLES`
      (cha trước con) — đúng cho INSERT, **ngược cho DELETE**. `club_members` đứng thứ 4,
      `group_memberships` thứ 19, mà cột đó `REFERENCES club_members(id)` **không CASCADE** →
      Postgres trả 23503. Vì `storage.js` chỉ cập nhật ảnh chụp khi MỌI op xong, op hỏng nằm lại
      trong diff mãi: **từ đó mọi thay đổi đều không xuống được DB** trong khi màn hình vẫn báo
      đã lưu. Sửa: gom `delIds` ra riêng, phát sau cùng theo **thứ tự ngược**. `delScope` giữ
      nguyên chỗ — 11 bảng mode `key`/`scope` đều là bảng lá, tách khỏi `upsert` đi kèm là mode
      `scope` xoá mất đúng dòng vừa ghi. Có test khoá + mutation-test.
      **Cố ý KHÔNG thêm `roster` vào `memberRefs`:** `deleteMember` đã dọn roster ở tầng state,
      nó chỉ hỏng vì thứ tự — thêm guard là chặn oan thao tác hợp lệ.
- [x] **"Ngưng hoạt động" là cửa một chiều.** Cả 8 chỗ liệt kê thành viên đều lọc
      `active !== false` nên người đã ngưng không hiện ở đâu; nút "Cho hoạt động lại" viết sẵn
      trong cột hành động là **code chết**, bấm nhầm chỉ sửa được bằng SQL. Thêm bộ lọc
      *Đang hoạt động / Đã ngưng* ở tab Tất cả, chỉ hiện khi thật sự có người đã ngưng.
- [x] **Người đã ngưng vẫn bị sinh quỹ tháng, mãi mãi.** `lockRoster` không kiểm `active`, mà
      tab Danh sách cố định cũng lọc active nên **không có cách nào gỡ họ khỏi danh sách**. Tách
      `money.js: lockDues(db, month)` thành hàm thuần (nó sinh ra TOÀN BỘ tiền phải thu của một
      tháng mà trước giờ không có test nào) + guard `active === false`. Test 5 nhánh.
- [x] **Hộp thoại back tiền khi ngưng giữa tháng.** Người đang cố định và ĐÃ đóng quỹ tháng này
      thì quỹ đang giữ tiền của những buổi họ sẽ không đánh nữa, mà `adjustRows` lọc qua
      `groupMembers` nên thôi sinh dòng cho họ. `money.js: offBackSuggest` gợi ý
      `đơn giá × số buổi còn lại`; ghi thẳng một dòng `db.manual` hạng mục `back`.
      Ba lối ra cố ý không gộp: **Huỷ** = không ngưng · **Chỉ ngưng** · **Ngưng và trả lại**.
      `MANUAL_CATS` thêm `back` để cuối tháng đổi ý vẫn ghi tay được.
- [x] **Gỡ mời qua SĐT khỏi client.** Phần TẠO chạy được nhưng phần NHẬN (mở link → tạo tài
      khoản → tự ghép) chưa từng tồn tại — `accepted_user_id` không có consumer nào trong `src/`.
      Bỏ action, nút, pill, toggle, `db.invites`, `club_invites` khỏi `TABLES` + `storage.js`.
      **Giữ nguyên bảng và cột `clubs.allow_invite` dưới DB**, chờ module invite riêng.
- [x] **Chặn tạo bản ghi trùng ở màn duyệt vào CLB.** Bấm nhầm "Tạo thành viên mới" thay vì
      "Ghép" là sinh ra người thứ hai cùng một con người, mà **GỘP hai bản ghi thì app chưa làm
      được** (16 cột trỏ tới `club_members`, 4 UNIQUE chặn ngang, và `storage.js` ghi từng dòng
      không transaction → merge bắt buộc là RPC, để thành module riêng). Chọn sẵn bản ghi trùng
      SĐT, cảnh báo một dòng, hạ "Tạo mới" xuống ghost. Kèm một bẫy khác: bấm **Ghép** khi chưa
      chọn ai thì RPC nhận `p_member_id = null` và **tạo mới** — nút nói một đằng làm một nẻo,
      giờ khoá lại khi chưa chọn.
- [x] **`undoMatch` xoá nhầm trận sau F5.** `storage.js` không `.order()` bảng nào và `toDb`
      không sort `matches`, mà "Bỏ trận vừa ghi" lấy phần tử cuối mảng. Sort theo `at`. Có test.
- [x] **Báo cáo Zalo in giá thành LIVE.** `copyZalo` gọi `sessionCost` thay vì `costRow` → buổi
      đã chốt thì báo cáo gửi lên nhóm nói một số, màn hình nói số khác ngay khi giá cầu/giá sân
      đổi. Đúng lỗi L1/P2 đã sửa ở hai màn kia, sót màn này.
- [ ] **Trần đã biết, chưa sửa:** một op lỗi CỐ ĐỊNH (khoá ngoại, RLS chặn) vẫn làm kẹt hàng đợi
      đồng bộ như cũ — đợt này chỉ gỡ nguyên nhân hay gặp nhất. Đã đặt `ponytail:` ở
      `storage.js: flush()` kèm hai đường nâng cấp (reload đè state, hoặc ảnh chụp từng phần).
      Mở lại khi gặp ca thứ hai.

---

## Đợt 2 — Dọn nốt danh sách rà code · **XONG 2026-08-31** (chờ user bấm thử)

Không đụng schema, không migration mới.

- [x] **Ba updater không thuần — StrictMode đang bật.** `ARCHITECTURE.md` §4 quy ước 1 cấm đọc
      state trong updater rồi gây side effect ở đó; ba chỗ vi phạm chính nó.
      `saveMember` cộng `kept`/`dropped` bên trong updater → dev gọi hai lần → toast báo **gấp
      đôi** số tiền giữ lại. `createAdhoc` sinh `newId` trong updater rồi `nav()` theo nó.
      `createMember` đọc `db()` **sau** `up()` rồi mò `members[length - 1]` — mà `dbRef` chỉ cập
      nhật ở `useLayoutEffect` nên đó là state CŨ, số tiền in ra là của người trước đó.
      Sửa chung một cách: **tính trước, ghi sau**. Tách `money.js: regroupDues(db, member,
      groupIds, month)` thuần (xoá / giữ / sinh khoản quỹ khi đổi nhóm cố định) — cùng khuôn với
      `lockDues`. Test 6 nhánh + mutation-test.
- [x] **"Từ tháng sau" lấy mốc từ tháng ở HEADER.** `approveChange` và `saveMember` đặt
      `pendingLevelFrom = addMonth(d.month, 1)`; đang xem tháng 5 mà duyệt đổi trình độ thì mốc
      rơi vào quá khứ → `levelOf` áp dụng NGAY và đổi luôn trình độ hiện trên buổi đã đánh xong.
      Lấy từ `monthOf(d.today)`.
      Kèm: **mặc định của ô "Trình độ mới áp dụng khi nào" đổi từ *Áp dụng ngay* sang *Từ tháng
      sau*** (`forms.js: editMemberForm`). *Áp dụng ngay* ghi đè `member.level`, mà `levelOf` suy
      trình độ của MỌI tháng từ đúng ô đó — nó là đường mặc định dẫn thẳng vào việc sửa lại quá
      khứ. Hai nhãn nói rõ hệ quả: *"sửa cả buổi cũ"* / *"giữ nguyên buổi cũ"*.
      **Tiền KHÔNG dính:** mọi công thức (`unitPrice`, `lockDues`, `joinDues`) tính theo **giới
      tính**, không theo trình độ; giá khách thì đã đóng băng vào từng lượt `session_guests`.
      **ponytail:** chỉ có MỘT ô `pendingLevel` nên lịch sử chỉ đúng cho một lần đổi — đổi lần
      hai thì đoạn giữa rơi về `level` gốc. Muốn đúng nhiều bậc phải đóng băng `level` vào
      `attendances` lúc điểm danh (đúng khuôn `session_guests.level`), tốn một migration cho một
      cái chip. Chưa đáng.
- [x] **Ba chỗ số trộn nguồn / dựa vào thứ tự mảng.**
      `SessionDetail` lấy `c.rev - paid` — `rev` ĐÓNG BĂNG, `paid` sống → thêm khách sau khi chốt
      ra "khách còn nợ" **âm**; giờ nợ tính live hoàn toàn, lệch giữa hai số đã có `costDrift` lo.
      `Shuttles` lấy "lần kiểm gần nhất" = phần tử cuối mảng chưa sắp (`load()` không `ORDER BY`
      bảng nào) và guard `(db.stockChecks || [])[db.stockChecks.length - 1]` vô nghĩa — `.length`
      vẫn nổ nếu mảng chưa có; giờ sắp theo tháng như `checkDue` vẫn làm.
      `Home` bảng "Tỷ lệ đi tập" dùng `=== true` nên bỏ `'extra'`, trong khi tab Tổng quan cùng
      trang dùng `isPresent` — hai ô đếm cùng một việc ra hai số.
- [x] **Khách trùng khoá khi chia sân.** `assign.js: sessionPlayers` lấy `sg.guestId` làm khoá
      người chơi; thêm cùng một khách hai lượt trong một buổi → hai người **cùng khoá** → `place()`
      gộp thành một ô, `matchStats` đếm gấp đôi. **Chặn nguyên nhân thay vì đổi khoá:** một khách
      chỉ có một lượt mỗi buổi, `addGuest` giờ từ chối lượt thứ hai kèm toast. Đổi khoá sang
      `session_guests.id` thì phải đổi luôn ý nghĩa cột `player_id` ở ba bảng — đắt hơn nhiều mà
      chẳng mở ra tính năng nào. Tiện thể `addGuest` cũng tra khách và sinh id **trước** updater.
- [x] **Năm chỗ tài liệu nói sai** (`DATABASE.md` §1 luật 3 · §6 thiếu `0011` · §8 mục 3/4/T1 ·
      `ARCHITECTURE.md` §7 Auth + i18n). Đã sửa cùng đợt vì đọc doc sai là code sai theo.

**Không làm, có lý do:** count ở tab "Tất cả" vẫn đếm người đang hoạt động dù bộ lọc con có thể
đang hiện người đã ngưng — cho số nhảy theo bộ lọc thì khó đọc hơn là để yên.

---

## Đợt 3 — Rà bug + tổ chức lại test · **XONG 2026-08-31** (chờ user bấm thử)

Không đụng schema, không migration mới.

### Bug tìm được khi đọc lại code

- [x] **Vai `member` kéo được người trên màn Chia sân → kẹt cả hàng đợi đồng bộ.** RLS của
      `session_lineups` · `session_court_groups` · `matches` · `match_players` đều gác bằng cờ
      **`assign`** (`0002_auth_rls.sql:409`), nhưng `permissions.json` cho `member` **route**
      `assign` (đúng handoff: 3 màn mobile của thành viên) mà **không có cờ** đó — và
      `Assign.jsx` **không gác một hành động nào**, `grep can(` ra 0 kết quả.
      Thành viên thường kéo một người → Supabase từ chối → `flush()` ném lỗi → ảnh chụp không
      cập nhật → op hỏng phát lại mãi, mọi thay đổi sau đó không xuống được DB, màn hình vẫn
      báo đã lưu. Chặn ở **tầng action** (12 hành động) chứ không ở màn hình, để mọi lối vào đều
      dính; báo bằng toast, không disable im lặng.
      Rà luôn 11 cặp `vai:route` còn lại — bảy chỗ kia (`treasurer:settings`, `host:members`,
      `viewer:fund`…) đều đã gác đúng. Chỉ Chia sân hở.
- [x] **CLB chưa có sân, bấm "Buổi đột xuất" ở header → cùng một kiểu kẹt.**
      `defaultCourtRows` trả `courtId: ''` khi CLB chưa có sân, mà `session_courts.court_id` là
      `uuid NOT NULL REFERENCES courts(id)` → Postgres 22P02. Đây là thao tác một CLB mới toanh
      chạm vào **đầu tiên**. `createAdhoc` giờ chặn trước bằng toast chỉ đường sang Cài đặt.
- [x] **Ô nhập quỹ mang sang lúc tạo CLB vẫn dùng `parseInt` trần.**
      `AuthContext: createClub` — `parseInt('1.650.000')` ra **1**. 18 ô nhập tiền khác đã dọn ở
      P4.5 nhưng ô này nằm ngoài `appActions` nên bị bỏ sót, và nó là con số theo suốt mọi báo
      cáo về sau. Chuyển sang `intOf`; `lockDay` kẹp luôn về 1–28 như `setLockDay` vẫn làm.
- [x] **`fixture.js` thiếu `club.levels`** trong khi `toDb` LUÔN đặt trường đó — test đang chạy
      trên một hình dữ liệu không bao giờ tồn tại lúc chạy thật.

### Tổ chức lại test

- [x] **Bỏ chuỗi `node a && node b && …` trong `package.json`**, chuyển sang runner sẵn có của
      Node: `node --test "src/**/*.test.js"`. Tự tìm file, **không phải khai báo file mới ở đâu
      cả** — luật "wire mọi test vào package.json" ở `RULES.md` §5 đã gỡ.
- [x] **Tách `money.test.js` (744 dòng, 35 mục, 282 assert) thành 8 file theo CHỦ ĐỀ TIỀN**:
      `format` · `court` · `shuttle` · `guest` · `member` · `dues` · `cost` · `alerts`.
      Tách theo việc chứ không theo tên hàm — quỹ tháng → đơn giá → đối chiếu là **một chuỗi**
      nên để chung `dues.test.js`. Đếm assert trước và sau: **282 → 282**, không rơi mục nào.
- [x] **Xếp thư mục theo tầng**: `lib/` (logic thuần) · `money/` · `ledger/` · `sync/` ·
      `smoke/` (bất biến quét toàn repo). Thêm `src/__tests__/README.md` — bảng tra "muốn kiểm
      X thì vào file nào" + luật đặt test mới.
- [x] **`lib/roles.test.js` — MỚI, trước đó ma trận quyền có 0 test.** Gồm một phép so mà không
      chỗ nào khác làm: **`permissions.json` với seed `role_permissions` trong `0001_init.sql`**
      — hai nguồn của cùng một sự thật, lệch nhau thì UI mở ra thứ RLS từ chối.
      Cộng bất biến khoá đúng con bug ở trên: vai vào được một route mà thiếu cờ ghi thì cặp
      `vai:route` đó **phải** nằm trong danh sách đã-rà-tay `READ_ONLY_OK`.
- [x] **`lib/forms.test.js` — MỚI, trước đó 14 hàm mặc định dialog có 0 test.** Khoá hai mặc
      định bảo vệ lịch sử (`eWhen` / `eWhenGroup` = *từ tháng sau*) và khoá luật "CLB rỗng không
      được sinh giá trị rác" — chính chỗ đẻ ra con bug `courtId: ''`.
- [x] Bù nốt các export chưa từng được nhắc tới: `rowCost` · `checkOf` · `guestPaidRev` ·
      `savedAdjust` · `genderTxt` · `SHUTTLE_UNIT_FALLBACK` · `catLabel` · `MANUAL_CATS` ·
      `ASSIGN_MODES` · `modeToast` · `clubRow`.
      **141/143 export của `lib` + `utils` + `dbmap` giờ có mặt trong test (99%)** — còn `WD` /
      `WD_FULL` là hằng nhãn thứ, không có gì để khoá.

**16 file test, `npm test` xanh.** Vẫn KHÔNG có framework: `node:assert/strict` thuần.

---

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
| `addRow()` đọc `db.courts[0].id` | CLB rỗng: bấm "Tạo lịch hàng loạt" → thêm dòng sân là crash trắng màn | kiểm trước, không có sân thì toast chỉ đường sang Cài đặt |
| Buổi đột xuất "toàn CLB" mang `groupId = 'ALL'` | `'ALL'` không phải uuid → `sessions.group_id` NOT NULL chặn, buổi đột xuất không lưu được | `0003` cho `group_id` nullable, `dbmap` map `'ALL'` ↔ `NULL`, có test |
| Không có chỗ nào tạo `member_changes` | tab "Thay đổi chờ duyệt" vĩnh viễn rỗng trên DB thật | thêm card xin đổi thông tin ở Trang cá nhân |
| `gen_club_code()` khai biến plpgsql tên `code` trùng cột `clubs.code` | **không tạo được CLB nào** — `create_club` trả 400 `column reference "code" is ambiguous`. Thân plpgsql chỉ là text lúc `CREATE` nên apply migration không lộ, chỉ lộ khi có người bấm tạo | `0004`: đổi tên biến thành `v_code` |
| 0002 bật RLS + tạo policy nhưng **không `GRANT`** bảng nào | tạo CLB xong không nạp được dữ liệu: `permission denied for table clubs`, select bảng 403 trong khi RPC vẫn 200. GRANT và RLS là hai lớp, RLS chặn thì trả 0 dòng chứ không báo permission denied | `0006`: grant bảng cho `authenticated` + default privileges |
| Migration chỉ chạy được một lần | user apply bằng cách dán vào SQL editor của Supabase cloud; chạy lại là chết ở `column ... already exists`, không ai biết phần sau của file đã chạy chưa | mọi migration dùng `IF NOT EXISTS` / `CREATE OR REPLACE` / `DO $$ ... pg_constraint`; ghi thành luật ở `DATABASE.md` §6 |
| `createPurchase` đặt tên biến là `t` (loại cầu), che hàm dịch `t()` | nhập kho mà để trống số lượng → `t('toast.needQty')` gọi vào object → TypeError, dialog chết không báo gì | đổi tên thành `ty`, thêm guard CLB chưa có loại cầu nào |
| Đăng ký trùng email / username / SĐT chỉ bị chặn ở DB | dữ liệu vẫn an toàn (cả 3 cột đều UNIQUE) nhưng user đọc được `"User already registered"` hoặc lỗi Postgres thô | dịch lỗi ra tiếng Việt ở `AuthContext: signUpUnwrap`, chặn submit khi đã biết username bị chiếm |
| `empty.test.js` assert `costRow(...).perHead` — trường không tồn tại | `String(undefined)` không chứa `'NaN'` nên assert luôn đúng: test canh NaN mà không canh gì cả | đổi sang `Number.isFinite(...per)` |
| `adjustRows` tính tiền "đi thêm buổi" cho cả người ĐÃ cố định nhóm đó | người cố định cả hai nhóm (fixture có 6 người như vậy) vừa đóng quỹ tháng vừa bị tính thêm đơn giá buổi — thu hai lần cùng một buổi | lọc bằng `isFixed` trong `adjustRows`, có test regression |
| Tab cố định hard-code `addMonth(db.month, 1)` | dựng CLB giữa tháng thì không có cách nào chốt danh sách THÁNG NÀY → không sinh `monthly_dues`, không có gì để thu và không sửa được ai cố định ai không | nút chuyển Tháng này / Tháng sau |
| `createMember` "từ tháng này" chỉ ghi roster tháng SAU, và tính tiền theo số buổi còn lại | CLB mới chưa có buổi nào → 0 buổi → không sinh khoản thu nào; người mới cũng không hiện ở màn điểm danh tháng này | ghi roster cả hai tháng + `joinDues` thu trọn gói khi nhóm chưa có buổi |
| `payerName` đi qua `memberOf` | `memberOf` trả placeholder `'—'` cho id không tìm thấy, mà `'—'` truthy nên id chết nuốt mất tên cũ đang có | tra thẳng `db.members`, không qua placeholder |
| `courtBalance` trong test không truyền `db.levels` | test vô tình bám vào thang mặc định ở `app.json`; đổi thang mặc định là test đỏ dù logic không sai | test truyền `db.levels` như app vẫn làm, thêm case chứng minh thang đổi thì kết luận đổi |
| `markAll` dựng bảng điểm danh rỗng rồi ghi đè | bấm "Tất cả có mặt/vắng" là hất sạch người đi thêm ra khỏi buổi | giữ bảng cũ, chỉ ghi đè người trong danh sách cố định |
| Form thêm khách lấy chính `gLevel` làm cờ "đã khởi tạo" (`ui.form.gLevel ? ui.form : guestForm(db)`) | CLB chưa có thang trình độ → `gLevel` rỗng vĩnh viễn → nhánh luôn rơi về form mặc định: **gõ tên bị xoá từng ký tự, giá luôn 0 đ**, bấm Thêm thì `level: undefined` xuống cột NOT NULL và đồng bộ chết im lặng | gộp `{ ...guestForm(db), ...ui.form }` thay vì chọn một trong hai; chặn nút Thêm + toast khi CLB chưa có thang; cảnh báo bấm được sang Cài đặt khi giá 0 |
| 4 chỗ `<Alert tone="critical">` — tone không tồn tại | `Alert` chỉ nhận `info/success/warning/danger`, tone lạ rơi về `info` im lặng → **thông báo lỗi đăng nhập / đăng ký / mã CLB hiện màu xanh** kèm icon ℹ. `StatCard` lại dùng đúng `critical` nên rất dễ nhầm | đổi sang `tone="danger"` ở `Clubs.jsx:178,222` · `Login.jsx:46` · `Register.jsx:100` |

---

## Quyết định đang chờ user

| Việc | Vì sao cần user | Chặn cái gì |
| --- | --- | --- |
| ~~**Mốc cutoff của P6**~~ | **Không còn chặn 2026-09-01:** chưa có dữ liệu thật nên không có lịch sử để bảo tồn — P6b ghi thật từ đầu | — |
| Chạy `npm run build` | RULES §6: agent không tự build | không ai biết bản này compile được hay chưa |
| ~~Script kiểm RLS bằng 2 tài khoản~~ | **Xong 2026-09-01** — làm trên container dùng một lần, không đụng DB của user | — |
| Dữ liệu thật của CLB (Excel) | cần số quỹ mang sang + danh sách thật | nhập liệu ban đầu |

**Đã chốt, không hỏi lại:** dựng + chạy DB (xong 2026-08-24) · P6 dùng **cutoff** không backfill ·
**không** làm `wallets` (T1) · **không** thêm công tắc tắt nhắc kiểm kho · thiết kế khách (Phase 10)
làm sau P5–P7 và phải thảo luận trước · két = vai `owner` + `treasurer` · két tự ứng thì ghi CHI
thẳng không tạo nợ.
