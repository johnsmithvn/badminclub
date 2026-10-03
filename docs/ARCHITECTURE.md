# ARCHITECTURE.md — Quản lý CLB cầu lông

**Version:** v2.0.0 · **Updated:** 2026-09-30

Tài liệu này nói **codebase này được dựng thế nào**. Đặc tả nghiệp vụ gốc nằm trong bộ handoff
(`design_handoff_clb_cau_long/01..06`) — không lặp lại ở đây; chỗ nào cần thì trỏ sang.

---

## 1. Stack và lý do chọn

| Lớp | Chọn | Lý do |
| --- | --- | --- |
| Build | **Vite 8** | Rolldown, build nhanh; đồng bộ với dự án khác của team |
| UI | **React 19.2**, JavaScript thuần (`.jsx`) | prototype handoff là JS; test chạy file `.js` bằng `node` trực tiếp nên thêm TypeScript là thêm bước build cho test. DS bundle không dùng `defaultProps`/`propTypes` nên React 19 chạy được nguyên trạng |
| Router | **React Router 7** | URL thật (`/buoi-tap/B5`, `/tai-khoan`) chia sẻ và deep-link được, nút back của browser đúng |
| Design system | **TDMS trích từ handoff** → `src/components/ds/` | `_ds_bundle.js` đã có 29 component React build sẵn đúng thiết kế. Trích lại rẻ hơn và khớp hơn viết lại |
| Icon | **lucide-react** + bảng static `ds/icons.js` | bundled, chạy offline. Giữ đúng bộ icon Lucide mà handoff `06` đã chốt |
| State | **không lib** — 1 Context + 2 `useState` | đúng hình dạng prototype (một cây state), không cần Redux/Zustand |
| Chữ và hằng số | `src/i18n/vi.json` + `src/config/*.json` | xem `docs/RULES.md` §3 |
| Dữ liệu | **Supabase** (Postgres + Auth + RLS), local qua Docker | không còn chế độ dữ liệu mẫu: thiếu `.env.local` là app không chạy. Xem §6 |
| Push | **Web Push (VAPID) + Supabase Edge Functions** | PWA push notification nền qua hàm `push-send`, không tốn phí APNs/FCM |
| Lint | ESLint 9 + `react-hooks` | bắt lỗi hook thật |
| Test | `node --test` + `node:assert/strict`, không framework | runner sẵn có của Node, tự tìm `*.test.js`; xem `docs/RULES.md` §5 |

**Dependency runtime: đúng 7** — `@lottielab/lottie-player`, `@supabase/supabase-js`, `jsqr`, `lucide-react`, `react`, `react-dom`, `react-router-dom`.
Không thêm dependency UI nào khác (không Tailwind, không MUI, không styled-components).

---

## 2. Cây file

