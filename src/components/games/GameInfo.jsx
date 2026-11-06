import { Button, Dialog } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

// Phần giới thiệu dùng chung của sảnh (pages/Games.jsx) và phòng chơi (pages/GameRoom.jsx):
// tranh minh hoạ từng game (SVG tự vẽ, màu theo token — tự đổi sáng / tối) và hộp thoại "Cách chơi".
// Thêm game: thêm một tông màu ở TONE + một tranh ở ART; thiếu thì thẻ chỉ có nền màu, không lỗi.

const TONE = { caro: 'scheduled', oanquan: 'delayed', coganh: 'transit', colat: 'delivered', chamo: 'idle' }
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const RED = 'var(--status-incident)'
const BLUE = 'var(--navy-400)'

function CaroArt() {
  const ink = 'var(--status-scheduled-fg)'
  const at = (r, c) => [c * 16 + 8, r * 16 + 8]
  const xs = [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]
  const os = [[1, 4], [2, 3], [3, 4], [1, 6], [4, 5], [2, 7], [0, 5]]
  const [x1, y1] = at(...xs[0])
  const [x2, y2] = at(...xs[4])
  return (
    <>
      <g stroke={mix(ink, 22)}>
        {Array.from({ length: 9 }, (_, k) => <line key={'v' + k} x1={(k + 1) * 16} y1={0} x2={(k + 1) * 16} y2={96} />)}
        {Array.from({ length: 5 }, (_, k) => <line key={'h' + k} x1={0} y1={(k + 1) * 16} x2={160} y2={(k + 1) * 16} />)}
      </g>
      {xs.map(([r, c]) => {
        const [x, y] = at(r, c)
        return (
          <g key={'x' + r + c} stroke="var(--status-incident-fg)" strokeWidth={2.6} strokeLinecap="round">
            <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} />
            <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} />
          </g>
        )
      })}
      {os.map(([r, c]) => {
        const [x, y] = at(r, c)
        return <circle key={'o' + r + c} cx={x} cy={y} r={5} fill="none" stroke={ink} strokeWidth={2.6} />
      })}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--status-delivered-fg)" strokeWidth={5} strokeLinecap="round" opacity={0.45} />
    </>
  )
}

function OAnQuanArt() {
  const ink = 'var(--status-delayed-fg)'
  const pebbles = [[2, 3, 1, 2, 4], [3, 1, 2, 4, 2]]
  return (
    <>
      <rect x={8} y={20} width={144} height={56} rx={14} fill={mix(ink, 14)} stroke={mix(ink, 40)} />
      <path d="M32 24 A20 24 0 0 0 32 72 Z" fill={mix(ink, 12)} stroke={mix(ink, 35)} />
      <path d="M128 24 A20 24 0 0 1 128 72 Z" fill={mix(ink, 12)} stroke={mix(ink, 35)} />
      <circle cx={22} cy={48} r={7} fill={RED} />
      <circle cx={138} cy={48} r={7} fill={RED} />
      {pebbles.flatMap((row, r) => row.map((n, c) => {
        const x = 32 + c * 19.2
        const y = 24 + r * 24
        return (
          <g key={r + '-' + c}>
            <rect x={x + 1.5} y={y + 1.5} width={16.2} height={21} rx={5} fill={mix(ink, 12)} stroke={mix(ink, 30)} />
            {Array.from({ length: n }, (_, k) => (
              <circle key={k} cx={x + 9.6 + 3.6 * Math.cos(k * 2.4) * Math.sqrt(k)} cy={y + 12 + 3.6 * Math.sin(k * 2.4) * Math.sqrt(k)} r={2.5} fill="var(--gray-500)" />
            ))}
          </g>
        )
      }))}
    </>
  )
}

function CoGanhArt() {
  const ink = 'var(--status-transit-fg)'
  const p = (i) => [44 + (i % 5) * 18, 12 + Math.floor(i / 5) * 18]
  const seg = (a, b, k) => {
    const [x1, y1] = p(a)
    const [x2, y2] = p(b)
    return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />
  }
  return (
    <>
      <g stroke={mix(ink, 50)} strokeWidth={1.6} strokeLinecap="round">
        {[0, 1, 2, 3, 4].flatMap((k) => [seg(k * 5, k * 5 + 4, 'h' + k), seg(k, 20 + k, 'v' + k)])}
        {[[0, 24], [4, 20], [2, 10], [10, 22], [22, 14], [14, 2]].map(([a, b]) => seg(a, b, 'd' + a + b))}
      </g>
      {[[0, 1, 2, 3, 4, 5, 9, 14], [20, 21, 22, 23, 24, 15, 19, 10]].map((pts, side) => pts.map((i) => {
        const [x, y] = p(i)
        return <circle key={side + '-' + i} cx={x} cy={y} r={5.8} fill={side ? RED : BLUE} stroke={mix('var(--gray-0)', 45)} strokeWidth={1.2} />
      }))}
    </>
  )
}

