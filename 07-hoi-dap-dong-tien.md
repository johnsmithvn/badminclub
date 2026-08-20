# 07 · Hỏi đáp dòng tiền

Tài liệu này trả lời một câu hỏi duy nhất, hỏi theo nhiều cách: **chỗ nào trong app làm quỹ thay đổi, chỗ nào chỉ tính toán để biết.**

Đọc theo thứ tự: Mục 1 hiểu hệ thống đang chạy thế nào · Mục 2 những chỗ đang lệch cần sửa · Mục 3 sơ đồ và ví dụ chạy thật một tháng.

---

# MỤC 1 · HỎI ĐÁP

## Q1. App có hai dòng tiền không?

**Có, và đúng ra phải có hai.** Nhưng không phải "double" theo nghĩa ghi tiền hai lần — mà là hai tầng làm hai việc khác nhau.

### Tầng A — Sổ quỹ · tiền thật

Bảng `transactions`. Chỉ những dòng ở đây làm số dư thay đổi.

```
Thu:  số dư mang sang · quỹ tháng · khách giao lưu · bán sân dư · thu tay
Chi:  hoá đơn sân · mua cầu · thuê thêm sân · back cố định nghỉ · chi tay

Số dư = Σ thu − Σ chi
```

Đây là "còn lại" — con số phải khớp với tiền trong tài khoản ngân hàng của CLB.

### Tầng B — Giá thành buổi · chỉ để biết

Không lưu vào sổ quỹ, tính lại mỗi lần mở màn hình.

```
chi phí buổi = tiền sân (không tính sân đã bán) + số cầu dùng × giá bình quân
/người       = chi phí buổi ÷ (số có mặt + số khách)
quỹ bù       = chi phí buổi − thu từ khách
```

Đây là cơ sở ra quyết định: buổi này quỹ đang bù bao nhiêu, đầu người bao nhiêu, giá khách thu đã đủ chưa, có nên tăng quỹ tháng không.

### Tại sao phải tách

Đây là phân biệt chuẩn của kế toán: **dòng tiền** (có người thật sự đưa hoặc nhận tiền, có chứng từ) khác **phân bổ chi phí** (chia một khoản đã trả ra cho các buổi để phân tích). Gộp hai tầng lại là đếm cùng một số tiền hai lần.

---

## Q2. Các con số trong "Chi tiết buổi" có vào sổ quỹ không?

**Không.** Tiền sân của buổi, số cầu dùng, `/người`, `quỹ bù` — tất cả là Tầng B. Lưu lại làm lịch sử để tra về sau, không tạo giao dịch nào.

Mục đích của màn hình này là trả lời: *buổi hôm nay tốn bao nhiêu.* Không phải để ghi sổ.

---

## Q3. Bấm "Chốt buổi" có tạo giao dịch không?

**Không, với phần tiền sân và tiền cầu.** Nhưng có 2 khoản thật vẫn phát sinh khi chốt:

| Khoản | Điều kiện | Chiều | Vì sao là tiền thật |
| --- | --- | --- | --- |
| **Bán sân dư** | dòng sân có `is_sold` | thu | CLB khác trả tiền về thật |
| **Thuê thêm sân** | dòng sân có `is_extra` | chi | Sân này ngoài hoá đơn tháng, phải trả riêng |

Và một ngoại lệ theo cấu hình CLB (`clubs.court_pay_mode`):

- `month` — CLB trả chủ sân trọn tháng. Chốt buổi **không** ghi tiền sân. *(CLB1 đang dùng)*
- `session` — CLB trả từng buổi. Chốt buổi **có** ghi chi tiền sân buổi đó. *(CLB2)*

---

## Q4. Add khách vào buổi thì tiền vào đâu?

Hai bước, hai thời điểm khác nhau:

```
Add khách vào buổi
   → ghi session_guests, giá chốt tại thời điểm đó, paid = false
   → hiện ở màn Công nợ
   → CHƯA vào sổ quỹ

Bấm "Đã thu"
   → paid = true
   → ghi 1 dòng thu "Khách giao lưu"
   → quỹ tăng
```

Quỹ tháng thành viên cũng vậy: chốt danh sách sinh `monthly_dues` chờ thu, tick đã đóng mới vào quỹ.

**Nguyên tắc:** thêm người = tạo công nợ. Bấm thu = tạo giao dịch.

---

## Q5. Điểm danh Có mặt / Vắng dùng để làm gì?

Ba việc, không việc nào là ghi sổ:

1. **Back tiền** — số buổi vắng × đơn giá một buổi
2. **Chia đầu người** — số có mặt là mẫu số của `/người` trong giá thành buổi
3. **Định mức cầu** — `quotaFor()` tính số cầu dự kiến theo số sân đánh thật

---

## Q6. Kho cầu có trừ quỹ không?

**Có — nhưng chỉ ở nửa "nhập cầu".** Đây là chỗ dễ hiểu sai nhất.

| Nửa | Bảng | Trừ quỹ? | Ghi gì |
| --- | --- | --- | --- |
| **Nhập cầu** — mua 5 ống, 1.650.000 | `shuttle_purchases` | **CÓ** | Chi "Mua cầu" 1.650.000, ngay lúc nhập |
| **Tiêu thụ** — buổi CN dùng 34 quả | `sessions.shuttle_used` | KHÔNG | Chỉ trừ tồn kho, đếm bằng quả |
| **Tồn kho** — còn 26 quả | tính ra | KHÔNG | Chỉ là số lượng |

**Tiền ra ở chỗ mua. Số lượng quản ở chỗ dùng.**

Tab "Tiêu thụ" và "Tồn kho" chỉ đếm quả cầu — chúng tồn tại để biết bao giờ phải mua đợt tiếp, và để tính giá thành buổi ở Tầng B.

---

## Q7. Vậy tại sao không ghi chi tiền cầu theo từng buổi?

Vì **3.2 triệu đã trừ quỹ lúc mua rồi.** Ghi thêm chi khi dùng cầu từng buổi là đếm hai lần cùng một số tiền.

Tiền sân y hệt: tiền ra khỏi quỹ khi chuyển cho chủ sân đầu tháng, không phải khi đánh.

### Có cách nào đúng kế toán hơn không?

Có — mô hình kho:

```
Mua cầu       →  quỹ giảm, TỒN KHO tăng      (không phải chi, chỉ đổi dạng tài sản)
Dùng cầu buổi →  tồn kho giảm, CHI phát sinh (chi thật, đúng buổi)
```

Đúng chuẩn hơn, nhưng **không nên dùng cho CLB**, vì "còn lại" khi đó không còn khớp số dư ngân hàng. Thủ quỹ CLB không phải kế toán — con số hiển thị phải là con số họ đếm được trong tài khoản.

**Thay vào đó:** hiện thêm một dòng ghi chú ở màn Sổ quỹ.

```
Tồn kho quy tiền = số quả còn × giá bình quân một quả
```

Nói cho user biết quỹ thực chất còn nhiều hơn con số hiển thị, mà không phải đổi cả sổ.

---

## Q8. Bấm back tiền có thành khoản chi không?

**Có.** Tick đã trả trong `back_credits` → ghi 1 dòng chi, hạng mục "Back cố định nghỉ", ngày mặc định là 28 của tháng đó.

Chưa tick thì chỉ là khoản phải trả, hiện ở màn Công nợ, không trừ quỹ.

Giống hệt cơ chế của khách giao lưu và quỹ tháng: **tính ra trước, ghi sổ sau, khi tiền thật sự đổi tay.**

---

## Q9. Sổ quỹ chỉ có hai đầu thu và chi, đúng không?

**Đúng.** Mọi giao dịch rơi vào đúng một trong hai chiều, một dòng một chiều.

```
transactions.direction ∈ { 'in', 'out' }
Số dư = Σ(in) − Σ(out)     luỹ kế từ số dư mang sang, không reset theo tháng
```

### Lưu ý cách gọi

Đây là **sổ đơn hai chiều**, không phải **bút toán kép** (double-entry nợ/có của kế toán doanh nghiệp). Mỗi giao dịch chỉ ghi một dòng, không ghi đối ứng hai tài khoản.

Với CLB thì sổ đơn là đủ, và quan trọng hơn: thủ quỹ đọc được ngay mà không cần học kế toán.

Chỗ duy nhất sổ đơn hụt là khi thành viên ứng tiền cá nhân — xem Issue 4 ở Mục 2. Xử lý bằng một bảng công nợ nội bộ riêng, không cần đổi cả sổ quỹ sang bút toán kép.

