# TASKS.md

**Version:** v1.0.0 · **Updated:** 2026-09-02

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
- [x] `npm test` xanh — 26 file test: lib/ (9) · money/ (11) · ledger/ (2) · sync/ (2) · smoke/ (2)
- [x] `npm run lint` sạch
- [x] Audit icon: 0 icon thiếu (kể cả icon component TDMS tự dùng bên trong)
- [x] `npm run build` — **PASS 2026-09-02.** User đã chạy và xác nhận.
- [x] Smoke test 13 màn — **XONG 2026-09-02.** User đã test với dữ liệu thật qua Excel, thang trình độ đã đổi đúng.

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
- [x] **User chạy `npm run build` + test 13 màn trên DB thật — XONG 2026-09-02.** Build pass, dữ liệu thật từ Excel, thang trình độ đã đổi đúng.
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

- [~] **Màn "Đối chiếu quỹ" — ĐÃ GỠ 2026-09-01 (user quyết).** Giữ lại phần mô tả dưới đây làm
      hồ sơ, nhưng `ledger.js: reconcile`, `Fund.jsx: Reconcile`, `ledger/reconcile.test.js`
      và khối i18n `fund.rec.*` đều đã xoá; hai tab "Đối chiếu quỹ" ở Trang chủ và Sổ quỹ
      cũng gỡ theo.
      **Vì sao gỡ:** màn này không PHÁT HIỆN gì — nó chỉ liệt kê các con số có thể giải thích
      chênh lệch giữa tiền đếm được và sổ. Mọi con số đó đã xem được ở chỗ khác (Thành viên →
      cột Quỹ tháng + bộ lọc "Chưa đóng", Công nợ, Sổ quỹ, Cài đặt). Giá trị thật của nó chỉ
      xuất hiện khi CLB GIỮ TIỀN MẶT và có người ngồi đếm; CLB thu qua chuyển khoản thì "tiền
      thật đang giữ" chính là số dư ngân hàng, không cần màn này.
      Cần lại thì lấy trong git — đừng viết lại từ đầu.

      <details><summary>Mô tả cũ</summary>

- [x] Thủ quỹ gõ số tiền thật đang
      giữ, app so với sổ và **liệt kê nghi vấn cụ thể** sắp theo mức khớp, không chỉ báo lệch.
      Bắt: ~~B1~~ (xong ở P7 nhẹ) · ~~B2~~ (xong ở P5) · B3 · B4 · B9 · B10 · B11.
      </details>

- [x] **Cảnh báo quanh việc chốt buổi — XONG 2026-08-24** (chờ user bấm thử).
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

## Phase 10 — Khách giao lưu (đặc tả `08-khach-giao-luu.md`) · **XONG 2026-09-02**

> **Đã hoàn thành và kiểm thử toàn diện:** K1–K6 đã được giải quyết theo hướng chốt (Hướng 2: Quản lý nợ trực tiếp theo từng khách, không quy nợ về thành viên; thành viên chỉ là thông tin người rủ). Chuẩn hoá 10 bậc trình độ: `Y, Y+, TBY-, TBY, TBY+, TB-, TB, TB+, TBK, Khá`.

