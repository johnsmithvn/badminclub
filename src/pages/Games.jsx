import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Checkbox, Dialog, Icon, Select, Skeleton, Switch } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { GameArt, HowTo } from '#components/games/GameInfo.jsx'
import RoomOptions from '#components/games/RoomOptions.jsx'
import { blockedOf } from '#components/games/roomFields.js'
import GameBoard, { CoinBoard } from '#components/games/GameBoard.jsx'
import { G, btn, card, chip, field, mono, over, rankColor, stage, tab as tabStyle } from '#components/games/stage.js'
import { myMember } from '#lib/money.js'
import { BOARD_POINTS, BOT_GAMES, BOT_PREFIX, COIN_START, GAMES, GAME_IDS, NO_STAKE, STAKES, boardOf, gameOf, isStaleRoom, seatRange, seatedOf, stakeOf, statsOf } from '#lib/games/registry.js'
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

  const tabs = [['play', t('games.board.tabPlay')], ['board', t('games.board.tabBoard')], ['coins', t('games.coins.tab')]]
  const goTab = (k) => { setTab(k); if (k === 'play') poll(); if (k === 'coins') loadWallets() }

  return (
    <div style={stage({ mobile: isMobile })}>
      {/* Đầu sảnh: tiêu đề + tab gạch chân | ví + vào bằng mã (header chung đã ẩn ở mục này). */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <div>
            <div style={{ font: `800 ${isMobile ? 22 : 26}px/1.15 var(--font-display)`, letterSpacing: '-.01em' }}>{t('nav.games')}</div>
            <div style={{ font: '400 13px/1.3 var(--font-sans)', color: G.muted, marginTop: 4 }}>{t('games.lobby.tagline')}</div>
          </div>
          <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid ' + G.line }}>
            {tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => goTab(k)} style={tabStyle(tab === k)}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, flex: isMobile ? '1 1 100%' : '0 1 auto' }}>
          {me && (
            <span style={S.coin}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: G.gold }} />
              <span style={{ color: coins < 0 ? G.red : G.goldHi }}>{t('games.coins.mine', { n: coins.toLocaleString('vi-VN') })}</span>
            </span>
          )}
          <input
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) byCode() }}
            placeholder={t('games.codePh')}
            aria-label={t('games.codePh')}
            style={{ ...field, flex: isMobile ? '1 1 0' : '0 0 170px', font: '600 13px/1.2 var(--font-mono)', letterSpacing: '.1em' }}
          />
          <button type="button" disabled={code.trim().length < 6} onClick={byCode} style={{ ...btn('primary'), opacity: code.trim().length < 6 ? 0.45 : 1 }}>{t('games.joinByCode')}</button>
        </div>
      </div>

      {tab === 'board' && <GameBoard me={me} isMobile={isMobile} />}
      {tab === 'coins' && <CoinBoard me={me} wallets={wallets} />}

      {tab === 'play' && (<>
        {err && <Alert tone="danger">{err}</Alert>}

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px', alignItems: 'start' }}>
          <div style={{ ...S.col, gap: isMobile ? 16 : 20 }}>
            {/* Ván đang dở + phòng đang chờ */}
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isMobile || !current ? 'minmax(0, 1fr)' : 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
              {current && <ResumeCard room={current} me={me} members={db.members} onEnter={() => enter(current)} />}
              <div style={{ ...card, padding: '16px 18px', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span style={over}>{t('games.openRooms')}</span>
                {!data && <Skeleton height={80} />}
                {data && others.length === 0 && <span style={{ ...S.caption, padding: '10px 0' }}>{t('games.emptyHint')}</span>}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', maxHeight: 240, overflowY: 'auto' }}>
                  {others.map((r) => <RoomRow key={r.id} room={r} me={me} members={db.members} onEnter={() => enter(r)} />)}
                </div>
              </div>
            </div>

            {/* Lọc nhóm + tìm */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, minWidth: 0, overflowX: 'auto', maxWidth: '100%' }}>
                {Object.entries(catLabels()).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} style={chip(cat === k)}>
                    {label} <span style={{ font: '400 12px/1 var(--font-mono)', opacity: 0.6, marginLeft: 4 }}>{k === 'all' ? GAME_IDS.length : GAME_IDS.filter((id) => CAT[id] === k).length}</span>
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('games.lobby.search')}
                aria-label={t('games.lobby.search')}
                style={{ ...field, flex: isMobile ? '1 1 100%' : '0 0 240px' }}
              />
            </div>

            {shown.length === 0 && <span style={S.caption}>{t('games.lobby.noMatch')}</span>}
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {shown.map((id) => {
                const g = GAMES[id]
                const s = stats[id]
                const live = liveOf[id] || 0
                const desc = t('games.' + id + '.desc')
                return (
                  <div key={id} className="game-card" style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative' }}>
                      <GameArt id={id} height={isMobile ? 90 : 118} />
                      {live > 0 && (
                        <span style={{ ...S.badge, left: 10, color: G.tealHi }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: G.teal }} />
                          {t('games.lobby.live', { n: live })}
                        </span>
                      )}
                      <span style={{ ...S.badge, right: 10, font: '500 11px/1 var(--font-mono)' }}>{t('games.lobby.players', { min: g.minPlayers, max: g.maxPlayers })}</span>
                    </div>
                    <div style={{ padding: isMobile ? '10px 10px 12px' : '12px 14px 14px', display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)', flex: 1, alignContent: 'start' }}>
                      <div style={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                        <span style={{ font: `700 ${isMobile ? 15 : 16}px/1.2 var(--font-display)`, color: G.text }}>{t('games.' + id + '.name')}</span>
                        <span style={{ ...S.caption, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={desc}>{desc}</span>
                        {s && <span style={{ ...mono, fontSize: 11 }}>{t('games.record', s)}</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', minWidth: 0 }}>
                        <button type="button" disabled={!me} onClick={() => setCreating(id)} style={{ ...btn('soft', { sm: true }), flex: isMobile ? '1 1 100%' : '1 0 auto', opacity: me ? 1 : 0.45 }}>{t('games.create')}</button>
                        {BOT_GAMES.includes(id) && (
                          <button type="button" title={t('games.bot.play')} aria-label={t('games.bot.play')} onClick={() => vsBot(id)} style={{ ...btn('ghost', { sm: true }), padding: '7px 9px', flex: isMobile ? 1 : 'none' }}>
                            <Icon name="bot" size={15} />
                          </button>
                        )}
                        <button type="button" title={t('games.howto')} aria-label={t('games.howto')} onClick={() => setHowto(id)} style={{ ...btn('ghost', { sm: true }), padding: '7px 9px', color: G.muted, flex: isMobile ? 1 : 'none' }}>
                          <Icon name="book-open" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cột phải: top tháng */}
          <div style={{ ...card, padding: '16px 18px', display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={over}>{t('games.lobby.topMonth')}</span>
              <button type="button" onClick={() => goTab('board')} style={S.link}>{t('games.lobby.seeBoard')}</button>
            </div>
            {!top && <Skeleton height={140} />}
            {top && top.length === 0 && <span style={S.caption}>{t('games.lobby.noTop')}</span>}
            {top?.map((r) => {
              const m = db.members.find((x) => x.id === r.memberId)
              const name = m?.name || t('games.unknownPlayer')
              const isMe = r.memberId === me
              return (
                <div key={r.memberId} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, minWidth: 0,
                  background: isMe ? G.tealA(0.1) : 'transparent', border: '1px solid ' + (isMe ? G.tealA(0.35) : 'transparent'),
                }}>
                  <span style={{ width: 26, flexShrink: 0, font: '600 12px/1 var(--font-mono)', color: rankColor(r.rank) }}>#{r.rank}</span>
                  <Avatar name={name} src={m?.avatarUrl} size={26} />
                  <span style={{ font: '600 14px/1.2 var(--font-sans)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{isMe ? t('games.board.you') : name}</span>
                  <span style={{ ...mono, flexShrink: 0, color: G.soft }}>{t('games.lobby.wins', { n: r.won })}</span>
                </div>
              )
            })}
          </div>
        </div>
      </>)}

      {creating && <CreateRoom gameId={creating} coins={coins} onClose={() => setCreating(null)} onDone={(id) => { setCreating(null); open(id) }} />}
      {howto && <HowTo gameId={howto} onClose={() => setHowto(null)} />}
    </div>
  )
}

function RoomRow({ room, me, members, onEnter }) {
  const g = gameOf(room.game)
  const seated = seatedOf(room.players)
  const host = members.find((m) => m.id === room.hostId)
  const mine = seated.some((p) => p.memberId === me)
  const maxP = seatRange(g, room.options)[1]
  const canJoin = room.status === 'waiting' && seated.length < maxP
  const stake = stakeOf(room.options)
  return (
    <div style={{ padding: '7px 0', borderTop: '1px solid ' + G.line, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ flex: 1, minWidth: 0, font: '400 14px/1.3 var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={host?.name}>
        <b style={{ fontWeight: 600 }}>{t('games.' + room.game + '.name')}</b>
        <span style={{ color: G.muted }}> · {host?.name || t('games.host')}</span>
      </span>
      {room.status === 'playing' && <span style={{ width: 7, height: 7, borderRadius: 99, background: G.teal, flexShrink: 0 }} title={t('games.status.playing')} />}
      <span style={{ ...mono, flexShrink: 0 }}>{seated.length}/{maxP}</span>
      {stake > 0 && <span style={{ ...mono, flexShrink: 0, color: G.goldHi }}>{stake}</span>}
      <button type="button" onClick={onEnter} style={{ ...btn(canJoin || mine ? 'soft' : 'ghost', { sm: true }), padding: '5px 10px', font: '600 12px/1 var(--font-sans)', flexShrink: 0 }}>
        {canJoin || mine ? t('games.enter') : t('games.watch')}
      </button>
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
    <div style={{
      padding: 18, borderRadius: 14, display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0,
      background: `linear-gradient(135deg, ${G.tealA(0.14)}, ${G.card} 60%)`, border: '1px solid ' + G.tealA(0.35),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ ...over, color: G.tealHi }}>{t('games.lobby.resume')}</span>
        <span style={{ font: '400 12px/1 var(--font-sans)', color: G.tealHi, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: G.teal }} />
          {t(playing ? 'games.status.playing' : 'games.lobby.waiting')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 64, flexShrink: 0 }}><GameArt id={room.game} height={64} radius={12} /></div>
        <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <span style={{ font: '700 18px/1.2 var(--font-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>{title}</span>
          <span style={{ ...mono, fontSize: 13 }}>
            {room.code} · {t('games.seats', { n: seated.length, max: seatRange(g, room.options)[1] })}{stake > 0 ? ' · ' + t('games.coins.stakePill', { n: stake }) : ''}
          </span>
        </div>
        <button type="button" onClick={onEnter} style={{ ...btn('primary'), padding: '10px 18px' }}>{t('games.enter')}</button>
      </div>
    </div>
  )
}

/** Bộ vai mặc định khi chủ phòng bật Tự chọn Ma sói — chỉ là điểm xuất phát để sửa. */
/** Tạo phòng: tuỳ chọn của game (RoomOptions — dùng chung với khung Sửa luật ở phòng chờ) + phòng riêng. */
function CreateRoom({ gameId, coins, onClose, onDone }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const g = gameOf(gameId)
  const [opts, setOpts] = useState(g.defaultOptions)
  const [priv, setPriv] = useState(false)
  const [busy, setBusy] = useState(false)
  // Ma sói tự chọn không có Sói / ví ít hơn mức mang vào bàn thấp nhất → chưa cho tạo (server cũng chặn).
  const blocked = blockedOf(gameId, opts, coins)

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
          <Button onClick={submit} disabled={busy || blocked}>{t('games.create')}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <RoomOptions gameId={gameId} opts={opts} setOpts={setOpts} coins={coins} />
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
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  coin: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, font: '700 14px/1 var(--font-mono)',
    background: G.goldA(0.1), border: '1px solid ' + G.goldA(0.3),
  },
  badge: {
    position: 'absolute', top: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99,
    background: G.card, color: G.soft, boxShadow: 'var(--shadow-xs)', font: '600 11px/1 var(--font-sans)',
  },
  link: { border: 0, background: 'none', padding: 0, cursor: 'pointer', font: '600 12px/1 var(--font-sans)', color: G.tealHi },
}
