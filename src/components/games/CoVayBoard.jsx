import { useId, useMemo, useState } from 'react'
import { Button } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cv, { areaOf, KOMI } from '#lib/games/covay.js'

// Bàn Cờ vây bằng SVG: mặt gỗ, lưới, điểm sao; quân đen / trắng có khối và bóng đổ. Quân vừa đặt nở ra (gamePop) và
// có chấm đỏ; quân vừa bị ăn nhấc khỏi bàn (gameLift — effects.css). Máy tính: rê chuột xem trước, bấm là đặt.
// Điện thoại: chạm để ngắm (quân mờ + chữ thập), chạm lại đúng điểm đó hoặc bấm "Đặt quân" mới đặt — bàn 19 × 19 trên
// màn nhỏ mỗi ô chỉ ~18px, một chạm dễ lệch. Bấm vào điểm cấm (ko, tự sát) thì báo lý do thay vì im lặng.
// Hết ván: tô đất của từng bên và ghi điểm chi tiết. Luật: lib/games/covay.js · server chấm: 0089.

const C = 40 // khoảng cách hai đường kẻ
const M = 34 // lề quanh lưới
const R = 18.6 // bán kính quân
const WOOD = 'var(--status-delayed-bg)'
const INK = 'var(--status-delayed-fg)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
// Màu quân lấy từ bảng màu gốc (không đổi theo sáng / tối) — như Cờ lật.
const FACE = [
  ['color-mix(in srgb, var(--gray-950) 62%, var(--gray-0))', 'var(--gray-950)', 'var(--navy-950)'],
  ['var(--gray-0)', 'var(--gray-50)', 'var(--gray-300)'],
]
const FX = { transformBox: 'fill-box', transformOrigin: 'center' }
const STARS = {
  9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
  13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
  19: [3, 9, 15].flatMap((r) => [3, 9, 15].map((c) => [r, c])),
}
const komiText = KOMI.toLocaleString('vi-VN')

function Stone({ seat, uid, ghost }) {
  return (
    <g opacity={ghost ? 0.5 : 1}>
      {!ghost && <circle cx={1.2} cy={2.2} r={R} fill={mix('var(--navy-950)', 32)} />}
      <circle r={R} fill={`url(#${uid}s${seat})`} stroke={seat ? mix(INK, 30) : 'none'} strokeWidth={1} />
    </g>
  )
}

/** Chấm tròn nhỏ có khối — đứng trước tên mỗi bên ở dải trên bàn. */
function Dot({ seat }) {
  return (
    <span aria-hidden="true" style={{
      width: 16, height: 16, borderRadius: 99, flexShrink: 0,
      background: seat ? 'radial-gradient(circle at 35% 30%, var(--gray-0), var(--gray-300))' : 'radial-gradient(circle at 35% 30%, var(--gray-600), var(--gray-950))',
      boxShadow: seat ? 'inset 0 0 0 1px var(--border-default)' : 'none',
    }} />
  )
}

