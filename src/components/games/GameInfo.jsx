import { useId } from 'react'
import { Button, Dialog } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { RANK_FACES, rankOf, SUIT_MARKS, suitOf } from '#lib/games/tienlen.js'

// Phần giới thiệu dùng chung của sảnh (pages/Games.jsx) và phòng chơi (pages/GameRoom.jsx):
// tranh minh hoạ từng game (SVG tự vẽ, màu theo token — tự đổi sáng / tối) và hộp thoại "Cách chơi".
// Thêm game: thêm một tông màu ở TONE + một tranh ở ART; thiếu thì thẻ chỉ có nền màu, không lỗi.

const TONE = { caro: 'scheduled', oanquan: 'delayed', coganh: 'transit', colat: 'delivered', chamo: 'idle', tienlen: 'incident',
  covua: 'scheduled', cotuong: 'delayed', cangua: 'delivered',
  bantau: 'transit', domino: 'idle', baibip: 'delayed', noitu: 'transit', masoi: 'incident' }
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

function TienLenArt() {
  // Năm lá xoè trên tay: A♠ 2♥ K♦ Q♣ J♥, xoay quanh một điểm dưới mép tranh.
  const cards = [44, 51, 42, 37, 35]
  return (
    <>
      <ellipse cx={80} cy={90} rx={62} ry={9} fill={mix('var(--status-incident-fg)', 12)} />
      {cards.map((c, k) => {
        const red = suitOf(c) >= 2
        const ink = red ? 'var(--status-incident-fg)' : 'var(--text-primary)'
        return (
          <g key={c} transform={`rotate(${(k - 2) * 15} 80 120)`}>
            <rect x={63} y={14} width={34} height={50} rx={4} fill="var(--surface-card)" stroke="var(--border-default)" />
            <text x={67} y={25} fill={ink} style={{ font: '600 9px var(--font-mono)' }}>{RANK_FACES[rankOf(c)]}</text>
            <text x={80} y={46} fill={ink} textAnchor="middle" style={{ font: '400 17px var(--font-mono)' }}>{SUIT_MARKS[suitOf(c)]}</text>
          </g>
        )
      })}
    </>
  )
}

function CoVuaArt() {
  // Góc bàn 5 × 3 ô với vua, hậu trắng và mã, vua đen — ký hiệu cờ Unicode như bàn thật (CoVuaBoard.jsx).
  const ink = 'var(--status-scheduled-fg)'
  const font = "400 22px/1 'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
  const pieces = [['♚', 0, 1, 1], ['♛', 1, 2, 0], ['♞', 2, 0, 0], ['♚', 3, 2, 0], ['♟', 4, 1, 1]]
  return (
    <>
      {Array.from({ length: 15 }, (_, k) => {
        const c = k % 5
        const r = Math.floor(k / 5)
        return <rect key={k} x={30 + c * 20} y={18 + r * 20} width={20} height={20} fill={(r + c) % 2 ? mix(ink, 45) : mix(ink, 12)} />
      })}
      <rect x={30} y={18} width={100} height={60} fill="none" stroke={mix(ink, 50)} />
      {pieces.map(([g, c, r, side], k) => (
        <text key={k} x={40 + c * 20} y={29 + r * 20} textAnchor="middle" dominantBaseline="central"
          fill={side ? 'var(--navy-950)' : 'var(--gray-0)'} stroke={side ? 'var(--gray-0)' : 'var(--navy-950)'} strokeWidth={side ? 0.5 : 1} paintOrder="stroke"
          style={{ font }}>{g + '︎'}</text>
      ))}
    </>
  )
}

