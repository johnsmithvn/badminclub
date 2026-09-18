# CHỈ SỐ & CÔNG THỨC — BÁO CÁO TOÀN BỘ

**Version:** v1.0.0 · **Updated:** 2026-09-18 · **Đối chiếu code tại commit hiện hành**

> Tài liệu này liệt kê **mọi con số** app đang tính, công thức của nó, **lưu DB hay tính lại lúc
> render**, và **cái nào ăn theo cái nào**. Mọi công thức dưới đây đọc trực tiếp từ code, không
> chép lại từ tài liệu cũ.
>
> ⚠️ `docs/HE_THONG_RATING_VA_DIEM_MUA.md` là bản cũ và **đã lệch** với code (xem §11).

---

## 0. TÓM TẮT MỘT TRANG

### 0.1. Cái gì lưu DB, cái gì tính lại

| Con số | Lưu DB? | Bảng / cột | Đổi công thức thì sao |
|---|---|---|---|
| **Elo (rating)** | ✅ **CÓ** | `player_ratings.rating` | ❗ **Phải bấm "Đồng bộ lại Elo"** |
| Số trận / thắng / thua | ✅ CÓ | `player_ratings.games_count/wins/losses` | ❗ Phải đồng bộ |
| **Elo chụp lúc vào sân** | ✅ **CÓ** | `matches.initial_rating_a/b` | ❗ Phải đồng bộ |
| eloDelta của trận | ✅ CÓ | `matches.elo_delta` | ❗ Phải đồng bộ |
| Hiệu chỉnh chéo giới | ✅ CÓ | `club_calibration` | Tự ghi lại mỗi lần lưu trận |
| Phiếu dự đoán | ✅ CÓ | `challenge_predictions` | Đã quyết toán là bất biến |
| Kệ danh hiệu (3 cái khoe) | ✅ CÓ | `club_members.badge_shelf` | Không ảnh hưởng |
| **Điểm mùa** | ❌ KHÔNG | — | ✅ Đúng ngay, không cần làm gì |
| **XP / cấp bậc** | ❌ KHÔNG | — | ✅ Đúng ngay |
| **Danh hiệu (badge)** | ❌ KHÔNG | — | ✅ Đúng ngay |
| Ăn ý cặp (synergy) | ❌ KHÔNG | — | ✅ Đúng ngay |
| Khắc chế (matchup edge) | ❌ KHÔNG | — | ✅ Đúng ngay |
| Điểm cân bằng sân | ❌ KHÔNG | — | ✅ Đúng ngay |
| Sức mạnh hiệu dụng | ❌ KHÔNG | — | ✅ Đúng ngay |
| Elo theo thể thức | ❌ KHÔNG | — | ✅ Đúng ngay |
| Suy hao nghỉ dài | ❌ KHÔNG | — | Chỉ hiện chữ, không trừ thật |

**Quy tắc một câu:** chỉ có **tầng Elo** là lưu. Mọi thứ khác dẫn xuất từ `db.matches` +
`db.playerRatings`, tính lại mỗi lần render.

### 0.2. Sơ đồ ai ăn theo ai

```
                    trận thật (sets, winnerTeam)  ─── LƯU DB
                              │
                              ▼
   trình độ khai (level) ──► ELO  ────────────────── LƯU DB
                              │   (initialRatingA/B chụp lại mỗi trận — LƯU DB)
        ┌─────────────────────┼─────────────────────┬──────────────────┐
        ▼                     ▼                     ▼                  ▼
   ĐIỂM MÙA            SỨC MẠNH HIỆU DỤNG      ĂN Ý CẶP          HIỆU CHỈNH
   (dẫn xuất)            (dẫn xuất)            (dẫn xuất)         CHÉO GIỚI
        │                     │                     │              (lưu DB)
        │                     └──────────┬──────────┘                  │
        ▼                                ▼                             ▼
   CƯỢC KÈO                      ĐIỂM CÂN BẰNG SÂN ◄────────────────────┘
   (phiếu lưu DB,                    (dẫn xuất)
    điểm dẫn xuất)

   XP ──► CẤP BẬC           (dẫn xuất, KHÔNG dính Elo, KHÔNG dính thắng thua)
   DANH HIỆU                (dẫn xuất từ trận; chỉ "kệ khoe" là lưu DB)
```

**Quan hệ then chốt:** `Elo → điểm mùa` là **một chiều**. Điểm mùa không bao giờ chảy ngược lên
Elo. Đổi thang điểm mùa thì Elo đứng yên; đổi Elo thì điểm mùa đổi theo (vì nó đọc
`initialRatingA/B`).

---

## 1. BA TRỤC ĐIỂM ĐỘC LẬP

| Trục | File | Đo cái gì | Có giảm không |
|---|---|---|---|
| **Elo** | `src/lib/rating.js` | Trình độ chuyên môn, tích luỹ vĩnh viễn | Có (sàn 0) |
| **Điểm mùa** | `src/lib/season.js` | Thành tích thi đấu trong quý, reset mỗi mùa | Có (sàn 0) |
| **XP** | `src/lib/xp.js` | Gắn bó với CLB (đi tập, thâm niên, rủ khách) | **Không bao giờ** |

