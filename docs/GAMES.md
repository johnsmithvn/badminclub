# GAMES.md — Phân hệ Mini-game trong CLB

**Version:** v0.4.0 (Giai đoạn 1 đã code — Caro, Ô ăn quan, Cờ gánh, Cờ lật; server chấm cả bốn) · **Updated:** 2026-11-07 · **Nhánh:** `feat/games`

Thành viên cùng một CLB mở phòng và chơi game theo lượt với nhau ngay trong app.
File này chốt **khung chung** trước khi viết game đầu tiên. Mỗi game sau này chỉ cắm vào khung,
không tự dựng phòng, đồng bộ hay giao diện chờ riêng.

> Trạng thái: user duyệt 2026-11-06, Giai đoạn 1 đã code. Chỗ code khác bản thiết kế ghi ở §11.

---

## 1. Phạm vi

| Có | Không |
| --- | --- |
| Game theo lượt, 2–8 người, cùng CLB | Game hành động thời gian thực (cần server game riêng, xem §9) |
| Phòng mở qua sảnh, link hoặc QR | Ghép trận với người ngoài CLB |
| Người xem phòng (chỉ đọc) | Chat trong phòng (giai đoạn sau, nếu cần) |
| Thống kê thắng/thua từng game | **Đụng Elo, Điểm Mùa, XP, sổ quỹ** |

**Cách ly tuyệt đối với cầu lông** — cùng nguyên tắc với Giải đấu (`ARCHITECTURE.md` Tầng F):
không ghi `matches`, không gọi `rating.js` / `season.js` / `xp.js`, không sinh dòng `transactions`.
Nhờ vậy phân hệ này **không bao giờ** làm đỏ backtest (`RULES.md` §0).

**Nguồn game:** chỉ game dân gian / luật chung (Caro, Tiến lên, Ma sói, Nối từ, Bắn tàu…) hoặc
game tự thiết kế. Không làm lại game thương mại, không chép giao diện / văn bản luật của web khác.
Luật tự viết lại trong `vi.json`.

---

## 2. Kiến trúc tổng thể

```
pages/Games.jsx ─────── sảnh: danh sách game, phòng đang chờ, tạo phòng, nhập mã / quét QR
pages/GameRoom.jsx ──── khung phòng: ghế, chờ, bắt đầu, kết quả → lazy-load màn chơi của game
        │
        ├── components/games/shared/   SeatList · TurnBadge · ResultPanel · RoomHeader · useGameRoom
        ├── components/games/screens.js   id game → React.lazy(() => import('./caro/CaroScreen.jsx'))
        └── components/games/caro/CaroScreen.jsx   chỉ vẽ bàn + bắt sự kiện bấm
                │
contexts/gameActions.js ── hành động ghi (tạo/vào/rời/bắt đầu/đi nước/kết thúc) → RPC
contexts/storage.js ────── loadGameRooms · loadGameRoom · subscribeGameRoom (điểm chạm mạng duy nhất)
        │
lib/games/registry.js ──── id → { logic, minPlayers, maxPlayers, defaultOptions }
lib/games/caro.js ──────── LOGIC THUẦN theo hợp đồng §3, test bằng node
```

Đặt theo đúng khuôn đang có: `lib/tournament/` + `components/tournament/` + `tournamentActions.js`,
và `libraryActions.js` + `loadLibrary`. Không tạo thư mục gốc mới ngoài `src/`.

Như Giải đấu và Thư viện: **không nạp vào state `db`**, không vào `dbmap.TABLES`, không qua `diff()`.
Trang tự nạp, ghi qua RPC.

---

## 3. Hợp đồng chung của một game (`lib/games/<id>.js`)

Mỗi game export đúng một object, toàn hàm thuần (không React, không Supabase, không `Math.random`):

```js
export default {
  id: 'caro',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: { size: 15, win: 5, blockedEnds: false },

  /** State ban đầu. `seed` do server sinh lúc bắt đầu — mọi máy ra cùng một state. */
  setup({ seats, options, seed }) { return state },

  /** null = hợp lệ; ngược lại trả KEY i18n của lý do ('games.err.notYourTurn'). */
  validate(state, seat, move) { return null },

  /** State mới. Chỉ gọi khi validate trả null. Không sửa state cũ. */
  apply(state, seat, move) { return nextState },

  /** Phần state ghế `seat` được thấy. Game không có thông tin ẩn: trả nguyên state. */
  view(state, seat) { return state },

  /** null = đang chơi; xong thì { winners: [seat], draw: false, scores?: {seat: n} }. */
  result(state) { return null },
}
```