---

## Q10. Giá thành buổi hiển thị ở đâu, có lưu lại không?

**Hiển thị ở 2 màn hình. Nhưng không lưu — và đây là một issue thật.**

### Chỗ 1 · Chi tiết buổi → card "Chốt tiền buổi này"

Bốn ô ở khối tổng hợp:

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ CHI PHÍ BUỔI │  THU KHÁCH   │ QUỸ BÙ THÊM  │ GIÁ THÀNH /  │
│              │              │              │   NGƯỜI      │
│  1.455.000   │   130.000    │  1.325.000   │   145.500    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Xem được buổi đang mở và buổi đã chốt.

### Chỗ 2 · Báo cáo → card "Giá thành từng buổi"

Bảng 9 cột, mọi buổi trong tháng đang chọn — đây chính là màn "à ra là có những buổi có giá như này":

```
Buổi │ Nhóm │ Người │ Tiền sân │ Tiền cầu │ Chi phí │ Thu khách │ /người │ Quỹ bù
```

Đổi tháng ở header là xem lại tháng cũ.

### Vấn đề: con số sẽ trôi theo thời gian

Cả hai chỗ **tính lại mỗi lần mở màn hình**, không đọc số đã lưu. Hai đầu vào của phép tính đều thay đổi được:

**Giá bình quân một quả cầu** là bình quân **toàn bộ lịch sử mua** của CLB:

```
giá bình quân = Σ tổng tiền mọi đợt mua ÷ Σ tổng quả mọi đợt mua
```

Mua thêm một đợt giá khác là **mọi buổi trong quá khứ đổi số**:

| | Đợt mua | Giá bình quân | Buổi 03/08 (34 quả) |
| --- | --- | --- | --- |
| Tháng 8 | 5 ống × 330.000 | 27.500/quả | tiền cầu **935.000** |
| Tháng 9 | mua thêm 5 ống × 360.000 | 28.750/quả | tiền cầu **977.500** |

Buổi 03/08 không có gì thay đổi, nhưng con số hiển thị tăng 42.500.

**Giá sân** cũng vậy — `courtNet` nhân với `courts.price_per_hour` **hiện tại**. Chủ sân tăng giá từ 130.000 lên 150.000 thì mọi buổi năm ngoái tự đắt lên theo.

Hệ quả: sang năm mở lại tháng 08/2026, user thấy con số khác con số họ đã đọc hôm nay. Không ai giải thích được vì sao.

### Cách sửa

Đóng băng giá thành tại thời điểm chốt buổi. Chi tiết ở **Mục 2 · Issue 5**.

---

## Q11. Tóm lại chỗ nào sinh giao dịch, chỗ nào không?

### CÓ sinh giao dịch

| Hành động của user | Chiều | Hạng mục |
| --- | --- | --- |
| Tick thành viên đã đóng quỹ tháng | thu | Quỹ tháng |
| Tick khách đã trả tiền | thu | Khách giao lưu |
| Chốt buổi có sân bán được | thu | Bán sân dư |
| Nhập đợt cầu mới ở Kho cầu | chi | Mua cầu |
| Nhập hoá đơn sân trọn tháng | chi | Tiền sân |
| Chốt buổi có sân thuê thêm | chi | Thuê thêm sân |
| Tick đã trả back tiền | chi | Back cố định nghỉ |
| Bấm "Ghi thu / chi" tay | thu/chi | Trích quỹ · Khác |

### KHÔNG sinh giao dịch

- Chốt buổi — phần tiền sân và tiền cầu của buổi
- Điểm danh có mặt / vắng
- Số cầu tiêu thụ, tồn kho
- Chia sân, bấm giờ, đếm số trận
- Mọi bảng giá thành: `chi phí buổi`, `/người`, `quỹ bù`
- Add khách vào buổi (chỉ tạo công nợ)
- Tính ra khoản back (chỉ tạo khoản phải trả)

### Quy tắc một câu

> **Tiền chỉ ghi khi có người thật sự đưa hoặc nhận tiền. Còn lại là tính toán.**

---

## Q12. Chốt cầu · kiểm kho có ghi thành thu chi không?

**Không. Cả ba việc đều không ghi gì.**

```
Nhập số cầu dùng của buổi    → không ghi
Chốt buổi (phần cầu)         → không ghi
Kiểm kho, khớp lệch          → không ghi
```

Lý do: tiền cầu **đã ra khỏi quỹ lúc mua**. Kiểm kho không làm tiền vào hay ra — nó chỉ sửa lại việc **chia** số tiền đã trả đó cho các buổi. Chia lại một cái bánh đã mua thì không tốn thêm tiền.

### Đối chiếu với kế toán doanh nghiệp

Doanh nghiệp thì hụt kho **sẽ** ghi chi, hạng mục "hao hụt hàng tồn". Nhưng đó là vì họ dùng **mô hình kho**: mua hàng không phải chi, mà là đổi tiền thành tài sản; chi phát sinh khi hàng được dùng hoặc mất.

CLB không dùng mô hình đó (xem Q7). Ở mô hình hiện tại, cầu là chi ngay lúc mua — nên **không còn gì để ghi nữa**.

### Kể cả cầu mất

Cầu bị mất, cho CLB khác, hoặc để lâu bị hỏng — vẫn không ghi chi. Tiền đã chi rồi; mất cầu chỉ là tồn kho giảm. Muốn ghi nhận thì ghi chú vào lần kiểm kho đó, không phải vào sổ quỹ.

Ngược lại, nếu **bán cầu** cho CLB khác và có thu tiền thật — cái đó **có** ghi: một dòng thu tay, hạng mục "Khác". Vì lúc đó có người thật sự đưa tiền.

---

# MỤC 2 · ISSUE VÀ ĐỀ XUẤT SỬA

Bảy chỗ trong data model hiện tại đang lệch. Sắp theo mức ưu tiên.

---

## Issue 1 · Back tiền chỉ chạy một chiều — **P0**

### Hiện trạng

`unit` (đơn giá một buổi) chỉ dùng để **trả lại** cho người cố định nghỉ.

```
n    = số buổi của nhóm trong tháng, status ≠ 'cancelled'
unit = làm tròn(quỹ tháng ÷ n) về nghìn
back = unit × số buổi status='closed' mà người đó bị đánh Vắng
```

Ví dụ: nhóm CN, quỹ nam 250.000, tháng có 4 buổi → `unit = 63.000/buổi`.

### Vấn đề

Chiều ngược lại **không có chỗ ghi**.

Anh B cố định nhóm **T6**, đã đóng quỹ nhóm T6. Chủ nhật anh đi thêm một buổi nhóm CN. Anh phải trả 63.000 cho buổi đó — nhưng anh không nằm trong `monthly_dues` nhóm CN, và cũng không phải khách.

Cách duy nhất để thu bây giờ là nhét anh vào `session_guests` với giá khách 75.000. Sai ba chỗ:

- Anh là thành viên CLB, không phải khách giao lưu
- 75.000 ≠ 63.000 → thu vượt 12.000
- Báo cáo "Khách theo trình độ" và "số lượt khách" bị phồng lên vì đếm cả người nhà

### Đề xuất

Gộp `back_credits` thành **một bảng đối chiếu có dấu**. Cùng một `unit`, hai chiều, chỉ khác dấu.

| Ai | Việc | `kind` | `amount` | Ghi sổ |
| --- | --- | --- | --- | --- |
| Anh A (CN) | vắng 1 buổi | `absent_back` | **−63.000** | chi, quỹ trả anh |
| Anh B (T6) | đi thêm 1 buổi CN | `extra_session` | **+63.000** | thu, anh trả quỹ |

```sql
CREATE TYPE adjust_kind  AS ENUM ('absent_back','extra_session');
CREATE TYPE settle_mode  AS ENUM ('cash','offset_next_dues');

CREATE TABLE member_adjustments (
  id          uuid PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES clubs(id),
  month       char(7) NOT NULL,
  group_id    uuid NOT NULL REFERENCES member_groups(id),  -- nhóm sinh ra đơn giá
  member_id   uuid NOT NULL REFERENCES club_members(id),
  kind        adjust_kind NOT NULL,
  sessions    int NOT NULL,          -- số buổi vắng, hoặc số buổi đi thêm
  unit_price  bigint NOT NULL,
  amount      bigint NOT NULL,       -- ÂM = quỹ nợ người · DƯƠNG = người nợ quỹ
  settle      settle_mode NOT NULL DEFAULT 'cash',
  paid        bool NOT NULL DEFAULT false,
  paid_at     date,
  UNIQUE (month, group_id, member_id, kind)
);
```

