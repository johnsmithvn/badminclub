# HOME_SKY.md — Nền bầu trời trang chủ

**Version:** v1.0.0 · **Updated:** 2026-10-17

Toàn bộ **tình huống** và **câu thoại** của nền bầu trời động ở trang chủ cá nhân (route `home`,
`/`), cho **cả hai chế độ** Tối (bầu trời sao) và Sáng (hoàng hôn trên biển mây), trên **cả
desktop lẫn mobile**. Thiết kế gốc: `Home · Nền bầu trời.dc.html`.

| File | Vai trò |
| --- | --- |
| `src/components/home/SkyBackdrop.jsx` | Vẽ trời, nhân vật, cảnh siêu nhân / UFO / sao ước |
| `src/lib/sky.js` | Hàm thuần: bốc nhân vật, đọc số liệu, chọn câu thoại |
| `src/i18n/vi.json` → `sky.*` | Nguyên văn mọi câu thoại và nhãn |
| `src/config/app.json` → `sky` | Ngưỡng, giờ khuya, kiểu trăng, nhịp sao ước / cảnh bay |
| `src/styles/effects.css` | Keyframe `sky*`, token kính `[data-sky]` |
| `src/components/layout/AppLayout.jsx` | Gắn `data-sky` + nền gốc trong suốt ở route `home` |
| `src/pages/MyStats.jsx` | Đặt `<SkyBackdrop>`, truyền số liệu của chính các thẻ |
| `src/__tests__/lib/sky.test.js` | Khoá luật chọn câu và đủ key i18n |

---

## 1. Nền hiện ở đâu, xếp lớp thế nào

- Chỉ ở **trang chủ cá nhân** (`MyStats.jsx`), cả ba tab Thành tích · Sân đấu · Hoạt động. Không
  hiện khi tài khoản chưa ghép thành viên CLB (màn "chưa phải thành viên").
- **Trời đứng yên, nội dung cuộn.** Hai lớp `position: fixed`:
  - Lớp trời `z-index: -1` — sau sidebar, header, thẻ. Không bắt chuột.
  - Lớp nhân vật `z-index: 20` — trên nội dung, dưới dialog (40), footer nav mobile (40), toast (90).
    Chỉ chính nhân vật / bóng thoại / sao ước bắt chuột, phần còn lại click xuyên qua.
- **Thẻ kính:** ở route `home`, `surface-card` · `surface-inset` · `surface-nav` · `field-bg` (và hai
  nền soft của bản sáng) có alpha (thẻ 0.74, lõm 0.65, nav 0.70) + `backdrop-filter: saturate(160%)
  blur(14px)`. Màu gốc giữ nguyên `tokens/dark.css` · `semantic.css`. Dialog dùng `surface-overlay` nên
  vẫn đặc.
- **Cuộn xuống:** lớp nhân vật trôi lên theo và mờ dần, quá 80px thì ẩn hẳn (trời vẫn còn).
- **Đổi sáng / tối** (nút mặt trời / mặt trăng ở header trang chủ hoặc góc dưới sidebar): trời đổi
  ngay; vẫn là nhân vật đã bốc, cảnh siêu nhân / UFO đang bay được dọn và chạy lại từ đầu.

### Desktop và mobile

| | Desktop | Mobile (≤ 768px) |
| --- | --- | --- |
| Khung cảnh | Khung 1440×940 phóng cho phủ kín màn, giữ tỉ lệ, canh giữa, cắt đáy | Tỉ lệ 1:1 (phóng nếu màn cao hơn 940), lấy khúc trời quanh mặt trăng, trăng ở giữa màn |
| Trăng | 72px, ở x 960 / y 22 | 42px, sát mép trên |
| Chòm sao | Có tên, góc phải header | Nhỏ hơn, **không tên**, bên trái trăng |
| Cá voi sao | Cỡ 1, 90 giây một lượt | Cỡ 0.58, 44 giây một lượt, bơi đúng bề ngang màn |
| Nhân vật | Toạ độ khung 1440 (phóng theo trời) | Khung 390 của thiết kế, canh theo tâm màn |
| Mưa sao băng | Cả khung | Khúc quanh trăng |

---

## 2. Chế độ Tối — bầu trời sao

> Trăng có chú Cuội, cá voi sao bơi ngang trời, ngân hà, sao băng, sao chổi, đom đóm. Khoảng 25 giây
> một chòm sao hiện lên ở header, 42 giây một trận mưa sao băng quét qua cả màn. Sao ước bay ngang
> header, bấm vào để ước.

