# FEATURES.md

**Version:** v0.3.0 · **Updated:** 2026-08-31

Chức năng theo màn hình, kèm **luật nghiệp vụ** dễ làm sai. Bố cục và copy chính xác nằm ở handoff
`02-screens-ui-spec.md` — file này không lặp lại pixel, chỉ nói **app phải xử sự thế nào**.

---

## 0. Ba nguyên tắc chi phối mọi màn hình

1. **Không ai phải nhập thứ app tự suy ra được.** Không đếm cầu vẫn chốt được buổi (lấy định mức).
   Không nhập giá khách (tự tính theo trình độ × giới tính). Không nhập tiền sân (giờ × giá sân).
2. **Mọi con số phải giải thích được nguồn gốc.** Con số nào cũng đi kèm một câu nói nó từ đâu ra:
   *"Định mức Cố định Chủ nhật: 34 quả/buổi cho 2 sân"*.
3. **Nói rõ con số nào là tiền, con số nào là tính toán.** Mỗi màn hình tiền thuộc đúng một
   trong hai tầng (`DATABASE.md` §3): **Tầng A · sổ quỹ** là tiền đã đổi tay; **Tầng B · giá
   thành buổi** chỉ để biết buổi tốn bao nhiêu, **không bao giờ** sinh dòng ở sổ quỹ. Chốt buổi
   chỉ ghi sổ đúng ba thứ — sân bán được, sân thuê thêm, và tiền sân nếu CLB trả theo buổi.
   Chia sân, số trận, bấm giờ **không bao giờ** ảnh hưởng tiền.

---

## 0. Bắt đầu với một CLB rỗng

CLB vừa tạo chỉ có: bạn (vai `owner`), một loại cầu mặc định, và thang trình độ mặc định. Thứ tự
nhập liệu **bắt buộc** theo dây phụ thuộc:

| Bước | Ở đâu | Vì sao phải trước |
| --- | --- | --- |
| 1. Sân | Cài đặt → Sân | Nhóm cố định phải chỉ ra đánh ở sân nào; tiền sân từng buổi tính từ giá giờ |
| 2. Nhóm cố định | Cài đặt → Nhóm cố định | Quỹ tháng, định mức cầu và lịch tập đều tính theo nhóm |
| 3. Thành viên | Thành viên → Thêm thành viên | Không cần họ có tài khoản; ghép sau ở Cài đặt |
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
Kiểm kho cầu  →  Back tiền người nghỉ  →  Chốt danh sách tháng sau (ngày lock_day = 25)
```

Trạng thái buổi: `draft` (Chưa mở) · `open` (Đã mở) · `closed` (Đã chốt) · `cancelled` (Đã hủy).
Buổi `cancelled` **không** tính tiền và **không** tính vào số buổi khi chia đơn giá/buổi.

---

## 2. Trang chủ (`/`)

Hai tab: **Tổng quan** · **Báo cáo**.

Tổng quan: 8 StatCard (số dư quỹ, công nợ khách, tồn kho cầu, tiến độ đóng quỹ, thu tháng,
chi tháng, cầu bình quân/buổi, buổi đã chốt) · "Buổi tới" (mở điểm danh trước giờ chơi) ·
"Tiến độ đóng quỹ tháng" (kèm chip từng người **chưa** đóng, bấm là đánh dấu đã đóng) ·
"Đi nhiều nhất" top 7 · "Khách nợ nhiều nhất" 5 dòng · "Buổi gần nhất" (bảng, click mở buổi).

Báo cáo: thu chi theo tháng (cột đôi) · tỷ lệ đi tập · khách theo trình độ ·
**giá thành từng buổi** (9 cột, có cột "Quỹ bù" = chi phí − thu khách; dương là quỹ phải bù).

## 3. Buổi tập (`/buoi-tap`) và Chi tiết buổi (`/buoi-tap/:id`)

Điểm danh: bấm vào tên để đổi Có mặt / Vắng. Có "Tất cả có mặt" / "Tất cả vắng".
Chỉ hiện **thành viên cố định của nhóm trong tháng đó** (`roster` = `fixed`).

**Hai đường cho người đi lẻ — đừng nhầm:**

| Ai | Thêm ở đâu | Trả bao nhiêu | Vào báo cáo nào |
| --- | --- | --- | --- |
| **Thành viên CLB**, không cố định nhóm đó | khối Điểm danh → *Thêm người đi lẻ* | **đơn giá một buổi** của nhóm | Công nợ → Đối chiếu buổi |
| **Người ngoài CLB** (vãng lai) | khối Khách giao lưu | **bảng giá khách** theo trình độ × giới tính | Khách theo trình độ · số lượt khách |

Nhét thành viên vào danh sách khách là sai cả ba: sai người, thu vượt (giá khách > đơn giá buổi),
và phồng báo cáo khách vì đếm cả người nhà.

**Khách giao lưu:** nhập tên + giới tính + trình độ + người rủ → giá tự tính, **chốt luôn** vào
bản ghi. Trùng tên khách cũ thì tái dùng bản ghi khách, chỉ cập nhật người rủ.
Mỗi khách có công tắc *đã trả* / *ghi nợ*.

**Sân của buổi** — hai luật hay bị nhầm:

| Việc | Hệ quả tiền | Hệ quả cầu |
| --- | --- | --- |
| **Bán sân dư** cho CLB khác | sân đó **không** tính vào chi phí buổi; tiền bán ghi **thu** | định mức cầu **giảm** theo số sân CLB còn chơi |
| **Thuê thêm sân** (`extra`) | ghi **chi riêng** ngoài hoá đơn tháng | không đổi mẫu số định mức |

**Giá thành buổi này** — card tổng hợp bốn ô: chi phí buổi · thu khách · quỹ đang gánh ·
giá thành/người. **Không ô nào là giao dịch** — đây là Tầng B. Tiền sân đã trả theo hoá đơn
tháng, tiền cầu đã trả khi nhập kho; hiện lại ở đây chỉ là phần chia cho riêng buổi này.
Card phải nói thẳng điều đó, vì bốn ô tiền xếp thành hàng dưới chữ "Chốt" trông y hệt một hoá đơn.

```
quỹ đang gánh = chi phí buổi − thu khách        ← KHÔNG trừ tiền bán sân,
                                                  courtNet đã loại sân bán rồi
