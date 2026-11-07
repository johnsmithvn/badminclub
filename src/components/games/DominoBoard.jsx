import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import dm, { endsFor, TILES } from '#lib/games/domino.js'

// Bàn Domino: số quân từng ghế + nọc, dây quân trên bàn (SVG, chấm nút như quân thật), quân trên tay mình.
// Quân trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp từ game_hands (RLS chỉ trả tay mình; bốc thêm là nạp
// lại), quân còn lại = quân trên tay − quân đã nằm trên dây. Hết ván (server chốt) thì lật quân mọi người.
// Chạm quân sáng để đánh; khớp cả hai đầu thì chọn đầu. Luật: lib/games/domino.js.

// Chấm của một nửa quân (0..6), toạ độ trong ô 3 × 3.
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const side = (seat) => t('games.domino.mark' + seat)
const same = ([a, b], t2) => TILES[t2][0] === Math.min(a, b) && TILES[t2][1] === Math.max(a, b)

function Tile({ a, b, size = 26, on, dim, onPick, label }) {
  const half = (v, x0) => PIPS[v].map((k) => (
    <circle key={x0 + '-' + k} cx={x0 + size * (0.22 + (k % 3) * 0.28)} cy={size * (0.22 + Math.floor(k / 3) * 0.28)} r={size * 0.085}
      fill={v === 1 || v === 6 ? 'var(--status-incident)' : 'var(--navy-950)'} />
  ))
  const svg = (
    <svg viewBox={`0 0 ${size * 2} ${size}`} width={size * 2} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.75} y={0.75} width={size * 2 - 1.5} height={size - 1.5} rx={size * 0.18} fill="var(--gray-0)"
        stroke={on ? 'var(--border-focus-color)' : 'var(--gray-500)'} strokeWidth={on ? 2.5 : 1.2} />
      <line x1={size} y1={size * 0.15} x2={size} y2={size * 0.85} stroke="var(--gray-500)" strokeWidth={1.2} />
      {half(a, 0)}
      {half(b, size)}
    </svg>
  )
  if (!onPick) return <span style={{ opacity: dim ? 0.45 : 1, flexShrink: 0 }} aria-label={label}>{svg}</span>
  return (
    <button type="button" onClick={onPick} aria-label={label} aria-pressed={!!on}
      style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', flexShrink: 0, opacity: dim ? 0.45 : 1,
        transform: on ? 'translateY(-6px)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)', touchAction: 'manipulation' }}>
      {svg}
    </button>
  )
}