| Thành phần | Mô tả | Nhịp |
| --- | --- | --- |
| Nền | Xanh đêm đậm dần xuống chân trời | — |
| Tinh vân | Ba quầng tím / xanh ngọc / hồng tím mờ, trôi nhẹ | 34 s, qua lại |
| Ngân hà | Dải sáng nghiêng −17° + bụi sao trong dải | Bụi sao lấp lánh 9 s |
| Sao nền | 4 lớp lặp, mờ dần về đáy | Lấp lánh 7 / 4.5 / 6.5 / 5.5 s |
| Sao sáng | 12 ngôi sao chữ thập, vừa nhấp nháy vừa xoay | 4.4 – 7.4 s |
| Trăng | Trăng rằm, quầng sáng thở; trên mặt trăng là chú Cuội ngồi gốc cây đa | Quầng 9 s |
| Cá voi sao | Bơi từ phải sang trái, vệt sao sau đuôi, phun bụi sao, quẫy đuôi / vây, chòm sao trên lưng | 90 s/lượt (bắt đầu sau 4 s), mobile 44 s (sau 3 s) |
| Sao băng nhỏ | 5 vệt chéo | 9 / 13 / 17 / 23 / 19 s |
| Sao chổi | Đầu sáng xanh ngọc, đuôi dài 320px, bay ngang cả trời | 40 s/lượt (bắt đầu sau 6 s) |
| Đom đóm | 24 đốm xanh vàng lượn và chớp ở nửa dưới | 12 – 22 s |
| Chòm sao | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga. Mỗi ~25 s một chòm hiện ở header: nét nối tự vẽ ra, giữ ~12 s rồi tắt. Mỗi lần hiện đổi chỗ một chút và nghiêng ±8° | Vòng 150 s |
| Mưa sao băng | 14 vệt quét chéo qua cả màn, **nằm trên nội dung** | 42 s/trận (trận đầu sau 10 s) |
| Sương đáy | 32% dưới cùng ửng xanh | — |
| Sao ước | Xem §4.6 | Sau 3 s, rồi mỗi 13 s |

## 3. Chế độ Sáng — hoàng hôn trên biển mây

> Trời tím hồng, mặt trời đã lặn sau biển mây, ráng chiều ấm ở chân trời, vài ngôi sao sớm, ba lớp
> mây cuộn, chim và máy bay thỉnh thoảng bay ngang.

| Thành phần | Mô tả | Nhịp |
| --- | --- | --- |
| Nền | Tím lam → hồng → cam đào | — |
| Ráng chiều | Quầng cam hồng lớn ở chân trời, thở | 12 s, qua lại |
| Dải hồng | Dải sáng mờ ngang trời | — |
| Sao sớm | 5 ngôi sao nhỏ lấp lánh | 4.2 – 7 s |
| Mây ti | 3 vệt mây mỏng trôi ngang | 30 / 38 / 46 s |
| Máy bay | Bay trái → phải, kéo hai vệt khói | 56 s/lượt (bắt đầu sau 10 s) |
| Đàn chim | 6 con, vỗ cánh, bay phải → trái | 38 s/lượt (bắt đầu sau 4 s) |
| Mây tích | 5 cụm mây hồng đào, nhấp nhô và trôi ngang | Nhấp nhô 6 – 10 s, trôi 40 – 70 s |
| Dãy núi | Bóng núi tím phía sau biển mây | — |
| Biển mây | 3 lớp cuộn sang trái liền mạch (xa → gần), sương trôi giữa lớp 1 và 2 | 220 / 140 / 90 s, sương 26 s |
| Hạt sáng | 12 đốm sáng bay lên từ biển mây | 14 – 24 s |

Ban ngày **không có**: sao ước, mưa sao băng, chòm sao, cá voi.

---

## 4. Nhân vật ghé thăm

### 4.1 Luật bốc

- Mỗi lần **mở trang** (F5 / vào lại) bốc **một** nhân vật ngẫu nhiên, đều xác suất trong:
  - Khuya (**22:00 → trước 04:00**, giờ máy người xem): Cú mèo · Băng rôn · Xếp hình · Siêu nhân · UFO.
  - Ngoài giờ đó: Băng rôn · Xếp hình · Siêu nhân · UFO (không có cú mèo).
- Chốt một lần lúc mở: đang mở trang mà đồng hồ qua 22h thì cú chưa ra, phải mở lại.
- Đổi sáng / tối **không** bốc lại.
- Sao ước không thuộc lượt bốc: đêm nào cũng có.