function CoLatArt() {
  const felt = 'var(--status-delivered)'
  const ink = 'var(--navy-950)'
  const at = (r, c) => [38 + c * 10.5 + 5.25, 6 + r * 10.5 + 5.25]
  // [hàng, cột, ghế]: thế cờ giữa ván, quân ở (2, 5) đang lật dở, chấm đỏ là nước vừa đi.
  const discs = [
    [1, 4, 0], [2, 2, 1], [2, 3, 1], [2, 4, 1], [3, 2, 0], [3, 3, 0], [3, 4, 1], [3, 5, 0],
    [4, 2, 0], [4, 3, 1], [4, 4, 0], [4, 5, 0], [5, 3, 0], [5, 4, 0], [5, 5, 1],
  ]
  const [fx, fy] = at(2, 5)
  const [lx, ly] = at(1, 4)
  return (
    <>
      <rect x={35} y={3} width={90} height={90} rx={8} fill={`color-mix(in srgb, ${felt} 42%, ${ink})`} />
      <rect x={38} y={6} width={84} height={84} rx={3} fill={felt} />
      <g stroke={mix(ink, 32)} strokeWidth={0.7}>
        {Array.from({ length: 7 }, (_, k) => [
          <line key={'v' + k} x1={38 + (k + 1) * 10.5} y1={6} x2={38 + (k + 1) * 10.5} y2={90} />,
          <line key={'h' + k} x1={38} y1={6 + (k + 1) * 10.5} x2={122} y2={6 + (k + 1) * 10.5} />,
        ])}
      </g>
      {[[2, 2], [2, 6], [6, 2], [6, 6]].map(([r, c]) => <circle key={r + '' + c} cx={38 + c * 10.5} cy={6 + r * 10.5} r={1.3} fill={mix(ink, 55)} />)}
      {discs.map(([r, c, seat]) => {
        const [x, y] = at(r, c)
        return seat
          ? <circle key={r + '-' + c} cx={x} cy={y} r={4.1} fill="var(--gray-0)" stroke={mix(ink, 28)} strokeWidth={0.6} />
          : (
            <g key={r + '-' + c}>
              <circle cx={x} cy={y} r={4.1} fill="var(--gray-950)" />
              <circle cx={x - 1.3} cy={y - 1.3} r={1.3} fill={mix('var(--gray-0)', 22)} />
            </g>
          )
      })}
      <ellipse cx={fx} cy={fy} rx={1.5} ry={4.1} fill="var(--gray-0)" stroke="var(--gray-950)" strokeWidth={0.9} />
      <circle cx={lx} cy={ly} r={1.2} fill="var(--status-incident)" />
    </>
  )
}

