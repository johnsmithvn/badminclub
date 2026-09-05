# FEATURES.md

**Version:** v0.4.0 · **Updated:** 2026-09-02

Chức năng theo màn hình, kèm **luật nghiệp vụ** dễ làm sai. Bố cục và copy chính xác nằm ở handoff
`02-screens-ui-spec.md` — file này không lặp lại pixel, chỉ nói **app phải xử sự thế nào**.

---

## 0. Ba nguyên tắc chi phối mọi màn hình

1. **Không ai phải nhập thứ app tự suy ra được.** Không nhập giá khách (tự tính theo trình độ ×
   giới tính). Không nhập tiền sân (giờ × giá sân).
2. **Mọi con số phải giải thích được nguồn gốc.** Con số nào cũng đi kèm một câu nói nó từ đâu ra:
   *"250.000 ÷ 5 buổi của Cố định Chủ nhật"*.
3. **Chỉ có MỘT tầng tiền: sổ quỹ** (`DATABASE.md` §3) — tiền đã đổi tay. Chốt buổi chỉ ghi sổ
   đúng ba thứ: sân bán được, sân thuê thêm, và tiền sân nếu CLB trả theo buổi.
   Chia sân, số trận, bấm giờ **không bao giờ** ảnh hưởng tiền.

---

## 0. Bắt đầu với một CLB rỗng

CLB vừa tạo chỉ có: bạn (vai `owner`), một loại cầu mặc định, và thang trình độ mặc định. Thứ tự
nhập liệu **bắt buộc** theo dây phụ thuộc:

| Bước | Ở đâu | Vì sao phải trước |
| --- | --- | --- |
| 1. Sân | Cài đặt → Sân | Nhóm cố định phải chỉ ra đánh ở sân nào; tiền sân từng buổi tính từ giá giờ |
| 2. Nhóm cố định | Cài đặt → Nhóm cố định | Quỹ tháng và lịch tập đều tính theo nhóm |
| 3. Thành viên | Thành viên → Thêm thành viên (hoặc Nhập CSV) | Không cần họ có tài khoản; ghép sau ở Cài đặt |
| 4. Lịch tập cố định | Lịch tập cố định | Sinh sẵn buổi cho cả kỳ |
| 5. Giá khách giao lưu | Cài đặt → Cách chia tiền | Mặc định 0 đ — không sửa thì thu khách ra 0 |

Trang chủ hiện thẻ nhắc bốn bước đầu và tự ẩn khi đủ. Thang trình độ sửa ở Cài đặt → Chung:
thứ tự trong danh sách chính là thứ tự mạnh dần mà thuật toán cân sân dùng.

---

## 1. Vòng đời một tháng

```
Lịch tập cố định  →  sinh buổi (draft)
      ↓  Mở điểm danh
Buổi (open)  →  điểm danh · thêm khách giao lưu
      ↓  Chia sân (kéo thả · xếp thông minh · bấm giờ · Xong trận)
      ↓  Chốt tiền buổi
Buổi (closed)  →  vào sổ quỹ và mọi thống kê
      ↓  Cuối tháng
Back tiền người nghỉ / Thu đi thêm  →  Chốt danh sách tháng sau (ngày lock_day = 25)
```

Trạng thái buổi: `draft` (Chưa mở) · `open` (Đã mở) · `closed` (Đã chốt) · `cancelled` (Đã hủy).
Buổi `cancelled` **không** tính tiền và **không** tính vào số buổi khi chia đơn giá/buổi.

---

## 2. Trang chủ (`/`)

Hai tab: **Tổng quan** · **Báo cáo**.

Tổng quan: 6 StatCard (số dư quỹ, công nợ khách, tiến độ đóng quỹ, thu tháng, chi tháng,
buổi đã chốt) · "Buổi tới" (mở điểm danh trước giờ chơi) ·
"Tiến độ đóng quỹ tháng" (kèm chip từng người **chưa** đóng, bấm là đánh dấu đã đóng) ·
"Đi nhiều nhất" top 7 · "Khách nợ nhiều nhất" 5 dòng · "Buổi gần nhất" (bảng, click mở buổi).

Báo cáo: thu chi theo tháng (cột đôi) · tỷ lệ đi tập · khách theo trình độ.

