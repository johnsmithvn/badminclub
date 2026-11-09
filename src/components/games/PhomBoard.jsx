import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import ph, { bestLay, cover, faceOf, meldOk, pendingOf, pointsOf, RANK_FACES, rankOf, sendsFor, SUIT_MARKS, suitOf, uOf } from '#lib/games/phom.js'

/**
 * Bàn Phỏm: người khác (số lá, chồng bài đã đánh, lá đã ăn, phỏm đã hạ), lá vừa đánh + nọc ở giữa, bài trên tay mình.
 *   - Tới lượt lấy bài: Ăn (chỉ sáng khi lá đó ghép được phỏm với tay mình) hoặc Bốc.
 *   - Tới lượt đánh: chạm một lá rồi Đánh; lá đang giữ phỏm cho lá đã ăn bị khoá. Đủ phỏm thì hiện nút Ù.
 *   - Lượt cuối: khung Hạ phỏm — app xếp sẵn cách ít điểm rác nhất + gợi ý gửi bài; bỏ phỏm bằng ×, hoặc chọn lá rồi
 *     Ghép phỏm; bỏ chọn gửi từng lá. Không có phỏm thì hạ là móm.
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay mình, hết
 * ván trả mọi tay để lật bài) — nạp lại sau mỗi nước. Luật: lib/games/phom.js · server kiểm lại từng nước: 0090.
 */
const RED = 'var(--status-incident-fg)'
const byNum = (a, b) => a - b
const ptsOf = (cards) => cards.reduce((a, c) => a + pointsOf(c), 0)

function Card({ c, on, small, tiny, mark, dim, onPick }) {
  const w = tiny ? 24 : small ? 32 : 44
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-pressed={onPick ? !!on : undefined}
      aria-label={faceOf(c) + (mark ? ' · ' + mark : '')}
      style={{
        position: 'relative', width: w, height: Math.round(w * 1.42), padding: 0, flexShrink: 0, borderRadius: tiny ? 4 : small ? 5 : 7,
        display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1,
        background: 'var(--surface-card)', color: suitOf(c) >= 2 ? RED : 'var(--text-primary)',
        border: '1.5px solid ' + (on ? 'var(--border-focus-color)' : mark ? 'var(--status-transit)' : 'var(--border-default)'),
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)', opacity: dim ? 0.45 : 1,
        transform: on ? 'translateY(-10px)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard), opacity var(--dur-fast)',
        font: (tiny ? '600 10px' : small ? '600 12px' : '600 15px') + '/1 var(--font-mono)', cursor: onPick ? 'pointer' : 'default',
        touchAction: 'manipulation',
      }}
    >
      <span>{RANK_FACES[rankOf(c)]}</span>
      <span style={{ fontSize: tiny ? 10 : small ? 12 : 16 }}>{SUIT_MARKS[suitOf(c)]}</span>
      {mark && !tiny && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -7, right: -7, padding: '2px 4px', borderRadius: 99, font: '600 9px/1 var(--font-sans)',
          background: 'var(--status-transit-bg)', color: 'var(--status-transit-fg)', border: '1px solid var(--status-transit)',
        }}>{mark}</span>
      )}
    </button>
  )
}

const Row = ({ cards, ...p }) => (
  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', minWidth: 0 }}>{cards.map((c) => <Card key={c} c={c} {...p} />)}</div>
)

/** Các phỏm đã hạ — mỗi phỏm một cụm, lá gửi vào vẫn nằm trong cụm. */
const Melds = ({ melds, tiny }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
    {melds.map((m) => (
      <div key={m.join()} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 6, background: 'var(--status-delivered-bg)' }}>
        {m.map((c) => <Card key={c} c={c} tiny={tiny} small={!tiny} />)}
      </div>
    ))}
  </div>
)