XP cố ý **không hỏi thắng hay thua**. Đó là lý do có 3 file riêng, đừng trộn lại.

---

## 2. TẦNG ELO — `src/lib/rating.js` (LƯU DB)

### 2.1. Điểm hạt giống (seed) — `initialRatingOf(level, levels)`

Người mới vào CLB không bắt đầu ở 0 mà theo **trình độ khai**:

| Trình độ | Seed | Trình độ | Seed |
|---|---:|---|---:|
| Y / Yếu / newbie | 200 | TB | 500 |
| Y+ | 250 | TB+ | 650 |
| TBY− | 300 | TBK | 720 |
| TBY | 350 | Khá | 800 |
| TBY+ | 400 | Tốt / Giỏi | 1000 |
| TB− | 450 | **không khai** | **200** (`default`) |

Không tra được thì rơi vào `levelInitialRatings.default = 200`, **không phải** `DEFAULT_RATING = 0`.
Hai hằng này khác vai: `default` là "mức khởi điểm người chưa khai", `DEFAULT_RATING` là "ô trống
khi đọc map". Trước đây dùng chung nên người chưa khai vào đúng sàn 0 và được miễn mất điểm ở
những trận thua đầu.

Nếu trình độ nằm trong `db.levels` của CLB mà không khớp bảng trên, nội suy tuyến tính
**200 → 1000** theo vị trí trong thang.

### 2.2. Xác suất thắng kỳ vọng — `expectedScore(ra, rb)`

```
E(A) = 1 / (1 + 10^((Rb - Ra) / 400))
```

Elo chuẩn, hằng 400. Chênh 100 điểm ≈ 64% cửa thắng; chênh 200 ≈ 76%; chênh 400 ≈ 91%.

### 2.3. Elo của đội — `teamRating(ids, map)`

```
R_đội = round( trung bình cộng Elo các thành viên )
```

**Trung bình, không phải tổng.** Nên đôi (300 + 700) đánh ngang đôi (500 + 500).

### 2.4. Hệ số K động — `kFactorOf(gamesCount)`

| Số trận | K | Ý nghĩa |
|---|---:|---|
| 0–4 | **48** | Người mới, nhảy nhanh về đúng trình |
| 5–14 | **36** | |
| 15–29 | **28** | |
| 30–49 | **20** | |
| ≥ 50 | **16** | Kỳ cựu, điểm vững, không oan khi cõng tạ |

K là **của từng người**, không phải của trận. Trong cùng một trận, người mới và người kỳ cựu ăn
delta khác nhau.

### 2.5. Hệ số cách biệt tỷ số — `marginMultiplier(sets)`

```
avgDiff = trung bình |điểm A − điểm B| của các set có đánh
mult    = min(1.40, 1 + avgDiff / 40)
```

| Tỷ số | avgDiff | Nhân |
|---|---:|---:|
| 21–19 | 2 | 1.05 |
| 21–15 | 6 | 1.15 |
| 21–10 | 11 | 1.28 |
| 21–5 | 16 | **1.40** (kịch trần) |

> Có bản `marginMultiplierVNext(sets, 1.20, 75)` mềm hơn, nhưng **chỉ dùng để HIỂN THỊ** trong
> `MatchDetailModal.jsx`. Elo thật vẫn chạy bản 1.40 / 40.

### 2.6. Biến thiên Elo mỗi trận — `calcPlayerDeltas(...)`

```
Ra = teamRating(A),  Rb = teamRating(B)
Ea = expectedScore(Ra, Rb),  Eb = 1 − Ea
mult = marginMultiplier(sets)

delta(người i thuộc A) = round( K_i × (kếtQuả − Ea) × mult )
delta(người j thuộc B) = round( K_j × (kếtQuả − Eb) × mult )
```

`kếtQuả` = 1 nếu đội thắng, 0 nếu thua.

**Hệ quả quan trọng:** vì K khác nhau theo người, **tổng delta của trận KHÔNG bằng 0**. Người mới
thắng người kỳ cựu ăn 48/16 = gấp 3 lần số điểm đối phương mất. Đây là lý do chỉ số `eloDrift`
trong backtest không bao giờ đúng 0 tuyệt đối (đo được **−15** trên 53 trận — chấp nhận được).

### 2.7. Kẹp sàn — `applyRatingDelta(rating, delta)`

```
rating mới = max(0, rating cũ + delta)
```

**Mọi đường ghi Elo bắt buộc đi qua đây** (3 chỗ: cascade + 2 chỗ trong `appActions.js`).

Đánh đổi có ý thức: ở đúng sàn 0, người thua không mất thêm điểm trong khi đối thủ vẫn được cộng
→ Elo hết tổng-bằng-không ở biên. Chấp nhận được vì người thấp nhất CLB hiện ~179, chưa ai chạm
sàn.

### 2.8. Replay toàn bộ — `replayRatingCascade(...)` = nút **"Đồng bộ lại Elo"**

