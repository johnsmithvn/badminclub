import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import Card from '#components/games/PlayingCard.jsx'
import ph, { bestLay, deadlineOf, eatWith, finalOf, isPhom, pointsOf, TURNS, uOf } from '#lib/games/phom.js'

/**
 * Bàn Phỏm: ghế (số lá, lượt thứ mấy, lá đã ăn), lá rác từng người, phỏm đã hạ (bấm vào để gửi lá đang chọn),
 * bài trên tay mình (chạm để chọn) + Bốc / Ăn / Đánh / Hạ / Ù. Hết ván lật bài cả bàn, hạng + điểm server chấm.
 * Bài trên tay nạp riêng từ game_hands (RLS chỉ trả tay mình, hết ván trả mọi tay); server kiểm lại mọi nước (0090).
 * Nhóm bị khoá (lá ăn + lá ghép) server giữ kín — máy này nhớ lá ghép của mình trong sessionStorage để gợi ý hạ cho đúng;
 * mất thì coi mỗi lá ăn là một nhóm khoá, server vẫn chặn hạ sai.
 */
const RED = 'var(--status-incident-fg)'
const side = (seat) => t('games.phom.mark' + seat)
const signed = (n) => (n > 0 ? '+' + n : String(n))
const byVal = (a, b) => ((a >> 2) + 2) % 13 - ((b >> 2) + 2) % 13 || a - b // A 2 3 … K, rồi theo chất

function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

const lockKey = (roomId) => 'phom:locks:' + roomId
function readLocks(roomId) {
  try { return JSON.parse(sessionStorage.getItem(lockKey(roomId)) || '[]') } catch { return [] }
}
function saveLocks(roomId, locks) {
  try { sessionStorage.setItem(lockKey(roomId), JSON.stringify(locks)) } catch { /* không lưu được thì thôi */ }
}

