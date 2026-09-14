# Backtest — bộ số chuẩn trên dữ liệu thật

> ## 🚨 KHÔNG ĐƯỢC SỬA MỐC ĐỂ TEST XANH
>
> Test `backtest.test.js` đỏ nghĩa là **công thức Elo hoặc thang điểm mùa vừa đổi**.
> Nó đỏ là **đúng chủ đích**, không phải hỏng.
>
> **Cấm** chạy `--save` để dập test cho xanh. Phải đọc từng dòng diff, xác nhận đúng ý đồ,
> rồi mới cập nhật mốc. Cập nhật mốc mà không đọc = vứt bỏ toàn bộ tác dụng gác, và lần sau
> công thức sai sẽ đi thẳng lên production mà không ai biết.

---

## Để làm gì

Đổi công thức Elo hay thang điểm mùa mà không có bộ số đối chiếu thì **không ai biết mình vừa
làm gì**. Bảng xếp hạng đảo lộn hai tuần sau, và không truy được dòng code nào gây ra.

Backtest chạy lại **lịch sử trận thật** — kết quả từng trận là số đã ghi, không giả lập — tuần tự
theo thời gian, qua đúng công thức đang có trong code. Ra một bộ số. Đổi công thức thì chạy lại,
so hai bộ.

## Hai thư mục này khác nhau thế nào

```
data/       DỮ LIỆU THÔ  — file bấm "Xuất trận" tải về. Lịch sử trận đã đánh.
baseline/   ĐÁP ÁN       — kết quả TÍNH TOÁN từ file đó, do `--save` sinh ra.
run.mjs     CLI
```

| | `data/` | `baseline/` |
|---|---|---|
| Là gì | Trận đã đánh: ai đánh với ai, tỷ số, khi nào | Elo từng người, điểm mùa, chỉ số sức khoẻ |
| Ai tạo | App, qua nút Xuất trận | Lệnh `npm run backtest -- ... --save` |
| Khi nào đổi | Khi bạn xuất bộ dữ liệu mới | Khi **công thức** đổi (và bạn đã duyệt) |
| Sửa tay | Không bao giờ | Không bao giờ — chỉ sinh bằng `--save` |

Hai file **cùng tên**, khác vai. `data/x.json` phải có đúng `baseline/x.json`; thiếu là test đỏ.

Ví dụ: đổi K-factor người mới từ 48 xuống 40 thì `data/` **không đổi gì** (trận vẫn thế), nhưng
`baseline/` đổi (Elo ra khác). Test bắt đúng chỗ đó.

## Bản 2 của file sao lưu

Từ bản 2, file xuất kèm thêm — cần cho việc đo công bằng và sức chứa sân:

| Trường | Để làm gì |
|---|---|
| `ref.attendance` | **Điểm danh.** Thiếu nó thì người đi tập mà không được gọi trận nào là **vô hình** |
| `ref.sessions[].courts` | Mấy sân, từ mấy giờ tới mấy giờ, sân nào đã bán → tính được **trần cứng** số trận |
| `ref.sessions[].status` | Buổi đã chốt hay chưa |
| `ref.sessionGuests` | Trình độ khách **theo từng buổi** (`guests.level` chỉ là mức mặc định) |

File bản 1 vẫn nhập và backtest được; các chỉ số cần điểm danh sẽ trả `null` thay vì 0 —
`null` đọc đúng là *"chưa đo được"*, còn 0 đọc nhầm thành *"đã đo, không lệch"*.

## Xuất bộ dữ liệu mới

Trang **Trận đấu** → nút tải xuống → chọn khoảng:

| Lựa chọn | Lấy gì |
|---|---|
| Toàn bộ lịch sử | Tất cả trận từ trước tới nay |
| Mùa hiện tại | Trận của các buổi trong khung ngày của mùa |
| 3 tháng / 1 tháng gần nhất | Theo ngày buổi |

Lọc theo **ngày của BUỔI**, bao gồm cả hai đầu mốc. File đã lọc cắt luôn buổi, điểm danh và khách
ngoài khoảng — nhưng **giữ nguyên danh sách hội viên**, vì thiếu hội viên là thiếu seed trình độ,
replay ra Elo khác. Trường `range` trong file ghi lại đã lọc gì.

Tên file tự gắn nhãn khoảng: `tran_dau_Q8QVSV8U_2026-Q3_2026-09-14.json`.



```bash
# Xem bộ số hiện tại
npm run backtest -- src/__tests__/backtest/data/<file>.json

# Thêm bộ dữ liệu mới: chép vào data/ rồi tạo mốc
npm run backtest -- src/__tests__/backtest/data/<file>.json --save src/__tests__/backtest/baseline/<file>.json

# So với mốc (việc chính khi đổi công thức)
npm run backtest -- src/__tests__/backtest/data/<file>.json --vs src/__tests__/backtest/baseline/<file>.json
```

## Quy trình khi đổi công thức

1. **Trước khi sửa** — `npm test`, mốc phải xanh. Không xanh thì dừng, có người đã đổi công thức
   mà chưa cập nhật mốc.
2. Sửa công thức.
3. `npm run backtest -- <data> --vs <baseline>` — đọc **từng dòng**.
4. Sai ý đồ → sửa lại code. Đúng ý đồ → `--save` đè mốc, và **ghi vào commit message** con số
   đã đổi (ví dụ: *"Elo nhóm đáy +40 đến +60, drift 0 → -15"*).

## Bộ số nói gì

| Chỉ số | Khoẻ khi | Bệnh nghĩa là |
|---|---|---|
| `eloDrift` | ≈ 0 | Engine tự sinh hoặc huỷ điểm. Elo là hệ tổng-bằng-không |
| `clampGainTotal` | = 0 | Sàn 0 của điểm mùa đang tạo điểm từ hư không, và thang mất tính replay |
| `pairGapMedian` | thấp | Chênh Elo trong nội bộ một đôi — đo kèo cõng |
| `teamGapMedian` | thấp | Chênh giữa hai đội — đo độ cân của trận |
| `tierCounts` | dùng đủ dải | Dải nào bằng 0 là ngưỡng đặt sai so với độ trải thật của CLB |
| `debtSpread` | thấp | Chênh lệch lượt đánh giữa người được gọi nhiều nhất và ít nhất trong một buổi |
| `attendanceKnown` | `true` | `false` = file bản 1, mọi chỉ số công bằng đều chưa đo được |

## Giới hạn phải biết

- File **bản 1** không chứa điểm danh — mọi phép đo công bằng trên bộ đó đều **không thấy**
  người đi tập mà không được gọi trận nào. Xuất lại bằng bản 2 là hết.
- Bộ số phản ánh **cách xếp sân đã thực sự diễn ra**. Nếu các trận đó do quản trò xếp tay thì nó
  không nói gì về chất lượng của thuật toán `arrange()` — đừng dùng nó để kết luận về chia sân.
- Dữ liệu chứa **tên thật thành viên**. Cân nhắc trước khi đẩy repo ra ngoài phạm vi CLB.
