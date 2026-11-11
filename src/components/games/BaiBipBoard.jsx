import { useEffect, useRef, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { CARD } from '#components/games/stage.js'
import { t } from '#i18n'
import bb, { deadlineOf, fits, KINDS, kindOf, mustCall, WIRES } from '#lib/games/baibip.js'

// Bàn Bài bịp: ghế + quả bom từng người, lá chủ, chồng lá úp, lá vừa lật khi tố, bài trên tay mình.
// Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp từ game_hands (RLS chỉ trả tay mình) — server bớt lá khi
// đánh nên hàng đó luôn là bài còn lại; số lá đổi / sang ván mới là nạp lại. Luật: lib/games/baibip.js.

const side = (seat) => t('games.baibip.mark' + seat)

/** Đồng hồ máy, nhích mỗi giây khi có hạn lượt. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}
const kindName = (k) => t('games.baibip.kind' + KINDS[k])
// Màu dây bom, theo thứ tự dây 0..5.
const WIRE_INK = ['var(--status-incident)', 'var(--status-delayed)', 'var(--status-delivered)', 'var(--status-transit)', 'var(--status-scheduled)', 'var(--gray-0)']
// Mực từng loại lá trên mặt ngà (CARD) — viết cứng như lá bài tây dùng chung, giữ nguyên ở sáng / tối.
const KIND_INK = ['#1d4ed8', '#b45309', CARD.red, '#15803d']

/** Mặt lá Q / K / A / Joker — vẽ tay: chữ lớn + hình (vương miện, sao). */
function Face({ c, kind = kindOf(c), w = 46, on, bad, dim, onPick, label }) {
  const h = Math.round(w * 1.42)
  const ink = KIND_INK[kind]
  const svg = (
    <svg viewBox="0 0 46 66" width={w} height={h} aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.75} y={0.75} width={44.5} height={64.5} rx={6} fill={CARD.face}
        stroke={bad ? 'var(--status-incident)' : on ? 'var(--border-focus-color)' : CARD.line} strokeWidth={on || bad ? 2.5 : 1.2} />
      <text x={5} y={13} fill={ink} style={{ font: '700 10px var(--font-mono)' }}>{kind === 3 ? '★' : KINDS[kind]}</text>
      {kind === 3
        ? (
          <>
            <path d="M23 18 l4 9 10 1 -7.5 6.5 2.3 9.8 -8.8 -5.3 -8.8 5.3 2.3 -9.8 -7.5 -6.5 10 -1z" fill={ink} opacity={0.9} />
            <text x={23} y={57} textAnchor="middle" fill={ink} style={{ font: '700 6.5px var(--font-mono)', letterSpacing: '.08em' }}>JOKER</text>
          </>
        )
        : (
          <>
            {kind !== 2 && (
              <path d={kind === 1 ? 'M12 26 l4 -9 4.5 6 2.5 -8 2.5 8 4.5 -6 4 9z' : 'M13 26 l3 -7 4 4.5 3 -6.5 3 6.5 4 -4.5 3 7z'}
                fill={ink} opacity={0.85} />
            )}
            {kind === 2 && <path d="M23 15 l7 10 -7 10 -7 -10z" fill={ink} opacity={0.85} />}
            <text x={23} y={54} textAnchor="middle" fill={ink} style={{ font: '700 22px var(--font-display)' }}>{KINDS[kind]}</text>
          </>
        )}
    </svg>
  )
  if (!onPick) return <span aria-label={label} style={{ flexShrink: 0, opacity: dim ? 0.5 : 1 }}>{svg}</span>
  return (
    <button type="button" onClick={onPick} aria-pressed={!!on} aria-label={label}
      style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', flexShrink: 0, opacity: dim ? 0.5 : 1, touchAction: 'manipulation',
        transform: on ? 'translateY(-10px)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)' }}>
      {svg}
    </button>
  )
}

/** Mặt lưng lá (úp) — cùng lưng sọc với lá bài tây dùng chung. */
function Back({ w = 22, style }) {
  return <span aria-hidden="true" style={{ display: 'block', width: w, height: Math.round(w * 1.42), borderRadius: w >= 20 ? 3 : 2, background: CARD.back, border: '1px solid ' + CARD.backLine, boxSizing: 'border-box', ...style }} />
}

/**
 * Quả bom 6 dây. `cuts` = dây đã cắt. `onCut` có thì các dây còn lại bấm được (người thua đang chọn dây).
 * `boom` = bom đã nổ (người đó bị loại).
 */