**Vì sao thuần:** test được bằng `node:assert` (đúng `RULES.md` §5), và **cùng một code** chạy ở
mọi máy, sau này chạy cả ở Edge Function cho game có bài úp (§5.2).

**Ngẫu nhiên** (chia bài, xúc xắc) lấy từ `seed` qua một PRNG thuần dùng chung
`lib/games/rng.js`. Không dùng `Math.random` — hai máy sẽ ra hai bàn khác nhau.

### State được dựng lại từ log nước đi

```
state = moves.reduce((s, m) => validate(s, m.seat, m.move) ? s : apply(s, m.seat, m.move),
                     setup({ seats, options, seed }))
```

- F5, rớt mạng, vào lại phòng, người xem vào giữa ván: tải log → dựng lại. Không lưu state.
- Nước **không hợp lệ bị bỏ qua** khi dựng lại, trên mọi máy như nhau. Một client sửa code để gửi
  nước bậy chỉ tạo ra dòng rác mà không ai áp dụng.
- Có test khoá: dựng lại từ log phải ra **đúng** state của chuỗi `apply` liên tiếp.

---

## 4. Database — migration `0074_games.sql`

Ba bảng, đều có `club_id` (luật 1 của `DATABASE.md`). Lưu **key**, không lưu chữ hiển thị (`RULES.md` §3.3).

```sql
game_rooms (
  id uuid pk, club_id uuid not null → clubs,
  game text not null,                 -- key trong registry: 'caro'
  code char(6) not null,              -- mã mời, unique theo club
  host_id uuid not null → club_members,
  status text not null default 'waiting'
    check (status in ('waiting','playing','finished','abandoned')),
  options jsonb not null default '{}',
  seed text,                          -- server sinh lúc start, null khi đang chờ
  result jsonb,                       -- { winners:[seat], draw, scores } do game.result() trả
  created_at, started_at, ended_at timestamptz
)

game_room_players (
  room_id uuid → game_rooms, member_id uuid → club_members,
  seat smallint not null,
  joined_at timestamptz, left_at timestamptz,   -- rời phòng = đặt left_at, không xoá
  primary key (room_id, member_id), unique (room_id, seat)
)

game_moves (
  room_id uuid → game_rooms, seq int not null,  -- 1, 2, 3…
  seat smallint not null, move jsonb not null,  -- move do game tự định nghĩa: {r:7,c:7}
  created_at timestamptz default now(),
  primary key (room_id, seq)
)
```

**Không có bảng thống kê.** Thắng/thua đếm từ `game_rooms.result` của phòng `finished`.
Chậm thì mới thêm view/bảng tổng hợp.

### RLS + RPC

- **Đọc:** cả 3 bảng — mọi thành viên CLB (`is_club_member(club_id)`). Người xem được phép.
- **Ghi:** client **không** ghi thẳng bảng nào; chỉ qua RPC `SECURITY DEFINER`:

| RPC | Ai | Kiểm |
| --- | --- | --- |
| `game_create(p_club, p_game, p_options)` | thành viên CLB | sinh `code`, chủ phòng ngồi ghế 0 |
| `game_join(p_room, p_seat)` | thành viên CLB | phòng `waiting`, ghế trống |
| `game_leave(p_room)` | người trong phòng | đang chờ → rời ghế; đang chơi → `abandoned` nếu còn < 2 người (§10 Q3) |
| `game_start(p_room, p_min, p_max)` | chủ phòng | `waiting` → `playing`, số người trong `[p_min, p_max]`, sinh `seed` |
| `game_move(p_room, p_seq, p_move)` | người ngồi trong phòng | phòng `playing`; `p_seq` = seq cuối + 1 (PK chặn hai nước cùng lúc → 23505 → client nạp lại) |
| `game_finish(p_room, p_result)` | người ngồi trong phòng | `playing` → `finished`, chỉ một lần |

Server **không hiểu luật game** — chỉ giữ thứ tự nước và ai được ghi. Luật nằm ở §3, chạy trên client.
Giới hạn của cách này ghi ở §5.1.

Realtime: `alter publication supabase_realtime add table game_moves, game_room_players, game_rooms;`

Kèm `supabase/manual/0074_games_check.sql` theo khuôn 0068–0073.

---

## 5. Ai giữ "sự thật" của ván

