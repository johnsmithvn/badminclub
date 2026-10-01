# CHỈ SỐ & CÔNG THỨC — BÁO CÁO TOÀN BỘ

**Version:** v2.0.0 · **Updated:** 2026-09-30 · **Đối chiếu code tại commit hiện hành**

> Tài liệu này liệt kê **mọi con số** app đang tính, công thức của nó, **lưu DB hay tính lại lúc
> render**, và **cái nào ăn theo cái nào**. Mọi công thức dưới đây đọc trực tiếp từ code, không
> chép lại từ tài liệu cũ.
>
> ⚠️ `docs/HE_THONG_RATING_VA_DIEM_MUA.md` là bản cũ và **đã lệch** với code (xem §13).

---

## 0. TÓM TẮT MỘT TRANG

### 0.1. Cái gì lưu DB, cái gì tính lại

| Con số / Thực thể | Lưu DB? | Bảng / cột | Đổi công thức thì sao |
|---|---|---|---|
| **Elo (rating)** | ✅ **CÓ** | `player_ratings.rating` | ❗ **Phải bấm "Đồng bộ lại Elo"** |
| Số trận / thắng / thua | ✅ CÓ | `player_ratings.games_count/wins/losses` | ❗ Phải đồng bộ |
| **Elo chụp lúc vào sân** | ✅ **CÓ** | `matches.initial_rating_a/b` | ❗ Phải đồng bộ |
| eloDelta của trận | ✅ CÓ | `matches.elo_delta` | ❗ Phải đồng bộ |
| Hiệu chỉnh chéo giới | ✅ CÓ | `club_calibration` | Tự ghi lại mỗi lần lưu trận |
| Phiếu dự đoán kèo | ✅ CÓ | `challenge_predictions` | Đã quyết toán là bất biến |
| Kệ danh hiệu (3 cái khoe) | ✅ CÓ | `club_members.badge_shelf` | Không ảnh hưởng |
| Châm ngôn cá nhân | ✅ CÓ | `club_members.signature` | Người dùng tự sửa |
| Mùa giải & Đóng băng BXH | ✅ CÓ | `clubs.seasons jsonb` (`podiumSnapshot`) | Lưu lịch sử khi hết mùa |
| Đăng ký Web Push PWA | ✅ CÓ | `push_subscriptions` | Thiết bị tự đăng ký |
| **Kết quả trận Giải đấu** | ✅ **CÓ** | `tournament_matches.sets/winner` | 🔒 **Cách ly hoàn toàn khỏi Elo/SP CLB** |
| Thứ hạng bảng Giải đấu | ✅ CÓ | `tournament_group_teams.final_rank` | BTC chốt hoặc bốc thăm |
| **Điểm mùa (Season Points)** | ❌ KHÔNG | — | ✅ Đúng ngay, không cần làm gì |
| **XP / cấp bậc** | ❌ KHÔNG | — | ✅ Đúng ngay |
| **Danh hiệu (badge)** | ❌ KHÔNG | — | ✅ Đúng ngay |
| **Chỉ số cá nhân MyStats** | ❌ KHÔNG | — | ✅ Đúng ngay (Elo tuần, Form 5, Kình địch) |
| Ăn ý cặp (synergy) | ❌ KHÔNG | — | ✅ Đúng ngay |
| Khắc chế (matchup edge) | ❌ KHÔNG | — | ✅ Đúng ngay |
| Điểm cân bằng sân | ❌ KHÔNG | — | ✅ Đúng ngay |
| Sức mạnh hiệu dụng | ❌ KHÔNG | — | ✅ Đúng ngay |
| Elo theo thể thức | ❌ KHÔNG | — | ✅ Đúng ngay |
| Suy hao nghỉ dài | ❌ KHÔNG | — | Chỉ hiện chữ, không trừ thật |

**Quy tắc một câu:** Chỉ có **tầng Elo CLB** và **dữ liệu Giải đấu** là lưu DB. Mọi thứ khác trên BXH
thường dẫn xuất từ `db.matches` + `db.playerRatings`, tính lại mỗi lần render.

### 0.2. Sơ đồ ai ăn theo ai

```
                    trận thường (sets, winnerTeam)  ─── LƯU DB
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
         ├──────────────────────────┐     ▼                             ▼
         ▼                          ▼  ĐIỂM CÂN BẰNG SÂN ◄──────────────┘
    CƯỢC KÈO                 CHỈ SỐ MYSTATS
    (phiếu lưu DB,           (Form 5, Kình địch,
     điểm dẫn xuất)           đua tuần dẫn xuất)

    XP ──► CẤP BẬC           (dẫn xuất, KHÔNG dính Elo, KHÔNG dính thắng thua)
    DANH HIỆU ANIME          (dẫn xuất từ trận; chỉ "kệ khoe" là lưu DB)

    ════════════════════════════════════════════════════════════════════════════
    PHÂN HỆ GIẢI ĐẤU (16 bảng tournament_* — CÁCH LY HOÀN TOÀN KHỎI ELO / ĐIỂM MÙA)
    trận giải ──► tỉ số / winner ──► BXH bảng (BWF / Thụy Sĩ) ──► Cây Bracket
    (LƯU DB)       (LƯU DB)          (tính & chốt final_rank)      (LƯU DB)
```