Kèm hai thay đổi nhỏ:

- `attend_state` thêm giá trị **`extra`** — đánh dấu người đi buổi không thuộc nhóm cố định của mình. Đây là nguồn sinh `extra_session`.
- `settle = 'offset_next_dues'` — anh A được back 63.000 nhưng không nhận tiền mặt, xin trừ vào quỹ tháng sau → tháng sau đóng 187.000. Rất hay gặp, hiện DB không ghi được. Khi chốt danh sách tháng sau, `monthly_dues.amount` trừ đi các adjustment còn treo của người đó.

### Ghi sổ

```
amount < 0, paid=true  →  chi  "Back cố định nghỉ"
amount > 0, paid=true  →  thu  "Đi thêm buổi"       (hạng mục mới)
settle='offset_next_dues'  →  KHÔNG ghi giao dịch, trừ vào dues tháng sau
```

---

## Issue 2 · Sổ quỹ đang "suy ra" thay vì "ghi" — **P0**

### Hiện trạng

Tài liệu (`README`) yêu cầu: *mọi thay đổi tiền phải ghi `transactions`, không tính lại từ nhiều nguồn khi hiển thị.*

Prototype thì làm ngược: `ledger()` quét lại `monthly_dues` + `session_guests` + `court_bills` + `shuttle_purchases` + `back_credits` rồi dựng bảng tại chỗ mỗi lần mở màn hình.

### Hai cách làm

**Cách ghi** — tick "anh A đã đóng" → app viết ngay một dòng vào `transactions`. Sổ quỹ chỉ đọc đúng bảng đó, không quan tâm dữ liệu gốc.

**Cách suy ra** — không viết gì, tính lại mỗi lần hiển thị.

### Vì sao bản thật phải dùng cách ghi

- **Số liệu cũ không được nhảy.** Sửa quỹ nam từ 250.000 lên 280.000 cho tháng tới → cách suy ra sẽ tính lại cả tháng 6, tháng 7 theo giá mới. Sổ quỹ tháng đã chốt tự động sai.
- **Sửa được một dòng sai.** Ghi nhầm ngày thu thì sửa đúng dòng đó. Cách suy ra buộc phải đi sửa dữ liệu gốc, kéo theo mọi báo cáo khác lệch.
- **Biết ai ghi, lúc nào.** `created_by` + `created_at`. Liên quan tiền thì bắt buộc.
- **Nhanh.** Một query một bảng, thay vì join sáu bảng mỗi lần mở màn hình.

### Đề xuất

Mỗi hành động ở bảng Q10 ("CÓ sinh giao dịch") **ghi ngay** một dòng `transactions`, kèm `ref_type` + `ref_id` trỏ về bản ghi gốc. Bỏ tick thì ghi dòng đảo chiều, không xoá cứng.

Prototype giữ nguyên `ledger()` được — nó là bản demo. Nhưng tài liệu phải nói rõ đây là chỗ khác nhau giữa prototype và bản thật.

---

## Issue 3 · `monthly_dues.paid` là boolean — **P1**

### Vấn đề

Anh A phải đóng 250.000, đưa trước 150.000. Hiện chỉ có hai lựa chọn, cả hai đều sai:

| Làm gì | Sổ quỹ ghi | Sai |
| --- | --- | --- |
| Tick | thu 250.000 | thừa 100.000 |
| Không tick | thu 0 | thiếu 150.000 |

### Đề xuất

```sql
ALTER TABLE monthly_dues ADD COLUMN paid_amount bigint NOT NULL DEFAULT 0;
-- bỏ cột paid, trạng thái suy ra:
--   paid_amount = 0          → chưa đóng
--   0 < paid_amount < amount → đóng thiếu, còn nợ (amount − paid_amount)
--   paid_amount ≥ amount     → đủ
```

Mỗi lần thu thêm ghi một dòng `transactions`, không ghi đè.

---

## Issue 4 · Thành viên ứng tiền mua cầu — có cột nhưng không dùng — **P1**

### Vấn đề

Anh C bỏ tiền cá nhân mua 5 ống, 1.650.000. Hiện app ghi ngay chi "Mua cầu 1.650.000" → số dư quỹ giảm 1.650.000.

Nhưng tiền **chưa ra khỏi quỹ**. Quỹ đang nợ anh C 1.650.000. Hai hậu quả:

- Số dư hiển thị **thấp hơn thực tế**
- Không ai nhớ phải trả anh C

Cột `shuttle_purchases.payer_member_id` và `funded_by` đã có trong DB nhưng không có logic nào đọc.

### Đề xuất

```sql
CREATE TYPE fund_source AS ENUM ('fund','member_advance');
ALTER TABLE shuttle_purchases
  ALTER COLUMN funded_by TYPE fund_source USING 'fund';
```

Hai đường đi khác nhau:

```
funded_by = 'fund'
   → ghi chi "Mua cầu" ngay, quỹ giảm

funded_by = 'member_advance'
   → KHÔNG ghi chi
   → tạo khoản phải trả cho payer_member_id
   → khi trả anh C: ghi chi "Trả tiền ứng mua cầu", quỹ giảm
```

Cùng cơ chế áp cho mọi khoản chi có người ứng (thuê thêm sân, chi lẻ).

Cần một bảng công nợ nội bộ:

```sql
CREATE TABLE member_payables (        -- CLB nợ thành viên (tiền ứng)
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id),
  member_id uuid NOT NULL REFERENCES club_members(id),
  date date NOT NULL, amount bigint NOT NULL, reason text NOT NULL,
  ref_type text, ref_id uuid,
  paid bool NOT NULL DEFAULT false, paid_at date
);
```

---

## Issue 5 · Giá thành buổi không được đóng băng — **P1**

### Hiện trạng

Giá thành hiện ở 2 màn hình (Chi tiết buổi · Báo cáo) nhưng không lưu ở đâu. Tính lại mỗi lần mở từ giá sân và giá cầu bình quân **hiện tại**.

### Vấn đề

Số liệu quá khứ trôi. Xem Q10 ở Mục 1 — mua thêm một đợt cầu giá khác là mọi buổi đã chốt đổi con số.

Đây cùng họ với Issue 2: **dữ liệu đã chốt thì phải lưu, không được tính lại.**

### Đề xuất

Chốt buổi → đóng băng giá thành vào chính bản ghi buổi.

```sql
ALTER TABLE sessions
  ADD COLUMN cost_court        bigint,      -- courtNet tại thời điểm chốt
  ADD COLUMN cost_shuttle_unit bigint,      -- giá bình quân một quả tại thời điểm chốt
  ADD COLUMN cost_shuttle      bigint,      -- shuttle_used × cost_shuttle_unit
  ADD COLUMN cost_total        bigint,      -- cost_court + cost_shuttle
  ADD COLUMN cost_guest_rev    bigint,      -- thu khách chốt tại buổi
  ADD COLUMN cost_heads        int,         -- số có mặt + số khách
  ADD COLUMN cost_frozen_at    timestamptz; -- NULL = chưa đóng băng
```

Lưu `cost_shuttle_unit` riêng là có chủ ý — để sau này giải thích được con số: *"buổi này tính theo 27.500 đ/quả, giá bình quân lúc đó"*.

### Cách đọc

```
cost_frozen_at IS NULL   → buổi chưa chốt, tính live (như hiện tại)
cost_frozen_at NOT NULL  → đọc số đã lưu, KHÔNG tính lại
```

Màn Báo cáo đọc thẳng `cost_*`. Không join `shuttle_purchases` nữa — nhanh hơn và ổn định.

### Một lưu ý về kiểm kho

`stock_checks` cuối tháng chia phần lệch vào các buổi còn cờ `shuttle_est=true` — tức là sửa `shuttle_used` của buổi **đã chốt**. Nên việc đóng băng xảy ra hai lần:

```
Chốt buổi        → đóng băng tạm (shuttle_est = true)
Kiểm kho tháng   → tính lại cost_* cho các buổi shuttle_est = true
                    rồi đặt shuttle_est = false → đóng băng cứng
```

Sau kiểm kho thì số của tháng đó không đổi nữa — đúng tinh thần `04-cong-thuc-tien.md` đã viết: *"sau kiểm kho, số liệu tháng đó là số chốt"*. Hiện câu này đúng về số quả, nhưng chưa đúng về số tiền.