## 3. Buổi tập (`/buoi-tap`) và Chi tiết buổi (`/buoi-tap/:id`)

Điểm danh: bấm vào tên để đổi Có mặt / Vắng. Có "Tất cả có mặt" / "Tất cả vắng".
Chỉ hiện **thành viên cố định của nhóm trong tháng đó** (`roster` = `fixed`).

**Hai đường cho người đi lẻ — đừng nhầm:**

| Ai | Thêm ở đâu | Trả bao nhiêu | Vào báo cáo nào |
| --- | --- | --- | --- |
| **Thành viên CLB**, không cố định nhóm đó | khối Điểm danh → *Thêm người đi lẻ* | **đơn giá một buổi** của nhóm | Công nợ → Thu / Hoàn theo buổi |
| **Người ngoài CLB** (vãng lai) | khối Khách giao lưu | **bảng giá khách** theo trình độ × giới tính | Khách theo trình độ · số lượt khách |

Nhét thành viên vào danh sách khách là sai cả ba: sai người, thu vượt (giá khách > đơn giá buổi),
và phồng báo cáo khách vì đếm cả người nhà.

**Khách giao lưu:** nhập tên + giới tính + trình độ + người rủ → giá tự tính, **chốt luôn** vào
bản ghi. Trùng tên khách cũ thì tái dùng bản ghi khách, chỉ cập nhật người rủ.
Mỗi khách có công tắc *đã trả* / *ghi nợ*.

**Sân của buổi** — hai luật hay bị nhầm:

| Việc | Hệ quả tiền |
| --- | --- |
| **Bán sân dư** cho CLB khác | sân đó **không** tính vào tiền sân của buổi; tiền bán ghi **thu** |
| **Thuê thêm sân** (`extra`) | ghi **chi riêng** ngoài hoá đơn tháng |

Chốt buổi **đóng băng tiền sân từng dòng** (`session_courts.cost`) để chủ sân tăng giá sau này
không làm trôi số của buổi cũ. Ngoài ba dòng ở §0, chốt buổi không sinh giao dịch nào.

Nút chốt buổi là hành động primary **duy nhất** của trang.

**Khóa thao tác khi buổi đã chốt (`closed`):**
- Ẩn các nút: **Mở lại buổi**, **Hủy buổi**, **Xóa hẳn**.
- Vô hiệu hóa / ẩn các thao tác sửa đổi: Thêm sân, Bán sân / Hủy bán, Xóa sân phụ trội, ô Ghi chú buổi.
- Nút "Mở lại buổi" chỉ hiển thị với buổi đã hủy (`cancelled`).

## 4. Buổi tập & Chia sân hợp nhất (`/buoi-tap/:id`)

Chi tiết buổi tập được thiết kế lại thành thanh Tab Bar 3 tabs chuyển đổi mượt mà:

### Tab 1: Điểm danh & Tiền (`attend`)
- Giữ nguyên 100% logic điểm danh (Có mặt / Vắng / Đi thêm) và thu tiền khách giao lưu.
- Đánh Vắng một người sẽ **tự động gỡ người đó khỏi bất kỳ ô sân nào đang ngồi** (Quy tắc Handoff).

### Tab 2: Chia sân (`courts`)
- **Pool người chờ**: Chỉ những ai đã điểm danh Có mặt mới vào pool. Người dùng bấm chọn 1 người rồi bấm ô trống trên sân.
- **Kèo đã nhận, đang chờ sân**: Hiển thị danh sách kèo trạng thái `ACCEPTED`. Nút "Đưa lên sân trống" tự động xếp 4 người vào sân rỗng.
- **Grid sân & Thẻ sân**:
  - Timer bấm giờ trận đấu.
  - Hiển thị độ cân bằng trình độ (`Cân trình`, `Hơi lệch`, `Lệch trình`).
  - Nút `Xong trận · nhập tỷ số`: Mở `ScoreModal` để ghi nhận tỷ số các set và tính Elo.
  - Nút `Trả sân`: Giải phóng 4 người về lại Pool chờ.
- **5 chế độ xếp thông minh**: Cân trình, Đều lượt, Chỉ xếp chỗ trống, Cùng trình độ, Random.
- **Cố định người theo sân** & **Chia đều vào sân**.

