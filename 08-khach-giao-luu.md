# 08 · Khách giao lưu

`07` trả lời **tiền khách chạy vào quỹ thế nào**. File này trả lời câu còn lại: **khách là ai** — nhận biết bằng gì, ai chịu trách nhiệm, và vì sao danh bạ khách đang phình lên.

Đọc theo thứ tự: Mục 1 hiện trạng · Mục 2 issue và hướng xử lý · Mục 3 quyết định đã chốt · Mục 4 UI · Mục 5 thứ tự làm.

---

# MỤC 1 · HIỆN TRẠNG

## 1.1 · Khách lưu riêng, không chung với thành viên

Hai bảng, tách rõ:

```
guests            danh bạ khách của CLB, dùng lại nhiều buổi
                  { id, name, gender, level, invitedBy, phone }
                  hiện 12 người · K1–K12

session_guests    một dòng = một lượt khách đi một buổi
                  { sessionId, guestId, level, gender, price, paid }
                  hiện 29 dòng trong tháng 08/2026
```

Khách **không** nằm trong `club_members`. Đúng, và giữ nguyên — khách không có quỹ tháng, không có nhóm cố định, không có vai và tài khoản.

## 1.2 · Vòng đời một khách hiện tại

```
Quản trò gõ tên vào ô "Tên khách"
   │
   ├── tên khớp TUYỆT ĐỐI (sau khi hạ chữ) với một khách cũ
   │      → nối vào bản ghi đó, cập nhật invitedBy
   │      → NGƯỜI DÙNG KHÔNG THẤY GÌ
   │
   └── lệch một dấu, một dấu cách
          → tạo bản ghi khách mới
          → CŨNG KHÔNG THẤY GÌ

Chọn người rủ (bắt buộc)  → không chọn thì chặn
   │
   ▼
Ghi session_guests, giá chốt theo bảng giá trình độ × giới tính
   │
   ├── tích "Đã trả tiền"  → paid = true  → thu vào sổ quỹ
   └── không tích          → paid = false → hiện ở màn Công nợ
```

## 1.3 · Ba chỗ đang đúng, không sửa

**Giá chốt tại thời điểm buổi.** `session_guests` copy `level`, `gender`, `price` vào từng lượt. Sửa bảng giá giao lưu sau này không làm lệch buổi cũ. Đây là đúng nguyên tắc của `07` Issue 5 — dữ liệu đã chốt thì lưu, không tính lại.

**Mọi khách đều có người rủ.** Nợ của người lạ thì CLB không đòi được; người rủ là người có mặt hàng tuần. Ràng buộc này giữ.

**Màn Công nợ đã có cả hai cách xem.** Card trên gộp theo người rủ (`inviterRows`), danh sách dưới là từng khách kèm dòng *"Rủ bởi Mai"* (`debtCards`). Không phải làm thêm — chỉ đổi nguồn dữ liệu (xem K1).

---

# MỤC 2 · ISSUE VÀ HƯỚNG XỬ LÝ

Sáu việc. Hai đầu là **bug đang làm sai số liệu**, bốn sau là UI.

---

## K1 · `invited_by` lưu sai chỗ — **P0**

### Hiện trạng

`invitedBy` là cột trên **`guests`**, tức là một khách chỉ có **một** người rủ, ghi đè theo lần add gần nhất.

```
Tháng 8   Mai rủ Trang   →  guests.K1.invitedBy = M2
Tháng 9   Đạt rủ Trang   →  guests.K1.invitedBy = M8    ← ghi đè
```

### Vấn đề

Màn Công nợ gộp nợ theo `r.guest.invitedBy`, nên nợ **tháng 8** của Trang nhảy từ Mai sang Đạt. Số liệu tháng đã qua tự đổi chủ, không ai biết.

Cùng đúng một lỗi với `07` B8 và Issue 5, và cùng một nguyên tắc:

> Đừng đọc cấu hình hiện tại để tính chuyện đã xảy ra.

### Hướng xử lý

Chuyển xuống từng lượt.

```sql
ALTER TABLE session_guests ADD COLUMN invited_by uuid NULL REFERENCES club_members(id);
-- NULL = CLB tuyển (xem K5)
-- guests.invited_by giữ lại, chỉ còn vai trò: gợi ý người rủ khi add lần sau
```

Đổi hai chỗ đọc: `guestDebtRows()` và `inviterRows` lấy `sg.invited_by` thay vì `guest.invitedBy`. Một khách được nhiều người rủ ở các buổi khác nhau là bình thường và giờ ghi được.

---

## K2 · "Thu hết nợ" xoá nợ của người khác — **P0**

### Hiện trạng

```js
collectDebt=(gid)=>{ ... (g.guestId===gid && ss.date.slice(0,7)===s.month)
                          ? Object.assign({},g,{paid:true}) : g ... }
```