Chạy lại **mọi trận từ đầu theo thứ tự thời gian** (tie-break theo `id` để hai trận cùng
mili-giây luôn ra cùng kết quả), từ seed, qua đúng công thức hiện hành.

Ghi đè: `player_ratings` của **tất cả** hội viên + `initial_rating_a/b` + `elo_delta` của **tất
cả** trận.

Hai quy tắc trong hàm:
- **Khách giao lưu đứng yên ở seed**, không tích luỹ Elo (bảng `player_ratings` có khoá ngoại sang
  `club_members` nên điểm khách không lưu được — nếu replay cho khách trôi điểm thì Team Elo các
  trận sau lệch → Elo hội viên lệch → điểm mùa lệch theo).
- Trận `ratingEnabled = false` (đánh giao lưu) **không sinh delta**, nhưng vẫn được ghi
  `initialRatingA/B`.

> 🚨 **Trước khi bấm nút này: xuất `db.matches` ra JSON.** Cascade ghi đè `initialRatingA/B` của
> toàn bộ lịch sử, không hoàn tác được.

### 2.9. Phân hạng — `rankTierOf(rating)`

| Hạng | Khoảng Elo | Hạng | Khoảng Elo |
|---|---|---|---|
| novice | 0–199 | net_master | 800–999 |
| rookie | 200–399 | coverage | 1000–1199 |
| regular | 400–599 | heavy_hitter | 1200–1399 |
| solid | 600–799 | court_boss | ≥ 1400 |

`progress` = phần trăm trong dải hiện tại. 4 bộ tên (street / comedy / destroyer / slang) chỉ đổi
chữ, không đổi số.

### 2.10. Độ tin cậy — hai hàm, **cùng mốc 5 / 15 / 30**

| Số trận | `confidenceOf` (tầng Elo) | `confidenceLevelOf` (tầng cặp) | Trọng số |
|---|---|---|---:|
| < 5 | `low` | R1 ●○○○ | **0.0** |
| 5–14 | `medium` | R2 ●●○○ | **0.5** |
| 15–29 | `high` | R3 ●●●○ | 1.0 |
| ≥ 30 | `very_high` | R4 ●●●● | 1.0 |

Cả hai hàm **chỉ đọc số trận**. `confidenceOf` từng có nhánh thứ hai ăn theo `deviation` (độ lệch
chuẩn kiểu Glicko) — nhánh đó đã **xoá** vì app không tính độ lệch ở đâu cả; cột
`player_ratings.rating_deviation` cũng đã bỏ (migration 0045).

### 2.11. Suy hao nghỉ dài — `applyInactivityDecay(...)` ⚠️ **CHỈ HIỂN THỊ**

```
< 30 ngày   → bình thường
30–44 ngày  → gắn nhãn "tạm nghỉ", decay = 0
≥ 45 ngày   → trừ 10 điểm cho mỗi chu kỳ 30 ngày, sàn 0
```

**Hàm này không ghi vào đâu cả.** Nó chỉ được gọi ở `MemberProfileTab.jsx:354` để hiện chữ trên
hồ sơ. Elo thật trong `player_ratings` **không bị trừ**. Cần quyết định: nối vào thật, hay bỏ hẳn.

### 2.12. Hiệu chỉnh chéo giới — `computeClubCalibration(...)` (LƯU DB)

Chia trận có cả nam và nữ vào 3 rổ theo chênh Elo hai đội: `<100`, `100-300`, `>300`.

Đếm thắng của phía nữ:
- **Kèo lệch giới** (đội có nữ gặp đội toàn nam): thắng = 1
- **Đôi nam nữ chuẩn** (1M1F vs 1M1F): mặc định **+0.5** (một nữ thắng, một nữ thua)
- Còn lại (2 nữ vs 1 nam 1 nữ…): bên nhiều nữ hơn thắng = 1

```
nếu pureCount ≥ 5:
    learnedAdjustment = round( (pureWins/pureCount − 0.5) × 200 )
ngược lại nếu sampleSize ≥ 5 và asymmetricCrossCount ≥ 5:
    learnedAdjustment = round( (winRate − 0.5) × 200 )
ngược lại: 0
```

Ghi vào `club_calibration` mỗi lần lưu / sửa / xoá trận.

**Lưu ý:** `learnedAdjustment` **không đụng vào Elo**, cũng không đụng vào điểm mùa. Nó chỉ dùng ở
màn Chia sân để nói "kèo này thực chất lệch hơn con số Elo thô". Xem §5.6.

---

## 3. TẦNG ĐIỂM MÙA — `src/lib/season.js` (DẪN XUẤT, KHÔNG LƯU)

Header file ghi rõ: *"Toàn bộ là hàm DẪN XUẤT: không bảng DB nào lưu điểm mùa, tính lại từ
`db.matches`."*

### 3.1. Điểm khởi đầu

```
startPoints = 100     (app.json → season.startPoints)
```

Chỉ cấp cho người **đã ra sân ít nhất 1 trận trong mùa**. Người chưa đánh = 0.

Nó **không đổi thứ hạng** (cộng cùng hằng số cho tất cả). Việc nó làm là **đẩy sàn 0 ra xa**: với
100 điểm đệm, người thắng từ ~25% trở lên không bao giờ chạm sàn, nên điểm không còn sinh ra từ
hư không.

