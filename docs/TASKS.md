# TASKS.md

**Version:** v0.5.0 · **Updated:** 2026-08-20

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
- [ ] **Kiểm RLS bằng 2 tài khoản khác CLB.** Policy đã viết đủ cho 30 bảng nhưng CHƯA được
      chứng minh. Sai chỗ này thì CLB A đọc được tiền của CLB B — nặng hơn mọi mục dưới.
      Cách làm đã bàn: script node ký 2 tài khoản qua anon key, tạo 2 CLB, assert A không
      đọc/ghi được gì của B. Cần Supabase local đang chạy. **Chờ user duyệt.**

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
- [ ] Trigger ghi `audit_logs` cho mọi bảng dính tiền.
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

### P5 · Issue 4 + L3 · Thành viên ứng tiền — migration `0011`

- [ ] **L3 · Dọn dữ liệu trước.** `dbmap.js` đang ghi **tên người trả** (chuỗi tự do) vào cột
      `funded_by`. Chuyển sang `payer_member_id` rồi mới `ALTER TYPE` sang enum, không thì migration chết.
- [ ] `funded_by` enum `fund_source` + bảng `member_payables`. `member_advance` → **không** ghi chi,
      tạo khoản phải trả; khi trả người ứng mới ghi chi.

### P6 · Issue 2 · Sổ quỹ ghi thật — migration `0012` + đổi `lib/ledger.js`

- [ ] Mỗi sự kiện ở `DATABASE.md` §3.1 ghi ngay một dòng `transactions` kèm `ref_type` + `ref_id`.
      Bỏ tick thì ghi dòng đảo chiều, không xoá cứng.
- [ ] `ledger()` chuyển thành đọc một bảng. Xoá dần các nhánh suy ra.
- [ ] Đây là mục đã treo ở "Quyết định đang chờ user" — **đã chốt: làm, nhưng sau cùng.**

### P7 · Mục 4 · Chống sai im lặng

Mười một lỗi nhóm B đều cùng một đặc điểm: **im lặng**, không có gì để so nên không ai phát hiện.
Hai việc dưới bắt được gần hết.

- [ ] **Màn "Đối chiếu quỹ" — P0 trong nhóm này.** Thủ quỹ nhập số dư NH + tiền mặt đang giữ, app
      so với sổ và **liệt kê nghi vấn cụ thể** sắp theo mức khớp, không chỉ báo lệch. Lưu
      `fund_reconciliations` để lần sau chỉ đối chiếu phần phát sinh.
      Bắt: B1 · B2 · B3 · B4 · B9 · B10 · B11.
- [ ] **Checklist trước khi chốt buổi.** Dialog liệt kê những gì còn treo, buộc xử lý: ai chưa
      điểm danh · sân đánh dấu bán mà chưa nhập tiền · số cầu đang là định mức · khách còn ghi nợ.
      Dòng cuối: *"Chốt buổi này không ghi khoản chi nào vào sổ quỹ."* Bắt: B4 · B6 · B7, xử lý luôn N1.
- [ ] **B1 · Quên nhập hoá đơn sân tháng — 1.920.000, sai nặng nhất.** Alert đỏ ở Trang chủ khi
      tháng có buổi `closed` mà `court_bills` tháng đó trống.
- [ ] **B5 · Buổi huỷ không đánh `cancelled`** → `n` cao hơn thật → `unit` thấp → back trả thiếu.
      Buổi quá ngày còn `draft` thì nhắc ở Trang chủ, buộc chọn *đã đánh* hoặc *đã huỷ*.
- [ ] **B7 · Buổi để `open` mãi** → sai tồn kho, sai back, sai tiền sân mode `session`, mất khỏi
      báo cáo. Trang chủ hiện số buổi quá hạn chưa chốt.
- [ ] **T1 · Không có khái niệm "tiền đang ở đâu".** `wallets` + `transactions.wallet_id`. Mở
      được quyền cho vai `host` tick thu khách — hiện họ bị chặn khỏi mọi mục tiền, chính là nguyên nhân B9.
- [ ] **T2 · Không phân biệt số dư sổ và số dư khả dụng.** StatCard "Số dư khả dụng" cạnh "Số dư
      quỹ CLB", caption liệt kê nghĩa vụ chưa trả.
- [ ] **N5 / mục 8 · Tồn kho quy tiền** ở màn Sổ quỹ (`số quả còn × giá bình quân`) — user đang
      đọc quỹ **thấp hơn** thực tế vì quên số cầu trong tủ.

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

---

## Quyết định đang chờ user

| Việc | Vì sao cần user | Chặn cái gì |
| --- | --- | --- |
| Chạy `npm run db:start` + `db:migrate` + `db:env > .env.local` | agent không tự cài/chạy hạ tầng trên máy user | chạy được app |
| Chạy `npm run build` | RULES §6: agent không tự build | không ai biết bản này compile được hay chưa |
| Có viết script kiểm RLS bằng 2 tài khoản không | script sẽ tạo tài khoản thật trên DB của user | chứng minh CLB A không đọc được CLB B |
| Có xoá sạch DB (`npx supabase db reset`) hay giữ tài khoản cũ | mất data, phải user quyết — `docs/RULES.md` §7 | bắt đầu sạch |
| Dữ liệu thật của CLB (Excel) | cần số quỹ mang sang + danh sách thật | nhập liệu ban đầu |
