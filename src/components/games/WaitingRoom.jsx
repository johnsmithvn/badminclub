import { useEffect, useState } from 'react'
import { Avatar, Button, Dialog, Icon } from '#ds'
import { G, btn, card, mono, over } from '#components/games/stage.js'
import RoomChat from '#components/games/RoomChat.jsx'
import RoomOptions from '#components/games/RoomOptions.jsx'
import { blockedOf, rulesOf } from '#components/games/roomFields.js'
import { BOARD_POINTS, buyinsOf, seatRange, stakeOf } from '#lib/games/registry.js'
import { CLOCKS } from '#lib/games/chessClock.js'
import { useMobile } from '#hooks/useMobile.js'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'

// Phòng chờ (bản "Phòng Chờ v2"): sân khấu có mặt bàn ở giữa, ghế xếp quanh bàn (mình luôn ở dưới), số người sẵn
// sàng ở giữa bàn; thanh đáy = cấu hình của mình (xu mang vào bàn) / của chủ phòng (thời gian cờ) + nút lớn
// Sẵn sàng · Huỷ · Bắt đầu ván; cột phải = Luật bàn (chủ phòng Sửa được) + Chat phòng có tin hệ thống.
// Bắt đầu: chủ phòng bấm → mọi máy đếm ngược 3-2-1 (useGameRoom.countdown) → gọi game_start.
// Luật server: 0105 (game_ready / game_kick / game_set_options; game_start đòi mọi người Sẵn sàng).

const COUNT_MS = 3000
const CHESS = ['covua', 'cotuong']

/** Toạ độ (%) của ghế thứ k (k = 0 là mình) trong n ghế: 2 người ngồi hai bên, đông hơn thì xếp vòng quanh bàn. */
const posOf = (k, n, rx, ry) => {
  const a = ((n === 2 ? 180 + k * 180 : 90 + (k * 360) / n) * Math.PI) / 180
  return [50 + rx * Math.cos(a), 50 + (n === 2 ? 0 : ry * Math.sin(a))]
}

