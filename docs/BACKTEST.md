# BACKTEST.md — Chạy lại lịch sử thật để kiểm công thức

**Version:** v1.0.0 · **Updated:** 2026-09-15

> ## 🚨 LUẬT SỐ 0 — đọc trước khi đụng công thức
>
> Đổi công thức **Elo** hoặc **điểm mùa** → test `backtest.test.js` sẽ ĐỎ.
>
> **⛔ TUYỆT ĐỐI KHÔNG chạy `--save` để dập cho xanh.**
>
> Nó đỏ nghĩa là bạn vừa làm đổi Elo hoặc điểm mùa của **cả CLB**. Đó là chủ đích.
> Phải đọc diff → xác nhận đúng ý đồ → báo user → xin phép → rồi mới cập nhật mốc.
>
> Đè mốc mà không đọc = vứt bỏ toàn bộ tác dụng gác.

---

## 1. Backtest là gì

Nạp lại **lịch sử trận thật** của CLB, chạy **tuần tự từng trận theo thứ tự thời gian** qua đúng
công thức đang có trong code, rồi so kết quả với lần chạy trước.

**Không phải giả lập.** Kết quả từng trận (ai thắng, tỷ số) là số thật đã ghi. Chỉ phần *tính toán*
— Elo tích luỹ, điểm mùa — được dựng lại từ điểm seed.

Đây chính xác là việc nút **Đồng bộ lại Elo** trong app làm, chỉ khác là chạy ngoài app và in ra
bộ số để đối chiếu.

**Vì sao cần:** đổi công thức mà không có bộ số đối chiếu thì không ai biết mình vừa làm gì. Bảng
xếp hạng đảo lộn hai tuần sau, và không truy được dòng code nào gây ra.

---

## 2. Ba thư mục

```
src/__tests__/backtest/
├── data/       DỮ LIỆU THÔ — file bấm "Xuất trận" tải về
├── baseline/   ĐÁP ÁN      — bộ số tính ra từ file đó
├── run.mjs     CLI
└── backtest.test.js
```

| | `data/` | `baseline/` |
|---|---|---|
| Là gì | Trận đã đánh: ai với ai, tỷ số, khi nào, điểm danh | Elo từng người, điểm mùa, chỉ số sức khoẻ |
| Ai tạo | App, qua nút **Xuất trận** | Lệnh `--save` |
| Khi nào đổi | Khi xuất bộ dữ liệu mới | Khi **công thức** đổi (và đã được duyệt) |
| Sửa tay | Không bao giờ | Không bao giờ |

Hai file **cùng tên**, khác vai. `data/x.json` phải có đúng `baseline/x.json` — thiếu là test đỏ.

> Đổi K-factor người mới từ 48 xuống 40 thì `data/` **không đổi gì** (trận vẫn thế), nhưng
> `baseline/` đổi (Elo ra khác). Test bắt đúng chỗ đó.

---

## 3. Ba lệnh

```bash
# Xem bộ số hiện tại
npm run backtest -- src/__tests__/backtest/data/<file>.json

# Tạo mốc (chỉ khi thêm bộ dữ liệu mới, hoặc sau khi đã duyệt thay đổi công thức)
npm run backtest -- src/__tests__/backtest/data/<file>.json --save src/__tests__/backtest/baseline/<file>.json

# So với mốc — việc chính khi đổi công thức
npm run backtest -- src/__tests__/backtest/data/<file>.json --vs src/__tests__/backtest/baseline/<file>.json
```

---

## 4. Quy trình khi đổi công thức

```
1. TRƯỚC khi sửa      npm test            → mốc phải XANH
                                            không xanh = có người đã đổi mà chưa cập nhật mốc → DỪNG

2. Sửa công thức      rating.js · season.js · app.json (khối rating / season)

3. Xem đã đổi gì      npm run backtest -- <data> --vs <baseline>
                                          → ĐỌC TỪNG DÒNG, ai đổi, đổi bao nhiêu

4. Phán xét           sai ý đồ  → sửa lại code, KHÔNG sửa mốc
                      đúng ý đồ → báo user con số cụ thể, XIN PHÉP

5. Sau khi được duyệt npm run backtest -- <data> --save <baseline>
                      ghi con số đã đổi vào commit message
                      ví dụ: "Elo nhóm đáy +40..+60 · drift 0 → -15 · clampGain 201 → 0"
```