### Tab 3: Trận & Kèo (`matches`)
- **Danh sách trận trong buổi**: Phân loại nguồn (Chia sân vs Từ kèo), xem tỷ số từng set, biến động Elo.
- **Danh sách kèo trong buổi**:
  - Tạo kèo đấu mới qua `CreateChallengeModal`.
  - Quản lý trạng thái: `PENDING`, `ACCEPTED`, `DECLINED`, `ONCOURT`, `PLAYED`, `CANCELLED`.
  - Hỗ trợ xem theo góc nhìn: Người tạo, Đội được thách đấu, Khách xem.
  - Tự động hiển thị lịch sử đối đầu (H2H) giữa 2 đội (K4).

---

## 5. Bảng xếp hạng Elo & Lịch sử Thi đấu (`/bang-xep-hang`)

Màn hình Bảng xếp hạng 5 tabs toàn diện:

1. **Mùa giải (`season`)**:
   - Xếp hạng thành viên theo Elo Rating giảm dần.
   - Hiển thị Rank (#1, #2, #3 nổi bật), Tên, Giới tính, LevelChip, Điểm Elo, Thanh độ tin cậy (Confidence Bar), Tỷ số Thắng-Thua, Tỷ lệ thắng %, Form 5 trận gần nhất (W/L badge).
2. **Biểu đồ & Hồ sơ Rating (`chart`)**:
   - Thẻ hồ sơ thành viên với điểm Elo lớn, cấp độ độ tin cậy R1 -> R5, thanh tiến trình % và số trận cần thêm để nâng cấp.
   - Nút **⚔️ Gạ kèo** mở popup tạo kèo với thành viên đang xem.
   - 4 card phân rã ngữ cảnh thực chiến: Gặp Nam, Gặp Nữ, Đánh Đôi, Đánh Đơn.
3. **Tìm trận & Sửa tỷ số inline (`search`)**:
   - Tìm kiếm trận đấu theo Người chơi A và B (Chế độ Đối đầu hoặc Cùng đội).
   - Lọc trận chất lượng: Trận sát điểm (≤ 3 điểm), Trận bất ngờ (Upset).
   - Nút **⚔️ Gạ kèo giữa 2 bạn** khi chọn đủ 2 đấu thủ.
   - Nút **Sửa** mở `EditScoreModal`: Sửa tỷ số trực tiếp, bắt buộc nhập lý do sửa, ghi audit log và tự động chạy `replayRatingCascade` để tính lại chuỗi Elo các trận sau đó.
4. **Ma trận Đối đầu H2H (`matrix`)**:
   - Bảng đối đầu NxN giữa các đấu thủ hàng đầu CLB với tỷ số thắng-thua màu sắc trực quan.
   - Danh sách các cặp thành viên chưa từng chạm trán kèm nút click gạ kèo nhanh.
5. **Thống kê Hiệu chỉnh chéo giới (`cross`)**:
   - Tỷ lệ Nữ thắng Nam theo các khoảng lệch Elo (<100, 100-300, >300).
   - Học tự động từ dữ liệu thi đấu thực chiến của CLB.

---

## 6. Lịch tháng · Lịch cố định · Thành viên

**Chốt danh sách cố định** làm được cho **cả tháng đang xem lẫn tháng sau** — nút chuyển nằm ngay
trên thẻ. Dựng CLB giữa tháng thì việc đầu tiên là chốt danh sách **tháng này**, không thì không
có `monthly_dues` nào để thu và màn Công nợ trống trơn.

**Sửa thành viên** đổi được cả nhóm cố định, kèm chọn áp dụng *từ tháng này* hay *từ tháng sau*
(mặc định tháng sau — tháng này có thể đã đóng tiền). Gỡ hết nhóm = người đó thành **đi lẻ**:

| Khoản quỹ tháng của nhóm bị gỡ | Xử lý |
| --- | --- |
| Chưa đóng đồng nào | **xoá** — không thì bị nhắc một khoản không còn phải đóng |
| Đã đóng một phần / đủ | **giữ nguyên** trong sổ quỹ, ghi chú lý do. Tiền đã vào quỹ thật thì không tự bốc hơi, và họ đã trả cho các buổi của tháng đó |

Người đã đóng quỹ tháng cho một nhóm thì **không bao giờ** bị tính thêm tiền đi lẻ ở nhóm đó,
kể cả sau khi chuyển sang vãng lai — điều kiện là *đã trả tiền tháng chưa*, không phải *có tên
trong danh sách cố định không*.

**Xoá thành viên**: mặc định là **ngưng hoạt động** — giữ nguyên điểm danh và tiền của các tháng
cũ. Xoá cứng chỉ mở khi người đó chưa dính gì (chưa điểm danh, chưa có quỹ, chưa đánh trận, chưa
ghép tài khoản).

Ngưng hoạt động là thao tác **đảo lại được**: tab Tất cả có bộ lọc *Đang hoạt động / Đã ngưng*,
tự hiện khi CLB có người đã ngưng. Người đã ngưng **không** bị sinh quỹ tháng mới nữa khi chốt
danh sách — nhưng khoản đã sinh trước đó thì giữ nguyên, tiền đã vào sổ không tự bốc hơi.

**Ngưng người đang cố định mà đã đóng quỹ tháng này** → app hỏi một câu: quỹ đang giữ tiền của
những buổi họ sẽ không đánh nữa, có trả lại không? Số gợi ý là `đơn giá một buổi × số buổi còn
lại`, sửa được. Ba lối ra tách bạch — *Huỷ* (không ngưng) · *Chỉ ngưng, không trả* · *Ngưng và
trả lại*. Chọn trả thì ghi thẳng một dòng chi hạng mục **Back cố định nghỉ** vào sổ quỹ, không
đi qua bảng đối chiếu (người đã ngưng không còn sinh dòng đối chiếu). Bỏ qua bây giờ thì cuối
tháng đổi ý vẫn ghi tay được ở Sổ quỹ → Ghi thu/chi, cùng hạng mục đó.

Thêm thành viên chọn *cố định từ tháng này* thì họ được ghi cố định cho **cả hai** tháng, và sinh
luôn khoản quỹ tháng này: nhóm chưa có buổi nào thì **thu trọn gói**, đã có buổi rồi thì **thu
theo số buổi còn lại** tính từ hôm nay.

**Nhập / Xuất danh sách thành viên bằng CSV (`src/lib/csv.js`):**
- Hỗ trợ tải file CSV mẫu chuẩn UTF-8 kèm BOM hiển thị tốt trong Excel.
- Tự động nhận diện header cột linh hoạt, chuẩn hóa giới tính/trình độ/nhóm.
- Kiểm tra tính hợp lệ và cảnh báo trùng tên/SĐT trước khi nhập hàng loạt.

- **Lịch tháng**: lưới tháng, chip buổi theo màu trạng thái, bấm mở buổi.
- **Lịch cố định**: tạo một lần → sinh buổi cả kỳ. Không sinh trùng (đã có buổi cùng ngày + nhóm thì bỏ qua).
- **Thành viên**: danh sách + 2 hàng chờ duyệt:
  - *Đăng ký cố định tháng sau* — trạng thái theo tháng: `fixed` / `off` / `pending`.
  - *Thay đổi thông tin* — **đổi trình độ áp dụng từ tháng sau**, **đổi SĐT áp dụng ngay**.

## 6. Công nợ · Sổ quỹ

**Công nợ (`/cong-no`)** tổ chức thành các tab tinh gọn và chuyên nghiệp:
1. **Thu / Hoàn theo buổi**:
   - Gộp chung toàn bộ khoản thu khách ngoài, hội viên đi thêm buổi và hoàn tiền cho hội viên cố định vắng mặt (`member_adjustments`).
   - Gom dữ liệu theo từng người chơi: hiển thị tổng số buổi, số tiền ròng cần thu (`+`) hoặc cần trả (`−`), nút `[Thu tất cả]` / `[Trả tất cả]`.
   - **Mở rộng xem chi tiết từng buổi (Accordion)**: ngày giờ, ca tập, sân đấu cụ thể.
   - **Sửa số tiền trực tiếp (Inline Price Edit)**: cho phép điều chỉnh số tiền của từng buổi linh hoạt trước khi thu/hoàn.
   - **Hai chế độ hiển thị (Toggle)**: Chuyển đổi linh hoạt giữa `[☰ Dạng Bảng]` (kế toán thẳng thớm) và `[⊞ Dạng Lưới Thẻ]` (các ô vuông block hiện đại, xóa khoảng trắng thừa).
   - **Tìm kiếm & Sắp xếp đa năng**: Tìm kiếm tiếng Việt không dấu (theo tên người chơi, người rủ, ca, sân), lọc theo đối tượng (`Hội viên` / `Khách ngoài`), sắp xếp theo tiền nợ, tên A-Z, số buổi.
2. **Quỹ tháng**:
   - Thu quỹ tháng trọn gói của hội viên cố định, lọc theo từng ca/nhóm.
   - Hỗ trợ cả 2 chế độ Bảng và Lưới thẻ, tìm kiếm thành viên/SĐT và sắp xếp theo số tiền còn thiếu/đã đóng.
3. **Quỹ nợ (Thành viên ứng tiền)**:
   - Theo dõi các khoản hoá đơn sân mà thành viên ứng tiền túi thay cho CLB, hỗ trợ bấm hoàn trả khi quỹ hoàn tiền lại cho thành viên.

**Đối chiếu buổi chạy hai chiều**, cùng một đơn giá, chỉ khác dấu:

| | Ai | Dấu | Ghi sổ khi bấm |
| --- | --- | --- | --- |
| Vắng buổi cố định | người trong danh sách cố định của nhóm | **−** quỹ nợ người | chi · Back cố định nghỉ |
| Đi thêm buổi nhóm khác | thành viên CLB, không cố định nhóm đó | **+** người nợ quỹ | thu · Đi thêm buổi |

`đơn giá = quỹ tháng NGƯỜI ĐÓ THỰC ĐÓNG ÷ số buổi của nhóm trong tháng`. Đọc `monthly_dues` chứ
không đọc cấu hình nhóm hiện tại — sửa quỹ nhóm giữa chừng thì người đã đóng giá cũ phải được
đối chiếu theo giá cũ.

**Sổ quỹ (`/so-quy`)** — Minh bạch dòng tiền phong trào CLB:
- **Tab mặc định là Chi tiết thu chi**: Hiển thị rành mạch từng khoản tiền thực tế: Quỹ tháng của ai, Hoá đơn tiền sân trọn tháng, Tiền mua mấy ống cầu, Sân thuê thêm lẻ của buổi nào, Hoàn tiền vắng... Các khoản cùng ngày cùng loại được gom gọn gàng, bấm để bung ra xem chi tiết.
- **Tab Tổng kết quỹ tháng**: Báo cáo tổng kết quỹ phong trào 2 cột cực kỳ trực quan:
  - 4 Thẻ chỉ số: `Tổng tiền thu từ anh em` (+), `Tổng chi phí hoạt động` (-), `Chênh lệch thu - chi tháng` (Báo rõ Thặng dư hay Hụt quỹ), và `Số dư quỹ hiện tại`.
  - Bảng Cân đối 2 cột: Cột trái (Các khoản thu từ anh em) & Cột phải (Các khoản chi hoạt động).
- **Tiền sân**: CLB thanh toán trọn gói 1 lần cả tháng theo Hoá đơn tiền sân. Khi buổi tập có phát sinh sân thuê thêm ngoài giờ (`extra: true`), hệ thống tự động ghi thêm 1 dòng Chi riêng cho sân đó vào sổ quỹ.

> **Module Kho cầu đã gỡ bỏ.** Không còn nhập kho, định mức, đếm ống, kiểm kho, tồn kho hay giá
> bình quân. Tiền mua cầu ghi như mọi khoản chi khác: Sổ quỹ → *Ghi thu/chi* → hạng mục **Mua cầu**.

## 7. Hồ sơ · Cài đặt

**Hai màn hồ sơ, hai bảng khác nhau** — đừng gộp lại:

| Màn | Ở đâu | Sửa bảng | Sửa được gì |
| --- | --- | --- | --- |
| **Hồ sơ tài khoản** | `/tai-khoan`, **ngoài** CLB | `profiles` | tên đầy đủ · tên gọi · SĐT · giới tính · trình độ gợi ý. `email` chỉ đọc — nó là tên đăng nhập |
| **Hồ sơ của tôi** | `/ca-nhan`, **trong** CLB | `club_members` | tự đổi **tên hiển thị** và **tên đầy đủ**. SĐT / trình độ thì gửi yêu cầu, chủ CLB duyệt |

**Hai tên, ở cả hai nơi.** Tài khoản có *tên đầy đủ* + *tên gọi*; trong CLB có *tên đầy đủ* +
*tên hiển thị* — từng cặp tương ứng nhau. Tên hiển thị là cái nằm trên bảng điểm danh, bảng chia
tiền và báo cáo Zalo; tên đầy đủ chỉ hiện nhỏ bên dưới ở màn Thành viên và Hồ sơ, không thay chỗ
của tên hiển thị ở đâu cả. **Email trong CLB** cũng là cột riêng, không bắt buộc, không phải email
đăng nhập.

Sửa hồ sơ tài khoản **không** đổi gì trong CLB nào, và ngược lại: bản ghi trong CLB là bản sao
độc lập — đó là cái tên nằm trên mọi bảng điểm danh và mọi dòng tiền cũ. Thành viên cũng không
tự sửa `level` của mình được. Yêu cầu đổi đi qua `member_changes` — SĐT áp dụng ngay khi duyệt,
trình độ áp dụng từ tháng sau.

**Cài đặt** 6 tab: Chung · Biểu phí · **Sân & Cầu** · Nhóm & mức thu · Lịch tập cố định · **Tài khoản & quyền**.
- **Tab Chung**: Sửa tên CLB, quỹ mở đầu, ngày khoá sổ, thang trình độ của CLB, sao lưu cấu hình CLB (`Settings Export / Import` dạng file JSON).
- **Tab Biểu phí**: Mức quỹ cố định, tiền hoàn khi vắng, và bảng giá khách giao lưu dạng ma trận thẻ nhỏ gọn.
- **Tab Sân**: Quản lý danh sách sân (địa chỉ, link Google Maps, giá/giờ).
- **Tab Tài khoản & quyền**:
  - Mã CLB (`allow_code_join`): người mới nhập mã → yêu cầu chờ → chủ CLB **Ghép vào** bản ghi cũ / **Tạo thành viên mới** / **Từ chối**.
  - Trùng SĐT (`allow_phone_suggest`): so chỉ chữ số, gợi ý màu amber + nút Ghép. Không bao giờ tự ghép.
  - **Chọn 6 trường ghi đè khi ghép**: tên hiển thị, tên đầy đủ, SĐT, email, giới tính, trình độ. Mặc định không tick gì để bảo vệ tính toàn vẹn của CLB.
  - Khi ghép còn có thể chọn chuyển **Avatar** và **thông tin ngân hàng / QR** từ hồ sơ tài khoản sang hồ sơ CLB (0015).

**Sơ đồ dữ liệu**: trang tài liệu sống trong app, liệt kê bảng/cột theo schema Postgres thật.

**Avatar & Ảnh đại diện** (`AvatarUpload`):
- Upload ảnh đại diện cho CLB, hồ sơ tài khoản, và hồ sơ thành viên trong CLB.
- Ảnh lưu trên Supabase Storage (bucket `club-assets`, giới hạn 2MB, chỉ image).
- Hiển thị ở Sidebar (logo CLB), Hồ sơ tài khoản, Hồ sơ CLB, và danh sách thành viên.

**Thông tin ngân hàng & QR** (`BankAccountSection` + `QrModal`):
- CLB và thành viên đều có thể lưu **danh sách tài khoản ngân hàng** (chủ TK, số TK, tên NH) và **ảnh QR chuyển khoản**.
- `QrModal`: xem ảnh QR phóng to, quét mã QR từ ảnh bằng `jsqr` (client-side).
- Dùng cho: thu quỹ tháng (hiện QR chủ CLB), hoàn tiền thành viên (hiện QR người nhận).

**UI Component: SearchSelect (Combobox có tìm kiếm & Lazy Load)**:
- Component chọn thông minh tái sử dụng (`src/components/ui/SearchSelect.jsx`), thay thế hoàn toàn các thẻ `<select>` native dài lê thê khi chọn thành viên/người chơi.
- Tích hợp ô tìm kiếm tiếng Việt không dấu (gõ tên, SĐT, trình độ), huy hiệu trình độ màu (`LevelChip`), đóng mở popup mượt mà, và tự động lazy-load theo từng đợt 30 dòng khi cuộn danh sách lớn.
- Áp dụng tại: Chọn thành viên đi lẻ hôm nay (`ExtraPicker`), Chọn người rủ khách giao lưu (`GuestForm` & danh sách khách), Chọn thành viên để ghép trong Yêu cầu vào CLB (`JoinRow`), và Ghép tài khoản thủ công trong Cài đặt (`Access`).

---

## 8. Trạng thái rỗng, chặn, tải

- **Rỗng** = một câu **sự thật + việc cần làm**, không phải minh hoạ:
  *"Chưa có buổi nào để xếp"* + *"Vào Buổi tập → chọn buổi sắp tới → bấm Mở điểm danh"*.
- **Chặn hành động** (sai vai, thiếu dữ liệu) → **toast giải thích**, không disable im lặng:
  *"Vai này không được sửa thành viên"*, *"Sân này chưa có ai"*, *"Chọn bản ghi thành viên để ghép"*.
- **Tải** → skeleton hình dạng giống nội dung, không spinner.

---

## 9. Trải nghiệm Mobile (≤ 768px)

Bản mobile được tối ưu hóa cho màn hình cầm tay (≤768px) theo mật độ "Driver App" (touch target ≥48px, CTA chính 56px, body ≥16px):

1. **Khung điều hướng (Shell):**
   - Ẩn sidebar desktop; thay thế bằng Mobile Header (tên trang + subtitle mono ngày/giờ) và Footer Navigation 5 slot.
   - 4 slot đầu phân bổ theo vai: vai có cờ `money` (`owner`, `treasurer`) có slot 3 là Công nợ (`/cong-no`); vai không có cờ `money` (`member`) có slot 3 là Bảng xếp hạng, slot 4 là Hồ sơ (`/ca-nhan`). Slot 5 luôn là "Thêm" mở Bottom Sheet.
   - Sheet Thêm phân nhóm giữ đúng cấu trúc sidebar desktop (Tiền, Người và lịch có Chia sân nhảy thẳng buổi tập, Hệ thống), cuối sheet là thẻ Switcher CLB.

2. **Trang chủ (`/`):**
   - Giữ trọn vẹn 4 tab (Tổng quan · Giao dịch · Sân đấu · Báo cáo) trong `TabTrack` cuộn ngang.
   - StatCards xếp lưới 2 cột. Thẻ "Buổi tới" đặt trên lưới StatCards.
   - Các danh sách (Đi nhiều nhất, Khách nợ nhiều nhất, Buổi gần nhất) chuyển sang danh sách thẻ (`CardList`).

3. **Buổi tập (`/buoi-tap/:id`):**
   - Nút "Chốt buổi" là nút primary duy nhất ở header (màu xanh lá `--action-success-bg`). "Copy báo cáo Zalo" là nút ghost trong thân trang.
   - 3 tab (Điểm danh & tiền, Chia sân, Trận & kèo) có badge số liệu.
   - Điểm danh xếp dọc; nhãn quỹ chuyển xuống tầng 2 của mỗi dòng. Đánh vắng tự động gỡ khỏi sân và tính lại chi phí ngay.
   - Thao tác Xếp tự động và Nhập tỷ số mở dưới dạng Bottom Sheet.

4. **Bảng xếp hạng (`/bang-xep-hang`):**
   - 5 tab cuộn ngang. Dòng xếp hạng thành thẻ 2 tầng.
   - Ma trận H2H cho phép cuộn ngang với cột tên dán trái (sticky left).
   - Sheet Sửa tỷ số xếp dọc hai khối cũ/mới và bắt buộc nhập lý do trước khi lưu.

5. **Công nợ (`/cong-no`):**
   - Luôn sử dụng dạng thẻ (`viewMode = 'grid'`), ẩn nút toggle bảng desktop.
   - Bung từng buổi qua accordion kèm ô sửa tiền inline 56×44px.
   - Nút Lọc mở sheet điều kiện; QR mở full-screen sheet.

6. **Thành viên (`/thanh-vien`):**
   - Giữ đủ 4 tab. Thẻ thành viên định danh 2 tầng.
   - Tab Chờ duyệt chia rõ 2 nhóm: Đăng ký cố định tháng sau và Thay đổi thông tin, mỗi yêu cầu có cặp nút Duyệt/Từ chối.
   - Sheet Ngưng hoạt động có 3 lối ra tách bạch (*Ngưng và trả lại*, *Chỉ ngưng, không trả*, *Huỷ*).