function Bomb({ cuts, onCut, boom, size = 120 }) {
  const live = !!onCut && !boom
  const wire = (k) => {
    const x = 26 + k * 13.6
    const cut = cuts.includes(k)
    const ink = WIRE_INK[k]
    const edge = k === 5 ? 'var(--gray-500)' : 'none'
    const go = () => live && !cut && onCut(k)
    return (
      <g key={k} role={live && !cut ? 'button' : undefined} tabIndex={live && !cut ? 0 : undefined}
        aria-label={live && !cut ? t('games.baibip.cutAria', { color: t('games.baibip.wire' + k) }) : undefined}
        onClick={go} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
        style={{ cursor: live && !cut ? 'pointer' : 'default', outline: 'none' }}>
        <rect x={x - 6} y={70} width={12} height={40} fill="transparent" />
        {cut
          ? (
            <>
              <path d={`M${x} 74 q 3 6 -1 11`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
              <path d={`M${x} 106 q -3 -6 1 -11`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
              {edge !== 'none' && <path d={`M${x} 74 q 3 6 -1 11 M${x} 106 q -3 -6 1 -11`} fill="none" stroke={edge} strokeWidth={0.8} />}
            </>
          )
          : (
            <path d={`M${x} 74 C ${x + 5} 84, ${x - 5} 96, ${x} 106`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round"
              style={live ? { filter: 'drop-shadow(0 0 2px var(--border-focus-color))' } : undefined} />
          )}
        {edge !== 'none' && !cut && <path d={`M${x} 74 C ${x + 5} 84, ${x - 5} 96, ${x} 106`} fill="none" stroke={edge} strokeWidth={0.8} />}
      </g>
    )
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img"
      aria-label={t('games.baibip.bombAria', { n: WIRES - cuts.length })} style={{ display: 'block', overflow: 'visible' }}>
      {/* Ngòi + tia lửa */}
      <path d="M74 20 q 10 -12 22 -6" fill="none" stroke="var(--gray-500)" strokeWidth={2.5} strokeLinecap="round" />
      {!boom && <circle cx={97} cy={14} r={3.5} fill="var(--status-delayed)" style={{ animation: 'gameFlash .6s ease-in-out infinite alternate' }} />}
      <rect x={64} y={18} width={14} height={9} rx={2} fill="var(--gray-500)" transform="rotate(30 71 22)" />
      {/* Thân bom */}
      <circle cx={56} cy={46} r={28} fill="var(--navy-950)" />
      <circle cx={46} cy={36} r={7} fill="var(--gray-0)" opacity={0.18} />
      {/* Hộp dây */}
      <rect x={14} y={66} width={92} height={10} rx={3} fill="var(--gray-500)" />
      <rect x={14} y={104} width={92} height={10} rx={3} fill="var(--gray-500)" />
      {Array.from({ length: WIRES }, (_, k) => wire(k))}
      {boom && (
        <g style={{ transformOrigin: '56px 46px', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}>
          <path d="M56 6 l8 22 22 -10 -10 22 24 6 -24 8 12 22 -22 -10 -10 22 -6 -24 -22 10 10 -22 -24 -6 22 -10 -12 -20 22 10z"
            fill="var(--status-delayed)" opacity={0.92} />
          <text x={56} y={52} textAnchor="middle" fill="var(--status-incident-fg)" style={{ font: '800 15px var(--font-display)' }}>{t('games.baibip.boomWord')}</text>
        </g>
      )}
    </svg>
  )
}

export default function BaiBipBoard({ state, mySeat, roomId, onMove, result }) {
  const { a } = useApp()
  const [got, setGot] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [pick, setPick] = useState({ ply: -1, cards: [] })
  const seated = mySeat != null
  const reveal = !!result
  const myCount = seated ? state.counts[mySeat] ?? 0 : 0
  useEffect(() => {
    if (!seated && !reveal) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setGot({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setGot({ roomId, failed: true }) })
    return () => { live = false }
    // Đánh xong (số lá đổi) hoặc sang ván mới → nạp lại tay.
  }, [a, roomId, seated, reveal, state.round, myCount, tries])

  const mine = got?.roomId === roomId ? got : null
  // Chờ chia ván mới: tay cũ đã hết hiệu lực (server sẽ chia lại) — không hiện nữa.
  const hand = seated && state.phase !== 'redeal' ? [...(mine?.hands?.[mySeat] || [])].sort((x, y) => x - y) : []
  const sel = pick.ply === state.ply ? pick.cards.filter((c) => hand.includes(c)) : []
  const myTurn = seated && !state.over && state.turn === mySeat && !state.out[mySeat]
  const canPlay = myTurn && state.phase === 'play'
  const forced = canPlay && !!state.lastPlay && mustCall(state, mySeat)
  const canCall = canPlay && bb.validate(state, mySeat, { call: true }) == null
  const toggle = (c) => {
    if (!canPlay || forced) return
    const next = sel.includes(c) ? sel.filter((x) => x !== c) : sel.length < 3 ? [...sel, c] : sel
    setPick({ ply: state.ply, cards: next })
  }
  const { last, reveal: shown } = state

  // Hết giờ lượt → tự báo { timeout }: người tới lượt báo trước, người khác chờ thêm (phòng máy kia đã tắt).
  // Server đo bằng giờ của nó; chưa tới thì im lặng, mỗi 4 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(due != null && !result)
  const sent = useRef('')
  const alive = seated && !state.out[mySeat]
  useEffect(() => {
    if (due == null || !alive || result) return
    const at = due + (state.turn === mySeat ? 300 : 2000 + ((mySeat - state.turn + state.n) % state.n) * 800)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, alive, result, now, mySeat, state.turn, state.n, state.ply, onMove])
  const secs = due != null && !result ? Math.max(0, Math.ceil((due - now) / 1000)) : null
  const tableKind = state.table

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Ghế: bom + số lá */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {state.out.map((out, seat) => (
          <div key={seat} style={{ ...S.seat, borderColor: state.turn === seat ? 'var(--border-focus-color)' : 'var(--border-subtle)',
            background: state.turn === seat ? 'var(--surface-accent-soft)' : 'var(--surface-card)', opacity: out ? 0.6 : 1 }}>
            <Bomb cuts={state.cuts[seat] || []} boom={!!state.blown[seat]} size={54} />
            <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
              <span style={S.label}>{side(seat)}{seat === mySeat ? ' · ' + t('games.baibip.you') : ''}</span>
              <span style={S.mono}>
                {state.blown[seat] ? t('games.baibip.blownTag') : out ? t('games.baibip.outTag') : t('games.baibip.cardsLeft', { n: state.counts[seat] ?? 0 })}
              </span>
              <span style={S.mono}>{t('games.baibip.wiresLeft', { n: WIRES - (state.cuts[seat] || []).length })}</span>
              {!out && state.counts[seat] > 0 && (
                <div style={{ display: 'flex', gap: 0 }}>
                  {Array.from({ length: state.counts[seat] }, (_, k) => <Back key={k} w={13} style={{ marginLeft: k ? -5 : 0 }} />)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bàn: lá chủ + chồng lá úp + diễn biến */}
      <div style={S.table} aria-live="polite">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {tableKind != null && (
            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span style={S.caption}>{t('games.baibip.tableCard')}</span>
              <Face kind={tableKind} w={54} label={kindName(tableKind)} />
            </div>
          )}
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center', minWidth: 90 }}>
            <span style={S.caption}>{t('games.baibip.pile', { n: state.pile })}</span>
            <div style={{ position: 'relative', width: 70, height: 50 }}>
              {Array.from({ length: Math.min(state.pile, 12) }, (_, k) => (
                <Back key={k} w={30} style={{ position: 'absolute', left: 18 + ((k * 7) % 22) - 8, top: 2 + ((k * 5) % 9), transform: `rotate(${((k * 37) % 50) - 25}deg)` }} />
              ))}
            </div>
          </div>
        </div>
        {secs != null && (
          <span style={{ ...S.caption, color: secs <= 5 ? 'var(--status-incident-fg)' : undefined }} role="timer">
            {t('games.baibip.timeLeft', { side: side(state.turn), n: secs })}
          </span>
        )}
        {last?.timeout && <span style={S.caption}>{t('games.baibip.autoMove', { side: side(last.seat) })}</span>}
        {state.lastPlay && state.phase === 'play' && (
          <span style={S.event}>{t('games.baibip.lastPlay', { side: side(state.lastPlay.seat), n: state.lastPlay.n, kind: kindName(tableKind) })}</span>
        )}
        {shown && last?.call && (
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}>
            <span style={S.event}>{t('games.baibip.called', { caller: side(shown.caller), side: side(shown.seat) })}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {shown.cards.map((c) => <Face key={c} c={c} w={40} bad={!fits(c, tableKind)} label={kindName(kindOf(c))} />)}
            </div>
            <span style={{ ...S.verdict, color: shown.liar ? 'var(--status-incident-fg)' : 'var(--status-delivered-fg)' }}>
              {shown.liar ? t('games.baibip.liar', { side: side(shown.seat) }) : t('games.baibip.truth', { side: side(shown.caller) })}
            </span>
          </div>
        )}
        {last?.cut !== undefined && (
          <span style={{ ...S.verdict, color: last.boom ? 'var(--status-incident-fg)' : 'var(--status-delivered-fg)' }}>
            {last.boom
              ? t('games.baibip.boom', { side: side(last.seat) })
              : t('games.baibip.safe', { side: side(last.seat), color: t('games.baibip.wire' + last.cut) })}
          </span>
        )}
        {last?.out && <span style={S.event}>{t('games.baibip.lastOut', { side: side(last.seat) })}</span>}
        {state.phase === 'cut' && state.cutter != null && state.cutter !== mySeat && (
          <span style={S.caption}>{t('games.baibip.waitCut', { side: side(state.cutter) })}</span>
        )}
        {state.phase === 'redeal' && state.turn !== mySeat && (
          <span style={S.caption}>{t('games.baibip.waitDeal', { side: side(state.turn) })}</span>
        )}
      </div>

      {/* Người thua chọn dây */}
      {myTurn && state.phase === 'cut' && (
        <div style={{ ...S.panel, justifyItems: 'center' }}>
          <span style={S.label}>{t('games.baibip.cutHint')}</span>
          <Bomb cuts={state.cuts[mySeat]} onCut={(w) => onMove({ cut: w })} size={180} />
          <span style={S.caption}>{t('games.baibip.cutOdds', { n: WIRES - state.cuts[mySeat].length })}</span>
        </div>
      )}
      {myTurn && state.phase === 'redeal' && (
        <div style={{ ...S.panel, justifyItems: 'center' }}>
          <span style={S.caption}>{t('games.baibip.redealHint')}</span>
          <Button icon="repeat" onClick={() => onMove({ deal: true })}>{t('games.baibip.redeal')}</Button>
        </div>
      )}

      {/* Bài trên tay mình */}
      {seated && !state.over && !state.out[mySeat] && state.phase !== 'cut' && (
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={S.caption}>{t('games.baibip.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.tienlen.reloadHand')}</Button>
              </div>
            )
            : (
              <div role="group" aria-label={t('games.baibip.handAria', { n: hand.length })}
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 10, minHeight: 76 }}>
                {hand.length
                  ? hand.map((c) => (
                    <Face key={c} c={c} on={sel.includes(c)} onPick={canPlay && !forced ? () => toggle(c) : undefined}
                      label={kindName(kindOf(c))} />
                  ))
                  : <span style={S.caption}>{t('games.baibip.noCards')}</span>}
              </div>
            )}
          {canPlay && (
            <>
              <span style={S.caption}>
                {forced ? t('games.baibip.mustCallHint')
                  : !state.lastPlay ? t('games.baibip.leadHint', { kind: kindName(tableKind) })
                    : t('games.baibip.playHint', { kind: kindName(tableKind), side: side(state.lastPlay.seat) })}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!forced && (
                  <Button icon="play" disabled={!sel.length} onClick={() => onMove({ play: sel })}>
                    {t('games.baibip.play', { n: sel.length || 1, kind: kindName(tableKind) })}
                  </Button>
                )}
                {canCall && (
                  <Button variant={forced ? 'primary' : 'secondary'} icon="flag" onClick={() => onMove({ call: true })}>
                    {t('games.baibip.call')}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  event: { font: '500 13px/1.35 var(--font-sans)', color: 'var(--text-primary)', textAlign: 'center' },
  verdict: { font: '700 15px/1.3 var(--font-display)', textAlign: 'center' },
  panel: { display: 'grid', gap: 10, padding: 14, borderRadius: 12, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' },
  table: {
    minHeight: 150, borderRadius: 12, padding: 14, display: 'grid', gap: 10, placeItems: 'center', alignContent: 'center', textAlign: 'center',
    background: 'color-mix(in srgb, var(--status-incident-fg) 14%, var(--surface-inset))', border: '1px solid var(--border-subtle)',
  },
}
