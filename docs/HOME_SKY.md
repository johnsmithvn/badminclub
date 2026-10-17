# HOME_SKY.md — Nền bầu trời

**Version:** v1.5.0 · **Updated:** 2026-10-17 · bỏ tooltip / nhãn phụ, bỏ cảnh "người đuổi theo", réo tên đối thủ (gạ kèo, điều ước), câu mới, tên dài cắt gọn, chữ giữ cỡ cố định, công tắc tắt hoạt ảnh

Toàn bộ **tình huống** và **câu thoại** của nền bầu trời động (thiết kế gốc dựng cho trang chủ cá
nhân, nay dùng chung nhiều trang), cho **cả hai chế độ** Tối (bầu trời sao) và Sáng (hoàng hôn trên
biển mây), trên **cả desktop lẫn mobile**. Thiết kế gốc: `Home · Nền bầu trời.dc.html`.

| File | Vai trò |
| --- | --- |
| `src/components/layout/SkyBackdrop.jsx` | Vẽ trời, nhân vật, cảnh siêu nhân / UFO / sao ước; tự tính số liệu từ `db` |
| `src/lib/sky.js` | Hàm thuần: trang nào có nền, bốc nhân vật, đọc số liệu, chọn câu thoại |
| `src/i18n/vi.json` → `sky.*` | Nguyên văn mọi câu thoại và nhãn |
| `src/config/app.json` → `sky` | Danh sách trang, ngưỡng, giờ khuya, kiểu trăng, nhịp sao ước / cảnh bay / hoạt cảnh đêm, thời gian yên để cú ngủ gật |
| `src/styles/effects.css` | Keyframe `sky*`, token kính `[data-sky]` |
| `src/components/layout/AppLayout.jsx` | Gắn `<SkyBackdrop>` + `data-sky` + nền gốc trong suốt theo route |
| `src/components/layout/AppHeader.jsx` | Header mobile thành kính trên trang có nền |
| `src/contexts/ThemeContext.jsx` | `skyMotion` — công tắc hoạt ảnh nền trời theo thiết bị (localStorage `badminclub.skyMotion`) |
| `src/components/settings/tabs/GeneralTab.jsx` | Thẻ "Hiển thị" ở Cài đặt → Chung: bật / tắt hoạt ảnh nền trời |
| `src/__tests__/lib/sky.test.js` | Khoá danh sách trang, luật chọn câu và đủ key i18n |

---

## 1. Nền hiện ở đâu, xếp lớp thế nào

Danh sách ở `app.json → sky`:

| Loại | Trang (route) | Có gì |
| --- | --- | --- |
| `routes` — nền + nhân vật | Trang chủ (`home`) · Trận đấu & Kèo (`matches`) · Bảng xếp hạng (`leaderboard`) · Danh hiệu (`badges`) · Buổi tập (`sessions`) · Thư viện (`library`) · Thành viên (`members`) · Hồ sơ của tôi (`profile`) · Cài đặt (`settings`) | Trời + nhân vật ghé thăm + sao ước (đêm) — đúng như mục 2–4 |
| `bgRoutes` — chỉ nền, đứng yên | Chi tiết buổi tập (`session`) · Bài thư viện (`libraryPost`) | Trời **tĩnh** (không hoạt hình — trang ghi điểm hay mở cả buổi tối, chạy liên tục tốn pin): nền, sao, trăng, ngân hà, đom đóm đứng yên / mây, núi, biển mây. Không sao băng, sao chổi, cá voi, chòm sao, mưa sao băng, máy bay, chim, không hoạt cảnh đêm (§2.1). **Không** nhân vật, **không** sao ước, không tính số liệu |
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
- **Tắt hoạt ảnh** (Cài đặt → Chung → Hiển thị → "Hoạt ảnh nền trời"): áp dụng ngay, riêng thiết bị
  đó, mọi người dùng đều chỉnh được (không qua nút Lưu của CLB). Tắt thì trời vẫn vẽ đủ (trăng, sao,
  ngân hà / mây, núi, biển mây) nhưng **đứng yên** — giống hệt khi hệ điều hành bật "Giảm chuyển
  động" (§8). Hệ điều hành đang bật "Giảm chuyển động" thì công tắc khoá ở trạng thái tắt, kèm ghi chú.
- **Cỡ chữ:** khung phóng theo màn (desktop lớn ×1.3 – 1.6) nhưng chữ bóng thoại, băng rôn, thẻ điều
  ước, nhãn tên được bù lại (`--sky-k` = 1 / phóng) nên luôn đúng cỡ thiết kế: bóng thoại 11,5px, băng
  rôn 11px, thẻ điều ước 12px, bóng thoại UFO 11px, nhãn tên 9px.
- **Đổi sáng / tối** (nút mặt trời / mặt trăng ở header trang chủ hoặc góc dưới sidebar): trời đổi
  ngay; vẫn là nhân vật đã bốc. Cảnh siêu nhân / UFO / sao ước đang bay được dọn, nhịp đếm lại từ đầu (siêu nhân sau 10 s, UFO sau 8 s, sao ước sau 3 s); băng rôn không bị ảnh hưởng. Hoạt cảnh đêm (§2.1) đang diễn thì tắt; quay lại Tối thì đếm lại từ đầu (cực quang sau 50 s …).

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
> header, bấm vào để ước. Ở lâu trên trang thì lần lượt có cực quang, chú Cuội đứng dậy đánh cầu,
> quả cầu lông lửa và nguyệt thực trăng máu (§2.1).

| Thành phần | Mô tả | Nhịp |
| --- | --- | --- |
| Nền | Xanh đêm đậm dần xuống chân trời | — |
| Tinh vân | Ba quầng tím / xanh ngọc / hồng tím mờ, trôi nhẹ | 34 s, qua lại |
| Ngân hà | Dải sáng nghiêng −17° + bụi sao trong dải | Bụi sao lấp lánh 9 s |
| Sao nền | 4 lớp lặp, mờ dần về đáy | Lấp lánh 7 / 4.5 / 6.5 / 5.5 s |
| Sao sáng | 12 ngôi sao chữ thập, vừa nhấp nháy vừa xoay | 4.4 – 7.4 s |
| Trăng | Trăng rằm, quầng sáng thở; trên mặt trăng là chú Cuội ngồi gốc cây đa (tới lượt thì đứng dậy đánh cầu, §2.1) | Quầng 9 s |
| Cá voi sao | Bơi từ phải sang trái, vệt sao sau đuôi, phun bụi sao, quẫy đuôi / vây, chòm sao trên lưng. **Nhả bụi sao:** mỗi lượt bơi, tới ~¼ đường thì phun vọt một chùm 16 hạt bụi sao lớn (trắng / xanh / vàng / tím) lên cao, lắng xuống rồi trôi lại phía sau đuôi, tắt trong ~12% lượt bơi | 90 s/lượt (bắt đầu sau 4 s), mobile 44 s (sau 3 s); nhả bụi cùng nhịp lượt bơi |
| Sao băng nhỏ | 5 vệt chéo | 9 / 13 / 17 / 23 / 19 s |
| Sao chổi | Đầu sáng xanh ngọc, đuôi dài 320px, bay ngang cả trời | 40 s/lượt (bắt đầu sau 6 s) |
| Đom đóm | 24 đốm xanh vàng lượn và chớp ở nửa dưới | 12 – 22 s |
| Chòm sao | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga. Mỗi ~25 s một chòm hiện ở header: nét nối tự vẽ ra, giữ ~12 s rồi tắt. Mỗi lần hiện đổi chỗ một chút và nghiêng ±8° | Vòng 150 s |
| Mưa sao băng | 14 vệt quét chéo qua cả màn, **nằm trên nội dung** | 42 s/trận (trận đầu sau 10 s) |
| Sương đáy | 32% dưới cùng ửng xanh | — |
| Sao ước | Xem §4.7 | Sau 3 s; bay xong nghỉ ngẫu nhiên 15 – 25 s |