- [x] **K1 · `invited_by` xuống từng lượt — P0.** `session_guests.invited_by` có sẵn từ `0001_init.sql`, `dbmap.js` map hai chiều, `money.js: guestDebtByInviter` ưu tiên `sg.invitedBy` (kể cả khi `null` cho `CLB tuyển`). Đã có test khoá trong `guest.test.js`.
- [x] **K2 · `collectDebt` thu quá tay / thiếu xác nhận — P1.** `Debts.jsx` có `Dialog` xác nhận chi tiết (*tên khách/thành viên, số buổi nợ, tháng nợ, danh sách từng buổi kèm đơn giá và tổng tiền*). `collectDebt` cập nhật `paid = true` và `paidAt = today` cho các lượt trong tháng.
- [x] **K3 · Ô tên khách tự do → danh bạ phình — P1.** Trong `SessionDetail.jsx`, ô nhập khách hỗ trợ tìm kiếm autocomplete theo tên chuẩn hoá (`normalizeText` bỏ dấu tiếng Việt, chữ thường, khoảng trắng) hoặc SĐT. Cho phép chọn khách cũ từ danh bạ hoặc bấm thêm khách mới.
- [x] **K4 · Nhận biết khách & nhắc SĐT — P1.** Migration `0014_guest_notes_and_levels.sql` thêm cột `note text` cho `guests`. Lưu `phone` và `note` vào danh bạ `guests`. Với khách quen (≥ 3 buổi) chưa có SĐT, form hiển thị nhắc nhở xin số điện thoại.
- [x] **K5 · Khách CLB tự tuyển — P1.** `addGuest` cho phép người rủ (`f.gBy`) để trống (lưu `invited_by = null`), hiển thị nhãn `CLB tuyển` từ i18n (`debts.clubRecruited`). Không ép buộc gán vào chủ CLB.
- [x] **K6 · Màn hình danh bạ khách toàn bộ — P1.** Màn hình `Members.jsx` có Tab 4 `★ Khách giao lưu` (`tab === 'guests'`) với bộ lọc con (*Tất cả / Khách quen (≥ 3 buổi) / Một lần*), lọc trình độ, lọc giới tính, tìm kiếm (tên, SĐT, ghi chú), thống kê (*số buổi, ngày gần nhất, tổng tiền đã nộp, nợ hiện tại*), kèm Dialog chỉnh sửa/xoá thông tin khách (`updateGuest`, `deleteGuest`).
- [x] **Bung từng buổi kèm ngày ở màn Công nợ — P2.** Màn Công nợ `Debts.jsx` hiển thị chi tiết từng buổi với ngày, nhóm, thời gian, đơn giá, trạng thái thu/hoàn.
- [x] **Chuỗi tiếng Việt cứng trong `money.js`** — Đã thay chuỗi cứng bằng `t('debts.clubRecruited')`.

**Đã cắt khỏi phạm vi** (đặc tả `08` §Cắt khỏi phạm vi — không bàn lại): cột `source` phân loại khách · `paid_amount` cho khách · `pay_mode` · xếp khách cùng sân người rủ. **Hoãn:** gộp hai khách trùng · chuyển khách thành thành viên.

---

## Phase 11 — Avatar + Thông tin ngân hàng / QR — migration `0015` + `0016` · **XONG 2026-09-02**

- [x] **`0015_avatar_and_bank_info.sql`** — thêm `avatar_url`, `bank_qr_url`, `bank_accounts` (jsonb)
      cho `clubs`; thêm `avatar_url`, `qr_url`, `bank_accounts`, `bank_holder`, `bank_no`, `bank_name`
      cho `profiles` và `club_members`. Cập nhật `approve_join_request` nhận thêm 6 trường mới khi
      ghép tài khoản (`avatarUrl`, `qrUrl`, `bankHolder`, `bankNo`, `bankName`, `bankAccounts`).
- [x] **`0016_storage_bucket.sql`** — bucket `club-assets` (public, 2MB/file, image only).
      RLS: mọi người đọc được, authenticated upload + update.
- [x] **`AvatarUpload` component** (`src/components/ui/AvatarUpload.jsx`) — upload ảnh đại diện
      cho CLB, profile, thành viên qua Supabase Storage.
- [x] **`BankAccountSection` component** (`src/components/ui/BankAccountSection.jsx`) — quản lý
      danh sách tài khoản ngân hàng + thông tin chủ TK / số TK / tên ngân hàng.
- [x] **`QrModal` component** (`src/components/ui/QrModal.jsx`) — xem / quét ảnh QR chuyển khoản.
- [x] **`jsqr` dependency** — quét mã QR từ ảnh (client-side, không gọi API bên ngoài).
- [x] **`vietqr.test.js`** — test cho tính năng VietQR.
- [x] **`companion_guest.test.js`** — test khách giao lưu đi cùng.

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

**24 file test (33 subtests), `npm test` xanh.** Vẫn KHÔNG có framework: `node:assert/strict` thuần.

