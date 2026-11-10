import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '#ds'
import { t } from '#i18n'
import { ASKS, linkOf, normWord, VOTE_MS, wordErr } from '#lib/games/noitu.js'

// Bàn Nối từ: thứ tự lượt, chuỗi từ, đồng hồ lượt, ô gõ (phần nối có sẵn), khung duyệt từ 8 giây.
// Giờ theo SERVER (state.deadline, vote.at là giờ server ghi nước). Hết giờ thì máy mình tự báo { timeout } / { close };
// server chỉ nhận khi đúng là đã hết giờ (sớm quá thì im lặng thử lại sau). Luật: lib/games/noitu.js.

const side = (seat) => t('games.noitu.mark' + seat)

/** Đồng hồ máy, nhích 4 lần mỗi giây khi ván đang chạy. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [on])
  return now
}

/** Vòng đếm ngược: đầy = còn nguyên giờ, đỏ khi còn dưới 5 giây. */
function Ring({ left, total, size = 58 }) {
  const f = Math.max(0, Math.min(1, left / total))
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const sec = Math.max(0, Math.ceil(left / 1000))
  const ink = left < 5000 ? 'var(--status-incident)' : 'var(--status-transit)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="timer" aria-label={t('games.noitu.secondsLeft', { n: sec })}
      style={{ flexShrink: 0, display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .25s linear, stroke var(--dur-fast)' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text-primary)" style={{ font: '700 16px var(--font-mono)' }}>{sec}</text>
    </svg>
  )
}

export default function NoiTuBoard({ state, mySeat, onMove }) {
  const live = state.started && !state.over
  const now = useNow(live)
  const seated = mySeat != null
  const alive = seated && !!state.alive[mySeat]
  const v = state.vote
  const myTurn = alive && live && !v && state.turn === mySeat
  const link = linkOf(state)
  const total = state.opts.time * 1000
  const left = state.deadline != null ? state.deadline - now : 0

  // Ô gõ theo từng lượt: sang lượt khác / vừa gửi / bị bác là ô trống lại, khỏi xoá state trong effect.
  const turnKey = state.turn + ':' + state.deadline + ':' + state.asks
  const [draft, setDraft] = useState({ key: '', text: '', err: '' })
  const cur = draft.key === turnKey ? draft : { key: turnKey, text: '', err: '' }
  const submit = () => {
    const w = normWord(link + cur.text)
    const e = state.asks >= ASKS ? 'games.err.noAsks' : wordErr(state, w)
    if (e) { setDraft({ ...cur, err: t(e) }); return }
    onMove({ word: w })
  }

  // Tự báo hết giờ / hết hạn duyệt. Người trong cuộc báo trước, người khác chờ thêm chút (phòng khi máy kia đã tắt).
  // Mỗi khoảng 4 giây báo một lần nếu server chưa nhận (đồng hồ máy lệch server).
  const sent = useRef('')
  useEffect(() => {
    if (!alive || !live) return
    const due = v ? v.at + VOTE_MS + (v.seat === mySeat ? 300 : 1500)
      : state.deadline != null ? state.deadline + (state.turn === mySeat ? 300 : 2000) : null
    if (due == null || now < due) return
    const tag = state.ply + ':' + Math.floor((now - due) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove(v ? { close: true } : { timeout: true })
  }, [alive, live, v, mySeat, state.deadline, state.turn, state.ply, now, onMove])

  const chain = state.chain.slice(-8)
  const canVote = alive && v && v.seat !== mySeat && !v.yes.includes(mySeat) && !v.no.includes(mySeat)
  const last = state.last

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Thứ tự lượt */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {state.order.map((seat, k) => (
          <span key={seat} style={{ display: 'contents' }}>
            {k > 0 && <span aria-hidden="true" style={S.arrow}>›</span>}
            <span style={{
              ...S.chip,
              borderColor: state.turn === seat && live ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: state.turn === seat && live ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
              textDecoration: state.alive[seat] ? 'none' : 'line-through', opacity: state.alive[seat] ? 1 : 0.55,
            }}>
              {side(seat)}{seat === mySeat ? ' · ' + t('games.noitu.you') : ''}{state.alive[seat] ? '' : ' · ' + t('games.noitu.out')}
            </span>
          </span>
        ))}
      </div>

      {/* Chuỗi từ */}
      <div style={S.table} aria-live="polite">
        {chain.length
          ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {state.chain.length > chain.length && <span style={S.mono}>…</span>}
              {chain.map((c, k) => (
                <span key={state.chain.length - chain.length + k} style={{ display: 'contents' }}>
                  {k > 0 && <span aria-hidden="true" style={S.arrow}>→</span>}
                  <span style={k === chain.length - 1 ? S.wordBig : S.word} title={side(c.seat)}>{c.word}</span>
                </span>
              ))}
            </div>
          )
          : <span style={S.caption}>{t('games.noitu.empty')}</span>}
        {live && !v && state.fresh && state.chain.length > 0 && <span style={S.caption}>{t('games.noitu.fresh')}</span>}
        {state.verdict && (
          <span style={{ ...S.event, color: state.verdict.ok ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
            {state.verdict.ok ? t(state.verdict.dict ? 'games.noitu.verdictDict' : 'games.noitu.verdictOk', { word: state.verdict.word }) : t('games.noitu.verdictNo', { word: state.verdict.word })}
          </span>
        )}
        {(last?.timeout || last?.giveup || last?.out) && (
          <span style={{ ...S.event, color: 'var(--status-incident-fg)' }}>
            {t(last.timeout ? 'games.noitu.lastTimeout' : last.giveup ? 'games.noitu.lastGiveup' : 'games.noitu.lastOut', { side: side(last.seat) })}
          </span>
        )}
      </div>

      {/* Duyệt từ */}
      {live && v && (
        <div style={{ ...S.panel, justifyItems: 'center', textAlign: 'center' }}>
          <span style={S.caption}>{t('games.noitu.voteTitle', { side: side(v.seat) })}</span>
          <span style={{ ...S.wordBig, fontSize: 24 }}>“{v.word}”</span>
          <div style={S.bar} role="timer" aria-label={t('games.noitu.secondsLeft', { n: Math.max(0, Math.ceil((v.at + VOTE_MS - now) / 1000)) })}>
            <div style={{ ...S.barFill, width: Math.max(0, Math.min(100, ((v.at + VOTE_MS - now) / VOTE_MS) * 100)) + '%' }} />
          </div>
          <span style={S.mono}>{t('games.noitu.tally', { yes: v.yes.length, no: v.no.length })}</span>
          {canVote
            ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button icon="check" onClick={() => onMove({ vote: true })}>{t('games.noitu.accept')}</Button>
                <Button variant="secondary" onClick={() => onMove({ vote: false })}>{t('games.noitu.reject')}</Button>
              </div>
            )
            : <span style={S.caption}>{v.seat === mySeat ? t('games.noitu.waitVote') : alive ? t('games.noitu.voted') : ''}</span>}
          <span style={S.caption}>{t('games.noitu.voteRule')}</span>
        </div>
      )}

      {/* Lượt: đồng hồ + ô gõ */}
      {live && !v && (
        <div style={{ ...S.panel, gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center' }}>
          <Ring left={left} total={total} />
          {myTurn
            ? (
              <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                <span style={S.label}>{link ? t('games.noitu.linkHint', { link: link.trim() }) : t('games.noitu.freeHint')}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {link && <span style={S.prefix}>{link.trim()}</span>}
                  <Input value={cur.text} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false}
                    aria-label={t('games.noitu.inputAria')} placeholder={t(state.opts.lang === 'vi' ? 'games.noitu.placeholderVi' : 'games.noitu.placeholderEn')}
                    error={cur.err || undefined} onChange={(e) => setDraft({ key: turnKey, text: e.target.value, err: '' })}
                    containerStyle={{ flex: '1 1 140px' }} />
                  <Button type="submit" icon="play" disabled={!cur.text.trim() || state.asks >= ASKS}>{t('games.noitu.send')}</Button>
                  <Button type="button" variant="secondary" icon="flag" onClick={() => onMove({ giveup: true })}>{t('games.noitu.giveup')}</Button>
                </div>
                <span style={S.mono}>
                  {state.opts.dict === 'dict' ? t('games.noitu.dictHint')
                    : state.asks >= ASKS ? t('games.noitu.noAsksHint') : t('games.noitu.asksLeft', { n: ASKS - state.asks })}
                </span>
              </form>
            )
            : (
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <span style={S.label}>{t('games.noitu.turnOf', { side: side(state.turn) })}</span>
                <span style={S.caption}>{link ? t('games.noitu.linkHint', { link: link.trim() }) : t('games.noitu.freeHint')}</span>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

const S = {
  chip: { border: '1px solid', borderRadius: 99, padding: '5px 10px', font: 'var(--type-label)', color: 'var(--text-primary)' },
  arrow: { color: 'var(--text-muted)', font: '600 14px/1 var(--font-mono)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  event: { font: '600 13.5px/1.35 var(--font-sans)', textAlign: 'center' },
  word: { font: '500 14px/1.2 var(--font-sans)', color: 'var(--text-secondary)', padding: '4px 9px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' },
  wordBig: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 10, background: 'var(--surface-card)', border: '1.5px solid var(--border-focus-color)' },
  prefix: { font: '700 15px/1 var(--font-sans)', color: 'var(--text-accent)', padding: '9px 10px', borderRadius: 8, background: 'var(--surface-accent-soft)', flexShrink: 0 },
  panel: { display: 'grid', gap: 10, padding: 14, borderRadius: 12, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' },
  bar: { width: 'min(320px, 100%)', height: 8, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99, background: 'var(--status-transit)', transition: 'width .25s linear' },
  table: {
    minHeight: 110, borderRadius: 12, padding: 14, display: 'grid', gap: 8, placeItems: 'center', alignContent: 'center', textAlign: 'center',
    background: 'color-mix(in srgb, var(--status-transit-fg) 12%, var(--surface-inset))', border: '1px solid var(--border-subtle)',
  },
}
