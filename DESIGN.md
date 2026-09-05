# DESIGN.md

**Version:** v0.4.0 · **Updated:** 2026-09-05

Hệ thiết kế của app là **TDMS**, lấy nguyên từ handoff. **Không hard-code màu/chữ/khoảng cách mới**
— mọi giá trị đi qua `var(--*)`. Đọc file này trước khi sửa bất cứ thứ gì thuộc UI/CSS/layout.

---

## 1. Nạp design system

`src/main.jsx` import đúng một file: `#styles/index.css` (nó `@import` 10 file token theo thứ tự trong `styles/tokens/`).
Component import từ `#ds` (hoặc `src/components/ds/index.js`):

```jsx
import { Card, StatCard, DataTable, Button, Select, Switch, Tabs, Alert, Dialog } from '#ds'
```

> `src/components/ds/index.js` là **file sinh ra** từ `_ds_bundle.js` của handoff. **Đừng sửa tay.**
> Hai chỗ đã cố ý can thiệp, có ghi chú trong file: (1) xoá block `Icon` bản CDN,
> (2) ghi đè `__ds_scope.Icon` bằng `lucide-react` (`src/components/ds/icons.js`). Nếu regenerate thì phải làm lại hai chỗ đó.

## 2. Màu

| Token | Giá trị | Dùng ở đâu |
| --- | --- | --- |
| `--navy-700` | `#0D2B5E` | sidebar, nút primary, tiêu đề, chip đang chọn |
| `--teal-500` | `#00B2A9` | trạng thái đang chạy, ô logo, cột thu, thanh tiến độ |
| `--surface-page` | xám 50 | nền trang |
| `--surface-card` | trắng | thẻ, header |
| `--surface-inset` | xám nhạt | header bảng, thanh điều khiển trận, hover dòng |
| `--surface-sunken` | xám | rãnh thanh tiến độ, thẻ "Vắng" |
| `--surface-brand-soft` | navy rất nhạt | thân sân, pill vai, khối ngày, dải nhắc quyền |
| `--surface-accent-soft` | teal rất nhạt | thẻ "Có mặt", người đang chọn |
| `--border-subtle` / `--border-strong` / `--border-nav` | | hairline thẻ · ô trống dashed · viền sidebar |
| `--text-primary` / `--text-secondary` / `--text-muted` | | chữ chính · phụ · caption |

**Trạng thái** (mỗi cái có cặp `-bg` / `-fg`):

```
--status-scheduled  xanh dương   Chưa mở · "Đã mời"
--status-transit    teal         Đã mở · đang diễn ra
--status-delivered  xanh lá      Đã chốt · đã ghép tài khoản · khách đã trả
--status-delayed    amber        công nợ · lệch trình độ · gợi ý trùng SĐT
--status-incident   đỏ           cột chi · quỹ bù dương
--status-idle       xám          Đã hủy · chưa có tài khoản
```

**Màu trình độ** (`money.js: levelStyle`) — dùng hàm này, đừng viết lại map:
`Newbie → status-idle` · `TBY → status-scheduled` · `TB- → status-transit` · `TB → status-delivered`.

## 3. Typography

```
--font-display  Barlow          tiêu đề, số liệu lớn (StatCard), số ngày
--font-sans     IBM Plex Sans   toàn bộ UI (body 14px ở console)
--font-mono     IBM Plex Mono   MỌI mã, SĐT, giờ, ngày, số tiền, số lượng
```

Role: `--type-h2` (tên trang) · `--type-h3` (tên sân, tên người) · `--type-label` (tên người, nhãn)
· `--type-body` · `--type-caption` (chú thích muted) · `--type-mono` · `--type-overline` (header bảng).
Chip nhỏ: `600 10–11px/1 var(--font-sans)`, padding `4–6px 8–9px`, `border-radius:99px`.

**Luật mono không được vi phạm:** số tiền, mã CLB, SĐT, giờ, ngày, số lượng **luôn** mono và
**không bao giờ rút gọn**.

## 4. Spacing, radius, elevation