Set `paid = true` cho **mọi lượt của khách đó trong tháng đang xem**.

### Vấn đề

Một khách có thể do hai người rủ trong cùng tháng. Bấm "Thu hết nợ" ở dòng của Đạt là **xoá luôn nợ của lượt Vân Anh rủ**. Vân Anh mất khoản phải đòi, không có cảnh báo nào.

### Hướng xử lý

Thu đúng tập dòng đang hiện trên UI:

```
Xem theo khách            → thu mọi lượt chưa trả của khách đó trong tháng
Xem theo người rủ         → chỉ thu lượt có invited_by = người đó
```

Và Dialog xác nhận nói rõ số lượt, số tiền, tên người rủ trước khi thu.

---

## K3 · Ô tên tự do → danh bạ phình lên — **P1**

### Hiện trạng

Ô "Tên khách" là input tự do. Dedupe bằng `name.toLowerCase()` khớp tuyệt đối.

### Vấn đề

`Thắng` / `Thắng em` / `thắng ` thành ba bản ghi khác nhau. Một người có ba lịch sử, ba dòng công nợ, không cộng lại được. Và cả hai nhánh — nối vào khách cũ hay tạo mới — đều xảy ra **im lặng**, người dùng không biết mình vừa làm gì.

### Hướng xử lý

Ô tên thành **ô tìm trong danh bạ**. So khớp sau khi bỏ dấu, hạ chữ, gộp khoảng trắng, nên `thang` / `Thắng` / `THẮNG ` gom về một chỗ. Chọn chip = nối vào khách cũ. Bấm dòng `＋` = tạo mới. Hai hành động chủ động, không còn gì xảy ra ngầm.

UI ở **4.1**.

---

## K4 · Không có gì để nhận biết khách — **P1**

### Hiện trạng

`guests.phone` có trong bảng nhưng form không hỏi, luôn rỗng. Định danh duy nhất là chuỗi tên.

### Vấn đề

Khách nợ 130.000 rồi không quay lại: không có số, không liên lạc được. Khách quen quay lại sau ba tháng: không nhận ra, tạo bản ghi mới.

### Hướng xử lý

Định danh **hai lớp**, không lớp nào bắt buộc ngay từ buổi đầu:

```
Có số điện thoại  →  số là khoá
Không có số       →  tên đầy đủ, đã chuẩn hoá
```

Không đặt `UNIQUE(phone)` trong DB — chặn trùng bằng UI (K3) rẻ hơn và không chặn khách không có số.

**Xin số đúng lúc, không xin sớm.** Đến buổi thứ 3 form mới hiện một dòng: *"Trang đã đi 3 buổi, chưa có số. Thêm để lần sau nhận ra và gọi được."* Xin ngay buổi đầu thì quản trò bỏ trống hoặc gõ bừa — đúng như cột `phone` rỗng hiện nay.

Thêm một cột duy nhất:

```sql
ALTER TABLE guests ADD COLUMN note text;   -- "tay trái", "bạn Mai", "hay đến muộn"
```

`sessions_count`, `last_seen`, "khách quen / khách một lần" **không lưu thành cột** — tính từ `session_guests`. Thêm cột là thêm chỗ để lệch.

---

## K5 · Khách CLB tự tuyển bị gán vào tên chủ CLB — **P1**

### Hiện trạng

`addGuest` chặn cứng: không chọn người rủ thì báo *"Chọn thành viên rủ khách này"*. Cả thiết kế giả định mọi khách là bạn của một thành viên.

### Vấn đề

CLB đăng tin trên nhóm Facebook, người lạ đến. Không ai rủ. Cách duy nhất là chỉ chủ CLB làm người rủ, và khi đó:

- Bảng "ai rủ nhiều khách nhất" biến thành bảng của chủ CLB
- Nợ của người lạ treo dưới tên chủ CLB — chủ CLB thành con nợ lớn nhất màn Công nợ dù không rủ ai

### Hướng xử lý

Thêm **một giá trị** vào dropdown "Người rủ" đã có sẵn: `CLB tuyển` (lưu `invited_by = NULL`).

```
Người rủ   [ ▾ ]
           CLB tuyển        ← thêm đúng dòng này
           Thúy
           Mai
           Đạt
           …
```

Không cột `source`, không form thứ hai, không nhánh xử lý. **Một loại khách duy nhất** — khác nhau chỉ ở giá trị ô người rủ, như chọn Mai thay vì chọn Đạt. Màn Công nợ có thêm một dòng gộp `CLB tuyển`, để biết CLB đang tự gánh bao nhiêu nợ khách lạ.

---

## K6 · Không có chỗ nào nhìn thấy toàn bộ khách — **P1**

### Hiện trạng