**Quan hệ then chốt:** `Elo → điểm mùa` là **một chiều**. Điểm mùa không bao giờ chảy ngược lên
Elo. Đổi thang điểm mùa thì Elo đứng yên; đổi Elo thì điểm mùa đổi theo (vì nó đọc
`initialRatingA/B`). Phân hệ Giải đấu **độc lập tuyệt đối**, không làm biến động Elo hay điểm mùa
của hội viên.
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
trong backtest không bao giờ đúng 0 tuyệt đối (đo được **+82** trên 118 trận Q3, ≈ +0.7/trận — chấp nhận được).

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

> 📊 **Đo trên dữ liệu thật (118 trận, trọn Q3):** chênh đội median 45, p90 113, **max 200**.
> `heavyFavored` và `deepUnderdog` **hiếm khi chạy** (5 và 4 lượt). Gần như chỉ có 3 dải hoạt
> động: balanced 220 lượt · favored 91 · underdog 86.
>
> **Vì sao chung một delta cho cả đội, không tính riêng từng người:** xác suất thắng là của ĐỘI.
> Giả lập 2026-09-29 tính riêng (gap = Elo mình − Elo TB đội bạn) trên 118 trận: CLB xếp tay ghép
> mạnh + yếu nên chênh cá nhân rất lớn (median 76, p90 206) trong khi chênh đội nhỏ → người yếu
> luôn rơi vào dải kẻ yếu dù đội họ có cửa 50/50. Nhóm Y/Y+ tăng từ 3.5 lên 5.6đ/trận, nhóm TB tụt
> từ 4.7 xuống 3.8, người thua 10–19 nhảy từ hạng 11 lên hạng 5. Được cõng hoá ra có lãi.

### 3.3. Hệ số KÈO (`challengeMultiplier`)

Trận sinh từ **kèo** (`matches.challengeId` có giá trị, hoặc `sourceType = 'challenge'`) được
nhân delta điểm mùa với `app.json → season.challengeMultiplier` (**hiện = 2**).

```
delta = round(delta_dải × challengeMultiplier)    ← CHỈ điểm mùa
```

| | Kèo | Trận thường |
|---|---|---|
| **Elo** | tính bình thường, công thức y hệt | tính bình thường |
| **Điểm mùa** | delta **×2** | delta ×1 |

**`rating.js` không biết trận đến từ đâu và cố ý giữ như vậy** — hệ số này thuần điểm mùa.

Hệ số **phẳng**: mọi kèo, cả hai bên, thắng lẫn thua đều cùng một số. Bản thiết kế đầu có hệ số
riêng cho bên gạ / bên bị gạ (×2,5 khi kẻ yếu thắng, ×1,0 khi kẻ yếu thua) nhưng đã bỏ vì:

1. Dải Elo ở §3.2 **đã** ưu ái kẻ yếu sẵn (+22 so với +14) — thêm tầng nữa là ưu ái hai lần chồng
   nhau, đẩy một kèo thắng lên +110 trong khi vốn đầu mùa chỉ có 100.
2. Hệ số thắng/thua lệch nhau đẻ ra lỗ hổng: kèo BO3 **thua** 1−2 vẫn ra tổng **dương** (+49), nên
   gạ kèo với người mạnh nhất CLB rồi thua cũng có lãi.

Hệ số áp cho **từng set**, nên kèo BO3 thắng 2−0 ăn gấp đôi BO1 thắng. Đây là chủ đích (kích cầu
điểm mùa), không phải sót.

> ⚠️ **Bộ backtest không phủ được phần này** — `src/__tests__/backtest/data/` không có trận nào
> mang `challengeId`, nên đổi hệ số vẫn để backtest xanh. Lưới gác là
> `src/__tests__/lib/season_challenge_multiplier.test.js`.

### 3.4. Thưởng

| Thưởng | Điều kiện | Điểm |
|---|---|---:|
| `streak3` | Chạm **đúng** trận thắng thứ 3 liên tiếp | +5 |
| `streak5` | Chạm **đúng** trận thắng thứ 5 liên tiếp | +10 |
| `upset150` | Thắng đội có Elo cao hơn **≥ 150** | +5 |

Chuỗi reset về 0 khi thua. Thắng trận thứ 4, 6, 7… **không** thưởng thêm (chỉ mốc 3 và 5).