### 3.2. Thang 5 dải — `calcSeasonMatchDelta(teamElo, oppElo, won)`

```
gap = round(Elo đội mình − Elo đội đối thủ)      ← đọc matches.initialRatingA/B
```

| Dải | Điều kiện | Thắng | Thua |
|---|---|---:|---:|
| `heavyFavored` | gap ≥ 150 | **+10** | **−12** |
| `favored` | 50 ≤ gap < 150 | **+12** | **−10** |
| `balanced` | −49 ≤ gap < 50 | **+14** | **−8** |
| `underdog` | −149 ≤ gap < −49 | **+17** | **−5** |
| `deepUnderdog` | gap < −149 | **+22** | **−3** |

Ngưỡng đọc từ `minGap` trong `app.json`, không hard-code — sửa config là đổi được luật chơi.

Cả hai người cùng đội nhận **cùng delta**.

> 📊 **Đo trên dữ liệu thật (53 trận):** chênh đội median 42, p90 94, **max 123**. Nghĩa là
> `heavyFavored` và `deepUnderdog` **chưa bao giờ chạy một lần nào**. Thực tế chỉ có 3 dải hoạt
> động: balanced 120 trận · favored 42 · underdog 38.

### 3.3. Thưởng

| Thưởng | Điều kiện | Điểm |
|---|---|---:|
| `streak3` | Chạm **đúng** trận thắng thứ 3 liên tiếp | +5 |
| `streak5` | Chạm **đúng** trận thắng thứ 5 liên tiếp | +10 |
| `upset150` | Thắng đội có Elo cao hơn **≥ 150** | +5 |

Chuỗi reset về 0 khi thua. Thắng trận thứ 4, 6, 7… **không** thưởng thêm (chỉ mốc 3 và 5).

> 📊 Ngưỡng upset 150 > chênh đội tối đa 123 → **`totalUpsets = 0`**, thưởng lật kèo chưa từng
> phát một lần. Đang chờ user quyết có hạ xuống ~90 không.

### 3.4. Sàn 0 và thứ tự

```
sau MỖI trận:  điểm = max(0, điểm + delta + thưởng)
```

Vì kẹp sau **mỗi** trận, phép tính **phụ thuộc thứ tự**: thua-rồi-thắng ≠ thắng-rồi-thua khi gần
sàn. Nên bắt buộc sắp xếp theo `at` và tie-break theo `id`.

> 📊 Trước khi có `startPoints`, sàn này tạo ra **+201 điểm từ hư không** = 21.8% của 921 điểm
> hiển thị, cho 11/22 người. Sau khi thêm 100 điểm đệm → **0**.

### 3.5. Điểm cược kèo

```
rawNet = tổng phiếu thắng − tổng phiếu thua  (chỉ phiếu quyết toán TRONG mùa, theo settledAt)
predictionNet = min(15, rawNet)               ← CHỈ chặn chiều thắng
điểm cuối = max(0, điểmTrận + predictionNet)
```

**Trần +15 chỉ một chiều là cố ý.** Trước đây kẹp đối xứng `[−15, +15]`, và cái sàn đó là lỗ hổng
cược miễn phí: chạm −15 rồi thì thua thêm không mất gì trong khi thắng vẫn cộng. Bỏ sàn thì thua
trừ thật, và luật "hết điểm là không được cược" mới có răng.

Trần thắng giữ để bảng xếp hạng vẫn là bảng **thi đấu** — không ai leo hạng bằng cách ngồi ngoài
đoán kèo.

### 3.6. Điều kiện xếp hạng

| Nhãn | Điều kiện |
|---|---|
| **Qualified** | ≥ **8** trận tính rating trong mùa (`minMatchesOfficial`) |
| **Inactive** | Đã đánh ≥ 1 trận nhưng > **21** ngày không ra sân (`inactiveDays`) |

**Thứ tự xếp hạng:** (1) Qualified đứng trên chưa qualified → (2) điểm mùa giảm dần →
(3) số trận thắng → (4) tỷ lệ thắng.

Ưu tiên (1) là cơ chế **chống ôm rank**: đánh 3 trận thắng cả 3 (100 + 14×3 + 5 thưởng chuỗi
= 147đ) không được đứng trên người đã cày 25 trận.

> Ngưỡng này **hạ từ 20 xuống 8 ngày 2026-09-18**. Đo trên mô phỏng một mùa đầy đủ: ở mốc 20, cái
> cổng đẩy nhầm người xứng đáng top 5 xuống dưới trong **19.2%** số lần, mà chỉ chặn ôm rank được
> từ 1.4% xuống 1.0% — đổi chác quá tệ. Ở mốc 8, đẩy nhầm còn **2.2%** mà vẫn chặn ôm rank ở 0.7%.
> Nhóm đi 2 buổi/tháng (≈14 trận/mùa) từ chỗ chỉ 11% đủ điều kiện lên **95%**.
>
> Đặt `minMatchesOfficial: 0` là **tắt hẳn** cổng này.

