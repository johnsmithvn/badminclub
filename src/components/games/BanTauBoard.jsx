import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { CELLS, randomFleet, SHIPS, SIZE } from '#lib/games/bantau.js'

// Bàn Bắn tàu: hai vùng biển 10 × 10 bằng SVG — biển mình (tàu mình + phát đối phương bắn vào) và biển đối phương
// (chạm ô để bắn). Đầu ván xếp tàu: bấm Xếp ngẫu nhiên tới khi ưng, rồi Chốt — tàu cất ở server (game_hands), đối
// thủ không thấy. Tàu đã chốt nạp lại từ game_hands; hết ván (server chốt kết quả) thì lật tàu đối phương.
// Luật: lib/games/bantau.js.
// Chơi với máy (BotRoom) truyền sẵn `hands` (tàu theo ghế, dạng phẳng như game_hands) — khỏi hỏi server.
// ponytail: chỉ xếp ngẫu nhiên, chưa kéo thả từng tàu — thêm khi người chơi cần.

const Q = 30
const L = 20 // dải toạ độ
const W = L + Q * SIZE + 4
const WATER = 'var(--status-scheduled-bg)'
const GRID = 'color-mix(in srgb, var(--status-scheduled-fg) 22%, transparent)'
const SHIP = 'var(--navy-400)'
const HIT = 'var(--status-incident)'
const FILES = 'ABCDEFGHIJ'
const cut = (cells) => SHIPS.map((n, k) => cells.slice(SHIPS.slice(0, k).reduce((a, b) => a + b, 0), SHIPS.slice(0, k).reduce((a, b) => a + b, 0) + n))

function Sea({ title, fleet, sunk, shots, onFire, aria, hot }) {
  const xy = (i) => [L + (i % SIZE) * Q, L + Math.floor(i / SIZE) * Q]
  const capsule = (ship, key, fill, opacity = 1) => {
    const xs = ship.map((i) => xy(i))
    const x0 = Math.min(...xs.map((p) => p[0]))
    const y0 = Math.min(...xs.map((p) => p[1]))
    const x1 = Math.max(...xs.map((p) => p[0]))
    const y1 = Math.max(...xs.map((p) => p[1]))
    return <rect key={key} x={x0 + 3} y={y0 + 3} width={x1 - x0 + Q - 6} height={y1 - y0 + Q - 6} rx={(Q - 6) / 2} fill={fill} opacity={opacity} />
  }
  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'center', minWidth: 0 }}>
      <span style={S.title}>{title}</span>
      <svg data-game-fx viewBox={`0 0 ${W} ${W}`} role="group" aria-label={aria}
        style={{ width: '100%', maxWidth: 380, display: 'block', touchAction: 'manipulation', userSelect: 'none' }}>
        <rect x={L} y={L} width={Q * SIZE} height={Q * SIZE} rx={6} fill={WATER} />
        <g stroke={GRID}>
          {Array.from({ length: SIZE + 1 }, (_, k) => (
            <g key={k}>
              <line x1={L + k * Q} y1={L} x2={L + k * Q} y2={L + SIZE * Q} />
              <line x1={L} y1={L + k * Q} x2={L + SIZE * Q} y2={L + k * Q} />
            </g>
          ))}
        </g>
        {Array.from({ length: SIZE }, (_, k) => (
          <g key={'l' + k} fill="var(--text-muted)" style={{ font: '600 10px var(--font-mono)' }} textAnchor="middle">
            <text x={L + k * Q + Q / 2} y={14}>{FILES[k]}</text>
            <text x={9} y={L + k * Q + Q / 2 + 4}>{k + 1}</text>
          </g>
        ))}
        {fleet?.map((ship, k) => capsule(ship, 'f' + k, SHIP, 0.9))}
        {sunk?.map((ship, k) => capsule(ship, 's' + k, HIT, 0.55))}
        {shots.map((r, i) => {
          if (r == null) return null
          const [x, y] = xy(i)
          const fx = i === hot ? { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' } : undefined
          return r === 'miss'
            ? <circle key={i} cx={x + Q / 2} cy={y + Q / 2} r={4} fill="var(--gray-0)" stroke="var(--status-scheduled-fg)" strokeWidth={1} style={fx} />
            : (
              <g key={i} style={fx}>
                <circle cx={x + Q / 2} cy={y + Q / 2} r={9} fill={HIT} opacity={r === 'sunk' ? 1 : 0.9} />
                <path d={`M${x + 10} ${y + 10} L${x + Q - 10} ${y + Q - 10} M${x + Q - 10} ${y + 10} L${x + 10} ${y + Q - 10}`} stroke="var(--gray-0)" strokeWidth={2.4} strokeLinecap="round" />
              </g>
            )
        })}
        {onFire && Array.from({ length: CELLS }, (_, i) => {
          if (shots[i] != null) return null
          const [x, y] = xy(i)
          return (
            <rect key={'hit' + i} x={x} y={y} width={Q} height={Q} fill="transparent" onClick={() => onFire(i)} role="button"
              aria-label={t('games.bantau.fireAria', { cell: FILES[i % SIZE] + (Math.floor(i / SIZE) + 1) })} style={{ cursor: 'crosshair' }} />
          )
        })}
      </svg>
    </div>
  )
}