Khách chỉ xuất hiện gián tiếp ở màn Công nợ, và **chỉ những người còn nợ**. Khách đã trả hết không nhìn thấy ở đâu.

### Vấn đề

Buổi Chủ nhật thiếu 2 nam TB. Không có chỗ nào để lọc ra khách quen trình độ TB có số điện thoại — việc này đang làm bằng cách nhớ trong đầu.

### Hướng xử lý

Tab **Khách giao lưu** trong màn Thành viên, lọc theo trình độ và giới tính. UI ở **4.2**.

---

## Cắt khỏi phạm vi

Bốn việc đã cân nhắc và bỏ, ghi lại để sau không phải bàn lại:

| Việc | Vì sao bỏ |
| --- | --- |
| Phân biệt khách công khai / khách do thành viên rủ (`source`) | Không cần hai loại khách. `CLB tuyển` là một giá trị người rủ, đủ (K5) |
| Khách trả một phần (`paid_amount` trên `session_guests`) | Khách luôn trả hết một lần. Giữ `paid` boolean |
| Đổi luồng thanh toán (`pay_mode: prepaid / at_court / debt`) | Giữ nguyên: user tự tích "Đã trả tiền" như hiện tại |
| Xếp khách cùng sân với người rủ | Chia sân giữ nguyên theo trình độ. Xem `05` |

Hai việc **hoãn**, không làm trong đợt này:

| Việc | Vì sao hoãn |
| --- | --- |
| Gộp hai khách trùng | Sau khi có K3 thì trùng gần như không sinh thêm. Làm bây giờ là dọn 34 bản ghi bằng một tính năng dùng một lần |
| Chuyển khách thành thành viên | Xảy ra vài lần một năm. Tạo thành viên mới bằng tay chấp nhận được |

---

# MỤC 3 · QUYẾT ĐỊNH ĐÃ CHỐT

| # | Câu hỏi | Chốt |
| --- | --- | --- |
| 1 | Khách có được ghi nợ không | **Có.** Giữ công nợ khách như hiện tại |
| 2 | Có phân biệt khách CLB tự tuyển không | **Không phân biệt loại khách.** Thêm giá trị `CLB tuyển` ở ô người rủ (K5) |
| 3 | Khách trả một phần | **Không có.** Khách trả hết, `paid` giữ boolean |
| 4 | Nhận biết khách bằng gì | **Số điện thoại, hoặc tên đầy đủ** đã chuẩn hoá (K4) |
| 5 | Chia sân có tính người rủ không | **Không.** Giữ nguyên theo trình độ |
| 6 | Luồng thanh toán | **Giữ nguyên** — user tự tích, tự kiểm |
| 7 | Chọn khách cũ mà trình độ đã đổi | **Cập nhật cả danh bạ**, kèm dòng xác nhận mặc định tích. Lượt cũ không đổi vì giá đã chốt |
| 8 | Màn Công nợ khách | **Giữ đầy đủ tiền và thời gian như hiện tại** — không rút gọn để lấy chỗ. Đây là màn hình đưa cho khách xem |

---

# MỤC 4 · UI

## 4.1 · Thêm khách vào buổi

```
┌ Thêm khách vào buổi 23/08 ─────────────────────────────┐
│                                                        │
│  Khách        [ tra                              ]     │
│                                                        │
│  ▸ Trang                TBY · Nữ    12 buổi · 09/08    │
│    0912345678 · Mai rủ lần gần nhất                    │
│  ▸ Trang Anh            Newbie · Nữ  1 buổi · 02/08    │
│    chưa có SĐT · Đạt rủ                                │
│  ＋ Thêm khách mới tên "tra"                            │
│                                                        │
│  ──────────────────────────────────────────────────    │
│  Người rủ     [ Mai                            ▾ ]     │
│  Trình độ     [ TB- ▾ ]      Giới tính  [ Nữ ▾ ]       │
│               [✓] Cập nhật trình độ Trang trong         │
│                   danh bạ thành TB-                     │
│  Giá          65.000 đ   ← theo bảng giá, tự điền       │
│               [ ] Đã trả tiền                          │
│                                                        │
│  Trang đã đi 3 buổi, chưa có số. Thêm để lần sau       │
│  nhận ra và gọi được.       [ Thêm SĐT ]               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

Quy tắc:

- Chọn chip → tự điền trình độ, giới tính, người rủ gần nhất từ danh bạ
- Sửa trình độ ở form → giá lượt này đổi theo, **và** hỏi cập nhật danh bạ (mặc định tích). Lượt cũ giữ giá đã chốt
- Dòng nhắc SĐT chỉ hiện từ buổi thứ 3 và khi `phone` rỗng
- Checkbox "Đã trả tiền" giữ nguyên vị trí và hành vi cũ

## 4.2 · Tab Khách giao lưu — trong màn Thành viên

```
Thành viên │ Cố định tháng 9 │ Chờ duyệt │ ★ Khách giao lưu