**Chuỗi đếm theo KÈO, không theo set.** Một kèo BO3 thắng 2−1 cộng **một** vào chuỗi, không phải
hai. Thua chuỗi thì chuỗi về 0 dù có thắng set lẻ bên trong. Thiếu quy tắc này thì BO3 thành
đường cày mốc thưởng 3/5.

Luật này nằm ở **một chỗ dùng chung**: `collapseChallengeSets()` trong `src/lib/challenge.js`.
Cả điểm mùa (`season.js`) lẫn danh hiệu (`badges.js → getMemberStreak`) đều đi qua nó. Trước
2026-09-18 hai bên tự đếm riêng, nên cùng một người có hai con số chuỗi khác nhau: kèo BO3 thắng
2−0 cho điểm mùa thấy chuỗi 1 còn danh hiệu thấy chuỗi 2.

> ⚠️ `getMemberStreak` trả thêm `streakMatches` — danh sách **trận thật** trong chuỗi. Từ khi kèo
> đếm gộp, `streak` là số ĐƠN VỊ chứ không còn là số trận, nên `matches.slice(0, streak)` ở phía
> gọi sẽ hụt trận (đếm thiếu đối thủ, lấy sai ngày mở chuỗi).

Ngược lại, `upset150` **vẫn tính theo từng set** — nó thưởng cho việc hạ đối thủ mạnh trong một
ván cụ thể, không phải cho cả chuỗi.

> 📊 Trên 118 trận Q3, chênh đội chỉ chạm 150 vài lần → **`totalUpsets = 2`**, thưởng lật kèo gần
> như không phát. Đang chờ user quyết có hạ xuống ~90 không.

### 3.5. Sàn 0 và thứ tự

```
sau MỖI trận:  điểm = max(0, điểm + delta + thưởng)
```

Vì kẹp sau **mỗi** trận, phép tính **phụ thuộc thứ tự**: thua-rồi-thắng ≠ thắng-rồi-thua khi gần
sàn. Nên bắt buộc sắp xếp theo `at` và tie-break theo `id`.

> 📊 Trước khi có `startPoints`, sàn này tạo ra **+201 điểm từ hư không** = 21.8% của 921 điểm
> hiển thị, cho 11/22 người. Sau khi thêm 100 điểm đệm → **0**.

### 3.6. Điểm cược kèo

```
rawNet = tổng phiếu thắng − tổng phiếu thua  (chỉ phiếu quyết toán TRONG mùa, theo settledAt)
predictionNet = rawNet                        ← KHÔNG kẹp chiều nào
điểm cuối = max(0, điểmTrận + predictionNet)
```

**Không kẹp cả hai chiều (từ 2026-09-28).** Sàn `−15` cũ là lỗ hổng cược miễn phí: chạm −15 rồi thì
thua thêm không mất gì. Trần `+15` bị bỏ theo quyết định của chủ CLB: điểm mùa vừa là điểm BXH vừa là
vốn đem đi cược, trần thắng cộng thua không trần thì cược luôn lỗ về kỳ vọng. Hệ quả đã chấp nhận:
người cược giỏi leo được cao hơn người đánh nhiều. Chặn cược quá số đang có nằm ở
`availableSeasonPoints`.

Người chưa ra sân trận nào vẫn cược được bằng 100 điểm khởi đầu (`stakeBaseOf`), nhưng điểm BXH
của họ chỉ gồm lãi/lỗ cược — 100 điểm khởi đầu chỉ vào BXH sau trận đầu tiên.

### 3.7. Điều kiện xếp hạng

| Nhãn | Điều kiện |
|---|---|
| **Inactive** | Đã đánh ≥ 1 trận nhưng > **21** ngày không ra sân (`inactiveDays`) |

**Thứ tự xếp hạng:** (1) điểm mùa giảm dần → (2) số trận thắng → (3) tỷ lệ thắng.

> **Đã bỏ cổng Qualified (`minMatchesOfficial`) ngày 2026-09-28**, theo quyết định của chủ CLB. Trước
> đó người đủ 8 trận luôn đứng trên người chưa đủ, bất kể điểm (chống "ôm rank"). Giờ BXH xếp thuần
> theo điểm. Trên dữ liệu thật Q3 (22 người): điểm không ai đổi, **16 người đổi hạng**, top 5 giữ
> nguyên — ví dụ Hoa (156đ, 5 trận) 12 → 6, Trường (74đ, 11 trận) 11 → 21. Backtest KHÔNG bắt được
> thay đổi này vì mốc chỉ lưu điểm, không lưu thứ hạng.

