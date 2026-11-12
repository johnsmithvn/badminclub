import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { advanceAt, complete, CUPID, CURSED, deadlineOf, deckOf, ELDER, F, GUARD, HUNTER, isWolf, ROLE_IDS, rowOf, SEER, tableOf, tallyOf, VILLAGER, WITCH, WOLF } from '#lib/games/masoi.js'

// Bàn Ma sói: bầu trời theo pha, lá vai của mình (game_hands — chỉ mình đọc được), bảng người chơi (bấm thẻ để
// chọn người), khung việc cần làm theo vai, diễn biến. Cả bàn cùng đi: xong bước thì máy mình tự gửi { next } — máy
// ghế thấp gửi trước, máy khác chờ thêm (phòng khi máy kia đã tắt). Luật: lib/games/masoi.js · server: 0084.

const INK = [
  'var(--gray-500)', 'var(--status-incident)', 'var(--violet-500)', 'var(--status-transit)', 'var(--status-delivered)',
  'var(--status-scheduled)', 'var(--status-delayed)', 'var(--navy-400)', 'color-mix(in srgb, var(--status-incident) 55%, var(--gray-0))',
]
const roleName = (r) => t('games.masoi.role.' + ROLE_IDS[r])
const W = 'var(--gray-0)'

/** Đồng hồ máy, nhích mỗi giây khi bước có hạn giờ. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

/** Hình vẽ của từng vai (trắng trên nền màu vai), khung 48×48. */
function Glyph({ role }) {
  const ink = INK[role]
  if (role === WOLF || role === CURSED) {
    return (
      <>
        <path d="M13 13 L19 20 L24 18.5 L29 20 L35 13 L35.5 25 Q35 32.5 28 36.5 L24 39 L20 36.5 Q13 32.5 12.5 25 Z" fill={W} />
        <path d="M17.5 25 l4 1.4 M30.5 25 l-4 1.4" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M21.8 32 h4.4 l-2.2 2.6 z" fill={ink} />
        {role === CURSED && <path d="M36.5 6.5 a6.5 6.5 0 1 0 5.5 10 a5 5 0 1 1 -5.5 -10 z" fill="var(--violet-100)" />}
      </>
    )
  }
  if (role === SEER) {
    return (
      <>
        <path d="M8.5 24 Q24 10.5 39.5 24 Q24 37.5 8.5 24 Z" fill="none" stroke={W} strokeWidth={2.6} strokeLinejoin="round" />
        <circle cx={24} cy={24} r={6.4} fill={W} />
        <circle cx={24} cy={24} r={2.8} fill={ink} />
        <circle cx={26.2} cy={21.8} r={1.1} fill={W} />
      </>
    )
  }
  if (role === GUARD) {
    return (
      <>
        <path d="M24 10 L35.5 14 V23.5 Q35.5 33 24 38.5 Q12.5 33 12.5 23.5 V14 Z" fill={W} />
        <path d="M18.5 24 L22.5 28 L30 19.5" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  }
  if (role === WITCH) {
    return (
      <>
        <rect x={20.5} y={9.5} width={7} height={3.2} rx={1.2} fill={W} />
        <path d="M21.5 12.5 V19 A10 10 0 1 0 26.5 19 V12.5 Z" fill={W} />
        <path d="M14.6 28 Q19 25.4 24 28 T33.4 28 A9.4 9.4 0 0 1 14.6 28 Z" fill={ink} opacity={0.8} />
        <circle cx={22} cy={22.5} r={1.5} fill={ink} />
        <circle cx={26.4} cy={20} r={1} fill={ink} />
      </>
    )
  }
  if (role === HUNTER) {
    return (
      <>
        <path d="M17 9.5 Q35 24 17 38.5" fill="none" stroke={W} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M17 9.5 V38.5" stroke={W} strokeWidth={1.2} />
        <path d="M9.5 24 H36" stroke={W} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M38.5 24 l-6 -3.8 v7.6 z" fill={W} />
        <path d="M10.5 24 l-2.8 -3.2 M10.5 24 l-2.8 3.2" stroke={W} strokeWidth={1.7} strokeLinecap="round" />
      </>
    )
  }
  if (role === ELDER) {
    return (
      <>
        <path d="M19.5 38.5 V18 Q19.5 10.5 26.5 10.5 Q33 10.5 33 17" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        <path d="M33 17 V21" stroke={W} strokeWidth={1.4} />
        <rect x={29.2} y={21} width={7.6} height={9.5} rx={2.2} fill={W} />
        <rect x={31.4} y={23.6} width={3.2} height={4.3} rx={1} fill="var(--status-delayed)" />
      </>
    )
  }
  if (role === CUPID) {
    return (
      <>
        <path d="M9.5 36 L36 14.5" stroke={W} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M24 37 C11 29 11.5 16.5 18.5 16 C21.8 15.8 23.4 17.8 24 19.4 C24.6 17.8 26.2 15.8 29.5 16 C36.5 16.5 37 29 24 37 Z" fill={W} />
        <path d="M39 12 l-6.6 .8 l4.6 4.8 z" fill={W} />
        <path d="M10 35.6 l-1 -4 M10 35.6 l4 1" stroke={W} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M20.5 22 a3 3 0 0 1 3 -2.4" fill="none" stroke={ink} strokeWidth={1.4} strokeLinecap="round" />
      </>
    )
  }
  // Dân làng: căn nhà.
  return (
    <>
      <path d="M10.5 24.5 L24 12.5 L37.5 24.5" fill="none" stroke={W} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 23 V36.5 H33 V23 L24 15 Z" fill={W} />
      <rect x={21} y={28} width={6} height={8.5} rx={1.2} fill={ink} />
    </>
  )
}

/** Huy hiệu vai: biết vai thì vẽ vai, chưa biết thì bóng người. Chết thì xám, gạch chéo. */
function RoleIcon({ role, size = 40, dead = false }) {
  const known = Number.isInteger(role) && role >= 0
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"
      style={{ flexShrink: 0, display: 'block', filter: dead ? 'grayscale(1)' : undefined, opacity: dead ? 0.55 : 1 }}>
      <circle cx={24} cy={24} r={23} fill={known ? INK[role] : 'var(--gray-300)'} />
      {known
        ? <Glyph role={role} />
        : (
          <>
            <circle cx={24} cy={18.5} r={6.6} fill={W} opacity={0.9} />
            <path d="M11.5 37.5 Q11.5 27 24 27 Q36.5 27 36.5 37.5 Z" fill={W} opacity={0.9} />
          </>
        )}
      {dead && <path d="M14 14 L34 34 M34 14 L14 34" stroke="var(--status-incident-fg)" strokeWidth={3.2} strokeLinecap="round" />}
    </svg>
  )
}

