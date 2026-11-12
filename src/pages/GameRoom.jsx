import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Avatar, Button, Dialog, Skeleton, Icon } from '#ds'
import { G, btn, card, seg } from '#components/games/stage.js'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { useGameRoom } from '#components/games/useGameRoom.js'
import { SCREENS } from '#components/games/screens.js'
import { GameArt, HowTo } from '#components/games/GameInfo.jsx'
import WaitingRoom from '#components/games/WaitingRoom.jsx'
import RoomChat from '#components/games/RoomChat.jsx'
import MoveList from '#components/games/MoveList.jsx'
import { SkinPicker } from '#components/games/ChessStage.jsx'
import { BOARD_POINTS, BOT_PREFIX, chipsOf, notesOf, seatRange, stakeOf } from '#lib/games/registry.js'
import { clockMins, INC_SEC } from '#lib/games/chessClock.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Chơi với máy (/tro-choi/may-<game>) dùng chung route với phòng thật, tải lười riêng.
const BotRoom = lazy(() => import('#components/games/BotRoom.jsx'))
// Màn chơi riêng không qua BotRoom: Nối từ đấu máy (cách chơi khác phòng thật) và game chỉ chơi một mình (SOLO_GAMES).
const SOLO_SCREENS = {
  noitu: lazy(() => import('#components/games/NoiTuSolo.jsx')),
  timso: lazy(() => import('#components/games/TimSoGame.jsx')),
  keobuabao: lazy(() => import('#components/games/KeoBuaBaoGame.jsx')),
}

// Game có "sân khấu" riêng (ChessStage): bàn tự vẽ thanh người chơi, trạng thái, nút Xin hoà / Xin thua, màn kết
// thúc — khung phòng không lặp lại dải trạng thái và nút Đầu hàng. SKIN = game chọn được skin bàn (thanh người chơi
// đã nằm trên bàn nên bỏ tab Người chơi; Tiến lên, Bầu cua giữ tab đó để xem xu từng người).
const STAGED = ['covua', 'cotuong', 'coup', 'tienlen', 'baucua']
const SKIN = { covua: 'covua', cotuong: 'cotuong', coup: 'cotuong' }

export default function GameRoom() {
  const { id } = useParams()
  const Solo = id?.startsWith(BOT_PREFIX) ? SOLO_SCREENS[id.slice(BOT_PREFIX.length)] : null
  if (Solo) return <Suspense fallback={<Skeleton height={320} />}><Solo /></Suspense>
  if (id?.startsWith(BOT_PREFIX)) {
    return <Suspense fallback={<Skeleton height={320} />}><BotRoom key={id} gameId={id.slice(BOT_PREFIX.length)} /></Suspense>
  }
  return <RoomPage id={id} />
}

/**
 * Khung phòng chơi — dùng chung cho mọi game: phòng chờ (WaitingRoom), lượt, kết quả, chơi lại.
 * Màn chơi của từng game tải lười qua `SCREENS`. Đồng bộ: components/games/useGameRoom.js.
 */