**Bot CLB trên BXH:** bot có điểm mùa như mọi người (100 điểm khởi đầu dù không ra sân) nên mặc định
đứng trong bảng. Cài đặt → Chung → Bot CLB → "Hiện bot trên BXH mùa" (cờ `clubs.bot_features.leaderboard`)
tắt thì bot đứng ngoài bảng: hạng của người thật dồn lên, **điểm của mọi người kể cả bot không đổi**.
`calculateSeasonLeaderboard` trả `leaderboard` (bảng xếp hạng) và `allRows` (đủ mọi người, kể cả bot
bị ẩn) — số dư của bot cho arcade / cược phải đọc từ `allRows`.

### 3.8. Trận giao lưu (`ratingEnabled = false`)

- Không sinh điểm mùa
- Không tính vào mốc 8 trận
- **Không cắt đứt chuỗi thắng** đang treo thưởng
- Vẫn tính là "có mặt buổi đó"

### 3.9. Vua Lì Đòn — `getSeasonBountyPlayer(db)`

Người đang giữ **chuỗi thắng ĐANG CHẠY** dài nhất CLB, tối thiểu 3 trận. Đếm ngược từ trận mới
nhất, bỏ qua trận giao lưu.

### 3.10. Cơ chế Đa Mùa Giải & Đóng Băng Mùa Giải (`podiumSnapshot`)

Hệ thống hỗ trợ nhiều mùa giải song song hoặc nối tiếp nhau:

- **Phân định mùa giải** — `resolveSeason(db, customSeason)`:
  Ưu tiên mùa giải có `active = true` trong mảng `db.seasons` (đọc từ `clubs.seasons jsonb`),
  fallback về `db.settings.season` hoặc cấu hình mặc định trong `app.json`.
- **Phạm vi dữ liệu mùa** — `seasonMatchesOf(db, season)`:
  Chỉ các trận nằm trong khung thời gian từ `startDate` đến `endDate` (hoặc thuộc các buổi
  `sessions` trong mùa) mới được tính vào BXH Điểm Mùa.
- **Phiếu dự đoán cược** — tính theo thời điểm quyết toán (`settledAt`) nằm trong khung mùa.
- **Đóng băng kết quả mùa giải (`podiumSnapshot`)**:
  Khi mùa giải kết thúc (Admin bấm "Chốt mùa / Đóng mùa"), danh sách Top 1, 2, 3 và toàn bộ bảng
  xếp hạng hoàn chỉnh tại thời điểm đó được đóng băng thành một snapshot JSON lưu vào
  `clubs.seasons[i].podiumSnapshot`.
  **Mục đích sống còn:** Bảo lưu lịch sử vinh danh bất biến. Sau này nếu admin có sửa trận cũ hoặc
  bấm "Đồng bộ lại Elo", snapshot mùa cũ vẫn đứng yên nguyên vẹn 100%, không bị xáo trộn.

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

## 8. TẦNG DANH HIỆU ANIME — `src/lib/badges.js` (DẪN XUẤT)

Toàn bộ điều kiện mở khoá tính lại từ `db.matches` mỗi lần render. **Không có bảng nào lưu danh
hiệu đã mở.** Thứ duy nhất lưu là `club_members.badge_shelf` — 3 danh hiệu người dùng chọn để
khoe trên hồ sơ.

Hệ quả: Đổi điều kiện danh hiệu → **hiệu lực ngay**, và danh hiệu ai đó "đã có" có thể **biến
mất** nếu điều kiện siết lại.

### 8.1. Hệ thống 6 Bậc Anime Tier & Điểm Sưu Tập (`tierPoints`)

Danh hiệu được thiết kế theo phong cách anime sống động, phân cấp độ hiếm và điểm thưởng sưu tập:

| Bậc Tier | Tên hiển thị | Điểm sưu tập | Hiệu ứng thị giác | Phông chữ |
|---|---|---:|---|---|
| `legend` | **LEGEND** | **120** | Vòng xoay quang phổ cầu vồng (`spin: true`), aura hào quang, core hạt nhân đỏ hồng | Oswald |
| `epic` | **EPIC** | **60** | Vòng tím phát xung nhịp đập (pulse), viền neon tím ánh hồng | Oswald |
| `elite` | **ELITE** | **30** | Vòng xanh thanh kiếm (blade), ánh sáng lướt xanh dương - cyan | Oswald |
| `rare` | **RARE** | **15** | Vòng xanh ngọc lục bảo (emerald) | Oswald |
| `fun` | **FUN** | **5** | Vàng meme vui nhộn, badge hài hước thân thiện | Oswald |
| `hidden` | **HIDDEN** | **0** | Danh hiệu ẩn, dấu chấm hỏi mờ ảo, chỉ lộ diện khi mở khoá | Oswald |

### 8.2. Điểm Sưu Tập & BXH Thợ Săn Danh Hiệu (`getCollectorLeaderboard`)