### 2.1 Hoạt cảnh đêm định kỳ

Chỉ ở chế độ Tối, trên trang có nhân vật (§1), đêm nào cũng có — **không** thuộc lượt bốc nhân vật,
**không thoại, không chữ, không bấm**. Mỗi hoạt cảnh có nhịp riêng: lượt đầu sau `…FirstMs`, rồi cứ
`…EveryMs` một lượt (tính từ lúc lượt trước bắt đầu). Chỉ dựng lúc đang diễn, diễn xong là gỡ. Tab
ẩn đúng lúc tới lượt → bỏ lượt đó, chờ lượt sau.

| Hoạt cảnh | Diễn biến | Lượt đầu | Lặp | Dài |
| --- | --- | --- | --- | --- |
| Cực quang | Ba dải màn sáng xanh ngọc / tím hồng nằm nghiêng ở nửa trên trời, hiện dần, uốn lượn qua lại, có tia sáng dọc trôi bên trong, rồi tắt dần. Phủ mờ cả trước trăng (như thật — cực quang ở trong khí quyển); nằm sau nhân vật và nội dung | 50 s | 50 s | 30 s |
| Chú Cuội đánh cầu | Chú Cuội trên mặt trăng đứng dậy, lấy đà vung vợt; quả cầu bay vào từ mép phải mặt trăng, bị đánh văng ra ngoài; chú ngồi lại gốc đa | 60 s | 60 s | 7 s |
| Quả cầu lông lửa | Sao băng đầu là quả cầu lông bốc lửa (đế + váy lông), đuôi xoè như chùm lông cháy, có tàn lửa lấp lánh; lao chéo xuống trái từ nửa phải phần trời đang thấy, mỗi lượt điểm xuất phát khác nhau. **Nằm trên nội dung** (như mưa sao băng) | 90 s | 90 s | 3,6 s |
| Nguyệt thực trăng máu | Bóng Trái Đất trượt vào che trăng từ trái, trăng chuyển đỏ đồng, quầng đỏ toả quanh; giữ một lúc rồi bóng trượt ra bên phải, trăng sáng lại. Cú mèo / chú Cuội vẫn ở trên trăng | 2 phút | 2 phút | 32 s |

Các nhịp chạy độc lập nên thỉnh thoảng trùng nhau (vd. giây 120: cực quang đang hiện thì chú Cuội
và nguyệt thực cùng bắt đầu). Với trăng `lunar` / `crescent`
(§10), chú Cuội và nguyệt thực chỉ hiện trong phần trăng đang sáng.

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

Ban ngày **không có**: sao ước, mưa sao băng, chòm sao, cá voi, hoạt cảnh đêm (§2.1).

---

## 4. Nhân vật ghé thăm

### 4.1 Luật bốc — túi xáo

Mọi chỗ "ngẫu nhiên" có kết quả (nhân vật, câu thoại, kết cục, điều ước, hình xếp) đều rút bằng
**túi xáo** (`lib/sky.js → createBags` / `drawCast`): xáo cả danh sách rồi rút lần lượt, **hết một
lượt — mỗi phần tử đúng một lần — mới xáo lượt mới**; hai lượt nối nhau không trùng phần tử ở chỗ
nối. Ví dụ UFO 5 kết cục: `[2, 0, 3, 1, 4]` → `[0, 4, 3, 1, 2]` → … Bấm vào nhân vật cũng rút từ
cùng túi đó. Vị trí / hướng bay / độ cao vẫn ngẫu nhiên thường.

Túi của mỗi nhân vật gồm **cả câu cố định lẫn câu theo số liệu của chính người đang xem** (mỗi người
một danh sách khác nhau — §7). Số liệu đồng bộ lại làm danh sách dài / ngắn đi thì túi đó xáo lại từ
đầu; số đổi mà số câu giữ nguyên thì túi đi tiếp, câu ra sau mang số mới.

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
| Cú mèo | Đậu trên trăng | Đậu trên vầng trăng non nhạt vẽ thêm | Có | Câu kế (từ túi) + nghiêng đầu; đang ngủ gật thì giật mình (§4.2) |
| Máy bay băng rôn | Có đèn đỏ / xanh nhấp nháy | Máy bay tím | Có (chữ trên băng rôn) | Đổi chữ (từ túi) |
| Xếp hình | Đom đóm (chỉ đêm) | — | Không | — |
| Siêu nhân | Có | Có | Có | Câu kế (từ túi) + 👍 |
| UFO | Thân indigo viền ngọc, tia hút xanh ngọc | Thân tím, tia hút vàng | Có (nhiều vai) | — (tự diễn) |

### 4.2 Cú mèo (chỉ sau 22h)

- Đậu trên cành dưới trăng, chớp mắt mỗi 5 s.
- Bóng thoại hiện sau 2 s kể từ lúc mở; mỗi vòng 16 s hiện ~5 s rồi ẩn, **hết vòng tự sang câu kế**.
- Câu kế rút từ túi xáo của danh sách §6.2 (đủ cả danh sách mới lặp).
- **Bấm con cú** → câu kế ngay, cú nghiêng đầu 0.9 s, bóng thoại hiện lại từ đầu.
- **Bấm bóng thoại** → tắt bóng (cho khỏi che nội dung); bóng tắt luôn tới khi bấm con cú.
- Không tooltip, không nhãn — để người dùng tự khám phá.

**Ngủ gật — giật mình** (cả Tối lẫn Sáng):

1. Để màn hình **yên 20 – 30 s** (ngẫu nhiên, rút lại mỗi lần cú thức) — không rê chuột, bấm, gõ
   phím, lăn chuột, chạm hay cuộn ở bất kỳ đâu trên trang, và tab đang mở — thì cú ngủ gật.
2. Trong ~2,5 s: mí mắt sụp dần (có một nhịp hé ra như cố gượng) rồi nhắm hẳn; đầu gục dần về phía
   trước, có một cái giật đầu giữa chừng; mỏ chúc xuống. Sau đó thở đều trong tư thế gục.
3. Bóng thoại tắt. Thay vào đó bóng **"zzZ"** to dần rồi vỡ **"pop!"**, lặp mỗi 4 s.
4. Cú ngủ tới khi **bị bấm** (rê chuột / cuộn không đánh thức).
5. Bấm cú lúc đang ngủ → **giật mình** 1,3 s: bật nảy, lắc người, **xù lông** (nét lông dựng quanh
   thân), **mắt tròn xoe** (mắt to ra, con ngươi co nhỏ rồi trở lại), mở trừng ~1,6 s rồi mới chớp
   lại. Một **cọng lông** rơi lơ lửng, đung đưa xuống tận **đáy màn** trong 5,5 s.
6. Bóng thoại hiện ngay với **câu giật mình** rút từ túi 2 (§6.2, lần lượt đổi nhau). Hết vòng bóng
   thoại (16 s) hoặc bấm tiếp → quay về câu thường (từ túi). Đồng hồ yên lặng đếm lại từ đầu.

### 4.3 Máy bay kéo băng rôn

- Bay trái → phải ngang header, **lượt đầu sau 6 s**; mỗi lượt bay ~16,6 s, bay xong **nghỉ ngẫu
  nhiên 16 – 26 s** rồi bay lượt mới.