---

## Phase 8 — Sau đó (đã có bảng, chưa cần code)

- [ ] Nhắc điểm danh / đóng quỹ / nợ (`notifications`)
- [ ] **Thông báo cho hai luồng thanh toán — gắn nợ sau khi dựng xong 0018 (2026-09-02).**
      Bảng `notifications` ĐÃ CÓ từ `0001_init.sql` (`member_id`, `kind`, `channel`, `payload`,
      `status`) và app chưa dùng. Chỉ cần nới `CHECK (channel IN ('push','zalo'))` thêm `'inapp'`.

      **Luồng 1 — tiền VÀO (thành viên tự khai, có duyệt).** Báo khi chủ CLB / thủ quỹ
      duyệt hoặc từ chối.
      · Duyệt — dựng lại được bất cứ lúc nào: `paid = true AND claimed_at IS NOT NULL` chính là
        dấu "khoản này do thành viên tự khai rồi được duyệt" — cố ý giữ `claimed_at` khi duyệt
        chính là để dành cho việc này.
      · **Từ chối — KHÔNG dựng lại được.** Nó đặt `claimed_at = NULL`, sau đó không phân biệt
        được "vừa bị từ chối" với "chưa khai bao giờ". Dòng `notifications` **phải ghi ngay tại
        thời điểm từ chối**, không backfill được. Điểm móc: `appActions.js: rejectClaim()` — một
        hàm duy nhất, cố ý không rải `claimedAt: null` trong JSX.

      **Luồng 2 — tiền RA (CLB trả / hoàn, không có duyệt).** Báo khi quỹ đã chuyển tiền
      cho thành viên. Điểm móc: `Debts.jsx: RefundConfirm` → `run()` (gọi `settleAdjust` /
      `repayAdvance`). Luồng này không thêm cột nào, trạng thái nằm sẵn ở `paid_at` / `repaid_at`
      nên dựng lại được — không gấp như nhánh từ chối ở trên.

      **Chưa có realtime** ([Phase 8] cùng danh sách này): hiện phải F5 mới thấy. Thông báo
      cần realtime hoặc polling — quyết ở lúc đó, không ảnh hưởng schema.
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
| `UserRoundMinus` thiếu trong `ds/icons.js` | Nút xoá người đi lẻ ở `SessionDetail` tàng hình, không bấm xoá được khi thêm nhầm | Thêm `UserRoundMinus` vào `icons.js` và thay bằng `IconButton icon="trash-2"` đỏ nổi bật |
| Điểm danh buổi kéo nhầm thành viên vắng ca khác vào và gắn tag "Không thu quỹ tháng này" | Người cố định nhóm khác (như Thúy ở ca CN) vắng mặt lại bị kéo vào điểm danh ca T6 | `sessionMembers` chỉ kéo người ngoài nhóm khi `isPresent(att)` và `rosterStatus` ưu tiên danh sách `monthly_dues` đã chốt của đúng ca |
| Công nợ rời rạc khó theo dõi, không có tìm kiếm / sắp xếp | Khách ngoài, thành viên đi thêm và back vắng nằm tách biệt; giao diện thừa khoảng trắng | Gộp thành "Thu / Hoàn theo buổi" + "Quỹ tháng", hỗ trợ 2 chế độ xem (Bảng & Lưới ô vuông) có toggle, tìm kiếm tiếng Việt không dấu và dropdown sắp xếp |
| Bảng "Tổng hợp tháng" ở Sổ quỹ gây khó hiểu | Gom 4 ngày đánh cầu lẻ tẻ với con số gộp thô không giải thích | Đặt "Chi tiết thu chi" làm tab mặc định, thay bảng cũ bằng Báo cáo tổng kết quỹ phong trào 2 cột rõ ràng |
| "Sơ đồ dữ liệu" thừa thãi trong menu điều hướng người dùng | Menu kỹ thuật dev hiển thị ở Sidebar người dùng thường | Gỡ bỏ khỏi `Sidebar.jsx` |

---

