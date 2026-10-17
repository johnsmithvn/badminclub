# HOME_SKY.md — Nền bầu trời

**Version:** v1.3.0 · **Updated:** 2026-10-17 · túi xáo cho mọi lựa chọn ngẫu nhiên, nhịp nhân vật mới

Toàn bộ **tình huống** và **câu thoại** của nền bầu trời động (thiết kế gốc dựng cho trang chủ cá
nhân, nay dùng chung nhiều trang), cho **cả hai chế độ** Tối (bầu trời sao) và Sáng (hoàng hôn trên
biển mây), trên **cả desktop lẫn mobile**. Thiết kế gốc: `Home · Nền bầu trời.dc.html`.

| File | Vai trò |
| --- | --- |
| `src/components/layout/SkyBackdrop.jsx` | Vẽ trời, nhân vật, cảnh siêu nhân / UFO / sao ước; tự tính số liệu từ `db` |
| `src/lib/sky.js` | Hàm thuần: trang nào có nền, bốc nhân vật, đọc số liệu, chọn câu thoại |
| `src/i18n/vi.json` → `sky.*` | Nguyên văn mọi câu thoại và nhãn |
| `src/config/app.json` → `sky` | Danh sách trang, ngưỡng, giờ khuya, kiểu trăng, nhịp sao ước / cảnh bay |
| `src/styles/effects.css` | Keyframe `sky*`, token kính `[data-sky]` |
| `src/components/layout/AppLayout.jsx` | Gắn `<SkyBackdrop>` + `data-sky` + nền gốc trong suốt theo route |
| `src/components/layout/AppHeader.jsx` | Header mobile thành kính trên trang có nền |
| `src/__tests__/lib/sky.test.js` | Khoá danh sách trang, luật chọn câu và đủ key i18n |

---

## 1. Nền hiện ở đâu, xếp lớp thế nào

Danh sách ở `app.json → sky`:

| Loại | Trang (route) | Có gì |
| --- | --- | --- |
| `routes` — nền + nhân vật | Trang chủ (`home`) · Trận đấu & Kèo (`matches`) · Bảng xếp hạng (`leaderboard`) · Danh hiệu (`badges`) · Buổi tập (`sessions`) · Thư viện (`library`) · Thành viên (`members`) · Hồ sơ của tôi (`profile`) · Cài đặt (`settings`) | Trời + nhân vật ghé thăm + sao ước (đêm) — đúng như mục 2–4 |
| `bgRoutes` — chỉ nền, đứng yên | Chi tiết buổi tập (`session`) · Bài thư viện (`libraryPost`) | Trời **tĩnh** (không hoạt hình — trang ghi điểm hay mở cả buổi tối, chạy liên tục tốn pin): nền, sao, trăng, ngân hà, đom đóm đứng yên / mây, núi, biển mây. Không sao băng, sao chổi, cá voi, chòm sao, mưa sao băng, máy bay, chim. **Không** nhân vật, **không** sao ước, không tính số liệu |
| Không có nền | Tổng quan CLB, Lịch tháng, Giải đấu (mọi trang con), Công nợ, Sổ quỹ, Sơ đồ dữ liệu | Như cũ |

- Nhân vật được bốc **một lần** khi vào nhóm trang có nền; đi qua lại giữa các trang có nền vẫn là
  nhân vật đó. Rời sang trang không có nền rồi quay lại, hoặc F5 → rút nhân vật kế trong túi (§4.1).
- Số liệu nhân vật nói theo (§5) lấy đúng bằng các hàm của thẻ trang chủ, tính lại mỗi khi dữ liệu
  CLB đồng bộ (~4 ms trên dữ liệu thật 24 người / 118 trận).
- Tài khoản chưa ghép thành viên CLB: vẫn có trời và nhân vật, nhưng không có câu theo số liệu và
  băng rôn không gọi tên.
- **Trời đứng yên, nội dung cuộn.** Hai lớp `position: fixed`:
  - Lớp trời `z-index: -1` — sau sidebar, header, thẻ. Không bắt chuột.
  - Lớp nhân vật `z-index: 35` — trên nội dung và header mobile (30), dưới footer nav mobile (40),
    dialog (60), toast (90). Chỉ chính nhân vật / bóng thoại / sao ước bắt chuột, phần còn lại click
    xuyên qua.
- **Thẻ kính:** trên trang có nền, `surface-card` · `surface-inset` · `surface-nav` · `field-bg` (và
  hai nền soft của bản sáng) có alpha (thẻ 0.74, lõm 0.65, nav 0.70) + `backdrop-filter:
  saturate(160%) blur(14px)`. Màu gốc giữ nguyên `tokens/dark.css` · `semantic.css`. Dialog dùng
  `surface-overlay` nên vẫn đặc. Header mobile (vốn nền gradient tối đặc) thành kính `surface-nav`.
  Ô / thanh dính (cột ghim bảng, thanh lọc) được làm mờ phía sau để chữ không bị nội dung cuộn
  bên dưới đè lên.
- **Cuộn xuống:** lớp nhân vật trôi lên theo và mờ dần, quá 80px thì ẩn hẳn (trời vẫn còn).
- **Đổi sáng / tối** (nút mặt trời / mặt trăng ở header trang chủ hoặc góc dưới sidebar): trời đổi
  ngay; vẫn là nhân vật đã bốc. Cảnh siêu nhân / UFO / sao ước đang bay được dọn, nhịp đếm lại từ đầu (siêu nhân sau 10 s, UFO sau 8 s, sao ước sau 3 s); băng rôn không bị ảnh hưởng.

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
| Sao ước | Xem §4.7 | Sau 3 s; bay xong nghỉ ngẫu nhiên 15 – 25 s |

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
| Đàn chim | 6 con, vỗ cánh, bay phải → trái (~17,5 s qua màn) | Bay xong nghỉ 44 s (chu kỳ 62,24 s, bắt đầu sau 4 s) |
| Mây tích | 5 cụm mây hồng đào, nhấp nhô và trôi ngang | Nhấp nhô 6 – 10 s, trôi 40 – 70 s |
| Dãy núi | Bóng núi tím phía sau biển mây | — |
| Biển mây | 3 lớp cuộn sang trái liền mạch (xa → gần), sương trôi giữa lớp 1 và 2 | 220 / 140 / 90 s, sương 26 s |
| Hạt sáng | 12 đốm sáng bay lên từ biển mây | 14 – 24 s |