### 3.7. Trận giao lưu (`ratingEnabled = false`)

- Không sinh điểm mùa
- Không tính vào mốc 8 trận
- **Không cắt đứt chuỗi thắng** đang treo thưởng
- Vẫn tính là "có mặt buổi đó"

### 3.8. Vua Lì Đòn — `getSeasonBountyPlayer(db)`

Người đang giữ **chuỗi thắng ĐANG CHẠY** dài nhất CLB, tối thiểu 3 trận. Đếm ngược từ trận mới
nhất, bỏ qua trận giao lưu.

---

## 4. TẦNG CHỈ SỐ CẶP & ĐỐI ĐẦU (DẪN XUẤT, KHÔNG LƯU)

Nguyên tắc chung của cả tầng này: **Thực tế − Kỳ vọng**, đơn vị **pp** (điểm phần trăm), rồi co
cụm về mức trung tính 50 khi ít trận (Bayesian shrinkage).

### 4.1. Ăn ý cặp — `calcPairImpact` + `normalizeSynergyScore`

```
Với mỗi trận cặp này đánh CÙNG NHAU:
    kỳ vọng = expectedScore(initialRatingA, initialRatingB)   ← lấy vế của mình

actualRate   = (số trận thắng / số trận) × 100
expectedRate = (tổng kỳ vọng / số trận) × 100
pairImpact   = round(actualRate − expectedRate)        ← trừ TRƯỚC, làm tròn SAU
```

Quy ra **Điểm ăn ý** (thang 10–99, trung tính 50):

```
c    = min(1, số trận / 15)                     ← shrinkGames
mult = 2.41 nếu pairImpact ≥ 0, ngược lại 0.7   ← KHÔNG đối xứng, cố ý
ăn ý = clamp(10, 99, round(50 + pairImpact × mult × c))
```

| pairImpact | Số trận | Điểm ăn ý |
|---:|---:|---:|
| +17pp | 18 | 91 |
| +17pp | 5 | 64 |
| −17pp | 15 | 38 |

Bất đối xứng ×2.41 / ×0.7 nghĩa là **thưởng ăn ý đậm gấp 3.4 lần phạt lệch sóng**. Đây là quyết
định thiết kế (user đã xác nhận giữ), không phải lỗi.

**Xu hướng** — `calcSynergyTrend`: so 5 trận gần nhất với toàn bộ trận trước đó.
Chênh ≥ +15% → `up`; ≤ −15% → `down`; còn lại `steady`. Dưới 5 trận luôn `steady`.

### 4.2. Khắc chế / kỵ giơ — `calcMatchupEdge(pairA, pairB)`

Cùng công thức nhưng đo **cặp A gặp cặp B**, và **có hướng** (A khắc B ≠ B khắc A).

```
matchupImpact = round(actualRate − expectedRate)
c             = min(1, số trận / 10)             ← shrinkGames 10, KHÁC synergy (15)
lợi thế       = clamp(10, 99, round(50 + matchupImpact × 1.2 × c))
```

Cũng trả `avgScoreDiff` = chênh điểm trung bình **mỗi set**, đọc theo đúng vế của cặp A.

> **H2H ≠ Matchup.** H2H chỉ ghi lịch sử (ai thắng bao nhiêu). Matchup đo **lợi thế so với kỳ
> vọng Elo**.

### 4.3. Bảng xếp hạng cặp — `rankPairs(...)`

Phân loại thể thức: **MD** (2 nam) · **WD** (2 nữ) · **XD** (1 nam 1 nữ).

Sắp xếp: cặp R1 (< 5 trận) bị đẩy xuống cuối → điểm ăn ý giảm dần → số trận giảm dần.
"Cặp đỉnh" và "cặp lệch sóng" chỉ lấy từ nhóm ≥ 5 trận.

### 4.4. Elo theo thể thức — `getPlayerFormatRatings(...)`

Không phải Elo thật. Là **ước lượng** từ tỷ lệ thắng của thể thức đó, co về Elo sự nghiệp:

```
rawDelta = (winRate − 0.5) × 300
weight   = min(0.85, số trận / 30)
rating   = round( careerElo + rawDelta × weight )
```

Chia 3 rổ: `doubles` (mọi trận đôi) · `mixed` (đội mình có cả nam lẫn nữ — **rổ con của doubles**)
· `singles`. `career` / `overall` = **chính Elo thật**, không ước lượng.

### 4.5. Sức mạnh hiệu dụng — `effectiveStrengthOf(elo, seed, games)`

Dùng **cho xếp sân**, không dùng cho bảng xếp hạng. Co Elo về seed khi ít trận:

| Số trận | Công thức |
|---|---|
| < 5 | `seed × 0.60 + elo × 0.40` |
| 5–14 | `seed × 0.35 + elo × 0.65` |
| 15–29 | `seed × 0.15 + elo × 0.85` |
| ≥ 30 | `elo` (100%) |

Chống overfit: người mới thắng may 3 trận không lập tức bị xếp vào sân cao thủ.

---

## 5. TẦNG CHIA SÂN — `src/lib/assign.js` (DẪN XUẤT, KHÔNG LƯU)