**Bước 3 và 4 không được bỏ.** Đó là toàn bộ giá trị của công cụ này.

---

## 5. Thêm bộ dữ liệu mới

Trang **Trận đấu** → nút tải xuống → chọn khoảng:

| Lựa chọn | Lấy gì |
|---|---|
| Toàn bộ lịch sử | Tất cả trận từ trước tới nay |
| Mùa hiện tại | Trận của các buổi trong khung ngày của mùa |
| 3 tháng / 1 tháng gần nhất | Theo ngày buổi |

Lọc theo **ngày của BUỔI**, tính cả hai đầu mốc. File đã lọc cắt luôn buổi, điểm danh và khách
ngoài khoảng, nhưng **giữ nguyên danh sách hội viên** — thiếu hội viên là thiếu seed trình độ,
replay ra Elo khác.

Chép vào `data/`, tạo mốc bằng `--save`, xong. Test tự động gác từ đó.

---

## 6. Bộ số nói gì

| Chỉ số | Khoẻ khi | Bệnh nghĩa là |
|---|---|---|
| `eloDrift` | ≈ 0 | Engine tự sinh hoặc huỷ điểm. Elo là hệ tổng-bằng-không |
| `clampGainTotal` | = 0 | Sàn 0 của điểm mùa đang tạo điểm từ hư không, thang mất tính replay |
| `pairGapMedian` | thấp | Chênh Elo trong nội bộ một đôi — đo kèo cõng |
| `teamGapMedian` | thấp | Chênh giữa hai đội — đo độ cân của trận |
| `tierCounts` | dùng đủ dải | Dải nào bằng 0 là ngưỡng đặt sai so với độ trải thật của CLB |
| `debtSpread` | thấp | Chênh lượt đánh giữa người được gọi nhiều nhất và ít nhất trong một buổi |
| `attendanceKnown` | `true` | `false` = file bản 1, mọi chỉ số công bằng chưa đo được |

---

## 7. Giới hạn — phải biết trước khi kết luận

- **File bản 1 không có điểm danh.** Người đi tập mà không được gọi trận nào là **vô hình**.
  Xuất lại bằng bản 2 là hết.
- **Bộ số phản ánh cách xếp sân ĐÃ THỰC SỰ DIỄN RA.** Nếu các trận đó do quản trò xếp tay thì nó
  không nói gì về chất lượng thuật toán `arrange()` — đừng dùng để kết luận về chia sân.
- **Điểm danh phục vụ hai việc**: tính tiền *và* xếp sân. Người `noshow` (nghỉ không báo) vẫn bị
  tính tiền nhưng **không** tính là có mặt trên sân. Điểm danh bẩn → mọi phép đo công bằng sai.
- **Ít buổi thì đừng chốt.** 50 trận đủ để loại phương án tệ, không đủ để tinh chỉnh hệ số.

---

## 8. Bộ số mốc hiện tại

Đo trên 53 trận · 4 buổi · 2026-Q3:

```
eloDrift          -15     ✓ khoẻ, gần như tổng-bằng-không
clampGainTotal   +201     ✗ BỆNH — sàn 0 tạo điểm cho 11/22 người
totalUpsets         0     — chênh đội tối đa 123, chưa bao giờ chạm ngưỡng 150
tierCounts        balanced 120 · favored 42 · underdog 38
                  heavyFavored 0 · deepUnderdog 0  ← hai dải chưa bao giờ chạy
pairGapMedian      76     ✓ ghép cặp cân
teamGapMedian      42     ✓ trận cân
```

`clampGainTotal` là con số cần theo dõi: làm Phase 3 (bỏ sàn 0, dịch thang) xong thì nó **phải về 0**,
và backtest sẽ xác nhận thay vì phải tin lời ai.

---

## 9. Liên quan

- `src/__tests__/backtest/README.md` — bản ngắn, để cạnh code
- `docs/RULES.md` §0 — luật cứng
- `CLAUDE.md` — LUẬT SỐ 0 ở đầu file