## Đợt 4 — Tách hồ sơ tài khoản khỏi hồ sơ CLB + ghép có chọn trường — migration `0009_profile_merge`

Trước đợt này màn `/ca-nhan` sửa **cả hai** bảng trong một form, và ghép tài khoản thì không copy
trường nào (không có cách nào lấy dữ liệu từ hồ sơ tài khoản sang).

- [x] **`a.up` không tồn tại — Trang cá nhân lưu là lỗi, mỗi lần.** `Profile.jsx` gọi `a.up(...)`
      nhưng `up` là hàm cục bộ trong `makeActions`, không nằm trong object `A` trả về. Người đã
      ghép bản ghi (gần như mọi người) bấm Lưu: `profiles` update xong → TypeError → `club_members`
      **không** được ghi, không `refresh()`, toast hiện nguyên văn `a.up is not a function`. Hai
      bảng lệch nhau ngay từ lần bấm đầu tiên. Màn đó nay chỉ đọc, không còn `up`.
- [x] **Leo thang quyền: thành viên tự đặt `role = 'owner'`.** Policy `cm_update_self` (0006) chỉ
      kiểm `user_id = auth.uid()`, không giới hạn cột — một lệnh PostgREST là xong, `active` và
      `joined_at` cũng vậy. **Gỡ hẳn policy**: đường hợp lệ để thành viên sửa thông tin của mình
      là `member_changes` (`mc_ins` đã cho chính chủ ghi) rồi chủ CLB duyệt. Cố ý KHÔNG thay bằng
      trigger chặn cột — RLS không còn cho họ UPDATE dòng nào, thêm trigger là gác cửa đã khoá.
- [x] **Tách hai màn hồ sơ.** `/tai-khoan` (`Account.jsx`, NGOÀI CLB) sửa `profiles`;
      `/ca-nhan` (`Profile.jsx`, trong CLB) chỉ XEM `club_members` + gửi yêu cầu đổi qua
      `requestChange`. Trước đó `requestChange` **không còn consumer nào** — tab "Yêu cầu đổi
      thông tin" ở Members vĩnh viễn rỗng, còn bộ key `profile.change*` thì mồ côi. Nút "Hồ sơ" ở
      màn CLB thôi nhảy đại vào CLB đầu tiên (`enterProfile`) để mở được trang hồ sơ.
- [x] **Ghép có chọn trường.** `approve_join_request` nhận thêm `p_fields`; màn duyệt hiện bảng 4
      trường (tên · SĐT · giới tính · trình độ) in *CLB đang có → sẽ thành*, **mặc định không tick
      gì**. Ba lý do khoá ô tick nằm ở hàm thuần `lib/members.js: mergeRows` và RPC gác lại đúng
      ba luật đó: hồ sơ tài khoản để trống · đã giống nhau · trình độ ngoài thang CLB. `role`
      không bao giờ nằm trong `p_fields`. Test 8 assert + mutation-test 2 nhánh.
      **`DROP FUNCTION` trước khi tạo bản 3 tham số:** `CREATE OR REPLACE` với số tham số khác là
      tạo hàm NẠP CHỒNG, hai hàm cùng tên thì PostgREST không chọn được cái nào và nút Ghép chết.
- [x] **`create_club` gác trình độ theo thang CLB.** `COALESCE(me.level, levels[1])` lấy thẳng
      trình độ trong hồ sơ tài khoản, mà CLB mới dùng thang mặc định của DB → owner có level ngoài
      thang ngay từ dòng đầu, `levels.indexOf()` ra -1: cột trình độ sắp sai, cân sân đọc sai bậc.
      `approve_join_request` đã gác từ 0001, chỗ này bị sót.
- [ ] **Trần đã biết, chưa sửa:** `linkMemberUser` (ghép từ bảng Tài khoản & quyền, không qua RPC)
      vẫn đổi hai dòng trong CÙNG một câu upsert — gán `user_id` mới và bỏ ghép dòng cũ. Thứ tự
      phụ thuộc thứ tự mảng `db.members`, chạm UNIQUE `(club_id, user_id)` là kẹt hàng đợi đồng bộ.
      UI hiện chỉ cho chọn tài khoản CHƯA gắn bản ghi nào nên chưa nổ. Mở lại khi gặp ca thật.