Ban ngày **không có**: sao ước, mưa sao băng, chòm sao, cá voi.

---

## 4. Nhân vật ghé thăm

### 4.1 Luật bốc — túi xáo

Mọi chỗ "ngẫu nhiên" có kết quả (nhân vật, câu thoại, kết cục, điều ước, hình xếp) đều rút bằng
**túi xáo** (`lib/sky.js → createBags` / `drawCast`): xáo cả danh sách rồi rút lần lượt, **hết một
lượt — mỗi phần tử đúng một lần — mới xáo lượt mới**; hai lượt nối nhau không trùng phần tử ở chỗ
nối. Ví dụ UFO 5 kết cục: `[2, 0, 3, 1, 4]` → `[0, 4, 3, 1, 2]` → … Bấm vào nhân vật cũng rút từ
cùng túi đó. Vị trí / hướng bay / độ cao vẫn ngẫu nhiên thường.

- Mỗi lần **mở trang** (F5 / vào lại) rút **một** nhân vật từ túi 5 nhân vật. Túi nhớ qua các lần
  mở (localStorage `badminclub.sky.castBag`): 5 lần mở gặp đủ 5 nhân vật mới lặp.
  - Khuya (**22:00 → trước 04:00**, giờ máy người xem) mới được rút cú mèo. Chưa khuya thì bỏ qua
    cú — cú vẫn nằm trong túi chờ lần mở lúc khuya; túi chỉ còn cú mà chưa khuya thì xáo túi mới.
  - Trình duyệt chặn storage (chế độ riêng tư) → mỗi lần mở một túi mới.
- Chốt một lần lúc mở: đang mở trang mà đồng hồ qua 22h thì cú chưa ra, phải mở lại.
- Đổi sáng / tối **không** rút lại.
- Sao ước không thuộc lượt rút nhân vật: đêm nào cũng có.

| Nhân vật | Tối | Sáng | Có thoại | Bấm vào |
| --- | --- | --- | --- | --- |
| Cú mèo | Đậu trên trăng | Đậu trên vầng trăng non nhạt vẽ thêm | Có | Câu kế (từ túi) + nghiêng đầu |
| Máy bay băng rôn | Có đèn đỏ / xanh nhấp nháy | Máy bay tím | Có (chữ trên băng rôn) | Đổi chữ (từ túi) |
| Xếp hình | Đom đóm | Chim | Không | — |
| Siêu nhân | Có | Có | Có | Câu kế (từ túi) + 👍 |
| UFO | Thân indigo viền ngọc, tia hút xanh ngọc | Thân tím, tia hút vàng | Có (nhiều vai) | — (tự diễn) |

### 4.2 Cú mèo (chỉ sau 22h)

- Đậu trên cành dưới trăng, chớp mắt mỗi 5 s.
- Bóng thoại hiện sau 2 s kể từ lúc mở; mỗi vòng 16 s hiện ~5 s rồi ẩn, **hết vòng tự sang câu kế**.
- Câu kế rút từ túi xáo của danh sách §6.2 (đủ cả danh sách mới lặp).
- Bấm cú hoặc bấm bóng thoại → câu kế ngay, cú nghiêng đầu 0.9 s, bóng thoại hiện lại từ đầu.
- Tooltip: "Bấm để cú nói câu khác".

### 4.3 Máy bay kéo băng rôn

- Bay trái → phải ngang header, **lượt đầu sau 6 s**; mỗi lượt bay ~16,6 s, bay xong **nghỉ ngẫu
  nhiên 16 – 26 s** rồi bay lượt mới.
- Mỗi lượt mang một câu rút từ túi xáo (§6.3); bấm băng rôn → đổi câu ngay (cũng từ túi). Băng rôn
  phấp phới.
- Tooltip: "Bấm để đổi chữ".

### 4.4 Xếp hình

Đom đóm (tối) / chim (sáng) bay tới xếp thành một hình ở header, giữ một lúc rồi tản đi:

1. Chữ **TOP 1**
2. Trái tim
3. Mặt mèo
4. Mặt cười
5. Mặt ^_^
6. Quả cầu lông
7. Ngôi sao

- Vòng **30 s** một hình: bay tới ~8 s → giữ ~8 s → tản ra ~8 s → nghỉ.
- Hình rút từ túi xáo 7 hình: đủ 7 hình mới lặp, không hình nào ra hai lần liền.
- Đêm: đom đóm bay lên từ dưới, tản ra xung quanh. Ngày: chim bay tới từ bên phải, rời đi về trái.
- Không thoại, không bấm.

### 4.5 Siêu nhân

- **Lần đầu sau 10 s** kể từ lúc mở; bay trái → phải ngang header, bóng thoại bay theo bên trái.
  Desktop ~10 s một lượt bay, mobile chậm hơn. Bay xong **nghỉ 33 s** rồi bay lại.
- Mỗi lượt / mỗi lần bấm một câu rút từ túi xáo (§6.4); bấm siêu nhân → đổi câu + bật 👍.
- Tooltip: "Bấm để siêu nhân giơ ngón cái".

### 4.6 UFO bắt cóc

**Lần đầu sau 8 s** kể từ lúc mở; mỗi cảnh dài **13 – 16 s** (mobile 13 – 15 s), xong cảnh **nghỉ
29 s** rồi cảnh mới. Cảnh **tự diễn, không bấm được**. (Xem trước `?sky=all`: siêu nhân và UFO chạy
hai nhịp riêng nên có lúc cùng bay.)