### 5.1 Game không có thông tin ẩn (Caro, Bắn tàu kiểu lộ bàn, Nối từ…) — Giai đoạn 1

Client tự kiểm luật, server giữ thứ tự (§4). Chống được: đi sai lượt, đi đè, hai máy ghi cùng lúc.

**Server tự chấm.** Mỗi game có bản chấm `public.game_<id>_result(uuid)` viết bằng plpgsql: dựng lại log
`game_moves` theo đúng luật của `lib/games/<id>.js`, nước sai bị bỏ qua y như `replay()`, trả
`{winners, draw}` hoặc NULL (ván chưa xong). Hiện có `game_caro_result` (0074), `game_oanquan_result`,
`game_coganh_result` (0075), `game_colat_result` (0076, kèm hàm phụ `game_colat_flips`). Các hàm đã REVOKE khỏi
client — chỉ `game_finish` gọi. Cờ lật trả thêm `scores` (số quân mỗi bên) nên ván mẫu gác được cả việc lật đúng từng quân.

`game_finish` (bản 0075) tra **động** `to_regprocedure('public.game_' || game || '_result(uuid)')`:
- có hàm → bỏ qua `p_result` client gửi, dùng kết quả server; NULL → `games.err.notOver`;
- chưa có hàm (game mới chưa viết bản chấm) → nhận kết quả client, chỉ kiểm hình dạng (`winners` là mảng,
  dưới 2000 ký tự). Thêm game có bản chấm **không phải sửa `game_finish`**.

**Gác luật hai nơi (JS ↔ SQL)** bằng hai lớp:
1. Hằng số trong SQL (`c_quan`, `c_start`, `c_non`, `c_quiet`, vị trí xếp quân…) khớp JS — test regex.
2. **Bộ ván mẫu dùng chung**: `supabase/manual/0075_games_results_check.sql` nhúng các ván (khối `$fx$`
   Ô ăn quan, `$cg$` Cờ gánh), `0076_games_colat_check.sql` (khối `$cl$` Cờ lật) kèm kết quả. Test JS (`oanquan.test.js`, `coganh.test.js`,
   `colat.test.js`) replay từng ván
   và so kết quả; file kiểm chạy cùng các ván đó qua `game_*_result` trên DB thật. Ván mẫu có cả nước rác
   và số viết `5.0` (jsonb giữ nguyên, JS đọc ra 5) để hai bên bỏ qua / làm tròn giống nhau.
   Sinh lại khi đổi luật: `node src/__tests__/games/fixtures.mjs` → chạy lại file kiểm trên DB.

> `ponytail:` luật chép hai nơi (JS + SQL), gác bằng ván mẫu chung. Ngưỡng: luật dài cỡ Cờ gánh còn chép
> tay được; game có thông tin ẩn (§5.2) thì bắt buộc Edge Function — lúc đó chuyển luôn việc chấm sang
> Edge Function chạy chung code §3 và xoá các bản plpgsql.

### 5.1b Mất kết nối

Người ngồi ghế gọi `game_ping` mỗi `games.pingSec` giây khi tab đang mở (ghi `seen_at`; `game_move`
cũng ghi). Quá `offlineSec` không thấy nhịp → ghế hiện "Mất kết nối · còn m:ss". Quá `reconnectGraceSec`
(120 giây) → máy đối thủ tự gọi `game_claim`; server đo bằng **giờ server**, đúng hạn thì xử người còn
lại thắng (`result.idle = true`). Số 120 nằm ở cả `app.json` và `game_claim` — `contract.test.js` gác khớp.
Tab ẩn (khoá máy, chuyển app) cũng là ngừng nhịp.

### 5.2 Game có thông tin ẩn (Tiến lên, Ma sói…) — Giai đoạn 2

Seed nằm trong DB mà mọi người đọc được → ai cũng tính được bài người khác. Nên:
- Seed + bài úp chỉ nằm ở Edge Function (hoặc bảng service-role-only).
- Edge Function chạy `validate/apply` cùng code §3, ghi nước, rồi trả mỗi người `view(state, seat)`.
- **Việc phải chốt trước Giai đoạn 2:** Edge Function (Deno) chỉ đóng gói được code trong
  `supabase/functions/`. Hai cách: (a) đặt logic game ở `supabase/functions/_shared/games/` và
  client import qua alias `#games/*` trong `package.json`; (b) build bước copy. Nghiêng về (a).

Giai đoạn 1 **không** đụng Edge Function.

---

