# HOME_SKY.md — Nền bầu trời

**Version:** v1.2.0 · **Updated:** 2026-10-17 · nền dùng chung nhiều trang, cảnh UFO bản 2

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
  nhân vật đó. Rời sang trang không có nền rồi quay lại, hoặc F5 → bốc lại.
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
| UFO | Thân indigo viền ngọc, tia hút xanh ngọc | Thân tím, tia hút vàng | Có (nhiều vai) | Bật emoji ngẫu nhiên (👽, 🛸, 🏸, ⚡) |

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

Lượt đầu ~2.5 s sau khi mở; mỗi cảnh dài **13 – 16 s** (mobile 13 – 15 s), nghỉ 8 s giữa hai lượt
(cùng nhịp với siêu nhân). Cảnh diễn tự động; thân tàu UFO có thể bấm chuột để kích hoạt Easter Egg
nảy các emoji ngẫu nhiên (👽, 🛸, 🏸, ⚡). Tooltip: "Bấm để tương tác với UFO".

1. UFO bay vào từ **trái hoặc phải** (ngẫu nhiên) theo đường cong, lượn rồi đứng ở header — desktop
   khoảng 56 – 74% bề ngang màn, mobile 32 – 68%. Người ngoài hành tinh xanh ngồi trong khoang kính,
   đèn quanh thân nhấp nháy, thân lắc nhẹ.
2. UFO bật tia hút xuống tận **mép dưới màn**; một người từ dưới màn bị hút lên, đung đưa trong tia.
   **50/50** là:
   - **Bạn** — áo teal, nhãn "Bạn";
   - **Người kề bạn trên BXH mùa** — áo hồng buộc tóc, nhãn tên người đó: đang hạng 1 thì là người
     **hạng 2 đuổi theo**, không thì là người **ngay trên** bạn. Không có ai kề → luôn là bạn.
3. Người bị hút kêu **1 câu** bốc ngẫu nhiên (§6.5).
4. Một trong năm kết cục:

| Kết cục | Tỉ lệ | Diễn biến | Lời |
| --- | --- | --- | --- |
| Bắt cóc | 20% | Người bị hút vào tàu (thu nhỏ dần rồi biến mất), UFO bay vút lên khỏi màn | UFO nói câu bắt cóc |
| Siêu nhân cứu | 28% | Tia vừa tắt thì siêu nhân bay tới từ một phía bất kỳ, đỡ người rồi bế bay đi; UFO bay mất | UFO: "?!" · Siêu nhân nói câu cứu · người được cứu cảm ơn |
| Bị bắn rơi | 28% | Tên lửa phóng từ đáy màn lên trúng UFO: chớp nổ **BÙM!**, UFO bốc cháy, lộn nhào rơi khỏi màn kèm vệt khói; người bung dù (dù teal nếu là bạn, hồng nếu là người kia) đáp xuống | UFO: "Á á á!" · người đáp dù nói câu thoát nạn |
| Tia chập | 11% | Tia chập chờn rồi tắt, người tuột rơi xuống, nảy một nhịp rồi rơi khỏi màn; UFO bay mất | UFO: "Ơ… tuột rồi?!" · người rơi nói 1 câu |
| Trả lại | 13% | Người bị hút lên sát tàu (thu nhỏ), một lúc sau bị thả trả xuống, đứng ngơ ngác rồi rơi khỏi màn | UFO chê 1 câu · người bị trả hỏi lại 1 câu |

- Chưa có hạng mùa → bỏ kết cục bắt cóc (không có câu "Mượn tay vợt hạng …"), bốn kết cục còn lại
  chia lại tỉ lệ (35 / 35 / 13.75 / 16.25%).
- Chữ trong bóng thoại luôn 11px dù UFO được phóng to (desktop ×1.25, mobile ×0.9).

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

Mọi câu thoại được phân định rõ ràng thành hai nhóm:
- **[Cố định]**: Chuỗi tĩnh / cố định nguyên văn, không phụ thuộc thông số tài khoản (có thể bốc ngẫu nhiên từ kho hoặc theo thứ tự cố định).
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