export default function CoVayBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isMobile = useMobile(768)
  const { size: n, board, last, ko, over } = state
  const W = (n - 1) * C + M * 2
  const xy = (i) => [M + (i % n) * C, M + Math.floor(i / n) * C]
  const [hover, setHover] = useState(null)
  // Ngắm / lỗi gắn với số nước: sang nước mới thì tự bỏ, khỏi xoá trong effect.
  const [aim, setAim] = useState(null) // { i, ply }
  const [why, setWhy] = useState(null) // { i, ply, key }
  const aimAt = canMove && aim?.ply === state.ply ? aim.i : null
  const err = why?.ply === state.ply ? why.key : null
  const area = useMemo(() => (over ? areaOf(board, n) : null), [over, board, n])
  const stones = [0, 1].map((p) => board.filter((v) => v === p).length)

  /** Giao điểm gần chỗ bấm nhất (toạ độ màn hình → toạ độ bàn), ngoài bàn thì null. */
  const pointAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const c = Math.round(((e.clientX - box.left) * (W / box.width) - M) / C)
    const r = Math.round(((e.clientY - box.top) * (W / box.height) - M) / C)
    return r < 0 || c < 0 || r >= n || c >= n ? null : r * n + c
  }
  const put = (i) => { setAim(null); setHover(null); setWhy(null); onMove({ i }) }
  const tap = (e) => {
    if (!canMove) return
    const i = pointAt(e)
    if (i == null || board[i] != null) return
    const bad = cv.validate(state, mySeat, { i })
    if (bad) { setWhy({ i, ply: state.ply, key: bad }); setAim(null); return }
    setWhy(null)
    if (e.pointerType !== 'mouse' && aimAt !== i) { setAim({ i, ply: state.ply }); return }
    put(i)
  }
  const glide = (e) => {
    if (!canMove || e.pointerType !== 'mouse') return
    const i = pointAt(e)
    setHover(i != null && board[i] == null ? i : null)
  }
  const ghost = aimAt ?? (hover != null && cv.validate(state, mySeat, { i: hover }) == null ? hover : null)
  const oppPassed = !over && last?.pass && last.seat !== mySeat && mySeat != null
  const side = (p) => t('games.covay.side' + p)

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Hai bên: màu quân, số quân đã ăn, komi của Trắng; bên đang tới lượt có viền. */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        {[0, 1].map((p) => {
          const on = !over && state.turn === p
          return (
            <div key={p} style={{ ...S.pill, borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)', background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)' }}>
              <Dot seat={p} />
              <span style={S.pillName}>{side(p)}{p === mySeat ? ' · ' + t('games.covay.you') : ''}</span>
              <span style={S.pillNum}>
                {t('games.covay.caps', { n: state.caps[p] })}{p === 1 ? ' · +' + komiText : ''}
              </span>
            </div>
          )
        })}
      </div>

      {oppPassed && <div style={S.notice} aria-live="polite">{t('games.covay.passed', { side: side(last.seat) })}</div>}

      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${W}`}
        role="img"
        aria-label={t('games.covay.boardAria', { n })}
        onPointerUp={tap}
        onPointerMove={glide}
        onPointerLeave={() => setHover(null)}
        style={{
          width: '100%', maxWidth: n === 19 ? 720 : 600, display: 'block', margin: '0 auto', touchAction: 'manipulation',
          userSelect: 'none', cursor: canMove ? 'pointer' : 'default',
        }}
      >
        <defs>
          {FACE.map(([hi, mid, lo], k) => (
            <radialGradient key={k} id={uid + 's' + k} cx="35%" cy="30%" r="80%">
              <stop offset="0%" style={{ stopColor: hi }} />
              <stop offset="45%" style={{ stopColor: mid }} />
              <stop offset="100%" style={{ stopColor: lo }} />
            </radialGradient>
          ))}
          <radialGradient id={uid + 'wood'} cx="45%" cy="38%" r="85%">
            <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${WOOD} 70%, var(--gray-0))` }} />
            <stop offset="65%" style={{ stopColor: WOOD }} />
            <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${WOOD} 82%, ${INK})` }} />
          </radialGradient>
        </defs>

        {/* Mặt gỗ + viền */}
        <rect x={2} y={2} width={W - 4} height={W - 4} rx={14} fill={`url(#${uid}wood)`} stroke={mix(INK, 40)} strokeWidth={2} />

        {/* Lưới: viền ngoài đậm hơn đường trong */}
        <g stroke={mix(INK, 62)} strokeWidth={1.2} strokeLinecap="square">
          {Array.from({ length: n }, (_, k) => {
            const p = M + k * C
            return [
              <line key={'v' + k} x1={p} y1={M} x2={p} y2={W - M} />,
              <line key={'h' + k} x1={M} y1={p} x2={W - M} y2={p} />,
            ]
          })}
        </g>
        <rect x={M} y={M} width={W - 2 * M} height={W - 2 * M} fill="none" stroke={mix(INK, 80)} strokeWidth={2.2} />
        {STARS[n].map(([r, c]) => <circle key={r + '-' + c} cx={M + c * C} cy={M + r * C} r={4.2} fill={mix(INK, 85)} />)}

        {/* Hết ván: đất của từng bên — ô vuông nhỏ màu quân */}
        {area && area.owner.map((who, i) => {
          if (board[i] != null || who == null) return null
          const [x, y] = xy(i)
          return <rect key={'a' + i} x={x - 7} y={y - 7} width={14} height={14} rx={2} fill={who ? 'var(--gray-0)' : 'var(--gray-950)'} opacity={0.85} stroke={who ? mix(INK, 45) : 'none'} />
        })}

        {/* Quân vừa bị ăn nhấc khỏi bàn — nền mờ sẵn (opacity 0) để tắt hiệu ứng thì không còn sót lại */}
        {last?.captured?.map((i) => {
          const [x, y] = xy(i)
          return (
            <g key={'cap' + state.ply + '-' + i} transform={`translate(${x} ${y})`} pointerEvents="none">
              <g style={{ ...FX, opacity: 0, animation: 'gameLift var(--dur-slow) var(--ease-standard) both' }}><Stone seat={1 - last.seat} uid={uid} /></g>
            </g>
          )
        })}

        {board.map((v, i) => {
          if (v == null) return null
          const [x, y] = xy(i)
          const fresh = last && last.i === i
          return (
            <g key={i + '-' + v} transform={`translate(${x} ${y})`} pointerEvents="none">
              <g style={fresh ? { ...FX, animation: 'gamePop var(--dur-base) var(--ease-standard) both' } : undefined}>
                <Stone seat={v} uid={uid} />
              </g>
              {fresh && <circle r={5.2} fill="var(--status-incident)" stroke={v ? 'none' : mix('var(--gray-0)', 60)} strokeWidth={1} />}
            </g>
          )
        })}

        {/* Điểm ko: ô vuông viền — nhắc người tới lượt chưa được ăn lại ở đây */}
        {!over && ko >= 0 && canMove && (() => {
          const [x, y] = xy(ko)
          return <rect x={x - 9} y={y - 9} width={18} height={18} fill="none" stroke="var(--status-incident)" strokeWidth={2.4} pointerEvents="none" />
        })()}

        {/* Quân xem trước (rê chuột) / đang ngắm (chạm) */}
        {ghost != null && mySeat != null && (() => {
          const [x, y] = xy(ghost)
          return (
            <g pointerEvents="none">
              {aimAt != null && (
                <g stroke="var(--text-accent)" strokeWidth={2} opacity={0.9}>
                  <line x1={M} y1={y} x2={W - M} y2={y} />
                  <line x1={x} y1={M} x2={x} y2={W - M} />
                </g>
              )}
              <g transform={`translate(${x} ${y})`}><Stone seat={mySeat} uid={uid} ghost /></g>
            </g>
          )
        })()}
      </svg>

      {canMove && (
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <span style={{ ...S.hint, color: err ? 'var(--status-incident-fg)' : S.hint.color }} aria-live="polite">
            {err ? t(err) : t(isMobile ? 'games.covay.aimHint' : 'games.covay.pickHint')}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {aimAt != null && <Button icon="check" onClick={() => put(aimAt)}>{t('games.covay.put')}</Button>}
            <Button variant="secondary" icon="skip-forward" onClick={() => { setAim(null); onMove({ pass: true }) }}>
              {t(oppPassed ? 'games.covay.passEnd' : 'games.covay.pass')}
            </Button>
          </div>
        </div>
      )}

      {over && state.score && area && (
        <div style={S.score}>
          {[0, 1].map((p) => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Dot seat={p} />
              <span style={{ minWidth: 0 }}>
                {t(p ? 'games.covay.scoreLine1' : 'games.covay.scoreLine0', {
                  side: side(p), stones: stones[p], land: (p ? area.w : area.b) - stones[p], komi: komiText,
                  total: state.score[p].toLocaleString('vi-VN'),
                })}
              </span>
            </span>
          ))}
          <span style={S.hint}>{t('games.covay.scoreNote')}</span>
        </div>
      )}
    </div>
  )
}

const S = {
  pill: {
    display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, minHeight: 40, padding: '6px 12px', borderRadius: 10,
    border: '1px solid', transition: 'background 140ms var(--ease-standard), border-color 140ms var(--ease-standard)',
  },
  pillName: { font: 'var(--type-label)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  pillNum: { font: '500 12px/1 var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 },
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  notice: {
    justifySelf: 'center', padding: '6px 12px', borderRadius: 99, textAlign: 'center',
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: 'var(--type-caption)',
  },
  score: {
    display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)', padding: '12px 14px', borderRadius: 10,
    background: 'var(--surface-inset)', font: 'var(--type-body)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
  },
}