```
index.html            jsconfig.json (alias cho editor)   vercel.json
public/favicon.svg    public/sw.js (Service Worker Web Push)
src/
  main.jsx            mount React + BrowserRouter + AuthProvider + ThemeProvider + StoreProvider
  App.jsx             đăng ký route, gác quyền, đưa navigate cho actions
  components/
    auth/             AuthLayout
    badges/           BadgeCard · BadgeDetailModal · BadgeHex · BadgeShelf · BadgeUnlockModal · BountyHeroPoster · CollectorLeaderboardTab · GlobalBadgeUnlockHost · TierBackdrop · tierFx · mobile/ (MobileBadgeCollection)
    challenge/        ArenaChallengeCard · CreateChallengeModal · ScoreModal · EditScoreModal · RatingLineChart · ChallengeDetailModal · MatchDetailModal · AttachVideoModal · VideoPlayerModal
    ds/               DESIGN SYSTEM TDMS — trích từ handoff, KHÔNG sửa tay (icons.js + index.js)
    home/             ActivityTab · HomeMatchTab · personal/ (HeroRankCard · MyOpponentsCard · RecentFormCard · SynergyBadgesCard · UpcomingSessionCard...)
    layout/           AppLayout · Sidebar · AppHeader · MobileFooterNav · MoreSheet · ToastHost
    leaderboard/      SeasonRaceTab · CareerEloTab · PairsTab · PairH2HTab · MemberSeasonLedgerModal · PairDetailModal · PairH2HModal · RatingFormulaModal
    notification/     NotificationBell · NotificationPanel · NotificationItem
    profile/          MemberProfileTab
    session/          CourtAssignmentTab · SessionMatchesTab · BalanceScore · CourtWaitingFilterSheet · EffectiveStrengthModal · SeasonSettingsModal · SessionStatsSheet · VoiceMatchModal · PlannerModal
    settings/         SettingsComponents.jsx · tabs/ (AccessTab · CourtsTab · GeneralTab · GroupsTab · MoneyTab · SchedulesTab)
    tournament/       BracketBoard · EventBar · FlowCanvas · InfoTab · MatchDialogs · OverviewTab · PairingTab · PlayersTab · RecommendDialog · SpinDraw · TourBits · TourFormDialog · TourHero · TourModuleNav · TourStepper
    ui/               primitive của app: Mono, LevelChip, SessionPill, Empty, Bar, AvatarUpload, BankAccountSection, QrModal, SearchSelect · MyDebtPanel · PayDebtsDialog
  config/             app.json (hằng số, rating cfg) · permissions.json (ma trận quyền)
  contexts/
    AuthContext.jsx   phiên đăng nhập, profile, danh sách CLB của tôi, activeClubId
    AppContext.jsx    db + ui state của MỘT CLB, Context
    ThemeContext.jsx  quản lý Dark / Light / System theme chống nháy sáng FOUC
    appActions.js     MỌI hành động ghi dữ liệu (thi đấu, chia sân, tiền, sổ quỹ, XP, cược)
    tournamentActions.js  hành động nghiệp vụ giải đấu qua RPC
    storage.js        ĐIỂM CHẠM MẠNG DUY NHẤT cho state db: load(clubId) / save(db)
    dbmap.js          map thuần client ↔ 34+ bảng Postgres + diff() + tourRows / toTour
  data/
    schema.js         mô tả schema để render trang Sơ đồ dữ liệu
    rankThemes.js     loader & helper cho 4 theme xếp hạng & kho biệt danh
    rankThemes.json   dữ liệu phân bậc 8 rank tiers và playstyle badges
  hooks/
    useClock.js       đồng hồ bấm giờ sân
    useMobile.js      kiểm tra breakpoint màn hình di động (<= 768px)
  i18n/               index.js (hàm t) + vi.json (toàn bộ chữ)
  lib/                LOGIC THUẦN — không React, không I/O, test bằng node
    activity.js       sự kiện mạng xã hội CLB (Social Activity), thông báo cá nhân, điểm nhấn cá nhân hoá (Personal Highlights), sắc thái trận đấu (Match Narratives)
    assign.js         chia sân: slot, 5 chế độ xếp, chia đều, số trận
    backtest.js       runner chạy lại dữ liệu lịch sử thật
    badges.js         hệ thống danh hiệu, điều kiện mở khóa, tính toán badge shelf & bounty board
    challenge.js      kèo đấu: mã kèo, hướng xem, độ cân, điều kiện nhận/đẩy sân, cược SP
    csv.js            đọc/sinh CSV thành viên, RFC 4180, validate, phát hiện cột
    forms.js          giá trị mặc định an toàn cho các dialog
    homePersonal.js   tính toán phân tích cá nhân, phong độ, cạ cứng, đối thủ cho trang Tổng quan
    ledger.js         sổ quỹ (ledger, số dư, gộp dòng, tổng hợp ngày, hoàn tác)
    matchBackup.js    xuất/nhập sao lưu dữ liệu trận đấu
    matchSearch.js    tìm kiếm trận đấu, lọc đối đầu/đồng đội, ma trận H2H, cặp chưa từng gặp
    members.js        lọc/tìm/sắp xếp thành viên, chọn trường ghép tài khoản (0009/0010)
    money.js          mọi công thức tiền + tra cứu + màu/nhãn trạng thái + đối chiếu
    planner.js        phân hệ lập dây trận: chia vòng (rounds), ưu tiên kèo, xử lý nguyện vọng, cân bằng lượt đấu
    pushSubscription.js quản lý đăng ký Web Push VAPID, tương tác Edge Function push-send
    rating.js         Elo Engine: tính delta, win%, đánh giá độ cân, độ tin cậy R1-R5, hiệu chỉnh chéo giới, replay cascade, dynamic K, margin multiplier, rankPairs
    roles.js          tra cứu ma trận quyền 3 vai
    schedules.js      kế hoạch SỬA/XOÁ lịch cố định: buổi nào được đụng, tháng nào đổi đơn giá
    season.js         đua top mùa giải (Season Points): 5 dải delta, Floor 0, streak/upset bonus, qualified 20 trận, inactive 21 ngày, Bounty Player
    supabase.js       khởi tạo client Supabase từ biến môi trường
    tournament/       17 file logic giải đấu: advance · bracket · bracketView · canvas · doubleElim · finance · flow · format · hub · links · pairing · recommend · roundRobin · scoreboard · scoring · standings · swiss
    xp.js             hệ thống XP, Cấp bậc và Sổ ghi đóng góp VĐV (Trục gắn bó: tham gia, ra sân, thâm niên, rủ khách; cấp 1-25+ và 6 danh xưng)
  pages/              1 file 1 màn hình, chỉ render + gọi actions (23 màn hình)
    Account.jsx       hồ sơ tài khoản (profiles, NGOÀI CLB)
    Badges.jsx        bộ sưu tập danh hiệu (kèm banner truy nã), BXH sưu tầm
    Calendar.jsx      lịch tháng buổi tập
    Clubs.jsx         danh sách CLB, tạo CLB, tham gia bằng mã
    Debts.jsx         quản lý công nợ, đối chiếu buổi lẻ, duyệt khai nợ
    Dialogs.jsx       host toàn bộ dialog nhập liệu của app
    Fund.jsx          sổ quỹ chi tiết, hóa đơn sân trọn tháng
    Home.jsx          trang chủ CLB (Tổng quan, Hoạt động, Trận & Kèo, Sổ quỹ, Báo cáo)
    Leaderboard.jsx   Bảng xếp hạng: SeasonRace · CareerElo · Pairs · PairH2H · Search/Matrix
    Login.jsx         đăng nhập (email / username / SĐT)
    Matches.jsx       Sàn Đấu, Lịch sử trận & Video Replay, Ma trận H2H
    Members.jsx       danh sách thành viên, hàng chờ duyệt ghép
    MyStats.jsx       thống kê phong độ & phân tích chỉ số cá nhân (/tong-quan)
    Profile.jsx       hồ sơ thành viên trong CLB
    Register.jsx      đăng ký (email + mật khẩu, auto-username, tên gọi)
    Schema.jsx        trang hiển thị sơ đồ dữ liệu trong app (/so-do-du-lieu)
    SessionDetail.jsx chi tiết buổi tập (Điểm danh & tiền, Chia sân & Kèo chờ, Trận đấu)
    Sessions.jsx      danh sách các buổi tập CLB
    Settings.jsx      cài đặt CLB (Chung, Sân, Nhóm, Lịch, Phí & Tiền, Tài khoản & Quyền)
    TournamentBracket.jsx sơ đồ nhánh đấu trực quan cho từng nội dung giải
    TournamentFlow.jsx    sơ đồ Canvas liên kết các giai đoạn giải đấu
    TournamentHub.jsx     quản trị giải đấu, đăng ký, bốc thăm, xếp cặp
    Tournaments.jsx   danh sách giải đấu của CLB (/giai-dau)
  routes/index.js     bảng route key ↔ URL (PUBLIC_PATHS + 18 in-club routes)
  styles/             index.css + tokens/*.css (dark.css, base.css hỗ trợ utility classes responsive mobile)
  utils/              dates.js · image.js · vietqr.js · voiceMatchParser.js
  __tests__/          test runner node:assert/strict bao phủ toàn bộ lib, money, sync, smoke, tournament, backtest
supabase/migrations/  SQL cho bản chạy thật (0001..0063)
docs/                 RULES · ARCHITECTURE · DATABASE · FEATURES · TASKS · BACKTEST · CHI_SO_VA_CONG_THUC · TOURNAMENT_PLAN
```

### Import alias

`package.json` field `imports` khai báo `#lib/*`, `#ui`, `#ds`, `#i18n`, `#routes`, `#config/*`…
Đây là **subpath imports của Node**, không phải alias của bundler — nên **cùng một cú pháp chạy ở
cả Vite và `node` chạy test**. Đừng thêm `resolve.alias` trong `vite.config.js`: `node` không đọc
được và test sẽ vỡ.

### Quy tắc phân lớp (quan trọng)

```
pages/*.jsx          →  đọc db qua useApp(), gọi selector trong lib/, gọi a.<action>()
appActions.js        →  hàm duy nhất được ghi state; mỗi hành động bắn 1 toast
lib/*, utils/*       →  hàm THUẦN: (db, args) => giá trị. Không setState, không fetch
AppContext.jsx       →  giữ state, persist, không chứa nghiệp vụ
i18n/ + config/      →  toàn bộ chữ và hằng số (xem docs/RULES.md §3)
```

Màn hình **không** được tự `setDb`. Công thức tiền **không** được viết trong màn hình.
Chữ tiếng Việt **không** được viết trong `.jsx`.
Lý do: mọi con số phải giải thích được nguồn gốc, tiền phải test được mà không cần render UI, và
đổi câu chữ hay thêm ngôn ngữ không được phải sửa 13 màn hình.

