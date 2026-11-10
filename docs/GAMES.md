# GAMES.md — Phân hệ Mini-game trong CLB

**Version:** v0.10.0 (Giai đoạn 1 — Caro, Ô ăn quan, Cờ gánh, Cờ lật, Chấm ô; Giai đoạn 2 — Tiến lên, Cờ vua, Cờ tướng, Cờ cá ngựa, Bắn tàu, Domino; Giai đoạn 3 — Bài bịp, Nối từ, Ma sói; 0085 — mất kết nối chỉ xử người ván đang chờ; 0086 — Ma sói: Sói được cắn Sói; 0087 — Ma sói: chủ phòng tự chọn bộ vai; 0088 — Caro bàn X-O 3 × 3; 0089 — Cờ vây; 0090 — Phỏm; 0091 — Bảng xếp hạng game; 0092 — Ba cây; 0093 — Xu ảo; 0094–0098 — Tiến lên miền Bắc, Cờ úp, Bầu cua, Lô tô, Xì dách; 0099–0100 — Nối từ có từ điển; Chơi với máy (§7b)) · **Updated:** 2026-11-10 · **Nhánh:** `feat/games`

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
**Bảng xếp hạng (0091, chủ dự án duyệt 2026-11-09):** hàm đọc `game_board(p_club, p_month)` cộng dồn trên server, trả mỗi
(game, thành viên) một dòng `played / won / drawn / lost / points`; không bảng mới, SECURITY INVOKER (RLS giới hạn CLB).
- Tháng = tháng của `ended_at` theo giờ Việt Nam; `p_month` NULL = từ trước tới nay. Phòng `abandoned` không tính.
- Người rời giữa ván vẫn tính (thua); người rời lúc phòng còn chờ không tính (ghế cũ có thể trùng sau khi game_start đánh số lại).
- Thắng = ghế trong `winners` (Ma sói: cả phe). `points` = tổng `scores[ghế]` — chỉ Phỏm, Tiến lên (`registry.BOARD_POINTS`)
  xếp theo điểm; Cờ vây / Chấm ô / Cờ lật có `scores` nhưng là số ô / quân của riêng ván, cộng dồn vô nghĩa → xếp theo thắng.
- Xếp ở client (`registry.boardOf`): game có điểm → điểm, thắng, ít ván; còn lại và "Tất cả game" → thắng, ít ván (cùng số thắng thì ít ván = tỉ lệ cao hơn).
  Bằng hết tiêu chí thì cùng hạng.
- Cờ vua / Cờ tướng / Cá ngựa chưa có bản chấm server — kết quả do client báo vẫn được tính (CLB người quen, chủ dự án chấp nhận).
  Hàm đọc `result` phòng thủ (không ép kiểu) để một result bịa sai kiểu không làm hỏng cả bảng.
- Giao diện: tab "Bảng xếp hạng" trong sảnh (`components/games/GameBoard.jsx`); đang ở tab này thì sảnh thôi hỏi lại danh sách phòng.

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

## 4b. Xu ảo — migration `0093_games_coins.sql` (chủ dự án duyệt 2026-11-09)

Xu ảo cho vui, **không dính tiền thật**, không đụng Elo / điểm mùa / sổ quỹ.
- **Ví:** mỗi thành viên (theo CLB) bắt đầu 1000 xu, **cộng dồn mãi** (không làm lại theo tháng). Ví = 1000 + tổng
  `game_coins.delta`. Bảng sổ `game_coins` mỗi người mỗi phòng một dòng (PK `room_id, member_id`), máy khách chỉ đọc.
- **Mức cược:** chủ phòng chọn `options.stake` = 0 / 10 / 50 / 100 khi tạo phòng ("Chơi lại" giữ nguyên). Cờ vua, Cờ
  tướng, Cá ngựa **không được cược** vì kết quả do máy khách báo (`NO_STAKE`; coins.test.js gác: đúng những game chưa
  có `game_<id>_result`).
- **Chặn (chủ dự án chọn "chặn", không cho nợ để chơi tiếp):** ngồi ghế phòng có cược mà ví < mức cược →
  `games.err.noCoins`; bấm Bắt đầu mà có người đã tụt dưới mức → `games.err.noCoinsSeat`. Ván điểm vẫn có thể làm ví
  âm (thua nhiều điểm hơn số xu còn lại) — khi đó người đó chỉ chơi được phòng không cược. Chưa có cách "cứu trợ".
- **Trả xu** khi phòng sang `finished` bằng bất kỳ đường nào (game_finish / game_leave / game_claim):
  - Phỏm / Tiến lên / Ba cây / Bầu cua / Xì dách có `result.scores`: xu = điểm × mức cược (mức cược = giá 1 điểm). (Tiến lên có cóng ×2 nên tổng xu cả bàn có
    thể lệch khỏi 0 — chấp nhận, xu ảo.)
  - Còn lại, và ván bỏ cuộc không có `scores`: mỗi người thua mất đúng mức cược, người thắng chia đều (chia nguyên,
    lẻ bỏ). Hoà / không ai thắng / không ai thua → không ai mất.
  - Người của ván như BXH (0091): người bỏ giữa ván thua cược, người rời lúc phòng còn chờ không bị trừ.
- **Cách gắn:** không chép lại RPC nào — 4 trigger: `game_rooms_stake_guard` (BEFORE INSERT phòng),
  `game_players_coin_guard` (BEFORE INSERT / UPDATE OF left_at ghế — bắt cả tạo phòng, vào, vào lại),
  `game_rooms_start_guard` (BEFORE UPDATE OF status, waiting → playing), `game_rooms_settle` (AFTER UPDATE OF status
  → `game_coins_settle`, `ON CONFLICT DO NOTHING` nên trả đúng một lần).
- **Giao diện:** sảnh hiện "Ví: N xu", form tạo phòng có ô Mức cược (ẩn với 3 game không cược; ví thiếu thì tắt nút
  Tạo), dòng phòng có nhãn "Cược N"; phòng hiện nhãn cược, hết ván hiện ±xu dưới tên từng người (`game_coins` của
  phòng); tab "Ví xu" trong sảnh xếp theo số xu (`game_wallets`, chỉ người đã chơi phòng có cược). Hồ sơ có thẻ
  "Xu trò chơi" (`MyCoinsCard` trong `GameBoard.jsx`, Profile tải lười): số dư + `cfg.games.coinHistory` lần cộng /
  trừ gần nhất đọc thẳng từ `game_coins`, bấm một dòng mở lại phòng đó.

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
cũng ghi). Tab ẩn (khoá máy, chuyển app) là ngừng nhịp. Quá `offlineSec` không thấy nhịp → ghế hiện "Mất kết nối".