Thứ tự xoay vòng: **5 câu mở cố định** (bỏ khi nghỉ ≥ 7 ngày) **+ toàn bộ câu số liệu** (§6.1).

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.owl.sleep` | **[Cố định]** | Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ |
| `sky.owl.peek` | **[Cố định]** | Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬) |
| `sky.owl.hunt` | **[Cố định]** | Giờ này chỉ có cú với cao thủ cầu lông còn thức. |
| `sky.owl.late` | **[Cố định]** | Ngủ sớm mai smash mới cắm được! |
| `sky.owl.bed` | **[Cố định]** | Cầu thủ chuyên nghiệp giờ này đã ngáy khò khò rồi. |

---

### 6.3 Băng rôn máy bay

Thứ tự: **câu mở** → "Cầu lông là lý do…" → câu số liệu. Nghỉ ≥ 7 ngày: câu mở là "Vợt đang nhớ bạn đấy" và **bỏ** câu số liệu số 1 để tránh lặp.

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.banner.tonight` | **[Theo dữ liệu: `{name}`]** | {tên bạn} ơi, tối nay đánh không? |
| `sky.banner.missRacket` | **[Cố định theo đ/k]** | Vợt đang nhớ bạn đấy |
| `sky.banner.chores` | **[Cố định]** | Cầu lông là lý do chính đáng để trốn việc nhà |

---

### 6.4 Siêu nhân

Thứ tự: **4 câu mở cố định** + toàn bộ câu số liệu (§6.1). Hai câu trong cảnh UFO diễn ra độc lập.

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.hero.top1` | **[Cố định]** | Năm nay phải top 1! (•̀ᴗ•́)و ✧ |
| `sky.hero.saveWorld` | **[Cố định]** | Đang đi cứu thế giới nhưng vẫn nhớ lịch đánh cầu! |
| `sky.hero.forgotBag` | **[Cố định]** | Chết dở, bay nhanh quá quên mang túi vợt! 🏸 |
| `sky.hero.supersonic` | **[Cố định]** | Bay vận tốc siêu thanh cũng không nhanh bằng quả smash dọc biên! |
| `sky.hero.rescueMe` | **[Cố định]** | Đừng lo, tôi đưa bạn ra sân! 💪 *(cảnh UFO, cứu bạn)* |
| `sky.hero.rescueRival` | **[Cố định]** | Muốn thắng thì thắng trên sân nhé! 💪 *(cảnh UFO, cứu người kia)* |

---

### 6.5 UFO

**Câu kêu khi bị hút — bạn bị bắt** (bốc 1 câu ngẫu nhiên trong danh sách đủ điều kiện):

| Key | Loại | Câu | Điều kiện xuất hiện |
| --- | --- | --- | --- |
| `sky.ufo.rise.court` | **[Cố định]** | Ơ ơ, chuẩn bị đi đánh cầu mà! | Luôn có |
| `sky.ufo.rise.letGo` | **[Cố định]** | Thả tôi xuống, tối nay còn có kèo! | Luôn có |
| `sky.ufo.rise.near` | **[Theo dữ liệu: `{n}`, `{name}`]** | Khoan! Còn {n} điểm nữa là tôi vượt {tên người trên}! | Hạng > 1, cách ≤ 10 điểm |
| `sky.ufo.rise.leader` | **[Cố định theo đ/k]** | Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) | Đang hạng 1 |
| `sky.ufo.rise.streak` | **[Theo dữ liệu: `{n}`]** | Chuỗi {n} thắng của tôi! Đừng mà 😭 | Chuỗi ≥ 2 trận thắng |
| `sky.ufo.rise.away` | **[Theo dữ liệu: `{n}`]** | {n} ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`) | Nghỉ ≥ 7 ngày |