| Nhân vật | Tối | Sáng | Có thoại | Bấm vào |
| --- | --- | --- | --- | --- |
| Cú mèo | Đậu trên trăng | Đậu trên vầng trăng non nhạt vẽ thêm | Có | Câu kế + nghiêng đầu |
| Máy bay băng rôn | Có đèn đỏ / xanh nhấp nháy | Máy bay tím | Có (chữ trên băng rôn) | Đổi chữ |
| Xếp hình | Đom đóm | Chim | Không | — |
| Siêu nhân | Có | Có | Có | Câu kế + 👍 |
| UFO | Có | Có | Có (nhiều vai) | Bấm UFO: bắn tên lửa · Bấm người bị hút: gọi siêu nhân |

### 4.2 Cú mèo (chỉ sau 22h)

- Đậu trên cành dưới trăng, chớp mắt mỗi 5 s.
- Bóng thoại hiện sau 2 s kể từ lúc mở; mỗi vòng 16 s hiện ~5 s rồi ẩn, **hết vòng tự sang câu kế**.
- Bấm cú hoặc bấm bóng thoại → câu kế ngay, cú nghiêng đầu 0.9 s, bóng thoại hiện lại từ đầu.
- Danh sách câu: §6.2. Tooltip: "Bấm để cú nói câu khác".

### 4.3 Máy bay kéo băng rôn

- Bay trái → phải ngang header, lượt đầu sau 6 s, **32 s một lượt** (bay ~16 s, nghỉ ~16 s).
- Mỗi lượt mới đổi sang câu kế; bấm băng rôn → đổi câu ngay. Băng rôn phấp phới.
- Danh sách câu: §6.3. Tooltip: "Bấm để đổi chữ".

### 4.4 Xếp hình

Đom đóm (tối) / chim (sáng) bay tới xếp thành một hình ở header, giữ một lúc rồi tản đi:

1. Chữ **TOP 1**
2. Trái tim
3. Mặt mèo
4. Mặt cười
5. Mặt ^_^
6. Quả cầu lông
7. Ngôi sao

- Vòng **30 s**: bay tới ~8 s → giữ ~8 s → tản ra ~8 s → nghỉ.
- Hình đầu tiên ngẫu nhiên; hết mỗi vòng đổi sang hình **khác** hình vừa xếp (ngẫu nhiên).
- Đêm: đom đóm bay lên từ dưới, tản ra xung quanh. Ngày: chim bay tới từ bên phải, rời đi về trái.
- Không thoại, không bấm.

### 4.5 Siêu nhân

- Lượt đầu ~2.5 s sau khi mở; bay trái → phải ngang header, bóng thoại bay theo bên trái. Desktop
  ~10 s một lượt bay, mobile chậm hơn. Nghỉ **8 s** giữa hai lượt.
- Mỗi lượt mang câu kế tiếp trong danh sách (§6.4); bấm siêu nhân → đổi câu + bật 👍.
- Tooltip: "Bấm để siêu nhân giơ ngón cái".

### 4.6 UFO bắt cóc

Lượt đầu ~2.5 s sau khi mở, nghỉ 8 s giữa hai lượt (cùng nhịp với siêu nhân).

1. UFO bay vào từ phải, chậm lại, bật tia hút.
2. Một người đứng ở mép header bị hút lên. **50/50** là:
   - **Bạn** — áo teal, nhãn "Bạn";
   - **Người kề bạn trên BXH mùa** — áo hồng buộc tóc, nhãn tên người đó: đang hạng 1 thì là người
     **hạng 2 đuổi theo**, không thì là người **ngay trên** bạn. Không có ai kề → luôn là bạn.
3. Người bị hút kêu **2 câu** bốc ngẫu nhiên từ danh sách §6.5 (câu 1 hiện ~2.7 s, câu 2 tới hết đoạn hút).
4. Kết cục:

| Kết cục | Khi nào | Diễn biến | Lời |
| --- | --- | --- | --- |
| Bắt cóc | 1/5 nếu không ai bấm | UFO hút người lên tàu rồi bay mất về trái | UFO nói câu bắt cóc |
| Siêu nhân | Bấm người bị hút (bật 🦸), hoặc 2/5 nếu không ai bấm | Siêu nhân bay tới bế người ra khỏi màn; UFO giật mình rồi chuồn | UFO: "Ơ kìa! Siêu nhân! (ﾟдﾟ)" · Siêu nhân nói câu cứu |
| Tên lửa | Bấm UFO (bật 🎯), hoặc 2/5 nếu không ai bấm | Tên lửa bắn từ dưới lên, nổ **BÙM!**, UFO rơi xoay; người rơi xuống đất nảy nhẹ | Người vừa thoát nói câu thoát nạn |