**Chỉ xử người mà ván đang chờ** (sửa 2026-11-09, migration 0085). Bản đầu xử mọi người quá 120 giây không thấy nhịp:
điện thoại tự khoá lúc đang chờ đối thủ nghĩ là thua, Ma sói bàn bạc ngoài đời quá 2 phút là chết.
- **Ai đang được chờ:** `registry.waitingOf(game, state)` = người tới lượt (`state.turn`); bước cả bàn cùng đi thì game
  tự khai `waiting(state)` — Ma sói: người còn sống chưa bấm / chưa bỏ phiếu, Thợ săn chưa bắn; Bắn tàu: người chưa
  chốt tàu. Game mới có bước `turn = null` mà cần chờ ai thì phải khai `waiting`, không thì không ai bị xử ở bước đó.
- **Đếm từ đâu:** từ lúc muộn hơn giữa nhịp cuối của người đó và lúc ván bắt đầu chờ (`registry.waitSinceOf` = giờ server
  của nước gần nhất, chưa có nước thì `started_at`). Khoá máy từ trước rồi mới tới lượt vẫn còn đủ 120 giây. Chỉ ghế
  đang được chờ mới hiện "Mất kết nối · còn m:ss"; người khác chỉ hiện "Mất kết nối".
- **Server** (`game_claim(p_room, p_seats)`, 0085): chỉ xử ghế được nêu, chỉ khi ván đã đứng yên đủ 120 giây (nước gần
  nhất / `started_at` quá hạn) và người đó quá 120 giây không thấy nhịp — đo bằng **giờ server**. Còn 1 người → người đó
  thắng (`result.idle = true`); còn ≥ 2 → ghi `{ out: true }` (§5.2). Server không hiểu luật nên tin danh sách ghế của
  máy khách — sửa code để nêu ghế khác cũng chỉ xử được người đã vắng quá hạn lúc ván đứng yên.
- **Giữ màn hình sáng:** người ngồi ghế lúc ván đang chơi xin Screen Wake Lock (`useGameRoom`) — máy không tự khoá nên
  không ngừng nhịp. Trình duyệt không hỗ trợ / từ chối (pin yếu) thì bỏ qua.
- Mọi số 120 (`app.json → reconnectGraceSec`, `game_claim` 0074 / 0078 / 0085) — `contract.test.js` gác khớp, gác cả tên
  tham số `p_seats` giữa SQL và `gameActions.gameClaim`.

> Còn lại: Ma sói ban ngày chờ cả làng bỏ phiếu — bàn bạc ngoài đời quá 2 phút mà ai **tự bấm** khoá máy (Wake Lock chỉ
> chặn máy tự khoá) và chưa bỏ phiếu vẫn bị xử. Sửa tận gốc là đồng hồ từng pha + hết giờ coi như bỏ qua (như Nối từ).

### 5.2 Game có thông tin ẩn (Tiến lên…) — Giai đoạn 2, đã code (0078)

Seed nằm trong DB mà mọi người đọc được → ai cũng tính được bài người khác. Bản thiết kế cũ định dùng Edge Function;
**đổi ý 2026-11-07: làm hết trong Postgres**, không thêm runtime, không thêm bước deploy:

- **Bài trên tay** ở bảng `game_hands (room_id, seat, member_id, club_id, cards int[])`. RLS: đang chơi chỉ chủ bài
  đọc được tay mình, phòng xong / bỏ thì cả CLB đọc được mọi tay (lật bài); ghế âm (nọc bài, để dành Domino) không ai
  đọc; client không ghi được; không bật realtime. Bài chia xong không đổi — bài còn lại = bài chia − các lá đã đánh.
- **Chia bài:** `game_start` (bản 0078) tra động `game_<id>_deal(uuid)`, có thì gọi sau khi đánh số lại ghế.
  Tiến lên xào bằng `random()` của server (không dùng `seed` của phòng), rồi ghi nước 1 `{ deal: { first, low, n, white } }`
  công khai: ai đi trước, lá bắt buộc của nước đầu (null nếu là ván chơi lại — người về Nhất ván trước, tra qua
  `next_room` của phòng cũ, đi trước), mỗi người bao nhiêu lá, ai tới trắng (null nếu không ai).
- **Kiểm từng nước lúc ghi:** `game_move` (bản 0078) khoá phòng rồi tra động `game_<id>_check(uuid, int, jsonb)`,
  có hàm thì trả mã lỗi là từ chối luôn — nước sai **không vào log** (khác §5.1: ở đó nước sai vẫn ghi, replay bỏ qua).
  Hàm check dựng lại ván từ log với đủ bài mọi tay. Game cũ không có hàm check → y như trước.
- **State phía client không biết bài người khác**: chỉ có số lá, các lá đã ra bàn (`gone`). `validate` ở client chặn được
  mọi thứ trừ "lá không có trên tay" (server chặn). Màn chơi nạp tay mình riêng (`storage.loadGameHand`).
- **Server chấm thêm phần client không biết:** kết quả lưu trong phòng là của `game_<id>_result` (Tiến lên cộng **thối**
  — cần bài còn trên tay). Màn chơi nhận `result` = `room.result` (null tới khi server chốt) để hiện điểm chốt.
- **Nước server điền** (0078 `game_move` gọi `game_<id>_fill(uuid, int, jsonb)` nếu có, sau hàm check): hàm trả nước
  sẽ ghi — điền số xúc xắc (Cá ngựa 0079), kết quả phát bắn (Bắn tàu 0080), chuyển quân bốc từ nọc vào tay (Domino 0081),
  hoặc RAISE để từ chối. Game JS khai `request(state, seat, move)` → true cho nước kiểu này: `useGameRoom.play` không hiện
  trước trên máy mình, ghi xong nạp lại lấy bản đã điền. Nước chưa điền (thiếu migration) thì `apply` bỏ qua, không đoán.
- **Kết quả chờ server:** máy khách không tự biết người thắng (Domino tắc — cần quân còn lại) thì `result()` trả
  `{ winners: [], pending: true }` để vẫn gọi `game_finish`; khung phòng hiện "đang chấm điểm" tới khi có `room.result`.
- **Người rời ván 3–4 người:** `game_leave` / `game_claim` (bản 0078) ghi nước `{ out: true }` cho người rời nếu ván
  còn ≥ 2 người, luật bỏ qua lượt của họ. Chỉ server ghi được `out` / `deal` — client gửi là `badMove`.
  Client dựng lại ván với ghế của **mọi người lúc ván bắt đầu** (`registry.inGameOf`: người còn ngồi + người rời sau
  `started_at`), không chỉ người còn ngồi — không thì Cờ cá ngựa (đếm ghế ở `setup`) dựng lại thành ván ít ghế hơn
  và báo nhầm người thắng. Người rời lúc phòng còn chờ không tính (ghế cũ của họ có thể trùng số).