**Câu kêu khi bị hút — người kề bạn bị bắt** (bốc 1 trong danh sách đủ điều kiện):

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
| `sky.ufo.slipMe.home` | Bạn (bốc 1/2) | **[Cố định]** | Hú vía! Về sân thôi! | Tia chập |
| `sky.ufo.slipMe.game` | Bạn (bốc 1/2) | **[Cố định]** | Thoát! Tối nay vẫn có kèo! | Tia chập |
| `sky.ufo.slipRival.rank` | Người kia (bốc 1/2) | **[Cố định]** | Thoát! Vẫn giữ được hạng! | Tia chập |
| `sky.ufo.slipRival.phew` | Người kia (bốc 1/2) | **[Cố định]** | Hú vía!! | Tia chập |
| `sky.ufo.giveBack.talk` | UFO (bốc 1/7) | **[Cố định]** | Toàn nói chuyện cầu lông, trả! | Trả lại |
| `sky.ufo.giveBack.smash` | UFO (bốc 1/7) | **[Cố định]** | Smash mạnh quá, thủng tàu, trả! | Trả lại |
| `sky.ufo.giveBack.doubles` | UFO (bốc 1/7) | **[Cố định]** | Đòi đánh đôi với alien, trả! | Trả lại |
| `sky.ufo.giveBack.elo` | UFO (bốc 1/7) | **[Cố định]** | Hỏi điểm Elo suốt, trả! | Trả lại |
| `sky.ufo.giveBack.boba` | UFO (bốc 1/7) | **[Cố định]** | Vừa lên tàu đã rủ cá cược trà sữa, trả! | Trả lại |
| `sky.ufo.giveBack.tension` | UFO (bốc 1/7) | **[Cố định]** | Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! | Trả lại |
| `sky.ufo.giveBack.roof` | UFO (bốc 1/7) | **[Cố định]** | Đang bay mà cứ nhảy lên smash trần tàu, trả! | Trả lại |
| `sky.ufo.huhBack.a` | Người bị trả (bốc 1/4) | **[Cố định]** | Ủa?? | Trả lại |
| `sky.ufo.huhBack.b` | Người bị trả (bốc 1/4) | **[Cố định]** | Ơ kìa?? | Trả lại |
| `sky.ufo.huhBack.c` | Người bị trả (bốc 1/4) | **[Cố định]** | Bị chê à?? | Trả lại |
| `sky.ufo.huhBack.d` | Người bị trả (bốc 1/4) | **[Cố định]** | Chưa kịp làm quen đã đuổi xuống?? | Trả lại |

---

### 6.6 Sao ước (bốc ngẫu nhiên 1)

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
| `sky.tip.ufo` | **[Cố định]** | Bấm để tương tác với UFO | Tooltip UFO |
| `sky.tip.wish` | **[Cố định]** | Bấm để ước | Nhãn dưới sao ước |
| `sky.wishTitle` | **[Cố định]** | Điều ước | Tiêu đề thẻ điều ước |
| `sky.you` | **[Cố định]** | Bạn | Nhãn dưới người bị hút khi là bạn |
| `sky.boom` | **[Cố định]** | BÙM! | Chữ nổ khi tên lửa trúng UFO |
| `sky.cons` | **[Cố định]** | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga | Tên chòm sao (desktop) |

Biểu tượng bật lên khi bấm (không phải chữ): 👍 (siêu nhân), 👽 · 🛸 · 🏸 · ⚡ (UFO).

---

## 7. Ví dụ đầy đủ — bốn tình huống mẫu của thiết kế

Sinh thẳng từ `lib/sky.js` + `vi.json`, tên người xem là "Canh lá ngón". Mỗi tình huống áp dụng như
nhau cho chế độ Tối và Sáng (riêng sao ước chỉ có ở Tối).