### UI nên thêm

Ở card "Giá thành từng buổi" (Báo cáo), thêm một dòng caption dưới bảng:

> Số của buổi đã chốt được đóng băng tại ngày chốt · giá cầu bình quân lúc đó

Và một `Badge` nhỏ trên dòng nào chưa đóng băng (`đang tính tạm`), để user biết con số nào còn đổi được.

---

## Issue 6 · Kiểm kho lấy sai tháng — **P1**

### Kiểm kho làm gì — nền để đọc Issue 6 và 7

Không ai đếm cầu từng buổi. Nên app **đoán** bằng định mức: nhóm CN 34 quả/buổi, nhóm T6 23 quả/buổi. Đoán thì có sai số. Kiểm kho là **đếm một lần cuối tháng thay vì đếm 8 lần**.

Nằm ở **Kho cầu** → card "Kiểm kho cuối tháng" → Button accent "Kiểm kho" → Dialog "Kiểm kho cầu".

```
Tồn kho hệ thống = Σ mọi đợt mua − Σ mọi buổi đã chốt   = 240 − 184 = 56 quả
Đếm thực tế trong tủ                                        =            40 quả
Lệch = 56 − 40                                            =           +16 quả

Tháng có 8 buổi đã chốt còn cờ shuttle_est = true
Chia đều 16 ÷ 8                                            =  +2 quả mỗi buổi
   Buổi CN 34 → 36  ·  Buổi T6 23 → 25

Rồi đặt shuttle_est = false, shuttle_mode = 'exact'  → số chốt, lần sau không sửa nữa
```

Hai điểm đúng cần giữ nguyên:

- **Chỉ sửa buổi còn cờ ước lượng.** Buổi đã đếm tay (`exact`) là số thật, không được sửa. Không có buổi ước lượng nào mà kho vẫn lệch thì app không tự sửa, mà báo: *"Không có buổi ước tính trong tháng — sửa tay số quả ở buổi cần chỉnh"*.
- **Kiểm kho không tạo giao dịch nào.** Tiền cầu đã ra khỏi quỹ lúc mua. Kiểm kho chỉ sửa lại việc **chia** số tiền đã trả đó cho các buổi — Chia lại một cái bánh đã mua thì không tốn thêm tiền. Quỹ không đổi một đồng.

### Hiện trạng

Hai đầu vào của phép tính có phạm vi khác nhau, và đó là đúng:

```
Tồn kho hệ thống  → luỹ kế TOÀN BỘ      (cầu trong tủ không reset đầu tháng)
Chia phần lệch    → chỉ buổi của MỘT THÁNG
```

### Vấn đề

Tháng để chia lệch được lấy từ **tháng đang chọn ở header**, không phải từ **ngày kiểm kho**.

```js
const month = this.state.month;        // ← tháng đang xem
const est   = this.estSessions(month);
```

Kiểm kho ngày 31/08 nhưng header đang ở tháng 09 → phần lệch của tháng 8 bị chia vào các buổi tháng 9. Hai tháng sai cùng lúc, không ai biết.

### Đề xuất

Lấy tháng từ `stock_checks.date`, không từ state màn hình.

```js
const month = monthOf(f.ckDate);       // tháng của ngày kiểm
```

Và hiển thị rõ trước khi xác nhận, trong Dialog:

> Chia vào **8 buổi ước tính của tháng 08/2026** · +2 quả mỗi buổi

Thêm một ràng buộc: mỗi tháng chỉ một lần kiểm kho.

```sql
ALTER TABLE stock_checks ADD CONSTRAINT uq_check_month UNIQUE (club_id, month);
```

### Trong app hiện ra gì (giữ nguyên, chỉ sửa phần tháng)

Dialog **"Kiểm kho cầu"** — *"Đếm số quả còn lại trong tủ…"*:

```
┌─ Ngày kiểm ─────────┬─ Số quả đếm được ───┐
│  31/08/2026          │  40                 │
└────────────────────┴───────────────────┘
Hệ thống đang ghi tồn 56 quả

▸ Dùng nhiều hơn ghi nhận 16 quả — chia vào 8 buổi
  ước tính của tháng 08/2026, +2 quả mỗi buổi
     ↑ dòng xem trước, tính lại ngay khi user gõ
```

Xác nhận thì lưu vào lịch sử kiểm kho, hiện thành danh sách dưới card:

```
31/08/2026   Đếm được 40 quả   Hệ thống 56 quả   +16 quả   chia vào 8 buổi
31/07/2026   Đếm được 29 quả   Hệ thống 29 quả     0 quả   khỡp, không sửa
```

Lệch 0 hiển màu `--status-delivered`, lệch ≠ 0 hiển `--status-delayed`. Đây là sổ theo dõi định mức đặt đúng hay sai — lệch cùng một hướng 3 tháng liền thì phải sửa định mức, không phải sửa từng buổi.

---

## Issue 7 · Bỏ kiểm kho thì số liệu trôi không ai biết — **P1**

### Hiện trạng

Kiểm kho là tùy ý. User có thể không bao giờ kiểm, chỉ để app đoán bằng định mức mãi.

### Cái KHÔNG bị ảnh hưởng

Sổ quỹ · số dư · quỹ tháng · khách giao lưu · công nợ · back tiền · chia sân · số trận. **Toàn bộ dòng tiền chạy bình thường.** Không kiểm kho không làm sai một đồng nào trong quỹ.

### Cái bị ảnh hưởng — 3 chỗ, đều cùng một hướng

| Chỗ | Nếu định mức đặt thấp hơn thực tế |
| --- | --- |
| **Tồn kho** | App báo còn nhiều hơn thực tế. Một hôm mở tủ thấy hết cầu mà app vẫn báo còn 50 quả |
| **Giá thành buổi** | Chi phí báo thấp → quỹ bù báo thấp → tưởng đang hoà trong khi thật ra đang lỗ |
| **"Cầu dùng bình quân/buổi"** | Bằng chính định mức. Thành con số vô nghĩa — tự nói lại cái mình đặt |

Ô giữa là cái đáng lo: đó là con số dùng để quyết định có tăng quỹ tháng hay không.

Lưu ý: sai số này **có hệ thống, không random**. Định mức đặt sát thực tế thì không kiểm kho cũng gần đúng. Nghiêm trọng chỉ khi định mức đặt sai và không ai biết.

### Đề xuất — 3 lối, làm cả 3

**1 · Đảo thời điểm kiểm kho: khi mua đợt mới, không phải cuối tháng.** Đây là lối tốt nhất.

Mua cầu thì đằng nào cũng mở tủ — đếm luôn cái còn lại. Tự nhiên hơn cuối tháng nhiều, và tần suất mua cầu vốn đã ~1 lần/tháng. Biến việc đếm thành một bước của việc user đằng nào cũng làm.

UI: trong Dialog "Nhập đợt cầu", thêm một Input tùy chọn *"Còn lại trong tủ trước khi nhập"* — điền thì sinh luôn một `stock_checks`, bỏ trống thì bỏ qua.

**2 · App tự nhắc.** Banner ở Kho cầu khi:

```
chưa kiểm kho quoá 2 tháng
HOẬC tồn kho hệ thống < 20 quả mà tháng này chưa kiểm
```

**3 · Nói rõ số nào là số đoán.** `Badge` nhỏ **ước lượng** trên mọi con số giá thành của buổi còn `shuttle_est=true` — ở cả card "Chốt tiền buổi này" và bảng "Giá thành từng buổi". User biết con số nào còn đổi được.

Đi kèm Issue 5: `cost_frozen_at` có giá trị nhưng `shuttle_est` vẫn `true` = **đóng băng tạm**. Cả hai cờ cho phép UI nói chính xác con số đang ở trạng thái nào:

| `cost_frozen_at` | `shuttle_est` | Trạng thái con số |
| --- | --- | --- |
| NULL | — | Đang tính live, buổi chưa chốt |
| có | true | Đóng băng tạm — chờ kiểm kho |
| có | false | Số chốt — không đổi nữa |

---

## Tóm tắt Issue