const STARS = [[24, 16], [58, 34], [92, 11], [128, 27], [166, 13], [204, 32], [238, 9], [272, 22], [336, 12], [112, 46], [186, 50], [350, 40]]
const HOUSES = [[18, 24, 15], [66, 18, 11], [138, 28, 17], [214, 20, 13], [300, 26, 14]]
const TREES = [[50, 9], [104, 11], [184, 10], [262, 12], [342, 9]]

/** Bầu trời: đêm (trăng, sao, cửa sổ sáng) · bước Phù thủy (quầng tím) · ngày (mặt trời) · hết ván. */
function Sky({ dark, witch, title, clock }) {
  const land = dark ? 'var(--navy-900)' : 'color-mix(in srgb, var(--status-delivered) 40%, var(--surface-card))'
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <svg viewBox="0 0 360 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ width: '100%', height: 96, display: 'block' }}>
        <rect width={360} height={96} fill={dark ? 'var(--navy-950)' : 'color-mix(in srgb, var(--status-transit) 22%, var(--surface-card))'} />
        {dark
          ? (
            <>
              {STARS.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 3 ? 1 : 1.5} fill={W} opacity={0.75} />)}
              {witch && <circle cx={306} cy={30} r={26} fill="var(--violet-500)" opacity={0.28} />}
              <circle cx={306} cy={30} r={13} fill={W} opacity={0.93} />
              <circle cx={301} cy={26} r={2.6} fill="var(--navy-100)" opacity={0.7} />
              <circle cx={310} cy={35} r={1.8} fill="var(--navy-100)" opacity={0.7} />
            </>
          )
          : (
            <>
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4
                return <path key={k} d={`M${306 + Math.cos(a) * 18} ${30 + Math.sin(a) * 18} L${306 + Math.cos(a) * 24} ${30 + Math.sin(a) * 24}`} stroke="var(--status-delayed)" strokeWidth={2.4} strokeLinecap="round" />
              })}
              <circle cx={306} cy={30} r={13} fill="var(--status-delayed)" />
            </>
          )}
        {/* Sói tru trên đồi (đêm) */}
        {dark && <path d="M4 84 Q30 66 64 84 Z M30 72 L32 64 L31.5 59 L34 55.5 L35 51.5 L37.2 54 L37 57.5 L40.5 61.5 L42 68 L44 74 Z" fill={land} />}
        <rect x={0} y={84} width={360} height={12} fill={land} />
        {TREES.map(([x, h], k) => <path key={k} d={`M${x - h / 2} 84 L${x} ${84 - h * 2} L${x + h / 2} 84 Z`} fill={land} />)}
        {HOUSES.map(([x, w, h], k) => (
          <g key={k}>
            <path d={`M${x} 84 V${84 - h} L${x + w / 2} ${84 - h - w / 2.4} L${x + w} ${84 - h} V84 Z`} fill={land} />
            {dark && <rect x={x + w / 2 - 2.5} y={84 - h + 4} width={5} height={5} rx={1} fill="var(--status-delayed)" opacity={0.9} />}
          </g>
        ))}
      </svg>
      <span style={{ ...S.skyTitle, color: dark ? W : 'var(--text-primary)' }}>{title}</span>
      {clock && <span role="timer" aria-label={t('games.masoi.timeLeft', { time: clock })} style={{ ...S.skyClock, color: dark ? W : 'var(--text-primary)' }}>{clock}</span>}
    </div>
  )
}