function RoomPage({ id }) {
  const { db, a, toast } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const g = useGameRoom(id)
  const [resigning, setResigning] = useState(false)
  const [howto, setHowto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ptab, setPtab] = useState(null) // cột phải: players | moves | chat | watch (null = tab đầu)
  const { room, game, state, result, seated, inGame, mySeat, canMove } = g
  // Xu ăn thua (0093): server trả lúc phòng chuyển sang 'finished' — nạp một lần khi thấy phòng xong.
  const [coins, setCoins] = useState(null) // { roomId, map: { [memberId]: delta } }
  const stake = stakeOf(room?.options)
  const done = room?.status === 'finished'
  useEffect(() => {
    if (!done || !stake || !room?.id) return undefined
    let live = true
    a.gameRoomCoins(room.id).then((map) => { if (live) setCoins({ roomId: room.id, map }) }).catch(() => {})
    return () => { live = false }
  }, [a, done, stake, room?.id])
  const coinOf = (memberId) => (coins?.roomId === room?.id ? coins.map[memberId] : undefined)
  // Đang chơi game điểm có bảng điểm theo ván (Bầu cua, Xì dách) thì hiện xu còn trên bàn = mang vào + điểm × giá điểm.
  const points = BOARD_POINTS.includes(room?.game)
  const liveScores = points && room?.status === 'playing' && Array.isArray(state?.scores) ? state.scores : null
  // Ký hiệu nước đi (Cờ vua / Cờ tướng) cho tab Nước đi.
  const moves = g.moves
  const notes = useMemo(() => (game?.notate && room && room.status !== 'waiting'
    ? notesOf(game, { options: room.options, seed: room.seed, seats: inGame.map((p) => p.seat) }, moves).map((x) => x.text)
    : null), [game, room, inGame, moves])
  // Nước game giấu khỏi tab Nước đi và bộ đếm (Ma sói: nước đêm — thứ tự ai bấm xong lộ ai có vai).
  const listed = useMemo(() => (game?.moveShown ? moves.filter((m) => game.moveShown(m.move)) : moves), [game, moves])

  const nameOf = (memberId) => db.members.find((m) => m.id === memberId)?.name || t('games.unknownPlayer')
  const memberOf = (memberId) => db.members.find((m) => m.id === memberId)
  const back = () => navigate(pathOf('games'))
  const go = (roomId) => navigate(pathOf('gameRoom', roomId))
  const act = async (fn) => { setBusy(true); const r = await fn(); setBusy(false); if (r != null) g.reload(); return r }

  if (g.loading) return <Skeleton height={320} />
  if (!room || !game) {
    return (
      <div style={S.box}>
        <Empty icon="gamepad-2" title={t('games.notFoundTitle')} hint={g.err || t('games.notFoundHint')} />
        <div style={{ display: 'grid', justifyItems: 'center', paddingBottom: 18 }}>
          <Button variant="secondary" icon="arrow-left" onClick={back}>{t('games.back')}</Button>
        </div>
      </div>
    )
  }

  const Screen = SCREENS[room.game]
  const waiting = room.status === 'waiting'
  const staged = STAGED.includes(room.game)
  const [minP, maxP] = seatRange(game, room.options)
  const copy = async (text, ok, fail) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(ok)
    } catch {
      toast(fail)
    }
  }
  const copyLink = () => copy(window.location.origin + pathOf('gameRoom', room.id) + '?club=' + room.clubId,
    t('games.toast.linkCopied', { code: room.code }), t('games.toast.linkCopyFailed', { code: room.code }))
  const copyCode = () => copy(room.code, t('games.wait.codeCopied', { code: room.code }), t('games.toast.linkCopyFailed', { code: room.code }))
  const leave = async () => {
    setResigning(false)
    if (await act(() => a.gameLeave(room.id)) != null && waiting) back()
  }
  const rematch = async () => {
    const next = await act(() => a.gameCreate(room.game, room.options, room.private, room.id))
    if (next && next !== true) go(next)
  }
  const joinNext = async () => {
    const r = await a.gameJoin({ id: room.nextRoom, game: room.game })
    if (r != null) go(room.nextRoom)
  }
  const wasPlayer = mySeat != null || room.players.some((p) => p.memberId === g.me)
  const ended = room.status === 'finished' || room.status === 'abandoned'

  const turnName = state && state.turn != null && !result ? seated.find((p) => p.seat === state.turn)?.memberId : null
  // Game tự nói trạng thái khi cả bàn cùng đi (đêm Ma sói, duyệt từ Nối từ…) — `status(state, mySeat)` → { key, params }.
  const custom = state && !result ? game.status?.(state, mySeat) : null
  const mins = clockMins(room.options)
  const watchers = g.here.filter((mid) => !seated.some((p) => p.memberId === mid))
  /** "1:05" — giây còn lại trước khi đối thủ được xử thắng. Âm thì hiện 0:00 (đang chờ server chốt). */
  const offlineText = (p) => {
    const idle = g.idle[p.memberId]
    if (!idle?.offline || p.memberId === g.me || result) return null
    // Đếm ngược chỉ khi ván đang chờ người này — người khác khoá máy lúc chờ thì không bị xử.
    return room.status === 'playing' && idle.leftSec != null ? t('games.offlineLeft', { time: clock(idle.leftSec) }) : t('games.offline')
  }

  // Bàn có sân khấu riêng: nút nằm dưới bàn, màn kết thúc có nút chơi lại, đối thủ mất kết nối báo ngay trên thanh của họ.
  const playing = room.status === 'playing' && mySeat != null && !result
  const stageProps = staged ? {
    actions: playing ? [
      ...(game.notate ? [{ key: 'draw', icon: 'handshake', label: t('games.bot.drawOffer'), on: () => g.play({ draw: 'offer' }), off: busy || state?.offer != null || !(state?.ply > 0) }] : []),
      { key: 'resign', icon: 'flag', label: t('games.bot.resign'), on: () => setResigning(true), off: busy, danger: true },
    ] : null,
    overActions: ended && (room.nextRoom || wasPlayer) ? [{ key: 'again', label: t(room.nextRoom ? 'games.nextRoom' : 'games.rematch'), on: room.nextRoom ? joinNext : rematch }] : null,
    note: Object.fromEntries(inGame.map((p) => [p.seat, offlineText(p)]).filter(([, v]) => v)),
  } : null

  const tabs = waiting ? [] : [
    ...(SKIN[room.game] ? [] : [['players', t('games.room.players') + ' · ' + seated.length + '/' + maxP]]),
    ['moves', t('games.room.moves') + (notes ? ' · ' + notes.length : '')],
    ['chat', t('games.room.chat') + (g.chat.length ? ' · ' + g.chat.length : '')],
    ['watch', t('games.room.watch') + (watchers.length ? ' · ' + watchers.length : '')],
  ]
  const tab = tabs.some(([k]) => k === ptab) ? ptab : tabs[0]?.[0]

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Đầu trang (bản Phòng chờ v2): ← Sảnh · ô game · tên + chủ phòng · cược · mã + Chép · skin · Cách chơi · Mời bạn. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        <button type="button" onClick={back} style={btn('ghost', { sm: true })}><Icon name="arrow-left" size={15} />{!isMobile && t('games.lobbyShort')}</button>
        {!isMobile && <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid ' + G.line }}><GameArt id={room.game} height={46} /></div>}
        <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ font: `800 ${isMobile ? 17 : 21}px/1.2 var(--font-display)`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('games.' + room.game + '.name')}</span>
          <span style={{ font: '400 12px/1.3 var(--font-sans)', color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('games.wait.roomOf', { name: nameOf(room.hostId) })} · {t('games.wait.range', { range: minP === maxP ? String(minP) : minP + '–' + maxP })}
          </span>
        </div>
        {stake > 0 && <span style={S.badge}>{t('games.coins.stakePill', { n: stake })}</span>}
        {mins > 0 && <span style={S.badge}>{t('games.clockPill', { n: mins, inc: INC_SEC })}</span>}
        <button type="button" onClick={copyCode} title={t('games.wait.copyCode')} style={S.code}>
          <span style={{ font: '700 14px/1 var(--font-mono)', letterSpacing: '.12em', color: G.text }}>{room.code}</span>
          <span style={{ font: '400 12px/1 var(--font-sans)', color: G.muted }}>{t('games.wait.copy')}</span>
        </button>
        {SKIN[room.game] && !waiting && <SkinPicker kind={SKIN[room.game]} />}
        <button type="button" aria-label={t('games.howto')} title={t('games.howto')} onClick={() => setHowto(true)} style={S.sq}><Icon name="book-open" size={17} /></button>
        <button type="button" onClick={copyLink} title={t('games.copyLink')} style={btn('soft', { sm: true })}><Icon name="plus" size={14} />{t('games.wait.invite')}</button>
      </div>

      {g.err && <Alert tone="danger">{g.err}</Alert>}

      {waiting && <WaitingRoom g={g} act={act} busy={busy} nameOf={nameOf} memberOf={memberOf} onInvite={copyLink} onLeave={leave} />}

      {/* Máy tính: bàn bên trái, cột phải là tab Người chơi / Nước đi / Chat / Người xem. Điện thoại: cột đó xuống dưới bàn. */}
      {!waiting && (
      <div style={{ display: 'grid', gap: 16, alignItems: 'start', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : staged ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr) 300px' }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
      {state && Screen && (
        <>
          {!staged && (
            <div style={{ ...S.status, ...(result ? S.statusDone : null) }} aria-live="polite">
              {result
                ? resultText(result, room.players, mySeat, nameOf)
                : custom ? t(custom.key, custom.params)
                  : mySeat == null ? t('games.spectating')
                    : canMove ? t('games.yourTurn') : t('games.theirTurn', { name: turnName ? nameOf(turnName) : '' })}
              <span style={S.mono}>{t('games.moves', { n: listed.length })}</span>
            </div>
          )}
          <Suspense fallback={<Skeleton height={320} />}>
            <Screen state={game.view(state, mySeat)} mySeat={mySeat} canMove={canMove} onMove={g.play} roomId={room.id} result={room.result} players={inGame} stake={stake}
              names={Object.fromEntries(inGame.map((p) => [p.seat, nameOf(p.memberId)]))} {...stageProps} />
          </Suspense>
          {staged && mySeat == null && !result && <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.spectating')}</span>}
        </>
      )}

      {!staged && playing && (
        <div><Button variant="secondary" icon="flag" disabled={busy} onClick={() => setResigning(true)}>{t('games.resign')}</Button></div>
      )}

      {ended && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: staged ? 'center' : undefined }}>
          {room.status === 'abandoned' && <span style={S.caption}>{t('games.abandoned')}</span>}
          {room.nextRoom
            ? <Button icon="play" onClick={joinNext}>{t('games.nextRoom')}</Button>
            : wasPlayer ? <Button icon="repeat" disabled={busy} onClick={rematch}>{t('games.rematch')}</Button> : null}
          <Button variant="secondary" onClick={back}>{t('games.back')}</Button>
        </div>
      )}
      </div>

      <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...(isMobile ? null : { maxHeight: staged ? 760 : undefined }) }}>
        <div role="tablist" style={{ display: 'flex', gap: 4, paddingBottom: 10, borderBottom: '1px solid ' + G.line, flexWrap: 'wrap', flexShrink: 0 }}>
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setPtab(k)} style={{ ...seg(tab === k), font: '700 13px/1 var(--font-sans)', padding: '7px 12px' }}>{label}</button>
          ))}
        </div>
        {tab === 'chat' && <RoomChat g={g} nameOf={nameOf} />}
        {tab === 'moves' && (notes ? <MoveList list={notes} /> : <Moves game={game} moves={listed}seated={room.players} nameOf={nameOf} />)}
        {tab === 'watch' && (
          <div style={{ display: 'grid', gap: 4 }}>
            {watchers.length === 0 && <span style={{ ...S.caption, padding: '6px 0' }}>{t('games.room.noWatch')}</span>}
            {watchers.map((mid) => (
              <div key={mid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px' }}>
                <Avatar name={nameOf(mid)} src={memberOf(mid)?.avatarUrl} size={28} />
                <span style={{ ...S.name, flex: 1 }}>{nameOf(mid)}</span>
                <span style={S.caption}>{t('games.room.watching')}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'players' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isMobile ? 'row' : 'column' }}>
        {/* Theo số ghế của người còn ngồi — ván 3–4 người có người rời thì số ghế không còn liền 0..n-1. */}
        {seated.map((p) => {
          const on = state && !result && state.turn === p.seat
          const m = memberOf(p.memberId)
          const off = offlineText(p)
          return (
            <div key={p.seat} style={{ ...S.seat, ...(isMobile ? null : { flex: 'none', maxWidth: 'none' }), borderColor: on ? G.tealA(0.45) : G.line, background: on ? G.tealA(0.08) : G.card }}>
              <Avatar name={m?.name || ''} src={m?.avatarUrl} size={28} />
              <div style={{ display: 'grid', gap: 2, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span style={S.name} title={nameOf(p.memberId)}>{nameOf(p.memberId)}</span>
                <span style={S.mono}>
                  {t('games.' + room.game + '.mark' + p.seat)}
                  {p.memberId === room.hostId ? ' · ' + t('games.host') : ''}
                </span>
                {stake > 0 && p.buyin != null && coinOf(p.memberId) == null && (
                  <span style={S.mono}>
                    {liveScores
                      ? t('games.coins.onTable', { n: chipsOf(p.buyin, liveScores[p.seat], stake).toLocaleString('vi-VN') })
                      : t('games.coins.buyinPill', { n: p.buyin.toLocaleString('vi-VN') })}
                  </span>
                )}
                {coinOf(p.memberId) != null && (
                  <span style={{ ...S.mono, fontWeight: 600, color: coinOf(p.memberId) > 0 ? 'var(--status-delivered-fg)' : coinOf(p.memberId) < 0 ? 'var(--status-incident-fg)' : undefined }}>
                    {t('games.coins.delta', { n: (coinOf(p.memberId) > 0 ? '+' : '') + coinOf(p.memberId) })}
                  </span>
                )}
                {off && <span style={{ ...S.mono, color: 'var(--status-delayed-fg)' }}>{off}</span>}
              </div>
            </div>
          )
        })}
        </div>
        )}
      </div>
      </div>
      )}

      {resigning && (
        <Dialog
          open
          sheet={isMobile}
          title={t('games.resignTitle')}
          onClose={() => setResigning(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setResigning(false)}>{t('games.stay')}</Button>
              <Button icon="flag" onClick={leave}>{t('games.resign')}</Button>
            </>
          )}
        >
          <span style={S.caption}>{t(seated.length > 2 ? 'games.resignDescMany' : 'games.resignDesc')}</span>
        </Dialog>
      )}
      {howto && <HowTo gameId={room.game} onClose={() => setHowto(false)} />}
    </div>
  )
}