- Chưa có hạng mùa → không có kết cục bắt cóc (chỉ siêu nhân / tên lửa, mỗi loại 1/2).
- Tooltip UFO: "Bấm để bắn tên lửa" · người bị hút: "Bấm để gọi siêu nhân".

### 4.7 Sao ước (chỉ chế độ Tối)

- Ngôi sao có vòng gạch xoay + nhãn **"Bấm để ước"**, bay chéo xuống trái ngang header trong 6.8 s.
  Ngôi đầu sau 3 s, rồi **mỗi 13 s** một ngôi.
- Bấm trúng → bung 18 hạt sáng + sao bốn cánh, hiện thẻ **"Điều ước"** 4.4 s với một điều ước ngẫu
  nhiên (§6.6).

---

## 5. Số liệu nhân vật nói theo

Lấy đúng số của các thẻ trên trang chủ, theo **ĐIỂM MÙA** (như thẻ Hạng mùa giải):

| Biến | Nguồn | Ý nghĩa |
| --- | --- | --- |
| `rank` | `getMyHeroStats().seasonRank` | Hạng mùa hiện tại (không có → không nói gì về hạng) |
| `rd` | `seasonRankDelta` | Đổi hạng so với buổi trước (âm = tụt) |
| `gap` | `seasonPointsToNextRank` | Điểm mùa còn thiếu để vượt người ngay trên |
| `rival` | `seasonTargetRival.name` | Người ngay trên (chỉ khi hạng > 1) |
| `streak` | `getPlayerForm5().streak` | Chuỗi thắng hiện tại |
| `off` | Trận gần nhất của mình | Số ngày từ trận gần nhất tới hôm nay (chưa đánh trận nào = 0) |
| `chaser`, `cg` | `getSurroundingSeasonStandings()` | Khi đang hạng 1: người hạng 2 và họ kém bao nhiêu điểm |
| tên bạn | Thành viên đang đăng nhập | Băng rôn và UFO gọi tên |

Ngưỡng ở `app.json → sky`: `nearGap` 10 điểm · `awayDays` 7 ngày · `streakMin` 2 trận.

### 5.1 Bảng tình huống → câu theo số liệu

Các câu dưới đây gọi chung là **câu số liệu**, dùng chung cho cú mèo, băng rôn, siêu nhân, xếp
theo đúng thứ tự này:

| # | Điều kiện | Câu (key `sky.line.*`) |
| --- | --- | --- |
| 1 | Nghỉ ≥ 7 ngày | "Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)" (`missRacket`) |
| 2 | Nghỉ ≥ 7 ngày | "{n} ngày chưa ra sân rồi. Mai đi đánh nhé?" (`daysOff`) |
| 3 | Hạng 1 | "Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ" (`leader`) |
| 4 | Hạng 1 và có người hạng 2 | "{tên hạng 2} chỉ kém {n} điểm, đừng lơ là." (`chaser`) |
| 5 | Hạng > 1 và cách ≤ 10 điểm | "Còn {n} điểm là vượt {tên người trên}. Năm nay phải top 1! (ง •̀_•́)ง" (`near`) |
| 6 | Hạng > 1 và cách > 10 điểm | "Cách hạng {hạng − 1} còn {n} điểm. Từng trận một thôi." (`far`) |
| 7 | Tụt hạng **và** không nghỉ lâu | "Tụt {n} hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و" (`drop`) |
| 8 | Lên hạng **và** hạng > 1 | "Vừa lên {n} hạng! Đà này ngon đấy ヽ(•‿•)ノ" (`rise`) |
| 9 | Chuỗi ≥ 2 thắng | "Chuỗi {n} thắng rồi, đừng dừng lại! 🔥" (`streak`) |

Câu 3–6 loại trừ nhau (chỉ một trong 4). Chưa có hạng → không có câu 3–8.

---

## 6. Kho câu thoại đầy đủ (nguyên văn `vi.json → sky`)

### 6.1 Câu số liệu

Xem bảng §5.1.

### 6.2 Cú mèo

Thứ tự xoay vòng: **2 câu mở** (bỏ khi nghỉ ≥ 7 ngày) **+ toàn bộ câu số liệu**.

| Key | Câu |
| --- | --- |
| `sky.owl.sleep` | Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ |
| `sky.owl.peek` | Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬) |

### 6.3 Băng rôn máy bay

Thứ tự: **câu mở** → "Cầu lông là lý do…" → câu số liệu. Nghỉ ≥ 7 ngày: câu mở là "Vợt đang nhớ bạn
đấy" (không mặt cười) và **bỏ** câu số liệu số 1 để khỏi lặp ý.