### 5.1. Điểm cân bằng sân — `detailedCourtBalance(...)`

**Điểm tổng = 4 tiêu chí, thang 100:**

```
Tổng = CânElo × 55%  +  ĐềuLượt × 20%  +  ĐổiPartner × 15%  +  ĐổiĐốiThủ × 10%
```

> ⚠️ **H2H và Ăn ý KHÔNG cộng vào điểm tổng.** Chúng chỉ hiển thị tham khảo (nhóm `[MỚI]` theo
> cam kết UI). Trong `breakdown`, `matchup` luôn = 0.

#### Tiêu chí 1 — Cân Elo (55%)

```
synergyBonus = clamp(−35, 35, round(pairImpact × 1.2 × confidence.weight))
                                              ↑ 1.2 KHÁC hệ số 2.41/0.7 của điểm ăn ý hiển thị
Ra = rawRa + synergyBonusA        (rawRa = trung bình Elo đội A, hoặc effectiveRating nếu chéo giới)
Rb = rawRb + synergyBonusB

expectedGapPp  = round(|E(A) − E(B)| × 100)
CânElo         = clamp(0, 100, 100 − expectedGapPp)
```

Cặp đã đánh cùng nhau < 5 trận → bonus = 0. R1 (< 5 trận) có `weight = 0` nên cũng ra 0.

**Điểm này là thang xác suất, không phải thang Elo.** 50/50 → 100đ; 70/30 → 60đ; 90/10 → 20đ.

#### Tiêu chí 2 — Đều lượt đánh (20%)

```
waitDiff  = max(0, số trận nhiều nhất của người TRÊN SÂN − số trận ít nhất của người ĐANG CHỜ)
ĐềuLượt   = clamp(0, 100, 100 − waitDiff × 14)
```

Hệ số **14** (không phải 6). Đây là chỗ sửa BUG-08: với bước 6 và nhiễu ±2.5, các phương án xếp
sân gần như y hệt nhau; đổi lên 14 (nhiễu ±7 > bước 6) thì tỷ lệ phương án khác biệt đi từ 0% lên
99%.

#### Tiêu chí 3 — Đổi partner (15%)

```
ĐổiPartner = clamp(10, 100, 100 − (số lần cặp này đã đánh cùng nhau TRONG BUỔI) × 12)
```

#### Tiêu chí 4 — Đổi đối thủ (10%)

```
ĐổiĐốiThủ = clamp(10, 100, 100 − (số lần hai đội đã gặp nhau TRONG BUỔI) × 15)
```

#### Chỉ số tham khảo — H2H (0%, không vào tổng)

```
độ chênh của TRẬN = trung bình |sa − sb| các set     ← đếm theo TRẬN, không theo set
sát nút   : ≤ 3   (closeMatchMaxDiff)   → +5
vỡ trận   : ≥ 12  (blowoutMinDiff)      → −8

H2H = clamp(40, 100, 88 + sátNút × 5 − vỡTrận × 8)
```

Nền **88 dùng cho cả hai nhánh**. Trước đây "chưa gặp nhau" là 88 còn "đã gặp" là 80, nên chỉ cần
đánh một trận tỷ số bình thường là điểm tụt 88 → 80 — hai người chưa từng gặp được chấm cao hơn
hai người đã gặp, vô lý.

### 5.2. Nhãn độ cân (chỉ là chữ, không phải điểm)

| Nơi dùng | Ngưỡng cân | Ngưỡng lệch nhiều |
|---|---:|---:|
| Chung (`evalBalance`) | ≤ 120 | > 250 |
| Màn Chia sân | ≤ 80 | > 200 |

Màn Chia sân đặt thấp hơn vì nó đo bằng rating **đã hiệu chỉnh chéo nam-nữ**, khoảng cách bị thu
hẹp so với rating thô.

### 5.3. Bảng công bằng lượt đánh — `sessionFairnessRows(db, sessionId)`

```
phầnĐángHưởng = 4 / tổng số người điểm danh        (playersPerCourt)
kỳVọng        = tổng số trận của buổi × phầnĐángHưởng
lệch (debt)   = round((kỳVọng − số trận đã đánh) × 10) / 10     ← dương = đang bị thiệt
chờ           = số trận đã kết thúc ở BẤT KỲ sân nào kể từ lần cuối rời sân
```

Danh sách người lấy **nguyên từ điểm danh**, không suy từ lineup. App không lưu giờ đến / giờ về,
nên ai đã điểm danh coi như có mặt cả buổi.

Chỉ để **tham khảo** — không chặn ai, không tự đẩy ai lên sân.

### 5.4. Nhãn công bằng nhanh — `fairness(players, stats)`

`max − min ≤ 1` (`fairnessThreshold`) → xanh "đều"; ngược lại vàng "lệch".

### 5.5. Xếp sân tự động — `arrange({mode})`

