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

- **File bản 1–2 không có trận kèo và phiếu cược.** Kèo bị tính như trận thường (mất hệ số ×2)
  và điểm cược bị bỏ sót, nên điểm mùa ra thấp hơn thật. Muốn đo thang điểm mùa thì xuất lại bản 3.
- **File bản 1 không có điểm danh.** Người đi tập mà không được gọi trận nào là **vô hình**.
  Xuất lại bằng bản 2 là hết.
- **Bộ số phản ánh cách xếp sân ĐÃ THỰC SỰ DIỄN RA.** Nếu các trận đó do quản trò xếp tay thì nó
  không nói gì về chất lượng thuật toán `arrange()` — đừng dùng để kết luận về chia sân.
- **Điểm danh phục vụ hai việc**: tính tiền *và* xếp sân. Người `noshow` (nghỉ không báo) vẫn bị
  tính tiền nhưng **không** tính là có mặt trên sân. Điểm danh bẩn → mọi phép đo công bằng sai.
- **Ít buổi thì đừng chốt.** 50 trận đủ để loại phương án tệ, không đủ để tinh chỉnh hệ số.
- **"Tính lại toàn bộ", "Huỷ trận", "Sửa tỉ số" ghi đè số Elo lưu trong MỌI trận** (`initialRatingA/B`)
  bằng công thức hiện tại và trình độ hiện tại. Điểm mùa đọc chính số đó, nên bấm một lần là điểm
  mùa cả CLB xê dịch, kể cả mùa đã đóng mà chưa chốt bảng (từ 0073, mùa đã chốt đọc `season_standings`,
  không trôi nữa). Đo 2026-10-16: 114/118 trận Q3 bị đổi số, điểm Q3 lệch tới
  −19/người. File xuất SAU lần bấm không còn số cũ — so trước/sau phải dùng lịch sử thay đổi (§7.1).

### 7.1 Lịch sử thay đổi — dữ liệu để truy vết (0070)

Từ migration `0070_audit_log.sql`, DB tự ghi mọi thêm / sửa / xoá trên các bảng làm đổi Elo / điểm
mùa vào `audit_log` (trận, người chơi trong trận, Elo, hiệu chỉnh, kèo, cược, trình độ thành viên /
khách, thang mùa của CLB). Sửa: chỉ cột đổi, cũ và mới. Xoá: nguyên dòng. `tx_id` gom các dòng cùng
một lần ghi (một lần bấm "Tính lại" = một tx_id). Chỉ chủ CLB đọc được; không có màn hình — bảng này
để **truy vết và tua dữ liệu về một thời điểm** khi điểm đổi mà không rõ vì sao. Có lịch sử từ lúc
chạy 0070 trở đi, không có trước đó.

**Tua thời gian bằng backtest** — chủ CLB bấm *Trận đấu → Xuất trận → Xuất dữ liệu truy vết*
(file `truy_vet_<mã CLB>_<ngày>.json`: bảng phẳng + toàn bộ lịch sử, không có tiền / SĐT / ngân hàng):

```bash
npm run backtest -- truy_vet.json                                    # bảng điểm hiện tại
npm run backtest -- truy_vet.json --at "2026-10-16 14:00"            # bảng điểm lúc đó
npm run backtest -- truy_vet.json --at "2026-10-16 14:00" --vs-at "2026-10-16 17:00" --who "Canh"
```

Lệnh so hai mốc in từng người đổi bao nhiêu và **mỗi lần ghi góp bao nhiêu** (ai bấm, lúc nào: ghi /
huỷ trận, sửa tỉ số, tính lại Elo, đổi trình độ, phiếu cược, cấu hình mùa). Tổng các lần ghi luôn
bằng chênh lệch hai mốc. Giờ gõ hiểu theo `trace.timezone` (giờ CLB). Bảng điểm dựng qua đúng `toDb`
và `calculateSeasonLeaderboard` của app, đọc số Elo LƯU trong trận — tức đúng con số màn hình hiện
lúc đó. Code: `src/lib/trace.js` · `src/__tests__/backtest/trace_cli.mjs`.

Tra nhanh trong Supabase SQL Editor (chỉ đọc):

```sql
-- Mọi thay đổi trong một khoảng, gom theo lần ghi
SELECT changed_at, tx_id, table_name, action, row_id, old_data, new_data, actor
FROM audit_log
WHERE club_id = '<club_id>' AND changed_at BETWEEN '2026-10-20' AND '2026-10-21'
ORDER BY id;
```

---

## 8. Bộ số mốc hiện tại

Đo trên 254 trận · 16 buổi · toàn bộ lịch sử 04/09 → 25/10 (trọn Q3 + Q4 tới 25/10, file bản 3
có kèo + phiếu cược) — `data/all_2026-10-25_pk-badminton.json`:

```
eloDrift          +27     ✓ ≈ +0.1/trận
clampGainTotal      0     ✓ sàn 0 không tạo điểm (từ khi có startPoints 100)
totalUpsets        10
tierCounts        balanced 386 · favored 221 · underdog 212
                  heavyFavored 36 · deepUnderdog 30
pairGapMedian     129     — xếp tay ghép mạnh + yếu, nên đôi lệch nhau nhiều (p90 310)
teamGapMedian      58     ✓ trận cân (p90 146)
```

File không có `range` nên khung điểm mùa của backtest là **gộp Q3 + Q4** (buổi đầu → buổi cuối).
Điểm mùa trong mốc vẫn gác đúng công thức, nhưng **không phải** bảng Q4 trên app — muốn mốc riêng
Q4 thì xuất thêm "Mùa hiện tại".

Bộ 118 trận Q3 cũ (2026-Q3_pk-badminton) là tập con của bộ này nên đã bỏ.

---

## 9. Liên quan

- `src/__tests__/backtest/README.md` — bản ngắn, để cạnh code
- `docs/RULES.md` §0 — luật cứng
- `CLAUDE.md` — LUẬT SỐ 0 ở đầu file