function CoTuongArt() {
  // Một khúc bàn quanh sông với vài quân tròn khắc chữ: xe, pháo, mã đỏ đối tướng, tốt đen.
  const ink = 'var(--status-delayed-fg)'
  const pieces = [['俥', 0, 3, RED], ['炮', 2, 2, RED], ['將', 5, 0, 'var(--navy-950)'], ['卒', 4, 1, 'var(--navy-950)'], ['傌', 6, 3, RED]]
  return (
    <>
      <g stroke={mix(ink, 45)} strokeWidth={1.4}>
        {[0, 1, 2, 3].map((r) => <line key={'h' + r} x1={20} y1={18 + r * 20} x2={140} y2={18 + r * 20} />)}
        {Array.from({ length: 7 }, (_, c) => <line key={'v' + c} x1={20 + c * 20} y1={18} x2={20 + c * 20} y2={c % 6 ? 38 : 78} />)}
        {Array.from({ length: 7 }, (_, c) => <line key={'w' + c} x1={20 + c * 20} y1={58} x2={20 + c * 20} y2={78} />)}
      </g>
      {pieces.map(([ch, c, r, color], k) => (
        <g key={k} transform={`translate(${20 + c * 20} ${18 + r * 20})`}>
          <circle r={8.5} fill="var(--gray-0)" stroke={color} strokeWidth={1.4} />
          <text textAnchor="middle" dominantBaseline="central" y={0.5} fill={color} style={{ font: '700 9.5px/1 serif' }}>{ch}</text>
        </g>
      ))}
    </>
  )
}

function CaNguaArt() {
  // Một cung đường đua chấm tròn, bốn con ngựa bốn màu và con xúc xắc mặt 6.
  const colors = [RED, 'var(--status-delivered)', 'var(--status-delayed)', 'var(--status-scheduled)']
  const font = "400 13px/1 'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
  const dot = (k) => [80 + 62 * Math.cos(Math.PI * (0.05 + k / 16)), 4 + 62 * Math.sin(Math.PI * (0.05 + k / 16))]
  return (
    <>
      {Array.from({ length: 16 }, (_, k) => {
        const [x, y] = dot(k)
        return <circle key={k} cx={x} cy={y} r={5.5} fill="var(--surface-card)" stroke={mix('var(--text-secondary)', 40)} />
      })}
      {[2, 6, 10, 14].map((k, i) => {
        const [x, y] = dot(k)
        return (
          <g key={k} transform={`translate(${x} ${y})`}>
            <circle r={7.5} fill="var(--gray-0)" stroke={colors[i]} strokeWidth={1.6} />
            <text textAnchor="middle" dominantBaseline="central" y={0.5} fill={colors[i]} style={{ font }}>{'♞︎'}</text>
          </g>
        )
      })}
      <rect x={66} y={22} width={28} height={28} rx={6} fill="var(--gray-0)" stroke="var(--border-default)" />
      {[[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]].map(([dx, dy], k) => (
        <circle key={k} cx={80 + dx * 7} cy={36 + dy * 7} r={2.4} fill="var(--navy-950)" />
      ))}
    </>
  )
}

function BanTauArt() {
  // Mặt biển kẻ ô, một tàu dài bị trúng hai phát, vài phát trượt.
  const ink = 'var(--status-scheduled-fg)'
  const at = (c, r) => [24 + c * 14, 8 + r * 14]
  return (
    <>
      <rect x={24} y={8} width={112} height={84} rx={6} fill={mix(ink, 12)} />
      <g stroke={mix(ink, 25)}>
        {Array.from({ length: 9 }, (_, k) => <line key={'v' + k} x1={24 + k * 14} y1={8} x2={24 + k * 14} y2={92} />)}
        {Array.from({ length: 7 }, (_, k) => <line key={'h' + k} x1={24} y1={8 + k * 14} x2={136} y2={8 + k * 14} />)}
      </g>
      <rect x={at(2, 2)[0] + 2} y={at(2, 2)[1] + 2} width={14 * 4 - 4} height={10} rx={5} fill={BLUE} />
      <rect x={at(6, 4)[0] + 2} y={at(6, 4)[1] + 2} width={10} height={14 * 2 - 4} rx={5} fill={BLUE} />
      {[[3, 2], [4, 2]].map(([c, r]) => {
        const [x, y] = at(c, r)
        return <circle key={c + '-' + r} cx={x + 7} cy={y + 7} r={4.5} fill={RED} />
      })}
      {[[1, 4], [5, 1], [3, 5], [7, 1]].map(([c, r]) => {
        const [x, y] = at(c, r)
        return <circle key={c + '-' + r} cx={x + 7} cy={y + 7} r={2.2} fill="var(--gray-0)" stroke={ink} strokeWidth={0.8} />
      })}
    </>
  )
}