- **Vai bí mật (Ma sói 0084):** server làm quản trò. Vai + dữ kiện riêng (đồng đội Sói, kết quả soi, ai bị cắn…) nằm ở
  hàng `game_hands` của từng ghế; vai cả bàn, lựa chọn đêm nay, trí nhớ ván ở ghế âm. Đêm nào **mọi người còn sống đều
  gửi một nước** `{ night }` (vai không có việc bấm Ngủ) và log chỉ ghi `{ night: true }` — nhìn log không đoán được ai
  có vai. Có Phù thủy trong bộ vai thì luôn có bước Phù thủy, kể cả khi Phù thủy đã chết. Xong bước thì máy bất kỳ gửi
  `{ next: true }`, server tính rồi ghi kết quả công khai (ai chết, lộ vai nào, Thợ săn, ai thắng).
- **Đồng hồ lượt (Nối từ 0083, Bài bịp 0082, Ma sói 0084):** Supabase không có tiến trình chạy nền (RPC chạy xong là
  hết, Realtime chỉ phát lại thay đổi DB), nên không có máy chủ nào tự "bấm giờ" như game server kiểu dautri.com. Thay
  vào đó: hạn = `created_at` của nước mở bước + số giây phòng chọn; máy bất kỳ thấy hết giờ thì gửi nước báo hết giờ,
  server so với `now()` — chưa hết thì `notYet` (client coi là cũ, thử lại sau). Bài bịp: `{ timeout: true }` → server
  tự đi thay người tới lượt (lá ngẫu nhiên / tố khi bắt buộc / dây ngẫu nhiên / chia ván), log ghi như nước của người đó
  kèm `timeout`. Ma sói: `{ next: true }` được nhận sớm khi hết giờ bước (đêm 45 giây, ngày theo phòng); ai chưa bấm
  coi như Ngủ / phiếu trống / Thợ săn không bắn. Giờ = 0 thì tắt đồng hồ. Ai cũng thoát hết thì không ai báo — ván nằm
  yên tới khi có người vào lại (không có cron).
- **Game cả bàn cùng đi** (Ma sói, Nối từ): `state.turn` có thể là null cả bước. Game khai `status(state, mySeat)` →
  `{ key, params }` thì khung phòng hiện dòng đó thay cho "lượt của ai"; màn chơi tự quyết khi nào được bấm.

> `ponytail:` luật Tiến lên chép hai nơi (JS + plpgsql), gác bằng bộ mẫu chung trong
> `supabase/manual/0078_games_tienlen_check.sql` (kiểu bộ, chặn, giá chặt, thối, tới trắng, 10 ván viết tay) mà `tienlen.test.js` đọc lại.
> Ma sói (pha đêm, 9 vai) vẫn làm được trong plpgsql (0084) nên chưa cần Edge Function. Ngưỡng: game cần chạy chung
> đúng một bản code JS ở server (luật quá dài để chép hai nơi) thì lúc đó mới cân Edge Function.

---

## 6. Đồng bộ realtime

- `subscribeGameRoom(roomId, onChange)` trong `storage.js`: một channel `game:<roomId>`, nghe
  `postgres_changes` INSERT của `game_moves` và UPDATE của `game_rooms`/`game_room_players` theo `room_id`.
- Mỗi lần **subscribe xong hoặc nối lại**: tải lại cả log một lần (bắt các nước lỡ khi mất mạng).
  Nhận nước có `seq` không liền mạch → tải lại log.
- Rời trang / tab ẩn quá lâu → `removeChannel`. Chỉ phòng đang mở mới tốn kết nối.
- Sảnh (`Games.jsx`) **không** subscribe — dùng `useTourPoll` có sẵn, nhịp chậm (`games.lobbyPollMs`).
  Nhịp hỏi lại chỉ lấy danh sách phòng; thống kê thắng thua (tới `statsLimit` ván) nạp **một lần** lúc mở
  sảnh (`loadGameLobby(…, withStats)`), vì đó là truy vấn nặng nhất và lặp mỗi 8 giây là tốn lưu lượng gói free.

Đây là chỗ đầu tiên app dùng Supabase Realtime. Phần còn lại vẫn poll như cũ (`ARCHITECTURE.md` §7).
Free tier (khoảng 200 kết nối đồng thời, 2 triệu message/tháng) dư cho một CLB.

---

## 7. Giao diện

### Route (trong CLB — `ROUTE_KEYS`)

| Key | URL | File |
| --- | --- | --- |
| `games` | `/tro-choi` | `pages/Games.jsx` |
| `gameRoom` | `/tro-choi/:id` | `pages/GameRoom.jsx` |
| (cùng `gameRoom`) | `/tro-choi/may-<game>` | `components/games/BotRoom.jsx` — chơi với máy, xem §7b |

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

### 7b. Chơi với máy (luyện tập)

8 trò: `BOT_GAMES` ở `registry.js` (Caro, Cờ vua, Cờ tướng, Ô ăn quan, Cờ gánh, Chấm ô, Cờ cá ngựa, Bắn tàu). Sảnh có
nút **Chơi với máy** → `/tro-choi/may-<game>`; `GameRoom.jsx` thấy tiền tố `may-` thì mở `BotRoom` (tải lười).
- **Chạy hẳn trong trình duyệt:** luật `lib/games/<id>.js`, không gọi server, không lưu, không tính thống kê. Phần server
  điền ở phòng thật làm thay bằng `fillLocal` (`lib/games/bots/index.js`): đổ xúc xắc Cá ngựa, cất tàu / tra trúng trượt
  Bắn tàu (tàu từng bên giữ trong state của BotRoom, máy chỉ đọc `state.shots`). Dùng lại đúng màn chơi `SCREENS`
  (`BanTauBoard` nhận thêm `hands` thay cho `game_hands`).
- **Mức Dễ / Vừa / Khó** — tự viết, chạy trong Web Worker (`bots/worker.js`, màn hình không đứng):
  - `bots/search.js`: minimax + alpha-beta, đào sâu dần trong hạn giờ, tìm thêm nước ăn quân ở lá — Cờ vua, Cờ tướng,
    Ô ăn quan, Cờ gánh. Gọi thẳng `game.apply` nên không bao giờ đi sai luật (đổi lại chậm hơn engine thật nhiều lần).
  - `bots/heuristics.js`: chấm điểm từng nước — Caro (đếm thế + cửa sổ 5 ô, nước bắt buộc trước), Chấm ô (ăn ô, tránh
    cạnh thứ 3, buộc phải cho thì cho ít nhất), Cá ngựa (đá, về chuồng, tránh đứng trong tầm 1–6 sau ngựa địch), Bắn
    tàu (Dễ: ngẫu nhiên · Vừa: săn / diệt · Khó: bản đồ xác suất).
  - Bảng độ sâu / giờ / `noise` ở `SEARCH` trong `bots/index.js`. Đa dạng: các nước kém nước tốt nhất ≤ `noise` được
    chọn ngẫu nhiên (Dễ noise lớn, Khó gần 0); nước bằng điểm luôn được xáo trước.