export default function BanTauBoard({ state, mySeat, canMove, onMove, roomId, result, hands: given }) {
  const { a } = useApp()
  const [draft, setDraft] = useState(() => randomFleet())
  const [hands, setHands] = useState(null) // { roomId, hands } — tàu đã chốt (của mình; hết ván: cả hai)
  const [asked, setAsked] = useState(-1) // ply đang chờ server (chốt tàu / bắn) — khỏi bấm hai lần
  const seated = mySeat != null
  const placedMe = seated && state.placed[mySeat]
  const reveal = !!result
  useEffect(() => {
    if (given || !(placedMe || reveal)) return undefined
    let live = true
    a.gameHand(roomId).then((h) => { if (live) setHands({ roomId, hands: h }) }).catch((e) => console.warn('[games] Không nạp được tàu:', e?.message || e))
    return () => { live = false }
  }, [a, roomId, placedMe, reveal, given])

  const fleetOf = (seat) => {
    const cells = given ? given[seat] : hands?.roomId === roomId ? hands.hands?.[seat] : null
    return cells?.length ? cut(cells) : null
  }
  const wait = asked === state.ply
  const send = (move) => { setAsked(state.ply); setTimeout(() => setAsked(-1), 4000); onMove(move) }
  const me = seated ? mySeat : 0
  const foe = 1 - me
  const hot = state.last?.fire

  if (state.phase === 'place') {
    return (
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center' }}>
        {seated && !placedMe && (
          <>
            <Sea title={t('games.bantau.yourSea')} fleet={draft} shots={Array(CELLS).fill(null)} aria={t('games.bantau.yourSea')} />
            <span style={S.hint}>{t('games.bantau.placeHint')}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="secondary" icon="refresh-cw" onClick={() => setDraft(randomFleet())}>{t('games.bantau.shuffle')}</Button>
              <Button icon="check" disabled={wait} onClick={() => send({ place: draft })}>{t('games.bantau.confirm')}</Button>
            </div>
          </>
        )}
        {placedMe && <Sea title={t('games.bantau.yourSea')} fleet={fleetOf(mySeat)} shots={Array(CELLS).fill(null)} aria={t('games.bantau.yourSea')} />}
        <span style={S.hint}>
          {[0, 1].map((s) => t('games.bantau.mark' + s) + ': ' + t(state.placed[s] ? 'games.bantau.ready' : 'games.bantau.placing')).join(' · ')}
        </span>
      </div>
    )
  }

  const last = state.last
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Sea
          title={seated ? t('games.bantau.foeSea') : t('games.bantau.seaOf', { side: t('games.bantau.mark' + foe) })}
          fleet={reveal ? fleetOf(foe) : null} sunk={state.sunk[me]} shots={state.shots[me]} hot={last?.seat === me ? hot : null}
          onFire={canMove && !wait ? (i) => send({ fire: i }) : null} aria={t('games.bantau.foeSea')}
        />
        <Sea
          title={seated ? t('games.bantau.yourSea') : t('games.bantau.seaOf', { side: t('games.bantau.mark' + me) })}
          fleet={seated || reveal ? fleetOf(me) : null} sunk={state.sunk[foe]} shots={state.shots[foe]} hot={last?.seat === foe ? hot : null}
          aria={t('games.bantau.yourSea')}
        />
      </div>
      <div style={{ ...S.hint, color: last?.hit ? 'var(--status-incident-fg)' : S.hint.color }} aria-live="polite">
        {last?.fire != null
          ? t(last.sunk ? 'games.bantau.lastSunk' : last.hit ? 'games.bantau.lastHit' : 'games.bantau.lastMiss', {
            side: t('games.bantau.mark' + last.seat), cell: FILES[last.fire % SIZE] + (Math.floor(last.fire / SIZE) + 1), n: last.sunk?.length,
          })
          : ''}
        {canMove && !state.over ? ' · ' + t(wait ? 'games.bantau.firing' : 'games.bantau.fireHint') : ''}
      </div>
      <div style={{ ...S.hint, fontFamily: 'var(--font-mono)' }}>
        {[0, 1].map((s) => t('games.bantau.mark' + s) + ' ' + t('games.bantau.score', { n: state.sunk[s].length, total: SHIPS.length })).join(' · ')}
      </div>
    </div>
  )
}

const S = {
  title: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 18 },
}