export default function DominoBoard({ state, mySeat, canMove, onMove, roomId, result }) {
  const { a } = useApp()
  const [got, setGot] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [pick, setPick] = useState({ ply: -1, tile: null })
  const seated = mySeat != null
  const reveal = !!result
  const myCount = seated ? state.counts[mySeat] : 0
  useEffect(() => {
    if (!seated && !reveal) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setGot({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được quân:', e?.message || e); if (live) setGot({ roomId, failed: true }) })
    return () => { live = false }
    // Bốc thêm quân → số quân đổi → nạp lại tay.
  }, [a, roomId, seated, reveal, myCount, tries])

  const mine = got?.roomId === roomId ? got : null
  const left = (seat) => (mine?.hands?.[seat] || []).filter((x) => !state.line.some((p) => same(p, x)))
  const hand = seated ? left(mySeat) : []
  const playable = (x) => canMove && dm.validate(state, mySeat, { play: x, end: endsFor(state, x)[0] }) == null
  const any = hand.some(playable)
  const sel = pick.ply === state.ply ? pick.tile : null
  const tap = (x) => {
    const ends = endsFor(state, x)
    if (!playable(x)) return
    if (ends.length > 1 && state.line.length) { setPick({ ply: state.ply, tile: sel === x ? null : x }); return }
    onMove({ play: x, end: ends[0] })
  }
  const last = state.last

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))` }}>
        {state.counts.map((k, seat) => (
          <div key={seat} style={{ ...S.seat, borderColor: state.turn === seat ? 'var(--border-focus-color)' : 'var(--border-subtle)',
            background: state.turn === seat ? 'var(--surface-accent-soft)' : 'var(--surface-card)', opacity: state.out[seat] ? 0.55 : 1 }}>
            <span style={S.label}>{side(seat)}{seat === mySeat ? ' · ' + t('games.domino.you') : ''}</span>
            <span style={S.mono}>
              {t('games.domino.tilesLeft', { n: k })}
              {state.out[seat] ? ' · ' + t('games.domino.out') : ''}
              {result?.pips?.[seat] != null ? ' · ' + t('games.domino.pips', { n: result.pips[seat] }) : ''}
            </span>
          </div>
        ))}
        <div style={{ ...S.seat, borderColor: 'var(--border-subtle)', background: 'var(--surface-inset)' }}>
          <span style={S.label}>{t('games.domino.pile')}</span>
          <span style={S.mono}>{t('games.domino.tilesLeft', { n: state.pile })}</span>
        </div>
      </div>

      <div style={S.table} aria-live="polite">
        {state.line.length
          ? (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {state.line.map(([x, y], k) => <Tile key={x + '-' + y + '-' + k} a={x} b={y} size={22} label={x + '–' + y} />)}
            </div>
          )
          : <span style={S.caption}>{state.lead != null
            ? t('games.domino.firstLead', { side: side(state.turn), tile: TILES[state.lead].join('–') })
            : state.turn != null ? t('games.domino.freeLead', { side: side(state.turn) }) : ''}</span>}
        {state.line.length > 0 && <span style={S.mono}>{t('games.domino.ends', { l: state.left, r: state.right })}</span>}
        {last?.draw && <span style={S.mono}>{t('games.domino.lastDraw', { side: side(last.seat) })}</span>}
        {last?.pass && <span style={S.mono}>{t('games.domino.lastPass', { side: side(last.seat) })}</span>}
        {last?.out && <span style={S.mono}>{t('games.domino.lastOut', { side: side(last.seat) })}</span>}
      </div>

      {seated && !state.over && (
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={S.caption}>{t('games.domino.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.tienlen.reloadHand')}</Button>
              </div>
            )
            : (
              <div role="group" aria-label={t('games.domino.handAria', { n: hand.length })}
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 8 }}>
                {hand.map((x) => (
                  <Tile key={x} a={TILES[x][0]} b={TILES[x][1]} size={30} on={sel === x} dim={canMove && !playable(x)}
                    onPick={canMove ? () => tap(x) : undefined} label={TILES[x].join('–')} />
                ))}
              </div>
            )}
          {canMove && sel != null && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size="sm" variant="secondary" icon="arrow-left" onClick={() => onMove({ play: sel, end: 'L' })}>{t('games.domino.toLeft', { n: state.left })}</Button>
              <Button size="sm" variant="secondary" onClick={() => onMove({ play: sel, end: 'R' })}>{t('games.domino.toRight', { n: state.right })}</Button>
            </div>
          )}
          {canMove && (
            <>
              <span style={S.caption}>{any ? t('games.domino.pickHint') : state.pile > 0 ? t('games.domino.drawHint') : t('games.domino.passHint')}</span>
              {!any && state.line.length > 0 && (state.pile > 0
                ? <Button icon="plus" onClick={() => onMove({ draw: true })}>{t('games.domino.draw')}</Button>
                : <Button variant="secondary" onClick={() => onMove({ pass: true })}>{t('games.domino.pass')}</Button>)}
            </>
          )}
        </div>
      )}

      {state.over && reveal && (
        <div style={{ ...S.table, placeItems: 'stretch', textAlign: 'left' }}>
          {state.counts.map((_, seat) => (
            <div key={seat} style={{ display: 'grid', gap: 6 }}>
              <span style={S.label}>
                {side(seat)}{result.winners?.includes(seat) ? ' · ' + t('games.domino.winner') : ''}
                {result.scores?.[seat] ? ' · ' + t('games.domino.points', { n: result.scores[seat] }) : ''}
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {left(seat).length ? left(seat).map((x) => <Tile key={x} a={TILES[x][0]} b={TILES[x][1]} size={18} />) : <span style={S.mono}>{t('games.domino.empty')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 2, minWidth: 0 },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  table: {
    minHeight: 110, borderRadius: 12, padding: 14, display: 'grid', gap: 8, placeItems: 'center', alignContent: 'center', textAlign: 'center',
    background: 'color-mix(in srgb, var(--status-delivered-fg) 18%, var(--surface-inset))', border: '1px solid var(--border-subtle)',
  },
}