| # | Vấn đề | Mức | Cách sửa |
| --- | --- | --- | --- |
| 1 | Back tiền một chiều, không thu được người đi thêm | P0 | `member_adjustments` có dấu + `attend_state='extra'` |
| 2 | Sổ quỹ suy ra thay vì ghi | P0 | Ghi `transactions` tại mỗi sự kiện tiền |
| 3 | Không ghi được đóng quỹ thiếu | P1 | `paid_amount` thay `paid` |
| 4 | Tiền ứng của thành viên bị ghi chi ngay | P1 | `funded_by` enum + `member_payables` |
| 5 | Giá thành buổi trôi theo giá hiện tại | P1 | Đóng băng `cost_*` vào `sessions` khi chốt |
| 6 | Kiểm kho chia lệch vào tháng đang xem, không phải tháng kiểm | P1 | Lấy tháng từ `stock_checks.date` + unique theo tháng |
| 7 | Bỏ kiểm kho thì tồn kho và giá thành trôi, không ai biết | P1 | Đếm khi mua đợt mới · banner nhắc · badge "ước lượng" |

Issue 2 và 5 cùng một nguyên tắc, nên làm cùng lúc:

> **Dữ liệu đã chốt thì lưu lại. Không bao giờ tính lại quá khứ từ giá hiện tại.**

Issue 5, 6, 7 đều xoay quanh cờ `shuttle_est` — nên làm thành một gói.

Thêm một việc không phải issue, chỉ là nên có:

| | Việc | Mức |
| --- | --- | --- |
| 8 | Hiện "Tồn kho quy tiền" ở màn Sổ quỹ (`số quả còn × giá bình quân`) | P2 |

---

# MỤC 3 · SƠ ĐỒ DÒNG TIỀN

## 3.1 · Toàn cảnh hai tầng

```
                    ┌───────────────────────────────────────┐
                    │        HOẠT ĐỘNG CỦA CLB              │
                    │  lịch tập · điểm danh · khách · cầu   │
                    └──────────────┬────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  TẦNG A · SỔ QUỸ            │         │  TẦNG B · GIÁ THÀNH         │
│  transactions               │         │  tính lại mỗi lần hiển thị  │
│                             │         │                             │
│  Ghi khi tiền ĐỔI TAY       │         │  Ghi khi... không ghi gì    │
│  Append-only, có chứng từ   │         │  Chỉ đọc và tính            │
│                             │         │                             │
│  → Số dư quỹ                │         │  → chi phí buổi             │
│  → Thu/chi từng tháng       │         │  → tiền mỗi đầu người       │
│  → Báo cáo tài chính        │         │  → quỹ phải bù              │
│                             │         │                             │
│  Phải khớp tài khoản NH     │         │  Không bao giờ vào sổ quỹ   │
└─────────────────────────────┘         └─────────────────────────────┘
         MỤC ĐÍCH                                 MỤC ĐÍCH
   Biết CLB còn bao nhiêu tiền         Biết nên thu bao nhiêu là đủ
```

Hai tầng dùng chung dữ liệu gốc nhưng **không bao giờ nói chuyện với nhau**. Tầng B không sinh ra dòng nào ở Tầng A.

---

## 3.2 · Tầng A · Đường tiền vào và ra sổ quỹ

```
THU ─────────────────────────────────────────────────────────────

 Chốt danh sách tháng            Add khách vào buổi
        │                               │
        ▼                               ▼
  monthly_dues                   session_guests
  (chờ thu)                      (chờ thu)
        │                               │
        │  tick "đã đóng"               │  tick "đã thu"
        ▼                               ▼
  ┌───────────────────────────────────────────────────┐
  │  Quỹ tháng          │  Khách giao lưu             │
  └─────────┬───────────────────────┬─────────────────┘
            │                       │
 Chốt buổi có sân bán ──► Bán sân dư│
 Ghi thu tay ─────────────► Trích quỹ · Khác
            │                       │
            └───────────┬───────────┘
                        ▼
              ╔═══════════════════╗
              ║   transactions    ║
              ║   direction='in'  ║
              ╚═════════╤═════════╝
                        │
CHI ────────────────────┼─────────────────────────────────────────

 Nhập hoá đơn sân ──────────► Tiền sân
 Nhập đợt cầu (funded=fund) ► Mua cầu
 Chốt buổi có sân thuê thêm ► Thuê thêm sân
 Tick đã trả back ──────────► Back cố định nghỉ
 Ghi chi tay ───────────────► Trích quỹ · Khác
                        │
                        ▼
              ╔═══════════════════╗
              ║   transactions    ║
              ║  direction='out'  ║
              ╚═════════╤═════════╝
                        │
                        ▼
         Số dư = Σ(in) − Σ(out)
         luỹ kế từ số dư mang sang
```

### Điểm quan trọng

Mọi khoản thu đều đi qua một trạng thái **chờ thu** trước. Không có khoản nào vào quỹ ngay khi phát sinh.

```
phát sinh  →  công nợ  →  [user bấm]  →  giao dịch
```

Lý do: người ta hứa đóng nhưng chưa đóng là chuyện thường ngày của CLB. Quỹ chỉ được phản ánh tiền đã nhận.

---

## 3.3 · Tầng B · Đường tính giá thành

```
  courts.price_per_hour        shuttle_purchases
  session_courts (giờ, sân)    (tổng tiền / tổng quả)
         │                            │
         ▼                            ▼
    rowCost mỗi dòng          giá bình quân một quả
         │                            │
    ┌────┴────┐                       │
    ▼         ▼                       │
courtNet   soldTotal                  │
(sân        (sân đã                   │
 không bán)  bán)                     │
    │                                 │
    │        sessions.shuttle_used ────┤
    │        (quota / tubes / exact)   │
    │                                 ▼
    │                          tiền cầu buổi
    │                                 │
    └────────────┬────────────────────┘
                 ▼
          chi phí buổi
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
attendances   guestRev    chi phí ÷ người
(số có mặt)   (thu khách)      │
    │            │             ▼
    └────┬───────┘        tiền mỗi đầu người
         ▼
      quỹ bù = chi phí − thu khách
      > 0 quỹ phải bù · < 0 dư

              ╔═══════════════════════════╗
              ║  KHÔNG ghi vào sổ quỹ     ║
              ╚══════════════════════════╝
```

### Hiển thị ở đâu

```
Chi tiết buổi → card "Chốt tiền buổi này"  → 4 ô: chi phí · thu khách · quỹ bù · /người
Báo cáo      → card "Giá thành từng buổi"    → bảng 9 cột, mọi buổi trong tháng
```

Hai chỗ này là câu trả lời cho *"sau này vào còn nhìn thấy được buổi nào giá bao nhiêu"*. Nhưng cả hai đang tính live — cần đóng băng khi chốt buổi (**Issue 5**) để số của tháng cũ không trôi.
              ╚═══════════════════════════╝
```

### Mục đích từng con số

| Con số | Trả lời câu hỏi |
| --- | --- |
| `chi phí buổi` | Buổi này tốn bao nhiêu |
| `tiền mỗi đầu người` | Một người chơi tốn bao nhiêu — so với giá khách để biết giá khách đủ chưa |
| `quỹ bù` | Quỹ đang gánh bao nhiêu mỗi buổi — dương liên tục thì phải tăng quỹ tháng |
| `courtNet` vs `courtCost` | Bán sân dư đỡ được bao nhiêu |
| Sân thuê thêm không bán được | Lỗ rõ ràng của CLB, hiện thẳng ở cột `quỹ bù` |

---

## 3.4 · Cơ chế đơn giá một buổi · dùng cho đối chiếu

Đơn giá `unit` **không dùng để thu quỹ tháng** — quỹ tháng thu trọn gói theo nhóm và giới tính. `unit` chỉ dùng để đối chiếu người nghỉ và người đi thêm.

```
   member_groups.fee_male / fee_female     số buổi của nhóm trong tháng
   (250.000 nam · 200.000 nữ)              (status ≠ 'cancelled', tối thiểu 1)
              │                                        │
              └────────────────┬───────────────────────┘
                               ▼
                    unit = làm tròn(fee ÷ n)
                    ví dụ 250.000 ÷ 4 = 63.000/buổi
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
  attendances = 'absent'              attendances = 'extra'
  (cố định mà nghỉ)                   (đi buổi không thuộc nhóm mình)
              │                                 │
              ▼                                 ▼
     amount = −unit × số buổi         amount = +unit × số buổi
     QUỸ NỢ NGƯỜI                     NGƯỜI NỢ QUỸ
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                     member_adjustments
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
      settle = 'cash'              settle = 'offset_next_dues'
              │                                 │
              ▼                                 ▼
    ghi transactions              trừ vào monthly_dues tháng sau
    (chi nếu âm, thu nếu dương)   KHÔNG ghi giao dịch