| Key | Câu |
| --- | --- |
| `sky.banner.tonight` | {tên bạn} ơi, tối nay đánh không? |
| `sky.banner.missRacket` | Vợt đang nhớ bạn đấy |
| `sky.banner.chores` | Cầu lông là lý do chính đáng để trốn việc nhà |

### 6.4 Siêu nhân

Thứ tự: câu mở + toàn bộ câu số liệu.

| Key | Câu |
| --- | --- |
| `sky.hero.top1` | Năm nay phải top 1! (•̀ᴗ•́)و ✧ |
| `sky.hero.rescueMe` | Đừng lo, tôi đưa bạn ra sân! 💪 *(cảnh UFO, cứu bạn)* |
| `sky.hero.rescueRival` | Muốn thắng thì thắng trên sân nhé! 💪 *(cảnh UFO, cứu người kia)* |

### 6.5 UFO

**Câu kêu khi bị hút — bạn bị bắt** (bốc 2 câu ngẫu nhiên):

| Key | Câu | Có khi |
| --- | --- | --- |
| `sky.ufo.rise.court` | Ơ ơ, chuẩn bị đi đánh cầu mà! | Luôn có |
| `sky.ufo.rise.letGo` | Thả tôi xuống, tối nay còn có kèo! | Luôn có |
| `sky.ufo.rise.near` | Khoan! Còn {n} điểm nữa là tôi vượt {tên người trên}! | Hạng > 1, cách ≤ 10 |
| `sky.ufo.rise.leader` | Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) | Hạng 1 |
| `sky.ufo.rise.streak` | Chuỗi {n} thắng của tôi! Đừng mà 😭 | Chuỗi ≥ 2 |
| `sky.ufo.rise.away` | {n} ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`) | Nghỉ ≥ 7 ngày |

**Câu kêu khi bị hút — người kề bạn bị bắt** (bốc 2 trong 3):

| Key | Câu | Có khi |
| --- | --- | --- |
| `sky.ufo.rise.court` | Ơ ơ, chuẩn bị đi đánh cầu mà! | Luôn có |
| `sky.ufo.rise.help` | {tên bạn} ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) | Luôn có |
| `sky.ufo.rise.ahead` | Tôi mới hơn {tên bạn} có {n} điểm thôi, thả tôi xuống! | Bạn hạng > 1 (người bị bắt là người ngay trên) |
| `sky.ufo.rise.chasing` | Tôi đang đuổi {tên bạn} mà, thả tôi ra! | Bạn hạng 1 (người bị bắt là người đuổi theo) |

**Lời kết cục:**

| Key | Ai nói | Câu | Khi |
| --- | --- | --- | --- |
| `sky.ufo.abductMe` | UFO | Mượn tay vợt hạng {hạng} về hành tinh luyện tập. 👽 | Bắt cóc bạn |
| `sky.ufo.abductRival` | UFO | Đã bắt cóc {tên}. Ghế trên bạn tạm trống. 👽 | Bắt cóc người ngay trên |
| `sky.ufo.abductChaser` | UFO | Đã bắt cóc {tên}. Ngôi vương của bạn an toàn. 👽 | Bắt cóc người đuổi theo (bạn hạng 1) |
| `sky.ufo.hero` | UFO | Ơ kìa! Siêu nhân! (ﾟдﾟ) | Kết cục siêu nhân |
| `sky.hero.rescueMe` / `rescueRival` | Siêu nhân | xem §6.4 | Kết cục siêu nhân |
| `sky.ufo.safeMe` | Bạn | Phù… vẫn kịp giờ đánh cầu! (；´∀｀) | Tên lửa, bạn thoát |
| `sky.ufo.safeRival` | Người kia | Ai bắn đấy? {tên bạn} à?! (¬_¬) | Tên lửa, người kia thoát |

### 6.6 Sao ước (bốc ngẫu nhiên 1)

| Key | Câu | Có khi |
| --- | --- | --- |
| `sky.wish.smash` | Ước smash nào cũng chạm vạch | Luôn có |
| `sky.wish.net` | Ước đối thủ đánh lưới cả trận | Luôn có |
| `sky.wish.pass` | Ước vượt {tên người trên} ngay tối nay | Có người ngay trên (hạng > 1) |
| `sky.wish.court` | Ước buổi sau sân trống cả tối | Luôn có |
| `sky.wish.feather` | Ước cầu không bao giờ rụng lông | Luôn có |
| `sky.wish.partner` | Ước partner đỡ hết cầu khó | Luôn có |

### 6.7 Chữ phụ

| Key | Chữ | Ở đâu |
| --- | --- | --- |
| `sky.tip.owl` | Bấm để cú nói câu khác | Tooltip cú mèo |
| `sky.tip.banner` | Bấm để đổi chữ | Tooltip băng rôn |
| `sky.tip.hero` | Bấm để siêu nhân giơ ngón cái | Tooltip siêu nhân |
| `sky.tip.ufo` | Bấm để bắn tên lửa | Tooltip UFO |
| `sky.tip.victim` | Bấm để gọi siêu nhân | Tooltip người bị hút |
| `sky.tip.wish` | Bấm để ước | Nhãn dưới sao ước |
| `sky.wishTitle` | Điều ước | Tiêu đề thẻ điều ước |
| `sky.you` | Bạn | Nhãn dưới người bị hút khi là bạn |
| `sky.boom` | BÙM! | Chữ nổ khi tên lửa trúng UFO |
| `sky.cons` | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga | Tên chòm sao (desktop) |

Biểu tượng bật lên khi bấm (không phải chữ): 👍 (siêu nhân), 🦸 (gọi siêu nhân), 🎯 (bắn tên lửa).

---

## 7. Ví dụ đầy đủ — bốn tình huống mẫu của thiết kế

Sinh thẳng từ `lib/sky.js` + `vi.json`, tên người xem là "Canh lá ngón". Mỗi tình huống áp dụng như
nhau cho chế độ Tối và Sáng (riêng sao ước chỉ có ở Tối).

### A. Mặc định (hạng 2, tụt 1, cách Hương Giang 5 điểm, chuỗi 2, nghỉ 1 ngày)

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
5. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
5. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
3. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
4. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Thả tôi xuống, tối nay còn có kèo!
3. Khoan! Còn 5 điểm nữa là tôi vượt Hương Giang!
4. Chuỗi 2 thắng của tôi! Đừng mà 😭

- Kết cục bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪
- Kết cục tên lửa — Bạn: Phù… vẫn kịp giờ đánh cầu! (；´∀｀)

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬)
3. Tôi mới hơn Canh lá ngón có 5 điểm thôi, thả tôi xuống!

- Kết cục bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪
- Kết cục tên lửa — Hương Giang: Ai bắn đấy? Canh lá ngón à?! (¬_¬)

**Sao ước** (đêm, bốc ngẫu nhiên 1):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó

### B. Đang chuỗi thắng (hạng 2, vừa lên 1, cách 2 điểm, chuỗi 5, đánh hôm nay)

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
5. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
5. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
3. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
4. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Thả tôi xuống, tối nay còn có kèo!
3. Khoan! Còn 2 điểm nữa là tôi vượt Hương Giang!
4. Chuỗi 5 thắng của tôi! Đừng mà 😭

- Kết cục bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪
- Kết cục tên lửa — Bạn: Phù… vẫn kịp giờ đánh cầu! (；´∀｀)

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬)
3. Tôi mới hơn Canh lá ngón có 2 điểm thôi, thả tôi xuống!

- Kết cục bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪
- Kết cục tên lửa — Hương Giang: Ai bắn đấy? Canh lá ngón à?! (¬_¬)

**Sao ước** (đêm, bốc ngẫu nhiên 1):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó

### C. Đang hạng 1 (vừa lên 1, Hương Giang kém 4 điểm, chuỗi 3)

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
4. Hương Giang chỉ kém 4 điểm, đừng lơ là.
5. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
4. Hương Giang chỉ kém 4 điểm, đừng lơ là.
5. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
3. Hương Giang chỉ kém 4 điểm, đừng lơ là.
4. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Thả tôi xuống, tối nay còn có kèo!
3. Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;)
4. Chuỗi 3 thắng của tôi! Đừng mà 😭

- Kết cục bắt cóc — UFO: Mượn tay vợt hạng 1 về hành tinh luyện tập. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪
- Kết cục tên lửa — Bạn: Phù… vẫn kịp giờ đánh cầu! (；´∀｀)

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬)
3. Tôi đang đuổi Canh lá ngón mà, thả tôi ra!

- Kết cục bắt cóc — UFO: Đã bắt cóc Hương Giang. Ngôi vương của bạn an toàn. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪
- Kết cục tên lửa — Hương Giang: Ai bắn đấy? Canh lá ngón à?! (¬_¬)

**Sao ước** (đêm, bốc ngẫu nhiên 1):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước buổi sau sân trống cả tối
4. Ước cầu không bao giờ rụng lông
5. Ước partner đỡ hết cầu khó

### D. Lâu không đánh (hạng 4, tụt 2, cách VA 23 điểm, nghỉ 12 ngày)

**Cú mèo** (xoay vòng theo thứ tự):

1. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
2. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
3. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**Băng rôn máy bay:**

1. Vợt đang nhớ bạn đấy
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
4. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
3. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
4. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**UFO bắt chính bạn** (nhãn "Bạn", áo teal) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Thả tôi xuống, tối nay còn có kèo!
3. 12 ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`)