export default function PhomBoard({ state, mySeat, onMove, roomId, result, players }) {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
  const [dealt, setDealt] = useState(null) // { roomId, ply, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [pick, setPick] = useState({ ply: -1, c: null })
  // Khung hạ: phỏm đang chọn + lá đang chọn để ghép + lá gửi bị bỏ chọn — gắn với số nước để sang nước mới tự làm lại.
  const [plan, setPlan] = useState({ ply: -1, melds: null, sel: [], skip: [] })

  const seated = mySeat != null
  const reveal = !!result
  const ply = state.ply
  useEffect(() => {
    if (!seated && !reveal) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setDealt({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setDealt({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, reveal, tries, ply])

  const mine = dealt?.roomId === roomId ? dealt : null
  const hand = seated ? (mine?.hands?.[mySeat] || []).slice().sort(byNum) : []
  const nameOf = (seat) => {
    const id = players?.find((p) => p.seat === seat)?.memberId
    return db.members.find((m) => m.id === id)?.name || t('games.phom.mark' + seat)
  }
  const n = state.n
  const myTurn = seated && !state.over && state.turn === mySeat
  const pend = seated ? pendingOf(state, mySeat) : []
  const non = hand.filter((c) => !pend.includes(c))
  // Bài tải về có thể trễ một nhịp so với log — chỉ cho bấm khi số lá khớp.
  const synced = seated && hand.length === state.counts[mySeat]
  const canEat = myTurn && synced && state.step === 'take' && state.last && cover(non, [...pend, state.last.card])
  const uMelds = myTurn && synced && (state.step === 'discard' || state.step === 'lay') && !state.melds[mySeat] ? uOf(hand, pend) : null
  const freeOf = (c) => !pend.includes(c) && cover(non.filter((x) => x !== c), pend)
  const sel = pick.ply === ply ? pick.c : null

  // Khung hạ (lượt cuối).
  const laying = myTurn && synced && state.step === 'lay'
  const myPlan = plan.ply === ply ? plan : { ply, melds: laying ? bestLay(hand, pend) || [] : [], sel: [], skip: [] }
  const used = myPlan.melds.flat()
  const rest = hand.filter((c) => !used.includes(c))
  // Lá gửi được (để bật / tắt) và lá sẽ gửi thật: tính lại sau khi bỏ lá đã tắt — dây nối dần (5 rồi 6) bỏ 5 thì 6 tự rơi.
  const canSend = myPlan.melds.length ? sendsFor(rest, state.melds, mySeat) : []
  const sends = myPlan.melds.length ? sendsFor(rest.filter((c) => !myPlan.skip.includes(c)), state.melds, mySeat) : []
  while (used.length + sends.length > hand.length - 1) sends.pop()
  const layMove = { lay: myPlan.melds, send: sends }
  const layErr = laying ? ph.validate(state, mySeat, layMove) : null
  const groupOk = meldOk(myPlan.sel) && myPlan.sel.filter((c) => pend.includes(c)).length <= 1
  const setMine = (p) => setPlan({ ...myPlan, ...p, ply })

  const last = state.last
  const act = state.act

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Người khác */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${Math.min(Math.max(n - (seated ? 1 : 0), 1), isMobile ? 1 : 3)}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, seat) => seat).filter((seat) => seat !== mySeat).map((seat) => {
          const on = state.turn === seat
          const eaten = state.eaten.filter((e) => e.by === seat)
          const tag = state.out[seat] ? t('games.phom.outTag') : state.melds[seat] ? (state.mom[seat] ? t('games.phom.momTag') : t('games.phom.laidTag')) : null
          return (
            <div key={seat} style={{
              ...S.seat, borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)', opacity: state.out[seat] ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ ...S.name, flex: 1 }} title={nameOf(seat)}>{nameOf(seat)}</span>
                <span style={S.mono}>{t('games.phom.cards', { n: state.counts[seat] })}{tag ? ' · ' + tag : ''}</span>
              </div>
              {state.piles[seat].length > 0 && (
                <div style={S.line}><span style={S.small}>{t('games.phom.pile')}</span><Row cards={state.piles[seat]} tiny /></div>
              )}
              {eaten.length > 0 && !state.melds[seat] && (
                <div style={S.line}><span style={S.small}>{t('games.phom.eaten')}</span><Row cards={eaten.map((e) => e.card)} tiny /></div>
              )}
              {state.melds[seat]?.length > 0 && <Melds melds={state.melds[seat]} tiny />}
            </div>
          )
        })}
      </div>

      {/* Giữa bàn: lá vừa đánh + nọc */}
      {!state.over && (
        <div style={S.table} aria-live="polite">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              {last
                ? <div key={ply} style={{ animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}><Card c={last.card} mark={last.chot ? t('games.phom.chotTag') : null} /></div>
                : <div style={{ ...S.slot }} />}
              <span style={S.small}>{last ? t('games.phom.lastBy', { side: nameOf(last.seat) }) : t('games.phom.noLast')}</span>
            </div>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <div style={S.stock} aria-hidden="true"><span style={S.stockNum}>{state.stock}</span></div>
              <span style={S.small}>{t('games.phom.stock', { n: state.stock })}</span>
            </div>
          </div>
          <span style={S.caption}>{actText(act, nameOf)}</span>
        </div>
      )}

      {/* Của mình: chồng đã đánh, phỏm đã hạ */}
      {seated && !state.over && (state.piles[mySeat].length > 0 || state.melds[mySeat]?.length > 0) && (
        <div style={{ display: 'grid', gap: 6 }}>
          {state.piles[mySeat].length > 0 && (
            <div style={S.line}><span style={S.small}>{t('games.phom.myPile', { n: state.piles[mySeat].length })}</span><Row cards={state.piles[mySeat]} tiny /></div>
          )}
          {state.melds[mySeat]?.length > 0 && <Melds melds={state.melds[mySeat]} />}
        </div>
      )}

      {/* Bài trên tay */}
      {seated && !state.over && !state.out[mySeat] && (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={S.caption}>{t('games.phom.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.phom.reloadHand')}</Button>
              </div>
            )
            : (
              <div role="group" aria-label={t('games.phom.handAria', { n: hand.length, pts: ptsOf(hand) })}
                style={{ display: 'flex', gap: isMobile ? 4 : 6, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 12 }}>
                {hand.map((c) => {
                  const eatenMark = pend.includes(c) ? t('games.phom.eatenTag') : null
                  if (laying) {
                    const inMeld = used.includes(c)
                    const on = myPlan.sel.includes(c)
                    return (
                      <Card key={c} c={c} small={isMobile} mark={eatenMark} on={on} dim={inMeld}
                        onPick={inMeld ? undefined : () => setMine({ sel: on ? myPlan.sel.filter((x) => x !== c) : [...myPlan.sel, c] })} />
                    )
                  }
                  const canPick = myTurn && synced && state.step === 'discard' && freeOf(c)
                  return (
                    <Card key={c} c={c} small={isMobile} mark={eatenMark} on={sel === c} dim={myTurn && state.step === 'discard' && !freeOf(c)}
                      onPick={canPick ? () => setPick({ ply, c: sel === c ? null : c }) : undefined} />
                  )
                })}
              </div>
            )}

          {myTurn && synced && (
            <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
              {uMelds && (
                <div style={{ ...S.uBox }}>
                  <span style={S.label}>{t('games.phom.uHint')}</span>
                  <Button icon="trophy" onClick={() => onMove({ u: uMelds })}>{t('games.phom.u')}</Button>
                </div>
              )}

              {state.step === 'take' && (
                <>
                  <span style={S.caption}>{last && !canEat ? t('games.phom.cantEatHint') : t('games.phom.takeHint')}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button icon="hand-coins" disabled={!canEat} onClick={() => onMove({ eat: true })}>{t('games.phom.eat')}</Button>
                    <Button variant="secondary" icon="layers" onClick={() => onMove({ draw: true })}>{t('games.phom.draw')}</Button>
                  </div>
                </>
              )}

              {state.step === 'discard' && (
                <>
                  <span style={S.caption}>{t(pend.length ? 'games.phom.pickHintEaten' : 'games.phom.pickHint')}</span>
                  <Button icon="play" disabled={sel == null} onClick={() => { const c = sel; setPick({ ply: -1, c: null }); onMove({ discard: c }) }}>
                    {sel == null ? t('games.phom.discard') : t('games.phom.discardCard', { card: faceOf(sel) })}
                  </Button>
                </>
              )}

              {laying && (
                <div style={S.layBox}>
                  <span style={S.label}>{t('games.phom.layTitle')}</span>
                  <span style={S.caption}>{t('games.phom.layHint')}</span>
                  {myPlan.melds.length
                    ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {myPlan.melds.map((m, k) => (
                          <div key={m.join()} style={{ display: 'flex', gap: 2, alignItems: 'center', padding: 4, borderRadius: 8, background: 'var(--status-delivered-bg)' }}>
                            {m.map((c) => <Card key={c} c={c} small mark={pend.includes(c) ? t('games.phom.eatenTag') : null} />)}
                            <Button size="sm" variant="ghost" icon="x" aria-label={t('games.phom.ungroup')}
                              onClick={() => setMine({ melds: myPlan.melds.filter((_, i) => i !== k) })} />
                          </div>
                        ))}
                      </div>
                    )
                    : <span style={{ ...S.caption, color: 'var(--status-delayed-fg)' }}>{t('games.phom.mom')}</span>}
                  {myPlan.sel.length > 0 && (
                    <Button size="sm" variant="secondary" icon="plus" disabled={!groupOk}
                      onClick={() => setMine({ melds: [...myPlan.melds, myPlan.sel.slice().sort(byNum)], sel: [] })}>
                      {t('games.phom.group')}
                    </Button>
                  )}
                  {canSend.length > 0 && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {canSend.map(([to, , c]) => {
                        const on = sends.some((x) => x[2] === c)
                        return (
                          <label key={c} style={{ ...S.caption, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-primary)' }}>
                            <input type="checkbox" checked={on}
                              onChange={() => setMine({ skip: myPlan.skip.includes(c) ? myPlan.skip.filter((x) => x !== c) : [...myPlan.skip, c] })} />
                            {t('games.phom.sendTo', { card: faceOf(c), side: nameOf(to) })}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <span style={S.mono}>{t('games.phom.leftPts', { n: ptsOf(rest.filter((c) => !sends.some((x) => x[2] === c))) })}</span>
                  {layErr && <span style={{ ...S.caption, color: 'var(--status-incident-fg)' }}>{t(layErr)}</span>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button icon="check" disabled={!!layErr} onClick={() => onMove(layMove)}>{t(myPlan.melds.length ? 'games.phom.lay' : 'games.phom.layMom')}</Button>
                    <Button variant="ghost" onClick={() => setPlan({ ply: -1, melds: null, sel: [], skip: [] })}>{t('games.phom.suggest')}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!myTurn && <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.phom.handPts', { n: ptsOf(hand) })}</span>}
        </div>
      )}

      {state.over && (
        <div style={{ ...S.table, placeItems: 'stretch', textAlign: 'left' }} aria-live="polite">
          <span style={S.label}>{t('games.phom.finalTitle')}</span>
          {state.u && <span style={S.caption}>{t(state.u.khan ? 'games.phom.uKhan' : state.u.tron ? 'games.phom.uTron' : 'games.phom.uWin', { side: nameOf(state.u.seat) })}</span>}
          {(result?.ranks || Array.from({ length: n }, (_, i) => i)).map((seat, pos) => {
            const sc = result?.scores?.[seat]
            const left = (mine?.hands?.[seat] || []).slice().sort(byNum)
            return (
              <div key={seat} style={{ display: 'grid', gap: 6, paddingTop: 8, borderTop: pos ? '1px solid var(--border-subtle)' : 'none', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ ...S.name, minWidth: 0 }}>
                    {result ? placeOf(pos, n) + ' · ' : ''}{nameOf(seat)}{seat === mySeat ? ' · ' + t('games.phom.you') : ''}
                    {state.mom[seat] ? ' · ' + t('games.phom.momTag') : state.out[seat] ? ' · ' + t('games.phom.outTag') : ''}
                  </span>
                  {sc != null && (
                    <span style={{ ...S.label, fontFamily: 'var(--font-mono)', color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? RED : 'var(--text-muted)' }}>
                      {t('games.phom.score', { n: sc > 0 ? '+' + sc : sc })}
                    </span>
                  )}
                </div>
                {state.melds[seat]?.length > 0 && <Melds melds={state.melds[seat]} tiny />}
                {left.length > 0 && (
                  <div style={S.line}>
                    <span style={S.small}>{t('games.phom.leftCards', { n: result?.points?.[seat] ?? ptsOf(left) })}</span>
                    <Row cards={left} tiny />
                  </div>
                )}
              </div>
            )
          })}
          <span style={S.mono}>{t(result ? 'games.phom.scoreNote' : 'games.phom.scorePending')}</span>
        </div>
      )}
    </div>
  )
}

const placeOf = (pos, n) => t(pos === n - 1 ? 'games.phom.placeLast' : 'games.phom.place' + pos)

/** Câu kể nước vừa rồi. */
function actText(act, nameOf) {
  if (!act) return ''
  const side = nameOf(act.seat)
  if (act.out) return t('games.phom.lastOut', { side })
  if (act.draw) return t('games.phom.lastDraw', { side })
  if (act.eat != null) return t(act.chot ? 'games.phom.lastEatChot' : 'games.phom.lastEat', { side, card: faceOf(act.eat), from: nameOf(act.from) })
  if (act.lay) return act.lay.length ? t('games.phom.lastLay', { side, n: act.lay.length, k: act.send.length }) : t('games.phom.lastMom', { side })
  if (act.discard != null) return t('games.phom.lastDiscard', { side, card: faceOf(act.discard) })
  return ''
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 6, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' },
  name: { font: 'var(--type-label)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  small: { font: '400 11px/1.3 var(--font-sans)', color: 'var(--text-muted)', flexShrink: 0 },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  line: { display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' },
  table: {
    minHeight: 120, borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 10, placeItems: 'center', alignContent: 'center', textAlign: 'center', gridTemplateColumns: 'minmax(0, 1fr)',
  },
  slot: { width: 44, height: 62, borderRadius: 7, border: '1.5px dashed var(--border-strong)' },
  stock: {
    width: 44, height: 62, borderRadius: 7, display: 'grid', placeItems: 'center',
    background: 'repeating-linear-gradient(45deg, var(--navy-700), var(--navy-700) 4px, var(--navy-600, var(--navy-700)) 4px, var(--navy-600, var(--navy-700)) 8px)',
    border: '2px solid var(--surface-card)', boxShadow: '3px 3px 0 var(--navy-400), var(--shadow-sm)',
  },
  stockNum: { font: '600 14px/1 var(--font-mono)', color: 'var(--gray-0)' },
  uBox: {
    display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10,
    background: 'var(--status-delivered-bg)', border: '1px solid var(--status-delivered)',
  },
  layBox: {
    display: 'grid', gap: 8, width: '100%', maxWidth: 640, padding: 12, borderRadius: 12, gridTemplateColumns: 'minmax(0, 1fr)',
    background: 'var(--surface-card)', border: '1px solid var(--border-focus-color)', boxShadow: 'var(--shadow-sm)',
  },
}