1. UFO bay vào từ **trái hoặc phải** (ngẫu nhiên) theo đường cong, lượn rồi đứng ở header — desktop
   khoảng 56 – 74% bề ngang màn, mobile 32 – 68%. Người ngoài hành tinh xanh ngồi trong khoang kính,
   đèn quanh thân nhấp nháy, thân lắc nhẹ.
2. UFO bật tia hút xuống tận **mép dưới màn**; một người từ dưới màn bị hút lên, đung đưa trong tia.
   Người bị bắt rút từ túi 2 (lần lượt đổi nhau):
   - **Bạn** — áo teal, nhãn "Bạn";
   - **Người kề bạn trên BXH mùa** — áo hồng buộc tóc, nhãn tên người đó: đang hạng 1 thì là người
     **hạng 2 đuổi theo**, không thì là người **ngay trên** bạn. Không có ai kề → luôn là bạn.
3. Người bị hút kêu **1 câu** rút từ túi xáo (§6.5).
4. Kết cục rút từ **túi 5 kết cục**: cứ 5 cảnh UFO là đủ cả 5 (thứ tự ngẫu nhiên):

| Kết cục | Diễn biến | Lời |
| --- | --- | --- |
| Bắt cóc | Người bị hút vào tàu (thu nhỏ dần rồi biến mất), UFO bay vút lên khỏi màn | UFO nói câu bắt cóc |
| Siêu nhân cứu | Tia vừa tắt thì siêu nhân bay tới từ một phía bất kỳ, đỡ người rồi bế bay đi; UFO bay mất | UFO: "?!" · Siêu nhân nói câu cứu · người được cứu cảm ơn |
| Bị bắn rơi | Tên lửa phóng từ đáy màn lên trúng UFO: chớp nổ **BÙM!**, UFO bốc cháy, lộn nhào rơi khỏi màn kèm vệt khói; người bung dù (dù teal nếu là bạn, hồng nếu là người kia) đáp xuống | UFO: "Á á á!" · người đáp dù nói câu thoát nạn |
| Tia chập | Tia chập chờn rồi tắt, người tuột rơi xuống, nảy một nhịp rồi rơi khỏi màn; UFO bay mất | UFO: "Ơ… tuột rồi?!" · người rơi nói 1 câu (từ túi) |
| Trả lại | Người bị hút lên sát tàu (thu nhỏ), một lúc sau bị thả trả xuống, đứng ngơ ngác rồi rơi khỏi màn | UFO chê 1 câu · người bị trả hỏi lại 1 câu (đều từ túi) |

- Chưa có hạng mùa → bỏ kết cục bắt cóc (không có câu "Mượn tay vợt hạng …"), túi còn 4 kết cục.
- Chữ trong bóng thoại luôn 11px dù UFO được phóng to (desktop ×1.25, mobile ×0.9).

### 4.7 Sao ước (chỉ chế độ Tối)

- Ngôi sao có vòng gạch xoay + nhãn **"Bấm để ước"**, bay chéo xuống trái ngang header trong 6,8 s.
  Ngôi đầu sau 3 s; mỗi ngôi bay xong **nghỉ ngẫu nhiên 15 – 25 s** rồi ngôi mới.
- Bấm trúng → bung 18 hạt sáng + sao bốn cánh, hiện thẻ **"Điều ước"** 4.4 s với một điều ước rút
  từ túi xáo (§6.6) — bấm đủ hết các điều ước mới lặp.

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

Mọi câu thoại được phân định rõ ràng thành hai nhóm:
- **[Cố định]**: Chuỗi tĩnh / cố định nguyên văn, không phụ thuộc thông số tài khoản (rút từ kho bằng túi xáo — §4.1).
- **[Cố định theo đ/k]**: Chữ cố định nguyên văn nhưng chỉ có mặt khi số liệu thoả điều kiện (cột Điều kiện).
- **[Theo dữ liệu]**: Chèn biến động (`{n}`, `{name}`, `{rank}`, `{gap}`, v.v.) dựa theo số liệu thật của người đang xem từ DB hoặc chỉ xuất hiện khi thoả mãn điều kiện số liệu.

---

### 6.1 Câu số liệu (§5.1) — Nhóm theo dữ liệu 100%

Dùng chung cho Cú mèo, Băng rôn, Siêu nhân (xếp sau các câu mở đầu).

| # | Điều kiện | Loại thoại | Câu (key `sky.line.*`) |
| --- | --- | --- | --- |
| 1 | Nghỉ ≥ 7 ngày | **[Cố định theo đ/k]** | "Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)" (`missRacket`) |
| 2 | Nghỉ ≥ 7 ngày | **[Theo dữ liệu: `{n}` ngày]** | "{n} ngày chưa ra sân rồi. Mai đi đánh nhé?" (`daysOff`) |
| 3 | Hạng 1 | **[Cố định theo đ/k]** | "Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ" (`leader`) |
| 4 | Hạng 1 và có người hạng 2 | **[Theo dữ liệu: `{name}`, `{n}` điểm]** | "{tên hạng 2} chỉ kém {n} điểm, đừng lơ là." (`chaser`) |
| 5 | Hạng > 1 và cách ≤ 10 điểm | **[Theo dữ liệu: `{n}` điểm, `{name}`]** | "Còn {n} điểm là vượt {tên người trên}. Năm nay phải top 1! (ง •̀_•́)ง" (`near`) |
| 6 | Hạng > 1 và cách > 10 điểm | **[Theo dữ liệu: `{rank}`, `{n}` điểm]** | "Cách hạng {hạng − 1} còn {n} điểm. Từng trận một thôi." (`far`) |
| 7 | Tụt hạng **và** không nghỉ lâu | **[Theo dữ liệu: `{n}` hạng]** | "Tụt {n} hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و" (`drop`) |
| 8 | Lên hạng **và** hạng > 1 | **[Theo dữ liệu: `{n}` hạng]** | "Vừa lên {n} hạng! Đà này ngon đấy ヽ(•‿•)ノ" (`rise`) |
| 9 | Chuỗi ≥ 2 thắng | **[Theo dữ liệu: `{n}` thắng]** | "Chuỗi {n} thắng rồi, đừng dừng lại! 🔥" (`streak`) |