---

## 3. Hai cây state

`contexts/AppContext.jsx` giữ hai thứ tách nhau:

**`db`** — dữ liệu nghiệp vụ của MỘT CLB, đồng bộ ngầm xuống Supabase (không còn persist
localStorage). Đúng những khoá `dbmap.toDb()` sinh ra:
`club, levels, seasons, courts, groups, members, guests, schedules, sessions, attendance, sessionGuests,`
`lineups, courtGroups, groupMode, courtMin, matches, roster, locked, adjustments, guestPrices,`
`dues, courtBills, manual, changes, users, joinRequests,`
`challenges, challengePredictions, playerRatings, matchEdits, clubCalibration, notifications,`
`playing`
cộng `clubId, today, month` do `load()` gắn và `currentUserId, myRole, viewAs, sessionId` do
`reload()` gắn.

- `club` có thêm `seasons` (cấu hình các mùa giải CLB, podium snapshot), `debtBanner` (kiểu banner nhắc nợ), `hasMemberExtraDiscount`, `memberExtraDiscount`.
- `members[i]` có thêm `fullName`, `email`, `note`, `linkedAt`, `pendingLevel`, `pendingLevelFrom`, `badges`, `badgeShelf` (tối đa 3 huy hiệu vinh danh), `signature` (châm ngôn cá nhân), `bankAccounts`, `avatarUrl`, `qrUrl`.
- `member_groups[i]` có thêm `sortOrder` (thứ tự hiển thị tùy biến), `hasCustomPricing` (biểu phí riêng của nhóm).
- `sessions[i]` có thêm `planner` (cấu hình & danh sách vòng đấu của bộ Lập dây trận), `rsvpInvitedAt` (mốc gửi lời mời điểm danh 1 chạm).
- `matches[i]` có thêm `videoUrl`, `videoProvider`, `videoThumbnailUrl`, `videoViewsCount`, `videoTimeline`, `bountyBroken`.
- `attendance[sessionId][memberId]` hỗ trợ 4 trạng thái: `true` (có mặt), `false` (vắng), `'extra'` (đi thêm), `'noshow'` (bùng kèo không đến).
- `challenges[i]` hỗ trợ `sessionId` liên kết buổi chơi, `acceptedPlayers`, `acceptedAt`, `acceptedBy`, `deployedAt`, `stakeText`, `predictionsEnabled`, `predictionsLocked`. Bỏ trạng thái `oncourt` (migration 0043) — "đang đánh" suy từ số hiệp đã ghi.
- `adjustments` thay cho `back_credits` (migration 0007); có thêm `settledSessions` thu/hoàn tiền và hoàn tác theo từng buổi lẻ (migration 0040).
- `dues[i]` có `paidAmount` (migration 0009).

Không có `clubStore` · `seq` · `backPaid` · `invites` — bốn khoá này đã bỏ: nhiều CLB trong bộ
nhớ (xem dưới), bộ đếm id thay bằng `crypto.randomUUID()`, `back_credits` thay bằng
`member_adjustments` (migration 0007), mời qua SĐT gỡ khỏi client (xem `TASKS.md` Đợt 1).

**`ui`** — trạng thái màn hình, **không** persist:
`tab, dialog, form, toast, picked, expanded, assignId, asnMode`
(route không nằm ở đây — React Router giữ, đọc bằng `useLocation()` + `keyOfPath()`)

Vì sao `lineups` / `playing` / `matches` nằm ở `db`: `matches` là bản ghi thật (số trận từng
người) và `lineups` cần sống qua F5 để hai người điều phối cùng thấy — handoff `05` nói rõ bản
thật nên lưu server và bật realtime theo `session_id`. Riêng `playing` (đồng hồ đang chạy)
**không** xuống DB: `toDb` luôn trả `playing: {}`, mất khi F5. Cần nhiều người cùng thấy thì
thêm `sessions.timer_started_at` — xem `DATABASE.md` §4.

Vì sao `today` **không** dùng bản đã lưu: `load()` luôn ghi đè `today` bằng đồng hồ thật, nếu
không thì "buổi sắp tới" và "buổi xếp được" sẽ đứng yên ở ngày cũ.

### Nhiều CLB

Mọi bảng nghiệp vụ thuộc về một CLB. Client giữ dữ liệu của **đúng một** CLB — CLB đang xem.
`activeClubId` nằm ở `AuthContext` (persist trong localStorage, chỉ đúng cái id đó). Đổi CLB →
`AppContext` đẩy nốt thay đổi đang chờ, quên ảnh chụp đồng bộ, rồi `load(clubId)` lại từ đầu.

Giữ nhiều CLB trong bộ nhớ chỉ để đổi nhanh không đáng đổi lấy nguy cơ ghi lẫn dữ liệu giữa
hai CLB — đó là lý do bỏ `clubStore`.

### Tầng C: Hệ thống Thi đấu, Kèo đấu & Bảng xếp hạng (Rating + Season Engine)

Bên cạnh **Sổ quỹ**, hệ thống có **Thi đấu & Đẳng cấp** hoàn toàn tách biệt:
- **Độc lập luồng tiền**: Toàn bộ dữ liệu `challenges`, `matches`, `player_ratings`, `match_edits` không bao giờ sinh dòng ở sổ quỹ và không làm thay đổi tiền sân hay thu khách của buổi (được kiểm chứng bởi test suite `src/__tests__/money/isolation.test.js`).
- **Elo Engine thuần túy (`src/lib/rating.js`)**:
  - Điểm khởi đầu mặc định: `0` cho toàn bộ thành viên.
  - Công thức tính xác suất thắng dự kiến: $P(A) = 1 / (1 + 10^{(R_B - R_A) / 400})$.
  - Hệ số biến thiên $K = 32$, bảo toàn tổng điểm (zero-sum $\Delta A + \Delta B = 0$), dynamic K theo R1-R5.
  - Margin of Victory: nhân hệ số cách biệt bàn thắng set (1.05 - 1.40).
  - Thưởng điểm khi lật kèo (Underdog upset win nhận thưởng điểm Elo cao hơn).
  - Thang độ tin cậy R1 -> R5: R1 (<5 trận), R2 (5-14 trận), R3 (15-29 trận), R4 (30-49 trận), R5 (50+ trận).
  - Hiệu chỉnh chéo giới (Gender Calibration): Học từ phân bố tỷ lệ thắng thực tế của CLB để cân bằng tương quan nam-nữ.
  - Cascade Replay: Khi sửa điểm trận đấu trong quá khứ, `replayRatingCascade` tự động phát lại chuỗi kết quả để cập nhật chính xác rating của toàn bộ thành viên.
  - `rankPairs`: Xếp hạng các cặp đôi/đối tác dựa trên synergy và lịch sử đấu cùng nhau.