- **Mức Cao thủ** (chỉ Cờ vua, Cờ tướng) — engine nhúng, UCI, `bots/engine.js`, file ở `public/engines/` (GPL-3.0, giữ
  `Copying.txt`; tải lười, chỉ người chọn Cao thủ mới tải):
  - Cờ vua: Stockfish 18 lite single-thread (`stockfish@18.0.8` của nmrugg, ~7 MB, mọi trình duyệt hiện đại).
  - Cờ tướng: Fairy-Stockfish (`fairy-stockfish-nnue.wasm@1.1.12`, ~1,7 MB) — bản đa luồng, cần SharedArrayBuffer ⇒
    trang phải cách ly: header `COOP: same-origin` + `COEP: credentialless` **chỉ** cho `/tro-choi/may-cotuong`
    (`vercel.json`, dev: plugin `isolateEnginePage` trong `vite.config.js`). Sảnh mở trang này bằng tải trang mới (không
    chuyển kiểu SPA), rời trang bằng bất kỳ đường nào cũng tải lại (BotRoom) để trang khác (nhúng video) không bị cách ly. Safari / iPhone chưa hỗ
    trợ `credentialless` ⇒ không cách ly được ⇒ máy lùi về mức Khó và báo cho người chơi.
  - 10 nửa nước đầu xin engine 3 phương án (MultiPV), chọn ngẫu nhiên trong các nước kém nước tốt nhất ≤ 25 điểm —
    khai cuộc không lặp lại; sau đó nước tốt nhất. Engine lỗi / không tải được ⇒ lùi về mức Khó.
- Test: `bots.test.js` — máy đấu máy mọi trò mọi mức không đi sai luật; mức Khó thắng mức Dễ đa số ván (Caro, Ô ăn quan,
  Cờ gánh, Chấm ô, Bắn tàu); thấy nước chiếu hết; điền thay server của Bắn tàu / Cá ngựa; FEN / UCI của engine.
- Nâng cấp engine: tải bản mới vào `public/engines/<tên>/` (kiểm mã băm với npm), sửa đường dẫn ở `ENGINES` (engine.js).

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
  Thêm game mới là tự được kiểm, không viết lại. Kèm luật mất kết nối (§5.1b): `idleOf` / `waitSinceOf` /
  `waitingOf` (Caro, Bắn tàu, Ma sói), hạn 120 giây và tên tham số `game_claim` khớp giữa SQL và máy khách.
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
- `chamo.test.js` — đánh số nét / ô với mọi cỡ bàn, khép ô thì đi tiếp, một nét khép hai ô, hoà; 300 ván ngẫu nhiên;
  hằng số + ván mẫu khớp SQL 0077.
- `tienlen.test.js` — kiểu bộ, chặn / chặt / chặt ngang, xếp hạng, cóng, thối, tới trắng, người rời; bộ mẫu chung với
  `supabase/manual/0078_games_tienlen_check.sql`. `covua.test.js` / `cotuong.test.js` — perft chuẩn, chiếu hết, hoà.
  `cangua.test.js` — ra quân, không nhảy qua, đá ngựa, về chuồng, người rời ván 3 người vẫn đủ ghế. `bantau.test.js`,
  `domino.test.js`, `baibip.test.js`, `noitu.test.js`, `masoi.test.js`, `coup.test.js`, `baucua.test.js`, `loto.test.js`,
  `xidach.test.js` — luật phần công khai + hằng số / mã lỗi khớp SQL. `bots.test.js` — máy chơi (§7b).
- `phom.test.js` — phỏm (A thấp, không vòng), xếp lá ăn (một phỏm một lá ăn), ù khan, chuyển bài + lượt hạ, chấm điểm
  (hạng, móm, ăn chốt, ù, ù tròn, đền, người rời); bộ mẫu 0090: trọng tài JS ghi đúng từng nước / báo đúng 12 mã lỗi,
  máy khách nhận mọi nước đã ghi, chấm khớp; giá điểm + mã lỗi khớp SQL.
- `bacay.test.js` — bộ 36 lá, nút, so lá to nhất (chất trước, A to nhất), người rời thua, đọc log như server; bộ mẫu 0092
  (20 ván 2–8 người) chấm khớp `game_bacay_score`; hằng số khớp SQL. `board.test.js` — xếp hạng BXH game + gác SQL 0091.
- `coins.test.js` — xu ảo: mức cược / ví ban đầu / danh sách game không cược khớp SQL 0093, `NO_STAKE` đúng là game
  chưa có bản chấm server, đủ 4 trigger, mã lỗi có chữ.
- `covay.test.js` — ăn quân / cả nhóm, tự sát bị cấm trừ khi ăn được quân, ko (cấm ăn lại ngay, đi nước khác thì hết),
  hai lần bỏ lượt hết ván, điểm vùng + komi, trần số nước, nước rác; hằng số + bộ ván mẫu khớp SQL 0089.
  `caro.test.js` thêm bàn X-O 3 × 3 (3 quân thắng, hoà khi đầy) và game_create 0088 nhận cỡ 3.
- `fixtures.mjs` — không phải test: sinh lại bộ ván mẫu trong file kiểm 0075, 0076, 0077 và 0089 (§5.1). Chạy xong
  xem `git diff`: các khối cũ phải không đổi nội dung (máy Windows có thể đổi xuống dòng CRLF → LF — trả lại bằng
  `git checkout` file đó).
- Mutation-test theo `RULES.md` §5.

RPC/RLS kiểm tay bằng `supabase/manual/0074_games_check.sql`, `0075_games_results_check.sql`, `0076_games_colat_check.sql`,
`0077_games_chamo_check.sql`, `0078_games_tienlen_check.sql`, `0085_games_claim_check.sql`, `0086_games_masoi_wolfbite_check.sql`, `0087_games_masoi_roles_check.sql`, `0089_games_covay_check.sql`, `0090_games_phom_check.sql`, `0091_games_board_check.sql`, `0092_games_bacay_check.sql`, `0093_games_coins_check.sql`
(bản chấm từng game chạy trên ván mẫu, `game_finish` bỏ qua kết quả bịa, game chưa có bản chấm vẫn nhận kết quả client;
0085: chỉ xử ghế được nêu, ván vừa có nước mới thì chưa xử; 0086: ván Ma sói 5 người dựng sẵn vai — Sói cắn Sói, nguyền lên
Sói không ăn, nguyền lên dân vẫn hoá Sói. Chỉ cần CLB có 5 thành viên, không cần ghép tài khoản; 0087: bộ vai tự chọn
— dạng sai về tự động, luật số người, chia đúng bộ, có Phù thủy thì có bước Phù thủy). `0074_games_check.sql` gọi `game_claim` bản cũ nên chỉ
chạy được trước 0085.

---

## 9. Lộ trình