```

> `attend_state='extra'` và `member_adjustments` là **đề xuất** ở Issue 1, chưa có trong DB hiện tại. Phần `absent` → `back_credits` thì đã chạy.

---

## 3.5 · Ví dụ chạy thật · tháng 08/2026

Giả định: CLB1, `court_pay_mode='month'`. Nhóm CN có 4 buổi, 10 người cố định (6 nam × 250.000 + 4 nữ × 200.000). Sân 130.000/giờ.

### Tầng A · Sổ quỹ tháng 08

| Ngày | Hạng mục | Thu | Chi |
| --- | --- | --- | --- |
| 01/08 | Tiền sân (hoá đơn trọn tháng) | | 1.800.000 |
| 03/08 | Mua cầu (5 ống × 330.000) | | 1.650.000 |
| 05/08 | Quỹ tháng (10 người) | 2.300.000 | |
| 10/08 | Khách giao lưu (8 lượt) | 520.000 | |
| 17/08 | Bán sân dư | 300.000 | |
| 24/08 | Thuê thêm sân | | 200.000 |
| 28/08 | Back cố định nghỉ (1 nam 1 buổi + 1 nữ 2 buổi) | | 163.000 |
| | **Tổng** | **3.120.000** | **3.813.000** |

```
Số dư mang sang        6.000.000
Thu tháng 08          +3.120.000
Chi tháng 08          −3.813.000
─────────────────────────────────
Số dư cuối 08/2026     5.307.000
```

Back tiền: nam `250.000 ÷ 4 = 63.000` × 1 buổi = 63.000 · nữ `200.000 ÷ 4 = 50.000` × 2 buổi = 100.000 → tổng 163.000.

### Tầng B · Giá thành buổi 03/08

```
Sân       2 sân × 2 giờ × 130.000        =   520.000
Cầu       34 quả × 27.500                =   935.000
          (giá bình quân 1.650.000 ÷ 60 quả)
                                            ─────────
Chi phí buổi                              1.455.000

Người     8 có mặt + 2 khách             =        10
Thu khách 2 × 65.000                     =   130.000

/người    1.455.000 ÷ 10                 =   145.500
Quỹ bù    1.455.000 − 130.000            = 1.325.000
```

### Đọc ra điều gì

Con số **1.455.000 không xuất hiện ở bất kỳ đâu trong sổ quỹ.** Nó không phải giao dịch — nó là phần chia của những khoản đã trả (hoá đơn sân 1.8tr, đợt cầu 1.65tr) cho riêng buổi này.

Nhưng nó nói được điều sổ quỹ không nói: **mỗi buổi quỹ đang bù 1.325.000.** Bốn buổi một tháng là 5.3 triệu, trong khi quỹ tháng chỉ thu về 2.3 triệu. Tháng này sống được nhờ số dư mang sang — nếu duy trì thì hết quỹ trong khoảng ba tháng.

Đó chính là lý do Tầng B phải tồn tại. Sổ quỹ cho biết **còn bao nhiêu**. Giá thành cho biết **có bền không**.

---

## 3.6 · Bảng tra nhanh · sự kiện nào ghi gì

| Sự kiện | `transactions`? | Chiều | Hạng mục | Ghi chú |
| --- | --- | --- | --- | --- |
| Chốt danh sách tháng | không | | | Sinh `monthly_dues` chờ thu |
| Tick đã đóng quỹ tháng | **có** | in | Quỹ tháng | Ngày = `paid_at` |
| Mở điểm danh | không | | | |
| Đánh Có mặt / Vắng | không | | | Nuôi back tiền + giá thành |
| Add khách vào buổi | không | | | Sinh công nợ, giá chốt tại buổi |
| Tick khách đã trả | **có** | in | Khách giao lưu | Ngày = ngày buổi |
| Kéo thả chia sân | không | | | |
| Bấm "Xong trận" | không | | | Ghi `matches`, đếm số trận |
| Nhập số cầu dùng | không | | | Chỉ trừ tồn kho |
| **Chốt buổi** — tiền sân, tiền cầu | không | | | Tầng B · đóng băng `cost_*` *(đề xuất)* |
| **Chốt buổi** — có sân bán | **có** | in | Bán sân dư | |
| **Chốt buổi** — có sân thuê thêm | **có** | out | Thuê thêm sân | Chỉ khi `court_pay_mode='month'` |
| **Chốt buổi** — mode `session` | **có** | out | Tiền sân | Cả tiền sân buổi đó |
| Nhập đợt cầu, quỹ trả | **có** | out | Mua cầu | |
| Nhập đợt cầu, thành viên ứng | không | | | → `member_payables` *(đề xuất)* |
| Trả tiền ứng cho thành viên | **có** | out | Trả tiền ứng | *(đề xuất)* |
| Nhập hoá đơn sân tháng | **có** | out | Tiền sân | Ngày = `paid_on` |
| Kiểm kho cuối tháng | không | | | Chỉnh `shuttle_used` + tính lại `cost_*` các buổi ước lượng |
| Tính ra khoản back | không | | | Khoản phải trả |
| Tick đã trả back | **có** | out | Back cố định nghỉ | Ngày mặc định 28 |
| Đi thêm buổi, thu tiền | **có** | in | Đi thêm buổi | *(đề xuất — Issue 1)* |
| Back trừ vào tháng sau | không | | | Trừ `monthly_dues.amount` *(đề xuất)* |
| Ghi thu / chi tay | **có** | in/out | Trích quỹ · Khác | |

---

## 3.7 · Vòng đời một quả cầu · hai đường tách đôi

Đây là sơ đồ giải thích gọn nhất vì sao tiền cầu không được ghi hai lần.

```
                        ĐỢT MUA CẦU
                     10 ống × 330.000
                              │
           ┌────────────────┴────────────────┐
           │                                 │
     ĐƯỜNG TIỀN                       ĐƯỜNG SỐ LƯỢNG
     (Tầng A)                          (kho → Tầng B)
           │                                 │
           ▼                                 ▼
   chi "Mua cầu" 3.300.000          +120 quả vào kho
           │                                 │
           ▼                                 ▼
    QUỸ GIẢM 3.300.000        giá bình quân = Σtiền ÷ Σquả
           │                                 │
           ▼                                 ▼
  ─── HẾT. Tiền cầu          mỗi buổi trừ đi số quả
  không xuất hiện ở đâu        định mức / theo ống / đếm tay
  trong sổ quỹ nữa ───                    │
                                             ▼
                                      tồn kho còn lại
                                             │
                                             ▼
                              KIỂM KHO · đếm thật một lần
                              lệch → chia vào buổi ước lượng
                                             │
                                             ▼
                              số quả chốt × giá bình quân
                                             │
                                             ▼
                                 tiền cầu của buổi
                          ─── chỉ để biết, không vào quỹ ───
```

Hai đường gặp nhau đúng **một điểm**: giá bình quân một quả. Đó là tất cả những gì đường tiền đóng góp cho đường số lượng. Không có chiều ngược — không việc gì ở nhánh phải đẩy được một dòng vào sổ quỹ.

### Vòng đời theo thời gian

```
01/08  Nhập đợt cầu          → chi 3.300.000 · kho +120 quả
03/08  Buổi CN, chốt         → kho −34 (định mức) · shuttle_est = true
07/08  Buổi T6, chốt         → kho −23 (định mức) · shuttle_est = true
  …
31/08  Kiểm kho               → lệch +16 chia vào 8 buổi
                               shuttle_est = false · cost_* đóng băng cứng
                               KHÔNG có giao dịch nào