- **Trục Thi đấu & Đua top Mùa giải (`src/lib/season.js`)**:
  - `calculateSeasonLeaderboard`: Cơ chế cày rank thi đấu theo mùa (Quý), kẹp sàn Floor = 0.
  - Thắng cộng, thua trừ theo 5 dải chênh lệch Team Elo: Cửa trên nặng (+10/-12), Cửa trên (+12/-10), Cân bằng (+14/-8), Cửa dưới (+17/-5), Cửa dưới sâu (+22/-3).
  - Thưởng chuỗi thắng Streak 3 (+5đ), Streak 5 (+10đ); Thưởng lật kèo Upset (+5đ khi thắng đội hơn $\ge 150$ Elo).
  - Tiêu chuẩn xếp hạng chính thức: Đủ tối thiểu 20 trận tính rating trong mùa (`minMatchesOfficial`).
  - Trạng thái Tạm nghỉ (Inactive): 21 ngày không tham gia trận đấu nào.
  - Vua Lì Đòn (`getSeasonBountyPlayer`): Treo thưởng VĐV có chuỗi thắng đang chạy dài nhất ($\ge 3$ trận).
  - Reset về 0 mỗi quý; trận giao lưu (`ratingEnabled: false`) không sinh điểm mùa và không cắt chuỗi thắng.
- **Trục Gắn bó & Cống hiến (`src/lib/xp.js` & `src/lib/badges.js`)**:
  - Hệ thống XP và Cấp bậc: XP chỉ tăng, không phụ thuộc thắng thua, đo mức độ tham gia (50 XP/buổi, 10 XP/trận, 20 XP/tháng thâm niên, 25 XP/khách rủ).
  - Cấp độ = $\lfloor \text{totalXP} / 600 \rfloor + 1$; Danh xưng 6 bậc: Tân thủ → Tập sự → Quen sân → Thực chiến → Hảo thủ → Cao thủ.
  - Kệ 3 huy hiệu danh dự (`badge_shelf`), châm ngôn (`signature`) cùng kho danh hiệu đa dạng đạt được qua các mốc thành tích thực chiến (`lib/badges.js`).
  - Vĩnh viễn theo thời gian, không reset theo mùa giải.

### Tầng D: Hệ thống Sòng Bạc & Dự Đoán Kèo (Match Predictions & Casino Hub)

- **Cược bằng Điểm Mùa (Season Points - SP)**: Thành viên dùng số dư Điểm Mùa khả dụng để cược cho đội A hoặc đội B trước khi trận đấu lên sân.
- **Cơ chế RPC-only**: Dữ liệu lưu ở `challenge_predictions`. CỐ Ý KHÔNG đưa vào mảng `TABLES` của `dbmap.js` để tránh lỗi quyền hạn Postgres `42501`. Mọi thao tác đặt cược (`place_challenge_prediction`), hủy cược (`cancel_challenge_prediction`) và quyết toán (`settle_challenge_predictions`) bắt buộc gọi qua RPC.
- **An toàn & Chống lạm dụng**: Đấu thủ trong trận tuyệt đối không được cược chính trận của mình; trần cược tối đa 50 SP ở giao diện client (1..100 SP ở database). Quyết toán tự động tính tỷ lệ trả thưởng khi ghi kết quả trận, hoàn trả điểm khi kèo bị hủy.
- **Giao kèo đời thật (`stake_text`)**: Ghi nhớ thỏa thuận vui ngoài sân (nước ngọt, bữa sáng), thuần trang trí, không ảnh hưởng số dư điểm.

### Tầng E: Hệ thống Quản Lý Mùa Giải CLB (Seasons Engine)

- **Đa mùa giải linh hoạt (`clubs.seasons jsonb`)**: Cho phép CLB tạo nhiều mùa giải nối tiếp nhau (hoặc các giải ngắn hạn), xác định mùa active, thời gian bắt đầu/kết thúc, số trận tiêu chuẩn.
- **Lưu trữ bục vinh quang (Podium Snapshot)**: Khi đóng mùa giải, hệ thống chụp lại Top 1, Top 2, Top 3 cùng bảng xếp hạng chung cuộc lưu vào `podiumSnapshot`.
- **Reset Điểm Mùa an toàn**: Chuyển mùa chỉ reset Điểm Mùa (Season Points) về điểm khởi tạo, hoàn toàn bảo toàn lịch sử trận đấu và điểm Elo Career.

### Tầng F: Phân Hệ Giải Đấu Toàn Diện (Tournament System — 16 bảng `tournament_*`)

- **Cách ly tuyệt đối với vận hành thường**:
  - Trận đấu giải lưu ở `tournament_matches`, **không** ghi vào `matches` thường, **không** tính Elo và **không** tính Điểm Mùa.
  - Phí tham gia và giải thưởng lưu ở `tournaments`, `tournament_prizes`, `tournament_budget_lines` chỉ mang tính chất dự trù hiển thị, không ghi sổ quỹ `transactions`.
- **Kiến trúc Nạp & Ghi riêng biệt (Isolated Loaders & Atomic RPCs)**:
  - 16 bảng giải đấu **không nạp vào state `db`** của `AppContext.jsx` và không đi qua `dbmap.diff()`.
  - Từng màn hình giải đấu tự nạp dữ liệu độc lập; các thao tác bốc thăm, sinh lịch, ghi điểm, hoàn tác, sửa điểm, mở nhánh đều thực thi qua RPC nguyên tử phía server (`tournamentActions.js` gọi `tournament_generate_stage`, `tournament_commit_match`, `tournament_undo_match`, `tournament_edit_match`, `tournament_close_stage`, `tournament_add_swiss_round`).
- **4 Thể thức thi đấu tiêu chuẩn**:
  1. *Loại trực tiếp (Knockout)*: Hỗ trợ vòng 32, 16, tứ kết, bán kết, chung kết, tranh hạng 3.
  2. *Vòng tròn (Round Robin)*: Chia bảng, thuật toán xoay vòng đối đầu Berger, tự động xếp hạng theo điểm, hiệu số set, hiệu số điểm và đối đầu trực tiếp.
  3. *Hệ Thụy Sĩ (Swiss System)*: Mọi đội chung 1 bảng, sinh vòng đấu dần theo thứ hạng hiện tại, né gặp lại đối thủ cũ, hỗ trợ điểm miễn đấu (bye).
  4. *Nhánh thắng / Nhánh thua (Double Elimination)*: Nhánh chính (Winners) + nhánh phụ (Losers), tự động kích hoạt trận Chung kết Tổng 2 (GF2) nếu đội nhánh thua thắng trận chung kết 1.
- **Sơ đồ đồ thị Canvas**: Trực quan hóa liên kết giữa các giai đoạn giải đấu (Stage Links), chuyển tiếp các đội từ vòng bảng sang các nhánh loại trực tiếp.

---

## 4. Actions (`contexts/appActions.js`)

`makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast, reload })` trả về một object phẳng các hành động.
Màn hình dùng: `const { a } = useApp(); a.setSessionStatus(id, 'closed')`.

Ba quy ước:

1. **Đọc state qua ref, ghi qua updater.** `dbRef.current` / `uiRef.current` để tính text toast
   và giá trị dẫn xuất; `setDb`/`setUi` để ghi. Không đọc state trong updater rồi gây side effect
   ở đó — React 19 StrictMode gọi updater hai lần.
2. **Mỗi hành động ghi dữ liệu bắn đúng một toast**, tiếng Việt, nói **đã làm gì và hệ quả**
   (`"Đã ghi 1 trận · 4 người · 22 phút"`). Chặn hành động cũng bằng toast, không disable im lặng.
3. **Không xoá cứng.** Dùng `status` / `active`. Ngoại lệ đã cân nhắc: bỏ khách khỏi buổi và bỏ
   trận vừa ghi — hai thứ này là sửa sai lúc nhập, không phải xoá lịch sử.

---

## 5. Route và quyền

**Route công khai / Ngoài CLB (`PUBLIC_PATHS`):**
- `/dang-nhap` (`Login`)
- `/dang-ky` (`Register`)
- `/clb` (`Clubs` — chọn CLB, tạo CLB, nhập mã tham gia)
- `/tai-khoan` (`Account` — quản lý hồ sơ tài khoản `profiles` dùng chung)

**Route trong CLB (18 màn hình trong `AppLayout`):**
Danh sách Route key và component render tương ứng (xem `src/routes/index.js` & `src/App.jsx`):
1. `home`: `/` (render `MyStats.jsx`) — Trang chủ cá nhân của hội viên (Hero rank tier, Elo hiện tại, phong độ 5 trận, buổi tới kèm RSVP tự điểm danh 1 chạm, cạ cứng, đối thủ bám đuổi, tóm tắt kèo đấu và bảng tin hoạt động CLB).
2. `overview`: `/tong-quan` (render `Home.jsx`) — Tổng quan vận hành CLB (Bàn cờ quản trị: 6 StatCard chỉ số quỹ & nợ, tiến độ thu quỹ tháng kèm chip từng người, mở điểm danh buổi tới, danh sách nợ, top đi nhiều, báo cáo chuyên cần).
3. `calendar`: `/lich-thang` — Lịch tháng các buổi tập.
4. `sessions`: `/buoi-tap` — Danh sách các buổi tập của CLB.
5. `session`: `/buoi-tap/:id` — Chi tiết buổi tập (Điểm danh, Chia sân & Kèo chờ, Trận đấu).
6. `matches`: `/tran-dau` — Sàn kèo thách đấu & Lịch sử trận đấu toàn CLB.
7. `leaderboard`: `/bang-xep-hang` — Đua top mùa giải (Season Race), Elo sự nghiệp (Career Elo), BXH Cặp đôi (Pairs), Đối đầu H2H và Ma trận kết quả.
8. `badges`: `/danh-hieu` — Kho danh hiệu, huy hiệu thành tích và tiêu chuẩn đạt được.
9. `members`: `/thanh-vien` — Danh bạ thành viên chính thức & khách vãng lai.
10. `debts`: `/cong-no` — Sổ công nợ, nhắc nợ, tự khai chuyển khoản và duyệt thanh toán.
11. `fund`: `/so-quy` — Sổ quỹ thu chi, quỹ tiền mặt và lịch sử giao dịch CLB.
12. `profile`: `/ca-nhan` — Hồ sơ thành viên trong CLB, kệ 3 huy hiệu danh dự (`badge_shelf`), châm ngôn (`signature`).
13. `settings`: `/cai-dat` — Cài đặt CLB, nhóm hội viên, mùa giải thi đấu, xuất/nhập CSV và backup/restore.
14. `schema`: `/so-do-du-lieu` — Sơ đồ trực quan hoá cấu trúc dữ liệu của hệ thống.
15. `tournaments`: `/giai-dau` — Danh sách các giải đấu của CLB.
16. `tournament`: `/giai-dau/:id` — Trung tâm điều hành giải đấu (TournamentHub).
17. `tournamentBracket`: `/giai-dau/:id/nhanh/:eventId` — Cây nhánh thi đấu của từng nội dung.
18. `tournamentFlow`: `/giai-dau/:id/so-do` — Sơ đồ luồng canvas chuyển tiếp giữa các giai đoạn (Stage Links).

**Ma trận phân quyền (`src/lib/roles.js` + `src/config/permissions.json`):**
- 3 vai trò chuẩn: `owner` (Chủ CLB), `treasurer` (Thủ quỹ), `member` (Thành viên).
- Cả 18 routes đều mở cho mọi vai trò vào xem (`routes: null`).
- Các quyền thao tác (action/edit) được kiểm tra qua các cờ (`flags`):
  - `owner`: `money`, `members`, `sessions`, `assign`, `settings`, `viewAll`
  - `treasurer`: `money`, `sessions`, `assign`, `viewAll`
  - `member`: `viewAll`
- **Quyền điều hành Giải đấu**: Toàn bộ màn hình giải đấu (`Tournaments.jsx`, `TournamentHub.jsx`, `TournamentBracket.jsx`, `TournamentFlow.jsx`) sử dụng cờ `sessions` (`can(role, 'sessions')`) để cấp quyền tạo giải, bốc thăm, sinh lịch, ghi/sửa điểm và đóng giai đoạn (Chủ CLB và Thủ quỹ có quyền; Thành viên thường chỉ xem read-only).
- **Thanh điều hướng chân trang mobile (`MobileFooterNav.jsx`)**:
  - Có cờ `money` (`owner`, `treasurer`): `home`, `matches`, `debts`, `leaderboard`, `more`.
  - Không có cờ `money` (`member`): `home`, `matches`, `leaderboard`, `profile`, `more`.

`db.myRole` là vai THẬT, lấy từ `club_members.role` qua RPC `my_clubs`. `db.viewAs` là công cụ xem-như, chỉ cho chọn vai của mình hoặc **yếu hơn** (`viewAsOptions` trong `lib/roles.js`) — cho tự nâng quyền thì UI mở ra nhưng RLS ở Supabase vẫn chặn. Ẩn UI luôn chỉ là lớp thứ hai; RLS là lớp bảo vệ thực sự.

---

## 6. Đồng bộ với Supabase

`src/contexts/storage.js` là **điểm chạm mạng duy nhất** cho việc tải và lưu dữ liệu nền của hệ thống. Hai hàm chính cho state `db`:

| Hàm | Việc |
| --- | --- |
| `load(clubId)` | ~20 query song song (dùng embed của PostgREST cho bảng con) → `dbmap.toDb()` → nạp vào state `db` |
| `save(db)` | hẹn giờ `sync.debounceMs` → `dbmap.toRows()` → `dbmap.diff()` so với ảnh chụp lần đồng bộ trước → ghi/xoá **đúng những dòng đã đổi** |