```

Con số này phải **giống nhau** ở card chi tiết buổi và bảng "Giá thành từng buổi" ở Báo cáo —
cùng gọi `money.js: costRow`, không màn nào tự viết lại công thức.

**Ba cách vào số cầu**, cùng ra một con số:

1. `quota` (mặc định, không ai phải đếm): `max(6, round(quota × sân_còn_chơi / sân_không_thuê_thêm))`,
   cờ `shuttle_est = true` → chờ kiểm kho cuối tháng chỉnh lại.
2. `tubes`: số ống mở × 12 + số quả lẻ.
3. `exact`: nhập tay số quả.

Nút chốt buổi là hành động primary **duy nhất** của trang.

## 4. Chia sân (`/chia-san`)

Chỉ hiện buổi: `date >= hôm nay` **và** `status = 'open'` **và** có ≥1 người Có mặt.

Người trong buổi = thành viên cố định **có mặt** + khách giao lưu của buổi.
Slot id: `c{sân}t{đội}s{chỗ}`, mỗi sân 4 chỗ, sân **đã bán không sinh slot**.

Thao tác: kéo thả · bấm chọn người rồi bấm ô · kéo về danh sách để bỏ khỏi sân.

**Năm chế độ xếp thông minh:**

| Chế độ | Sắp thứ tự | Điền |
| --- | --- | --- |
| Cân trình độ hai bên | trình độ giảm dần | ghép **mạnh nhất với nhẹ nhất** vào cùng một đôi |
| Ưu tiên ai ít trận nhất | số trận ↑, rồi số phút ↑, rồi random | tuần tự |
| Chỉ xếp chỗ trống | như trên | **giữ nguyên** người đang trên sân |
| Ghép cùng trình độ một sân | trình độ giảm dần | cắt từng 4 người liền nhau vào từng sân |
| Random hoàn toàn | Fisher–Yates | tuần tự |

Thứ tự trình độ: `Newbie < TBY < TB- < TB`.
Số trận đọc từ `matchStats` — **chỉ tính trong buổi đó**, không tính lịch sử buổi trước.

**"Cố định người theo sân"** (chỉ khi ≥2 sân): mỗi sân một roster riêng; mọi lệnh xếp chạy **độc
lập trong từng sân**, không ai bị đẩy sang sân khác.
**"Chia đều vào sân"**: sắp theo trình độ giảm dần rồi chia serpentine (vòng 1 xuôi, vòng 2 ngược).

**Bấm giờ và ghi trận:** Bắt đầu/Tạm dừng là toggle. `Xong trận` lấy 4 người đang ở sân,
`minutes = phút bấm giờ || số phút nhập tay (mặc định 20)`, ghi 1 `match`, **xoá 4 người khỏi sân**
để xếp lượt mới, dừng đồng hồ. `Bỏ trận vừa ghi` xoá match cuối, **không** phục hồi lineup.

## 5. Lịch tháng · Lịch cố định · Thành viên

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


- **Lịch tháng**: lưới tháng, chip buổi theo màu trạng thái, bấm mở buổi.
- **Lịch cố định**: tạo một lần → sinh buổi cả kỳ. Không sinh trùng (đã có buổi cùng ngày + nhóm thì bỏ qua).
- **Thành viên**: danh sách + 2 hàng chờ duyệt:
  - *Đăng ký cố định tháng sau* — trạng thái theo tháng: `fixed` / `off` / `pending`.
  - *Thay đổi thông tin* — **đổi trình độ áp dụng từ tháng sau**, **đổi SĐT áp dụng ngay**.
- Thêm người **giữa tháng** với lựa chọn "cố định từ bây giờ" → sinh quỹ tháng theo
  `đơn giá × số buổi còn lại`, ghi chú *"Vào giữa tháng · N buổi còn lại"*.

## 6. Công nợ · Sổ quỹ · Kho cầu

**Công nợ (`/cong-no`)** tổ chức thành các tab tinh gọn và chuyên nghiệp:
1. **Thu / Hoàn theo buổi**:
   - Gộp chung toàn bộ khoản thu khách ngoài, hội viên đi thêm buổi và hoàn tiền cho hội viên cố định vắng mặt (`back_credits`).
   - Gom dữ liệu theo từng người chơi: hiển thị tổng số buổi, số tiền ròng cần thu (`+`) hoặc cần trả (`−`), nút `[Thu tất cả]` / `[Trả tất cả]`.
   - **Mở rộng xem chi tiết từng buổi (Accordion)**: ngày giờ, ca tập, sân đấu cụ thể.
   - **Sửa số tiền trực tiếp (Inline Price Edit)**: cho phép điều chỉnh số tiền của từng buổi linh hoạt trước khi thu/hoàn.
   - **Hai chế độ hiển thị (Toggle)**: Chuyển đổi linh hoạt giữa `[☰ Dạng Bảng]` (kế toán thẳng thớm) và `[⊞ Dạng Lưới Thẻ]` (các ô vuông block hiện đại, xóa khoảng trắng thừa).
   - **Tìm kiếm & Sắp xếp đa năng**: Tìm kiếm tiếng Việt không dấu (theo tên người chơi, người rủ, ca, sân), lọc theo đối tượng (`Hội viên` / `Khách ngoài`), sắp xếp theo tiền nợ, tên A-Z, số buổi.
2. **Quỹ tháng**:
   - Thu quỹ tháng trọn gói của hội viên cố định, lọc theo từng ca/nhóm.
   - Hỗ trợ cả 2 chế độ Bảng và Lưới thẻ, tìm kiếm thành viên/SĐT và sắp xếp theo số tiền còn thiếu/đã đóng.
3. **Quỹ nợ (Thành viên ứng tiền)**:
   - Theo dõi các khoản chi mà thành viên ứng tiền túi thay cho CLB (như mua cầu, trả tiền sân), hỗ trợ bấm hoàn trả khi quỹ hoàn tiền lại cho thành viên.

**Đối chiếu buổi chạy hai chiều**, cùng một đơn giá, chỉ khác dấu:

| | Ai | Dấu | Ghi sổ khi bấm |
| --- | --- | --- | --- |
| Vắng buổi cố định | người trong danh sách cố định của nhóm | **−** quỹ nợ người | chi · Back cố định nghỉ |
| Đi thêm buổi nhóm khác | thành viên CLB, không cố định nhóm đó | **+** người nợ quỹ | thu · Đi thêm buổi |

`đơn giá = quỹ tháng NGƯỜI ĐÓ THỰC ĐÓNG ÷ số buổi của nhóm trong tháng`. Đọc `monthly_dues` chứ
không đọc cấu hình nhóm hiện tại — sửa quỹ nhóm giữa chừng thì người đã đóng giá cũ phải được
đối chiếu theo giá cũ.

Người đi thêm **không phải khách giao lưu**: họ trả theo đơn giá buổi của nhóm chứ không theo bảng
giá khách, và không được đếm vào báo cáo "khách theo trình độ". Đánh dấu ở màn điểm danh, trạng
thái thứ ba là **Đi thêm**. Người đã cố định nhóm đó thì không bao giờ tính là đi thêm — họ đã
đóng quỹ tháng rồi.

**Sổ quỹ (`/so-quy`)** — Minh bạch dòng tiền phong trào CLB:
- **Tab mặc định là Chi tiết thu chi**: Hiển thị rành mạch từng khoản tiền thực tế: Quỹ tháng của ai, Hoá đơn tiền sân trọn tháng, Tiền mua mấy ống cầu, Sân thuê thêm lẻ của buổi nào, Hoàn tiền vắng... Các khoản cùng ngày cùng loại được gom gọn gàng, bấm để bung ra xem chi tiết.
- **Tab Tổng kết quỹ tháng**: Báo cáo tổng kết quỹ phong trào 2 cột cực kỳ trực quan:
  - 4 Thẻ chỉ số: `Tổng tiền thu từ anh em` (+), `Tổng chi phí hoạt động` (-), `Chênh lệch thu - chi tháng` (Báo rõ Thặng dư hay Hụt quỹ), và `Số dư quỹ hiện tại` (kèm giá trị số cầu tồn trong kho).
  - Bảng Cân đối 2 cột: Cột trái (Các khoản thu từ anh em) & Cột phải (Các khoản chi hoạt động).
- **Tiền sân**: CLB thanh toán trọn gói 1 lần cả tháng theo Hoá đơn tiền sân. Khi buổi tập có phát sinh sân thuê thêm ngoài giờ (`extra: true`), hệ thống tự động ghi thêm 1 dòng Chi riêng cho sân đó vào sổ quỹ.

**Kho cầu**: nhập mua (nhập **tổng tiền thực trả**, app tự ra đ/quả) · tiêu thụ theo buổi
(dấu `~` = buổi đang lấy định mức) · **kiểm kho cuối tháng**: đếm thực tế, so tồn hệ thống,
phần lệch **chia đều vào các buổi `closed` còn cờ `shuttle_est`** trong tháng, phần dư dồn vào
buổi cuối để tổng khớp tuyệt đối.

Ba luật của kiểm kho, sai một cái là hỏng số hai tháng:

1. **Tháng chia lệch lấy từ ngày kiểm**, không phải tháng đang chọn ở header. Kiểm ngày 31/08
   trong lúc header đang ở tháng 09 thì phần lệch của tháng 8 chui vào các buổi tháng 9.
2. **Chỉ sửa buổi còn cờ ước lượng.** Buổi đã đếm tay (`exact`) là số thật. Không còn buổi ước
   lượng nào mà kho vẫn lệch thì app **không tự sửa**, mà báo user sửa tay số quả.
3. **Không tạo giao dịch nào**, kể cả khi hụt kho — xem `DATABASE.md` §3.1.

## 7. Trang cá nhân · Cài đặt

**Cá nhân**: một tài khoản dùng cho mọi CLB; danh sách CLB đang tham gia, bấm để chuyển.

**Cài đặt** 6 tab: Chung · Cách chia tiền · Sân · Cầu · Nhóm cố định · **Tài khoản & quyền**.

Tab *Tài khoản & quyền* — **hai cách cho người mới vào**, bật/tắt độc lập:

| Cách | Cờ | Luồng |
| --- | --- | --- |
| Mã CLB | `allow_code_join` | người mới nhập mã → yêu cầu chờ → chủ CLB **Ghép vào** bản ghi cũ / **Tạo thành viên mới** / **Từ chối** |
| Trùng SĐT | `allow_phone_suggest` | so **chỉ chữ số**, gợi ý màu amber + nút Ghép. **Không bao giờ tự ghép** |

**Ghép, không phải tạo mới.** Bấm *Tạo thành viên mới* cho người đã có bản ghi tay là sinh ra
**hai** bản ghi cùng một con người, cả hai cùng chạy song song — và **gộp lại thì app chưa làm
được** (16 cột trỏ tới `club_members`, 4 ràng buộc UNIQUE chặn ngang, và tầng đồng bộ ghi từng
dòng không transaction nên merge bắt buộc phải là RPC). Vì thế màn duyệt **chọn sẵn** bản ghi
trùng SĐT, cảnh báo một dòng, và hạ *Tạo mới* xuống nút phụ. Chưa chọn ai thì nút **Ghép** bị
khoá — RPC nhận `p_member_id = null` là nó tạo người mới, nút sẽ nói một đằng làm một nẻo.

**Mời qua SĐT đã gỡ khỏi client** (`allow_invite`): phần tạo bản ghi chạy được nhưng phần nhận
(mở link → tạo tài khoản → tự ghép) chưa từng tồn tại, nên nút chỉ hứa suông. Bảng
`club_invites` và cột `clubs.allow_invite` giữ nguyên dưới DB, chờ làm thành module riêng có
gửi tin thật.

**Sơ đồ dữ liệu**: trang tài liệu sống trong app, liệt kê bảng/cột. Giữ lại ở bản thật.

---

## 8. Trạng thái rỗng, chặn, tải

- **Rỗng** = một câu **sự thật + việc cần làm**, không phải minh hoạ:
  *"Chưa có buổi nào để xếp"* + *"Vào Buổi tập → chọn buổi sắp tới → bấm Mở điểm danh"*.
- **Chặn hành động** (sai vai, thiếu dữ liệu) → **toast giải thích**, không disable im lặng:
  *"Vai này không được sửa thành viên"*, *"Sân này chưa có ai"*, *"Chọn bản ghi thành viên để ghép"*.
- **Tải** → skeleton hình dạng giống nội dung, không spinner.
