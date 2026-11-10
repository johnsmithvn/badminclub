import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Checkbox, Dialog, Input, Select, Skeleton, Switch } from '#ds'
import { Empty, TabBar } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { GameArt, HowTo } from '#components/games/GameInfo.jsx'
import GameBoard, { CoinBoard } from '#components/games/GameBoard.jsx'
import { myMember } from '#lib/money.js'
import { BOARD_POINTS, BOT_GAMES, BOT_PREFIX, COIN_START, GAMES, GAME_IDS, NO_STAKE, STAKES, boardOf, buyinsOf, gameOf, isStaleRoom, seatedOf, stakeOf, statsOf } from '#lib/games/registry.js'
import { DICTS as NOITU_DICTS, REPEATS as NOITU_REPEATS, TIMES as NOITU_TIMES } from '#lib/games/noitu.js'
import { SIZES as COVAY_SIZES } from '#lib/games/covay.js'
import { DAY_TIMES as MASOI_TIMES, REVEALS as MASOI_REVEALS, ROLE_IDS as MASOI_ROLE_IDS, SPECIALS as MASOI_SPECIALS, GUARD, SEER, WITCH, WOLF, isWolf, lineupOf, minPlayersOf } from '#lib/games/masoi.js'
import { TIMES as BAIBIP_TIMES } from '#lib/games/baibip.js'
import { LEADS as TIENLEN_LEADS, VARIANTS as TIENLEN_VARIANTS } from '#lib/games/tienlen.js'
import { LAPS as BAUCUA_LAPS, TIMES as BAUCUA_TIMES } from '#lib/games/baucua.js'
import { TIMES as LOTO_TIMES } from '#lib/games/loto.js'
import { LAPS as XIDACH_LAPS, TIMES as XIDACH_TIMES } from '#lib/games/xidach.js'

// Game có đồng hồ / số vòng chọn lúc tạo phòng: chữ ở games.<id>.time · timeOpt · timeNone (0 = tắt) · laps · lapsOpt.
const TIME_OPTS = { baucua: BAUCUA_TIMES, loto: LOTO_TIMES, xidach: XIDACH_TIMES }
const LAP_OPTS = { baucua: BAUCUA_LAPS, xidach: XIDACH_LAPS }
// Nhóm game cho hàng lọc ở sảnh — chỉ để vẽ, không ảnh hưởng luật.
const CAT = { caro: 'board', oanquan: 'board', coganh: 'board', colat: 'board', chamo: 'board', covua: 'board', cotuong: 'board',
  bantau: 'board', coup: 'board', covay: 'board', tienlen: 'card', domino: 'card', baibip: 'card', xidach: 'card', phom: 'card',
  bacay: 'card', cangua: 'party', masoi: 'party', baucua: 'party', loto: 'party', noitu: 'word' }
const catLabels = () => ({ all: t('games.cat.all'), board: t('games.cat.board'), card: t('games.cat.card'), party: t('games.cat.party'), word: t('games.cat.word') })
import { monthOf, todayISO } from '#utils/dates.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import cfg from '#config/app.js'