```
collectorPoints = tổng điểm (tier.pts) của TẤT CẢ các danh hiệu hội viên đã mở khoá
```

- **BXH Sưu Tập:** Xếp theo tổng `collectorPoints` giảm dần → tổng số danh hiệu → số danh hiệu Legend/Epic.
- **Độ hiếm danh hiệu (`getRarestBadges`):**
  ```
  rarityPct = (số người sở hữu badge / tổng số hội viên đang hoạt động) × 100
  ```
  Tỷ lệ càng thấp = danh hiệu càng hiếm (hiển thị tag "Độc bản" hoặc "Siêu hiếm").
- **Gia đình danh hiệu (`Badge Families`):** Gom các danh hiệu tiến hóa cùng chủ đề (ví dụ: Chuỗi Bất Bại 5 → 10 → 18, Đè Bẹp 2 → 4 → 10...) thành cây tiến trình nhiều cấp độ.

---

## 9. TẦNG CHỈ SỐ CÁ NHÂN & PHONG ĐỘ (MYSTATS) — `src/lib/homePersonal.js` (DẪN XUẤT)

Toàn bộ chỉ số phục vụ màn hình Thành tích cá nhân (`MyStats.jsx`) đều là **hàm thuần (pure functions)**,
tính toán tức thì từ `db` tại thời điểm render, không lưu DB.

### 9.1. Bộ chỉ số Hero cá nhân — `getMyHeroStats(db, memberId)`

Gói gọn vị thế hiện tại của hội viên trên cả hai trục Elo và Điểm Mùa:

- **Vị thế Elo:**
  - `myElo`: Điểm Elo sự nghiệp hiện tại.
  - `myRank`: Thứ hạng Elo toàn CLB (xếp theo Elo giảm dần → số trận → tên).
  - `eloDeltaWeek`: Biến thiên Elo trong 7 ngày gần nhất (tổng `eloDelta` từ các trận đấu thật). Nếu 7 ngày qua không ra sân, lấy delta của trận gần nhất.
- **Vị thế Điểm Mùa:**
  - `seasonPoints`, `seasonRank`, `seasonTotalMembers`.
  - `seasonWinRate`: Tỷ lệ thắng trong mùa (`round(winsCount / matchesCount * 100)`).
  - `seasonTargetRival`: Đối thủ xếp ngay phía trên trên BXH mùa.
  - `seasonPointsToNextRank`: Số điểm mùa cần kiếm thêm để vượt mặt đối thủ (`max(1, rivalPoints - myPoints)`).
  - `seasonProgressPct`: Phần trăm chặng đường điểm số giữa người đứng sau và đối thủ liền trước.

### 9.2. Phong độ 5 trận gần nhất — `getPlayerForm5(db, memberId)`

- `matches`: Mảng 5 trận đấu chính thức gần nhất trong mùa theo thứ tự thời gian tăng dần (`won: true/false`, nhãn `T` (Thắng) / `B` (Bại)).
- `streak`: Chuỗi thắng hiện tại, đếm theo **đơn vị KÈO** qua `collapseChallengeSets()` (thắng kèo BO3 tính là chuỗi +1).
- `nextBadgeStreak`: Mốc danh hiệu chuỗi kế tiếp (tìm trong các mốc `[3, 5, 7, 10, 15]`).
- `winsNeededForBadge`: Số trận thắng liên tiếp cần đạt thêm để nổ hũ danh hiệu (`nextBadgeStreak - streak`).

### 9.3. Phân tích kình địch & Mục tiêu lội ngược dòng — `getRivalAnalysis(db, memberId, targetRivalId, mode)`

- Hỗ trợ 2 chế độ: Đua Elo (`mode = 'elo'`, mặc định) hoặc Đua Điểm Mùa (`mode = 'season'`).
- **Ước tính số trận thắng cần để san bằng:**
  ```
  perWin = mode === 'season' ? season.balanced.win (14đ) : 20 Elo
  gap = điểm của kình địch − điểm của tôi
  winsToCatch = Math.ceil(gap / perWin)
  ```
- **Insight kình địch xoay tua theo ngày (Deterministic PRNG):**
  Sử dụng hàm băm xác định `getDeterministicRoll` với seed chứa `todayKey` (`YYYY-MM-DD`).
  Câu nhận định đối đầu (H2H, cơ hội vượt qua) đứng yên vững chãi suốt ngày thi đấu, không bị giật đổi chữ khi có trận mới lưu ở sân khác.

### 9.4. Lịch sử cuộc đua qua các tuần — `calcSeasonRaceHistory(db, memberId, rivalId, weeksCount, metric)`

Tái hiện quỹ đạo điểm số và thứ hạng của hội viên so với kình địch qua 6 tuần gần nhất (`weeksCount = 6`)
để vẽ biểu đồ so kè đường đua trực quan.