## 6. Đồng bộ realtime

- `subscribeGameRoom(roomId, onChange)` trong `storage.js`: một channel `game:<roomId>`, nghe
  `postgres_changes` INSERT của `game_moves` và UPDATE của `game_rooms`/`game_room_players` theo `room_id`.
- Mỗi lần **subscribe xong hoặc nối lại**: tải lại cả log một lần (bắt các nước lỡ khi mất mạng).
  Nhận nước có `seq` không liền mạch → tải lại log.
- Rời trang / tab ẩn quá lâu → `removeChannel`. Chỉ phòng đang mở mới tốn kết nối.
- Sảnh (`Games.jsx`) **không** subscribe — dùng `useTourPoll` có sẵn, nhịp chậm (`games.lobbyPollMs`).

Đây là chỗ đầu tiên app dùng Supabase Realtime. Phần còn lại vẫn poll như cũ (`ARCHITECTURE.md` §7).
Free tier (khoảng 200 kết nối đồng thời, 2 triệu message/tháng) dư cho một CLB.

---

## 7. Giao diện

### Route (trong CLB — `ROUTE_KEYS`)

| Key | URL | File |
| --- | --- | --- |
| `games` | `/tro-choi` | `pages/Games.jsx` |
| `gameRoom` | `/tro-choi/:id` | `pages/GameRoom.jsx` |

`routes: null` như mọi màn (ai trong CLB cũng vào). Lối vào: Sidebar + `MoreSheet` trên mobile.
Không thêm vào `MobileFooterNav` (5 slot đã đầy).

### Bundle nhẹ

- `Games` và `GameRoom` là **`React.lazy`** trong `App.jsx` (route lazy đầu tiên của app, bọc `Suspense`).
- Màn chơi từng game lazy thêm một lớp nữa qua `components/games/screens.js`.
- Kết quả: người không vào mục game **không tải byte nào**; vào sảnh chưa tải logic/màn của game nào.

### Luồng

```
Sảnh ── Tạo phòng (chọn game + tuỳ chọn) ──┐
     └─ Nhập mã / quét QR / bấm phòng ─────┤
                                           ▼
                         Phòng — CHỜ: ghế, mời (link + QR), chủ phòng bấm Bắt đầu
                                           ▼
                         Phòng — CHƠI: màn của game + TurnBadge + RoomHeader
                                           ▼
                         Phòng — KẾT QUẢ: ResultPanel, Chơi lại (tạo phòng mới cùng người)
```

### Hình ảnh — nhẹ mà vẫn đẹp

| Thứ | Làm bằng |
| --- | --- |
| Bàn, quân, lá bài, xúc xắc | SVG/CSS vẽ bằng code, màu lấy token của `DESIGN.md` → tự theo Dark/Light |
| Icon | `lucide-react` (đã có). Thiếu thì chép SVG lẻ có giấy phép rõ ràng (ghi nguồn trong comment) |
| Hiệu ứng thắng | Lottie (đã có), lazy |
| Âm thanh | Web Audio tổng hợp, không file — giai đoạn sau |

**Không thêm dependency nào.** Chi tiết style đọc `DESIGN.md` khi bắt tay làm UI.

### Chữ và hằng số

- Mọi chữ: `vi.json` khối `games.*` (tên game, luật, nhãn, lỗi `games.err.*`).
- Hằng số: `app.json` khối `games` (`codeLength`, `lobbyPollMs`, `maxOpenRoomsPerMember`…).
  **Không** nằm trong khối `rating` / `season`.

---

## 8. Test

`src/__tests__/games/` (cập nhật bản đồ trong `src/__tests__/README.md`):

- `contract.test.js` — chạy **mọi game trong registry** qua cùng bộ kiểm: `setup` tất định theo
  seed, `apply` không sửa state cũ, dựng lại từ log = `apply` liên tiếp, nước sai bị bỏ qua.
  Thêm game mới là tự được kiểm, không viết lại.
- `caro.test.js` — 5 quân ngang/dọc/chéo thắng, 4 quân chưa thắng, đi đè ô, đi sai lượt, hoà khi
  đầy bàn, tuỳ chọn chặn hai đầu.
- `oanquan.test.js` — dừng ở ô quan (không bốc sỏi trong ô quan), bốc tiếp ô dân, ăn dây chuyền vòng qua
  đầu bàn kể cả ăn quan, quan non (§12), hai ô trống liền mất lượt, rải lại khi hết dân (đủ đúng 5 điểm vẫn
  được), hết quan thu dân về, hoà, `frames` cho hoạt ảnh; 300 ván ngẫu nhiên tất định luôn kết thúc và không
  sinh / mất sỏi; hằng số + ván mẫu khớp SQL (§5.1).