### Bổ sung cùng đợt — migration `0010_member_email`

- [x] **Hai tên trong CLB.** `club_members.full_name` (không bắt buộc) + `name` giữ vai trò TÊN
      HIỂN THỊ — khớp cặp `profiles.name` / `profiles.nick`. Không màn nào phải đổi cách đọc:
      mọi chỗ vẫn dùng `name`, tên đầy đủ chỉ hiện nhỏ bên dưới ở Thành viên và Hồ sơ.
- [x] **`club_members.email`** — không bắt buộc, không UNIQUE, không phải email đăng nhập.
      Có mặt ở form thêm/sửa thành viên và trong bảng chọn trường khi ghép.
      **Kèm một lỗ hổng của chính tính năng đó:** hồ sơ người đang xin vào chỉ đến từ RPC
      `club_pending_requests` (họ chưa phải thành viên nên `profiles_same_club` không cho đọc),
      mà RPC đó không trả `email` → ô tick Email luôn hiện "Hồ sơ tài khoản để trống". Đã thêm
      cột vào RPC (phải `DROP FUNCTION` trước: đổi cột của `RETURNS TABLE` thì `CREATE OR
      REPLACE` báo "cannot change return type").
- [x] **Thành viên tự đổi tên của mình trong CLB**, không cần duyệt. Policy
      `cm_update_self_name` + trigger `cm_guard_self_update` cho đúng `name` và `full_name`;
      trigger so bằng `to_jsonb(NEW) - 'name' - 'full_name'` chứ không liệt kê từng cột, nên cột
      thêm sau này tự động bị chặn thay vì lọt.
      **Không đi qua đồng bộ ngầm:** `storage.js` ghi bằng upsert = `INSERT ... ON CONFLICT`, mà
      Postgres đòi cả policy INSERT cho hàng đề xuất — thành viên thường không có, op sẽ hỏng
      VĨNH VIỄN và kẹt hàng đợi. `a.renameMe` ghi thẳng `.update()` rồi `reload()`, đúng khuôn
      `approveJoin`.
- [x] **Đăng ký bằng email, bỏ ô tên đăng nhập.** `profiles.username` giữ nguyên (tài khoản cũ
      dùng, `resolve_login` vẫn nhận) nhưng do `handle_new_user` tự sinh từ phần trước dấu @,
      thêm số đuôi khi trùng — không tự sinh thì `abc@gmail.com` và `abc@yahoo.com` đụng UNIQUE
      và người thứ hai đọc một câu lỗi về thứ họ chưa từng nhập. Gỡ `usernameAvailable` khỏi
      client, thay `username` bằng `email` ở mọi chỗ hiển thị, thêm ô *Tên gọi* vào form đăng ký
      để cặp tên khớp nhau ngay từ đầu.
- [x] **Thêm bậc `K` (Khá) vào `app.json → levelsDefault`** — thang gợi ý, không đụng CLB nào.

### Dọn nốt sau khi hai tên + email đã chạy — không đụng schema

- [x] **Tìm kiếm thành viên soi cả `fullName` và `email`.** Vừa thêm hai trường mà `filterMembers`
      chỉ soi tên hiển thị + SĐT thì hai trường đó vô hình: người thu tiền cầm giấy chuyển khoản
      ghi tên khai sinh, gõ vào ra rỗng, rồi tạo thêm một bản ghi trùng. Test + mutation-test.
- [x] **Import CSV nhận hai cột TUỲ CHỌN ở cuối** — `Tên đầy đủ` · `Email`. Cố ý không chèn vào
      giữa: mọi file người dùng đang có đều theo đúng 5 cột cũ, đổi thứ tự là từ chối hàng loạt.
      Đọc theo TÊN cột chứ không theo vị trí (đảo hai cột đó vẫn đúng), cột dư lạ vẫn bị chặn.
      File mẫu in cả 7 cột. Bảng xem trước không thêm cột mới (dialog chỉ rộng 780px) mà hiện hai
      giá trị đó nhỏ dưới ô tên. 4 test mới.