function ChamOArt() {
  const ink = ['var(--status-incident-fg)', 'var(--status-scheduled-fg)']
  const at = (r, c) => [35 + c * 18, 12 + r * 18]
  // Trang vở nghiêng, giữa ván: [hàng, cột, hàng, cột, ghế] — nét cuối (có quầng) là bút đỏ vừa khép ô thứ hai,
  // ô (2, 2) đã đủ 3 cạnh, ai nối cạnh thứ tư là lấy.
  const segs = [
    [0, 0, 0, 1, 1], [0, 0, 1, 0, 0], [0, 1, 1, 1, 1], [1, 0, 1, 1, 0], [1, 0, 2, 0, 1], [2, 0, 2, 1, 0],
    [0, 3, 0, 4, 0], [0, 3, 1, 3, 1], [1, 3, 1, 4, 0], [0, 4, 1, 4, 1], [2, 2, 2, 3, 1], [2, 2, 3, 2, 0],
    [2, 3, 3, 3, 1], [0, 1, 0, 2, 0], [3, 0, 4, 0, 1], [4, 1, 4, 2, 0], [2, 4, 3, 4, 1], [0, 5, 1, 5, 0],
    [3, 4, 3, 5, 0], [4, 4, 4, 5, 1], [1, 1, 2, 1, 0],
  ]
  const boxes = [[0, 0, 0], [1, 0, 0], [0, 3, 1]]
  const line = ([r1, c1, r2, c2], props) => {
    const [x1, y1] = at(r1, c1)
    const [x2, y2] = at(r2, c2)
    return <line key={[r1, c1, r2, c2].join()} x1={x1} y1={y1} x2={x2} y2={y2} {...props} />
  }
  return (
    <g transform="rotate(-4 80 48)">
      <rect x={29} y={9} width={108} height={84} rx={4} fill={mix('var(--status-idle-fg)', 16)} />
      <rect x={26} y={6} width={108} height={84} rx={4} fill="var(--surface-card)" />
      <g stroke={mix(ink[1], 14)} strokeWidth={0.5}>
        {Array.from({ length: 11 }, (_, k) => <line key={'v' + k} x1={35 + k * 9} y1={6} x2={35 + k * 9} y2={90} />)}
        {Array.from({ length: 9 }, (_, k) => <line key={'h' + k} x1={26} y1={12 + k * 9} x2={134} y2={12 + k * 9} />)}
      </g>
      {boxes.map(([r, c, s]) => {
        const [x, y] = at(r, c)
        return <rect key={'b' + r + c} x={x} y={y} width={18} height={18} fill={`var(--status-${s ? 'scheduled' : 'incident'}-bg)`} />
      })}
      {line(segs[segs.length - 1], { stroke: ink[0], strokeWidth: 6.5, strokeLinecap: 'round', opacity: 0.18 })}
      {segs.map((sg) => line(sg, { stroke: ink[sg[4]], strokeWidth: 2.4, strokeLinecap: 'round' }))}
      {boxes.map(([r, c, s]) => {
        const [x, y] = at(r, c)
        const [cx, cy] = [x + 9, y + 9]
        return s
          ? <circle key={'m' + r + c} cx={cx} cy={cy} r={3.8} fill="none" stroke={ink[1]} strokeWidth={1.6} />
          : (
            <g key={'m' + r + c} stroke={ink[0]} strokeWidth={1.6} strokeLinecap="round">
              <line x1={cx - 3.4} y1={cy - 3.4} x2={cx + 3.4} y2={cy + 3.4} />
              <line x1={cx + 3.4} y1={cy - 3.4} x2={cx - 3.4} y2={cy + 3.4} />
            </g>
          )
      })}
      <g fill="var(--text-primary)">
        {Array.from({ length: 30 }, (_, k) => {
          const [x, y] = at(Math.floor(k / 6), k % 6)
          return <circle key={k} cx={x} cy={y} r={1.7} />
        })}
      </g>
    </g>
  )
}

const ART = { caro: CaroArt, oanquan: OAnQuanArt, coganh: CoGanhArt, colat: CoLatArt, chamo: ChamOArt }

/** Dải tranh của game: nền màu theo tông của game, tranh SVG co theo chiều cao. */
export function GameArt({ id, height = 104, radius = 0 }) {
  const Art = ART[id]
  return (
    <div style={{ background: `var(--status-${TONE[id] || 'idle'}-bg)`, height, borderRadius: radius, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      {Art && (
        <svg viewBox="0 0 160 96" aria-hidden="true" style={{ height: '100%', maxWidth: '100%', display: 'block' }}>
          <Art />
        </svg>
      )}
    </div>
  )
}

/** Hộp thoại luật chơi: mỗi dòng của `games.<id>.howto` là một bước, đánh số. */
export function HowTo({ gameId, onClose }) {
  const isMobile = useMobile(768)
  const lines = t('games.' + gameId + '.howto').split('\n')
  return (
    <Dialog
      open
      sheet={isMobile}
      title={t('games.howtoTitle', { game: t('games.' + gameId + '.name') })}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <GameArt id={gameId} height={96} radius={10} />
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {lines.map((line, k) => (
            <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
              <span style={S.num}>{k + 1}</span>
              <span style={S.line}>{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  )
}

const S = {
  num: {
    flexShrink: 0, width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center',
    background: 'var(--surface-brand-soft)', color: 'var(--text-accent)', font: '600 11.5px/1 var(--font-mono)',
  },
  line: { minWidth: 0, font: 'var(--type-body)', color: 'var(--text-primary)', lineHeight: 1.5 },
}