| Giai đoạn | Nội dung | Kiểm chứng phần nào của khung |
| --- | --- | --- |
| **1** | Khung (§2–§7) + **Caro**, **Ô ăn quan**, **Cờ gánh**, **Cờ lật** 2 người, server chấm | phòng, ghế, realtime, dựng lại từ log, lazy-load, chấm động (§5.1) |
| **2** | **Tiến lên** 2–4 người — đã code | bài úp trong `game_hands`, server chia + kiểm nước lúc ghi (§5.2) |
| **2b** | **Cờ vua**, **Cờ tướng** 2 người · **Cờ cá ngựa** 2–4 · **Bắn tàu** 2 · **Domino** 2–4 — đã code | nước server điền (`game_<id>_fill`): xúc xắc, phát bắn, bốc nọc; kết quả `pending` |
| **3** | **Bài bịp** 2–4 · **Nối từ** 2–8 · **Ma sói** 5–12 — đã code | lá úp nói dối, giờ theo server (`m.at`), vai bí mật + cả bàn cùng đi (`status`) |
| **4** | **Cờ vây** 9 / 13 / 19 · **Caro** thêm bàn X-O 3 × 3 · **Phỏm** 2–4 — đã code | server chấm Cờ vây bằng ván mẫu chung (§5.1); Phỏm: bài úp + nước server điền (`game_phom_fill`), bộ mẫu là kịch bản đủ bài từng tay (§5.2) |
| **5** | **Bảng xếp hạng game** (0091) · **Ba cây** 2–8 (0092) · **Xu ảo** (0093) — đã code | BXH cộng dồn trên server; Ba cây: bài úp, lật thì server điền lá vào log; xu: trigger trên bảng phòng (§4b) |
| **6** | **Tiến lên miền Bắc** (tuỳ chọn phòng) · **Cờ úp** 2 · **Bầu cua** 2–10 · **Lô tô** 2–10 · **Xì dách** 2–8 — đã code (0094–0098) | cái xoay vòng nhiều ván trong một phòng, quân úp theo ô |
| **7** | **Nối từ** có từ điển tiếng Việt + tuỳ chọn chặn từ cụt / đảo từ / lặp từ — đã code (0099–0100) | bảng dữ liệu chỉ server đọc, nước server đánh dấu `ok` |
| **8** | **Chơi với máy** 8 trò, 3 mức tự viết + Cao thủ engine nhúng (Cờ vua, Cờ tướng) — đã code (§7b) | chạy luật ở trình duyệt, Web Worker, engine UCI |

Tách repo / server game riêng chỉ khi: cần game hành động nhanh, mở cho người ngoài CLB,
hoặc vượt quota Supabase.

**Giai đoạn 1 đụng khoảng 15 file** (migration, check SQL, storage, gameActions, 2 page, App.jsx,
routes, i18n, app.json, registry, rng, caro, screens, CaroScreen, shared components, test) —
cần user duyệt file này trước.

---

## 10. Đã chốt (2026-11-06)

1. Phòng dùng **Realtime**, sảnh poll (`games.lobbyPollMs`).
2. Kết quả Caro do **server tự chấm** (§5.1) — đổi ý 2026-11-06, ban đầu định để client báo.
3. Rời phòng giữa ván = **đầu hàng**, đối thủ thắng ngay. Mất kết nối quá 120 giây **lúc ván đang chờ mình** → **tự xử thua** (§5.1b, sửa 2026-11-09).
4. Phòng mặc định **công khai** trên sảnh, có công tắc **Phòng riêng**.
5. Thông báo / push mời vào phòng: để sau.

---

## 11. Chỗ code khác bản thiết kế (Giai đoạn 1)

| Thiết kế | Code | Lý do |
| --- | --- | --- |
| `components/games/shared/` nhiều component | Ghế, trạng thái, kết quả nằm luôn trong `pages/GameRoom.jsx`; hook ở `components/games/useGameRoom.js` | Mới một game, tách component dùng một lần là thừa. Tách khi game thứ hai cần |
| `lib/games/rng.js` | Chưa có | Tiến lên chia bằng `random()` của server (§5.2) nên không cần. Thêm khi có game ngẫu nhiên công khai chạy ở client |
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

**Tiến lên** (`tienlen.js`, bản miền Nam, đối chiếu luật dautri.com — chỉ lấy luật, chữ tự viết): 2–4 người, mỗi người
13 lá (2–3 người thì thừa lá, bỏ úp). Lá c = hạng × 4 + chất, hạng 3 < 4 < … < A < 2, chất bích < nhép < rô < cơ.
- **Bộ:** lẻ, đôi, sám, tứ quý, sảnh (≥ 3 hạng liền, không có 2), đôi thông (≥ 3 đôi liền, không có 2). Chặn = cùng kiểu,
  cùng số lá, lá cao nhất to hơn.
- **Chặt:** 3 đôi thông chặt một heo; tứ quý chặt heo, đôi heo, 3 đôi thông; 4 đôi thông trở lên chặt cả tứ quý (dài
  hơn chặt ngắn hơn). **4 đôi thông chặt ngang được** — ngoài lượt, kể cả đã bỏ lượt; lượt sau đi tiếp từ người chặt.
  Chặt chồng được. Tiền chặt (heo đen 1, heo đỏ 2, 3 đôi thông 3, tứ quý / 4 đôi thông 4) dồn cả chuỗi trong vòng,
  hết vòng người bị chặt sau cùng trả người chặt sau cùng (`pot` → `pay`).
- **Lượt:** ván đầu ai cầm lá nhỏ nhất đi trước, nước đầu phải có lá đó (tuỳ chọn phòng `options.lead = 'free'`: vẫn đi
  trước nhưng đánh tự do — 0094 ghi `low = null`); ván chơi lại người về Nhất đi trước, đánh tự do.
  Bỏ lượt là mất quyền tới hết vòng; cả bàn bỏ thì người đánh cuối mở vòng (người đó đã về / rời thì ghế kế sau).
- **Hết ván:** hết bài là về đích, ván chạy tới khi còn một người → `ranks` Nhất … Bét. Điểm hạng 4 người +3 +1 −1 −3,
  3 người +2 0 −2, 2 người +1 −1. **Cóng:** có người về Nhất mà ai chưa đánh lá nào → về chót, ăn gấp đôi điểm Bét.
  **Rời ván:** về Bét (rời trước đứng dưới). **Thối:** hết ván ai chưa về đích (kể cả cóng, trừ người rời) còn heo /
  tứ quý / dải đôi thông trên tay thì trả người về Nhất theo giá chặt — chỉ server chấm (0078), JS không biết bài.
- **Tới trắng** lúc chia: sảnh rồng 3 → A, tứ quý heo, 5 đôi thông, 6 đôi (tứ quý tính hai đôi) → thắng luôn, xếp hạng
  những người khác theo ghế, không tính thối.