| Mode | Cách xếp |
|---|---|
| `balance` | Sắp theo **trình độ khai** giảm dần, rồi ghép **mạnh nhất + yếu nhất** vào cùng đôi |
| `fewest` | Ưu tiên người ít trận nhất, rồi ít phút nhất, rồi ngẫu nhiên |
| `rest` | Giữ nguyên người đang trên sân, lấp chỗ trống theo `fewest` |
| `same` | Theo trình độ, xếp tuần tự từng sân (mạnh chung sân mạnh) |
| `random` | Xáo hoàn toàn |

> ⚠️ Mode `balance` dùng **`levelIdx` (thứ tự trình độ khai)**, KHÔNG dùng Elo. Đây là hai nguồn
> khác nhau cho cùng một việc.
>
> 📊 Đo trên dữ liệu thật: `fillPairs` trên cùng bộ 4 người cho kết quả ≈ y hệt cách quản trò ghép
> tay (pairGap median 76 vs 76).

### 5.6. Hiệu chỉnh chéo giới lúc chia sân

Màn Chia sân gọi `effectiveTeamRating()` trong `rating.js` — hiệu chỉnh áp cho **từng người**
rồi mới lấy trung bình đội, đúng đơn vị của `learnedAdjustment`:

```
mỗi người:  rating + learnedAdjustment   (chỉ nữ, chỉ khi đội đối phương toàn nam)
đội:        trung bình cộng các rating đã hiệu chỉnh
```

Hệ quả theo cấu hình đội (giả sử `learnedAdjustment = −40`):

| Đội | Mức dịch của rating đội |
|---|---:|
| 1 nam 1 nữ vs 2 nam | **−20** (một nửa) |
| 2 nữ vs 2 nam | **−40** (trọn) |
| 2 nam | 0 |

Chỉ áp dụng khi rổ `100-300` có **≥ 15 trận mẫu thật**; chưa đủ thì không dịch điểm của ai.

> Trước đây chỗ này cộng thẳng `learnedAdjustment × 2` vào rating **ĐỘI** — với đội 1 nam 1 nữ
> là **gấp bốn** con số CLB học được — và khi chưa có dữ liệu thì rơi vào một bộ số bịa sẵn
> (40 trận mẫu, hệ số 38) vượt luôn cổng ≥ 15. Đã sửa cả hai.

---

## 6. TẦNG XP — `src/lib/xp.js` (DẪN XUẤT, KHÔNG LƯU)

```
XP = số buổi có mặt × 50
   + số trận đã đánh × 10
   + số tháng tròn thâm niên × 20
   + số khách tự rủ × 25

Cấp bậc = floor(XP / 600) + 1
```

| Cấp | Danh xưng | Cấp | Danh xưng |
|---|---|---|---|
| ≥ 25 | Cao thủ | ≥ 10 | Quen sân |
| ≥ 20 | Hảo thủ | ≥ 5 | Tập sự |
| ≥ 15 | Thực chiến | 1–4 | Tân thủ |

**XP không bao giờ hỏi thắng thua và không bao giờ giảm.** "Số buổi có mặt" dùng `isPresent` — nên
người `noshow` (nghỉ không báo, vẫn thu tiền) **không** được XP.

---

## 7. TẦNG CƯỢC KÈO — `src/lib/challenge.js`

| Con số | Lưu DB? | Công thức |
|---|---|---|
| Phiếu cược | ✅ `challenge_predictions` | `stakePoints`, `team`, `status`, `settledAt` |
| Tỷ lệ pool | ❌ | `pctA = pointsA / totalPoints × 100`, hoà 50/50 nếu chưa ai cược |
| Tiền thắng | ✅ (cột `payout_points`) | thắng = `stake × 2`, thua = 0 |
| Điểm đang bị giam | ❌ | tổng `stakePoints` của phiếu `pending` trên kèo còn sống |
| Điểm được cược | ❌ | `max(0, điểmMùa − đangBịGiam)` |

Cổng cược đóng ngay khi ghi xong hiệp đầu tiên (`predictionsLocked`) — nếu không, khán giả xem
xong hiệp 1 biết tỷ số rồi mới đặt.

`settlePredictionsLocal` phải khớp **từng dòng** với RPC `settle_challenge_predictions` trong
migration 0042 — đó chỉ là bản cập nhật lạc quan cho màn hình, sự thật nằm ở DB.

---

## 8. TẦNG DANH HIỆU — `src/lib/badges.js` (DẪN XUẤT)

Toàn bộ điều kiện mở khoá tính lại từ `db.matches` mỗi lần render. **Không có bảng nào lưu danh
hiệu đã mở.** Thứ duy nhất lưu là `club_members.badge_shelf` — 3 danh hiệu người dùng chọn để
khoe trên hồ sơ.

Hệ quả: đổi điều kiện danh hiệu → **hiệu lực ngay**, và danh hiệu ai đó "đã có" có thể **biến
mất** nếu điều kiện siết lại.

---

## 9. BẢNG DB ĐẦY ĐỦ (liên quan điểm số)