```
gap grid nội dung   16px         gap thẻ nhỏ   9–12px
padding main        20px 22px 60px
padding thẻ         14–18px      padding 0 khi thẻ chứa bảng/DataTable
radius control      6px          radius thẻ 9–10px      pill 99px
control cao         36px (sm 30–32px)                   ô sân min-height 60px
sidebar 248px       header ≥60px                        max-width nội dung 1440px
shadow-xs thẻ nghỉ  shadow-sm panel                     overlay dialog/toast
```

## 5. Khung app

```
┌─────────────┬──────────────────────────────────────────┐
│ sidebar     │ header (min-height 60, padding 11px 22px)│
│ 248px       ├──────────────────────────────────────────┤
│ surface-nav │ main: overflow-y auto, 20px 22px 60px    │
│             │   nội dung: max-width 1440, grid gap 16  │
└─────────────┴──────────────────────────────────────────┘
```

Root: `display:flex; height:100vh; overflow:hidden`. `html,body{margin:0;height:100%;overflow:hidden}`.

- **Switcher CLB nằm trong sidebar**, không nằm ở header — để header không tràn dưới 1390px.
- **Select "Xem như: <vai>"** nằm ở hàng full-width dưới header, cùng icon `shield` và một câu
  mô tả quyền của vai đó.
- Cụm phải của header phải `flex:1 1 auto; min-width:0; flex-wrap:wrap` — **đừng** dùng `flex:0 0 auto`.

## 6. Motion

`cubic-bezier(.2,.8,.2,1)` cho mọi thứ: 90ms press · 140ms hover/focus · 200ms tab & switch ·
260ms sheet · 320ms progress. Dialog: 8px rise + fade. Toast: fade, tự tắt **2600ms**.
Không bounce, không spring. Tôn trọng `prefers-reduced-motion` (token về 0ms — đã có sẵn).

## 7. Copywriting (bắt buộc giữ)

- Tiếng Việt. **Không dấu chấm than, không emoji, không "Oops".**
- Nút là **động từ**: "Mở điểm danh", "Xong trận", "Gửi lời mời", "Bỏ ghép", "Thu nợ".
- Mỗi con số đi kèm câu giải thích nguồn: *"Định mức Cố định Chủ nhật: 34 quả/buổi cho 2 sân"*.
- Toast nói **kết quả + hệ quả**: *"Đã gửi lời mời tới 0910000411 — ai nhận và tạo tài khoản sẽ tự
  ghép vào Vân Anh"*.
- Trạng thái rỗng = **sự thật + việc cần làm**, không phải minh hoạ.
- Copy trong handoff `02-screens-ui-spec.md` là **chốt** — đừng dịch lại, đừng "viết hay hơn".

## 8. Responsive & Mobile Shell (≤ 768px)

Thiết kế gốc cho desktop ≥1280px (density dispatch console) với grid `auto-fit/minmax` co giãn tới 768px.
Bản mobile áp dụng cho màn hình ≤768px với **ngưỡng duy nhất: `useMobile(768)`**. Không thêm breakpoint thứ hai.

### 8.1 Khung điều hướng mobile
- **Sidebar 248px bị gỡ hoàn toàn** ở mobile. Điều hướng chuyển sang: Mobile Header trên + Footer Nav 5 slot dưới + Sheet "Thêm" (N1).
- **Mobile Header:** sticky, `min-height 60px`, `padding 16px 18px`, `background: var(--surface-nav)`, `border-bottom: 1px solid var(--border-nav)`. Trái là tên trang + subtitle mono cho ngày/giờ/CLB; phải là **tối đa một** hành động primary + nút đổi theme.
- **Switcher CLB không nằm ở header mobile** — đặt trong màn Hồ sơ (`/ca-nhan`) và cuối sheet Thêm.
- **Nội dung:** 1 cột, `padding 14px`, `padding-bottom 80px` để không bị footer nav che. Mọi grid desktop `minmax(320–420px, 1fr)` chuyển về `1fr`.
- **Thanh footer nav (5 slot):**
  - `background: var(--surface-nav)` · `border-top: 1px solid var(--border-nav)` · `display: grid; grid-template-columns: repeat(5, 1fr)`.
  - `padding: 10px 0 16px` (cộng thêm `env(safe-area-inset-bottom)`).
  - Slot 1–4 phân bổ theo cờ quyền `can(role, 'money')` qua hàm thuần `footerSlots(role)`:
    - Có cờ `money` (`owner`, `treasurer`): Trang chủ (`/`) · Buổi tập (`/buoi-tap`) · Công nợ (`/cong-no`) · BXH (`/bang-xep-hang`) · Thêm.
    - Không có cờ `money` (`member`): Trang chủ (`/`) · Buổi tập (`/buoi-tap`) · BXH (`/bang-xep-hang`) · Hồ sơ (`/ca-nhan`) · Thêm.
  - Slot 5 luôn là **Thêm**. Chạm slot đang active: cuộn mượt lên đầu trang; chạm slot khác: điều hướng.