function DominoArt() {
  // Một dây bốn quân nối nhau: 6|6 — 6|3 — 3|1 — 1|5.
  const PIP = { 1: [4], 3: [0, 4, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  const tiles = [[6, 6], [6, 3], [3, 1], [1, 5]]
  const S = 18
  return (
    <>
      {tiles.map(([a, b], k) => {
        const x0 = 8 + k * (S * 2 + 0)
        const y0 = 39 + (k % 2 ? 6 : -6)
        return (
          <g key={k} transform={`translate(${x0} ${y0}) rotate(${k % 2 ? 4 : -4} ${S} ${S / 2})`}>
            <rect width={S * 2 - 1} height={S} rx={3.5} fill="var(--gray-0)" stroke="var(--gray-500)" />
            <line x1={S} y1={3} x2={S} y2={S - 3} stroke="var(--gray-500)" />
            {[a, b].map((v, h) => PIP[v].map((p) => (
              <circle key={h + '-' + p} cx={h * S + 4 + (p % 3) * 5} cy={4 + Math.floor(p / 3) * 5} r={1.5} fill={v === 1 || v === 6 ? RED : 'var(--navy-950)'} />
            )))}
          </g>
        )
      })}
    </>
  )
}

function BaiBipArt() {
  // Ba lá xoè (hai lá úp, một lá lật K) cạnh quả bom ngòi đang cháy, bó dây màu bên dưới.
  const wires = ['var(--status-incident)', 'var(--status-delayed)', 'var(--status-delivered)', 'var(--status-scheduled)']
  return (
    <>
      <ellipse cx={80} cy={88} rx={64} ry={6} fill={mix('var(--status-delayed-fg)', 14)} />
      {[-18, -4, 10].map((r, k) => (
        <g key={k} transform={`rotate(${r} 52 96)`}>
          <rect x={34} y={20} width={30} height={44} rx={4} fill={k === 2 ? 'var(--surface-card)' : 'var(--navy-400)'}
            stroke={k === 2 ? 'var(--border-default)' : 'var(--gray-0)'} />
          {k < 2 && <path d="M49 30 l7 12 -7 12 -7 -12z" fill="none" stroke="var(--gray-0)" strokeOpacity={0.6} />}
          {k === 2 && <text x={49} y={50} textAnchor="middle" fill="var(--status-delayed-fg)" style={{ font: '700 18px var(--font-display)' }}>K</text>}
        </g>
      ))}
      <path d="M118 33 q 6 -10 16 -6" fill="none" stroke="var(--gray-500)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={135} cy={26} r={3.2} fill="var(--status-delayed)" />
      <circle cx={112} cy={52} r={20} fill="var(--navy-950)" />
      <circle cx={105} cy={45} r={5} fill="var(--gray-0)" opacity={0.18} />
      {wires.map((c, k) => <path key={k} d={`M${100 + k * 8} 70 c 3 6 -3 10 0 16`} fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" />)}
    </>
  )
}

function NoiTuArt() {
  // Ba thẻ chữ bậc thang, âm tiết chung tô cùng màu: học sinh → sinh viên → viên …
  const tiles = t('games.noitu.artWords').split('|').map((w) => w.split(' '))
  const ink = 'var(--status-transit-fg)'
  return (
    <>
      <path d="M30 26 L82 50 L132 74" fill="none" stroke={mix('var(--status-transit)', 45)} strokeWidth={2} strokeDasharray="3 4" />
      {tiles.map(([a, b], k) => {
        const x = 8 + k * 50
        const y = 15 + k * 24
        return (
          <g key={k}>
            <rect x={x} y={y} width={48} height={22} rx={7} fill="var(--surface-card)" stroke={k === 1 ? ink : 'var(--border-default)'} strokeWidth={k === 1 ? 1.5 : 1} />
            <text x={x + 24} y={y + 14.5} textAnchor="middle" style={{ font: '600 9px var(--font-sans)' }}>
              <tspan fill={k ? ink : 'var(--text-primary)'}>{a}</tspan>
              <tspan dx={3} fill={k < 2 ? ink : 'var(--text-muted)'}>{b}</tspan>
            </text>
          </g>
        )
      })}
    </>
  )
}

function MaSoiArt() {
  // Ô trời đêm tròn: trăng, sao, Sói ngồi tru trên đồi, mái nhà sáng đèn — cạnh hai lá vai, một úp, một lật mặt Sói.
  const clip = 'ms' + useId().replace(/[^a-zA-Z0-9]/g, '') // sảnh vẽ tranh nhiều lần — id clipPath phải riêng
  const night = 'var(--navy-950)'
  const land = 'var(--navy-800)'
  const stars = [[40, 24], [52, 15], [30, 36], [88, 46], [64, 22], [46, 44]]
  return (
    <>
      <ellipse cx={86} cy={89} rx={66} ry={5} fill={mix('var(--status-incident-fg)', 14)} />
      <clipPath id={clip}><circle cx={62} cy={48} r={37} /></clipPath>
      <circle cx={62} cy={48} r={38.5} fill="none" stroke={mix('var(--status-incident-fg)', 30)} />
      <g clipPath={`url(#${clip})`}>
        <rect x={20} y={6} width={84} height={84} fill={night} />
        {stars.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 2 ? 0.9 : 1.3} fill="var(--gray-0)" opacity={0.75} />)}
        <circle cx={78} cy={28} r={16} fill="var(--gray-0)" opacity={0.08} />
        <circle cx={78} cy={28} r={9.5} fill="var(--gray-0)" opacity={0.95} />
        <circle cx={75} cy={25.5} r={1.8} fill="var(--navy-100)" />
        <circle cx={81} cy={31} r={1.2} fill="var(--navy-100)" />
        <path d="M76 84 V75 L82 69.5 L88 75 V84 Z M89 84 V78 L93.5 74 L98 78 V84 Z" fill={land} />
        <rect x={80.5} y={76.5} width={3} height={3} rx={0.6} fill="var(--status-delayed)" />
        <rect x={92} y={79} width={2.6} height={2.6} rx={0.5} fill="var(--status-delayed)" opacity={0.85} />
        <g transform="translate(33 47)" fill={land}>
          <path d="M2 35 Q-1 27 6 25 L9 22 Q11 15 13 12 L15 6 L15.6 1 L18 4.6 L25 1.2 L21.4 6.6 Q19 9.5 19.6 13 Q21 18 20.6 22 L21 34 L23 36 L17.4 36 L16.6 27 Q15 31 14.6 36 L7 36 Q4 36 2 35 Z" />
        </g>
        <path d="M18 92 Q48 72 110 92 Z" fill={land} />
      </g>
      <g transform="rotate(-10 117 72)">
        <rect x={101} y={24} width={32} height={46} rx={4} fill="var(--navy-400)" stroke="var(--gray-0)" />
        <path d="M117 34 l8 13 -8 13 -8 -13z" fill="none" stroke="var(--gray-0)" strokeOpacity={0.6} />
      </g>
      <g transform="rotate(9 131 72)">
        <rect x={115} y={22} width={32} height={46} rx={4} fill="var(--surface-card)" stroke="var(--border-default)" />
        <circle cx={131} cy={40} r={10.5} fill="var(--status-incident)" />
        <g transform="translate(131 40.6) scale(0.42) translate(-24 -26)">
          <path d="M13 13 L19 20 L24 18.5 L29 20 L35 13 L35.5 25 Q35 32.5 28 36.5 L24 39 L20 36.5 Q13 32.5 12.5 25 Z" fill="var(--gray-0)" />
          <path d="M17.5 25 l4 1.4 M30.5 25 l-4 1.4" stroke="var(--status-incident)" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <rect x={122} y={56} width={18} height={2.6} rx={1.3} fill="var(--border-default)" />
        <rect x={125} y={61} width={12} height={2.2} rx={1.1} fill="var(--border-subtle)" />
      </g>
    </>
  )
}

const ART = {
  caro: CaroArt, oanquan: OAnQuanArt, coganh: CoGanhArt, colat: CoLatArt, chamo: ChamOArt, tienlen: TienLenArt,
  covua: CoVuaArt, cotuong: CoTuongArt, cangua: CaNguaArt, bantau: BanTauArt, domino: DominoArt, baibip: BaiBipArt, noitu: NoiTuArt,
  masoi: MaSoiArt,
}

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