- Mỗi lượt mang một câu rút từ túi xáo (§6.3); bấm băng rôn → đổi câu ngay (cũng từ túi). Băng rôn
  phấp phới.
- Không tooltip. Câu dài quá 440px (mobile 260px) thì cắt "…" — rê chuột vào băng rôn xem đủ câu.

### 4.4 Xếp hình (chỉ ban đêm)

Đom đóm bay từ dưới lên xếp thành một hình ở header, giữ một lúc rồi tản đi:

1. Chữ **SIU**
2. **Trái tim viền** (rỗng bên trong)
3. **Mặt cười**
4. **Mặt ^_^**
5. **Mặt nháy mắt ;)**

- Vòng **30 s** một hình: bay tới ~8 s → giữ ~8 s → tản ra ~8 s → nghỉ.
- Hình rút từ túi xáo 5 hình: đủ 5 hình mới lặp, không hình nào ra hai lần liền.
- Ban ngày: **không có xếp hình** (đã bỏ đàn chim xếp hình).
- Không thoại, không bấm.

### 4.5 Siêu nhân

- **Lần đầu sau 10 s** kể từ lúc mở; bay trái → phải ngang header, bóng thoại bay theo bên trái.
  Desktop ~10 s một lượt bay, mobile chậm hơn. Bay xong **nghỉ 33 s** rồi bay lại.
- Mỗi lượt / mỗi lần bấm một câu rút từ túi xáo (§6.4); bấm siêu nhân → đổi câu + bật 👍.
- Không tooltip.

### 4.6 UFO bắt cóc

**Lần đầu sau 8 s** kể từ lúc mở; mỗi cảnh dài **13 – 16 s** (mobile 13 – 15 s), xong cảnh **nghỉ
29 s** rồi cảnh mới. Cảnh **tự diễn, không bấm được**. (Xem trước `?sky=all`: siêu nhân và UFO chạy
hai nhịp riêng nên có lúc cùng bay.)

1. UFO bay vào từ **trái hoặc phải** (ngẫu nhiên) theo đường cong, lượn rồi đứng ở header — desktop
   khoảng 56 – 74% bề ngang màn, mobile 32 – 68%. Người ngoài hành tinh xanh ngồi trong khoang kính,
   đèn quanh thân nhấp nháy, thân lắc nhẹ.
2. UFO bật tia hút xuống tận **mép dưới màn**; một người từ dưới màn bị hút lên, đung đưa trong tia.
   Người bị bắt rút từ túi 2 (lần lượt đổi nhau):
   - **Bạn** — áo teal;
   - **Người ngay trên bạn trên BXH mùa** — áo hồng buộc tóc. Đang hạng 1 hoặc chưa có hạng (không
     có người trên) → luôn là bạn.

   Dưới chân người bị hút có **nhãn tên** — tên thật của bạn / của người kia (không ghi "Bạn"), tên
   dài cắt "…" ở 80px. Tài khoản chưa ghép thành viên thì bạn không có tên → không nhãn.
3. Người bị hút kêu **1 câu** rút từ túi xáo (§6.5).
4. Kết cục rút từ **túi 5 kết cục**: cứ 5 cảnh UFO là đủ cả 5 (thứ tự ngẫu nhiên):

| Kết cục | Diễn biến | Lời |
| --- | --- | --- |
| Bắt cóc | Người bị hút vào tàu (thu nhỏ dần rồi biến mất), UFO bay vút lên khỏi màn | UFO nói câu bắt cóc |
| Siêu nhân cứu | Tia vừa tắt thì siêu nhân bay tới từ một phía bất kỳ, đỡ người rồi bế bay đi; UFO bay mất | UFO: "?!" · Siêu nhân nói câu cứu (cùng một câu cho ai cũng vậy) · người được cứu cảm ơn |
| Bị bắn rơi | Tên lửa phóng từ đáy màn lên trúng UFO: chớp nổ **BÙM!**, UFO bốc cháy, lộn nhào rơi khỏi màn kèm vệt khói; người bung dù (dù teal nếu là bạn, hồng nếu là người kia) đáp xuống | UFO: "Á á á!" · người đáp dù nói câu thoát nạn |
| Tia chập | Tia chập chờn rồi tắt, người tuột rơi xuống, nảy một nhịp rồi rơi khỏi màn; UFO bay mất | UFO: "Ơ… tuột rồi?!" · người rơi nói 1 câu (từ túi) |
| Trả lại | Người bị hút lên sát tàu (thu nhỏ), một lúc sau bị thả trả xuống, đứng ngơ ngác rồi rơi khỏi màn | UFO chê 1 câu · người bị trả hỏi lại 1 câu (đều từ túi) |

- Chưa có hạng mùa → bỏ kết cục bắt cóc (không có câu "Mượn tay vợt hạng …"), túi còn 4 kết cục.
- Chữ trong bóng thoại luôn 11px dù UFO được phóng to (desktop ×1.25, mobile ×0.9) và dù khung bị
  phóng theo màn (§1 "Cỡ chữ").

### 4.7 Sao ước (chỉ chế độ Tối)

- Ngôi sao có vòng gạch xoay (**không nhãn** — để người dùng tự khám phá), bay chéo xuống trái ngang
  header trong 6,8 s. Ngôi đầu sau 3 s; mỗi ngôi bay xong **nghỉ ngẫu nhiên 15 – 25 s** rồi ngôi mới.
- Bấm trúng → bung 18 hạt sáng + sao bốn cánh, hiện thẻ (không tiêu đề, chữ 12px, rộng tối đa 280px)
  4.4 s với một điều ước rút từ túi xáo (§6.6) — bấm đủ hết các điều ước mới lặp. Điều ước réo tên
  đối thủ rút thêm **tên** từ túi xáo riêng (§5.2), nên hai lần ra cùng câu có thể là hai người khác nhau.

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
| `dare` | Trận gần nhất của mình / kỳ phùng địch thủ | Người để băng rôn "Gạ kèo …" (§5.2) |
| `foes` | Kỳ phùng địch thủ + BXH mùa | Danh sách người để điều ước réo tên (§5.2) |
| tên bạn | Thành viên đang đăng nhập | Băng rôn và UFO gọi tên |

Ngưỡng ở `app.json → sky`: `nearGap` 10 điểm (câu kêu UFO "Còn N điểm nữa là tôi vượt …") ·
`awayDays` 7 ngày · `streakMin` 2 trận.

**Tên dài:** mọi tên chèn vào câu (`{name}` — tên bạn, người trên, đối thủ) đi qua `shortName`: quá
20 ký tự thì cắt, ưu tiên cắt ở khoảng trắng, thêm "…" — vd. "Tiểu Công Chúa đang muốn đi ngủ" →
"Tiểu Công Chúa đang…", "Trông kia đàn gà con lông vàng ◕⩊◕ Đi theo mẹ…" → "Trông kia đàn gà…".

### 5.1 Bảng tình huống → câu theo số liệu

Các câu dưới đây gọi chung là **câu số liệu**, dùng chung cho cú mèo, băng rôn, siêu nhân, xếp
theo đúng thứ tự này:

| # | Điều kiện | Câu (key `sky.line.*`) |
| --- | --- | --- |
| 1 | Nghỉ ≥ 7 ngày | "Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)" (`missRacket`) |
| 2 | Nghỉ ≥ 7 ngày | "{n} ngày chưa ra sân rồi. Mai đi đánh nhé?" (`daysOff`) |
| 3 | Hạng 1 | "Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ" (`leader`) |
| 4 | Tụt hạng **và** không nghỉ lâu | "Tụt {n} hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و" (`drop`) |
| 5 | Lên hạng **và** hạng > 1 | "Vừa lên {n} hạng! Đà này ngon đấy ヽ(•‿•)ノ" (`rise`) |
| 6 | Chuỗi ≥ 2 thắng | "Chuỗi {n} thắng rồi, đừng dừng lại! 🔥" (`streak`) |