- **Sheet "Thêm" (N1):**
  - Dùng `<Dialog sheet>` với `var(--radius-sheet)` 18px, tay nắm `var(--border-default)`, nền `var(--surface-card)`, scrim `var(--surface-scrim)`.
  - Giữ đúng nhóm chức năng:
    - **Tiền:** Công nợ (khi không ở slot) · Sổ quỹ (`/so-quy`).
    - **Người và lịch:** Thành viên (`/thanh-vien`) · Chia sân (`/chia-san`, nhảy thẳng buổi khả dụng) · Lịch tháng (`/lich-thang`) · Lịch cố định (`/lich-co-dinh`) · Hồ sơ của tôi (`/ca-nhan`).
    - **Hệ thống:** Cài đặt (`/cai-dat`) · Sơ đồ dữ liệu (`/so-do-du-lieu`).
  - Switcher CLB dán ở cuối sheet (thẻ viền dashed 56px).

### 8.2 Density "Driver App" (bắt buộc)
- Hit target ≥ **48px**; hành động primary **56px**; body **≥ 16px**.
- Chip/pill: cao ≥ 32px, `padding 8px 12px`, `border-radius 999px`.
- Bảng desktop **không** thu nhỏ chữ để vừa màn hình. Chuyển thành `CardList`: một dòng bảng = một thẻ hai tầng (tầng 1 định danh, tầng 2 số liệu mono/meta). Ngoại lệ duy nhất được cuộn ngang là **ma trận đối đầu H2H** (5×5, cột tên dán trái).
- Modal desktop → **bottom sheet** (`<Dialog sheet>` với nút CTA dán đáy sheet).
- Thanh tab nhiều mục dùng `TabTrack` cuộn ngang (`overflow-x: auto`, ẩn thanh cuộn).

### 8.3 Bảng quy đổi CSS token (CẤM hard-code hex)
Mọi màu từ handoff mobile phải ánh xạ sang CSS variables của app:
- Nền trang: `var(--surface-page)` · Header/nav: `var(--surface-nav)` · Nav active: `var(--surface-nav-active)`
- Nền thẻ: `var(--surface-card)` · Nền lõm: `var(--surface-inset)` · Ô nhập: `var(--field-bg)`
- Nút ghost: `var(--surface-raised)` / `var(--action-secondary-bg)`
- Viền mặc định: `var(--border-subtle)` · Viền control: `var(--border-default)` · Viền đang chọn: `var(--border-focus-color)`
- Nút primary: `var(--action-primary-bg)`
- Nút primary xanh lá (Chốt buổi): `var(--action-success-bg)` và `var(--action-success-border)`
- Trạng thái: delivered `var(--status-delivered-fg)`, delayed `var(--status-delayed-fg)`, incident `var(--status-incident-fg)`, transit `var(--status-transit-fg)`.


## 9. Khi cần một thứ chưa có

Thứ tự bắt buộc:

1. Có component TDMS nào cùng vai trò chưa? (29 component — xem `src/ds/index.js` cuối file)
2. Ghép được từ component có sẵn không? (`Card` + `DataTable` + `Tag`…)
3. CSS thuần với token có sẵn giải quyết được không?
4. Chỉ khi hết ba bước trên mới viết component mới — và viết bằng token, không hard-code màu.

**Không thêm dependency UI mới** (không styled-components, không Tailwind, không MUI). CSS của app
là inline style dùng `var(--*)` giống DS, đúng như prototype.