Vì sao đồng bộ ngầm theo dòng, không phải mỗi action tự `await` Supabase:
- Gần 80 action giữ nguyên hình đồng bộ, UI phản hồi tức thì, các màn hình không phải thêm trạng thái chờ/lỗi/rollback. Chỗ nào đúng sai chỉ nằm trong **một** file map `src/contexts/dbmap.js`.
- Đơn vị ghi là **từng dòng**, nên hai người sửa hai buổi khác nhau không đè nhau. Đổi lại: hai người sửa **cùng một dòng** thì người ghi sau thắng. Không có validate phía server ngoài RLS.

Ba chế độ ghi, khai báo ở `TABLES` trong `dbmap.js`:

| mode | Dùng cho | Cách ghi |
| --- | --- | --- |
| `id` | bảng mà client tự sinh `crypto.randomUUID()` cho từng dòng | thêm/sửa/xoá theo `id` |
| `key` | dòng con có khoá tự nhiên (`session_id` + `member_id`…) | `upsert onConflict`, dọn dòng thừa bằng `scope` + `child` |
| `scope` | dòng con không có khoá ổn định, tập nhỏ (`schedule_slots`, `match_players`…) | scope nào đổi thì xoá sạch scope đó rồi ghi lại |

Hai bất biến bắt buộc, có test khoá ở `src/__tests__/sync/dbmap.test.js`:
1. **`db` không đổi ⇒ `diff()` rỗng.** Sai chỗ này là mỗi lần bấm phím ghi lại cả CLB.
2. **Ảnh chụp dựng bằng chính `toRows()`**, không dựng từ dòng đọc về. Nhờ vậy `load` và `save` luôn cùng một hàm map; lệch nhau thì lộ ngay ở lần save đầu chứ không âm thầm xoá dòng.

**Các hành động đặc biệt ghi trực tiếp DB / gọi RPC rồi `reload()`:**
1. `approveJoin` và `rejectJoin`: gọi RPC `approve_join_request` / `reject_join_request` (migration 0001) vì người xin vào chưa phải thành viên, client không có quyền ghi thẳng.
2. `renameMe` (`a.renameMe`): thành viên tự đổi tên hiển thị / tên đầy đủ qua `.update()` trực tiếp với policy `cm_update_self_name` + trigger guard (migration 0010), do sync ngầm dùng upsert đòi quyền INSERT mà thành viên thường không có.
3. `claimPayments` (`a.claimPayments`): gọi RPC `claim_payments` (migration 0018) để thành viên tự khai đã chuyển khoản trả nợ.
4. `incrementMatchVideoViews` (`a.incrementMatchVideoViews`): gọi RPC `increment_match_video_views` (migration 0034) tăng lượt xem video trận đấu an toàn phía server.
5. `attachMatchVideo` (`a.attachMatchVideo`): gọi RPC `attach_match_video` (migration 0035) gắn link video, thumbnail, nhà cung cấp và timeline.
6. `memberSelfCheckin` (`a.memberSelfCheckin`): gọi RPC `member_self_checkin` (migration 0039) để thành viên tự điểm danh có mặt/báo vắng khi nhận thông báo mở buổi.
7. **Dự đoán kèo & Cược SP (RPC-only)**:
   - Các hàm `placePrediction`, `cancelPrediction`, `settlePredictions`, `unsettlePredictions` gọi trực tiếp RPC `place_challenge_prediction`, `cancel_challenge_prediction`, `settle_challenge_predictions`, `unsettle_challenge_predictions` (migrations 0041, 0042, 0044).
   - Bảng `challenge_predictions` **CỐ Ý KHÔNG ĐƯỢC ĐƯA VÀO `dbmap.TABLES`** để tránh lỗi quyền hạn Postgres `42501`.
8. **Web Push Notification**: Đăng ký và quản lý subscription qua bảng `push_subscriptions` (migration 0048); gửi thông báo đẩy qua Supabase Edge Function `push-send`.
9. **Phân hệ Giải đấu (16 bảng `tournament_*`)**:
   - Hoàn toàn tách biệt khỏi state `db` và không đi qua `dbmap.diff()`.
   - Nạp độc lập qua `loadTournament` / `loadTournamentMatches`.
   - Ghi dữ liệu trực tiếp từng dòng qua `tournamentWrite` và các RPC nguyên tử: `tournament_generate_stage`, `tournament_commit_match`, `tournament_undo_match`, `tournament_edit_match`, `tournament_close_stage`, `tournament_add_swiss_round` (migrations 0057..0063).

Điều cần giữ: **tiền lưu `bigint` VND, không lưu số đã làm tròn**; ngày buổi lưu `date`, tháng lưu `char(7)`.

---

