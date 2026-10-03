# FEATURES.md

**Version:** v2.0.0 · **Updated:** 2026-09-30

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
   Chia sân, số trận, bấm giờ, kèo đấu, dự đoán điểm mùa và xếp hạng Elo **không bao giờ** ảnh hưởng tiền.

---

## 0. Bắt đầu với một CLB rỗng

CLB vừa tạo chỉ có: bạn (vai `owner`) và thang trình độ mặc định. Thứ tự nhập liệu **bắt buộc** theo dây phụ thuộc:

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
      ↓  Chia sân (kéo thả · xếp thông minh · lập dây trận · bấm giờ · Xong trận)
      ↓  Chốt tiền buổi
Buổi (closed)  →  vào sổ quỹ và mọi thống kê
      ↓  Cuối tháng
Back tiền người nghỉ / Thu đi thêm  →  Chốt danh sách tháng sau (ngày lock_day = 25)
```

Trạng thái buổi: `draft` (Chưa mở) · `open` (Đã mở) · `closed` (Đã chốt) · `cancelled` (Đã hủy).
Buổi `cancelled` **không** tính tiền và **không** tính vào số buổi khi chia đơn giá/buổi.

---

## 2. Trang chủ (`/` — render `src/pages/MyStats.jsx`)

Trang chủ là **Bàn cờ cá nhân hoá** trung tâm dành riêng cho người dùng đang đăng nhập (route key `home`):

- **3 Subtab chức năng**:
  1. **Tab Cá nhân (`personal`)**:
     - `HeroRankCard`: Card vinh danh cá nhân gồm Avatar, Tên, Cấp bậc rank tier, Elo hiện tại, Điểm Mùa, Tỷ lệ thắng %, Tổng XP, Kệ 3 huy hiệu danh dự (`badge_shelf`) và châm ngôn cá nhân (`signature`).
     - `UpcomingSessionCard`: Nhắc buổi tập sắp tới của nhóm sinh hoạt, kèm nút RSVP tự điểm danh 1 chạm nhanh `[Có mặt]` / `[Báo vắng]`.
     - `SeasonRaceCard`: Vị trí đua top mùa giải của bản thân, khoảng cách điểm so với người đứng trên và người đuổi phía sau.
     - `RecentFormCard`: Phong độ 5 trận gần nhất (dải W/L badges màu sắc) kèm biến động Elo từng trận.
     - `RivalGoalCard`: Mục tiêu đối thủ bám đuổi (VĐV xếp ngay phía trên mình trên BXH Elo hoặc Mùa giải).
     - `SynergyBadgesCard`: Cặp bài trùng / đối tác ăn ý nhất (Best Partner) và các huy hiệu phong cách thi đấu nổi bật.
     - `MyOpponentsCard`: Danh sách các đối thủ thường xuyên chạm trán nhiều nhất kèm tỷ số thắng-thua đối đầu.
     - `NearbyStandingsCard`: BXH mini cục bộ hiển thị 1 người xếp trên, chính mình, và 1 người xếp dưới.
     - `RecentMatchesCard`: Danh sách các trận đấu gần đây nhất mà cá nhân tham gia kèm tỷ số set và link video replay nếu có.
     - `ClubFeedCard`: Tóm tắt các sự kiện nổi bật trong ngày của CLB.
  2. **Tab Trận đấu (`match`)**: Màn `HomeMatchTab` tổng hợp các trận đấu đã diễn ra và các kèo đấu nóng trong ngày của CLB.
  3. **Tab Hoạt động (`activity`)**: Bảng tin hoạt động toàn CLB (`ActivityTab`) tải theo dòng thời gian.

## 3. Buổi tập (`/buoi-tap`) và Chi tiết buổi (`/buoi-tap/:id`)

Điểm danh: bấm vào tên để đổi Có mặt / Vắng / Bùng kèo (noshow). Có "Tất cả có mặt" / "Tất cả vắng".
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
- Điểm danh 4 trạng thái: Có mặt (`present`), Vắng mặt (`absent`), Đi thêm (`extra`) và Bùng kèo (`noshow` — đăng ký nhưng không đến không báo trước).
- Đánh Vắng hoặc Bùng kèo một người sẽ **tự động gỡ người đó khỏi bất kỳ ô sân nào đang ngồi** (Quy tắc Handoff) và loại khỏi danh sách xếp trận.
- Thu tiền khách giao lưu và quản lý công nợ buổi trực tiếp.

### Tab 2: Chia sân (`courts`)
- **Pool người chờ**: Chỉ những ai đã điểm danh Có mặt mới vào pool. Người dùng bấm chọn 1 người rồi bấm ô trống trên sân.
- **Kèo đã nhận, đang chờ sân**: Hiển thị danh sách kèo trạng thái `ACCEPTED`. Nút "Đưa lên sân trống" tự động xếp vào sân rỗng.
  - Tự động làm sạch ô sân trước khi đưa kèo 1v1 lên sân (chống đè lẫn người từ 1v1 thành 2v2).
  - Tự động kiểm tra và chặn người vắng mặt/noshow tham gia thi đấu.
  - Gác thời hạn nhận kèo: ẩn nút nhận và cảnh báo hết hạn khi quá `expiresAt`.
- **Hẹn kèo trước trong CLB & Gán kèo tự do vào buổi chơi**:
  - Banner hiển thị các kèo hẹn trước trong CLB (`sessionId: null`).
  - Nút "Đưa vào buổi này" (`linkChallengeToSession`) cho phép quản trò hoặc người tham gia kèo gắn kèo vào buổi đang mở để xếp sân thi đấu và tính điểm.
- **Phân hệ Lập Dây Trận (Session Match Planner — `src/lib/planner.js`)**:
  - Chia buổi tập thành nhiều vòng đấu (rounds), mỗi vòng gồm các trận song song trên các sân.
  - Tự động xếp **Kèo thách đấu đã nhận (`ACCEPTED`)** với độ ưu tiên cao nhất, tự động lọc bỏ người vắng mặt (`!isPlayerAbsent`).
  - Giải quyết xung đột **Nguyện vọng thành viên** (muốn ghép cặp, tránh đối đầu, thích thể thức nam/nữ).
  - Tự động cân bằng số lượt ra sân và trình độ cho những người chơi còn lại.
  - Hỗ trợ cả 2 chế độ: Xếp lại toàn bộ (`replace`) và Điền vào slot trống (`fill`).
  - Nút "Nạp vào sân" đưa danh sách trận của một vòng đấu trực tiếp vào các slot sân thực tế.
- **Grid sân & Thẻ sân**:
  - Timer bấm giờ trận đấu.
  - Hiển thị độ cân bằng trình độ (`Cân trình`, `Hơi lệch`, `Lệch trình`).
  - Nút `Xong trận · nhập tỷ số`: Mở `ScoreModal` để ghi nhận tỷ số các set và tính Elo.
  - Nút `Nhập bằng giọng nói (Voice Match)`: Mở `VoiceMatchModal`, cho phép đọc tỷ số trực tiếp qua micro (Web Speech API) và phân tích cú pháp bằng `voiceMatchParser.js`.
    - Hỗ trợ câu lệnh 4 người: `<A B> THẮNG <C D> <Điểm 1> <Điểm 2>`.
    - Hỗ trợ câu lệnh vắn tắt trên sân đã có người: `<Tên> THẮNG <Điểm 1> <Điểm 2>` hoặc người tự nhận thua (`<Tên> THUA <Điểm 1> <Điểm 2>`).
    - Khử nhiễu thông minh: Phân biệt tên người trùng số đếm (ví dụ tên "Nam" vs số "lăm/năm", tên "Thắng" vs từ khóa "thắng").
    - Kiểm tra luật điểm cầu lông: Tối đa 30 điểm, chạm 20 cách biệt 2 hoặc chạm trần 30.
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
  - Tự động liên kết `sessionId` khi tạo kèo trong buổi.

---

## 5. Bảng xếp hạng & Lịch sử Thi đấu (`/bang-xep-hang`)

Màn hình Bảng xếp hạng **5 tabs** toàn diện:

1. **Mùa giải (`season` — `SeasonRaceTab`)**:
   - Xếp hạng thành viên theo điểm mùa giải dựa trên kết quả thi đấu đối kháng (Season Points). Logic tại `src/lib/season.js: calculateSeasonLeaderboard`.
   - Cơ chế cày rank 5 dải delta theo chênh lệch Elo đội: Cửa trên nặng (+10/-12), Cửa trên (+12/-10), Cân bằng (+14/-8), Cửa dưới (+17/-5), Cửa dưới sâu (+22/-3).
   - Sàn điểm Floor = 0: Thua không bị âm điểm mùa.
   - Thưởng chuỗi thắng: Streak 3 (+5 điểm), Streak 5 (+10 điểm).
   - Thưởng lật kèo Upset: +5 điểm khi thắng đội hơn $\ge 150$ Elo.
   - BXH mùa xếp thuần theo điểm (đã bỏ cổng "đủ N trận mới xếp trên" ngày 2026-09-28).
   - Trạng thái Tạm nghỉ (Inactive): 21 ngày không tham gia trận đấu nào.
   - Treo thưởng Vua Lì Đòn (Season Bounty): VĐV có chuỗi thắng đang chạy dài nhất ($\ge 3$ trận). Trận giao lưu không cắt chuỗi thắng.
   - Thẻ top 1/2/3 nổi bật dạng podium, thanh tiến độ mùa giải.
   - Modal `MemberSeasonLedgerModal`: Xem sổ ghi nhận điểm mùa chi tiết từng trận của VĐV.
   - Modal `SeasonSettingsModal`: Xem và cấu hình mùa giải (tên mùa, ngày bắt đầu, ngày kết thúc, gia hạn hoặc kết thúc sớm mùa).
   - Xuất CSV mùa giải.

2. **Elo/Profile (`elo` — `CareerEloTab`)**:
   - Xếp hạng thành viên theo Elo Rating giảm dần.
   - Hiển thị Rank, Tên, Giới tính, LevelChip, Điểm Elo, Thanh độ tin cậy (Confidence Bar), Tỷ số Thắng-Thua, Tỷ lệ thắng %, Form 5 trận gần nhất (W/L badge).
   - Histogram phân bố Elo toàn CLB.
   - Bấm vào thành viên → mở `MemberProfileTab` (hồ sơ cá nhân chi tiết: card cấp bậc Rank Tiers, tiến trình R1–R5, Kệ 3 huy hiệu danh dự `badgeShelf` và kho huy hiệu đạt được `badges`, phân tích theo thể thức, đối tác ăn ý, đối thủ kỵ giơ, sổ XP).

3. **Cặp đôi/Đối tác (`pairs` — `PairsTab`)**:
   - Xếp hạng các cặp đôi theo synergy (tỷ lệ thắng khi cùng đội, số trận chung, độ tin cậy).
   - Phân tích hiệu suất kết hợp: Cặp vàng, Cặp tiềm năng, Cặp chông chênh.
   - Mở `PairDetailModal`: Lịch sử các trận đã đấu cùng nhau, tỷ số từng set và biến động Elo.
   - `RatingFormulaModal`: Giải thích chi tiết và trực quan công thức tính điểm Elo.

4. **Đối đầu H2H (`matrix` — `PairH2HTab`)**:
   - Bảng đối đầu NxN giữa các đấu thủ hàng đầu CLB với tỷ số thắng-thua màu sắc trực quan (sticky tên hàng đầu tiên khi cuộn).
   - Danh sách các cặp thành viên chưa từng chạm trán kèm nút click gạ kèo nhanh.
   - `PairH2HModal`: Xem chi tiết lịch sử đối đầu giữa 2 người (số trận thắng, thua, hiệu số set, danh sách trận).

5. **Tìm trận / Chéo giới (`search`)**:
   - Tìm kiếm trận đấu theo Người chơi A và B (Chế độ Đối đầu hoặc Cùng đội).
   - Lọc trận chất lượng: Trận sát điểm (≤ 3 điểm), Trận bất ngờ (Upset).
   - Nút **Sửa** mở `EditScoreModal`: Sửa tỷ số trực tiếp, bắt buộc nhập lý do sửa, ghi audit log và tự động chạy `replayRatingCascade`.
   - Thống kê Hiệu chỉnh chéo giới: Tỷ lệ Nữ thắng Nam theo các khoảng lệch Elo (<100, 100-300, >300); học tự động từ dữ liệu thi đấu thực chiến của CLB.

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

**Cài đặt** 6 tab: **Chung** · **Biểu phí** · **Sân** · **Nhóm & mức thu** · **Lịch tập cố định** · **Tài khoản & quyền**.
- **Tab Chung**: Sửa tên CLB, quỹ mở đầu, ngày khoá sổ, thang trình độ của CLB, cài đặt kiểu banner nhắc nợ (`debt_banner`: `alert` / `bar` / `slim` / `off`), và sao lưu & khôi phục cài đặt CLB (`Settings Export / Import` dạng file JSON, hỗ trợ tick chọn từng phần).
- **Tab Biểu phí**: Mức quỹ cố định, tiền hoàn khi vắng, bảng giá khách giao lưu dạng ma trận thẻ nhỏ gọn, và cấu hình ưu đãi giảm trừ cho hội viên cố định khi đi thêm buổi ngoài nhóm (`has_member_extra_discount`, `member_extra_discount`).
- **Tab Sân**: Quản lý danh sách sân (địa chỉ, link Google Maps, giá/giờ) và gán nhãn số sân (`court_label`) cho từng sân.
- **Tab Nhóm & mức thu**: Quản lý các nhóm sinh hoạt cố định (ca, giờ, ngày trong tuần, mức đóng nam/nữ, đơn giá buổi nam/nữ).
- **Tab Lịch tập cố định**: Tạo lịch sinh buổi tự động theo chu kỳ, gán sân và nhãn sân cụ thể.
- **Tab Tài khoản & quyền**:
  - Mã CLB (`allow_code_join`): người mới nhập mã → yêu cầu chờ → chủ CLB **Ghép vào** bản ghi cũ / **Tạo thành viên mới** / **Từ chối**.
  - Trùng SĐT (`allow_phone_suggest`): so chỉ chữ số, gợi ý màu amber + nút Ghép. Không bao giờ tự ghép.
  - **Chọn 6 trường ghi đè khi ghép**: tên hiển thị, tên đầy đủ, SĐT, email, giới tính, trình độ. Mặc định không tick gì để bảo vệ tính toàn vẹn của CLB.
  - Khi ghép còn có thể chọn chuyển **Avatar** và **thông tin ngân hàng / QR** từ hồ sơ tài khoản sang hồ sơ CLB (0015).
  - Phân quyền 3 vai (`owner`, `treasurer`, `member`) theo ma trận quyền chuẩn.

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
   - 3 tab vinh danh cốt lõi: Đua Top Mùa Giải (Season Race), Elo Cá Nhân & Sự Nghiệp, Cặp Đôi Ăn Ý.
   - Các tab Lịch sử trận, Ma trận đối đầu và Kèo được chuyển sang trang chuyên biệt `/tran-dau`.
   - Dòng xếp hạng thành thẻ 2 tầng trên mobile.

5. **Công nợ (`/cong-no`):**
   - Luôn sử dụng dạng thẻ (`viewMode = 'grid'`), ẩn nút toggle bảng desktop.
---

## 10. Trận Đấu & Kèo Thách Đấu (`/tran-dau`) (Handoff Challenge & Match History)

Hệ thống cung cấp trang chuyên biệt `/tran-dau` đóng vai trò là Sàn Đấu và Hub Thực Chiến trung tâm của CLB:

1. **Tab 1: Sàn Kèo / Thách đấu (Challenge Arena):**
   - Vòng đời kèo: `pending` (chờ nhận) $\to$ `accepted` (đã nhận) $\to$ `oncourt` (đang trên sân) $\to$ `played` (đã đấu và ghi nhận Match). Các trạng thái kết thúc khác: `declined`, `expired`, `cancelled`.
   - Phân loại subtab: Kèo của tôi, Kèo mở toàn CLB, Kèo đang chờ, Kèo đã đấu, Tất cả.
   - Thẻ kèo hiển thị đầy đủ tỷ lệ thắng dự kiến win%, độ lệch Elo, countdown thời hạn, nút Nhận / Từ chối / Hủy kèo và nút "+ Tạo kèo". Tự động đổi badge "Hết hạn" và vô hiệu hóa nhận kèo khi quá `expiresAt`.
   - Kèo tự do tạo từ Bảng xếp hạng hoặc Săn thưởng (`sessionId: null`): Khi CLB đang có buổi tập mở, hiển thị nút **"Đưa vào buổi này"** (`linkChallengeToSession`) để gắn vào buổi chơi, sau đó đưa lên sân thi đấu ghi kết quả.
   - Kèo đã gắn buổi: Có nút **"Vào buổi chơi để đưa lên sân"** chuyển hướng nhanh sang Tab Chia sân.

2. **Tab 2: Lịch sử trận & Video (Match History & Replay):**
   - Bộ lọc chuyên sâu theo 2 người chơi (Đối đầu / Cùng đội), có/không có video, chất lượng trận (Sát điểm / Upset / Đảo chiều Elo), nguồn chia sân / kèo tự do.
   - Thẻ tóm tắt H2H hiển thị tỷ số đối đầu trực tiếp giữa 2 người chơi.
   - Danh sách trận đấu phân nhóm theo ngày:
     - **Gắn video replay**: Modal `AttachVideoModal` cho phép gắn link video (YouTube, Facebook, Google Drive, trực tiếp), tự động nhận diện nhà cung cấp và thumbnail.
     - **Xem video & Timeline**: Modal `MatchVideoPlayerModal` phát video, hiển thị danh sách mốc thời gian nổi bật (`video_timeline` các set đấu, pha cầu hay) kèm trình chỉnh sửa `VideoTimelineEditor`.
     - **Bộ đếm lượt xem**: Tự động tăng số lượt xem video an toàn qua RPC `increment_match_video_views`.
     - **Lưu vết thưởng phá chuỗi**: Hiển thị nhãn `bounty_broken` cho những trận lật đổ Vua Lì Đòn.
     - Sửa tỷ số trực tiếp inline (ghi sổ kiểm toán `match_edits`).

3. **Tab 3: Ma trận Đối đầu Toàn CLB (H2H Matrix):**
   - Bảng ma trận đối đầu NxN trực quan, hỗ trợ xem Top 5, Top 8, Top 12 hoặc Toàn CLB.
   - Cột tên dán cố định (sticky) trên màn hình mobile.
   - Bấm vào ô đã có kết quả để xem ngay lịch sử đối đầu giữa 2 người; bấm vào ô chưa từng gặp nhau để mở ngay popup gạ kèo.
   - Thống kê các cặp Chưa từng gặp nhau (ưu tiên theo số buổi tham gia chung) và Top các cặp lệch nhất trong CLB.

---

## 11. Hệ thống Thông Báo Cá Nhân (Notifications) & Bảng Tin Hoạt Động CLB (Social Activity)

Nhằm tạo động lực thi đấu và tăng cường tương tác trong CLB, hệ thống cung cấp trung tâm thông báo cá nhân kết hợp bảng tin dòng thời gian sự kiện:

### 1. Chuông Thông Báo & Ngăn Kéo (Notification Bell & Panel):
- **Biểu tượng Chuông (`NotificationBell.jsx`)**: Tích hợp trên cả Desktop AppHeader và Mobile Unified Header, hiển thị chấm badge số lượng thông báo chưa đọc của riêng cá nhân đang đăng nhập (lọc `member_id = myId`). Bốn màn có header riêng (`session` · `fund` · `leaderboard` · `matches`) ẩn `AppHeader` nên tự render chuông trong header của chính nó.
- **Nạp lại (`reloadNotifications`)**: `storage.load()` chỉ chạy một lần lúc vào CLB, nên chuông tự select lại 100 dòng mới nhất khi mount, khi quay lại tab (`visibilitychange`/`focus`) và khi mở ngăn kéo. **Cố ý không dùng Supabase Realtime**: gói Free chạy RLS cho từng client đang kết nối trên mỗi dòng insert — lúc lưu trận liên tục trong buổi tập thì đó là CPU database, hết trước cả băng thông. Kết quả nhập lại được **hợp nhất theo `id`**, không thay cả mảng: `dbmap` đồng bộ bảng `notifications` theo mode `'id'`, dòng nào có trong ảnh chụp cũ mà vắng ở mảng mới là nó **xoá dưới DB**.
- **Ngăn kéo 2 Tab (`NotificationPanel.jsx`)**:
  - **Tab 1: Thông báo (`tabNotifications`)**:
    - Danh sách thông báo cá nhân quan trọng. Người nhận đi qua `notifyRecipients()`: bỏ trùng, bỏ chính người tạo sự kiện (`actor_id`), và **chỉ giữ thành viên CLB** — `notifications.member_id` có khoá ngoại tới `club_members` mà `match.playerKeys` trộn cả ID khách giao lưu, lọt một ID khách là cả lô insert bị từ chối.

    > **Kết quả trận (`match_recorded`) CỐ Ý không bắn thông báo** — bốn người trong trận vừa đánh xong và đang đứng cạnh sân. `storage.load()` chỉ lấy 100 dòng mới nhất, một buổi 15 trận là đủ đẩy `claim_approved` và `session_rsvp_invite` ra khỏi cửa sổ đó. Trận vẫn vào bảng tin hoạt động.
      1. `challenge_created`: Có người thách đấu kèo bạn.
      2. `challenge_accepted`: Đối thủ đã đồng ý nhận kèo của bạn.
      3. `challenge_declined`: Đối thủ đã từ chối kèo của bạn.
      4. `challenge_completed`: Kèo bạn tham gia đã ngã ngũ kết quả.
      6. `match_edited`: Điểm số trận đấu bạn tham gia vừa được ban quản trị chỉnh sửa.
      7. `bounty_broken`: Chuỗi thắng của đối thủ kình địch vừa bị chặn đứng.
      8. `claim_approved`: Yêu cầu xác nhận đóng tiền/hoàn tiền của bạn đã được duyệt.
      9. `claim_rejected`: Yêu cầu đóng tiền/hoàn tiền của bạn bị từ chối.
      10. `join_approved`: Đơn xin gia nhập CLB của bạn đã được phê duyệt.
      11. `join_rejected`: Đơn xin gia nhập CLB của bạn chưa được phê duyệt.
      12. `session_rsvp_invite`: Lời mời điểm danh khi buổi tập mở (gửi cho hội viên nhóm cố định). Kèm **2 nút bấm tương tác 1 chạm: [✅ Đi] và [❌ Báo vắng]** ngay trên panel.
      12. `challenge_cancelled`: Kèo bạn tham gia bị huỷ (gửi cho mọi đấu thủ hai bên).
      13. `session_cancelled`: Buổi tập bị huỷ (gửi cho nhóm cố định và mọi người đã điểm danh).
      14. `attendance_reported`: Thông báo gửi riêng tới Chủ CLB & Thủ quỹ khi thành viên tự báo điểm danh (nêu rõ ai, báo có mặt / báo vắng / đi thêm tại buổi nào).
    - **Điều hướng hành động tức thì (Actionable Click)**: Nhấp vào thông báo tự động đánh dấu đã đọc (`markNotificationRead`), đóng ngăn kéo và điều hướng ngay tới trang nghiệp vụ đích (`challenges`, `session`, `matches`, hoặc `fund`).
    - Mở chuông **không** tự đánh dấu đã đọc cả loạt: làm vậy thì panel mở ra khi mọi dòng đã là "đã đọc", mất sạch chấm xanh, chữ đậm và cả nút "Đã đọc tất cả".
    - Nút **"Đã đọc tất cả"** (`markAllNotificationsRead`): Cập nhật `read_at` cho toàn bộ thông báo chưa đọc của cá nhân trong 1 lần bấm.
  - **Tab 2: Dành cho bạn (`tabHighlights` — Personal Highlights)**:
    - Tính toán 100% on-demand phía client (`getPersonalHighlights`), **không ghi DB (0 byte bộ nhớ)**.
    - 5 thẻ điểm nhấn phong độ và gắn kết cá nhân:
      1. 🏆 **Cặp bài trùng ăn ý nhất (Best Partner)**: Bạn cặp đánh chung $\ge 5$ trận có tỷ lệ thắng cao nhất.
      2. 🛡️ **Cạ cứng mới tin cậy (Reliable Partner)**: Bạn cặp cùng nhau thi đấu $\ge 3$ trận gần nhất bất bại 100% (tự động loại trừ người trùng với Best Partner).
      3. ⚔️ **Kỳ phùng địch thủ (Arch-Rival)**: Đối thủ chạm trán nhiều nhất ($\ge 4$ trận) với tỷ số đối đầu giằng co (chênh lệch $\le 2$ trận).
      4. ⚡ **Rửa hận phá dớp kỵ giơ (Nemesis Beaten)**: Đối thủ từng thắng bạn liên tiếp $\ge 2$ trận, và bạn vừa xuất sắc đánh bại họ ở trận gần nhất (trong vòng 5 trận gần nhất).
      5. 🔥 **Chuỗi thắng đỉnh cao (Hot Streak)**: Thành viên đang sở hữu chuỗi toàn thắng liên tiếp $\ge 3$ trận.

### 2. Bảng Tin Hoạt Động Toàn CLB (`ActivityTab.jsx`):
- Nằm ở Tab "Hoạt động" tại Trang chủ, hiển thị dòng thời gian các sự kiện sôi động trong CLB.
- **Lazy-load phân trang trực tiếp từ Supabase (`public.activity_events`)**: 20 sự kiện/trang, không nạp vào state đồng bộ `db` để tránh phình to bộ nhớ client.
- **4 Sắc thái trận đấu (Match Narratives)** tự động nhận diện từ tỷ số:
  - ⚡ **Nghẹt thở (Clutch)**: Set quyết định chạm mốc $\ge 20$ và cách biệt $\le 2$ điểm (22-20, 24-22, 29-30...).
  - 🔥 **Áp đảo huỷ diệt (Blowout)**: Cách biệt $\ge 10$ điểm hoặc đối thủ dưới 12 điểm trong set 21 (21-8, 21-11...).
  - 🔄 **Lội ngược dòng (Comeback)**: Thể thức bo3, thua set 1 nhưng thắng ngược 2 set sau.
  - 🏸 **Tiêu chuẩn (Normal)**: Trận thắng thông thường.
- Các sự kiện CLB khác: Phá chuỗi thắng đối thủ (Bounty Broken — `bounty_broken`), Thách đấu mới (`challenge_created`), Nhận kèo (`challenge_accepted`), Từ chối kèo (`challenge_declined`), Huỷ kèo (`challenge_cancelled`), Kèo hoàn tất (`challenge_completed`), Sửa điểm trận đấu (`match_edited`), Buổi tập mở điểm danh (`session_opened`), Chốt sổ buổi tập (`session_closed`), Huỷ buổi tập (`session_cancelled`), Thành viên mới gia nhập CLB (`member_joined`).
- **Chống trùng dòng**: trận thuộc kèo **không** sinh dòng `match_recorded` riêng — kèo BO3 lưu mỗi set thành một match (`-H1`/`-H2`/`-H3`), không chặn thì một kèo đẻ ra 3 dòng trận + 1 dòng kèo. `session_opened`/`session_closed`/`session_cancelled` chỉ bắn khi trạng thái **thực sự đổi**, và lời mời điểm danh chỉ gửi cho người **chưa trả lời** (chốt sổ rồi mở lại để sửa không nã lại cả nhóm).
- **Tuân thủ Luật §3.3**: Toàn bộ payload chỉ lưu ID và số nguyên, tên người chơi và tỷ số được giải mã động (`resolveActivityPayload`) khi hiển thị, hỗ trợ đổi tên và đa ngôn ngữ hoàn hảo.

---

## 12. Hệ thống Dự Đoán Kèo & Sòng Bạc Điểm Mùa (Match Predictions & Casino Hub — `challenge_predictions`)

Cung cấp tính năng dự đoán kết quả các trận thách đấu hấp dẫn trong CLB, tạo thêm nhiệt huyết cho các trận cầu:

- **Cược bằng Điểm Mùa (Season Points — SP)**:
  - Thành viên sử dụng số dư Điểm Mùa kiếm được từ cày rank để dự đoán đội thắng (Đội A hoặc Đội B).
  - Điểm mùa khả dụng (`availableSeasonPoints`): Tự động tính toán `availableSp = totalSeasonPoints - pendingStakes` (trừ đi các khoản cược đang chờ quyết toán).
- **Luật bảo vệ & RLS Chống Gian Lận Nghiêm Ngặt**:
  - **Đấu thủ trong trận tuyệt đối không được cược chính trận của mình** (`predictionPlayerConflict`).
  - **Khách vãng lai (`guest`) không có điểm mùa** nên bị chặn cược (`predictionGuestHint`).
  - **Trần cược UI tối đa 50 SP** (Database kẹp 1..100 SP).
  - **Khóa cược tự động (`isPredLocked`)**: Kèo tự động khoá khi trận đã lên sân (`oncourt`), đã kết thúc (`played`), bị huỷ (`cancelled`) hoặc quá hạn (`isExpired`).
  - **Cơ chế RPC-only**: Dữ liệu lưu tại `challenge_predictions`. Bảng này **CỐ Ý KHÔNG ĐƯA VÀO `dbmap.TABLES`** để tránh lỗi quyền hạn Postgres `42501`. Mọi thao tác đặt cược (`place_challenge_prediction`), huỷ cược (`cancel_challenge_prediction`) và quyết toán (`settle_challenge_predictions`) đều bắt buộc gọi qua RPC.
- **Vòng đời phiếu cược**:
  - `pending`: Đang chờ trận đấu diễn ra. Có thể huỷ cược nhận lại 100% SP trước giờ bóng lăn (`cancelPrediction`).
  - `won`: Đoán đúng đội thắng. Nhận thưởng tỷ lệ 1:1 (+net SP).
  - `lost`: Đoán sai đội thắng. Trừ số SP đã đặt cược (-stake SP).
  - `refunded`: Kèo bị huỷ hoặc trận đấu không diễn ra. Hoàn trả nguyên vẹn số điểm cược.
- **Giao kèo đời thật (`stake_text`)**:
  - Cho phép ghi nhớ thỏa thuận giao lưu ngoài đời giữa các đấu thủ (ví dụ: "1 chai nước ngọt", "bữa sáng bún bò").
  - Thuần túy mang tính giải trí, hiển thị trên thẻ kèo, không trừ điểm hay sinh dòng tiền sổ quỹ.

---

## 13. Hệ thống Quản Lý Đa Mùa Giải & Lưu Trữ Bục Vinh Quang (Seasons Engine — `clubs.seasons`)

- **Đa mùa giải linh hoạt (`clubs.seasons jsonb`)**:
  - Cho phép CLB tổ chức nhiều mùa giải kế tiếp nhau (Mùa 1, Mùa 2, Mùa hè, Mùa thu...).
  - Mỗi mùa giải xác định: Tên mùa, ngày bắt đầu, ngày kết thúc, trạng thái (`active` / `closed`), số trận tiêu chuẩn để xếp hạng chính thức (`minMatchesOfficial`).
- **Lưu trữ Bục Vinh Quang (Podium Snapshots)**:
  - Khi chủ CLB đóng mùa giải, hệ thống tự động chụp lại danh sách bục vinh quang (`podiumSnapshot`): Top 1 (Vàng), Top 2 (Bạc), Top 3 (Đồng) cùng toàn bộ bảng xếp hạng chung cuộc đóng băng của mùa đó.
  - Cho phép thành viên tra cứu lại lịch sử vinh danh các mùa giải cũ bất cứ lúc nào trên giao diện Bảng xếp hạng.
- **Cơ chế Reset Chuyển Mùa An Toàn**:
  - Khi bắt đầu mùa mới: Điểm Mùa (Season Points) của toàn bộ thành viên reset về 0, chuỗi thắng/thua mùa giải reset.
  - **Bảo toàn 100% Lịch sử & Elo Sự nghiệp (Career Elo)**: Điểm Elo và toàn bộ lịch sử trận đấu của thành viên không bao giờ bị mất hoặc reset khi sang mùa mới.

---

## 14. Tổng quan CLB (`/tong-quan` — render `src/pages/Home.jsx`)

Trang `/tong-quan` (Route key `overview`, component `src/pages/Home.jsx`) là **Bàn cờ quản trị vận hành CLB**, bao gồm Banner nhắc nợ cá nhân và 2 tab nghiệp vụ:

- **Banner nhắc nợ cá nhân (`MyDebtPanel`)**: Nằm ngay đầu trang, tự động phát hiện số tiền cá nhân đang nợ CLB (quỹ tháng, tiền đi thêm, tiền khách rủ chưa thanh toán) kèm số tài khoản/QR của thủ quỹ để chuyển khoản nhanh.
- **Tab 1: Tổng quan (`overview`)**:
  - **Lưới 6 StatCard chỉ số cốt lõi**: Số dư quỹ tiền mặt, Công nợ khách & đi thêm, Tiến độ thu quỹ tháng (%), Tổng thu tháng, Tổng chi tháng, Số buổi đã chốt.
  - **Thẻ "Buổi tới" (Upcoming Session)**: Nổi bật ca tập sắp diễn ra gần nhất; cho phép bấm mở điểm danh trước giờ chơi hoặc nhảy nhanh vào chi tiết buổi tập.
  - **Thẻ "Tiến độ đóng quỹ tháng"**: Thanh tiến độ trực quan kèm danh sách chip từng hội viên **chưa** đóng; thủ quỹ có thể bấm trực tiếp vào chip để đánh dấu đã đóng nhanh.
  - **Bảng "Đi nhiều nhất"**: Top 7 hội viên siêng năng nhất trong tháng.
  - **Bảng "Khách nợ nhiều nhất"**: Danh sách 5 khách giao lưu còn nợ tiền sân chưa thanh toán.
  - **Bảng "Buổi gần nhất"**: Danh sách các buổi tập đã qua kèm ngày, ca, số sân và trạng thái chốt sổ.
  - **Khối "Thiết lập ban đầu" (`Setup`)**: Hiện danh sách 5 bước checklist cần làm khi CLB mới khởi tạo và tự biến mất khi đã hoàn tất.
- **Tab 2: Báo cáo (`report`)**:
  - Biểu đồ cột đôi Thu - Chi so sánh 4 tháng gần nhất.
  - Bảng tổng hợp Tỷ lệ đi tập chuyên cần của hội viên cố định theo từng nhóm sinh hoạt.

---

## 15. Kho Danh Hiệu & Huy Hiệu Thành Tích (`/danh-hieu` & `src/lib/badges.js`)

Trang `/danh-hieu` (Route key `badges`, component `src/pages/Badges.jsx`) cung cấp hệ thống huy hiệu và danh hiệu thành tích thể thao:

- **2 Tab chính**:
  1. **Bộ sưu tập (`collection`)**:
     - Danh sách huy hiệu chia theo các hệ: *Chiến Binh, Bất Bại, Cặp Đôi, Thâm Niên, Kình Địch, Nghệ Sĩ Sân Cầu*.
     - Mỗi huy hiệu có các cấp bậc độ hiếm (Đồng, Bạc, Vàng, Kim Cương, Thần Thoại), điều kiện mở khóa tự động dựa trên phân tích số liệu thực chiến (`lib/badges.js: calculateMemberBadges`).
     - **Kệ 3 Huy Hiệu Danh Dự (`BadgeShelf`)**: Cho phép thành viên tự chọn 3 huy hiệu ưng ý nhất ghim lên kệ vinh danh hiển thị ở đầu hồ sơ cá nhân và Hero Card.
     - **Châm ngôn cá nhân (`signature`)**: Lời tuyên ngôn / slogan ngắn hiển thị trên thẻ cá nhân.
     - **Banner truy nã (`BountyHeroPoster`)**: đầu màn Bộ sưu tập (desktop lẫn mobile) treo thưởng người đang có chuỗi thắng dài nhất CLB (ngưỡng ở `badges.json → bounty`); ai đánh bại nhận XP + Điểm mùa, lưu vết `bounty_broken`. Trang Truy nã riêng đã bỏ 2026-10-03 vì trùng với banner này.
  2. **BXH Người Sưu Tập (`leaderboard`)**:
     - Xếp hạng các thành viên theo tổng số huy hiệu và điểm thành tích sưu tập đạt được.
     - Danh sách các huy hiệu hiếm nhất (Rarest Badges) toàn CLB và những ai đang sở hữu chúng.

---

## 16. Web Push Notifications PWA & Thông Báo Đẩy Nền (`push_subscriptions`)

- **Đăng ký Web Push (`src/lib/pushSubscription.js`)**:
  - Hỗ trợ người dùng nhận thông báo đẩy trên điện thoại (PWA / Chrome Mobile / Safari iOS 16.4+) và máy tính ngay cả khi không mở ứng dụng.
  - Trình duyệt tạo Push Subscription chứa `endpoint` và khoá `keys` (`p256dh`, `auth`) lưu vào bảng `public.push_subscriptions` (migration 0048).
- **Gửi thông báo nền qua Supabase Edge Function**:
  - Edge function `push-send` nhận payload và gửi thông báo đẩy chuẩn Web Push Protocol (VAPID).
  - Tự động kích hoạt khi có các sự kiện cá nhân quan trọng: Được thách đấu kèo mới, Đối thủ nhận kèo, Lời mời điểm danh mở buổi (`session_rsvp_invite`), Kết quả cược kèo.

---

## 17. Phân Hệ Giải Đấu Toàn Diện (Tournament System — 16 bảng `tournament_*` & 4 routes)

- **Nguyên tắc cốt lõi: Cách ly tuyệt đối với vận hành thường**:
  - Trận đấu giải lưu ở `tournament_matches`, **không** ghi vào `matches` thường, **không** tính Elo và **không** tính Điểm Mùa.
  - Phí tham gia và giải thưởng lưu ở `tournaments`, `tournament_prizes`, `tournament_budget_lines` chỉ để dự trù và hiển thị trong giải, **không** ghi vào sổ quỹ `transactions`.
- **4 Màn hình giải đấu**:
  1. `/giai-dau` (`Tournaments.jsx`): Danh sách giải đấu CLB (Đang diễn ra, Sắp tới, Đã xong), nút Tạo giải đấu mới.
  2. `/giai-dau/:id` (`TournamentHub.jsx`): Trung tâm điều hành giải đấu với 4 tab (`HUB_TABS`):
     - `overview`: Hero giải, dải sân live, danh sách nội dung thi đấu, checklist "Trước khi bắt đầu", tiến độ các nội dung.
     - `info`: Thông tin chi tiết giải, cơ cấu giải thưởng (`tournament_prizes`), dự trù ngân sách thu chi (`tournament_budget_lines`).
     - `players`: Quản lý danh sách VĐV đăng ký (hội viên CLB hoặc khách ngoài `tournament_guests`), phân bổ vào các nội dung, trạng thái đóng lệ phí.
     - `pairing`: Ghép cặp thi đấu (Tự động theo Elo/ngẫu nhiên, xếp hạt giống Seeds, hoặc Bốc thăm quay số trực quan), kiểm tra hợp lệ đội hình.
  3. `/giai-dau/:id/nhanh/:eventId` (`TournamentBracket.jsx`):
     - Hiển thị cây nhánh thi đấu trực quan theo từng giai đoạn của nội dung (vòng bảng, vòng knock-out, nhánh thắng/thua, Thụy Sĩ).
     - Hàng đợi trận theo sân đấu, điều phối trận lên sân.
     - Nhập điểm set linh hoạt (1x21 cách 2 trần 30, 3x15, 1x30...), hỗ trợ Walkover / Bỏ cuộc Retired, Hoàn tác kết quả và Sửa điểm.
  4. `/giai-dau/:id/so-do` (`TournamentFlow.jsx`):
     - Sơ đồ Canvas đồ thị trực quan hóa toàn bộ luồng giải đấu.
     - Kết nối liên kết giữa các giai đoạn (Stage Links - ví dụ Nhất nhì Bảng A, B, C vào Bán kết Nhánh Vàng; Ba tư vào Nhánh Bạc Plate).
- **4 Thể thức thi đấu tiêu chuẩn**:
  1. *Loại trực tiếp (Knockout)*: Hỗ trợ nhánh chính và nhánh phụ (Tranh hạng 3, Nhánh Plate).
  2. *Vòng tròn chia bảng (Round Robin)*: Thuật toán xoay vòng Berger, tự động xếp hạng theo điểm, hiệu số set, hiệu số điểm và đối đầu trực tiếp (H2H).
  3. *Hệ Thụy Sĩ (Swiss System)*: Ghép cặp từng vòng dựa trên điểm số hiện tại, tránh gặp lại đối thủ cũ, hỗ trợ điểm miễn đấu (bye).
  4. *Nhánh thắng / Nhánh thua (Double Elimination)*: Nhánh Winners + Losers, tự động sinh trận Chung kết Tổng 2 (GF2) nếu đội nhánh thua thắng trận Chung kết 1.
- **Kiến trúc Nạp & Ghi riêng biệt**:
  - Dữ liệu giải đấu không nạp vào state `db` của `AppContext` và không qua `diff()`.
  - Nạp độc lập qua `loadTournament` / `loadTournamentMatches`, lưu qua `tournamentWrite` và 6 RPC nguyên tử: `tournament_generate_stage`, `tournament_commit_match`, `tournament_undo_match`, `tournament_edit_match`, `tournament_close_stage`, `tournament_add_swiss_round`.
  - Giữ tươi dữ liệu qua hook `useTourPoll` (chỉ poll khi có lịch thi đấu và tab đang active để tối ưu tài nguyên Supabase).