- [x] **Bảng Cài đặt → Tài khoản & quyền hiện tên đầy đủ** nhỏ dưới tên hiển thị, đúng như màn
      Thành viên và Hồ sơ.
- [x] **Mời qua SĐT: KHÔNG LÀM** — user chốt 2026-09-02, gỡ khỏi mọi kế hoạch. Phần nhận phải gửi
      SMS thật, tốn tiền. Đường vào CLB duy nhất là **mã CLB**. Bảng `club_invites` và cột
      `clubs.allow_invite` để nguyên dưới DB (không đụng schema), client không đọc.
- [x] **Trường Link Google Maps / Bản đồ vị trí sân (`courts.map_url`) — migration `0012_court_map_url`**:
      Bổ sung cột `map_url text` vào bảng `courts`, hỗ trợ nhập link Google Maps trong hộp thoại
      Thêm/Sửa sân ở Cài đặt và sao lưu JSON settings. Hiển thị nút "Bản đồ" với icon `map-pin`
      ở tab Sân và chi tiết buổi tập (`SessionDetail`).
- [x] **Sửa lỗi tràn layout khi tên sân dài ở Trang chủ (`Home.jsx: Buổi tới`)**: Đặt `minWidth: 0, width: '100%'`
      và `boxSizing: 'border-box'` cho container dòng `SS.upRow`, kết hợp `textOverflow: 'ellipsis'`
      để tên sân dài không đẩy bay cột tiền sân và nút Mở điểm danh ra ngoài thẻ card.

- [x] **Khóa và ẩn các action nguy hiểm khi buổi đã chốt / mở (`SessionDetail.jsx`) — 2026-09-02**:
      Khi buổi đã chốt (`closed`): Ẩn các nút "Hủy buổi", "Xóa hẳn", "Mở lại buổi"; ẩn/khóa nút "Thêm sân cho buổi này", "Bán sân / Hủy bán", xóa sân phụ trội, và vô hiệu hóa ô Ghi chú buổi.
      Khi buổi đã mở (`open`): Không hiển thị nút "Mở lại buổi" (chỉ hiển thị cho buổi đã hủy `cancelled`).
- [x] **Tích hợp `SearchSelect` vào màn Cài đặt → Tài khoản & quyền (`Settings.jsx`) — 2026-09-02**:
      Thay thế `<select>` native ở khối Yêu cầu vào CLB (`JoinRow`) và ghép tài khoản thủ công (`Access`) bằng component `SearchSelect` có tìm kiếm tên/SĐT/trình độ không dấu, huy hiệu trình độ màu sắc và lazy loading.
- [x] **Nổi bật con số các Tab & Tính số đếm Công nợ theo vai Member (`Sidebar.jsx`, `Debts.jsx`, `Tabs.jsx`) — 2026-09-02**:
      - Tăng độ tương phản badge số đếm trên `Tabs` (font bold, nền nổi, viền rõ ràng khi active/inactive) để không còn bị mờ.
      - Thêm hàm thuần `myDebtCounts` và `clubDebtCounts` trong `lib/money.js`: khi xem ở vai `member` (hoặc không có quyền `money`), badge Công nợ ở Sidebar và các tab trong màn Công nợ chỉ đếm các khoản nợ của CHÍNH THÀNH VIÊN ĐÓ (khoản phải trả + khoản được trả); khi ở vai Thủ quỹ/Chủ CLB thì đếm toàn CLB.
      - Nổi bật các con số tổng tiền (Cần thu, Cần hoàn, Còn thiếu, Quỹ nợ) với badge màu sắc trực quan.

### Đợt dọn C — migration `0011_level_history`