## 7. Điều đã hoàn thành & việc tiếp theo

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Đăng ký / Supabase Auth | ✅ **Đã làm** | Đăng ký bằng email (auto-username) · đăng nhập email/username/SĐT · quản lý hồ sơ tại `/tai-khoan` |
| i18n & Config | ✅ **Đã làm** | `src/i18n/vi.json`, `src/config/*.json`, hỗ trợ đa ngôn ngữ không sửa UI |
| Tách 2 hồ sơ & Ghép chọn lọc | ✅ **Đã làm** | Hồ sơ tài khoản (`profiles`) vs Hồ sơ CLB (`club_members`), ghép 6 trường chọn lọc (0009/0010) |
| Thành viên tự đổi tên | ✅ **Đã làm** | Policy `cm_update_self_name` + trigger guard chỉ cho đổi `name` và `full_name` (0010) |
| CSV Import & JSON Settings | ✅ **Đã làm** | Nhập/xuất danh sách thành viên bằng CSV (`src/lib/csv.js`), backup/restore cài đặt CLB |
| Gỡ bỏ kho cầu & đơn giản hoá dòng tiền | ✅ **Đã làm** | Migration 0023: gỡ bỏ kho cầu và Tầng B giá thành buổi. Tiền mua cầu ghi trực tiếp ở Sổ quỹ |
| Hệ thống Kèo & Chia sân hợp nhất | ✅ **Đã làm** | Tab bar 3 tabs (`SessionDetail.jsx`): Điểm danh, Chia sân & Kèo chờ, Trận đấu. Ghi điểm và tạo kèo độc lập |
| Bảng xếp hạng Elo & Độ tin cậy | ✅ **Đã làm** | Màn `Leaderboard.jsx` (5 tabs): SeasonRace, CareerElo, Pairs, PairH2H, Search/Matrix |
| Rating Engine nâng cấp | ✅ **Đã làm** | Dynamic K-Factor (R1-R5), Margin of Victory, Elo Floor >= 0, 8 bậc Slang Rank Tiers, Inactivity Decay, Playstyle Badges, rankPairs |
| Cài đặt giảm trừ đi thêm & Nhãn số sân | ✅ **Đã làm** | Migration 0024 (`member_extra_discount`) và Migration 0025 (`court_label`) |
| Động cơ cày rank Mùa giải 3-tier | ✅ **Đã làm** | `src/lib/season.js`: 5 dải delta Elo, Floor 0, streak/upset bonus, qualified 20 trận, inactive 21 ngày, Bounty. UI: `SeasonRaceTab.jsx`, `SeasonSettingsModal.jsx`, `MemberSeasonLedgerModal.jsx` |
| Hệ thống XP & Trục Gắn bó | ✅ **Đã làm** | `src/lib/xp.js`: điểm tham gia, thâm niên, rủ khách, cấp bậc 1-25+ và 6 bậc danh xưng vĩnh viễn |
| Ghi điểm bằng giọng nói (Voice Match) | ✅ **Đã làm** | `VoiceMatchModal.jsx` + `src/utils/voiceMatchParser.js`: Formal Grammar 5 luật cứng, khử nhiễu tên người, kiểm tra luật điểm cầu lông |
| Hoàn thiện BXH Cặp đôi & Modal H2H | ✅ **Đã làm** | `PairsTab.jsx`, `PairDetailModal.jsx`, `PairH2HModal.jsx`, `RatingFormulaModal.jsx`: phân tích synergy, đối đầu và công thức Elo |
| Sửa RPC `club_pending_requests` để kèm avatar & bank info | ✅ **Đã làm** | Migration 0026: thêm `avatar_url`, `qr_url`, `bank_*` vào response trả về của RPC |
| Tự khai nợ & Duyệt chuyển khoản | ✅ **Đã làm** | Migration 0018: cột `claimed_at` cho `monthly_dues`, `member_adjustments`, `session_guests` + RPC `claim_payments` |
| Banner nhắc nợ Trang chủ | ✅ **Đã làm** | Migration 0019: cấu hình kiểu banner nhắc công nợ (`clubs.debt_banner`) |
| Giao diện Dark Mode & Responsive Mobile | ✅ **Đã làm** | `ThemeContext.jsx` (Dark/Light/System) + `MobileFooterNav.jsx` 5 slot + `MoreSheet.jsx` |
| Huy hiệu & Kệ huy hiệu (Badges & Shelf) | ✅ **Đã làm** | Migration 0027 (`badges`, `badge_shelf`) + `src/lib/badges.js` + Kệ 3 huy hiệu vinh danh trên `MemberProfileTab` + Kho danh hiệu (`/danh-hieu`) |
| Tiền thưởng Săn chuỗi thắng (Bounty Broken) | ✅ **Đã làm** | Migration 0028 (`bounty_broken`) ghi nhận phần thưởng khi lật đổ Vua Lì Đòn |
| Video Replay & Lượt xem trận đấu | ✅ **Đã làm** | Migrations 0029, 0030, 0034, 0035 (`video_*`) + `AttachVideoModal`, `MatchVideoPlayerModal`, `VideoTimelineEditor` |
| Điểm danh Bùng kèo (Attendance No-show) | ✅ **Đã làm** | Migrations 0031, 0032 (`noshow` enum state) + gác tự động trong Planner và chia sân |
| Phân hệ Lập Dây Trận (Session Match Planner) | ✅ **Đã làm** | Migration 0033 (`planner` JSONB) + `src/lib/planner.js`: chia vòng (rounds), ưu tiên kèo, xử lý nguyện vọng, luân chuyển công bằng |
| Sàn Kèo & Gán kèo tự do vào buổi chơi | ✅ **Đã làm** | Sàn Kèo (`Matches.jsx`), liên kết kèo tự do `linkChallengeToSession`, chống đè slot 1v1->2v2, gác hết hạn kèo |
| Framework Backtest & Baseline data | ✅ **Đã làm** | `src/__tests__/backtest/` runner kiểm thử công thức với lịch sử thật CLB, Rule §0 gác công thức Elo/Điểm mùa |
| Thông báo (Notification), Bảng tin Hoạt động & Điểm nhấn | ✅ **Đã làm** | Migration 0038 (`notifications`, `activity_events`) + `src/lib/activity.js` + Chuông/Drawer (`NotificationBell`, `NotificationPanel`) + Tab Hoạt động Trang chủ (`ActivityTab`) + 5 Điểm nhấn cá nhân hoá |
| Tự điểm danh 1 chạm & RSVP Mở buổi | ✅ **Đã làm** | Migration 0039 (`sessions.rsvp_invited_at` + RPC `member_self_checkin`) + `SelfAttendanceCard.jsx` |
| Hệ thống Dự đoán Kèo & Sòng bạc Điểm Mùa (Predictions Hub) | ✅ **Đã làm** | Migrations 0041, 0042, 0044 (`challenge_predictions` + RPC-only cược/hủy/quyết toán SP) + Kèo cược vui đời thật (`stake_text`) |
| Web Push Notifications (PWA Push) | ✅ **Đã làm** | Migration 0048 (`push_subscriptions`) + Service Worker + Supabase Edge Function `push-send` |
| Quản lý Đa Mùa Giải & Lưu trữ Bục Vinh Quang | ✅ **Đã làm** | Migrations 0049, 0053 (`clubs.seasons jsonb` + `podiumSnapshot`) |
| Trang Tổng quan phong độ cá nhân (MyStats) | ✅ **Đã làm** | Route `/tong-quan` (`MyStats.jsx`): Biểu đồ Radar kỹ năng, phân tích đối thủ/cạ cứng, lịch sử phong độ |
| Phân Hệ Giải Đấu Toàn Diện 16 Bảng | ✅ **Đã làm** | Migrations 0057..0063 (16 bảng `tournament_*` + 6 RPC nguyên tử) + 4 thể thức (Knockout, Round Robin, Swiss, Double Elimination) + Canvas Stage Links & Graph Flow |
| Mời vào CLB qua SĐT | **KHÔNG LÀM** (user chốt 2026-09-02) | Phần NHẬN phải gửi SMS thật — tốn tiền, không làm. Người mới vào bằng **mã CLB**. Bảng `club_invites` và cột `clubs.allow_invite` để nguyên dưới DB (xoá schema là việc riêng, phải xin phép), client không đọc |
| Realtime cho chia sân & giải đấu | Giai đoạn 2 | Realtime channel theo `session_id` cho `session_lineups` + `matches` (giải đấu hiện dùng useTourPoll tiết kiệm lượt gọi) |

---

## 8. Kiến trúc Hệ thống Thông báo (Notification) & Hoạt động CLB (Social Activity)