### 9.5. Chỉ số chuyên cần & thâm niên — `calcSessionAttendanceHistory(db, memberId)`

- Tỷ lệ có mặt (`attendanceRate`): Số buổi tham gia / tổng số buổi sinh hoạt của CLB.
- Chuỗi tuần đi tập liên tục (`attendanceStreak`).

---

## 10. TẦNG CHỈ SỐ & THUẬT TOÁN GIẢI ĐẤU — `src/lib/tournament/*` (LƯU DB RIÊNG)

> 🔒 **NGUYÊN TẮC CÁCH LY TUYỆT ĐỐI:**
> Phân hệ Giải đấu lưu trữ trên 16 bảng riêng (`tournament_*`). Toàn bộ kết quả trận giải, set đấu,
> điểm chạm... **KHÔNG BAO GIỜ tính vào Elo sự nghiệp hay Điểm Mùa thường** của hội viên CLB.

### 10.1. Hai tầng phân định điểm số set & trận — `src/lib/tournament/scoring.js`

Phân tách rành mạch theo quyết định kiến trúc D11:

1. **Tầng ghi nhận kết quả tự do (`freeSetWinner`, `validateResult`):**
   - Dùng khi trọng tài hoặc BTC nhập tỉ số kết thúc trận, chốt bảng, sửa điểm.
   - **Tự do tuyệt đối về điểm:** Chỉ cần mỗi set có bên cao điểm hơn, đủ số set thắng (`need = ceil(sets / 2)`), không thừa set sau khi đã có người thắng.
   - Cho phép ghi nhận các trận đấu bị cắt ngắn, đánh theo giờ hẹn sân, hoặc các set đấu bất thường (ví dụ 11-7, 18-12 dừng giờ).
2. **Tầng luật thi đấu chuẩn BWF (`setWinner`, `validateSets`, `matchWinner`):**
   - Dùng cho bảng điểm trực tiếp (Live Scoreboard) tại sân, tự động nhận diện deuce, set point, chuyển set:
     - `r1x15`: 1 set 15 điểm, không cách 2, kịch trần 15.
     - `r1x21`: 1 set 21 điểm, phải cách 2 (winBy2), kịch trần 30 điểm (29–29 thì ai chạm 30 trước thắng).
     - `r1x30`: 1 set 30 điểm (đổi sân ở điểm 15), không cách 2, kịch trần 30.
     - `r3x11`: Đấu 3 thắng 2, mỗi set 11 điểm, không cách 2, trần 11.
     - `r3x15`: Đấu 3 thắng 2, mỗi set 15 điểm, không cách 2, trần 15.
     - `r3x21`: Đấu 3 thắng 2, mỗi set 21 điểm, winBy2, kịch trần 30 điểm.

### 10.2. Thuật toán xếp hạng vòng tròn chuẩn BWF — `src/lib/tournament/standings.js`

Quy trình phân định thứ bậc vòng bảng tuân thủ chặt chẽ thông lệ BWF:

1. **Tiêu chí 1 — Số trận thắng (`won`):** Đội nào nhiều trận thắng hơn xếp trên.
2. **Tiêu chí 2 — Đối đầu trực tiếp (H2H 2 đội):**
   Nếu có đúng 2 đội bằng số trận thắng, xét trận đối đầu giữa 2 đội:
   `Thắng đối đầu → Hiệu số set đối đầu → Hiệu số điểm đối đầu`.
3. **Tiêu chí 3 — Bảng con mini-table (Khi có ≥ 3 đội bằng điểm nhau):**
   Tạo bảng con thu nhỏ chỉ tính các trận diễn ra giữa các đội hòa nhau:
   `Số trận thắng bảng con → Hiệu số set bảng con → Hiệu số điểm bảng con`.
   - Phân tách đệ quy (`rankTied`): Khi tách được một nhóm nhỏ hơn (ví dụ còn lại 2 đội), đệ quy chạy lại từ đầu (2 đội quay lại tiêu chí H2H).
4. **Tiêu chí 4 — Nhóm hòa chưa phân định (`ties`):**
   Nếu các chỉ số hoàn toàn bằng nhau, hệ thống gom vào mảng `ties`. Hệ thống **không bao giờ tự ý bốc thăm ngẫu nhiên**, mà giao quyền cho Ban tổ chức can thiệp thủ công:
   - BTC sử dụng nút đảo thứ tự `swapUpInTie` / `orderedRows` (chọn tay hoặc bốc thăm thực tế).
   - Khi bấm "Chốt giai đoạn", thứ tự hiển thị này được ghi đè cứng vào `tournament_group_teams.final_rank`.

### 10.3. Thể thức Thụy Sĩ (Swiss Monrad) — `src/lib/tournament/swiss.js`