- [x] **C6 · Lịch sử trình độ nhiều mốc.** Một ô `pending_level` chỉ giữ được MỘT lần đổi: duyệt
      lần hai là ghi đè lần một, đoạn giữa rơi về `level` gốc — sai lặng lẽ ở giá khách của người
      đi lẻ và ở cách cân sân của các buổi trong đoạn đó. Bảng `member_levels` + `levelOf` lấy mốc
      lớn nhất `<= month`. Cột cũ backfill sang bảng mới, giữ lại, client thôi đọc/ghi.
      Kèm hai chỗ trước giờ đọc `m.level` trần nên nói khác cột hiển thị: bộ lọc trình độ và
      thứ tự sắp cột trình độ ở màn Thành viên giờ cùng đi qua `levelOf`.
      **Test bắt được một lỗi ngay khi viết:** bản ghi vừa có lịch sử vừa còn ô chờ cũ thì ô cũ
      xen vào và trả sai — `levelOf` chỉ được rơi về ô chờ khi CHƯA có mốc nào. 12 assert +
      mutation-test 2 nhánh.
- [x] **C3 · CLB mới lấy thang trình độ từ `app.json`.** `create_club` nhận `p_levels`; trước đây
      DB dùng default 4 bậc trong khi màn đăng ký cho chọn trong 10 bậc, chọn 'Y+' rồi tạo CLB là
      bị hạ về bậc thấp nhất trong im lặng. CLB đang chạy không bị đụng.
- [x] **C5 · DROP `search_users_for_club`** — tạo ở 0006, chưa từng có consumer. Cần lại thì lấy
      trong git.
- [x] **C4 · Lỗi đồng bộ không tự khỏi thì thôi kẹt hàng đợi.** `unwrap` giữ `code` của
      Postgres/PostgREST (lỗi mạng không có code); `storage.js` phân biệt hai loại; lỗi cố định
      thì AppContext nạp lại CLB từ DB + toast nói rõ "làm lại thao tác đó". Mất đúng thay đổi vừa
      hỏng — nhưng nó vốn đã không xuống được DB, còn giữ lại thì chặn mọi thay đổi SAU nó mà
      không báo gì. Đây là `ponytail:` đặt từ đợt 1, giờ gỡ.
- [x] **Migration `0012_court_map_url`**: Thêm cột `map_url text` cho bảng `courts` hỗ trợ link Google Maps, mở bản đồ trực tiếp.
- [x] **Highlight trực quan bảng Danh sách buổi (`sessionColumns`) & Card Buổi tới**: Thiết kế lại toàn bộ các cột với badge màu sắc phân biệt rõ ràng (Thứ/Ngày, Nhóm ca có icon, Giờ & Sân nổi bật, Điểm danh xanh lá, Khách màu cam, Cầu màu cyan, Tiền sân & Thu khách rõ ràng).

- [ ] **Trần thứ hai:** `clubs.levels` mặc định của DB (`Newbie · TBY · TB- · TB`) KHÁC
      `app.json → levelsDefault` (9 bậc) mà màn đăng ký dùng. Chọn 'Y+' lúc đăng ký rồi tạo CLB
      thì `create_club` hạ về `levels[1]` — đúng luật mới, nhưng im lặng. Sửa cho khớp là đổi
      hành vi của mọi CLB tạo mới, để user quyết.
- [ ] **Chưa làm: GỘP hai bản ghi cùng một người** (bấm nhầm "Tạo thành viên mới"). Vẫn như cũ:
      16 cột trỏ tới `club_members`, 4 UNIQUE, sync ghi từng dòng không transaction → phải là RPC
      riêng. Đợt này chỉ làm cho việc đó ÍT xảy ra hơn, không sửa được ca đã lỡ.

---

## Đợt dọn i18n — gỡ chữ cứng + khoá luật · **XONG 2026-09-02**

Không đụng schema, không migration, không đổi một dòng logic nào — chỉ đổi chỗ CHỨA chữ.