---

### 6.2 Cú mèo

Danh sách rút bằng túi xáo (§4.1): **5 câu mở cố định** (bỏ khi nghỉ ≥ 7 ngày) **+ toàn bộ câu số liệu** (§6.1).

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.owl.sleep` | **[Cố định]** | Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ |
| `sky.owl.peek` | **[Cố định]** | Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬) |
| `sky.owl.hunt` | **[Cố định]** | Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬) |
| `sky.owl.late` | **[Cố định]** | Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg... |
| `sky.owl.bed` | **[Cố định]** | Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ |

---

### 6.3 Băng rôn máy bay

Danh sách rút bằng túi xáo (§4.1): **câu mở** + "Cầu lông là lý do…" + câu số liệu. Nghỉ ≥ 7 ngày: câu mở là "Vợt đang nhớ bạn đấy" và **bỏ** câu số liệu số 1 để tránh lặp.

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.banner.tonight` | **[Theo dữ liệu: `{name}`]** | {tên bạn} ơi, tối nay đánh không? |
| `sky.banner.missRacket` | **[Cố định theo đ/k]** | Vợt đang nhớ bạn đấy |
| `sky.banner.chores` | **[Cố định]** | Cầu lông là lý do chính đáng để trốn việc nhà |

---

### 6.4 Siêu nhân

Danh sách rút bằng túi xáo (§4.1): **4 câu mở cố định** + toàn bộ câu số liệu (§6.1). Hai câu trong cảnh UFO diễn ra độc lập.

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.hero.top1` | **[Cố định]** | Năm nay phải top 1! (•̀ᴗ•́)و ✧ |
| `sky.hero.saveWorld` | **[Cố định]** | Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง |
| `sky.hero.forgotBag` | **[Cố định]** | Vội đi cứu người suýt quên mang túi vợt... |
| `sky.hero.supersonic` | **[Cố định]** | Bay với vận tốc này Smash mới cháy sân! 🔥 |
| `sky.hero.rescueMe` | **[Cố định]** | Đừng lo, tôi đưa bạn ra sân! 💪 *(cảnh UFO, cứu bạn)* |
| `sky.hero.rescueRival` | **[Cố định]** | Muốn thắng thì thắng trên sân nhé! 💪 *(cảnh UFO, cứu người kia)* |

---

### 6.5 UFO

**Câu kêu khi bị hút — bạn bị bắt** (rút 1 câu bằng túi xáo trong danh sách đủ điều kiện):

| Key | Loại | Câu | Điều kiện xuất hiện |
| --- | --- | --- | --- |
| `sky.ufo.rise.court` | **[Cố định]** | Ơ ơ, chuẩn bị đi đánh cầu mà! | Luôn có |
| `sky.ufo.rise.letGo` | **[Cố định]** | Thả tôi xuống, tối nay còn có kèo! | Luôn có |
| `sky.ufo.rise.near` | **[Theo dữ liệu: `{n}`, `{name}`]** | Khoan! Còn {n} điểm nữa là tôi vượt {tên người trên}! | Hạng > 1, cách ≤ 10 điểm |
| `sky.ufo.rise.leader` | **[Cố định theo đ/k]** | Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) | Đang hạng 1 |
| `sky.ufo.rise.streak` | **[Theo dữ liệu: `{n}`]** | Chuỗi {n} thắng của tôi! Đừng mà 😭 | Chuỗi ≥ 2 trận thắng |
| `sky.ufo.rise.away` | **[Theo dữ liệu: `{n}`]** | {n} ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`) | Nghỉ ≥ 7 ngày |

**Câu kêu khi bị hút — người kề bạn bị bắt** (rút 1 bằng túi xáo trong danh sách đủ điều kiện):

| Key | Loại | Câu | Điều kiện xuất hiện |
| --- | --- | --- | --- |
| `sky.ufo.rise.court` | **[Cố định]** | Ơ ơ, chuẩn bị đi đánh cầu mà! | Luôn có |
| `sky.ufo.rise.help` | **[Theo dữ liệu: `{name}`]** | {tên bạn} ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) | Luôn có |
| `sky.ufo.rise.ahead` | **[Theo dữ liệu: `{name}`, `{n}`]** | Tôi mới hơn {tên bạn} có {n} điểm thôi, thả tôi xuống! | Bạn hạng > 1 (người bị bắt là người ngay trên) |
| `sky.ufo.rise.chasing` | **[Theo dữ liệu: `{name}`]** | Tôi đang đuổi {tên bạn} mà, thả tôi ra! | Bạn hạng 1 (người bị bắt là người đuổi theo) |

**Lời kết cục:**