### A. Mặc định (hạng 2, tụt 1, cách Hương Giang 5 điểm, chuỗi 2, nghỉ 1 ngày)

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Giờ này chỉ có cú với cao thủ cầu lông còn thức.
4. Ngủ sớm mai smash mới cắm được!
5. Cầu thủ chuyên nghiệp giờ này đã ngáy khò khò rồi.
6. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
7. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
8. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
5. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Đang đi cứu thế giới nhưng vẫn nhớ lịch đánh cầu!
3. Chết dở, bay nhanh quá quên mang túi vợt! 🏸
4. Bay vận tốc siêu thanh cũng không nhanh bằng quả smash dọc biên!
5. Còn 5 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
6. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
7. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 5 điểm nữa là tôi vượt Hương Giang! / Chuỗi 2 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (bốc 1/2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 5 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (bốc 1/2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, bốc ngẫu nhiên 1 trong 11):

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

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Giờ này chỉ có cú với cao thủ cầu lông còn thức.
4. Ngủ sớm mai smash mới cắm được!
5. Cầu thủ chuyên nghiệp giờ này đã ngáy khò khò rồi.
6. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
7. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
8. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
4. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
5. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Đang đi cứu thế giới nhưng vẫn nhớ lịch đánh cầu!
3. Chết dở, bay nhanh quá quên mang túi vợt! 🏸
4. Bay vận tốc siêu thanh cũng không nhanh bằng quả smash dọc biên!
5. Còn 2 điểm là vượt Hương Giang. Năm nay phải top 1! (ง •̀_•́)ง
6. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
7. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 2 điểm nữa là tôi vượt Hương Giang! / Chuỗi 5 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (bốc 1/2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 2 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (bốc 1/2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, bốc ngẫu nhiên 1 trong 11):

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

**Cú mèo** (xoay vòng theo thứ tự):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Giờ này chỉ có cú với cao thủ cầu lông còn thức.
4. Ngủ sớm mai smash mới cắm được!
5. Cầu thủ chuyên nghiệp giờ này đã ngáy khò khò rồi.
6. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
7. Hương Giang chỉ kém 4 điểm, đừng lơ là.
8. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay:**

1. Canh lá ngón ơi, tối nay đánh không?
2. Cầu lông là lý do chính đáng để trốn việc nhà
3. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
4. Hương Giang chỉ kém 4 điểm, đừng lơ là.
5. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang:**

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Đang đi cứu thế giới nhưng vẫn nhớ lịch đánh cầu!
3. Chết dở, bay nhanh quá quên mang túi vợt! 🏸
4. Bay vận tốc siêu thanh cũng không nhanh bằng quả smash dọc biên!
5. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
6. Hương Giang chỉ kém 4 điểm, đừng lơ là.
7. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) / Chuỗi 3 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 1 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (bốc 1/2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (nhãn "Hương Giang", áo hồng buộc tóc):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi đang đuổi Canh lá ngón mà, thả tôi ra!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ngôi vương an toàn 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (bốc 1/2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Hương Giang (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, bốc ngẫu nhiên 1 trong 10 — đang hạng 1 nên không có câu vượt):

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

**Cú mèo** (xoay vòng theo thứ tự, bỏ 5 câu mở đầu):

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
2. Đang đi cứu thế giới nhưng vẫn nhớ lịch đánh cầu!
3. Chết dở, bay nhanh quá quên mang túi vợt! 🏸
4. Bay vận tốc siêu thanh cũng không nhanh bằng quả smash dọc biên!
5. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
6. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?
7. Cách hạng 3 còn 23 điểm. Từng trận một thôi.

**UFO bắt chính bạn** (nhãn "Bạn", áo teal):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / 12 ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`)
- Bắt cóc — UFO: Mượn tay vợt hạng 4 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (bốc 1/2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · Bạn (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt VA** (nhãn "VA", áo hồng buộc tóc):

- Kêu khi bị hút (bốc 1): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 23 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc VA. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Muốn thắng thì thắng trên sân nhé! 💪 · VA: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · VA (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · VA (bốc 1/2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (bốc 1/7): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Hỏi alien dùng vợt mấy U, căng mấy kg... Trả gấp! / Đang bay mà cứ nhảy lên smash trần tàu, trả! · VA (bốc 1/4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, bốc ngẫu nhiên 1 trong 11):

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
| Chưa có hạng mùa (chưa có trên BXH) | Không câu nào về hạng / người trên; UFO bỏ kết cục bắt cóc, bốn kết cục còn lại chia lại tỉ lệ; sao ước không có "vượt …" |
| Màn rất thấp / rất cao | Tia hút và người bị hút tính theo đúng mép dưới màn đang xem |
| Chưa đánh trận nào | `off` = 0 → không vào nhánh "lâu không đánh" |
| Đánh sáng nay, xem tối nay | `off` = 0 (tính theo ngày lịch, không theo 24 giờ) |
| Hạng 1 nhưng BXH mùa chỉ có mình | Không có câu "… chỉ kém …"; UFO luôn bắt chính bạn |
| Tên dài | Bóng thoại xuống dòng trong bề rộng tối đa (desktop 210px cú / 240px cảnh bay; mobile 196 / 180px); băng rôn một dòng |
| Tên có ký tự HTML | Hiện đúng chữ (gắn bằng `textContent` / escape), không chèn được thẻ |
| Bật "Giảm chuyển động" ở hệ điều hành | Mọi thứ đứng yên: chỉ còn trời tĩnh; cú mèo (nếu được bốc) hiện cố định với câu đầu; không băng rôn, xếp hình, sao băng, cá voi, chòm sao, siêu nhân, UFO, sao ước |
| Tab ẩn | Không sinh lượt siêu nhân / UFO / sao ước mới |
| Dữ liệu đồng bộ lại khi đang xem | Câu thoại cập nhật ở lượt nói kế tiếp, cảnh đang bay không bị cắt |
| Mở dialog / sheet | Dialog và sheet "Thêm" của DS là `fixed` z 60, nền `surface-overlay` (đặc) → nằm trên lớp nhân vật z 20. Panel thông báo z 9999. Thiệp 20/10 z 9999+ |
| Mở menu / lớp phủ nằm trong một thẻ kính (menu CLB, menu tài khoản ở sidebar, menu thả của thẻ kèo, modal render trong thẻ) | Phần tử nào đang chứa con `position: fixed` thì tạm bỏ mờ, để lớp phủ phủ cả màn (bấm ra ngoài là đóng) |
| Thanh dính nền đặc `surface-page` (thanh quay lại ở bài thư viện) | Giữ nền đặc như cũ: một dải màu trang che trời ở đầu bài |

---

## 9. Xem trước và kiểm tay

Thêm tham số vào URL một trang có nhân vật (§1): `?sky=owl` · `?sky=banner` · `?sky=top1` · `?sky=hero` · `?sky=ufo` ·
`?sky=all` (tất cả cùng lúc; siêu nhân và UFO thay phiên). `?sky=owl` không cần chờ 22h.

Checklist:

- [ ] Tối + desktop: trăng có chú Cuội, cá voi bơi ngang (~4 s sau khi mở), sao chổi, chòm sao ở góc
  phải header có tên, mưa sao băng (~10 s), sao ước bấm được ra thẻ "Điều ước".
- [ ] Sáng + desktop: hoàng hôn, mây cuộn, máy bay (~10 s), chim (~4 s); không có sao ước.
- [ ] Thẻ, sidebar, footer nav mobile trong mờ thấy trời; chữ trên thẻ vẫn đọc rõ ở cả hai chế độ.
- [ ] Cuộn nội dung: trời đứng yên, nhân vật mờ dần rồi ẩn.
- [ ] `?sky=ufo`: UFO vào từ trái hoặc phải, tia hút chạm đáy màn, người bị hút trồi lên từ dưới.
  Xem vài lượt (~22 s một lượt) để gặp đủ năm kết cục: bắt cóc · siêu nhân cứu · bắn rơi (BÙM, khói,
  bung dù) · tia chập tuột · trả lại. Desktop và mobile.
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
