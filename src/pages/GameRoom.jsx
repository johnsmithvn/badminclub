import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Avatar, Button, Dialog, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { useGameRoom } from '#components/games/useGameRoom.js'
import { SCREENS } from '#components/games/screens.js'
import { HowTo } from '#components/games/GameInfo.jsx'
import { BOT_PREFIX, stakeOf } from '#lib/games/registry.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Chơi với máy (/tro-choi/may-<game>) dùng chung route với phòng thật, tải lười riêng.
const BotRoom = lazy(() => import('#components/games/BotRoom.jsx'))

export default function GameRoom() {
  const { id } = useParams()
  if (id?.startsWith(BOT_PREFIX)) {
    return <Suspense fallback={<Skeleton height={320} />}><BotRoom key={id} gameId={id.slice(BOT_PREFIX.length)} /></Suspense>
  }
  return <RoomPage id={id} />
}

/**
 * Khung phòng chơi — dùng chung cho mọi game: ghế, chờ, bắt đầu, lượt, kết quả, chơi lại.
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
  const isHost = room.hostId === g.me
  const full = seated.length >= game.maxPlayers
  const enough = seated.length >= game.minPlayers
  // Game tự nói điều cần biết ở phòng chờ (Ma sói: bộ vai sẽ chia) — `block` thì chặn nút Bắt đầu.
  const lobby = room.status === 'waiting' ? game.lobby?.(room.options, seated.length) ?? null : null
  const copyLink = async () => {
    const url = window.location.origin + pathOf('gameRoom', room.id) + '?club=' + room.clubId
    try {
      await navigator.clipboard.writeText(url)
      toast(t('games.toast.linkCopied', { code: room.code }))
    } catch {
      toast(t('games.toast.linkCopyFailed', { code: room.code }))
    }
  }
  const leave = async () => {
    setResigning(false)
    if (await act(() => a.gameLeave(room.id)) != null && room.status === 'waiting') back()
  }
  const rematch = async () => {
    const next = await act(() => a.gameCreate(room.game, room.options, room.private, room.id))
    if (next && next !== true) go(next)
  }
  const joinNext = async () => {
    const r = await a.gameJoin({ id: room.nextRoom, game: room.game })
    if (r != null) go(room.nextRoom)
  }

  const turnName = state && state.turn != null && !result ? seated.find((p) => p.seat === state.turn)?.memberId : null
  // Game tự nói trạng thái khi cả bàn cùng đi (đêm Ma sói, duyệt từ Nối từ…) — `status(state, mySeat)` → { key, params }.
  const custom = state && !result ? game.status?.(state, mySeat) : null

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={back}>{isMobile ? null : t('games.back')}</Button>
        <span style={{ ...S.title, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('games.' + room.game + '.name')}
        </span>
        {stake > 0 && <span style={{ ...S.code, letterSpacing: 0, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }}>{t('games.coins.stakePill', { n: stake })}</span>}
        <span style={S.code}>{room.code}</span>
        <Button size="sm" variant="ghost" icon="book-open" aria-label={t('games.howto')} onClick={() => setHowto(true)}>{isMobile ? null : t('games.howto')}</Button>
        <Button size="sm" variant="secondary" icon="link" onClick={copyLink}>{isMobile ? null : t('games.copyLink')}</Button>
      </div>

      {g.err && <Alert tone="danger">{g.err}</Alert>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Đang chơi: theo số ghế của người còn ngồi — ván 3–4 người có người rời thì số ghế không còn liền 0..n-1. */}
        {(room.status === 'waiting' ? Array.from({ length: game.maxPlayers }, (_, s) => s) : seated.map((x) => x.seat)).map((seat) => {
          const p = seated.find((x) => x.seat === seat)
          const on = p && state && !result && state.turn === seat
          const m = p && memberOf(p.memberId)
          return (
            <div key={seat} style={{ ...S.seat, borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)', background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)' }}>
              {p ? <Avatar name={m?.name || ''} src={m?.avatarUrl} size={28} /> : <span style={S.emptyDot} />}
              <div style={{ display: 'grid', gap: 2, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span style={S.name} title={p ? nameOf(p.memberId) : undefined}>{p ? nameOf(p.memberId) : t('games.emptySeat')}</span>
                <span style={S.mono}>
                  {room.status === 'waiting' ? t('games.seatN', { n: seat + 1 }) : t('games.' + room.game + '.mark' + seat)}
                  {p && p.memberId === room.hostId ? ' · ' + t('games.host') : ''}
                </span>
                {p && coinOf(p.memberId) != null && (
                  <span style={{ ...S.mono, fontWeight: 600, color: coinOf(p.memberId) > 0 ? 'var(--status-delivered-fg)' : coinOf(p.memberId) < 0 ? 'var(--status-incident-fg)' : undefined }}>
                    {t('games.coins.delta', { n: (coinOf(p.memberId) > 0 ? '+' : '') + coinOf(p.memberId) })}
                  </span>
                )}
                {p && p.memberId !== g.me && !result && g.idle[p.memberId]?.offline && (
                  <span style={{ ...S.mono, color: 'var(--status-delayed-fg)' }}>
                    {/* Đếm ngược chỉ khi ván đang chờ người này — người khác khoá máy lúc chờ thì không bị xử. */}
                    {room.status === 'playing' && g.idle[p.memberId].leftSec != null
                      ? t('games.offlineLeft', { time: clock(g.idle[p.memberId].leftSec) })
                      : t('games.offline')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {room.status === 'waiting' && (
        <div style={{ ...S.box, padding: 16, display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <span style={S.caption}>
            {!enough ? t('games.needPlayers', { n: game.minPlayers }) : isHost ? t('games.readyHost') : t('games.waitHost')}
          </span>
          {lobby && <span style={{ ...S.caption, color: lobby.block ? 'var(--status-delayed-fg)' : undefined }}>{t(lobby.key, lobby.params)}</span>}
          {stake > 0 && <span style={S.caption}>{t('games.coins.roomHint', { n: stake })}</span>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mySeat == null && g.me && !full && <Button disabled={busy} onClick={() => act(() => a.gameJoin(room))}>{t('games.join')}</Button>}
            {isHost && <Button icon="play" disabled={busy || !enough || !!lobby?.block} onClick={() => act(() => a.gameStart(room))}>{t('games.start')}</Button>}
            {mySeat != null && <Button variant="secondary" icon="log-out" disabled={busy} onClick={leave}>{t('games.leave')}</Button>}
          </div>
        </div>
      )}

      {state && Screen && (
        <>
          <div style={{ ...S.status, ...(result ? S.statusDone : null) }} aria-live="polite">
            {result
              ? resultText(result, room.players, mySeat, nameOf)
              : custom ? t(custom.key, custom.params)
              : mySeat == null ? t('games.spectating')
                : canMove ? t('games.yourTurn') : t('games.theirTurn', { name: turnName ? nameOf(turnName) : '' })}
            <span style={S.mono}>{t('games.moves', { n: g.moves.length })}</span>
          </div>
          <Suspense fallback={<Skeleton height={320} />}>
            <Screen state={game.view(state, mySeat)} mySeat={mySeat} canMove={canMove} onMove={g.play} roomId={room.id} result={room.result} players={inGame} />
          </Suspense>
        </>
      )}

      {room.status === 'playing' && mySeat != null && !result && (
        <div><Button variant="secondary" icon="flag" disabled={busy} onClick={() => setResigning(true)}>{t('games.resign')}</Button></div>
      )}

      {(room.status === 'finished' || room.status === 'abandoned') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {room.status === 'abandoned' && <span style={S.caption}>{t('games.abandoned')}</span>}
          {room.nextRoom
            ? <Button icon="play" onClick={joinNext}>{t('games.nextRoom')}</Button>
            : mySeat != null || room.players.some((p) => p.memberId === g.me)
              ? <Button icon="repeat" disabled={busy} onClick={rematch}>{t('games.rematch')}</Button>
              : null}
          <Button variant="secondary" onClick={back}>{t('games.back')}</Button>
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

/** "1:05" — giây còn lại trước khi đối thủ được xử thắng. Âm thì hiện 0:00 (đang chờ server chốt). */
const clock = (sec) => {
  const s = Math.max(0, sec)
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
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
  title: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  code: { font: '600 14px/1 var(--font-mono)', letterSpacing: '.12em', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, background: 'var(--surface-inset)', flexShrink: 0 },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  name: { font: 'var(--type-label)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  seat: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid',
    flex: '1 1 180px', minWidth: 0, maxWidth: 320,
  },
  emptyDot: { width: 28, height: 28, borderRadius: 99, border: '1px dashed var(--border-strong)', flexShrink: 0 },
  status: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10,
    background: 'var(--surface-inset)', font: 'var(--type-label)', color: 'var(--text-primary)',
  },
  statusDone: { background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' },
}