- `coganh.test.js` — xếp quân, đường kẻ (chéo chỉ ở điểm chẵn), gánh, chầu (gánh hai đường), vây một quân / cả nhóm / nhóm
  còn điểm thở, gánh xong mới vây, mở → bắt buộc gánh, hết quân, im 40 nước, trần 400 nước; 200 ván ngẫu
  nhiên luôn đủ 16 quân; hằng số + ván mẫu khớp SQL.
- `colat.test.js` — xếp quân, 4 nước mở đầu, lật nhiều hàng một lúc, dừng ở quân mình gần nhất, hàng chạm mép /
  có ô trống thì không lật, không tràn từ cuối hàng sang đầu hàng kia, mất lượt, xoá sạch quân, đầy bàn người đi
  cuối vẫn thua, hoà; 300 ván ngẫu nhiên chỉ đổi màu đúng các quân bị kẹp; xếp quân + ván mẫu khớp SQL.
- `fixtures.mjs` — không phải test: sinh lại bộ ván mẫu trong file kiểm 0075 và 0076 (§5.1).
- Mutation-test theo `RULES.md` §5.

RPC/RLS kiểm tay bằng `supabase/manual/0074_games_check.sql`, `0075_games_results_check.sql`, `0076_games_colat_check.sql`
(bản chấm từng game chạy trên ván mẫu, `game_finish` bỏ qua kết quả bịa, game chưa có bản chấm vẫn nhận kết quả client).

---

## 9. Lộ trình

| Giai đoạn | Nội dung | Kiểm chứng phần nào của khung |
| --- | --- | --- |
| **1** | Khung (§2–§7) + **Caro**, **Ô ăn quan**, **Cờ gánh**, **Cờ lật** 2 người, server chấm | phòng, ghế, realtime, dựng lại từ log, lazy-load, chấm động (§5.1) |
| **2** | **Tiến lên** 4 người | thông tin ẩn qua Edge Function (§5.2) |
| **3** | **Ma sói** hoặc **Nối từ** | nhiều người, vai trò / đồng hồ lượt |

Tách repo / server game riêng chỉ khi: cần game hành động nhanh, mở cho người ngoài CLB,
hoặc vượt quota Supabase.

**Giai đoạn 1 đụng khoảng 15 file** (migration, check SQL, storage, gameActions, 2 page, App.jsx,
routes, i18n, app.json, registry, rng, caro, screens, CaroScreen, shared components, test) —
cần user duyệt file này trước.

---

## 10. Đã chốt (2026-11-06)

1. Phòng dùng **Realtime**, sảnh poll (`games.lobbyPollMs`).
2. Kết quả Caro do **server tự chấm** (§5.1) — đổi ý 2026-11-06, ban đầu định để client báo.
3. Rời phòng giữa ván = **đầu hàng**, đối thủ thắng ngay. Mất kết nối quá 120 giây → **tự xử thua** (§5.1b).
4. Phòng mặc định **công khai** trên sảnh, có công tắc **Phòng riêng**.
5. Thông báo / push mời vào phòng: để sau.

---

## 11. Chỗ code khác bản thiết kế (Giai đoạn 1)

| Thiết kế | Code | Lý do |
| --- | --- | --- |
| `components/games/shared/` nhiều component | Ghế, trạng thái, kết quả nằm luôn trong `pages/GameRoom.jsx`; hook ở `components/games/useGameRoom.js` | Mới một game, tách component dùng một lần là thừa. Tách khi game thứ hai cần |
| `lib/games/rng.js` | Chưa có | Caro không cần ngẫu nhiên. Thêm cùng Tiến lên (chia bài theo `seed`) |
| `components/games/caro/CaroScreen.jsx` | `components/games/CaroBoard.jsx` | Một file, không cần thư mục |
| Mời bằng link + QR | Chỉ link + mã 6 ký tự | App chưa có thư viện sinh QR, không thêm dependency |
| Presence của Supabase Realtime | Nhịp `game_ping` ghi `seen_at` | Server phải tự đo được thời gian mất kết nối để xử thua; Presence chỉ client thấy |
| Hằng số `games.*` | `lobbyPollMs` · `lobbyLimit` · `statsLimit` · `staleHours` · `caroSizes` · `pingSec` · `offlineSec` · `reconnectGraceSec` · `claimRetrySec` | |
| Chấm ở Edge Function từ game thứ hai | plpgsql từng game + `game_finish` tra động (§5.1) | Edge Function là đổi kiến trúc (Giai đoạn 2); ván mẫu chung đủ gác luật hai nơi |
| Tranh / luật trong `shared/` | `components/games/GameInfo.jsx`: `GameArt` (tranh SVG từng game, nền theo tông) + `HowTo` (hộp thoại Cách chơi) | Dùng ở sảnh (thẻ game, dòng phòng) và đầu phòng chơi |