| Key | Ai nói | Loại | Câu | Kết cục |
| --- | --- | --- | --- | --- |
| `sky.ufo.abductMe` | UFO | **[Theo dữ liệu: `{rank}`]** | Mượn tay vợt hạng {hạng} về hành tinh luyện tập 👽 | Bắt cóc bạn |
| `sky.ufo.abductRival` | UFO | **[Theo dữ liệu: `{name}`]** | Đã bắt cóc {tên}. Ghế trên bạn tạm trống 👽 | Bắt cóc người ngay trên |
| `sky.ufo.abductChaser` | UFO | **[Theo dữ liệu: `{name}`]** | Đã bắt cóc {tên}. Ngôi vương an toàn 👽 | Bắt cóc người đuổi theo (bạn hạng 1) |
| `sky.ufo.huh` | UFO | **[Cố định]** | ?! | Siêu nhân cứu |
| `sky.hero.rescueMe` / `rescueRival` | Siêu nhân | **[Cố định]** | xem §6.4 | Siêu nhân cứu |
| `sky.ufo.thankMe` | Bạn | **[Cố định]** | Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ | Siêu nhân cứu |
| `sky.ufo.thankRival` | Người kia | **[Cố định]** | Phù, suýt nữa không được đánh cầu! | Siêu nhân cứu |
| `sky.ufo.hit` | UFO (đang cháy) | **[Cố định]** | Á á á! | Bị bắn rơi |
| `sky.ufo.safeMe` | Bạn (bung dù) | **[Cố định]** | Phù… vẫn kịp giờ đánh cầu! (；´∀｀) | Bị bắn rơi |
| `sky.ufo.safeRival` | Người kia (bung dù) | **[Theo dữ liệu: `{name}`]** | Ai bắn đấy? {tên bạn} à?! (¬_¬) | Bị bắn rơi |
| `sky.ufo.slip` | UFO | **[Cố định]** | Ơ… tuột rồi?! | Tia chập |
| `sky.ufo.slipMe.home` | Bạn (túi 2) | **[Cố định]** | Hú vía! Về sân thôi! | Tia chập |
| `sky.ufo.slipMe.game` | Bạn (túi 2) | **[Cố định]** | Thoát! Tối nay vẫn có kèo! | Tia chập |
| `sky.ufo.slipRival.rank` | Người kia (túi 2) | **[Cố định]** | Thoát! Vẫn giữ được hạng! | Tia chập |
| `sky.ufo.slipRival.phew` | Người kia (túi 2) | **[Cố định]** | Hú vía!! | Tia chập |
| `sky.ufo.giveBack.talk` | UFO (túi 7) | **[Cố định]** | Toàn nói chuyện cầu lông, trả! | Trả lại |
| `sky.ufo.giveBack.smash` | UFO (túi 7) | **[Cố định]** | Smash mạnh quá, thủng tàu, trả! | Trả lại |
| `sky.ufo.giveBack.doubles` | UFO (túi 7) | **[Cố định]** | Đòi đánh đôi với alien, trả! | Trả lại |
| `sky.ufo.giveBack.elo` | UFO (túi 7) | **[Cố định]** | Hỏi điểm Elo suốt, trả! | Trả lại |
| `sky.ufo.giveBack.boba` | UFO (túi 7) | **[Cố định]** | Vừa lên tàu đã rủ cá cược trà sữa, trả! | Trả lại |
| `sky.ufo.giveBack.tension` | UFO (túi 7) | **[Cố định]** | Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! | Trả lại |
| `sky.ufo.giveBack.roof` | UFO (túi 7) | **[Cố định]** | Đang bay mà cứ nhảy lên smash trần tàu, trả! | Trả lại |
| `sky.ufo.huhBack.a` | Người bị trả (túi 4) | **[Cố định]** | Ủa?? | Trả lại |
| `sky.ufo.huhBack.b` | Người bị trả (túi 4) | **[Cố định]** | Ơ kìa?? | Trả lại |
| `sky.ufo.huhBack.c` | Người bị trả (túi 4) | **[Cố định]** | Bị chê à?? | Trả lại |
| `sky.ufo.huhBack.d` | Người bị trả (túi 4) | **[Cố định]** | Chưa kịp làm quen đã đuổi xuống?? | Trả lại |

---

### 6.6 Sao ước (rút 1 bằng túi xáo)

| Key | Loại | Câu | Điều kiện |
| --- | --- | --- | --- |
| `sky.wish.smash` | **[Cố định]** | Ước smash nào cũng chạm vạch | Luôn có |
| `sky.wish.net` | **[Cố định]** | Ước đối thủ đánh lưới cả trận | Luôn có |
| `sky.wish.pass` | **[Theo dữ liệu: `{name}`]** | Ước vượt {tên người trên} ngay tối nay | Có người ngay trên (hạng > 1) |
| `sky.wish.court` | **[Cố định]** | Ước buổi sau sân trống cả tối | Luôn có |
| `sky.wish.feather` | **[Cố định]** | Ước cầu không bao giờ rụng lông | Luôn có |
| `sky.wish.partner` | **[Cố định]** | Ước partner đỡ hết cầu khó | Luôn có |
| `sky.wish.string` | **[Cố định]** | Ước căng 11kg không bao giờ đứt cước | Luôn có |
| `sky.wish.miss` | **[Cố định]** | Ước đánh hụt cầu không ai nhìn thấy | Luôn có |
| `sky.wish.wife` | **[Cố định]** | Ước mua vợt 3 triệu về bảo vợ 300k | Luôn có |
| `sky.wish.both` | **[Cố định]** | Ước partner không bao giờ né quả cầu rơi giữa hai người | Luôn có |
| `sky.wish.serve` | **[Cố định]** | Ước đối thủ giao cầu quả nào cũng lỗi | Luôn có |

---

### 6.7 Chữ phụ & Tooltip — Nhóm cố định 100%

| Key | Loại | Chữ | Ở đâu |
| --- | --- | --- | --- |
| `sky.tip.owl` | **[Cố định]** | Bấm để cú nói câu khác | Tooltip cú mèo |
| `sky.tip.banner` | **[Cố định]** | Bấm để đổi chữ | Tooltip băng rôn |
| `sky.tip.hero` | **[Cố định]** | Bấm để siêu nhân giơ ngón cái | Tooltip siêu nhân |
| `sky.tip.wish` | **[Cố định]** | Bấm để ước | Nhãn dưới sao ước |
| `sky.tip.ufo` | **[Cố định]** | Bấm để trêu UFO | **Không hiển thị** — UFO không bấm được; key còn trong `vi.json` (test giữ) |
| `sky.wishTitle` | **[Cố định]** | Điều ước | Tiêu đề thẻ điều ước |
| `sky.you` | **[Cố định]** | Bạn | Nhãn dưới người bị hút khi là bạn |
| `sky.boom` | **[Cố định]** | BÙM! | Chữ nổ khi tên lửa trúng UFO |
| `sky.cons` | **[Cố định]** | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga | Tên chòm sao (desktop) |