Chưa có hạng → không có câu 3–5. (Đã bỏ: "{tên hạng 2} chỉ kém …", "Còn {n} điểm là vượt …", "Cách
hạng … còn … điểm".)

### 5.2 Réo tên đối thủ

Mỗi người { tên, giới tính } lấy từ danh sách thành viên (khách giao lưu không bị réo tên).

| Câu | Ai bị réo | Không có ai |
| --- | --- | --- |
| Băng rôn "Gạ kèo {tên} đê!" | Người **vừa thắng bạn** ở trận gần nhất của bạn (trận đôi: người đầu đội thắng). Trận gần nhất bạn thắng / chưa có kết quả → **kỳ phùng địch thủ** (đối đầu ≥ 4 trận, tỷ số chênh ≤ 2 — cùng luật thẻ "Kỳ phùng địch thủ") | Không có câu này |
| Điều ước "Ước chăn được {tên}" · "Ước vồ cầu vào đầu {tên}" | Kỳ phùng địch thủ (nếu có) + **5 người cao nhất BXH mùa**, trừ bạn. Bạn là **nữ** → chỉ réo các bạn nữ (kỳ phùng địch thủ nếu là nữ + 5 bạn nữ cao nhất BXH mùa); BXH không có bạn nữ nào thì lấy như thường. Mỗi lần ước rút 1 tên bằng túi xáo riêng — đủ cả danh sách mới lặp | Không có hai điều ước này |

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
| 4 | Tụt hạng **và** không nghỉ lâu | **[Theo dữ liệu: `{n}` hạng]** | "Tụt {n} hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و" (`drop`) |
| 5 | Lên hạng **và** hạng > 1 | **[Theo dữ liệu: `{n}` hạng]** | "Vừa lên {n} hạng! Đà này ngon đấy ヽ(•‿•)ノ" (`rise`) |
| 6 | Chuỗi ≥ 2 thắng | **[Theo dữ liệu: `{n}` thắng]** | "Chuỗi {n} thắng rồi, đừng dừng lại! 🔥" (`streak`) |

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

**Ngủ gật — giật mình** (§4.2). Câu giật mình rút từ túi 2 riêng, không lẫn vào túi câu thường:

| Key | Loại | Câu / chữ | Khi nào |
| --- | --- | --- | --- |
| `sky.owl.zzz` | **[Cố định]** | zzZ | Bóng to dần lúc đang ngủ |
| `sky.owl.pop` | **[Cố định]** | pop! | Bóng zzZ vỡ |
| `sky.owl.wake.dream` | **[Cố định]** | Giật cả mình! Đang mơ smash cắm vạch! | Bị bấm lúc đang ngủ (túi 2) |
| `sky.owl.wake.fall` | **[Cố định]** | Suýt ngã khỏi cành cây! Ai bấm đấy?! | Bị bấm lúc đang ngủ (túi 2) |

---

### 6.3 Băng rôn máy bay

Danh sách rút bằng túi xáo (§4.1): **câu mở** + "Gạ kèo …" (nếu có người) + 5 câu cố định + câu số
liệu. Nghỉ ≥ 7 ngày: câu mở là "Vợt đang nhớ bạn đấy", **bỏ** câu số liệu số 1 để tránh lặp và bỏ câu
"Trốn đi đánh cầu hơi nhiều" (đang nghỉ lâu mà trêu đi đánh nhiều thì ngược).

| Key | Loại | Câu | Điều kiện |
| --- | --- | --- | --- |
| `sky.banner.tonight` | **[Theo dữ liệu: `{name}`]** | {tên bạn} ơi, tối nay đánh không? | Đã ghép thành viên, không nghỉ lâu |
| `sky.banner.missRacket` | **[Cố định theo đ/k]** | Vợt đang nhớ bạn đấy | Nghỉ ≥ 7 ngày |
| `sky.banner.dare` | **[Theo dữ liệu: `{name}`]** | Gạ kèo {tên} đê! | Có người vừa thắng bạn / kỳ phùng địch thủ (§5.2) |
| `sky.banner.chores` | **[Cố định]** | Cầu lông là lý do chính đáng để trốn việc nhà | Luôn có |
| `sky.banner.moms` | **[Cố định]** | Đi đánh cầu đê các mom | Luôn có |
| `sky.banner.wow` | **[Cố định]** | Thấy đủ wow chưa | Luôn có |
| `sky.banner.sneak` | **[Cố định theo đ/k]** | Trốn đi đánh cầu hơi nhiều nha má | Không nghỉ lâu |
| `sky.banner.hoaSen` | **[Cố định]** | Mong Tôn Hoa Sen thấy cảnh này | Luôn có |

---

### 6.4 Siêu nhân

Danh sách rút bằng túi xáo (§4.1): **6 câu mở cố định** + toàn bộ câu số liệu (§6.1). Câu trong cảnh UFO diễn ra độc lập.

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.hero.top1` | **[Cố định]** | Năm nay phải top 1! (•̀ᴗ•́)و ✧ |
| `sky.hero.saveWorld` | **[Cố định]** | Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง |
| `sky.hero.forgotBag` | **[Cố định]** | Vội đi cứu người suýt quên mang túi vợt... |
| `sky.hero.supersonic` | **[Cố định]** | Bay với vận tốc này Smash mới cháy sân! 🔥 |
| `sky.hero.riceCooker` | **[Cố định]** | Quên bật nồi cơm rồi |
| `sky.hero.noRacket` | **[Cố định]** | Đi đánh cầu mà quên mang vợt :((( |
| `sky.hero.rescue` | **[Cố định]** | Đừng lo, tôi đưa bạn ra sân! 💪 *(cảnh UFO, cứu bạn hay người kia đều câu này)* |

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

**Câu kêu khi bị hút — người ngay trên bạn bị bắt** (túi 3, cả 3 câu luôn có):

| Key | Loại | Câu |
| --- | --- | --- |
| `sky.ufo.rise.court` | **[Cố định]** | Ơ ơ, chuẩn bị đi đánh cầu mà! |
| `sky.ufo.rise.help` | **[Theo dữ liệu: `{name}`]** | {tên bạn} ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) |
| `sky.ufo.rise.ahead` | **[Theo dữ liệu: `{name}`, `{n}`]** | Tôi mới hơn {tên bạn} có {n} điểm thôi, thả tôi xuống! |

**Lời kết cục:**

| Key | Ai nói | Loại | Câu | Kết cục |
| --- | --- | --- | --- | --- |
| `sky.ufo.abductMe` | UFO | **[Theo dữ liệu: `{rank}`]** | Mượn tay vợt hạng {hạng} về hành tinh luyện tập 👽 | Bắt cóc bạn |
| `sky.ufo.abductRival` | UFO | **[Theo dữ liệu: `{name}`]** | Đã bắt cóc {tên}. Ghế trên bạn tạm trống 👽 | Bắt cóc người ngay trên |
| `sky.ufo.huh` | UFO | **[Cố định]** | ?! | Siêu nhân cứu |
| `sky.hero.rescue` | Siêu nhân | **[Cố định]** | xem §6.4 | Siêu nhân cứu |
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
| `sky.ufo.giveBack.talk` | UFO (túi 9) | **[Cố định]** | Toàn nói chuyện cầu lông, trả! | Trả lại |
| `sky.ufo.giveBack.smash` | UFO (túi 9) | **[Cố định]** | Smash mạnh quá, thủng tàu, trả! | Trả lại |
| `sky.ufo.giveBack.doubles` | UFO (túi 9) | **[Cố định]** | Đòi đánh đôi với alien, trả! | Trả lại |
| `sky.ufo.giveBack.elo` | UFO (túi 9) | **[Cố định]** | Hỏi điểm Elo suốt, trả! | Trả lại |
| `sky.ufo.giveBack.boba` | UFO (túi 9) | **[Cố định]** | Vừa lên tàu đã rủ cá cược trà sữa, trả! | Trả lại |
| `sky.ufo.giveBack.heavy` | UFO (túi 9) | **[Cố định]** | Nặng quá, trả! | Trả lại |
| `sky.ufo.giveBack.roof` | UFO (túi 9) | **[Cố định]** | Đang bay mà cứ nhảy lên smash trần tàu, trả! | Trả lại |
| `sky.ufo.giveBack.galaxy` | UFO (túi 9) | **[Cố định]** | Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! | Trả lại |
| `sky.ufo.giveBack.sweat` | UFO (túi 9) | **[Cố định]** | Mồ hôi đẫm áo làm chập mạch buồng lái, trả! | Trả lại |
| `sky.ufo.huhBack.a` | Người bị trả (túi 4) | **[Cố định]** | Ủa?? | Trả lại |
| `sky.ufo.huhBack.b` | Người bị trả (túi 4) | **[Cố định]** | Ơ kìa?? | Trả lại |
| `sky.ufo.huhBack.c` | Người bị trả (túi 4) | **[Cố định]** | Bị chê à?? | Trả lại |
| `sky.ufo.huhBack.d` | Người bị trả (túi 4) | **[Cố định]** | Chưa kịp làm quen đã đuổi xuống?? | Trả lại |

---

### 6.6 Sao ước (rút 1 bằng túi xáo)

| Key | Loại | Câu | Điều kiện |
| --- | --- | --- | --- |
| `sky.wish.smash` | **[Cố định]** | Ước smash nào cũng cắm vạch | Luôn có |
| `sky.wish.net` | **[Cố định]** | Ước đối thủ đánh vào lưới cả trận | Luôn có |
| `sky.wish.pass` | **[Theo dữ liệu: `{name}`]** | Ước vượt {tên người trên} ngay tối nay | Có người ngay trên (hạng > 1) |
| `sky.wish.feather` | **[Cố định]** | Ước cầu không bao giờ rụng lông | Luôn có |
| `sky.wish.partner` | **[Cố định]** | Ước partner đỡ hết cầu khó | Luôn có |
| `sky.wish.miss` | **[Cố định]** | Ước đánh hụt cầu không ai nhìn thấy | Luôn có |
| `sky.wish.both` | **[Cố định]** | Ước partner không bao giờ né quả cầu rơi giữa hai người | Luôn có |
| `sky.wish.serve` | **[Cố định]** | Ước đối thủ giao cầu quả nào cũng lỗi | Luôn có |
| `sky.wish.vibe` | **[Cố định]** | Ước xin vía tay dẻo như idol trên TikTok | Luôn có |
| `sky.wish.boss` | **[Cố định]** | Ước sếp nhắn tin: 'Hôm nay tan làm sớm đi đánh cầu đi em' | Luôn có |
| `sky.wish.own` | **[Theo dữ liệu: `{name}`]** | Ước chăn được {tên đối thủ} | Có người để réo (§5.2); tên rút lúc ước |
| `sky.wish.bonk` | **[Theo dữ liệu: `{name}`]** | Ước vồ cầu vào đầu {tên đối thủ} | Có người để réo (§5.2); tên rút lúc ước |

Đã bỏ: "Ước buổi sau sân trống cả tối", "Ước căng 11kg không bao giờ đứt cước", "Ước mua vợt 3 triệu
về bảo vợ 300k".

---

### 6.7 Chữ phụ — Nhóm cố định 100%

**Không còn tooltip / nhãn hướng dẫn nào** (đã bỏ các key sky.tip.*, sky.wishTitle, sky.you) — để
người dùng tự khám phá: bấm cú, bấm băng rôn, bấm siêu nhân, bấm sao ước.

| Key | Loại | Chữ | Ở đâu |
| --- | --- | --- | --- |
| `sky.boom` | **[Cố định]** | BÙM! | Chữ nổ khi tên lửa trúng UFO |
| `sky.cons` | **[Cố định]** | Bắc Đẩu · Thiên Hậu · Lạp Hộ · Thiên Yết · Sư Tử · Thiên Nga | Tên chòm sao (desktop) |

Biểu tượng bật lên khi bấm (không phải chữ): 👍 (siêu nhân).

---

## 7. Ví dụ đầy đủ — bốn tình huống mẫu của thiết kế

Sinh thẳng từ `lib/sky.js` + `vi.json`, tên người xem là "Canh lá ngón". Mỗi danh sách là một **túi xáo** (§4.1): thứ tự dưới đây chỉ để liệt kê, khi chạy các câu ra theo thứ tự ngẫu nhiên, đủ cả túi mới lặp. Mỗi tình huống áp dụng như
nhau cho chế độ Tối và Sáng (riêng sao ước chỉ có ở Tối). Người réo tên mẫu (§5.2): gạ kèo "Kuro"
(vừa thắng bạn); điều ước réo tên ghi `‹Kuro / Hương Giang / VA›` = mỗi lần ước rút một tên trong đó.

### A. Mặc định (hạng 2, tụt 1, cách Hương Giang 5 điểm, chuỗi 2, nghỉ 1 ngày)

**Cú mèo** (túi 7):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
7. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 9):

1. Canh lá ngón ơi, tối nay đánh không?
2. Gạ kèo Kuro đê!
3. Cầu lông là lý do chính đáng để trốn việc nhà
4. Đi đánh cầu đê các mom
5. Thấy đủ wow chưa
6. Trốn đi đánh cầu hơi nhiều nha má
7. Mong Tôn Hoa Sen thấy cảnh này
8. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
9. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 8):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Quên bật nồi cơm rồi
6. Đi đánh cầu mà quên mang vợt :(((
7. Tụt 1 hạng thôi mà, mai lấy lại cả vốn lẫn lời. (•̀ᴗ•́)و
8. Chuỗi 2 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 5 điểm nữa là tôi vượt Hương Giang! / Chuỗi 2 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 5 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Hương Giang (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 12):

1. Ước smash nào cũng cắm vạch
2. Ước đối thủ đánh vào lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước cầu không bao giờ rụng lông
5. Ước partner đỡ hết cầu khó
6. Ước đánh hụt cầu không ai nhìn thấy
7. Ước partner không bao giờ né quả cầu rơi giữa hai người
8. Ước đối thủ giao cầu quả nào cũng lỗi
9. Ước xin vía tay dẻo như idol trên TikTok
10. Ước sếp nhắn tin: 'Hôm nay tan làm sớm đi đánh cầu đi em'
11. Ước chăn được ‹Kuro / Hương Giang / VA›
12. Ước vồ cầu vào đầu ‹Kuro / Hương Giang / VA›

### B. Đang chuỗi thắng (hạng 2, vừa lên 1, cách 2 điểm, chuỗi 5, đánh hôm nay)

**Cú mèo** (túi 7):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
7. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 9):

1. Canh lá ngón ơi, tối nay đánh không?
2. Gạ kèo Kuro đê!
3. Cầu lông là lý do chính đáng để trốn việc nhà
4. Đi đánh cầu đê các mom
5. Thấy đủ wow chưa
6. Trốn đi đánh cầu hơi nhiều nha má
7. Mong Tôn Hoa Sen thấy cảnh này
8. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
9. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 8):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Quên bật nồi cơm rồi
6. Đi đánh cầu mà quên mang vợt :(((
7. Vừa lên 1 hạng! Đà này ngon đấy ヽ(•‿•)ノ
8. Chuỗi 5 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Khoan! Còn 2 điểm nữa là tôi vượt Hương Giang! / Chuỗi 5 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 2 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt Hương Giang** (áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 2 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc Hương Giang. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Hương Giang: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · Hương Giang (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · Hương Giang (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Hương Giang (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 12):

1. Ước smash nào cũng cắm vạch
2. Ước đối thủ đánh vào lưới cả trận
3. Ước vượt Hương Giang ngay tối nay
4. Ước cầu không bao giờ rụng lông
5. Ước partner đỡ hết cầu khó
6. Ước đánh hụt cầu không ai nhìn thấy
7. Ước partner không bao giờ né quả cầu rơi giữa hai người
8. Ước đối thủ giao cầu quả nào cũng lỗi
9. Ước xin vía tay dẻo như idol trên TikTok
10. Ước sếp nhắn tin: 'Hôm nay tan làm sớm đi đánh cầu đi em'
11. Ước chăn được ‹Kuro / Hương Giang / VA›
12. Ước vồ cầu vào đầu ‹Kuro / Hương Giang / VA›

### C. Đang hạng 1 (vừa lên 1, chuỗi 3)

**Cú mèo** (túi 7):

1. Khuya rồi, ngủ đi. Mai còn phải phục thù. (－_－) zzZ
2. Thức để soi BXH à? Điểm không tự tăng đâu. (¬‿¬)
3. Cú thức đêm săn mồi, bạn thức đêm săn đối thủ ngày mai à? (¬‿¬)
4. Thức khuya mai cầm vợt run tay lại đổ thừa cước căng 11kg...
5. Nửa đêm rồi, vợt đi ngủ rồi, người cũng nên ngủ thôi. (－_－) zzZ
6. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
7. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Băng rôn máy bay** (túi 9):

1. Canh lá ngón ơi, tối nay đánh không?
2. Gạ kèo Kuro đê!
3. Cầu lông là lý do chính đáng để trốn việc nhà
4. Đi đánh cầu đê các mom
5. Thấy đủ wow chưa
6. Trốn đi đánh cầu hơi nhiều nha má
7. Mong Tôn Hoa Sen thấy cảnh này
8. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
9. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**Siêu nhân bay ngang** (túi 8):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Quên bật nồi cơm rồi
6. Đi đánh cầu mà quên mang vợt :(((
7. Ngôi vương đang là của bạn, giữ chặt nhé! (￣▽￣)ゞ
8. Chuỗi 3 thắng rồi, đừng dừng lại! 🔥

**UFO bắt chính bạn** (áo teal):

- Kêu khi bị hút (túi 4): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / Bắt tôi thì ai giữ ngôi hạng 1?! (ﾟДﾟ;) / Chuỗi 3 thắng của tôi! Đừng mà 😭
- Bắt cóc — UFO: Mượn tay vợt hạng 1 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt người khác:** không có — đang hạng 1 (không có người trên) nên UFO luôn bắt chính bạn.

**Sao ước** (đêm, túi 11 — đang hạng 1 nên không có câu vượt):

1. Ước smash nào cũng cắm vạch
2. Ước đối thủ đánh vào lưới cả trận
3. Ước cầu không bao giờ rụng lông
4. Ước partner đỡ hết cầu khó
5. Ước đánh hụt cầu không ai nhìn thấy
6. Ước partner không bao giờ né quả cầu rơi giữa hai người
7. Ước đối thủ giao cầu quả nào cũng lỗi
8. Ước xin vía tay dẻo như idol trên TikTok
9. Ước sếp nhắn tin: 'Hôm nay tan làm sớm đi đánh cầu đi em'
10. Ước chăn được ‹Kuro / Hương Giang / VA›
11. Ước vồ cầu vào đầu ‹Kuro / Hương Giang / VA›

### D. Lâu không đánh (hạng 4, tụt 2, cách VA 23 điểm, nghỉ 12 ngày)

**Cú mèo** (túi 2, bỏ 5 câu mở đầu):

1. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
2. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?

**Băng rôn máy bay** (túi 7):

1. Vợt đang nhớ bạn đấy
2. Gạ kèo Kuro đê!
3. Cầu lông là lý do chính đáng để trốn việc nhà
4. Đi đánh cầu đê các mom
5. Thấy đủ wow chưa
6. Mong Tôn Hoa Sen thấy cảnh này
7. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?

**Siêu nhân bay ngang** (túi 8):

1. Năm nay phải top 1! (•̀ᴗ•́)و ✧
2. Cứu thế giới thì dễ, cứu pha cầu cắm vạch thì chịu! (ง •̀_•́)ง
3. Vội đi cứu người suýt quên mang túi vợt...
4. Bay với vận tốc này Smash mới cháy sân! 🔥
5. Quên bật nồi cơm rồi
6. Đi đánh cầu mà quên mang vợt :(((
7. Vợt đang nhớ bạn đấy. (｡•́︿•̀｡)
8. 12 ngày chưa ra sân rồi. Mai đi đánh nhé?

**UFO bắt chính bạn** (áo teal):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Thả tôi xuống, tối nay còn có kèo! / 12 ngày chưa đánh, giờ còn bị bắt cóc… (´・ω・`)
- Bắt cóc — UFO: Mượn tay vợt hạng 4 về hành tinh luyện tập 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · Bạn: Cảm ơn siêu nhân! Kịp giờ ra sân rồi ヽ(•‿•)ノ
- Bị bắn rơi — UFO: Á á á! · Bạn (bung dù): Phù… vẫn kịp giờ đánh cầu! (；´∀｀)
- Tia chập — UFO: Ơ… tuột rồi?! · Bạn (túi 2): Hú vía! Về sân thôi! / Thoát! Tối nay vẫn có kèo!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · Bạn (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**UFO bắt VA** (áo hồng buộc tóc):

- Kêu khi bị hút (túi 3): Ơ ơ, chuẩn bị đi đánh cầu mà! / Canh lá ngón ơi cứu! Hay bạn gọi UFO đấy?! (¬_¬) / Tôi mới hơn Canh lá ngón có 23 điểm thôi, thả tôi xuống!
- Bắt cóc — UFO: Đã bắt cóc VA. Ghế trên bạn tạm trống 👽
- Siêu nhân cứu — UFO: ?! · Siêu nhân: Đừng lo, tôi đưa bạn ra sân! 💪 · VA: Phù, suýt nữa không được đánh cầu!
- Bị bắn rơi — UFO: Á á á! · VA (bung dù): Ai bắn đấy? Canh lá ngón à?! (¬_¬)
- Tia chập — UFO: Ơ… tuột rồi?! · VA (túi 2): Thoát! Vẫn giữ được hạng! / Hú vía!!
- Trả lại — UFO (túi 9): Toàn nói chuyện cầu lông, trả! / Smash mạnh quá, thủng tàu, trả! / Đòi đánh đôi với alien, trả! / Hỏi điểm Elo suốt, trả! / Vừa lên tàu đã rủ cá cược trà sữa, trả! / Nặng quá, trả! / Đang bay mà cứ nhảy lên smash trần tàu, trả! / Định mượn phi thuyền đi giao lưu cầu lông liên thiên hà, trả! / Mồ hôi đẫm áo làm chập mạch buồng lái, trả! · VA (túi 4): Ủa?? / Ơ kìa?? / Bị chê à?? / Chưa kịp làm quen đã đuổi xuống??

**Sao ước** (đêm, túi 12):

1. Ước smash nào cũng cắm vạch
2. Ước đối thủ đánh vào lưới cả trận
3. Ước vượt VA ngay tối nay
4. Ước cầu không bao giờ rụng lông
5. Ước partner đỡ hết cầu khó
6. Ước đánh hụt cầu không ai nhìn thấy
7. Ước partner không bao giờ né quả cầu rơi giữa hai người
8. Ước đối thủ giao cầu quả nào cũng lỗi
9. Ước xin vía tay dẻo như idol trên TikTok
10. Ước sếp nhắn tin: 'Hôm nay tan làm sớm đi đánh cầu đi em'
11. Ước chăn được ‹Kuro / Hương Giang / VA›
12. Ước vồ cầu vào đầu ‹Kuro / Hương Giang / VA›

---

## 8. Ca biên

| Tình huống | App xử sự |
| --- | --- |
| Chưa có hạng mùa (chưa có trên BXH) | Không câu nào về hạng / người trên; UFO luôn bắt chính bạn, bỏ kết cục bắt cóc, túi còn 4 kết cục; sao ước không có "vượt …" |
| Bạn nữ | Điều ước réo tên chỉ réo các bạn nữ (§5.2) |
| Trận gần nhất thua một khách giao lưu | Khách không bị réo → "Gạ kèo" chuyển sang kỳ phùng địch thủ (nếu có) |
| Màn rất thấp / rất cao | Tia hút và người bị hút tính theo đúng mép dưới màn đang xem |
| Màn desktop rất lớn (khung phóng ×1.3 – 1.6) | Chữ bóng thoại / băng rôn / thẻ điều ước giữ đúng cỡ thiết kế, không phóng theo (§1 "Cỡ chữ") |
| Chưa đánh trận nào | `off` = 0 → không vào nhánh "lâu không đánh" |
| Đánh sáng nay, xem tối nay | `off` = 0 (tính theo ngày lịch, không theo 24 giờ) |
| Đang hạng 1 | Không có người trên → UFO luôn bắt chính bạn; không có điều ước "vượt …" |
| Tên dài (vd. "Trông kia đàn gà con lông vàng ◕⩊◕ Đi theo mẹ tìm ăn trong vườn ◍•ᴗ•◍", ~70 ký tự) | Tên chèn vào câu cắt còn ≤ 20 ký tự + "…" (§5 "Tên dài"); bóng thoại vẫn xuống dòng trong bề rộng tối đa (desktop 210px cú / 240px cảnh bay; mobile 196 / 180px) nếu câu dài. Băng rôn một dòng, quá 440px (mobile 260px) cắt "…", rê chuột xem đủ. Thẻ điều ước xuống dòng, rộng tối đa 280px. Nhãn tên dưới chân người bị UFO hút cắt "…" ở 80px |
| Tên có ký tự HTML | Hiện đúng chữ (gắn bằng `textContent` / escape), không chèn được thẻ |
| Bật "Giảm chuyển động" ở hệ điều hành, hoặc tắt "Hoạt ảnh nền trời" ở Cài đặt → Chung | Mọi thứ đứng yên: chỉ còn trời tĩnh; cú mèo (nếu được bốc) hiện cố định với một câu rút từ túi, không ngủ gật; không băng rôn, xếp hình, sao băng, cá voi, chòm sao, siêu nhân, UFO, sao ước, hoạt cảnh đêm (§2.1). Bật lại công tắc → chạy lại ngay, nhịp đếm từ đầu |
| Tab ẩn | Không sinh lượt siêu nhân / UFO / sao ước mới; hoạt cảnh đêm tới lượt thì bỏ lượt đó; cú không ngủ gật (đồng hồ yên lặng vẫn chạy: quay lại tab mà chưa đụng chuột / phím thì cú có thể ngủ ngay) |
| Đang đọc / xem video không đụng chuột | Quá 20 – 30 s là cú ngủ gật — chủ ý: cú chỉ ngủ khi bạn để yên |
| Dữ liệu đồng bộ lại khi đang xem | Câu thoại cập nhật ở lượt nói kế tiếp, cảnh đang bay không bị cắt |
| Mở dialog / sheet | Dialog và sheet "Thêm" của DS là `fixed` z 60, nền `surface-overlay` (đặc) → nằm trên lớp nhân vật z 35. Panel thông báo z 9999. Thiệp 20/10 z 9999+. Trong lúc có dialog / lớp phủ mờ toàn màn, hoạt hình trời **tạm dừng** (đỡ giật khi gõ form) rồi chạy tiếp khi đóng |
| Mở menu / lớp phủ nằm trong một thẻ kính (menu CLB, menu tài khoản ở sidebar, menu thả của thẻ kèo, modal render trong thẻ) | Phần tử nào đang chứa con `position: fixed` thì tạm bỏ mờ, để lớp phủ phủ cả màn (bấm ra ngoài là đóng) |
| Từ trang con (chỉ nền) quay lại trang có nhân vật | Nhân vật cũ quay lại; băng rôn có thể bay ngay một lượt thay vì chờ 6 s |
| Bấm liên tục con cú / băng rôn / siêu nhân | Mỗi lần bấm một câu từ túi xáo: đủ cả danh sách mới lặp, không câu nào ra hai lần liền. Bấm **bóng thoại** của cú thì bóng tắt (không đổi câu) tới khi bấm con cú |
| Thanh dính nền đặc `surface-page` (thanh quay lại ở bài thư viện) | Giữ nền đặc như cũ: một dải màu trang che trời ở đầu bài |

---

## 9. Xem trước và kiểm tay

Thêm tham số vào URL một trang có nhân vật (§1): `?sky=owl` · `?sky=banner` · `?sky=top1` · `?sky=hero` · `?sky=ufo` ·
`?sky=all` (tất cả cùng lúc; siêu nhân và UFO chạy hai nhịp riêng nên có lúc cùng bay). `?sky=owl` không cần chờ 22h.

Checklist:

- [ ] Tối + desktop: trăng có chú Cuội, cá voi bơi ngang (~4 s sau khi mở), sao chổi, chòm sao ở góc
  phải header có tên, mưa sao băng (~10 s), sao ước (không nhãn) bấm được ra thẻ điều ước (không tiêu đề).
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
- [ ] `?sky=owl`: bấm con cú → đổi câu + nghiêng đầu; bấm bóng thoại → bóng tắt, bấm cú lại thì hiện câu mới;
  đổi sang Sáng → cú đậu trên vầng trăng non. Rê chuột lên cú / băng rôn / siêu nhân: không còn tooltip.
- [ ] `?sky=owl`, buông chuột 20 – 30 s: cú gục đầu, mỏ chúc, zzZ to dần rồi "pop!"; rê chuột không
  đánh thức. Bấm cú → bật nảy, xù lông, mắt tròn xoe, cọng lông rơi tới đáy màn, nói một trong hai
  câu giật mình (bấm đánh thức hai lần liền phải ra hai câu khác nhau).
- [ ] Tối, để yên trang: cá voi nhả chùm bụi sao mỗi lượt bơi; cực quang ~50 s; chú Cuội đứng dậy
  đánh cầu ~60 s; quả cầu lông lửa lao qua ~90 s (bay trên thẻ); nguyệt thực trăng máu ~2 phút. Không
  có chữ nào. Desktop và mobile. Sang Sáng hoặc trang con: không có các cảnh này.
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
- [ ] Cài đặt → Chung → thẻ "Hiển thị": tắt "Hoạt ảnh nền trời" → trời phía sau đứng yên ngay, nhân
  vật bay / sao ước / hoạt cảnh biến mất; F5 vẫn giữ tắt; bật lại → chạy lại. Thành viên thường (không
  phải chủ CLB) cũng bấm được.
- [ ] Màn desktop lớn (2K / 4K hoặc cửa sổ cao): chữ bóng thoại, băng rôn, thẻ điều ước không to lên
  theo màn.
- [ ] `?sky=ufo` khi người bị hút là người có tên rất dài: nhãn tên dưới chân cắt "…", câu kêu gọi tên
  bạn cắt còn ≤ 20 ký tự.
- [ ] Đêm, bấm sao ước nhiều lần: gặp "Ước chăn được …" / "Ước vồ cầu vào đầu …" với các tên khác nhau
  (tài khoản nữ: chỉ tên các bạn nữ). `?sky=banner`: có câu "Gạ kèo … đê!" nếu trận gần nhất bạn thua.

---

## 10. Cấu hình (`app.json → sky`)

| Khoá | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `lateFrom` / `lateUntil` | 22 / 4 | Khung giờ có cú mèo |
| `nearGap` | 10 | Cách người trên ≤ ngần này điểm thì UFO bắt bạn có câu kêu "Còn N điểm nữa là tôi vượt …" |
| `awayDays` | 7 | Nghỉ ≥ ngần này ngày là "lâu không đánh" |
| `streakMin` | 2 | Chuỗi ≥ ngần này trận thì khen |
| `moon` | `full` | `full` trăng rằm · `lunar` theo lịch âm thật · `crescent` lưỡi liềm |
| `wishFirstMs` / `wishRestMs` | 3000 / [15000, 25000] | Sao ước đầu tiên / nghỉ ngẫu nhiên sau mỗi ngôi |
| `bannerFirstMs` / `bannerRestMs` | 6000 / [16000, 26000] | Băng rôn lượt đầu / nghỉ ngẫu nhiên sau mỗi lượt |
| `heroFirstMs` / `heroGapMs` | 10000 / 33000 | Siêu nhân lần đầu / nghỉ sau mỗi lượt bay |
| `ufoFirstMs` / `ufoGapMs` | 8000 / 29000 | UFO lần đầu / nghỉ sau mỗi cảnh |
| `owlIdleMs` | [20000, 30000] | Màn hình yên ngẫu nhiên trong khoảng này thì cú ngủ gật |
| `auroraFirstMs` / `auroraEveryMs` | 50000 / 50000 | Cực quang lượt đầu / mỗi lượt |
| `cuoiFirstMs` / `cuoiEveryMs` | 60000 / 60000 | Chú Cuội đánh cầu lượt đầu / mỗi lượt |
| `fireShuttleFirstMs` / `fireShuttleEveryMs` | 90000 / 90000 | Quả cầu lông lửa lượt đầu / mỗi lượt |
| `eclipseFirstMs` / `eclipseEveryMs` | 120000 / 120000 | Nguyệt thực trăng máu lượt đầu / mỗi lượt |

Nhịp nằm ở keyframe `effects.css` (đổi phải sửa CSS): xếp hình 30 s / hình (`skyFormTop`), đàn chim bay ~17,5 s rồi nghỉ 44 s (`skyBirds`, chu kỳ 62,24 s), một lượt băng rôn 16,64 s (`skyBannerOnce`, khớp `BANNER_FLY_MS`).
Thời lượng mỗi hoạt cảnh đêm ở `lib/sky.js → SKY_ACT_MS` (cực quang 30 s · Cuội 7 s · cầu lửa 3,6 s ·
nguyệt thực 32 s); test chặn `…EveryMs` nhỏ hơn thời lượng (hai lượt chồng nhau).

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
| Tweak "Chuyển động" | Theo "Giảm chuyển động" của hệ điều hành **và** công tắc "Hoạt ảnh nền trời" ở Cài đặt → Chung (theo thiết bị) |
| Tweak "Trăng" (Rằm / Theo lịch âm / Lưỡi liềm) | `app.json → sky.moon`, mặc định rằm như thiết kế |
| Tweak "Độ trong thẻ" (0.5 – 0.95) | Cố định 0.74 như mặc định thiết kế |
| Đang hạng 1: UFO bắt người hạng 2 đuổi theo ("Tôi đang đuổi … mà", "Ngôi vương an toàn"); cú / băng rôn / siêu nhân nhắc "… chỉ kém N điểm" | Bỏ hẳn cảnh và câu về người đuổi theo: hạng 1 thì UFO luôn bắt chính bạn |
| Câu số liệu "Còn N điểm là vượt …" / "Cách hạng … còn N điểm" | Bỏ (CLB chọn) |
| Điều ước "Ước vượt Hương Giang ngay tối nay" | Tên người ngay trên thật; đang hạng 1 thì bỏ điều ước này |
| Khung cố định 1440×940 / 390×844 | Phóng cho phủ màn thật (§1) |
| Chỉ trang chủ cá nhân | Dùng chung 9 trang có nhân vật + 2 trang con chỉ có nền (§1) |
| — (thiết kế không có trang con) | Trang con vẽ trời **đứng yên**, không nhân vật, không sao ước (đỡ tốn pin) |
| Cảnh UFO bản 2 tự diễn, không bấm | Giữ đúng như thiết kế (bỏ thử nghiệm bấm UFO bật emoji) |
| Người bị UFO bắt có nhãn "Bạn" / tên người kia | Nhãn tên thật cho cả hai (bạn cũng hiện tên, không ghi "Bạn"), cắt "…" ở 80px |
| Tooltip "Bấm để …" ở cú / băng rôn / siêu nhân, nhãn "Bấm để ước" dưới sao ước, tiêu đề "Điều ước" trên thẻ | Bỏ hết — để người dùng tự khám phá |
| Bấm bóng thoại cú = câu kế | Bấm bóng thoại = tắt bóng (khỏi che nội dung); bấm con cú mới đổi câu |
| Chữ phóng theo khung | Chữ giữ cỡ thiết kế dù khung phóng theo màn (§1 "Cỡ chữ") |
| Siêu nhân cứu người kia: "Muốn thắng thì thắng trên sân nhé!" | Cùng một câu "Đừng lo, tôi đưa bạn ra sân!" cho ai cũng vậy |
| — (thiết kế không có) | Thêm: cú ngủ gật / giật mình (§4.2), cá voi nhả bụi sao, hoạt cảnh đêm định kỳ — cực quang, chú Cuội đánh cầu, quả cầu lông lửa, nguyệt thực trăng máu (§2.1) |

**Câu bổ sung ngoài thiết kế** (CLB thêm sau, cùng giọng): cú mèo `hunt` · `late` · `bed`, ngủ gật
`zzz` · `pop` · `wake.dream` · `wake.fall`; siêu nhân `saveWorld` · `forgotBag` · `supersonic` · `riceCooker` ·
`noRacket`; băng rôn `dare` · `moms` · `wow` · `sneak` · `hoaSen`; điều ước `miss` · `both` · `serve` · `vibe` · `boss` ·
`own` · `bonk`; UFO trả người `giveBack.boba` · `heavy` · `roof` · `galaxy` · `sweat` và `huhBack.d`.

Câu thoại của thiết kế giữ **nguyên văn** (trừ hai điều ước CLB sửa: "cắm vạch", "đánh vào lưới"), kể cả dấu chấm than, emoji và mặt cười — đây là giọng nhân
vật trang trí (cùng tinh thần lời chào hiện có ở trang chủ), không phải copy nút / toast mà
`DESIGN.md §7` quy định.