- Kết cục bắt cóc — UFO: Mượn tay vợt hạng 4 về hành tinh luyện tập. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪
- Kết cục tên lửa — Bạn: Phù… vẫn kịp giờ đánh cầu! (；´∀｀)

**UFO bắt VA** (nhãn "VA", áo hồng buộc tóc) — 2 câu kêu bốc ngẫu nhiên từ:

1. Ơ ơ, chuẩn bị đi đánh cầu mà!
2. Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬)
3. Tôi mới hơn Canh lá ngón có 23 điểm thôi, thả tôi xuống!

- Kết cục bắt cóc — UFO: Đã bắt cóc VA. Ghế trên bạn tạm trống. 👽
- Kết cục siêu nhân — UFO: Ơ kìa! Siêu nhân! (ﾟдﾟ) · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪
- Kết cục tên lửa — VA: Ai bắn đấy? Canh lá ngón à?! (¬_¬)

**Sao ước** (đêm, bốc ngẫu nhiên 1):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt VA ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó

---

## 8. Ca biên

| Tình huống | App xử sự |
| --- | --- |
| Chưa có hạng mùa (chưa có trên BXH) | Không câu nào về hạng / người trên; UFO không có kết cục bắt cóc; sao ước không có "vượt …" |
| Chưa đánh trận nào | `off` = 0 → không vào nhánh "lâu không đánh" |
| Đánh sáng nay, xem tối nay | `off` = 0 (tính theo ngày lịch, không theo 24 giờ) |
| Hạng 1 nhưng BXH mùa chỉ có mình | Không có câu "… chỉ kém …"; UFO luôn bắt chính bạn |
| Tên dài | Bóng thoại xuống dòng trong bề rộng tối đa (desktop 210px cú / 240px cảnh bay; mobile 196 / 180px); băng rôn một dòng |
| Tên có ký tự HTML | Hiện đúng chữ (gắn bằng `textContent` / escape), không chèn được thẻ |
| Bật "Giảm chuyển động" ở hệ điều hành | Mọi thứ đứng yên: chỉ còn trời tĩnh; cú mèo (nếu được bốc) hiện cố định với câu đầu; không băng rôn, xếp hình, sao băng, cá voi, chòm sao, siêu nhân, UFO, sao ước |
| Tab ẩn | Không sinh lượt siêu nhân / UFO / sao ước mới |
| Dữ liệu đồng bộ lại khi đang xem | Câu thoại cập nhật ở lượt nói kế tiếp, cảnh đang bay không bị cắt |
| Mở dialog / sheet | Lớp nhân vật ở z 20; dialog / sheet "Thêm" cần nằm trên — **chưa kiểm tay**, xem checklist §9 |