Quy ước thêm cho hợp đồng §3: state có `turn` = ghế đang tới lượt (hoặc null) — khung phòng đọc trường này để tô ghế và bật bàn.
Ký hiệu ghế lấy từ i18n `games.<id>.mark<seat>`. State có `ply` (số nước đã áp) khi màn chơi cần `key` để
chạy lại hoạt ảnh mỗi nước. `last` = nước vừa đi để màn vẽ dấu / hoạt ảnh — Ô ăn quan kèm `last.frames`
(từng bước bốc / rải / ăn / rải lại, tối đa 300) để màn phát lại nước rải.

Thêm một game: `lib/games/<id>.js` + test → đăng ký `registry.js` → `screens.js` + `<Id>Board.jsx` →
tranh ở `GameInfo.jsx` (`TONE`, `ART`) → i18n `games.<id>.{name,desc,howto,mark0,mark1…}` (smoke test
bắt thiếu) → bản chấm `game_<id>_result` trong migration mới + ván mẫu trong file kiểm.

---

## 12. Luật đã chọn từng game

Luật dân gian mỗi vùng mỗi khác — chọn một bản, ghi ở đây, chữ cho người chơi ở `games.<id>.howto`.

**Ô ăn quan** (`oanquan.js`): 10 ô dân × 5 sỏi, 2 ô quan, quan = 10 điểm. Bốc ô dân của mình, rải một chiều;
hết sỏi thì bốc ô kế (không bốc ô quan); gặp một ô trống rồi một ô có sỏi thì ăn, ăn dây chuyền; hai ô trống
liền hoặc trước mặt là ô quan thì mất lượt. **Quan non**: ô quan còn dưới 5 dân thì chưa được ăn (không có luật
này ván hết sau 2 nước). Hết dân phía mình thì lấy 5 điểm rải lại (đủ đúng 5 vẫn được, thiếu thì thua). Hết
cả hai quan thì mỗi bên thu dân phía mình.

**Cờ gánh** (`coganh.js`): bàn 5×5, đường chéo chỉ qua điểm có hàng + cột chẵn, mỗi bên 8 quân. Đi một bước
theo đường kẻ. **Gánh**: đi vào giữa hai quân địch thẳng hàng thì lật cả hai. **Vây**: nhóm quân địch không còn
điểm trống kề thì lật cả nhóm — xét sau gánh. **Mở**: đi ra khỏi một điểm mà để lại thế gánh cho đối thủ thì đối
thủ **bắt buộc** đi vào đó nếu có quân tới được. Hết quân thì thua; 40 nước liền không lật quân hoặc 400 nước →
bên nhiều quân thắng, bằng nhau thì hoà.

**Cờ lật** (`colat.js`): trò kẹp-lật quân có từ thế kỷ 19, luật chung không ai giữ (không dùng tên thương mại của
bản đóng hộp). Bàn 8×8, bốn quân giữa xếp chéo màu, đen đi trước. Đặt quân phải kẹp được ít nhất một hàng quân
đối phương (8 hướng) giữa quân mới và quân mình → lật mọi hàng bị kẹp. Không có nước thì **tự mất lượt** (không có
nút "bỏ lượt" — state ghi `last.skipped`), cả hai không đi được thì hết ván, đếm quân.

Nguồn đã đối chiếu: [vi.wikipedia Cờ gánh](https://vi.wikipedia.org/wiki/C%E1%BB%9D_g%C3%A1nh),
[FPT Shop](https://fptshop.com.vn/tin-tuc/thu-thuat/cach-choi-co-ganh-175672),
[Wikipedia Ô ăn quan](https://en.wikipedia.org/wiki/%C3%94_%C4%83n_quan),
[cellphones](https://cellphones.com.vn/sforum/o-an-quan) — chỉ lấy luật, chữ tự viết.