Hệ thống được thiết kế theo nguyên tắc tối ưu tài nguyên Supabase Free Tier, không gây phình to state đồng bộ (`db`), tuân thủ nghiêm ngặt **docs/RULES.md §3.3** và mang lại trải nghiệm tương tác trực quan:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 HÀNH ĐỘNG NGHIỆP VỤ                    │
                  │   (Lưu trận, Tạo/Nhận kèo, Duyệt/Từ chối nợ/hồ sơ...)   │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                   appActions: emitEvent()
                                              │
              ┌───────────────────────────────┴──────────────────────────────┐
              ▼                                                              ▼
 📣 Social Activity Timeline                                  🔔 Personal Notifications
    - Bảng: public.activity_events                               - Bảng: public.notifications
    - Lưu: sự kiện chung toàn CLB                                - Lưu: thông báo riêng tư từng người
    - State: 0 byte trong `db`                                   - State: nạp vào `db.notifications`
    - Tải: Lazy-load + phân trang                                - Hiển thị: Badge chuông tức thời
    - RLS: authenticated xem CLB mình                            - RLS: chỉ chính chủ đọc/ghi
    - Actor: tự động loại trừ nhận notif chính mình               - Click: tự động chuyển tới trang liên quan
              │                                                              │
              └───────────────────────────────┬──────────────────────────────┘
                                              ▼
                             🧠 Điểm nhấn (Personal Highlights)
                             - KHÔNG LƯU DB (0 byte bộ nhớ)
                             - Tính toán on-demand phía client (`getPersonalHighlights`)
                             - 5 mẫu điểm nhấn: Best Partner, Cạ cứng mới,
                               Kỳ phùng địch thủ, Phá dớp kỵ giơ, Chuỗi thắng đỉnh cao.
```

### 8.1 Phân tách 3 tầng dữ liệu rõ rệt
1. **🔔 Thông báo cá nhân (`notifications`)**:
   - Cần phản hồi tức thì về số lượng tin chưa đọc trên thanh AppHeader.
   - Được nạp trong `storage.load(clubId)` (giới hạn 100 tin gần nhất) và ánh xạ qua `dbmap.js` vào `db.notifications`.
   - RLS kiểm tra `member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())` nên mỗi thành viên chỉ tải về thông báo của chính mình, tuyệt đối không lộ thông báo người khác.
   - Khi thành viên tạo sự kiện gửi cho người khác (ví dụ A thách đấu B), `emitEvent` ghi thẳng danh sách thông báo của B lên bảng `notifications` của Supabase bằng `insert()`, không đưa vào state máy A để tránh ô nhiễm state.
2. **📣 Bảng tin hoạt động toàn CLB (`activity_events`)**:
   - Dòng thời gian các sự kiện đáng chú ý diễn ra trong CLB: kết quả trận kèm sắc thái, chuỗi thắng bị chặn, kèo đấu, mở/chốt buổi tập, hội viên mới gia nhập.
   - **Hoàn toàn DB-only**: không nằm trong `db` state của client, không tốn băng thông đồng bộ của `dbmap`.
   - Màn hình `ActivityTab.jsx` tải dữ liệu trực tiếp từ Supabase dạng lazy-load phân trang (20 mục/trang), kèm nút "Xem thêm".
   - RLS kiểm tra: chỉ thành viên CLB được đọc; khi ghi kiểm tra `actor_id IS NULL OR actor_id = auth_member_id()` để ngăn chặn giả mạo danh tính người tạo sự kiện.
3. **🧠 Điểm nhấn cá nhân hoá (`Personal Highlights`)**:
   - Nằm ở tab "Dành cho bạn" trong Drawer Thông báo.
   - **0 byte trong Database**: Suy ra hoàn toàn on-demand từ dữ liệu thi đấu (`db.matches`, `db.members`, `db.playerRatings`).
   - Tự động khử trùng lặp (ví dụ: đã là Best Partner thì không hiển thị lặp lại ở Cạ cứng mới; trận thắng đối thủ kỵ giơ phải nằm trong 5 trận gần nhất mới tính là phá dớp).

### 8.2 Nguyên tắc Độ thuần khiết của Payload (Rule §3.3)
Mọi payload lưu trong bảng `notifications` và `activity_events` **chỉ được phép lưu ID, mã hiệu hoặc số nguyên** (ví dụ: `matchId`, `matchCode`, `winnerTeam`, `breakerIds`, `victimIds`, `challengerIds`, `memberId`), **tuyệt đối không lưu chuỗi tên đã format hay text tiếng Việt**:
- **Giải mã động lúc render**: `resolveActivityPayload(item, db)` và `resolveNotificationPayload(item, db)` tra cứu tên thành viên/khách và tỷ số từ `db` tại thời điểm component vẽ lên màn hình.
- Nhờ vậy, nếu thành viên đổi tên hiển thị, hoặc hệ thống hỗ trợ đa ngôn ngữ sau này, toàn bộ lịch sử thông báo và bảng tin hoạt động vẫn tự động hiển thị chính xác mà không bị gãy hoặc giữ chuỗi chết cũ.

### 8.3 Sắc thái trận đấu (Match Narratives)
Hàm thuần `detectMatchNarrative(match)` phân loại trận đấu thành 4 sắc thái tự động dựa trên diễn biến set và điểm số:
- ⚡ **Clutch (Thắng nghẹt thở)**: Set quyết định chạm mốc $\ge 20$ và cách biệt $\le 2$ điểm (22-20, 29-30...).
- 🔥 **Blowout (Thắng áp đảo huỷ diệt)**: Cách biệt $\ge 10$ điểm hoặc đối thủ bị chặn dưới 12 điểm trong set 21 (21-8, 21-11...).
- 🔄 **Comeback (Lội ngược dòng)**: Thể thức bo3, để thua set 1 nhưng xuất sắc thắng liền 2 set sau.
- 🏸 **Normal (Tiêu chuẩn)**: Chiến thắng cách biệt vừa phải.

### 8.4 Cơ chế Tự điểm danh (Self-Checkin / RSVP) & Thông báo Ban quản lý
- **Thành viên tự báo trạng thái**: Cung cấp thẻ `SelfAttendanceCard` trong `SessionDetail.jsx` và nút bấm tương tác 1 chạm `[✅ Đi]` / `[❌ Báo vắng]` trên `NotificationItem.jsx` khi nhận thông báo mở buổi (`session_rsvp_invite`).
- **An toàn dữ liệu & RLS**: Migration 0039 nới RLS trên `attendances` cho chính chủ sửa dòng của mình khi buổi chưa chốt (`status != 'closed'`), đồng thời cung cấp RPC `member_self_checkin` với `SECURITY DEFINER` kiểm tra logic nghiêm ngặt.
- **Thông báo Chủ CLB & Thủ quỹ (`attendance_reported`)**: Khi thành viên tự điểm danh, hệ thống tự động phát thông báo riêng cho ban quản lý (`owner`, `treasurer`), nêu rõ ai đã báo có mặt, báo vắng hay đi thêm tại buổi tập nào.