- `result` = `{ winners: [Nhất], draw: false, ranks, scores }`.
- **Miền Bắc** (`options.variant = 'bac'`, chọn lúc tạo phòng; 0094): chặn phải **đồng chất** — lẻ cùng chất, đôi / sám
  cùng bộ chất (`mask`); sảnh phải cả dây một chất. Heo chặn mọi lẻ / đôi không phải heo. Tứ quý chặt heo, đôi heo, tứ
  quý nhỏ hơn. Không có đôi thông, không chặt ngang, không tới trắng, không cóng. Về bằng nước có heo / tứ quý (**chốt**)
  thì xếp dưới người còn bài. Thối chỉ tính heo + tứ quý.

**Cờ vua** (`covua.js`, luật FIDE): đủ nhập thành, bắt tốt qua đường, phong cấp (chọn hậu / xe / tượng / mã), chiếu hết,
hoà khi hết nước mà không bị chiếu / lặp thế 3 lần / 50 nước không ăn quân không đi tốt / thiếu quân chiếu hết. Gác bằng
perft chuẩn (thế đầu tới độ sâu 3, Kiwipete, thế 3, thế 4). Chưa có cầu hoà, đồng hồ, SQL chấm lại.

**Cờ tướng** (`cotuong.js`): đỏ đi trước; tướng / sĩ trong cung, tượng không qua sông + cản mắt, mã cản chân, pháo ăn
qua đúng một ngòi, tốt qua sông đi ngang; cấm lộ mặt tướng; **hết nước là thua** (kể cả bị vây không chiếu). Chống kéo
dài: 120 nước liền không ăn quân, lặp thế 3 lần, hai bên hết quân sang sông được → hoà (chưa có luật chiếu dai / đuổi
dai của giải). Perft thế đầu 44 / 1920.

**Cờ cá ngựa** (`cangua.js`, luật truyền thống): 2–4 người (2 người đỏ / vàng đối diện), 4 ngựa, 1 xúc xắc do server
đổ (0079). Ra quân bằng 1 hoặc 6; đi đúng số nút, không nhảy qua ngựa nào, không dừng trên ngựa mình, dừng trúng ngựa
đối phương là đá về chuồng. Phải dừng đúng cửa chuồng; đứng cửa đổ n lên bậc n; trong chuồng chỉ lên bậc kế bằng đúng số
bậc đó. 6 được đổ tiếp; không đi được thì mất lượt. Thắng: 4 ngựa ở bậc 3–6. Đường đua 48 ô vẽ thành vòng tròn.

**Bắn tàu** (`bantau.js`): 10 × 10, tàu 5-4-3-3-2 thẳng hàng, không chồng (được sát nhau). Xếp xong server cất tàu
(`game_hands`), log chỉ ghi `{ placed: true }`. Ghế 1 bắn trước; trúng bắn tiếp, trượt đổi lượt; server ghi
`{ fire, hit, sunk? }` và chấm lại (trúng đủ 17 ô thắng — 0080). Chỉ có xếp ngẫu nhiên, chưa kéo thả từng tàu.

**Domino** (`domino.js`, kiểu bốc, bộ đôi-sáu): 7 quân mỗi người, còn lại là nọc ở ghế -1. Ván đầu: đôi lớn nhất đi
trước và phải đánh con đó (không ai có đôi thì con nhiều nút nhất); ván chơi lại người thắng đi trước. Không có quân
khớp thì bốc tới khi đánh được, hết nọc mới được bỏ lượt; có quân khớp thì phải đánh (server kiểm — 0081). Hết quân
thắng; tắc (cả bàn bỏ liền nhau) thì ít nút nhất thắng, bằng nhau hoà. Người thắng ăn tổng nút của đối thủ.

**Chấm ô** (`chamo.js`, trò giấy bút trên vở ô ly): 2 người, bàn n × n ô (chủ phòng chọn 3–6, server nhận 2–8,
lạ thì về 5). Mỗi lượt nối một nét ngang / dọc giữa hai chấm kề nhau. Nét khép kín ô nào thì ô đó của người nối và người
đó đi tiếp (một nét có thể khép hai ô); không khép được thì đổi lượt. Nối hết nét thì đếm ô, bằng nhau hoà (0077 chấm lại).

**Bài bịp** (`baibip.js`): 2–4 người, bộ 20 lá (6 Q, 6 K, 6 A, 2 Joker), mỗi ván chia 5 lá + một "lá chủ". Đến lượt úp 1–3
lá và nhận đó là lá chủ (Joker luôn đúng), hoặc tố người vừa úp. Tố đúng thì người úp thua, tố oan thì người tố thua; người
thua cắt một dây trên bom 6 dây của mình (một dây nổ, server giấu ở ghế -1) — nổ là bị loại. Ai cũng hết bài trừ mình thì
bắt buộc tố. Còn một người là thắng. Rời bàn = bị loại; đang giữa ván thì chia ván mới (0082). Đồng hồ lượt 20 / 30 /
60 giây hoặc tắt (mặc định 30): hết giờ máy tự đi thay.

**Nối từ** (`noitu.js`): 2–8 người, thứ tự lượt server xáo. Tiếng Việt: từ 2 âm tiết, âm tiết đầu = âm tiết cuối của từ
trước; English: bắt đầu bằng 1 hoặc 2 chữ cuối (tuỳ phòng). Từ bị bác không gửi lại; từ đã nhận được nhận lại tối đa
`repeat` lần (0 / 1 / 2). Duyệt bằng phiếu: cả bàn duyệt 8 giây, im lặng là nhận, bị bác khi phiếu bác nhiều hơn phiếu
nhận; bị bác được cộng 3 giây, mỗi lượt gửi tối đa 2 từ. Hết giờ hoặc Chịu là bị loại, người kế bắt đầu bằng từ tự do.
Giờ theo server: hết giờ do máy bất kỳ báo, 0083 chỉ nhận khi đúng là đã hết.
- **Từ điển (0099 / 0100, chỉ tiếng Việt):** bảng `game_words_vi` (~48 nghìn từ 2 âm tiết lọc từ UTS_Dictionary,
  Apache-2.0; chỉ server đọc). Tuỳ chọn `dict`: `'vote'` (phòng cũ — chỉ bỏ phiếu), `'mix'` (mặc định phòng mới — có
  trong từ điển thì `game_noitu_fill` ghi kèm `{ ok: true }`, nhận ngay; từ lạ thì bỏ phiếu), `'dict'` (không có trong
  từ điển = `notInDict`, không tốn lượt gửi). `cut` = chặn từ cụt (`deadEnd`). `flip = false` cấm đảo từ vừa dùng
  (`flipWord`). Dấu oa / oe / uy chuẩn về kiểu cũ ("hoà" → "hòa") ở `normWord` và trong dữ liệu 0100.

**Ma sói** (`masoi.js`): 5–12 người, server làm quản trò (0084). Chủ phòng chọn bộ vai lúc tạo phòng (0087, `deckOf`):
- **Tự động** (mặc định, `tableOf`): 1 Sói (≤ 5 người), 2 (≤ 8), 3 (từ 9); từ 8 người một Sói là Sói nguyền; rồi 2–6 vai
  đặc biệt theo thứ tự Tiên tri, Bảo vệ, Phù thủy, Thợ săn, Già làng, Thần tình yêu; còn lại là Dân làng.