01/09  Tháng 08 khóa số      → giá thành 8 buổi đó không đổi nữa mãi mãi
```

> Phần `cost_*` đóng băng và khóa số sau kiểm kho là **đề xuất** (Issue 5 + 6 + 7). Hiện tại mọi con số giá thành vẫn tính live và trôi theo giá mới nhất.


---

# MỤC 4 · KIỂM TOÁN LUỒNG · CHỖ NÀO LÀM QUỸ SAI

Rà toàn bộ luồng, chia làm ba nhóm rủi ro:

- **Nhóm N · Nhìn sai** — con số trông như tiền nhưng không phải. Quỹ vẫn đúng, người đọc hiểu sai.
- **Nhóm B · Bỏ sót thao tác** — quỹ **sai thật**, số dư lệch tài khoản ngân hàng.
- **Nhóm T · Khái niệm còn thiếu** — luồng đúng nhưng thiếu một khái niệm nên không mô tả được thực tế.

---

## Nhóm N · Con số trông như tiền nhưng không phải

Đây chính là loại nhầm ở câu hỏi đầu tiên: *tưởng giá trên buổi bị tính thành khoản chi và tạo hoá đơn chi luôn.*

### N1 · Card "Chốt tiền buổi này" trông y như một hoá đơn — **cao nhất**

Mọi tín hiệu thị giác đều nói "đây là chứng từ": tiêu đề có chữ **Chốt**, bốn ô số tiền xếp thành hàng như một bill, có nút xác nhận.

Nhưng bốn ô đó:

| Ô | Có phải giao dịch? |
| --- | --- |
| Chi phí buổi | không — Tầng B |
| Thu khách | chỉ thành tiền khi tick từng khách "đã trả" |
| Quỹ bù thêm | không — Tầng B |
| Giá thành / người | không — Tầng B |

**Bốn ô tiền, không ô nào là giao dịch.** Chữ "Chốt" lại hàm ý đã vào sổ.

**Sửa:** đổi nhãn card thành **"Giá thành buổi này"**, subtitle *"Chỉ để biết buổi tốn bao nhiêu — không ghi vào sổ quỹ"*. Nút chốt tách riêng, nói rõ nó chốt cái gì: *"Chốt buổi · khoá số cầu và điểm danh"*. Thêm một dòng caption dưới bốn ô:

> Không có khoản nào ở đây vào sổ quỹ. Tiền sân đã trả theo hoá đơn tháng, tiền cầu đã trả khi nhập kho.

### N2 · "Quỹ bù thêm" — cái tên nói là quỹ đã trả

Đọc *"Quỹ bù thêm 1.325.000"* thì hiểu ngay là quỹ vừa mất 1.325.000. Người cẩn thận sẽ cộng nó vào chi trong đầu — và đó đúng là **đếm hai lần** khoản hoá đơn sân + đợt cầu đã ghi.

**Sửa:** đổi thành **"Quỹ đang gánh"** hoặc **"Phần quỹ chịu"**, kèm tooltip: *"Phần chi phí buổi mà khách không bù được. Đã nằm trong hoá đơn sân và đợt mua cầu, không ghi thêm."*

### N3 · Tiền cầu hiện trên buổi mà ngày đó không có tiền ra

Buổi 03/08 hiện *tiền cầu 935.000*. Thủ quỹ đối chiếu sổ ngân hàng ngày 03/08 sẽ không tìm thấy khoản nào.

**Sửa:** ghi rõ nguồn ngay cạnh số — *"34 quả × 27.500 đ/quả · giá bình quân kho"*. Có nguồn thì không ai tìm chứng từ nữa.

### N4 · Tiền sân hiện trên buổi khi CLB trả trọn tháng

Cùng bẫy, và tệ hơn: tổng tiền sân của các buổi **không bằng** hoá đơn tháng (buổi huỷ, sân thuê thêm, sân bán). Người đối chiếu sẽ thấy lệch và không biết số nào đúng.

**Sửa:** khi `court_pay_mode='month'`, thêm badge nhỏ **theo hoá đơn tháng** cạnh ô tiền sân của buổi, và một dòng ở màn Sổ quỹ: *"Tiền sân vào sổ 1 dòng mỗi tháng theo hoá đơn thật. Số trên từng buổi chỉ là phần chia để tính giá thành."*

### N5 · Tồn kho là tài sản nhưng không hiện thành tiền

Ngược chiều với N1–N4: user thấy quỹ 5.307.000 và tưởng đó là tất cả, quên 40 quả cầu trị giá ~1.1 triệu trong tủ. **Đọc thấp hơn thực tế.**

**Sửa:** dòng ghi chú ở Sổ quỹ — `Tồn kho quy tiền = số quả còn × giá bình quân` (đã có trong danh sách nên-có).

---

## Nhóm B · Bỏ sót thao tác → quỹ sai thật

Sắp theo **mức tiền sai** theo ví dụ tháng 08/2026.

### B1 · Quên nhập hoá đơn sân tháng — **1.920.000** · nghiêm trọng nhất

Khoản chi lớn nhất tháng, và **không có gì bắt buộc nhập**. Quên là quỹ báo dư gần 2 triệu.

Không ai phát hiện, vì màn Sổ quỹ trông vẫn bình thường — chỉ thiếu một dòng.

**Sửa:** Alert đỏ ở Trang chủ khi tháng có buổi `closed` mà `court_bills` của tháng đó trống:
> Tháng 08/2026 có 8 buổi đã chốt nhưng chưa nhập hoá đơn sân. Số dư quỹ đang cao hơn thực tế.

### B2 · Thành viên ứng tiền, quỹ bị ghi chi ngay — **3.300.000**

Xem **Issue 4**. Tiền chưa ra khỏi quỹ mà quỹ đã giảm, và không ai nhớ phải trả người ứng.

### B3 · Quên tick "đã đóng quỹ tháng" — **250.000 mỗi người, tối đa 2.300.000**

Người ta chuyển khoản rồi, thủ quỹ chưa tick. Hai hậu quả cùng lúc: quỹ báo thiếu, **và** người đó bị hiện trong danh sách "CHƯA ĐÓNG" rồi bị nhắc oan.

Đây là lỗi phổ biến nhất, vì việc tick là một thao tác rời, không gắn với lúc nhận tiền.

**Sửa:** màn đối chiếu số dư (xem cuối mục này).

### B4 · Bán sân nhưng để trống số tiền bán — **300.000, sai hai chiều**

`sold_amount` mặc định 0. Đánh dấu đã bán mà không nhập tiền thì:

- sân đó bị loại khỏi `courtNet` → giá thành buổi báo **rẻ hơn thật**
- không có dòng thu nào bù lại → quỹ **thiếu khoản thu**

**Sửa:** bật `is_sold` thì Input "Bán được" thành bắt buộc, không cho chốt buổi khi còn 0.

### B5 · Buổi bị huỷ nhưng không đánh dấu `cancelled` — **~20.000/người/buổi vắng**

`n` (số buổi trong tháng) đếm buổi `status ≠ 'cancelled'`. Buổi huỷ mà để `draft`/`open` thì `n` cao hơn thực tế → `unit` thấp hơn → **back tiền trả thiếu**.

```
Thật:  4 buổi, 1 huỷ → n = 3 → unit = 250.000 ÷ 3 = 83.000
Sai:   không đánh dấu → n = 4 → unit = 250.000 ÷ 4 = 63.000
                                        thiếu 20.000 mỗi buổi vắng