export default function WaitingRoom({ g, act, busy, nameOf, memberOf, onInvite, onLeave }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const { room, game, seated, mySeat, me } = g
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(room.options)
  const [now, setNow] = useState(() => Date.now())
  const isHost = room.hostId === me
  const [minP, maxP] = seatRange(game, room.options)
  const stake = stakeOf(room.options)
  const ins = buyinsOf(room.game, stake)
  const points = BOARD_POINTS.includes(room.game)
  const mine = seated.find((p) => p.memberId === me) || null
  const isReady = (p) => p.memberId === room.hostId || p.ready
  const readyN = seated.filter(isReady).length
  const allReady = seated.every(isReady)
  const short = seated.length < minP
  const tooMany = seated.length > maxP
  // Game tự nói điều cần biết ở phòng chờ (Ma sói: bộ vai sẽ chia) — `block` thì chặn nút Bắt đầu.
  const lobby = game.lobby?.(room.options, seated.length) ?? null
  const canStart = isHost && !short && !tooMany && allReady && !lobby?.block

  // Đếm ngược: chạy theo giờ máy này nhận tín hiệu; chủ phòng đếm xong thì gọi game_start.
  const elapsed = Math.max(0, now - g.countAt)
  const counting = g.countAt > 0 && elapsed < COUNT_MS
  const count = counting ? Math.ceil((COUNT_MS - elapsed) / 1000) : 0
  useEffect(() => {
    if (!g.countAt) return undefined
    const id = setInterval(() => {
      setNow(Date.now())
      if (Date.now() - g.countAt > COUNT_MS + 400) clearInterval(id) // đếm xong thì thôi nhích
    }, 200)
    return () => clearInterval(id)
  }, [g.countAt])
  const start = () => {
    g.countdown()
    setTimeout(() => act(() => a.gameStart(room)), COUNT_MS)
  }

  const notReady = seated.filter((p) => !isReady(p)).map((p) => (p.memberId === me ? t('games.wait.you') : nameOf(p.memberId)))
  const headline = short ? (maxP === 2 ? t('games.wait.needFoe') : t('games.needPlayers', { n: minP }))
    : tooMany ? t('games.wait.tooMany', { n: maxP })
      : allReady ? (isHost ? t('games.wait.allReadyHost') : t('games.wait.allReady'))
        : notReady.length > 3 ? t('games.wait.waitN', { n: notReady.length }) : t('games.wait.waitNames', { names: notReady.join(', ') })

  // Nút lớn + dòng ghi chú cạnh nó.
  let action
  if (counting) action = { label: t('games.wait.starting'), on: false, note: t('games.wait.startIn', { n: count }) }
  else if (isHost) {
    action = {
      label: t('games.wait.start'), on: canStart, run: start,
      note: canStart ? t('games.wait.allReadyNote') : short ? t('games.wait.needMore', { n: minP - seated.length }) : lobby?.block ? t(lobby.key, lobby.params) : headline,
      warn: !canStart,
    }
  } else if (mine) {
    action = mine.ready
      ? { label: t('games.wait.unready'), on: null, run: () => act(() => a.gameReady(room.id, false)), note: t('games.wait.readyNote'), ok: true }
      : { label: t('games.wait.ready'), on: true, run: () => act(() => a.gameReady(room.id, true)), note: stake && ins.length > 1 ? t('games.wait.readyHintCoins') : t('games.wait.readyHint') }
  } else if (room.players.some((p) => p.memberId === me && p.kicked)) action = { label: t('games.wait.full'), on: false, note: t('games.err.kicked') }
  else if (me && seated.length < maxP) action = { label: t('games.join'), on: true, run: () => act(() => a.gameJoin(room)), note: t('games.wait.joinHint') }
  else action = { label: t('games.wait.full'), on: false, note: t('games.spectating') }

  // Nhóm cấu hình ở thanh đáy.
  const groups = []
  if (stake > 0 && mine && ins.length > 1) {
    const locked = !isHost && mine.ready
    groups.push({
      label: t('games.coins.buyin'), note: locked ? t('games.wait.lockedReady') : points ? t('games.coins.roomHintPoints', { n: stake, min: ins[0].toLocaleString('vi-VN'), max: ins[ins.length - 1].toLocaleString('vi-VN') }) : '',
      locked, opts: ins.map((n) => ({ label: t('games.coins.stakeOpt', { n: n.toLocaleString('vi-VN') }), on: (mine.buyin ?? ins[0]) === n, run: () => act(() => a.gameBuyin(room.id, n)) })),
    })
  }
  if (CHESS.includes(room.game)) {
    const cur = room.options.clock || 0
    groups.push({
      label: t('games.clock'), note: isHost ? '' : t('games.wait.hostPicks'), locked: !isHost,
      opts: [...CLOCKS, 0].map((n) => ({ label: n ? t('games.clockOpt', { n }) : t('games.clockNone'), on: cur === n, run: () => act(() => a.gameSetOptions(room.id, { ...room.options, clock: n })) })),
    })
  }

  const n = maxP
  const ring = n > 4
  // Ghế trên / dưới căn giữa khối (ảnh + tên + nhãn ~125px) → khung phải đủ cao và mặt bàn đủ thấp để khối không bị cắt / đè bàn.
  const H = isMobile ? (n === 2 ? 260 : ring ? 420 : 400) : (n === 2 ? 340 : ring ? 540 : 480)
  const rx = n === 2 ? 36 : ring ? 40 : 38
  const ry = ring ? 40 : 35
  const av = isMobile ? (n === 2 ? 64 : ring ? 36 : 48) : (n === 2 ? 88 : ring ? 50 : 72)
  const plate = n === 2 ? { w: '44%', h: '62%', r: 28 } : ring ? { w: '54%', h: '48%', r: 999 } : { w: '50%', h: '40%', r: 120 }
  const base = mySeat ?? 0

  const rules = [[t('games.wait.players'), minP === maxP ? String(minP) : minP + '–' + maxP], ...rulesOf(room.game, room.options)]
  const saveRules = async () => {
    if (await act(() => a.gameSetOptions(room.id, draft)) != null) setEditing(false)
  }

  return (
    <div style={{ display: 'grid', gap: 18, alignItems: 'start', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 340px' }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
        {/* Sân khấu: mặt bàn + ghế. */}
        <div style={{ ...card, position: 'relative', height: H, borderRadius: 22, overflow: 'hidden', background: `radial-gradient(70% 60% at 50% 50%, ${G.tealA(0.09)}, transparent 70%), ${G.card}` }}>
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: plate.w, height: plate.h, transform: 'translate(-50%, -50%)', borderRadius: plate.r,
            background: `radial-gradient(ellipse at 50% 38%, ${G.tealA(0.22)}, ${G.tealA(0.08)} 70%)`,
            boxShadow: `0 0 0 10px ${G.inset}, 0 0 0 11px ${G.line}, 0 30px 60px -24px rgba(0,0,0,.35)`,
          }}>
            <div style={{ position: 'absolute', inset: 12, borderRadius: Math.max(8, plate.r - 12), border: '1px dashed ' + G.tealA(0.3) }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px', textAlign: 'center', opacity: counting ? 0 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ font: `700 ${isMobile ? 36 : 50}px/1 var(--font-mono)`, color: allReady && !short ? G.tealHi : G.text }}>{readyN}/{seated.length}</span>
                <span style={{ font: '500 13px/1 var(--font-sans)', color: G.muted }}>{t('games.wait.readyWord')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240 }}>
                {Array.from({ length: n }, (_, s) => {
                  const p = seated.find((x) => x.seat === s)
                  const on = p && isReady(p)
                  return <span key={s} style={{ width: 11, height: 11, borderRadius: 99, background: on ? G.teal : p ? G.lineHi : 'transparent', border: `1.5px ${p ? 'solid' : 'dashed'} ${on ? G.teal : G.lineHi}`, boxShadow: on ? '0 0 8px ' + G.tealA(0.7) : 'none' }} />
                })}
              </div>
              <span style={{ font: '600 13px/1.35 var(--font-sans)', color: allReady && !short ? G.tealHi : G.sub, maxWidth: 300 }}>{headline}</span>
            </div>
          </div>

          {Array.from({ length: n }, (_, s) => {
            const p = seated.find((x) => x.seat === s)
            const [x, y] = posOf((s - base + n) % n, n, rx, ry)
            const host = p && p.memberId === room.hostId
            const ready = p && !host && p.ready
            const m = p && memberOf(p.memberId)
            const offline = p && p.memberId !== me && g.idle[p.memberId]?.offline
            return (
              <div key={s} style={{ position: 'absolute', left: x + '%', top: y + '%', transform: 'translate(-50%, -50%)', width: ring ? 96 : 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ring ? 4 : 7, zIndex: 2 }}>
                {p ? (
                  <>
                    <div style={{ position: 'relative', borderRadius: 99, boxShadow: host ? `0 0 0 3px ${G.gold}, 0 0 22px ${G.goldA(0.45)}` : ready ? `0 0 0 3px ${G.teal}, 0 0 26px ${G.tealA(0.55)}` : `0 0 0 3px ${G.line}`, transition: 'box-shadow .4s', opacity: offline ? 0.55 : 1 }}>
                      <Avatar name={m?.name || ''} src={m?.avatarUrl} size={av} />
                      {host && <span aria-hidden="true" style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 17, color: G.goldHi }}>♛</span>}
                      {ready && <span aria-hidden="true" style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 99, background: G.teal, color: G.tealInk, display: 'grid', placeItems: 'center', border: '3px solid ' + G.card }}><Icon name="check" size={12} /></span>}
                      {isHost && !host && !counting && (
                        <button type="button" disabled={busy} onClick={() => act(() => a.gameKick(room.id, p.memberId))} title={t('games.wait.kick', { name: nameOf(p.memberId) })} aria-label={t('games.wait.kick', { name: nameOf(p.memberId) })}
                          style={{ position: 'absolute', left: -5, top: -5, width: 24, height: 24, borderRadius: 99, display: 'grid', placeItems: 'center', cursor: 'pointer', background: G.card, color: G.red, border: '1px solid ' + G.redA(0.5), padding: 0 }}>
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </div>
                    <span style={{ maxWidth: '100%', font: `700 ${ring ? 12 : 14}px/1.2 var(--font-sans)`, color: ring && !host && !ready ? G.muted : G.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {nameOf(p.memberId)}{p.memberId === me && <span style={{ fontWeight: 500, color: G.tealHi, fontSize: 11 }}> {t('games.wait.youTag')}</span>}
                    </span>
                    {stake > 0 && p.buyin != null && <span style={{ ...mono, fontSize: 11.5, color: G.goldHi }}>{t('games.coins.stakeOpt', { n: p.buyin.toLocaleString('vi-VN') })}</span>}
                    {offline && <span style={{ ...mono, fontSize: 11, color: 'var(--status-delayed-fg)' }}>{t('games.offline')}</span>}
                    {!ring && (
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, font: '700 11.5px/1.3 var(--font-sans)', whiteSpace: 'nowrap',
                        background: host ? G.goldA(0.12) : ready ? G.tealA(0.15) : G.inset, color: host ? G.goldHi : ready ? G.tealHi : G.muted,
                        border: '1px solid ' + (host ? G.goldA(0.35) : ready ? G.tealA(0.45) : G.line),
                      }}>{host ? t('games.host') : ready ? t('games.wait.readyPill') : t('games.wait.notReadyPill')}</span>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={onInvite} title={t('games.wait.invite')} aria-label={t('games.wait.invite')}
                      style={{ width: av, height: av, borderRadius: 99, border: '2px dashed ' + G.lineHi, background: 'transparent', color: G.muted, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                      <Icon name="plus" size={ring ? 16 : 22} />
                    </button>
                    <span style={{ font: `600 ${ring ? 11.5 : 13}px/1.2 var(--font-sans)`, color: G.muted, whiteSpace: 'nowrap' }}>{ring ? t('games.seatN', { n: s + 1 }) : t('games.wait.emptySeat', { n: s + 1 })}</span>
                  </>
                )}
              </div>
            )
          })}

          {counting && (
            <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
              <div key={'r' + count} style={{ position: 'absolute', left: '50%', top: '50%', width: 220, height: 220, borderRadius: 99, border: '3px solid ' + G.tealA(0.7), animation: 'gwRing 1s ease-out forwards' }} />
              <div key={'c' + count} style={{ position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -64, textAlign: 'center', font: '700 128px/128px var(--font-mono)', color: G.tealHi, textShadow: '0 0 40px ' + G.tealA(0.7), animation: 'gwPop 1s ease-out forwards' }}>{count}</div>
            </div>
          )}
        </div>

        {/* Thanh đáy: cấu hình + nút lớn. */}
        <div style={{ ...card, borderRadius: 18, padding: '16px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {(groups.length > 0 || (lobby && !lobby.block)) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, flex: '1 1 320px', minWidth: 0 }}>
            {groups.map((gr) => (
              <div key={gr.label} style={{ display: 'grid', gap: 9, opacity: gr.locked ? 0.55 : 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={over}>{gr.label}</span>
                  {gr.note && <span style={{ font: '400 12px/1.3 var(--font-sans)', color: G.muted }}>{gr.note}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {gr.opts.map((o) => (
                    <button key={o.label} type="button" disabled={gr.locked || busy || counting} aria-pressed={o.on} onClick={() => !o.on && o.run()}
                      style={{
                        padding: '8px 13px', borderRadius: 10, font: '700 13px/1 var(--font-sans)', whiteSpace: 'nowrap', cursor: gr.locked ? 'not-allowed' : 'pointer',
                        background: o.on ? G.goldA(0.14) : 'transparent', color: o.on ? G.goldHi : G.muted, border: '1px solid ' + (o.on ? G.goldA(0.5) : G.line),
                      }}>{o.label}</button>
                  ))}
                </div>
              </div>
            ))}
            {lobby && !lobby.block && <span style={{ font: '500 13px/1.4 var(--font-sans)', color: G.sub, alignSelf: 'center' }}>{t(lobby.key, lobby.params)}</span>}
          </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto', flex: groups.length || lobby ? '0 1 auto' : '1 1 auto' }}>
            <span style={{ flex: '1 1 160px', minWidth: 0, font: '600 13px/1.35 var(--font-sans)', color: action.ok || (isHost && canStart) ? G.tealHi : action.warn ? G.goldHi : G.muted, textAlign: groups.length || lobby ? 'right' : 'left' }}>{action.note}</span>
            {mySeat != null && <button type="button" onClick={onLeave} disabled={busy} style={btn('ghost', { sm: true })}><Icon name="log-out" size={14} />{t('games.leave')}</button>}
            <button type="button" disabled={!action.run || action.on === false || busy || counting} onClick={action.run}
              style={{
                minWidth: isMobile ? 150 : 190, padding: isMobile ? '13px 20px' : '15px 26px', borderRadius: 14, font: `800 ${isMobile ? 15 : 17}px/1 var(--font-sans)`, whiteSpace: 'nowrap', transition: 'all .25s',
                cursor: action.on === false || busy ? 'not-allowed' : 'pointer',
                ...(action.on === true ? { background: G.teal, color: G.tealInk, border: '1.5px solid ' + G.teal, boxShadow: '0 5px 0 ' + G.tealA(0.55) + ', 0 10px 30px -8px ' + G.tealA(0.7) }
                  : action.on === null ? { background: 'transparent', color: G.text, border: '1.5px solid ' + G.lineHi }
                    : { background: G.inset, color: G.muted, border: '1.5px solid ' + G.line }),
              }}>{action.label}</button>
          </div>
        </div>
      </div>

      {/* Cột phải: Luật bàn + Chat phòng. */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
        <div style={{ ...card, borderRadius: 18, padding: '14px 16px', display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={over}>{t('games.wait.rules')}</span>
            {isHost && !counting && (
              <button type="button" onClick={() => { setDraft(room.options); setEditing(true) }} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: '600 12px/1 var(--font-sans)', color: G.tealHi }}>{t('common.edit')}</button>
            )}
          </div>
          {rules.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, font: '400 13px/1.4 var(--font-sans)' }}>
              <span style={{ color: G.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ font: '600 13px/1.4 var(--font-sans)', color: G.text, textAlign: 'right', minWidth: 0 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ ...card, borderRadius: 18, display: 'flex', flexDirection: 'column', height: isMobile ? 420 : H + 92, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + G.line, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '700 14px/1 var(--font-sans)' }}>{t('games.wait.chat')}</span>
            <span style={{ font: '400 12px/1 var(--font-sans)', color: G.muted }}>{t('games.wait.seatedN', { n: seated.length, max: maxP })}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: '12px 14px', display: 'flex' }}>
            <RoomChat g={g} nameOf={nameOf} grow />
          </div>
        </div>
      </div>

      {editing && (
        <Dialog
          open
          sheet={isMobile}
          title={t('games.wait.editRules')}
          onClose={() => setEditing(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button onClick={saveRules} disabled={busy || blockedOf(room.game, draft)}>{t('common.save')}</Button>
            </>
          )}
        >
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <RoomOptions gameId={room.game} opts={draft} setOpts={setDraft} stakeLocked />
            <span style={{ font: 'var(--type-caption)', color: G.muted }}>{t('games.wait.editHint')}</span>
          </div>
        </Dialog>
      )}
    </div>
  )
}