---

## 9. Xem trước và kiểm tay

Thêm tham số vào URL trang chủ: `?sky=owl` · `?sky=banner` · `?sky=top1` · `?sky=hero` · `?sky=ufo` ·
`?sky=all` (tất cả cùng lúc; siêu nhân và UFO thay phiên). `?sky=owl` không cần chờ 22h.

Checklist:

- [ ] Tối + desktop: trăng có chú Cuội, cá voi bơi ngang (~4 s sau khi mở), sao chổi, chòm sao ở góc
  phải header có tên, mưa sao băng (~10 s), sao ước bấm được ra thẻ "Điều ước".
- [ ] Sáng + desktop: hoàng hôn, mây cuộn, máy bay (~10 s), chim (~4 s); không có sao ước.
- [ ] Thẻ, sidebar, footer nav mobile trong mờ thấy trời; chữ trên thẻ vẫn đọc rõ ở cả hai chế độ.
- [ ] Cuộn nội dung: trời đứng yên, nhân vật mờ dần rồi ẩn.
- [ ] `?sky=ufo`: bấm người bị hút → siêu nhân tới cứu; lượt sau bấm UFO → tên lửa + BÙM.
- [ ] `?sky=owl`: bấm cú → đổi câu + nghiêng đầu; đổi sang Sáng → cú đậu trên vầng trăng non.
- [ ] Mobile 375px: trăng giữa màn, nhân vật không tràn ngang, footer nav không bị che.
- [ ] Câu thoại khớp số trên thẻ Hạng mùa giải / Mục tiêu / Phong độ.

---

## 10. Cấu hình (`app.json → sky`)