export default function PhomBoard({ state, mySeat, onMove, roomId, result }) {
  const { a } = useApp()
  const { started, turn, step, over, top, last } = state
  const seated = mySeat != null && started && !state.out[mySeat]
  const reveal = !!result

  // Bài trên tay: nạp lại mỗi lần số lá của mình đổi; hết ván nạp mọi tay để lật bài.
  const key = (state.counts[mySeat] ?? 0) + ':' + reveal
  const [dealt, setDealt] = useState(null) // { key, hands } | { key, failed }
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (!started || (!seated && !reveal)) return undefined
    let on = true
    a.gameHand(roomId)
      .then((hands) => { if (on) setDealt({ key, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (on) setDealt({ key, failed: true }) })
    return () => { on = false }
  }, [a, roomId, started, seated, reveal, key, tries])
  const ready = dealt?.key === key ? dealt : null
  const hand = seated && ready?.hands ? (ready.hands[mySeat] || []).slice().sort(byVal) : null

  // Nhóm khoá của mình: lá ghép nhớ được, thiếu thì lá ăn đứng một mình. Hạ xong là hết khoá.
  const [locks, setLocks] = useState(() => readLocks(roomId))
  const eaten = seated ? state.eaten[mySeat] : []
  const myLocks = state.laid[mySeat] ? [] : eaten.map((c) => locks.find((l) => l.includes(c)) || [c])
  const isLocked = (c) => myLocks.some((l) => l.includes(c))

  // Chọn lá + nháp phỏm để hạ, theo nước: bàn sang nước khác là bỏ chọn.
  const [pick, setPick] = useState({ ply: -1, cards: [], groups: [] })
  const fresh = pick.ply === state.ply
  const sel = fresh ? pick.cards : []
  const groups = fresh ? pick.groups : []
  const setSel = (cards, gs = groups) => setPick({ ply: state.ply, cards, groups: gs })
  const toggle = (c) => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c])
  const send = (move) => { setPick({ ply: -1, cards: [], groups: [] }); onMove(move) }

  // Hết giờ lượt → { timeout }: người tới lượt báo trước, người khác chờ thêm (server kiểm giờ).
  const live = started && !over && !result
  const due = deadlineOf(state)
  const now = useNow(live && due != null)
  const [again, setAgain] = useState(0)
  useEffect(() => {
    if (!live || !seated || due == null || turn == null) return undefined
    const rank = (mySeat - turn + state.n) % state.n
    const wait = Math.max(0, due - Date.now()) + (rank === 0 ? 300 : 2000 + rank * 800)
    const fire = setTimeout(() => onMove({ timeout: true }), wait)
    const retry = setTimeout(() => setAgain((k) => k + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, due, turn, mySeat, state.n, state.ply, again, onMove])
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null

  if (!started) return <div style={S.panel}><span style={S.caption}>{t('games.phom.waiting')}</span></div>

  const myTurn = live && seated && turn === mySeat
  const free = hand ? hand.filter((c) => !isLocked(c)) : []
  // Ăn: lá đang chọn ghép được với lá rác thì dùng, không thì máy tự tìm lá ghép.
  const eatPick = myTurn && step === 'take' && top && hand
    ? (sel.length >= 2 && sel.every((c) => free.includes(c)) && isPhom([...sel, top.card]) ? sel : eatWith(hand, myLocks, top.card))
    : null
  const u = myTurn && step !== 'take' && hand && state.turns[mySeat] < TURNS && !state.laid[mySeat] ? uOf(hand, myLocks) : null
  const one = sel.length === 1 ? sel[0] : null
  const canDiscard = myTurn && step === 'discard' && one != null && !isLocked(one)
  const draftCards = groups.flat()
  const canGroup = sel.length >= 3 && isPhom(sel) && !sel.some((c) => draftCards.includes(c))
  const layMove = { lay: groups }
  const layErr = myTurn && step === 'lay' ? ph.validate(state, mySeat, layMove) : 'x'
  const sendable = (to, g) => myTurn && step === 'discard' && state.laid[mySeat] && to !== mySeat && one != null && isPhom([...g, one])

  const eat = () => {
    const next = [...locks.filter((l) => !l.includes(top.card)), [top.card, ...eatPick]]
    setLocks(next)
    saveLocks(roomId, next)
    send({ eat: true, with: eatPick })
  }
  const suggest = () => setSel([], bestLay(hand, myLocks)?.groups || [])

  // Hết ván: server chấm (result); chưa có thì tạm tính từ bài lật được.
  const final = over ? (result?.ranks ? result : ready?.hands && finalOf(state, ready.hands)) : null

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={S.label}>
          {over ? t('games.phom.final') : turn != null ? t('games.phom.turnOf', { side: side(turn), step: t('games.phom.step.' + step) }) : ''}
        </span>
        {secs != null && (
          <span role="timer" style={{ ...S.mono, color: secs <= 5 ? RED : S.mono.color }}>{t('games.phom.timeLeft', { n: secs })}</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {state.counts.map((k, seat) => {
          const on = !over && seat === turn
          const laid = state.laid[seat]
          return (
            <div key={seat} style={{
              ...S.seat, opacity: state.out[seat] ? 0.55 : 1,
              borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
            }}>
              <span style={S.seatName}>{side(seat)}{seat === mySeat ? ' · ' + t('games.phom.you') : ''}</span>
              <span style={S.mono}>
                {t('games.phom.seatInfo', { n: k, k: Math.min(state.turns[seat] + (seat === turn ? 1 : 0), TURNS) })}
                {state.out[seat] ? ' · ' + t('games.phom.stOut') : laid && !laid.length ? ' · ' + t('games.phom.mom') : ''}
                {state.u === seat ? ' · ' + t('games.phom.uTag') : ''}
              </span>
              {state.piles[seat].length > 0 && (
                <div style={S.row} aria-label={t('games.phom.pile')}>
                  {state.piles[seat].map((c) => <Card key={c} c={c} small on={top?.card === c} />)}
                </div>
              )}
              {state.eaten[seat].length > 0 && !laid && (
                <span style={S.mono}>{t('games.phom.eaten', { n: state.eaten[seat].length })}</span>
              )}
              {laid?.map((g, gi) => (
                <div key={gi} style={{ ...S.row, gap: 2 }}>
                  {sendable(seat, g)
                    ? (
                      <button type="button" style={S.group} onClick={() => send({ send: { card: one, to: seat, group: gi } })}
                        aria-label={t('games.phom.sendTo', { side: side(seat) })}>
                        {g.map((c) => <Card key={c} c={c} small />)}
                      </button>
                    )
                    : g.map((c) => <Card key={c} c={c} small />)}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {last && !over && (
        <span style={{ ...S.mono, textAlign: 'center' }}>
          {last.timeout ? t('games.phom.autoMove', { side: side(last.seat) }) + ' · ' : ''}
          {last.eat != null ? t('games.phom.lastEat', { side: side(last.seat), from: side(last.from) })
            : last.lay ? t(last.mom ? 'games.phom.lastMom' : 'games.phom.lastLay', { side: side(last.seat) })
              : last.send != null ? t('games.phom.lastSend', { side: side(last.seat), to: side(last.to) })
                : last.out ? t('games.phom.lastOut', { side: side(last.seat) }) : ''}
        </span>
      )}

      {final && (
        <div style={{ ...S.panel, placeItems: 'stretch', textAlign: 'left' }} aria-live="polite">
          {state.u != null && <span style={S.label}>{t('games.phom.uWin', { side: side(state.u) })}</span>}
          {final.ranks.map((seat, pos) => {
            const sc = final.scores?.[seat] ?? 0
            const rest = ready?.hands?.[seat]
            return (
              <div key={seat} style={{ display: 'grid', gap: 6, paddingTop: 8, borderTop: pos ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={S.label}>
                    {t('games.phom.place', { n: pos + 1 })} · {side(seat)}{seat === mySeat ? ' · ' + t('games.phom.you') : ''}
                    {final.mom?.includes(seat) ? ' · ' + t('games.phom.mom') : ''}
                  </span>
                  <span style={{ ...S.label, color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? RED : 'var(--text-muted)' }}>
                    {t('games.phom.points', { n: signed(sc) })}
                  </span>
                </div>
                {rest?.length > 0 && state.u !== seat && (
                  <div style={{ ...S.row, alignItems: 'center' }}>
                    {rest.slice().sort(byVal).map((c) => <Card key={c} c={c} small />)}
                    <span style={S.mono}>{t('games.phom.handPoints', { n: pointsOf(rest) })}</span>
                  </div>
                )}
              </div>
            )
          })}
          <span style={S.mono}>{t(result ? 'games.phom.scoreNote' : 'games.phom.scorePending')}</span>
        </div>
      )}
      {over && !final && <div style={S.panel}><span style={S.caption}>{t('games.phom.scorePending')}</span></div>}

      {live && seated && (
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {ready?.failed && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={S.caption}>{t('games.tienlen.handFailed')}</span>
              <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.tienlen.reloadHand')}</Button>
            </div>
          )}
          {groups.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }} aria-label={t('games.phom.draft')}>
              {groups.map((g, gi) => <div key={gi} style={{ ...S.row, gap: 2 }}>{g.map((c) => <Card key={c} c={c} small />)}</div>)}
            </div>
          )}
          {hand && (
            <div role="group" aria-label={t('games.phom.handAria')} style={{ ...S.row, gap: 6, justifyContent: 'center', paddingTop: 10 }}>
              {hand.filter((c) => !draftCards.includes(c)).map((c) => (
                <div key={c} style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                  <Card c={c} on={sel.includes(c)} onPick={() => toggle(c)} />
                  {isLocked(c) && <span style={{ ...S.mono, fontSize: 10 }}>{t('games.phom.lockTag')}</span>}
                </div>
              ))}
            </div>
          )}
          {hand && <span style={S.mono}>{t('games.phom.handPoints', { n: pointsOf(hand) })}</span>}

          {myTurn
            ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {step === 'take' && <Button icon="plus" onClick={() => send({ draw: true })}>{t('games.phom.draw')}</Button>}
                {step === 'take' && top && (
                  <Button variant="secondary" icon="check" disabled={!eatPick} onClick={eat}>{t('games.phom.eat')}</Button>
                )}
                {u && <Button icon="flag" onClick={() => send({ u: u.groups })}>{t('games.phom.u')}</Button>}
                {step === 'lay' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={suggest}>{t('games.phom.suggest')}</Button>
                    <Button size="sm" variant="secondary" disabled={!canGroup} onClick={() => setSel([], [...groups, sel])}>{t('games.phom.group')}</Button>
                    {groups.length > 0 && <Button size="sm" variant="secondary" onClick={() => setSel([], [])}>{t('games.phom.clearGroups')}</Button>}
                    <Button icon="check" disabled={!!layErr} onClick={() => send(layMove)}>
                      {groups.length ? t('games.phom.lay') : t('games.phom.layMom')}
                    </Button>
                  </>
                )}
                {step === 'discard' && <Button icon="play" disabled={!canDiscard} onClick={() => send({ discard: one })}>{t('games.phom.discard')}</Button>}
              </div>
            )
            : <span style={S.caption}>{turn != null ? t('games.phom.waitTurn', { side: side(turn) }) : ''}</span>}
          {myTurn && (
            <span style={S.caption}>
              {step === 'take' ? t(top ? 'games.phom.hintTake' : 'games.phom.hintDraw')
                : step === 'lay' ? (layErr && groups.length ? t('games.phom.hintLayBad') : t('games.phom.hintLay'))
                  : state.laid[mySeat] ? t('games.phom.hintSend') : t('games.phom.hintDiscard')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 6, minWidth: 0, alignContent: 'start' },
  seatName: { font: 'var(--type-label)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  row: { display: 'flex', gap: 3, flexWrap: 'wrap' },
  group: {
    display: 'flex', gap: 2, padding: 3, borderRadius: 8, cursor: 'pointer', background: 'var(--surface-accent-soft)',
    border: '1.5px dashed var(--border-focus-color)',
  },
  panel: {
    borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 8, placeItems: 'center', textAlign: 'center',
  },
}