/** Sảnh mini-game: chọn game tạo phòng, vào bằng mã, danh sách phòng đang mở. Nạp riêng — xem gameActions.js. */
export default function Games() {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const me = myMember(db)?.id || null
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(null) // id game đang mở form tạo phòng
  const [howto, setHowto] = useState(null) // id game đang mở luật chơi
  const [tab, setTab] = useState('play') // play | board | coins
  const [wallets, setWallets] = useState(null) // ví xu cả CLB (0093) — nạp lúc mở sảnh và khi mở tab Ví xu
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [top, setTop] = useState(null) // top 5 tháng này ở cột phải; null = đang nạp

  // Thống kê thắng thua (tới statsLimit ván) chỉ nạp lúc mở sảnh; nhịp hỏi lại chỉ lấy danh sách phòng.
  const refresh = useCallback((withStats = false) => a.gameLobby(withStats)
    .then((r) => { setData((d) => ({ ...r, finished: r.finished ?? d?.finished ?? [], now: Date.now() })); setErr('') })
    .catch((e) => { setErr(gameErr(e)); setData((d) => d || { rooms: [], finished: [], now: Date.now() }) }), [a])
  const poll = useCallback(() => refresh(false), [refresh])

  // Ví của tôi qua game_my_wallet (0101): mở ví lần đầu + cứu trợ nếu đủ điều kiện — số trên viên ví luôn là số server dùng.
  const [mine, setMine] = useState(null)
  const loadWallets = useCallback(() => {
    a.gameMyWallet().then(setMine).catch(() => {})
    return a.gameWallets().then(setWallets).catch(() => setWallets((w) => w || []))
  }, [a])
  useEffect(() => { refresh(true); loadWallets() }, [refresh, loadWallets, db.clubId])
  useEffect(() => {
    let live = true
    a.gameBoard(monthOf(todayISO()))
      .then((rows) => { if (live) setTop(boardOf(rows).rows.slice(0, 5)) })
      .catch(() => { if (live) setTop([]) })
    return () => { live = false }
  }, [a, db.clubId])
  const coins = mine ?? wallets?.find((w) => w.memberId === me)?.balance ?? COIN_START
  // Đang xem BXH thì thôi hỏi lại danh sách phòng; quay lại tab Chơi thì hỏi ngay một lần.
  useTourPoll(tab === 'play', poll, cfg.games.lobbyPollMs)

  const open = (id) => navigate(pathOf('gameRoom', id))
  // Cờ tướng với máy cần trang tải mới (header cách ly cho engine — vercel.json), nên không chuyển trang kiểu SPA.
  const vsBot = (id) => (id === 'cotuong' ? window.location.assign(pathOf('gameRoom', BOT_PREFIX + id)) : open(BOT_PREFIX + id))
  const enter = async (room) => {
    const mine = seatedOf(room.players).some((p) => p.memberId === me)
    if (room.status === 'waiting' && !mine && me && (await a.gameJoin(room)) == null) return
    open(room.id)
  }
  const byCode = async () => {
    const id = await a.gameFind(code)
    if (id) open(id)
  }

  const stats = statsOf(data?.finished)
  const rooms = (data?.rooms || []).filter((r) => gameOf(r.game)
    && !isStaleRoom(r, data.now, cfg.games.staleHours)
    && (!r.private || seatedOf(r.players).some((p) => p.memberId === me)))
  // Ván của tôi (đang chơi trước, rồi đang chờ) nổi lên thẻ riêng; còn lại vào danh sách phòng.
  const isMine = (r) => seatedOf(r.players).some((p) => p.memberId === me)
  const current = rooms.find((r) => r.status === 'playing' && isMine(r)) || rooms.find((r) => r.status === 'waiting' && isMine(r)) || null
  const others = rooms.filter((r) => r !== current)
  const liveOf = rooms.reduce((o, r) => ({ ...o, [r.game]: (o[r.game] || 0) + 1 }), {})
  const needle = q.trim().toLowerCase()
  const shown = GAME_IDS.filter((id) => (cat === 'all' || CAT[id] === cat) && (!needle || t('games.' + id + '.name').toLowerCase().includes(needle)))

  return (
    <>
      <TabBar
        isMobile={isMobile}
        value={tab}
        onChange={(k) => { setTab(k); if (k === 'play') poll(); if (k === 'coins') loadWallets() }}
        items={[
          { key: 'play', label: t('games.board.tabPlay'), icon: 'gamepad-2', tone: 'accent' },
          { key: 'board', label: t('games.board.tabBoard'), icon: 'trophy', tone: 'accent' },
          { key: 'coins', label: t('games.coins.tab'), icon: 'wallet', tone: 'accent' },
        ]}
      />

      {tab === 'board' && <GameBoard me={me} isMobile={isMobile} />}
      {tab === 'coins' && <CoinBoard me={me} wallets={wallets} />}

      {tab === 'play' && (<>
        {err && <Alert tone="danger">{err}</Alert>}

        {/* Hàng đầu: ví + vào bằng mã. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {me
            ? (
              <span style={{ ...S.coin, color: coins < 0 ? 'var(--status-incident-fg)' : 'var(--status-delayed-fg)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--status-delayed-fg)' }} />
                {t('games.coins.mine', { n: coins.toLocaleString('vi-VN') })}
              </span>
            )
            : <span />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: isMobile ? '1 1 100%' : '0 1 auto' }}>
            <Input
              icon="hash"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) byCode() }}
              placeholder={t('games.codePh')}
              aria-label={t('games.codePh')}
              containerStyle={{ flex: isMobile ? '1 1 0' : '0 0 200px', minWidth: 0 }}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.12em' }}
            />
            <Button variant="secondary" disabled={code.trim().length < 6} onClick={byCode}>{t('games.joinByCode')}</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', alignItems: 'start' }}>
          <div style={S.col}>
            {/* Ván đang dở + phòng đang chờ */}
            <div style={{ ...S.grid, gridTemplateColumns: isMobile || !current ? 'minmax(0, 1fr)' : 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
              {current && <ResumeCard room={current} me={me} members={db.members} onEnter={() => enter(current)} />}
              <div style={{ ...S.box, padding: '14px 16px', display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span style={S.over}>{t('games.openRooms')}</span>
                {!data && <Skeleton height={80} />}
                {data && others.length === 0 && <Empty icon="gamepad-2" title={t('games.emptyTitle')} hint={t('games.emptyHint')} />}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', maxHeight: 260, overflowY: 'auto' }}>
                  {others.map((r) => <RoomRow key={r.id} room={r} me={me} members={db.members} onEnter={() => enter(r)} />)}
                </div>
              </div>
            </div>

            {/* Lọc nhóm + tìm */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                {Object.entries(catLabels()).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setCat(k)} style={chip(cat === k)}>
                    {label} <span style={{ font: '400 11px/1 var(--font-mono)', opacity: 0.6 }}>{k === 'all' ? GAME_IDS.length : GAME_IDS.filter((id) => CAT[id] === k).length}</span>
                  </button>
                ))}
              </div>
              <Input
                icon="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('games.lobby.search')}
                aria-label={t('games.lobby.search')}
                containerStyle={{ flex: isMobile ? '1 1 100%' : '0 0 220px', minWidth: 0 }}
              />
            </div>

            {shown.length === 0 && <span style={S.caption}>{t('games.lobby.noMatch')}</span>}
            <div style={{ ...S.grid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(210px, 1fr))' }}>
              {shown.map((id) => {
                const g = GAMES[id]
                const s = stats[id]
                const live = liveOf[id] || 0
                const desc = t('games.' + id + '.desc')
                return (
                  <div key={id} style={{ ...S.box, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative' }}>
                      <GameArt id={id} height={isMobile ? 84 : 110} />
                      {live > 0 && (
                        <span style={{ ...S.badge, left: 8, color: 'var(--status-transit-fg)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--status-transit-fg)' }} />
                          {t('games.lobby.live', { n: live })}
                        </span>
                      )}
                      <span style={{ ...S.badge, right: 8, font: '500 11px/1 var(--font-mono)' }}>{t('games.lobby.players', { min: g.minPlayers, max: g.maxPlayers })}</span>
                    </div>
                    <div style={{ padding: '10px 12px 12px', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)', flex: 1, alignContent: 'start' }}>
                      <div style={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                        <span style={S.title}>{t('games.' + id + '.name')}</span>
                        <span style={{ ...S.caption, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={desc}>{desc}</span>
                        {s && <span style={S.mono}>{t('games.record', s)}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', minWidth: 0 }}>
                        <Button size="sm" icon="plus" disabled={!me} onClick={() => setCreating(id)} style={{ flex: 1, minWidth: 0 }}>{t('games.create')}</Button>
                        {BOT_GAMES.includes(id) && <Button size="sm" variant="secondary" icon="bot" aria-label={t('games.bot.play')} title={t('games.bot.play')} onClick={() => vsBot(id)} />}
                        <Button size="sm" variant="ghost" icon="book-open" aria-label={t('games.howto')} title={t('games.howto')} onClick={() => setHowto(id)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cột phải: top tháng */}
          <div style={{ ...S.box, padding: '14px 16px', display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={S.over}>{t('games.lobby.topMonth')}</span>
              <button type="button" onClick={() => setTab('board')} style={S.link}>{t('games.lobby.seeBoard')}</button>
            </div>
            {!top && <Skeleton height={140} />}
            {top && top.length === 0 && <span style={S.caption}>{t('games.lobby.noTop')}</span>}
            {top?.map((r) => {
              const m = db.members.find((x) => x.id === r.memberId)
              const name = m?.name || t('games.unknownPlayer')
              const isMe = r.memberId === me
              return (
                <div key={r.memberId} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 9, minWidth: 0,
                  background: isMe ? 'var(--surface-accent-soft)' : 'transparent', border: '1px solid ' + (isMe ? 'var(--border-focus-color)' : 'transparent'),
                }}>
                  <span style={{ width: 24, flexShrink: 0, font: '600 12px/1 var(--font-mono)', color: r.rank <= 3 ? 'var(--status-delayed-fg)' : 'var(--text-muted)' }}>#{r.rank}</span>
                  <Avatar name={name} src={m?.avatarUrl} size={26} />
                  <span style={{ ...S.label, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{isMe ? t('games.board.you') : name}</span>
                  <span style={{ ...S.mono, flexShrink: 0, color: 'var(--text-secondary)' }}>{t('games.lobby.wins', { n: r.won })}</span>
                </div>
              )
            })}
          </div>
        </div>
      </>)}

      {creating && <CreateRoom gameId={creating} coins={coins} onClose={() => setCreating(null)} onDone={(id) => { setCreating(null); open(id) }} />}
      {howto && <HowTo gameId={howto} onClose={() => setHowto(null)} />}
    </>
  )
}

function RoomRow({ room, me, members, onEnter }) {
  const g = gameOf(room.game)
  const seated = seatedOf(room.players)
  const host = members.find((m) => m.id === room.hostId)
  const mine = seated.some((p) => p.memberId === me)
  const canJoin = room.status === 'waiting' && seated.length < g.maxPlayers
  const tone = room.status === 'waiting' ? 'scheduled' : 'transit'
  const stake = stakeOf(room.options)
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ width: 48, flexShrink: 0 }}><GameArt id={room.game} height={34} radius={6} /></div>
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...S.label, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={host?.name}>
            {t('games.' + room.game + '.name')} · {host?.name || t('games.host')}
          </span>
          <span style={{ ...S.pill, background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>{t('games.status.' + room.status)}</span>
          {stake > 0 && <span style={{ ...S.pill, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }}>{t('games.coins.stakePill', { n: stake })}</span>}
        </div>
        <span style={S.mono}>{room.code} · {t('games.seats', { n: seated.length, max: g.maxPlayers })}</span>
      </div>
      <Button size="sm" variant={canJoin || mine ? 'primary' : 'secondary'} onClick={onEnter}>
        {canJoin || mine ? t('games.enter') : t('games.watch')}
      </Button>
    </div>
  )
}

/** Thẻ "Ván đang dở": phòng của tôi đang chơi (hoặc đang chờ người) — một nút vào lại. */
function ResumeCard({ room, me, members, onEnter }) {
  const g = gameOf(room.game)
  const seated = seatedOf(room.players)
  const rivals = seated.filter((p) => p.memberId !== me).map((p) => members.find((m) => m.id === p.memberId)?.name || t('games.unknownPlayer'))
  const stake = stakeOf(room.options)
  const playing = room.status === 'playing'
  const title = t('games.' + room.game + '.name') + (rivals.length ? ' · ' + rivals.join(', ') : '')
  return (
    <div style={{ ...S.box, padding: '14px 16px', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', background: 'var(--surface-accent-soft)', borderColor: 'var(--border-focus-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ ...S.over, color: 'var(--status-transit-fg)' }}>{t('games.lobby.resume')}</span>
        <span style={{ ...S.caption, color: 'var(--status-transit-fg)', flexShrink: 0 }}>{t(playing ? 'games.status.playing' : 'games.lobby.waiting')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 56, flexShrink: 0 }}><GameArt id={room.game} height={56} radius={10} /></div>
        <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <span style={{ ...S.title, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>{title}</span>
          <span style={S.mono}>
            {room.code} · {t('games.seats', { n: seated.length, max: g.maxPlayers })}{stake > 0 ? ' · ' + t('games.coins.stakePill', { n: stake }) : ''}
          </span>
        </div>
        <Button onClick={onEnter}>{t('games.enter')}</Button>
      </div>
    </div>
  )
}

const chip = (on) => ({
  padding: '6px 12px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', font: '600 12.5px/1 var(--font-sans)',
  background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)', color: on ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
  border: '1px solid ' + (on ? 'var(--border-focus-color)' : 'var(--border-subtle)'),
})

/** Bộ vai mặc định khi chủ phòng bật Tự chọn Ma sói — chỉ là điểm xuất phát để sửa. */
const MASOI_CUSTOM = [WOLF, WOLF, SEER, GUARD, WITCH]

/**
 * Form tạo phòng. Tuỳ chọn riêng từng game nằm ở đây — Caro, Chấm ô (cỡ bàn), Nối từ (ngôn ngữ, giờ),
 * Ma sói (lộ vai, bộ vai Tự động / Tự chọn — `options.roles`, lib/games/masoi.js deckOf).
 */
function CreateRoom({ gameId, coins, onClose, onDone }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const g = gameOf(gameId)
  const [opts, setOpts] = useState(g.defaultOptions)
  const [priv, setPriv] = useState(false)
  const [busy, setBusy] = useState(false)

  // Ma sói tự chọn: số Sói thường + các vai đặc biệt đang bật. Không có Sói nào thì chưa cho tạo phòng.
  const roles = gameId === 'masoi' ? opts.roles || null : null
  const wolves = roles ? roles.filter((r) => r === WOLF).length : 0
  const specials = roles ? roles.filter((r) => r !== WOLF) : []
  const setRoles = (w, sp) => setOpts({ ...opts, roles: [...Array(w).fill(WOLF), ...sp].sort((x, y) => x - y) })
  const noWolf = !!roles && !roles.some(isWolf)
  // Xu ảo (0093 / 0101): game kết quả do máy khách báo thì không cược. Ví ít hơn mức mang vào bàn thấp nhất thì không
  // ngồi được — server cũng chặn. Game điểm: mức cược = giá 1 điểm.
  const stake = stakeOf(opts)
  const ins = buyinsOf(gameId, stake)
  const points = BOARD_POINTS.includes(gameId)
  const broke = ins.length > 0 && ins[0] > coins

  const submit = async () => {
    setBusy(true)
    const id = await a.gameCreate(gameId, opts, priv)
    setBusy(false)
    if (id) onDone(id)
  }

  return (
    <Dialog
      open
      sheet={isMobile}
      title={t('games.createTitle', { game: t('games.' + gameId + '.name') })}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={busy || noWolf || broke}>{t('games.create')}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {gameId === 'caro' && (
          <>
            <Select
              label={t('games.caro.size')}
              value={String(opts.size)}
              // Bàn 3 × 3 là X-O cổ điển: 3 quân thắng, không có luật chặn hai đầu. Bàn lớn: 5 quân.
              onChange={(e) => {
                const size = Number(e.target.value)
                setOpts({ ...opts, size, win: size === 3 ? 3 : 5, blockedEnds: size === 3 ? false : !!opts.blockedEnds })
              }}
              options={cfg.games.caroSizes.map((n) => ({
                value: String(n), label: t(n === 3 ? 'games.caro.sizeOptClassic' : 'games.caro.sizeOpt', { n }),
              }))}
            />
            {opts.size !== 3 && (
              <Switch
                label={t('games.caro.blockedEnds')}
                description={t('games.caro.blockedEndsHint')}
                checked={!!opts.blockedEnds}
                onChange={(e) => setOpts({ ...opts, blockedEnds: e.target.checked })}
              />
            )}
          </>
        )}
        {gameId === 'chamo' && (
          <Select
            label={t('games.chamo.size')}
            value={String(opts.size)}
            onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })}
            options={cfg.games.chamoSizes.map((n) => ({ value: String(n), label: t('games.chamo.sizeOpt', { n, lines: 2 * n * (n + 1) }) }))}
          />
        )}
        {gameId === 'covay' && (
          <Select
            label={t('games.covay.size')}
            value={String(opts.size)}
            onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })}
            options={COVAY_SIZES.map((n) => ({ value: String(n), label: t('games.covay.sizeOpt.' + n) }))}
          />
        )}
        {gameId === 'noitu' && (
          <>
            <Select
              label={t('games.noitu.lang')}
              value={opts.lang}
              onChange={(e) => setOpts({ ...opts, lang: e.target.value })}
              options={['vi', 'en'].map((v) => ({ value: v, label: t(v === 'vi' ? 'games.noitu.langVi' : 'games.noitu.langEn') }))}
            />
            {opts.lang === 'en' && (
              <Select
                label={t('games.noitu.link')}
                value={String(opts.link)}
                onChange={(e) => setOpts({ ...opts, link: Number(e.target.value) })}
                options={[1, 2].map((n) => ({ value: String(n), label: t('games.noitu.linkOpt', { n }) }))}
              />
            )}
            <Select
              label={t('games.noitu.time')}
              value={String(opts.time)}
              onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
              options={NOITU_TIMES.map((n) => ({ value: String(n), label: t('games.noitu.timeOpt', { n }) }))}
            />
            {opts.lang !== 'en' && (
              <>
                <Select
                  label={t('games.noitu.dict')}
                  value={opts.dict}
                  onChange={(e) => setOpts({ ...opts, dict: e.target.value })}
                  options={NOITU_DICTS.map((v) => ({ value: v, label: t('games.noitu.dictOpt.' + v) }))}
                />
                {opts.dict !== 'vote' && (
                  <Switch
                    label={t('games.noitu.cut')}
                    description={t('games.noitu.cutHint')}
                    checked={!!opts.cut}
                    onChange={(e) => setOpts({ ...opts, cut: e.target.checked })}
                  />
                )}
                <Switch
                  label={t('games.noitu.flip')}
                  description={t('games.noitu.flipHint')}
                  checked={opts.flip !== false}
                  onChange={(e) => setOpts({ ...opts, flip: e.target.checked })}
                />
              </>
            )}
            <Select
              label={t('games.noitu.repeat')}
              value={String(opts.repeat)}
              onChange={(e) => setOpts({ ...opts, repeat: Number(e.target.value) })}
              options={NOITU_REPEATS.map((n) => ({ value: String(n), label: t('games.noitu.repeatOpt.' + n) }))}
            />
          </>
        )}
        {gameId === 'masoi' && (
          <>
            <Select
              label={t('games.masoi.reveal')}
              value={opts.reveal}
              onChange={(e) => setOpts({ ...opts, reveal: e.target.value })}
              options={MASOI_REVEALS.map((v) => ({ value: v, label: t('games.masoi.revealOpt.' + v) }))}
            />
            <Select
              label={t('games.masoi.time')}
              value={String(opts.time)}
              onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
              options={MASOI_TIMES.map((n) => ({ value: String(n), label: n ? t('games.masoi.timeOpt', { n }) : t('games.masoi.timeNone') }))}
            />
            <Select
              label={t('games.masoi.deck')}
              value={roles ? 'custom' : 'auto'}
              onChange={(e) => {
                if (e.target.value === 'custom') setOpts({ ...opts, roles: MASOI_CUSTOM })
                else { const { roles: _drop, ...rest } = opts; setOpts(rest) }
              }}
              options={[{ value: 'auto', label: t('games.masoi.deckAuto') }, { value: 'custom', label: t('games.masoi.deckCustom') }]}
            />
            {roles && (
              <>
                <Select
                  label={t('games.masoi.wolfCount')}
                  value={String(wolves)}
                  onChange={(e) => setRoles(Number(e.target.value), specials)}
                  options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t('games.masoi.wolfCountOpt', { n }) }))}
                />
                <div style={S.col}>
                  <span style={S.label}>{t('games.masoi.specialsLabel')}</span>
                  {MASOI_SPECIALS.map((r) => (
                    <Checkbox
                      key={r}
                      label={t('games.masoi.role.' + MASOI_ROLE_IDS[r])}
                      description={t('games.masoi.roleDesc.' + MASOI_ROLE_IDS[r])}
                      checked={specials.includes(r)}
                      onChange={(e) => setRoles(wolves, e.target.checked ? [...specials, r] : specials.filter((x) => x !== r))}
                    />
                  ))}
                </div>
                {noWolf
                  ? <Alert tone="danger">{t('games.err.noWolf')}</Alert>
                  : (
                    <span style={S.caption}>
                      {t('games.masoi.customList', { list: lineupOf(roles) })} · {t('games.masoi.customHint', { n: minPlayersOf(roles) })}
                    </span>
                  )}
              </>
            )}
          </>
        )}
        {gameId === 'tienlen' && (
          <>
            <Select
              label={t('games.tienlen.variant')}
              value={opts.variant}
              onChange={(e) => setOpts({ ...opts, variant: e.target.value })}
              options={TIENLEN_VARIANTS.map((v) => ({ value: v, label: t('games.tienlen.variantOpt.' + v) }))}
            />
            <Select
              label={t('games.tienlen.lead')}
              value={opts.lead}
              onChange={(e) => setOpts({ ...opts, lead: e.target.value })}
              options={TIENLEN_LEADS.map((v) => ({ value: v, label: t('games.tienlen.leadOpt.' + v) }))}
            />
          </>
        )}
        {gameId === 'baibip' && (
          <Select
            label={t('games.baibip.time')}
            value={String(opts.time)}
            onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
            options={BAIBIP_TIMES.map((n) => ({ value: String(n), label: n ? t('games.baibip.timeOpt', { n }) : t('games.baibip.timeNone') }))}
          />
        )}
        {TIME_OPTS[gameId] && (
          <Select
            label={t('games.' + gameId + '.time')}
            value={String(opts.time)}
            onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
            options={TIME_OPTS[gameId].map((n) => ({ value: String(n), label: n ? t('games.' + gameId + '.timeOpt', { n }) : t('games.' + gameId + '.timeNone') }))}
          />
        )}
        {LAP_OPTS[gameId] && (
          <Select
            label={t('games.' + gameId + '.laps')}
            value={String(opts.laps)}
            onChange={(e) => setOpts({ ...opts, laps: Number(e.target.value) })}
            options={LAP_OPTS[gameId].map((n) => ({ value: String(n), label: t('games.' + gameId + '.lapsOpt', { n }) }))}
          />
        )}
        {!NO_STAKE.includes(gameId) && (
          <>
            <Select
              label={t(points ? 'games.coins.pointValue' : 'games.coins.stake')}
              value={String(stake)}
              onChange={(e) => setOpts({ ...opts, stake: Number(e.target.value) })}
              options={STAKES.map((n) => ({ value: String(n), label: n ? t('games.coins.stakeOpt', { n }) : t('games.coins.noStake') }))}
            />
            {stake > 0 && (
              <span style={{ ...S.caption, color: broke ? 'var(--status-incident-fg)' : undefined }}>
                {broke ? t('games.coins.broke', { n: coins.toLocaleString('vi-VN'), min: ins[0].toLocaleString('vi-VN') })
                  : points ? t('games.coins.hintPoints', { n: stake, min: ins[0].toLocaleString('vi-VN'), max: ins[ins.length - 1].toLocaleString('vi-VN') })
                    : t('games.coins.hintWin', { n: stake })}
              </span>
            )}
          </>
        )}
        <Switch
          label={t('games.private')}
          description={t('games.privateHint')}
          checked={priv}
          onChange={(e) => setPriv(e.target.checked)}
        />
      </div>
    </Dialog>
  )
}

const S = {
  col: { display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' },
  grid: { display: 'grid', gap: 12 },
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0 },
  h: { font: '600 16px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  title: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  pill: { flexShrink: 0, padding: '4px 8px', borderRadius: 99, font: '600 10.5px/1 var(--font-sans)' },
  over: { font: '600 11px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' },
  coin: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, font: '700 13px/1 var(--font-mono)',
    background: 'var(--status-delayed-bg)', border: '1px solid var(--status-delayed-fg)',
  },
  badge: {
    position: 'absolute', top: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99,
    background: 'var(--surface-card)', color: 'var(--text-secondary)', font: '600 11px/1 var(--font-sans)', boxShadow: 'var(--shadow-xs)',
  },
  link: { border: 0, background: 'none', padding: 0, cursor: 'pointer', font: '600 12px/1 var(--font-sans)', color: 'var(--text-accent)' },
}