Biểu tượng bật lên khi bấm (không phải chữ): 👍 (siêu nhân).

---

## 7. Ví dụ đầy đủ — bốn tình huống mẫu của thiết kế

Sinh thẳng từ `lib/sky.js` + `vi.json`, tên người xem là "Canh lá ngón". Mỗi danh sách là một **túi xáo** (§4.1): thứ tự dưới đây chỉ để liệt kê, khi chạy các câu ra theo thứ tự ngẫu nhiên, đủ cả túi mới lặp. Mỗi tình huống áp dụng như
nhau cho chế độ Tối và Sáng (riêng sao ước chỉ có ở Tối).

### A. Mặc định (hạng 2, tụt 1, cách Hương Giang 5 điểm, chuỗi 2, nghỉ 1 ngày)

**Cú mèo** (túi 8):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
7. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
8. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 5):

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
5. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 7):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
6. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
7. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 5 điểm nữa là tôi vượt Hương Giang! / Chuỗi 2 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 5 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 11):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó
7. Ước căng 11kg không bao giờ đứt cước
8. Ước đánh hụt cầu không ai nhìn thấy
9. Ước mua vợt 3 triệu về bảo vợ 300k
10. Ước partner không bao giờ né quả cầu rơi giữa hai người
11. Ước đối thủ giao cầu quả nào cũng lỗi

### B. Đang chuỗi thắng (hạng 2, vừa lên 1, cách 2 điểm, chuỗi 5, đánh hôm nay)

**Cú mèo** (túi 8):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
7. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
8. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 5):

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
5. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 7):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
6. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
7. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 2 điểm nữa là tôi vượt Hương Giang! / Chuỗi 5 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 2 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 11):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó
7. Ước căng 11kg không bao giờ đứt cước
8. Ước đánh hụt cầu không ai nhìn thấy
9. Ước mua vợt 3 triệu về bảo vợ 300k
10. Ước partner không bao giờ né quả cầu rơi giữa hai người
11. Ước đối thủ giao cầu quả nào cũng lỗi

### C. Đang hạng 1 (vừa lên 1, Hương Giang kém 4 điểm, chuỗi 3)

**Cú mèo** (túi 8):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
7. Hương Giang chỉ kém 4 điểm, đừng lơ là.
8. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 5):

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
4. Hương Giang chỉ kém 4 điểm, đừng lơ là.
5. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 7):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
6. Hương Giang chỉ kém 4 điểm, đừng lơ là.
7. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) / Chuỗi 3 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 1 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi đang đuổi Canh lá ngón mà, thả tôi ra!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ngôi vương an toàn 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 10 — đang hạng 1 nên không có câu vượt):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước buổi sau sân trống cả tối
4. Ước cầu không bao giờ rụng lông
5. Ước partner đỡ hết cầu khó
6. Ước căng 11kg không bao giờ đứt cước
7. Ước đánh hụt cầu không ai nhìn thấy
8. Ước mua vợt 3 triệu về bảo vợ 300k
9. Ước partner không bao giờ né quả cầu rơi giữa hai người
10. Ước đối thủ giao cầu quả nào cũng lỗi

### D. Lâu không đánh (hạng 4, tụt 2, cách VA 23 điểm, nghỉ 12 ngày)

**Cú mèo** (túi 3, bỏ 5 câu mở đầu):

1. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
2. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
3. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**Băng rôn máy bay** (túi 4):