[ Tất cả 34 ]  [ Khách quen 8 ]  [ Một lần 26 ]
Trình độ [ Tất cả ▾ ]   Giới tính [ Tất cả ▾ ]   [ tìm tên / SĐT ]

Trang         TB- · Nữ     12 buổi   09/08    đã đóng 780.000
              0912345678 · Mai rủ 9 · Đạt rủ 3
              tay trái, hay đến muộn

Đức Anh       TB · Nam      6 buổi   16/08    đã đóng 450.000
              chưa có SĐT · Đạt rủ 6 · còn nợ 225.000

Nguyên        TBY · Nam     1 buổi   14/08    đã đóng 65.000
              CLB tuyển
```

- **Lọc theo trình độ là mục đích chính**, không phải để ngắm: thiếu 2 nam TB thì lọc ra, có số thì gọi
- "Khách quen" = từ 3 buổi. Tính tại chỗ, không lưu cột
- Cột phải là **tổng tiền khách đó đã đóng cho CLB** — con số nói thẳng ai là khách đáng giữ

## 4.3 · Công nợ khách — giữ đầy đủ

Không rút gọn. Giữ nguyên cấu trúc hiện tại: card gộp theo người rủ ở trên, từng khách ở dưới, kèm số tiền và mốc thời gian. Đây là màn hình quản trò mở ra đưa khách xem, nên thiếu số hoặc thiếu ngày là không dùng được.

```
┌ Công nợ khách giao lưu ───────────── Tổng khách nợ 280.000 ┐
│                                                            │
│  THEO NGƯỜI RỦ                                             │
│  Đạt          2 khách · đã thu 65.000        còn 225.000    │
│  Vân Anh      1 khách · đã thu 0                 55.000    │
│  CLB tuyển    1 khách · đã thu 65.000          Hết nợ      │
│                                                            │
│  ─────────────────────────────────────────────────────      │
│                                                            │
│  Đức Anh          TB · Nam · Rủ bởi Đạt                    │
│  Giao lưu 3 buổi                             225.000       │
│    02/08  buổi CN    75.000   chưa trả                     │
│    09/08  buổi CN    75.000   chưa trả                     │
│    16/08  buổi T6    75.000   chưa trả                     │
│                                      [ Thu hết nợ ]        │
└────────────────────────────────────────────────────────────┘
```

Ba dòng ngày là phần **thêm** so với hiện tại — bung ra từng buổi để khách đối chiếu. Tổng tiền, số buổi, đã trả bao nhiêu giữ nguyên như đang có.

---

# MỤC 5 · TÓM TẮT VIỆC PHẢI LÀM

| # | Việc | Mức | Chạm vào đâu |
| --- | --- | --- | --- |
| K1 | `invited_by` xuống `session_guests` | **P0** | `session_guests`, `guestDebtRows()`, `inviterRows` |
| K2 | Sửa `collectDebt` thu đúng tập dòng | **P0** | `collectDebt()`, Dialog xác nhận |
| K3 | Ô tìm danh bạ khi thêm khách | P1 | form thêm khách, `addGuest()` |
| K4 | Định danh: `phone` + tên chuẩn hoá + `note` · nhắc SĐT từ buổi 3 | P1 | `guests.note`, form thêm khách |
| K5 | Giá trị `CLB tuyển` ở ô người rủ | P1 | dropdown người rủ, màn Công nợ |
| K6 | Tab Khách giao lưu, lọc theo trình độ | P1 | màn Thành viên |
| — | Bung từng buổi kèm ngày ở Công nợ | P2 | màn Công nợ |

Cấu trúc dữ liệu chỉ thêm **hai cột**:

```sql
ALTER TABLE session_guests ADD COLUMN invited_by uuid NULL REFERENCES club_members(id);
ALTER TABLE guests         ADD COLUMN note       text;
```

`phone`, `gender`, `level` đã có sẵn trong `guests` — chỉ là form chưa hỏi và màn hình chưa dùng. Còn lại toàn bộ là UI.

Thứ tự: **K1 + K2 trước** (đang làm sai số liệu), rồi **K3 + K4** (chặn trùng tại nguồn), rồi **K5 + K6**.

---

# MỤC 6 · KHÔNG LÀM

- Không đăng nhập, không tài khoản cho khách. Khách là bản ghi do CLB quản, không phải người dùng
- Không quét Facebook, không API. Link FB dán tay thì được, nhưng không dùng để nhận biết — người ta đổi tên profile liên tục
- Không `UNIQUE(phone)` trong DB. Chặn trùng bằng UI, không chặn khách không có số
- Không xếp hạng khách, không điểm thưởng, không huy hiệu
- Không lưu `sessions_count` / `last_seen` / `status` thành cột — tính từ `session_guests`
