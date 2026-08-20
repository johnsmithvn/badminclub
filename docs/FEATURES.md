# FEATURES.md

**Version:** v0.1.0 · **Updated:** 2026-08-19

Chức năng theo màn hình, kèm **luật nghiệp vụ** dễ làm sai. Bố cục và copy chính xác nằm ở handoff
`02-screens-ui-spec.md` — file này không lặp lại pixel, chỉ nói **app phải xử sự thế nào**.

---

## 0. Ba nguyên tắc chi phối mọi màn hình

1. **Không ai phải nhập thứ app tự suy ra được.** Không đếm cầu vẫn chốt được buổi (lấy định mức).
   Không nhập giá khách (tự tính theo trình độ × giới tính). Không nhập tiền sân (giờ × giá sân).
2. **Mọi con số phải giải thích được nguồn gốc.** Con số nào cũng đi kèm một câu nói nó từ đâu ra:
   *"Định mức Cố định Chủ nhật: 34 quả/buổi cho 2 sân"*.
3. **Buổi chỉ ảnh hưởng tiền khi `status='closed'`.** Trước đó mọi con số là dự kiến. Chia sân,
   số trận, bấm giờ **không bao giờ** ảnh hưởng tiền.

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

**Khách giao lưu:** nhập tên + giới tính + trình độ + người rủ → giá tự tính, **chốt luôn** vào
bản ghi. Trùng tên khách cũ thì tái dùng bản ghi khách, chỉ cập nhật người rủ.
Mỗi khách có công tắc *đã trả* / *ghi nợ*.

**Sân của buổi** — hai luật hay bị nhầm:

| Việc | Hệ quả tiền | Hệ quả cầu |
| --- | --- | --- |
| **Bán sân dư** cho CLB khác | sân đó **không** tính vào chi phí buổi; tiền bán ghi **thu** | định mức cầu **giảm** theo số sân CLB còn chơi |
| **Thuê thêm sân** (`extra`) | ghi **chi riêng** ngoài hoá đơn tháng | không đổi mẫu số định mức |

**Chốt tiền buổi** — 3 cách vào số cầu, cùng ra một con số:

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

- **Lịch tháng**: lưới tháng, chip buổi theo màu trạng thái, bấm mở buổi.
- **Lịch cố định**: tạo một lần → sinh buổi cả kỳ. Không sinh trùng (đã có buổi cùng ngày + nhóm thì bỏ qua).
- **Thành viên**: danh sách + 2 hàng chờ duyệt:
  - *Đăng ký cố định tháng sau* — trạng thái theo tháng: `fixed` / `off` / `pending`.
  - *Thay đổi thông tin* — **đổi trình độ áp dụng từ tháng sau**, **đổi SĐT áp dụng ngay**.
- Thêm người **giữa tháng** với lựa chọn "cố định từ bây giờ" → sinh quỹ tháng theo
  `đơn giá × số buổi còn lại`, ghi chú *"Vào giữa tháng · N buổi còn lại"*.

## 6. Công nợ · Sổ quỹ · Kho cầu

**Công nợ** 3 tab: nợ khách gộp theo **người rủ** (để nhắc thu hộ) · nợ theo từng **khách** ·
**quỹ tháng** thành viên cố định · **back tiền** cuối tháng.

**Sổ quỹ** — 9 hạng mục, chiều thu/chi:

| Hạng mục | Chiều | Nguồn |
| --- | --- | --- |
| Số dư mang sang | in | `clubs.opening_balance` |
| Quỹ tháng | in | `monthly_dues.paid` |
| Khách giao lưu | in | `session_guests.paid` |
| Bán sân dư | in | buổi `closed` có sân bán |
| Tiền sân | out | `court_pay_mode='month'` → `court_bills`; `='session'` → mỗi buổi `closed` |
| Thuê thêm sân | out | chỉ khi trả trọn tháng, buổi `closed` |
| Mua cầu | out | `shuttle_purchases.total_amount > 0` |
| Back cố định nghỉ | out | `back_credits.paid`, ghi ngày `month-28` |
| Thu/chi tay | in/out | nhập tay (trích quỹ, ủng hộ, chuyển sổ Excel) |

Dòng **trùng ngày + hạng mục + chiều** gộp thành một dòng cha bung ra được (20 người đóng quỹ
cùng ngày = 1 dòng "Quỹ tháng").

**Kho cầu**: nhập mua (nhập **tổng tiền thực trả**, app tự ra đ/quả) · tiêu thụ theo buổi
(dấu `~` = buổi đang lấy định mức) · **kiểm kho cuối tháng**: đếm thực tế, so tồn hệ thống,
phần lệch **chia đều vào các buổi `closed` còn cờ `shuttle_est`** trong tháng, phần dư dồn vào
buổi cuối để tổng khớp tuyệt đối.

## 7. Trang cá nhân · Cài đặt · Sơ đồ dữ liệu

**Cá nhân**: một tài khoản dùng cho mọi CLB; danh sách CLB đang tham gia, bấm để chuyển.

**Cài đặt** 6 tab: Chung · Cách chia tiền · Sân · Cầu · Nhóm cố định · **Tài khoản & quyền**.

Tab *Tài khoản & quyền* — **ba cách cho người mới vào**, bật/tắt độc lập:

| Cách | Cờ | Luồng |
| --- | --- | --- |
| Mã CLB | `allow_code_join` | người mới nhập mã → yêu cầu chờ → chủ CLB **Ghép vào** bản ghi cũ / **Tạo thành viên mới** / **Từ chối** |
| Lời mời | `allow_invite` | chủ CLB gửi tới SĐT của bản ghi → ai tạo tài khoản từ link thì **tự ghép** |
| Trùng SĐT | `allow_phone_suggest` | so **chỉ chữ số**, gợi ý màu amber + nút Ghép. **Không bao giờ tự ghép** |

**Sơ đồ dữ liệu**: trang tài liệu sống trong app, liệt kê bảng/cột. Giữ lại ở bản thật.

---

## 8. Trạng thái rỗng, chặn, tải

- **Rỗng** = một câu **sự thật + việc cần làm**, không phải minh hoạ:
  *"Chưa có buổi nào để xếp"* + *"Vào Buổi tập → chọn buổi sắp tới → bấm Mở điểm danh"*.
- **Chặn hành động** (sai vai, thiếu dữ liệu) → **toast giải thích**, không disable im lặng:
  *"Vai này không được sửa thành viên"*, *"Sân này chưa có ai"*, *"Chọn bản ghi thành viên để ghép"*.
- **Tải** → skeleton hình dạng giống nội dung, không spinner.