| Khoá | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `lateFrom` / `lateUntil` | 22 / 4 | Khung giờ có cú mèo |
| `nearGap` | 10 | Cách người trên ≤ ngần này điểm thì giục vượt, xa hơn thì "Cách hạng …" |
| `awayDays` | 7 | Nghỉ ≥ ngần này ngày là "lâu không đánh" |
| `streakMin` | 2 | Chuỗi ≥ ngần này trận thì khen |
| `moon` | `full` | `full` trăng rằm · `lunar` theo lịch âm thật · `crescent` lưỡi liềm |
| `wishFirstMs` / `wishEveryMs` | 3000 / 13000 | Sao ước đầu tiên / nhịp sao ước |
| `sceneFirstMs` / `sceneGapMs` | 2500 / 8000 | Lượt bay đầu / nghỉ giữa hai lượt siêu nhân – UFO |

---

## 11. Có trong file thiết kế nhưng không hiển thị

Để đủ, kể cả phần thiết kế viết ra nhưng chính thiết kế không đưa lên màn:

- **Khinh khí cầu** (có code, không nằm trong danh sách nhân vật nên không bao giờ hiện): biển
  "TOP 1 hoặc không gì cả", tooltip "Bấm để bơm lửa", câu: "Còn 5 điểm nữa thôi, đẩy nốt!" ·
  "Thắng thêm 1 trận là có huy hiệu Chuỗi 3." · "Tụt 1 hạng thôi, lên lại nhanh thôi." · bản nghỉ
  lâu: "Lên cao để tìm bạn đây. Sân đang chờ!" · "Vợt đang nhớ bạn đấy."
- **Bộ câu viết sẵn** bị câu số liệu ghi đè ngay sau đó — cú: "Khuya rồi, ngủ đi. Mai còn phải phục
  thù." · "Thức để soi BXH à? Điểm không tự tăng đâu." · "Còn 5 điểm nữa là vượt Hương Giang. Ngủ sớm
  lấy sức." · "Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời."; băng rôn: "Còn 5 điểm là vượt Hương
  Giang" · "Chuỗi 2 thắng rồi, đừng dừng"; bản nghỉ lâu: cú "Vợt đang nhớ bạn đấy." · "Mười hai ngày
  chưa ra sân rồi. Mai đi đánh nhé?" · "Khuya rồi, ngủ đi. Mai ra sân lấy lại cảm giác.", băng rôn
  "Canh lá ngón ơi, sân vẫn chờ".
- **UFO đứng yên kiểu cũ** (thay bằng cảnh bắt cóc): "Đã bắt cóc kẻ đuổi theo bạn. Ngôi vương an
  toàn. 👽" · "Báo cáo: phát hiện một cú smash vượt tốc độ ánh sáng." · tooltip "Bấm để UFO chớp đèn".
- **Thanh trạng thái điện thoại** (giờ 23:00, sóng, wifi, pin) trong khung mobile: chỉ là khung máy
  giả lập.

---

## 12. Khác file thiết kế (quyết định khi dựng)

| Thiết kế | App |
| --- | --- |
| Tweak "Tình huống" (Theo số liệu / Đang chuỗi thắng / Đang hạng 1 / Lâu không đánh) với số mẫu | Luôn theo **số liệu thật** của người xem (§5); 4 tình huống mẫu nằm ở §7 và trong test |
| Tweak "Nhân vật" | Ngẫu nhiên mỗi lần mở; xem trước bằng `?sky=` |
| Tweak "Giờ" (23:00 / Giờ thật) | Giờ thật của máy người xem |
| Tweak "Chuyển động" | Theo "Giảm chuyển động" của hệ điều hành |
| Tweak "Trăng" (Rằm / Theo lịch âm / Lưỡi liềm) | `app.json → sky.moon`, mặc định rằm như thiết kế |
| Tweak "Độ trong thẻ" (0.5 – 0.95) | Cố định 0.74 như mặc định thiết kế |
| Hạng 1 mà không có người đuổi: UFO vẫn bắt "Hương Giang" | Bắt chính bạn |
| Điều ước "Ước vượt Hương Giang ngay tối nay" | Tên người ngay trên thật; đang hạng 1 thì bỏ điều ước này |
| Khung cố định 1440×940 / 390×844 | Phóng cho phủ màn thật (§1) |

Câu thoại giữ **nguyên văn** thiết kế, kể cả dấu chấm than, emoji và mặt cười — đây là giọng nhân
vật trang trí (cùng tinh thần lời chào hiện có ở trang chủ), không phải copy nút / toast mà
`DESIGN.md §7` quy định.