- [x] **323 dòng code còn chữ tiếng Việt viết cứng → `vi.json`** (≈200 key mới). Phân bố: `Debts.jsx` 85 ·
      `Settings.jsx` 35 · `Dialogs.jsx` 33 · `Home.jsx` 31 · `Members.jsx` 27 · `SessionDetail.jsx` 26 ·
      `appActions.js` 24 · `Fund.jsx` 22 · `csv.js` 17 · `Clubs.jsx` 8 · còn lại lẻ ở `SearchSelect` ·
      `Sidebar` · `ui/index` · `ledger.js` · `money.js` · `Sessions.jsx`.
      Gốc: các đợt dựng lại màn Công nợ / Cài đặt / Sổ quỹ viết thẳng nhãn vào JSX. Phase 0 vẫn
      khai *"không còn chữ cứng trong .jsx"* suốt thời gian đó — **doc nói dối, không ai kiểm được.**
- [x] **Báo cáo Zalo (`copyZalo`) tách ra họ key `zalo.*`** — 13 dòng ghép chuỗi, là văn bản người
      dùng dán thẳng vào nhóm Zalo chứ không phải log.
- [x] **Hộp thoại nhập CSV thôi chép tay danh sách cột.** `Dialogs.jsx` in lại 5 + 2 tên cột bằng
      chữ cứng, lệch với `csv.js` lúc nào không biết; giờ render thẳng từ `TEMPLATE_HEADERS` /
      `OPTIONAL_HEADERS`. Một nguồn sự thật, sửa cột là hai chỗ đổi cùng lúc.
- [x] **Dấu `// i18n-ok` — cửa lách luật DUY NHẤT, phải kèm lý do** (`RULES.md` §3.1). Dùng đúng
      3 chỗ: tên cột file CSV (hợp đồng định dạng — dịch là từ chối hàng loạt file cũ) · nội dung
      file CSV mẫu · regex bỏ dấu `.replace(/đ/g,'d')` trong các hàm chuẩn hoá tìm kiếm.
- [x] **`smoke/i18n.test.js` gác thêm CHIỀU NGƯỢC LẠI.** Test cũ chỉ hỏi *"key đang dùng có tồn
      tại không"* — viết thẳng `'Đã xoá thành viên'` vào JSX thì chẳng key nào thiếu, test vẫn
      xanh. Cách bắt: chữ tiếng Việt luôn có dấu (tách ra bằng NFD) hoặc chữ `đ`, còn cú pháp JS
      thì không bao giờ — nên quét dấu trên dòng code đã cắt comment là đủ, không cần parse.
      Mutation-test 3 nhánh: chuỗi cứng bị bắt · `i18n-ok` được tha · comment được tha.
- [x] Dọn nốt hai chỗ chép lại chữ đã có key: `ledger.js` ghép tay nhãn hoá đơn sân trong khi
      `ledger.label.courtBill` nằm sẵn đó, và `SessionDetail` fallback `t('settings.openMap') || 'Bản đồ'`
      — `t()` không bao giờ trả rỗng nên nhánh `||` là code chết.

**Đánh đổi:** ~200 key mới làm `vi.json` phình lên. Đổi lại là đổi câu chữ ở MỘT chỗ, và thêm
`en.json` không phải đụng màn hình nào — đúng cái `RULES.md` §3.1 hứa từ đầu.

---

## Quyết định đang chờ user

| Việc | Vì sao cần user | Chặn cái gì |
| --- | --- | --- |
| ~~**Mốc cutoff của P6**~~ | **Không còn chặn 2026-09-01:** chưa có dữ liệu thật nên không có lịch sử để bảo tồn — P6b ghi thật từ đầu | — |
| ~~Chạy `npm run build`~~ | **Xong 2026-09-02** — build pass | — |
| ~~Script kiểm RLS bằng 2 tài khoản~~ | **Xong 2026-09-01** | — |
| Dữ liệu thật của CLB (Excel) | cần số quỹ mang sang + danh sách thật | nhập liệu ban đầu |

**Đã chốt, không hỏi lại:** dựng + chạy DB (xong 2026-08-24) · P6 dùng **cutoff** không backfill ·
**không** làm `wallets` (T1) · **không** thêm công tắc tắt nhắc kiểm kho · thiết kế khách (Phase 10)
làm sau P5–P7 và phải thảo luận trước · két = vai `owner` + `treasurer` · két tự ứng thì ghi CHI
thẳng không tạo nợ.