Cho phép giải đấu nhiều đội thi đấu số vòng rút gọn mà vẫn chọn ra nhà vô địch xứng đáng:

- **Số vòng thi đấu mặc định:** `swissRounds(n) = min(n - 1, max(3, ceil(log2(n))))`.
- **Vòng 1 (`buildSwissStart`):** Xếp hạt giống từ 1 đến N. Nửa trên gặp nửa dưới (1 gặp n/2+1, 2 gặp n/2+2...) để các hạt giống mạnh không loại nhau sớm.
- **Thứ bậc Thụy Sĩ (`swissStandings`):**
  ```
  Điểm Thụy Sĩ (thắng + bye) ──► Điểm phụ Buchholz ──► Đối đầu H2H ──► Hiệu số set/điểm
  ```
  *Buchholz Score:* Tổng điểm Thụy Sĩ của **tất cả các đối thủ** mà đội đó đã từng đối đầu. Thắng trước đối thủ sừng sỏ có giá trị Buchholz cao hơn thắng đối thủ yếu.
- **Thuật toán ghép cặp vòng tiếp theo (`pairNextRound`):**
  - Ghép các đội có cùng số trận thắng / cùng điểm Buchholz với nhau.
  - Ngăn tuyệt đối gặp lại đối thủ cũ qua thuật toán tìm kiếm quay lui (`pairUp` với `SEARCH_BUDGET = 20,000` bước).
  - **Xử lý số đội lẻ (Bye):** Cấp vé miễn đấu (`bye`, tính 1 trận thắng) cho đội có thứ hạng thấp nhất trong nhóm **chưa từng được nhận bye**.

### 10.4. Chia bảng hạt giống con rắn & Lịch thi đấu vòng tròn Berger — `roundRobin.js`

- **Chia bảng hình con rắn (`snakeGroups`):**
  Sắp xếp các đội theo tổng Elo giảm dần, sau đó phân bổ theo thứ tự ziczac:
  ```
  Lượt 1: Bảng A ──► Bảng B ──► Bảng C ──► Bảng D
  Lượt 2: Bảng D ──► Bảng C ──► Bảng B ──► Bảng A
  ```
- **Kiểm tra độ cân bằng bảng đấu (`calcGroupBalance`):**
  Tính độ lệch rating trung bình mỗi đội giữa bảng mạnh nhất và bảng yếu nhất (`spread = maxAvg - minAvg`).
  Cảnh báo bảng đấu bị lệch nếu `spread > app.json → tournament.groupBalanceOk` (ngưỡng 15 Elo).
- **Xếp lịch thi đấu vòng tròn Berger (`circleMatches`):**
  Thuật toán Circle xoay vòng kinh điển, đảm bảo mỗi lượt đấu các đội đều ra sân đều đặn, không bị trùng lặp đối thủ.

### 10.5. Cây Nhánh đấu loại trực tiếp & Nhánh kép — `bracket.js`, `doubleElim.js`

- **Loại trực tiếp (Single Elimination):** Cây nhị phân hạt giống đối xứng, hạt giống số 1 và số 2 nằm ở 2 đầu đối diện của nhánh chung kết.
- **Nhánh kép (Double Elimination):**
  - Nhánh thắng (Winners Bracket).
  - Nhánh thua (Losers Bracket): Đội thua ở nhánh thắng rơi xuống nhánh thua tiếp tục thi đấu.
  - Trận Chung Kết Tổng (Grand Finals) và trận tái đấu (Grand Finals Reset): Nếu đội nhánh thua đánh bại đội nhánh thắng ở trận CK đầu tiên, phải đấu thêm 1 trận quyết định cuối cùng.

### 10.6. Gợi ý thể thức & Dự toán thời gian — `recommend.js`, `pairing.js`

- **Ước tính thời gian giải đấu (`estimateMatchMin = 18`, `restMin = 3`):**
  ```
  tổngThờiGianPhút = (tổngSốTrận × estimateMatchMin) / sốSân
  ```
- **Phân tích ghép cặp (`pairing.js`):**
  - Cảnh báo chênh lệch trình độ trong cặp nếu `gap > 80` Elo.
  - Đánh giá độ ăn ý dựa trên lịch sử cặp đấu: Tỷ lệ thắng `≥ 60%` = ăn ý tốt, `≤ 40%` = lệch sóng.

---

## 11. BẢNG DB ĐẦY ĐỦ (liên quan điểm số & trạng thái)