- **Tự chọn** (`options.roles` = các vai không phải Dân làng): số Sói thường + bật / tắt từng vai đặc biệt (mỗi vai tối
  đa 1); ai dư là Dân làng. Luật: ít nhất 1 Sói, không quá số người, Sói ít hơn số người còn lại — phòng chờ báo và chặn
  nút Bắt đầu (`lobby`), server từ chối lần nữa (`game_masoi_deck`, mã `noWolf` / `tooManyRoles` / `tooManyWolves`).
  Bộ vai chốt lúc tạo phòng, muốn đổi thì tạo phòng mới.
- Lúc bắt đầu server xáo bộ vai rồi chia ngẫu nhiên. Có bước Phù thủy hay không theo bộ vai của phòng, không theo ai còn
  sống (không lộ).
- **Đêm:** Sói cùng chọn người cắn (nhiều phiếu nhất, hoà thì bốc ngẫu nhiên) — được chọn bất kỳ ai còn sống, kể cả đồng
  đội Sói và chính mình để đánh lạc hướng (0086, chốt 2026-11-09; bản 0084 cấm); Tiên tri soi một người (Sói nguyền tính là
  Sói); Bảo vệ che một người, được che mình, không che một người hai đêm liền; đêm đầu Thần tình yêu ghép một đôi. Bước
  Phù thủy: biết ai bị cắn, một bình cứu (cứu được mình) và một bình độc (không tự độc) cho cả ván, mỗi đêm tối đa một bình.
- **Sáng:** người bị cắn chết nếu không được che / cứu. Sói nguyền một lần trong ván biến nạn nhân thành Sói thay vì giết
  (người đó biết mặt cả bầy); nạn nhân đã là Sói thì lời nguyền không có tác dụng, không mất lượt, nạn nhân chết như
  thường (0086). Già làng sống qua lần đầu bị cắn trúng. Tình nhân chết thì người kia chết theo. Thợ săn chết
  (trừ rời bàn) được bắn một người.
- **Ngày:** người còn sống bầu treo cổ hoặc bỏ qua; bị treo khi nhiều phiếu nhất và hơn hẳn mọi lựa chọn khác kể cả bỏ
  qua, hoà thì không ai.
- **Đồng hồ:** mỗi bước đêm 45 giây, ban ngày 60 / 120 / 180 / 300 giây hoặc tắt (mặc định 120); hết giờ thì sang bước.
- **Thắng:** hết Sói → Dân làng; Sói ≥ số người còn lại → bầy Sói; đôi tình nhân khác phe là hai người cuối → đôi đó.
  `result.winners` = mọi ghế của phe thắng.
- **Lộ vai** (chủ phòng chọn, `options.reveal`): mọi người chết · chỉ người bị treo · không ai; hết ván lật hết. Rời bàn
  = chết, không lộ vai, không được bắn.

**Cờ úp** (`coup.js`, 0095): bàn / luật Cờ tướng; trừ hai tướng, quân mỗi bên bị úp và xáo vào các ô xuất phát. Quân úp
đi nước đầu theo quân gốc ở ô đó rồi lật; sĩ / tượng đã lật đi khắp bàn. Server giữ mặt thật (ghế -1, theo ô xuất phát) và
điền `flip` / `took` lúc ghi. Chỉ còn hai tướng → hoà. ponytail: server chưa kiểm luật đi — client sửa code gửi nước sai bị
mọi máy bỏ qua nhưng dò được mặt một quân úp; thêm kiểm luật ở SQL nếu đánh giải.

**Bầu cua** (`baucua.js`, 0096): 2–10 người, cái xoay vòng theo ghế (`laps` vòng 1 / 2 / 3). Con đặt tối đa 10 điểm / ván
(mức 1 / 2 / 5) rồi chốt (chốt 0 = bỏ ván). Cả bàn chốt hoặc hết giờ đặt (15 / 20 / 30 giây, mặc định 20) thì máy bất kỳ
gửi `{ roll }`, server lắc 3 hột. Con ra k hột ăn k lần, không ra mất tiền đặt. Cái rời giữa ván → ván bỏ.

**Lô tô** (`loto.js`, 0097): 2–10 người, server phát tờ 9 hàng × 5 số (cột 1–9, 10–19 … 80–90, không trùng — tờ công khai)
và xướng số ngẫu nhiên theo nhịp 3 / 5 / 8 giây (mặc định 5). Hàng đủ 5 số đã xướng thì `{ kinh }`; kinh sai = `noKinh`.
Người kinh đúng đầu tiên thắng.

**Xì dách** (`xidach.js`, 0098): 2–8 người, cái xoay vòng (`laps`). Chia 2 lá úp; A tính 1 / 10 / 11 (2 lá) hoặc 1 / 10
(từ 3 lá). Xì bàn > xì dách > ngũ linh (ít điểm thắng) > điểm thường; quắc thua bài không quắc, hai bên cùng quắc hoà.
Con dằn từ 16, cái từ 15 (server kiểm — `notEnough`). Thắng thường +1, thắng bằng xì / ngũ linh +2. Cái có xì lật ngay; con
có xì ngồi chờ. Cái dằn thì server ghi bài cả bàn (`show`). Đồng hồ lượt 20 / 30 / 45 giây hoặc tắt (mặc định 30).

**Caro bàn 3 × 3** (0088): X-O cổ điển — chọn cỡ 3 khi tạo phòng thì 3 quân liền là thắng, không có luật chặn hai đầu.
`game_caro_result` (0074) đã chấm đúng mọi cỡ, chỉ `game_create` phải nới cỡ nhỏ nhất từ 5 xuống 3.

**Cờ vây** (`covay.js`, luật Trung Quốc rút gọn): 2 người, Đen (ghế 0) đi trước, bàn 9 × 9 / 13 × 13 / 19 × 19 (chủ phòng
chọn, lạ thì 9). Đặt quân vào giao điểm hoặc bỏ lượt; nhóm hết khí bị ăn; cấm tự sát (trừ khi nước đó ăn được quân);
ko đơn giản: ăn đúng một quân bằng một quân đơn còn một khí thì đối phương không ăn lại ngay ở đó. Hết ván khi hai bên bỏ
lượt liền nhau hoặc đủ 3 × số giao điểm nước hợp lệ (chặn ko ba vô tận). Tính điểm tự động theo vùng: quân + giao điểm
trống chỉ giáp quân một màu, Trắng +7,5 komi — không hoà. Không có bước đánh dấu quân chết (chủ dự án chọn 2026-11-09):
quân chết phải ăn hẳn trước khi bỏ lượt. Server chấm lại (0089), `result.scores` = điểm hai bên. Màn chơi: điện thoại
chạm để ngắm rồi chạm lại / bấm Đặt quân mới đặt (bàn 19 × 19 mỗi ô ~18px), bấm điểm cấm thì báo lý do.