1. Vợt đang nhớ bạn đấy
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
4. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**Siêu nhân bay ngang** (túi 7):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
6. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
7. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / 12 ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`)
- Bắt cóc — UFO: Mượn tay vợt hạng 4 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt VA** (nhãn "VA", áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 23 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc VA. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · VA: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · VA (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · VA (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · VA (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 11):

1. Ước smash nào cũng chạm vạch
2. Ước đối thủ đánh lưới cả trận
3. Ước vượt VA ngay tối nay
4. Ước buổi sau sân trống cả tối
5. Ước cầu không bao giờ rụng lông
6. Ước partner đỡ hết cầu khó
7. Ước căng 11kg không bao giờ đứt cước
8. Ước đánh hụt cầu không ai nhìn thấy
9. Ước mua vợt 3 triệu về bảo vợ 300k
10. Ước partner không bao giờ né quả cầu rơi giữa hai người
11. Ước đối thủ giao cầu quả nào cũng lỗi

---

## 8. Ca biên

| Tình huống | App xử sự |
| --- | --- |
| Chưa có hạng mùa (chưa có trên BXH) | Không câu nào về hạng / người trên; UFO bỏ kết cục bắt cóc, túi còn 4 kết cục; sao ước không có "vượt …" |
| Màn rất thấp / rất cao | Tia hút và người bị hút tính theo đúng mép dưới màn đang xem |
| Chưa đánh trận nào | `off` = 0 → không vào nhánh "lâu không đánh" |
| Đánh sáng nay, xem tối nay | `off` = 0 (tính theo ngày lịch, không theo 24 giờ) |
| Hạng 1 nhưng BXH mùa chỉ có mình | Không có câu "… chỉ kém …"; UFO luôn bắt chính bạn |
| Tên dài | Bóng thoại xuống dòng trong bề rộng tối đa (desktop 210px cú / 240px cảnh bay; mobile 196 / 180px); băng rôn một dòng |
| Tên có ký tự HTML | Hiện đúng chữ (gắn bằng `textContent` / escape), không chèn được thẻ |
| Bật "Giảm chuyển động" ở hệ điều hành | Mọi thứ đứng yên: chỉ còn trời tĩnh; cú mèo (nếu được bốc) hiện cố định với một câu rút từ túi; không băng rôn, xếp hình, sao băng, cá voi, chòm sao, siêu nhân, UFO, sao ước |
| Tab ẩn | Không sinh lượt siêu nhân / UFO / sao ước mới |
| Dữ liệu đồng bộ lại khi đang xem | Câu thoại cập nhật ở lượt nói kế tiếp, cảnh đang bay không bị cắt |
| Mở dialog / sheet | Dialog và sheet "Thêm" của DS là `fixed` z 60, nền `surface-overlay` (đặc) → nằm trên lớp nhân vật z 35. Panel thông báo z 9999. Thiệp 20/10 z 9999+. Trong lúc có dialog / lớp phủ mờ toàn màn, hoạt hình trời **tạm dừng** (đỡ giật khi gõ form) rồi chạy tiếp khi đóng |
| Mở menu / lớp phủ nằm trong một thẻ kính (menu CLB, menu tài khoản ở sidebar, menu thả của thẻ kèo, modal render trong thẻ) | Phần tử nào đang chứa con `position: fixed` thì tạm bỏ mờ, để lớp phủ phủ cả màn (bấm ra ngoài là đóng) |
| Từ trang con (chỉ nền) quay lại trang có nhân vật | Nhân vật cũ quay lại; băng rôn có thể bay ngay một lượt thay vì chờ 6 s |
| Bấm liên tục cú mèo / băng rôn / siêu nhân | Mỗi lần bấm một câu từ túi xáo: đủ cả danh sách mới lặp, không câu nào ra hai lần liền |
| Thanh dính nền đặc `surface-page` (thanh quay lại ở bài thư viện) | Giữ nền đặc như cũ: một dải màu trang che trời ở đầu bài |

---

## 9. Xem trước và kiểm tay

Thêm tham số vào URL một trang có nhân vật (§1): `?sky=owl` · `?sky=banner` · `?sky=top1` · `?sky=hero` · `?sky=ufo` ·
`?sky=all` (tất cả cùng lúc; siêu nhân và UFO chạy hai nhịp riêng nên có lúc cùng bay). `?sky=owl` không cần chờ 22h.

Checklist:

- [ ] Tối + desktop: trăng có chú Cuội, cá voi bơi ngang (~4 s sau khi mở), sao chổi, chòm sao ở góc
  phải header có tên, mưa sao băng (~10 s), sao ước bấm được ra thẻ "Điều ước".
- [ ] Sáng + desktop: hoàng hôn, mây cuộn, máy bay (~10 s), chim (~4 s); không có sao ước.
- [ ] Thẻ, sidebar, footer nav mobile trong mờ thấy trời; chữ trên thẻ vẫn đọc rõ ở cả hai chế độ.
- [ ] Cuộn nội dung: trời đứng yên, nhân vật mờ dần rồi ẩn.
- [ ] `?sky=ufo`: UFO vào từ trái hoặc phải, tia hút chạm đáy màn, người bị hút trồi lên từ dưới.
  Cảnh đầu sau ~8 s, sau đó ~42 – 45 s một lượt (cảnh 13 – 16 s + nghỉ 29 s); 5 lượt liên tiếp (~4 phút)
  phải gặp đủ năm kết cục, không lặp: bắt cóc · siêu nhân cứu · bắn rơi (BÙM, khói, bung dù) · tia chập
  tuột · trả lại. Desktop và mobile.
- [ ] `?sky=hero`: siêu nhân lần đầu sau ~10 s, bay xong nghỉ 33 s. `?sky=banner`: lượt đầu sau 6 s, nghỉ
  16 – 26 s giữa hai lượt. Đêm: sao ước đầu sau 3 s, nghỉ 15 – 25 s. Ngày: đàn chim nghỉ ~44 s giữa hai lượt.
- [ ] Bấm cú mèo / băng rôn liên tục: đủ hết các câu mới lặp. F5 năm lần (lúc khuya): gặp đủ 5 nhân vật.
- [ ] `?sky=owl`: bấm cú → đổi câu + nghiêng đầu; đổi sang Sáng → cú đậu trên vầng trăng non.
- [ ] Mobile 375px: trăng giữa màn, nhân vật không tràn ngang, footer nav không bị che.
- [ ] Câu thoại khớp số trên thẻ Hạng mùa giải / Mục tiêu / Phong độ.
- [ ] Lần lượt mở 9 trang có nền (§1): thẻ / bảng / form đọc rõ ở cả sáng lẫn tối; cột ghim bảng ở
  Trận đấu & Kèo cuộn ngang không bị chữ ô bên dưới đè.
- [ ] Chi tiết buổi tập, bài thư viện: có trời nhưng đứng yên, không nhân vật, không sao ước. Quay
  lại trang danh sách (Buổi tập / Thư viện) thì trời chạy lại và nhân vật quay về.
- [ ] Tổng quan CLB, Lịch tháng, Giải đấu, Công nợ, Sổ quỹ: không có trời, giống hệt trước.
- [ ] Mobile: header các trang Buổi tập / Thành viên / Hồ sơ / Cài đặt là kính thấy trăng phía sau,
  nhân vật bay trên header; sheet "Thêm" không còn Tổng quan CLB, Lịch tháng, Giải đấu, Công nợ,
  Sổ quỹ (nhóm Tiền biến mất).
- [ ] Trang Trận đấu & Kèo: mở menu thả trên một thẻ kèo → bấm ra ngoài là đóng.
- [ ] Desktop: mở menu CLB (đầu sidebar) và menu tài khoản (cuối sidebar) → bấm vào vùng nội dung
  là menu đóng.
- [ ] Mở video ở thẻ "Trận của bạn có video", mở chuông thông báo: lớp phủ phủ kín màn, nằm trên
  nhân vật.

---

## 10. Cấu hình (`app.json → sky`)

| Khoá | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `lateFrom` / `lateUntil` | 22 / 4 | Khung giờ có cú mèo |
| `nearGap` | 10 | Cách người trên ≤ ngần này điểm thì giục vượt, xa hơn thì "Cách hạng …" |
| `awayDays` | 7 | Nghỉ ≥ ngần này ngày là "lâu không đánh" |
| `streakMin` | 2 | Chuỗi ≥ ngần này trận thì khen |
| `moon` | `full` | `full` trăng rằm · `lunar` theo lịch âm thật · `crescent` lưỡi liềm |
| `wishFirstMs` / `wishRestMs` | 3000 / [15000, 25000] | Sao ước đầu tiên / nghỉ ngẫu nhiên sau mỗi ngôi |
| `bannerFirstMs` / `bannerRestMs` | 6000 / [16000, 26000] | Băng rôn lượt đầu / nghỉ ngẫu nhiên sau mỗi lượt |
| `heroFirstMs` / `heroGapMs` | 10000 / 33000 | Siêu nhân lần đầu / nghỉ sau mỗi lượt bay |
| `ufoFirstMs` / `ufoGapMs` | 8000 / 29000 | UFO lần đầu / nghỉ sau mỗi cảnh |

Nhịp nằm ở keyframe `effects.css` (đổi phải sửa CSS): xếp hình 30 s / hình (`skyFormTop`), đàn chim bay ~17,5 s rồi nghỉ 44 s (`skyBirds`, chu kỳ 62,24 s), một lượt băng rôn 16,64 s (`skyBannerOnce`, khớp `BANNER_FLY_MS`).

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
- **Cảnh UFO bản 1** (`ufoSceneOld`, thiết kế giữ lại nhưng không gọi tới — app đã bỏ): UFO luôn vào
  từ phải, người đứng ở header kêu 2 câu, bấm được (bấm người → 🦸 gọi siêu nhân, bấm UFO → 🎯 bắn
  tên lửa), ba kết cục bắt cóc / siêu nhân / tên lửa. Câu riêng của bản này: "Ơ kìa! Siêu nhân!
  (ﾟдﾟ)", tooltip "Bấm để gọi siêu nhân" · "Bấm để bắn tên lửa", và bản cũ của câu bắt cóc có dấu chấm
  trước 👽 ("… luyện tập. 👽", "… tạm trống. 👽", "Ngôi vương của bạn an toàn. 👽").
- **Thanh trạng thái điện thoại** (giờ 23:00, sóng, wifi, pin) trong khung mobile: chỉ là khung máy
  giả lập.

---

## 12. Khác file thiết kế (quyết định khi dựng)

| Thiết kế | App |
| --- | --- |
| Tweak "Tình huống" (Theo số liệu / Đang chuỗi thắng / Đang hạng 1 / Lâu không đánh) với số mẫu | Luôn theo **số liệu thật** của người xem (§5); 4 tình huống mẫu nằm ở §7 và trong test |
| Tweak "Nhân vật" | Mỗi lần mở rút một nhân vật từ túi xáo nhớ qua các lần mở (§4.1); xem trước bằng `?sky=` |
| Mọi lựa chọn ngẫu nhiên (câu thoại, kết cục UFO 20/28/28/11/13%, người bị bắt 50/50, điều ước, hình xếp) | **Túi xáo**: đủ một lượt mới lặp, kết cục UFO chia đều (§4.1) |
| Nhịp: sao ước 13 s · băng rôn 32 s · siêu nhân / UFO thay phiên, nghỉ 8 s · đàn chim 38 s/lượt | Sao ước nghỉ 15 – 25 s · băng rôn nghỉ 16 – 26 s · siêu nhân lần đầu 10 s rồi nghỉ 33 s · UFO lần đầu 8 s rồi nghỉ 29 s · đàn chim nghỉ 44 s (§10) |
| Tweak "Giờ" (23:00 / Giờ thật) | Giờ thật của máy người xem |
| Tweak "Chuyển động" | Theo "Giảm chuyển động" của hệ điều hành |
| Tweak "Trăng" (Rằm / Theo lịch âm / Lưỡi liềm) | `app.json → sky.moon`, mặc định rằm như thiết kế |
| Tweak "Độ trong thẻ" (0.5 – 0.95) | Cố định 0.74 như mặc định thiết kế |
| Hạng 1 mà không có người đuổi: UFO vẫn bắt "Hương Giang" | Bắt chính bạn |
| Điều ước "Ước vượt Hương Giang ngay tối nay" | Tên người ngay trên thật; đang hạng 1 thì bỏ điều ước này |
| Khung cố định 1440×940 / 390×844 | Phóng cho phủ màn thật (§1) |
| Chỉ trang chủ cá nhân | Dùng chung 9 trang có nhân vật + 2 trang con chỉ có nền (§1) |
| — (thiết kế không có trang con) | Trang con vẽ trời **đứng yên**, không nhân vật, không sao ước (đỡ tốn pin) |
| Cảnh UFO bản 2 tự diễn, không bấm | Giữ đúng như thiết kế (bỏ thử nghiệm bấm UFO bật emoji) |

**Câu bổ sung ngoài thiết kế** (CLB thêm sau, cùng giọng): cú mèo `hunt` · `late` · `bed`; siêu nhân
`saveWorld` · `forgotBag` · `supersonic`; điều ước `string` · `miss` · `wife` · `both` · `serve`; UFO trả
người `giveBack.boba` · `tension` · `roof` và `huhBack.d`; tooltip `sky.tip.ufo` (chưa hiển thị).

Câu thoại của thiết kế giữ **nguyên văn**, kể cả dấu chấm than, emoji và mặt cười — đây là giọng nhân
vật trang trí (cùng tinh thần lời chào hiện có ở trang chủ), không phải copy nút / toast mà
`DESIGN.md §7` quy định.