| Bảng | Cột | Ai ghi / Ý nghĩa |
|---|---|---|
| `player_ratings` | `rating`, `games_count`, `wins_count`, `losses_count`, `confidence_label` | `saveMatchScore` (từng trận) + `replayRatingCascade` (toàn bộ) |
| `matches` | `initial_rating_a`, `initial_rating_b`, `elo_delta` | như trên (chụp Elo lúc vào sân) |
| `matches` | `sets`, `winner_team`, `rating_enabled`, `score_text` | `saveMatchScore` |
| `matches` | `bounty_broken`, `broken_streak` | `saveMatchScore` |
| `match_players` | 4 dòng mỗi trận (ai, đội nào) | `saveMatchScore` |
| `club_calibration` | `bucket`, `sample_size`, `observed_win_rate`, `learned_adjustment` | mỗi lần lưu/sửa/xoá trận |
| `challenge_predictions` | `stake_points`, `team`, `status`, `settled_at`, `payout_points` | RPC 0042 quyết toán cược |
| `club_members` | `badge_shelf` | người dùng chọn 3 danh hiệu để khoe |
| `club_members` | `signature` | châm ngôn cá nhân của hội viên |
| `clubs` | `seasons` (jsonb) | cấu hình mùa + `podiumSnapshot` đóng băng Top 1/2/3 và BXH mùa |
| `push_subscriptions` | `endpoint`, `p256dh`, `auth`, `user_id` | đăng ký Web Push PWA |
| `attendances` | `state` (`true` / `extra` / `noshow` / `false`) | màn điểm danh |
| `tournament_matches` | `sets`, `winner`, `status`, `rule` | kết quả trận giải đấu (cách ly khỏi Elo CLB) |
| `tournament_group_teams` | `final_rank`, `seed_in_group` | thứ tự chốt của bảng đấu vòng tròn / Thụy Sĩ |
| `tournament_live_state` | `current_match_id`, `serving_side` | trạng thái live match trên scoreboard sân |

---

## 12. ĐỔI CÔNG THỨC THÌ PHẢI LÀM GÌ

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

## 13. NHỮNG CHỖ ĐANG KHÔNG ỔN (chưa sửa, cần quyết)

| # | Vấn đề | Ở đâu | Tác động |
|---|---|---|---|
| 1 | **2 dải điểm mùa hiếm khi chạy** — chênh đội max 200, chỉ 9/406 lượt ≥ 150 | `app.json` `deltaScale` | `heavyFavored`, `deepUnderdog` gần như không có tác dụng |
| 2 | **Thưởng lật kèo gần như không phát** — `upsetMinGap 150`, mới 2 lần trên 118 trận | `app.json` `bonusConfig` | Tính năng có mà không chạy. Cân nhắc hạ ~90 |
| 3 | **Thua đậm và thua sát nút trừ như nhau** | `calcSeasonMatchDelta` bỏ qua `sets` | User đã nêu "thua đau trừ nhiều" — chưa làm |
| 4 | **Suy hao nghỉ dài không trừ thật** | `applyInactivityDecay` chỉ dùng để hiện chữ | Hiển thị nói một đằng, DB một nẻo |
| ~~5~~ | ~~`rating_deviation` luôn = 350~~ | — | ✅ **ĐÃ SỬA** — xoá nhánh chết trong `confidenceOf`, bỏ cột (migration 0045) |
| ~~6~~ | ~~Bảng `player_rating_context` chết~~ | — | ✅ **ĐÃ SỬA** — DROP TABLE (migration 0045) |
| ~~7~~ | ~~Hệ số ×2 ma thuật ở hiệu chỉnh chéo giới~~ | — | ✅ **ĐÃ SỬA** — dùng chung `effectiveTeamRating()`, bỏ số bịa khi thiếu dữ liệu (xem §5.6) |
| 8 | **Hai mô hình co cụm khác nhau** — synergy dùng `min(1, g/15)` liên tục, còn bonus xếp sân dùng bậc thang `0 / 0.5 / 1` | `rating.js` vs `assign.js` | Cùng một cặp cho hai con số khác nhau ở hai màn |
| 9 | **Xếp sân mode `balance` dùng trình độ khai, không dùng Elo** | `assign.js` `arrange` | Hai nguồn sự thật cho cùng một việc |
| 10 | **Tổng delta Elo mỗi trận ≠ 0** vì K khác nhau theo người | `calcPlayerDeltas` | `eloDrift +82` / 118 trận. Chấp nhận được, nhưng phải biết |
| 11 | **`docs/HE_THONG_RATING_VA_DIEM_MUA.md` đã lệch code** | doc cũ | Ghi trọng số 35/20/15/15/15 (nay 55/20/15/10), công thức `100 − Δ/50×6` (nay `100 − expectedGapPp`), còn tả `arrangeBestOfN` (đã xoá), thiếu `startPoints` |

---

## 14. LIÊN QUAN

- `docs/BACKTEST.md` — cách kiểm chứng khi đổi công thức
- `docs/RULES.md` §0 — luật cứng về baseline
- `src/config/app.json` — mọi hằng số ở trên
- `src/__tests__/backtest/` — dữ liệu thật + mốc số