| Bảng | Cột | Ai ghi |
|---|---|---|
| `player_ratings` | `rating`, `games_count`, `wins_count`, `losses_count`, `confidence_label` | `saveMatchScore` (từng trận) + `replayRatingCascade` (toàn bộ) |
| `matches` | `initial_rating_a`, `initial_rating_b`, `elo_delta` | như trên |
| `matches` | `sets`, `winner_team`, `rating_enabled`, `score_text` | `saveMatchScore` |
| `matches` | `bounty_broken`, `broken_streak` | `saveMatchScore` |
| `match_players` | 4 dòng mỗi trận (ai, đội nào) | `saveMatchScore` |
| `club_calibration` | `bucket`, `sample_size`, `observed_win_rate`, `learned_adjustment` | mỗi lần lưu/sửa/xoá trận |
| `challenge_predictions` | `stake_points`, `team`, `status`, `settled_at`, `payout_points` | RPC 0042 |
| `club_members` | `badge_shelf` | người dùng chọn |
| `attendances` | `state` (`true` / `extra` / `noshow` / `false`) | màn điểm danh |

---

## 10. ĐỔI CÔNG THỨC THÌ PHẢI LÀM GÌ

| Đổi cái gì | Cần đồng bộ? | Cần chạy backtest? |
|---|---|---|
| `season.deltaScale`, `startPoints`, `bonusConfig` | ❌ Không | ✅ **CÓ** |
| `rating.kDynamic`, `marginOfVictory`, `levelInitialRatings` | ✅ **"Đồng bộ lại Elo"** | ✅ **CÓ** |
| `rating.minRating` / logic `applyRatingDelta` | ✅ **"Đồng bộ lại Elo"** | ✅ **CÓ** |
| `rating.synergy`, `rating.matchup` | ❌ Không | ❌ (không vào baseline) |
| Trọng số điểm cân bằng sân, H2H | ❌ Không | ❌ |
| `xp.*` | ❌ Không | ❌ |
| Điều kiện danh hiệu | ❌ Không | ❌ |

> 🚨 **LUẬT SỐ 0** — hai dòng đầu bảng trên bắt buộc chạy
> `npm run backtest -- <data> --vs <baseline>`, **đọc từng dòng diff**, báo số, xin phép, rồi mới
> `--save`. Chi tiết: `docs/BACKTEST.md`.

---

## 11. NHỮNG CHỖ ĐANG KHÔNG ỔN (chưa sửa, cần quyết)

| # | Vấn đề | Ở đâu | Tác động |
|---|---|---|---|
| 1 | **2 dải điểm mùa chưa bao giờ chạy** — chênh đội max 123 < ngưỡng 150 | `app.json` `deltaScale` | `heavyFavored`, `deepUnderdog` là code chết trên thực tế |
| 2 | **Thưởng lật kèo chưa phát lần nào** — `upsetMinGap 150` > max 123 | `app.json` `bonusConfig` | Tính năng có mà không chạy. Cân nhắc hạ ~90 |
| 3 | **Thua đậm và thua sát nút trừ như nhau** | `calcSeasonMatchDelta` bỏ qua `sets` | User đã nêu "thua đau trừ nhiều" — chưa làm |
| 4 | **Suy hao nghỉ dài không trừ thật** | `applyInactivityDecay` chỉ dùng để hiện chữ | Hiển thị nói một đằng, DB một nẻo |
| ~~5~~ | ~~`rating_deviation` luôn = 350~~ | — | ✅ **ĐÃ SỬA** — xoá nhánh chết trong `confidenceOf`, bỏ cột (migration 0045) |
| ~~6~~ | ~~Bảng `player_rating_context` chết~~ | — | ✅ **ĐÃ SỬA** — DROP TABLE (migration 0045) |
| ~~7~~ | ~~Hệ số ×2 ma thuật ở hiệu chỉnh chéo giới~~ | — | ✅ **ĐÃ SỬA** — dùng chung `effectiveTeamRating()`, bỏ số bịa khi thiếu dữ liệu (xem §5.6) |
| 8 | **Hai mô hình co cụm khác nhau** — synergy dùng `min(1, g/15)` liên tục, còn bonus xếp sân dùng bậc thang `0 / 0.5 / 1` | `rating.js` vs `assign.js` | Cùng một cặp cho hai con số khác nhau ở hai màn |
| 9 | **Xếp sân mode `balance` dùng trình độ khai, không dùng Elo** | `assign.js` `arrange` | Hai nguồn sự thật cho cùng một việc |
| 10 | **Tổng delta Elo mỗi trận ≠ 0** vì K khác nhau theo người | `calcPlayerDeltas` | `eloDrift −15` / 53 trận. Chấp nhận được, nhưng phải biết |
| 11 | **`docs/HE_THONG_RATING_VA_DIEM_MUA.md` đã lệch code** | doc cũ | Ghi trọng số 35/20/15/15/15 (nay 55/20/15/10), công thức `100 − Δ/50×6` (nay `100 − expectedGapPp`), còn tả `arrangeBestOfN` (đã xoá), thiếu `startPoints` |

---

## 12. LIÊN QUAN

- `docs/BACKTEST.md` — cách kiểm chứng khi đổi công thức
- `docs/RULES.md` §0 — luật cứng về baseline
- `src/config/app.json` — mọi hằng số ở trên
- `src/__tests__/backtest/` — dữ liệu thật + mốc số