const clock = (sec) => {
  const s = Math.max(0, sec)
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/** Một nước gọn: các trường của move (bỏ cờ true/false), mảng nối bằng dấu phẩy. Nước hết giờ ghi rõ. */
const moveText = (m) => (m?.timeout ? t('games.room.timeoutMove')
  : Object.entries(m || {}).filter(([, v]) => v != null && typeof v !== 'boolean')
    .map(([k, v]) => k + ' ' + (Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : v)).join(' · ').slice(0, 48))

/** Tab Nước đi (game chưa có ký hiệu riêng): log ván theo thứ tự, mới nhất ở dưới. */
function Moves({ game, moves, seated, nameOf }) {
  // Game tự đọc nước của mình (`moveNote` → { key, params }) thì dùng, không thì in thô các trường.
  const textOf = (move) => {
    const n = game.moveNote?.(move)
    return n ? t(n.key, n.params) : moveText(move)
  }
  const who = (seat) => {
    const p = seated.find((x) => x.seat === seat && !x.leftAt) || seated.find((x) => x.seat === seat)
    return p ? nameOf(p.memberId) : '#' + seat
  }
  if (!moves.length) return <span style={{ ...S.caption, padding: '6px 0' }}>{t('games.room.noMoves')}</span>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', maxHeight: 420, overflowY: 'auto', font: '400 12.5px/1.3 var(--font-mono)' }}>
      {moves.map((m) => (
        <div key={m.seq} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + G.line, minWidth: 0 }}>
          <span style={{ width: 28, flexShrink: 0, color: G.muted }}>{m.seq}</span>
          <span style={{ width: 80, flexShrink: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G.tealHi }}>{who(m.seat)}</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G.soft }} title={JSON.stringify(m.move)}>{textOf(m.move)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Câu kết quả. `forfeit` = server xử thắng vì đối thủ rời ván (game_leave) hoặc mất kết nối quá
 * lâu (`idle`, game_claim). Tên người thắng tra theo ghế lúc ván kết thúc — người đã rời vẫn còn dòng ghế.
 */
function resultText(result, players, mySeat, nameOf) {
  // Máy khách chưa biết ai thắng (Domino tắc — cần quân còn lại): chờ server chấm (room.result thay vào).
  if (result.pending) return t('games.scoring')
  if (result.draw) return t('games.draw')
  const w = result.winners || []
  if (mySeat != null) {
    const won = w.includes(mySeat)
    if (!won) return t('games.youLose')
    if (result.idle) return t('games.youWinIdle')
    return result.forfeit ? t('games.youWinForfeit') : t('games.youWin')
  }
  const names = players.filter((p) => w.includes(p.seat) && !p.leftAt).map((p) => nameOf(p.memberId)).join(', ')
  if (result.idle) return t('games.winIdle', { name: names })
  return result.forfeit ? t('games.winForfeit', { name: names }) : t('games.win', { name: names })
}

const S = {
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0 },
  code: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: G.card, border: '1px solid ' + G.lineHi,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
  badge: {
    padding: '8px 12px', borderRadius: 10, background: G.goldA(0.1), border: '1px solid ' + G.goldA(0.3), color: G.goldHi,
    font: '500 13px/1 var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0,
  },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  name: { font: 'var(--type-label)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  seat: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid',
    flex: '1 1 180px', minWidth: 0, maxWidth: 320,
  },
  sq: {
    width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
    background: 'transparent', color: G.soft, border: '1px solid ' + G.lineHi,
  },
  status: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10,
    background: 'var(--surface-inset)', font: 'var(--type-label)', color: 'var(--text-primary)',
  },
  statusDone: { background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' },
}