export default function MaSoiBoard({ state, mySeat, roomId, onMove, result, players }) {
  const { a, db } = useApp()
  const [got, setGot] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [sel, setSel] = useState({ key: '', picks: [], curse: false })
  const [busy, setBusy] = useState(false)
  const seated = mySeat != null
  const done = !!result || !!state.over

  // Vai + dữ kiện riêng: nạp lại sau mỗi nước (đồng đội Sói vừa chọn, Tiên tri vừa soi, trời vừa sáng…).
  useEffect(() => {
    if (!seated && !done) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setGot({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được vai:', e?.message || e); if (live) setGot({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, done, state.ply, tries])

  const hands = got?.roomId === roomId ? got.hands : null
  const mine = seated ? rowOf(hands?.[mySeat]) : null
  const role = mine?.role
  const facts = mine?.facts || []
  const of = (k) => facts.filter((f) => f[0] === k)
  const mates = of(F.MATE).map((f) => f[1])
  const lovers = of(F.LOVERS)[0]?.slice(1) || []
  const seen = Object.fromEntries(of(F.SEEN).map((f) => [f[1], f[2]]))
  const picksOf = (seat) => of(F.PICK).filter((f) => f[2] === seat).length
  const potions = of(F.POTIONS)[0]
  const guarded = of(F.GUARDED)[0]?.[1] ?? -1
  const curseLeft = of(F.CURSE)[0]?.[1] === 1
  const turned = of(F.TURNED)[0]?.[1]
  const bitten = of(F.BITTEN).at(-1)?.[1]

  const nameOf = (seat) => {
    const id = players?.find((p) => p.seat === seat)?.memberId
    return db.members.find((m) => m.id === id)?.name || t('games.masoi.mark' + seat)
  }
  const roleOf = (seat) => {
    if (state.shown[seat] != null) return state.shown[seat]
    if (done && hands?.[seat]?.length) return hands[seat][0]
    if (seat === mySeat) return role
    if (isWolf(role) && mates.includes(seat)) return WOLF
    return seen[seat] === 1 ? WOLF : null
  }

  // Đủ người thì tự chốt bước: ghế thấp gửi trước; server chưa nhận thì gửi lại sau. Bước đêm thì chờ đủ giờ dù đã
  // đủ người (advanceAt — xong sớm là lộ vai).
  const ready = complete(state)
  const rank = Math.max(0, (players || []).map((p) => p.seat).sort((x, y) => x - y).indexOf(mySeat))
  // Có đồng hồ: hết giờ cũng chốt (server kiểm giờ của nó; máy mình nhanh hơn server thì im lặng thử lại).
  const due = deadlineOf(state)
  const [again, setAgain] = useState(0)
  useEffect(() => {
    const at = advanceAt(state, Date.now())
    if (at == null || !seated || result) return undefined
    const wait = Math.max(0, at - Date.now()) + 600 + rank * 1200
    const fire = setTimeout(() => onMove({ next: true }), wait)
    const retry = setTimeout(() => setAgain((n) => n + 1), wait + 8000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [state, seated, result, rank, again, onMove])
  const now = useNow(due != null && !result)
  const secs = due != null && !result ? Math.max(0, Math.ceil((due - now) / 1000)) : null

  const live = state.started && !state.over && !result
  const alive = seated && !!state.alive[mySeat]
  const ph = state.phase
  let mode = null
  if (live && alive && (ph === 'night' || ph === 'witch') && !state.acted[mySeat] && mine) {
    if (ph === 'witch') mode = role === WITCH ? 'witch' : 'sleep'
    else mode = isWolf(role) ? 'wolf' : role === SEER ? 'seer' : role === GUARD ? 'guard' : role === CUPID && state.night === 1 ? 'cupid' : 'sleep'
  }
  if (live && alive && ph === 'day' && state.votes[mySeat] == null) mode = 'vote'
  if (live && ph === 'hunter' && state.hunter === mySeat && state.shot == null) mode = 'shoot'

  const canPick = (seat) => {
    if (!state.alive[seat] || !mode || mode === 'sleep') return false
    if (mode === 'wolf') return true // 0086: được cắn bất kỳ ai còn sống, kể cả đồng đội Sói và chính mình
    if (mode === 'guard') return seat !== guarded
    if (mode === 'cupid') return true
    if (mode === 'witch') return seat !== mySeat && potions?.[2] === 1
    return seat !== mySeat
  }
  const key = ph + ':' + state.night
  const cur = sel.key === key ? sel : { key, picks: [], curse: false }
  const picks = cur.picks.filter(canPick)
  // Ô nguyền: Sói nguyền còn lượt và chưa chọn trúng Sói (mates gồm cả chính mình).
  const curseOk = mode === 'wolf' && role === CURSED && curseLeft && !mates.includes(picks[0]) && picks[0] !== mySeat
  const toggle = (seat) => {
    const max = mode === 'cupid' ? 2 : 1
    const next = picks.includes(seat) ? picks.filter((x) => x !== seat) : picks.length < max ? [...picks, seat] : [...picks.slice(1), seat]
    setSel({ ...cur, picks: next })
  }
  const send = async (move) => {
    setBusy(true)
    try { await onMove(move) } finally { setBusy(false) }
  }

  const tally = ph === 'day' ? tallyOf(state) : {}
  const dark = live && (ph === 'night' || ph === 'witch')
  const title = state.over ? t('games.masoi.win.' + state.over.team)
    : result ? t('games.masoi.skyOver')
    : ph === 'day' ? t('games.masoi.skyDay', { n: state.night })
      : ph === 'hunter' ? t('games.masoi.skyHunter')
        : ph === 'witch' ? t('games.masoi.skyWitch', { n: state.night })
          : t('games.masoi.skyNight', { n: state.night })

  const counts = {}
  // Bộ vai của phòng (tự chọn hoặc bảng tự động — 0087), không phải ai còn sống.
  if (state.n) (deckOf(state.opts, state.n).deck || tableOf(state.n)).forEach((r) => { counts[r] = (counts[r] || 0) + 1 })

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Sky dark={dark} witch={live && ph === 'witch'} title={title} clock={secs != null ? Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') : null} />

      {/* Vai của mình */}
      {seated && (
        <div style={{ ...S.panel, gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'start' }}>
          <RoleIcon role={role} size={56} dead={!state.alive[mySeat]} />
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            {mine
              ? (
                <>
                  <span style={S.label}>{t('games.masoi.myRole')}: <b style={{ color: INK[role] }}>{roleName(role)}</b></span>
                  <span style={S.caption}>{t('games.masoi.roleDesc.' + ROLE_IDS[role])}</span>
                  {turned != null && <span style={S.fact}>{t('games.masoi.factTurned', { n: turned })}</span>}
                  {isWolf(role) && mates.length > 1 && (
                    <span style={S.fact}>{t('games.masoi.factMates', { names: mates.filter((x) => x !== mySeat).map(nameOf).join(', ') })}</span>
                  )}
                  {role === CURSED && <span style={S.fact}>{t(curseLeft ? 'games.masoi.factCurseLeft' : 'games.masoi.factCurseUsed')}</span>}
                  {of(F.PICK).map(([, w, x]) => <span key={'p' + w} style={S.fact}>{t('games.masoi.factPick', { wolf: nameOf(w), name: nameOf(x) })}</span>)}
                  {of(F.SEEN).map(([, x, w]) => (
                    <span key={'s' + x} style={S.fact}>{t(w ? 'games.masoi.factSeenWolf' : 'games.masoi.factSeenGood', { name: nameOf(x) })}</span>
                  ))}
                  {role === GUARD && guarded >= 0 && <span style={S.fact}>{t('games.masoi.factGuarded', { name: nameOf(guarded) })}</span>}
                  {role === WITCH && potions && <span style={S.fact}>{t('games.masoi.factPotions', { heal: potions[1], poison: potions[2] })}</span>}
                  {role === WITCH && bitten != null && (
                    <span style={{ ...S.fact, color: 'var(--status-incident-fg)' }}>
                      {bitten >= 0 ? t('games.masoi.factBitten', { name: nameOf(bitten) }) : t('games.masoi.factBittenNone')}
                    </span>
                  )}
                  {lovers.length === 2 && <span style={S.fact}>{t('games.masoi.factLovers', { a: nameOf(lovers[0]), b: nameOf(lovers[1]) })}</span>}
                </>
              )
              : got?.failed
                ? (
                  <>
                    <span style={S.caption}>{t('games.masoi.roleFailed')}</span>
                    <div><Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((n) => n + 1)}>{t('games.masoi.retry')}</Button></div>
                  </>
                )
                : <span style={S.caption}>{t('games.masoi.roleLoading')}</span>}
          </div>
        </div>
      )}

      {/* Việc cần làm */}
      {live && (
        <div style={{ ...S.panel, justifyItems: 'center', textAlign: 'center' }} aria-live="polite">
          {mode === 'sleep' && (
            <>
              <span style={S.caption}>{t(ph === 'witch' ? 'games.masoi.actSleepWitch' : 'games.masoi.actSleep')}</span>
              <Button icon="moon" disabled={busy} onClick={() => send({ night: {} })}>{t(ph === 'witch' ? 'games.masoi.sleepAgain' : 'games.masoi.sleep')}</Button>
            </>
          )}
          {['wolf', 'seer', 'guard', 'cupid', 'vote', 'shoot'].includes(mode) && (
            <>
              <span style={S.label}>{t('games.masoi.act.' + mode)}</span>
              {mode === 'shoot' && <span style={S.caption}>{t('games.masoi.hunterHint')}</span>}
              <span style={S.mono}>{picks.length ? picks.map(nameOf).join(' ♥ ') : t('games.masoi.pickHint')}</span>
              {/* Đang chọn đồng đội / chính mình thì nguyền chắc chắn vô tác dụng (0086) — ẩn ô, không gửi curse. */}
              {curseOk && (
                <label style={{ ...S.caption, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={cur.curse} onChange={(e) => setSel({ ...cur, picks, curse: e.target.checked })} />
                  {t('games.masoi.useCurse')}
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button disabled={busy || picks.length !== (mode === 'cupid' ? 2 : 1)}
                  onClick={() => send(
                    mode === 'vote' ? { vote: picks[0] }
                      : mode === 'shoot' ? { shoot: picks[0] }
                        : mode === 'cupid' ? { night: { pair: picks } }
                          : { night: { target: picks[0], ...(curseOk && cur.curse ? { curse: true } : {}) } },
                  )}>
                  {t('games.masoi.do.' + mode)}
                </Button>
                {mode === 'vote' && <Button variant="secondary" disabled={busy} onClick={() => send({ vote: -1 })}>{t('games.masoi.skipVote')}</Button>}
                {mode === 'shoot' && <Button variant="secondary" disabled={busy} onClick={() => send({ shoot: -1 })}>{t('games.masoi.noShoot')}</Button>}
              </div>
            </>
          )}
          {mode === 'witch' && (
            <>
              <span style={S.label}>{t('games.masoi.act.witch')}</span>
              <span style={S.caption}>{bitten >= 0 ? t('games.masoi.factBitten', { name: nameOf(bitten) }) : t('games.masoi.factBittenNone')}</span>
              {potions?.[2] === 1 && <span style={S.mono}>{picks.length ? t('games.masoi.poisonPick', { name: nameOf(picks[0]) }) : t('games.masoi.poisonHint')}</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {potions?.[1] === 1 && bitten >= 0 && (
                  <Button disabled={busy} onClick={() => send({ night: { heal: true } })}>{t('games.masoi.heal', { name: nameOf(bitten) })}</Button>
                )}
                {potions?.[2] === 1 && (
                  <Button variant="secondary" disabled={busy || picks.length !== 1} onClick={() => send({ night: { poison: picks[0] } })}>{t('games.masoi.poison')}</Button>
                )}
                <Button variant="secondary" disabled={busy} onClick={() => send({ night: {} })}>{t('games.masoi.skipPotion')}</Button>
              </div>
            </>
          )}
          {!mode && (
            <span style={S.caption}>
              {!seated ? t('games.masoi.spectate')
                : ready && !dark ? t('games.masoi.settling')
                  : ph === 'hunter' ? t('games.masoi.hunterWait', { name: nameOf(state.hunter) })
                    : !alive ? t('games.masoi.deadWatch')
                      : !mine ? t('games.masoi.roleLoading')
                        : ph === 'day' ? t(state.votes[mySeat] === -1 ? 'games.masoi.youSkipped' : 'games.masoi.youVoted', { name: nameOf(state.votes[mySeat]) })
                          : t('games.masoi.waitDawn')}
            </span>
          )}
          {ph === 'day' && tally[-1] > 0 && <span style={S.mono}>{t('games.masoi.skipVotes', { n: tally[-1] })}</span>}
        </div>
      )}

      {/* Người chơi — bấm thẻ để chọn */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))' }}>
        {state.alive.map((on, seat) => {
          const can = canPick(seat)
          const picked = picks.includes(seat)
          const tags = [t('games.masoi.mark' + seat)]
          if (seat === mySeat) tags.push(t('games.masoi.you'))
          if (!on) tags.push(t(state.left[seat] ? 'games.masoi.leftTag' : 'games.masoi.deadTag'))
          // Ban đêm chỉ hiện "đã xong" của chính mình — người cuối cùng chưa xong chính là người có vai.
          else if (seat === mySeat && dark && state.acted[seat]) tags.push(t('games.masoi.actedTag'))
          if (seen[seat] === 0) tags.push(t('games.masoi.goodTag'))
          if (lovers.includes(seat)) tags.push('♥')
          if (picksOf(seat)) tags.push(t('games.masoi.bitTag', { n: picksOf(seat) }))
          if (ph === 'day' && live && state.votes[seat] != null) tags.push('→ ' + (state.votes[seat] === -1 ? t('games.masoi.skipVote') : nameOf(state.votes[seat])))
          const Tag = can ? 'button' : 'div'
          return (
            <Tag key={seat} type={can ? 'button' : undefined} onClick={can ? () => toggle(seat) : undefined} aria-pressed={can ? picked : undefined}
              style={{
                ...S.seat, cursor: can ? 'pointer' : 'default', opacity: on ? 1 : 0.6,
                borderColor: picked ? 'var(--border-focus-color)' : can ? 'var(--border-default)' : 'var(--border-subtle)',
                background: picked ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                boxShadow: picked ? '0 0 0 2px var(--border-focus-color)' : 'none',
              }}>
              <RoleIcon role={roleOf(seat)} size={36} dead={!on} />
              <span style={{ display: 'grid', gap: 2, minWidth: 0, textAlign: 'left' }}>
                <span style={S.name}>{nameOf(seat)}</span>
                <span style={S.mono}>{tags.join(' · ')}</span>
              </span>
              {tally[seat] > 0 && <span style={S.badge}>{tally[seat]}</span>}
            </Tag>
          )
        })}
      </div>

      {/* Bộ vai của ván + diễn biến */}
      <div style={{ ...S.panel, gap: 8 }}>
        <span style={S.label}>{t('games.masoi.inGame')}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[WOLF, CURSED, SEER, GUARD, WITCH, HUNTER, ELDER, CUPID, VILLAGER].filter((r) => counts[r]).map((r) => (
            <span key={r} style={S.chip}>
              <RoleIcon role={r} size={18} />
              {roleName(r)}{counts[r] > 1 ? ' ×' + counts[r] : ''}
            </span>
          ))}
        </div>
        {state.events.length > 0 && (
          <>
            <span style={S.label}>{t('games.masoi.log')}</span>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>
              {[...state.events].reverse().map((e, k) => <li key={state.events.length - k} style={S.caption}>{eventText(e, nameOf, state.shown)}</li>)}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}

/** Một dòng diễn biến. Vai đã lộ thì ghi kèm. */
function eventText(e, nameOf, shown) {
  const who = (x) => nameOf(x) + (shown[x] != null ? ' (' + roleName(shown[x]) + ')' : '')
  const list = (xs) => xs.map(who).join(', ')
  const extra = (xs) => (xs.length ? ' ' + t('games.masoi.evAlso', { names: list(xs) }) : '')
  if (e.k === 'out') return t('games.masoi.evOut', { name: nameOf(e.seat) })
  if (e.k === 'settle') return t('games.masoi.evSettle', { names: list(e.dead) })
  if (e.k === 'dawn') return e.dead.length ? t('games.masoi.evDawn', { n: e.night, names: list(e.dead) }) : t('games.masoi.evDawnNone', { n: e.night })
  if (e.k === 'hang') {
    if (e.seat < 0) return t('games.masoi.evHangNone', { n: e.night })
    return t('games.masoi.evHang', { n: e.night, name: who(e.seat) }) + extra(e.dead.filter((x) => x !== e.seat))
  }
  if (e.target < 0) return t('games.masoi.evShotNone', { name: nameOf(e.seat) })
  return t('games.masoi.evShot', { name: nameOf(e.seat), target: who(e.target) }) + extra(e.dead.filter((x) => x !== e.target))
}

const S = {
  panel: { display: 'grid', gap: 10, padding: 14, borderRadius: 12, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  fact: { font: '500 13px/1.35 var(--font-sans)', color: 'var(--text-secondary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)', overflowWrap: 'anywhere' },
  name: { font: '600 13.5px/1.25 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  seat: {
    position: 'relative', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8, alignItems: 'center',
    padding: '8px 10px', borderRadius: 12, border: '1px solid', font: 'inherit', color: 'inherit', textAlign: 'left',
    transition: 'border-color var(--dur-fast), background var(--dur-fast), box-shadow var(--dur-fast)',
  },
  badge: {
    position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center',
    padding: '0 6px', background: 'var(--status-incident)', color: W, font: '700 12px/1 var(--font-mono)',
  },
  chip: {
    display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 9px 3px 4px', borderRadius: 99,
    border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', font: 'var(--type-caption)', color: 'var(--text-secondary)',
  },
  skyClock: { position: 'absolute', right: 14, bottom: 8, font: '700 15px/1 var(--font-mono)', textShadow: '0 1px 2px color-mix(in srgb, var(--navy-950) 35%, transparent)' },
  skyTitle: { position: 'absolute', left: 14, top: 10, font: '700 17px/1.2 var(--font-display)', textShadow: '0 1px 2px color-mix(in srgb, var(--navy-950) 35%, transparent)' },
}