```

**Sửa:** buổi quá ngày mà vẫn `draft` → nhắc ở Trang chủ, buộc chọn *đã đánh* hoặc *đã huỷ*.

### B6 · Không điểm danh, để trống — **63.000 mỗi buổi vắng** · im lặng nhất

`attend_state` có ba giá trị: `present` · `absent` · `registered`. **Không đánh gì thì không phải `absent`** → người nghỉ không được back tiền. Quỹ giữ tiền không được giữ.

Nguy hiểm vì hoàn toàn im lặng: không cảnh báo, không hiện ở đâu, người bị mất tiền cũng không biết.

**Sửa:** không cho chốt buổi khi còn người chưa điểm danh — Dialog liệt kê tên và buộc chọn. Hoặc quy tắc rõ ràng ghi trong Cài đặt: *"chưa điểm danh khi chốt buổi = vắng"*.

### B7 · Buổi để `open` mãi, không chốt — **nhiều đường cùng lúc**

```
tồn kho    → stock.used chỉ tính buổi 'closed' → báo còn nhiều hơn thực tế
back tiền  → back() chỉ tính buổi 'closed'     → người vắng không được back
tiền sân   → mode 'session': không ghi chi     → quỹ báo dư
báo cáo    → buổi đó không xuất hiện ở đâu
```

**Sửa:** Trang chủ hiện số buổi quá hạn chưa chốt, mở thẳng vào buổi.

### B8 · Sửa giá quỹ tháng giữa tháng → back tiền tính theo giá mới

`monthly_dues` lưu `amount` riêng nên tiền **thu** không bị ảnh hưởng — đúng.

Nhưng `unit` cho back tiền lấy từ `member_groups.fee_male / fee_female` **hiện tại**:

```
unit = round(fee_male ÷ n)      ← đọc cấu hình nhóm, không đọc dues của người đó
```

Sửa quỹ nam từ 250.000 lên 280.000 → người đóng 250.000 lại được back theo 280.000. **Quỹ trả vượt.**

**Sửa:** `unit` phải tính từ `monthly_dues.amount` của chính người đó:

```
unit(member, month) = round(monthly_dues.amount ÷ n)
```

Cùng họ với Issue 2 và 5: **đừng đọc cấu hình hiện tại để tính chuyện đã xảy ra.**

### B9 · Quên tick khách đã trả — **65.000 mỗi khách**

Khách trả tiền mặt tại sân cho quản trò. Quản trò không phải thủ quỹ, không vào mục tiền được (vai `host` bị chặn). Không ai tick.

Tiền đang nằm trong túi quản trò. Quỹ báo thiếu, khách bị ghi nợ oan. Đây là biểu hiện của **T1** ở dưới.

### B10 · Quên trả back tiền — nợ ẩn 163.000

`back_credits.paid = false` mãi. Sổ quỹ không sai, nhưng số dư 5.307.000 đang gánh nghĩa vụ chưa trả. **Số dư khả dụng ≠ số dư sổ.**

**Sửa:** xem **T2**.

### B11 · Số dư mang sang nhập sai lúc onboard — lệch vĩnh viễn

`opening_balance` nhập một lần khi chuyển từ Excel. Sai thì mọi con số sau đó lệch đúng bằng khoảng đó, và **không có gì để đối chiếu ra**.

**Sửa:** màn đối chiếu số dư sẽ lộ ra ngay lần đầu chạy.

---

## Nhóm T · Khái niệm còn thiếu

### T1 · Không có khái niệm "tiền đang ở đâu" — **lỗ cấu trúc**

Sổ quỹ coi quỹ là **một túi duy nhất**. Thực tế tiền nằm ở nhiều nơi:

```
tài khoản ngân hàng CLB
tiền mặt thủ quỹ đang giữ
tiền mặt quản trò thu tại sân, chưa chuyển
tiền thành viên ứng, chưa hoàn
```

Vì thế B9 xảy ra và không có chỗ nào ghi được *"đã thu rồi, nhưng đang ở túi quản trò"*. Hiện chỉ có hai trạng thái: chưa thu, hoặc đã vào quỹ.

**Sửa:** thêm khái niệm **nơi giữ tiền**.

```sql
CREATE TYPE wallet_kind AS ENUM ('bank','cash_treasurer','cash_host');

CREATE TABLE wallets (
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id),
  kind wallet_kind NOT NULL, name text NOT NULL,
  holder_member_id uuid REFERENCES club_members(id), active bool DEFAULT true
);

ALTER TABLE transactions ADD COLUMN wallet_id uuid REFERENCES wallets(id);
```

Quản trò tick "khách đã trả" → thu vào ví *tiền mặt quản trò*. Khi chuyển cho thủ quỹ → một giao dịch **chuyển ví**, không phải thu/chi (không đổi tổng quỹ).

Việc này cũng mở quyền cho vai `host` tick thu khách — hiện họ bị chặn khỏi mọi mục tiền nên buộc phải nhờ người khác, chính là nguyên nhân B9.

### T2 · Không phân biệt số dư sổ và số dư khả dụng

```
Số dư sổ        = Σ thu − Σ chi                        = 5.307.000
Nghĩa vụ chưa trả:
   back chưa trả                                       −  163.000
   tiền thành viên ứng chưa hoàn                       −3.300.000
─────────────────────────────────────────────────────────────────
Số dư khả dụng                                         = 1.844.000
```

Hai con số cách nhau 3.4 triệu. Ra quyết định theo con số trên là sai.

**Sửa:** StatCard **"Số dư khả dụng"** cạnh "Số dư quỹ CLB", caption liệt kê các khoản đang trừ. Cộng thêm N5 thì có bức tranh đủ:

```
Số dư sổ            5.307.000
+ tồn kho quy tiền  1.100.000
− nghĩa vụ chưa trả 3.463.000
────────────────────────────
Vị thế thực         2.944.000
```

---

## Một màn hình bắt gần hết lỗi trên

Mười một lỗi nhóm B đều có cùng một đặc điểm: **im lặng**. Không có gì để so, nên không ai phát hiện.

### Đề xuất · màn "Đối chiếu quỹ" — **P0**

Mỗi cuối tháng, thủ quỹ nhập hai con số họ **đếm được**:

```
Số dư tài khoản ngân hàng     [        ]
Tiền mặt đang giữ             [        ]
```

App so với sổ và nếu lệch thì **liệt kê nghi vấn cụ thể**, không chỉ báo lệch:

```
Sổ quỹ ghi        5.307.000
Bạn đếm được      3.387.000
Lệch             −1.920.000   quỹ thật ÍT hơn sổ

Nghi vấn, sắp theo mức khớp:
  ▸ Chưa nhập hoá đơn sân tháng 08 — tháng có 8 buổi đã chốt.
    Hoá đơn tháng 07 là 1.920.000.                        ← khớp đúng số lệch
  ▸ 2 khoản back tiền chưa đánh đã trả (163.000)
  ▸ 3 người đã tick đóng quỹ nhưng chưa có ngày đóng
```

Bắt được: **B1 · B2 · B3 · B4 · B9 · B10 · B11**. Ghi lại thành một bảng `fund_reconciliations` để lần sau chỉ phải đối chiếu phần phát sinh.

### Đề xuất · checklist trước khi chốt buổi — **P1**

Dialog xác nhận chốt buổi liệt kê những gì còn treo, buộc xử lý:

```
Chốt buổi 03/08 · Cố định Chủ nhật

⚠ 3 người chưa điểm danh — Minh, Thúy, Hải        [ Đánh vắng tất cả ]
⚠ Sân 2 đánh dấu đã bán nhưng chưa nhập số tiền
✓ Số cầu: 34 quả (định mức) — kiểm kho cuối tháng sẽ khớp lại
✓ 2 khách đã thêm · 1 đã trả · 1 ghi nợ

Chốt buổi này không ghi khoản chi nào vào sổ quỹ.
```

Bắt được: **B4 · B6 · B7**, và dòng cuối xử lý luôn **N1**.

---

## Tóm tắt Mục 4

| # | Rủi ro | Loại | Mức tiền sai | Mức ưu tiên |
| --- | --- | --- | --- | --- |
| N1 | Card chốt tiền buổi trông như hoá đơn | hiểu sai | 0 | P0 · đổi nhãn |
| N2 | "Quỹ bù thêm" đọc như quỹ đã trả | hiểu sai | 0 | P1 |
| N3 | Tiền cầu hiện trên buổi không có chứng từ | hiểu sai | 0 | P2 · thêm nguồn |
| N4 | Tiền sân từng buổi ≠ hoá đơn tháng | hiểu sai | 0 | P1 · thêm badge |
| N5 | Tồn kho không hiện thành tiền | đọc thấp | 0 | P2 |
| B1 | Quên nhập hoá đơn sân tháng | **quỹ sai** | 1.920.000 | P0 |
| B2 | Thành viên ứng tiền bị ghi chi ngay | **quỹ sai** | 3.300.000 | P1 · Issue 4 |
| B3 | Quên tick đã đóng quỹ tháng | **quỹ sai** | tới 2.300.000 | P0 |
| B4 | Bán sân không nhập số tiền | **quỹ sai** | 300.000 | P1 |
| B5 | Buổi huỷ không đánh dấu `cancelled` | **quỹ sai** | 20.000/lượt | P1 |
| B6 | Không điểm danh → mất back tiền | **quỹ sai** | 63.000/lượt | P0 |
| B7 | Buổi để `open` mãi | **quỹ sai** | nhiều đường | P1 |
| B8 | Back tiền tính theo giá hiện tại | **quỹ sai** | chênh × lượt | P1 |
| B9 | Quên tick khách đã trả | **quỹ sai** | 65.000/khách | P0 |
| B10 | Quên trả back — nợ ẩn | dư ảo | 163.000 | P1 |
| B11 | Số dư mang sang nhập sai | **quỹ sai** | vĩnh viễn | P0 |
| T1 | Không có khái niệm nơi giữ tiền | thiếu | — | P1 |
| T2 | Không phân biệt số dư sổ / khả dụng | thiếu | — | P1 |

**Hai việc làm trước, bắt được hầu hết:**

1. **Màn "Đối chiếu quỹ"** — bắt B1, B2, B3, B4, B9, B10, B11
2. **Checklist chốt buổi** — bắt B4, B6, B7, và sửa luôn N1

Nguyên tắc chung của cả Mục 4:

> **Mọi con số im lặng đều sẽ sai. Phải có một chỗ để đối chiếu với thực tế, và phải nói rõ con số nào là tiền, con số nào là tính toán.**