**Phỏm / Tá lả** (`phom.js`, server 0090; chủ dự án duyệt 2026-11-09, thêm chuyển bài cùng ngày). Các trang luật trên
mạng chỉ thống nhất phần cơ bản; tiền / điểm phạt, đền và chuyển bài mỗi nơi một kiểu (nguồn cuối mục). Bản đã chọn —
miền Bắc phổ biến, đơn vị là điểm, không tiền:
- 2–4 người, bộ 52 lá. Mỗi người 9 lá, người đi đầu 10 lá (ván đầu server bốc ngẫu nhiên, ván chơi lại người về Nhất).
  Còn lại úp làm nọc (ghế -1).
- Lượt: ăn lá người ngồi trước vừa đánh nếu nó ghép thành phỏm với bài trên tay, không thì bốc 1 lá nọc; rồi đánh 1 lá vào
  chồng bài trước mặt. Lá đã ăn để ngửa, khi hạ phải nằm trong phỏm; một phỏm không chứa hai lá ăn — nên server chỉ cho ăn
  khi vẫn xếp được mọi lá ăn vào các phỏm rời nhau (`game_phom_cover`), và không cho đánh lá ăn / lá đang giữ phỏm ăn.
- **Chuyển bài:** Q ăn lá của P → lá đó rời chồng P, lá trên cùng chồng Q chuyển sang chồng P (Q chưa đánh lá nào thì thôi).
  Chồng P giữ số lá, chồng Q thiếu một → Q đánh thêm một lượt, hạ muộn hơn; thứ tự hạ (và ai gửi được vào phỏm ai) đổi
  theo. Số lá phải bốc luôn là 4 × số người − 1 (4 người: đúng 15 lá nọc) nên nọc không bao giờ cạn. Không làm "tái" —
  với cách chuyển này người đã hạ không bao giờ thiếu lá (code vẫn cho đánh thêm lượt nếu lỡ thiếu, để ván không kẹt).
- Phỏm: ≥ 3 lá cùng số, hoặc ≥ 3 lá liên tiếp cùng chất. A tính là 1 (A-2-3 được, Q-K-A không).
- Hạ: tới lượt mà chồng đã có 3 lá thì sau khi ăn / bốc phải hạ (không phỏm = móm; app gợi ý cách xếp ít điểm rác nhất,
  người chơi chỉnh được), được gửi lá rác vào phỏm của người hạ trước (phải hạ ít nhất một phỏm mới được gửi), rồi đánh lá
  thứ 4 — lá chốt. Chồng đủ 4 lá là xong; mọi người xong thì hết ván.
- Ù: chưa hạ, sau khi ăn / bốc (hoặc người đi đầu lượt đầu) mà 9 lá thành phỏm (lá thứ 10 đánh luôn) → thắng ngay; cả 10
  lá → ù tròn. Ù khan: vừa chia đã không có đôi / cạ nào (server kiểm lúc chia, xét từ người đi đầu).
- Xếp hạng: ít điểm rác nhất về Nhất (A = 1, J = 11, Q = 12, K = 13); bằng điểm thì ai hạ trước hơn. Móm xếp sau mọi người
  không móm; người rời ván xếp cuối (rời trước đứng dưới).
- Điểm: Nhì −1, Ba −2, người xếp cuối −3, móm −4 thay điểm hạng; Nhất nhận tổng. Mỗi lá bị ăn: người bị ăn trả người ăn 1,
  ăn lá chốt (lá đánh sau khi đã hạ) trả 4. Ù: mỗi người trả 5 (ù tròn 10, ù khan 5); người ù đã ăn ≥ 3 lá của cùng một
  người thì người đó đền thay cả làng.
- Log chỉ có phần công khai: `{ draw: true }` (không lộ lá bốc) · `{ eat: lá }` · `{ discard }` · `{ lay, send }` ·
  `{ u, tron, discard }`. Kết quả cần bài trên tay nên chỉ server chấm (`result()` trả `pending`). Bản JS của server
  (`referee`, `judge`, `dealMove`) chỉ test và bộ mẫu dùng; mã lỗi và THỨ TỰ KIỂM khớp `game_phom_fill`.

**Ba cây** (`bacay.js`, server 0092; chủ dự án duyệt 2026-11-09: so bài, tính điểm, bộ 36 lá bỏ 10 / J / Q / K — nên
không có Ba tiên). 2–8 người, không nhà cái, không có lượt.
- Chia mỗi người 3 lá úp (`game_bacay_deal`, nước 1 `{ deal: { n } }`). Máy mình chạm từng lá để nặn (chỉ ở máy mình),
  bấm Lật → gửi `{ flip: true }`, server điền 3 lá thật (`game_bacay_fill`) → cả bàn thấy. Mọi người lật / rời là hết ván.
- Điểm lá A = 1 … 9 = 9; nút = tổng % 10 (tròn chục là bù). Nút cao thắng; bằng nút so lá to nhất: chất ♦ > ♥ > ♠ > ♣
  trước, cùng chất A > 9 > … > 2 — 36 lá có 36 độ to khác nhau nên không bao giờ hoà. Người rời thua.
- Điểm: người thắng ăn mỗi người 1 → cả bàn bằng 0 → BXH xếp theo điểm (`BOARD_POINTS`).
- Lá đã lật nằm trong log nên `result()` ở JS tính được đủ; `game_bacay_result` đọc log y như `apply` (nước sau lúc ván
  đã xong bị bỏ qua) rồi chấm bằng `game_bacay_score` — hàm thuần mà file kiểm chạy trên bộ mẫu chung.
- Chọn so bài, không làm cái (làm cái = mỗi người cược riêng với nhà cái — chưa làm).

Nguồn đã đối chiếu: [vi.wikipedia Cờ gánh](https://vi.wikipedia.org/wiki/C%E1%BB%9D_g%C3%A1nh),
[FPT Shop](https://fptshop.com.vn/tin-tuc/thu-thuat/cach-choi-co-ganh-175672),
[Wikipedia Ô ăn quan](https://en.wikipedia.org/wiki/%C3%94_%C4%83n_quan),
[cellphones](https://cellphones.com.vn/sforum/o-an-quan); luật Tiến lên, Cờ cá ngựa, Bắn tàu, Domino, Ma sói đối chiếu thêm phần luật
của dautri.com — chỉ lấy luật, chữ và hình đều tự viết / tự vẽ. Phỏm: [vi.wikipedia Phỏm](https://vi.wikipedia.org/wiki/Ph%E1%BB%8Fm)
(bài ngắn, không dẫn nguồn), [thuthuatchoi](https://thuthuatchoi.com/huong-dan-cach-choi-ta-la-phom.html) (bảng điểm +6 / −1 /
−2 / −3, chốt ±4, ù ±5), [dothethaodep](https://dothethaodep.com/bi-quyet-lam-chu-ban-choi-phom/) (tính theo lần tiền cược).
