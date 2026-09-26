import { useEffect, useReducer, useRef, useState } from 'react'
import { Button, Dialog, Input } from '#ds'
import { Mono } from '#ui'
import { useMobile } from '#hooks/useMobile.js'
import { boardReducer, boardView, emptyBoard, parseDraft } from '#lib/tournament/scoreboard.js'
import { matchWinner } from '#lib/tournament/scoring.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'
import { draftKey, matchCode, ruleLabel, teamName } from './tourUtils.js'

// localStorage có thể bị chặn (private mode) — nháp chỉ là tiện ích, hỏng thì bỏ qua.
const readDraft = (id) => { try { return parseDraft(localStorage.getItem(draftKey(id))) } catch { return emptyBoard() } }
const writeDraft = (id, s) => { try { localStorage.setItem(draftKey(id), JSON.stringify({ sets: s.sets, cur: s.cur, swapped: s.swapped })) } catch { /* bỏ qua */ } }
const dropDraft = (id) => { try { localStorage.removeItem(draftKey(id)) } catch { /* bỏ qua */ } }

/**
 * Ghi điểm một trận (handoff "GHI ĐIỂM"): Ghi từng quả · Nhập tỷ số · Xử thua / Bỏ cuộc.
 * onCommit({ sets, winner, status, note }) → true khi chốt được (đội thắng lên vòng sau).
 */
export function ScoreDialog({ match, tour, db, onClose, onCommit, onStart, onCourt }) {
  const isMobile = useMobile(768)
  const [tab, setTab] = useState('live')
  const names = { A: teamName(tour, db, match.teamAId), B: teamName(tour, db, match.teamBId) }
  const event = tour.events.find((e) => e.id === match.eventId)
  const commit = async (payload) => {
    const ok = await onCommit(payload)
    if (ok) { dropDraft(match.id); onClose() }
    return ok
  }

  return (
    <Dialog
      open
      sheet={isMobile}
      width={760}
      title={t('tournament.sb.title', { code: matchCode(match), event: event ? t('tournament.kind.' + event.kind) : '' })}
      description={ruleLabel(match.rule)}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Seg options={['live', 'manual', 'walkover'].map((k) => ({ key: k, label: t('tournament.sb.tab.' + k) }))} value={tab} onChange={setTab} />
        {tour.courtLabels.length > 0 && (match.status === 'ready' || match.status === 'live') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.bracket.court')}</span>
            <Seg options={tour.courtLabels.map((c) => ({ key: c, label: c }))} value={match.courtLabel || null} onChange={onCourt} />
          </div>
        )}
        {tab === 'live' && <LiveBoard match={match} names={names} isMobile={isMobile} onCommit={commit} onStart={onStart} />}
        {tab === 'manual' && <ManualEntry match={match} names={names} onCommit={commit} />}
        {tab === 'walkover' && <WalkoverEntry match={match} names={names} onCommit={commit} />}
      </div>
    </Dialog>
  )
}

/** Ghi từng quả: ô điểm lớn chạm để +1, phím A / L / Z, tự chốt set và đổi sân, nháp lưu trên máy. */
function LiveBoard({ match, names, isMobile, onCommit, onStart }) {
  const rule = match.rule
  const [s, dispatch] = useReducer((st, act) => boardReducer(st, act, rule), match.id, readDraft)
  const [busy, setBusy] = useState(false)
  const started = useRef(match.status === 'live')
  const v = boardView(s, rule)

  useEffect(() => { writeDraft(match.id, s) }, [match.id, s])

  const point = (side) => {
    if (!started.current) { started.current = true; onStart(match) } // quả đầu → trận chuyển "đang đánh"
    dispatch({ type: 'point', side })
  }
  const pointRef = useRef(point)
  useEffect(() => { pointRef.current = point })
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      const left = s.swapped ? 'B' : 'A'
      if (k === 'a') pointRef.current(left)
      else if (k === 'l') pointRef.current(left === 'A' ? 'B' : 'A')
      else if (k === 'z') dispatch({ type: 'undo' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.swapped])

  const order = s.swapped ? ['B', 'A'] : ['A', 'B'] // đổi sân = đổi bên hiển thị
  const status = v.winner ? endedLine(s.sets, v.winner, names)
    : v.justSwitched ? t('tournament.sb.switched', { n: s.sets.length })
      : t('tournament.sb.playing', { n: v.setNo })
  const confirm = async () => {
    setBusy(true)
    const ok = await onCommit({ sets: s.sets, winner: v.winner, status: 'done' })
    if (!ok) setBusy(false)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {s.sets.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {s.sets.map((x, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 6, padding: '5px 9px', borderRadius: 99, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
              <Mono size={11} color="var(--text-muted)">{t('tournament.sb.set', { n: i + 1 })}</Mono>
              <Mono size={12} weight={700} color="var(--text-primary)">{x[0]}–{x[1]}</Mono>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {order.map((side) => {
          const i = side === 'A' ? 0 : 1
          const won = s.sets.filter((x) => (x[0] > x[1]) === (side === 'A')).length
          const flag = v.flags && (v.flags.matchPoint[side] ? 'matchPoint' : v.flags.setPoint[side] ? 'setPoint' : null)
          return (
            <div key={side} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'var(--surface-inset)', border: `1px solid ${v.winner === side ? 'var(--teal-500)' : 'var(--border-subtle)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                <span style={{ flex: 1, minWidth: 0, font: '600 13px/1.25 var(--font-sans)', color: 'var(--text-primary)' }}>{names[side]}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.ceil(rule.sets / 2) }, (_, k) => (
                    <span key={k} style={{ width: 8, height: 8, borderRadius: 99, background: k < won ? 'var(--teal-500)' : 'var(--surface-sunken)' }} />
                  ))}
                </span>
              </div>
              <button
                type="button"
                disabled={Boolean(v.winner)}
                aria-label={names[side] + ' +1'}
                onClick={() => point(side)}
                style={{
                  display: 'grid', placeItems: 'center', gap: 4, minHeight: isMobile ? 150 : 170, borderRadius: 10, cursor: v.winner ? 'default' : 'pointer',
                  background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                }}
              >
                <span style={{ font: `700 ${isMobile ? 64 : 80}px/1 var(--font-display)` }}>{s.cur[i]}</span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.sb.plusHint')}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
                <Button size="sm" variant="secondary" disabled={s.cur[i] === 0} onClick={() => dispatch({ type: 'minus', side })}>{t('tournament.sb.minus')}</Button>
                <span style={{ flex: 1 }} />
                {flag && <Mono size={11} weight={700} color="var(--status-delayed-fg)">{t('tournament.sb.' + flag)}</Mono>}
                {!flag && v.flags?.deuce && <Mono size={11} weight={700} color="var(--text-muted)">{t('tournament.sb.deuce')}</Mono>}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ font: '600 13px/1.4 var(--font-sans)', color: v.winner ? 'var(--status-transit-fg)' : 'var(--text-secondary)', textAlign: 'center' }}>{status}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="secondary" icon="undo-2" disabled={!s.history.length} onClick={() => dispatch({ type: 'undo' })}>{t('tournament.sb.undo')}</Button>
        {!isMobile && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.sb.keys')}</span>}
        <span style={{ flex: 1 }} />
        <Button icon="arrow-up-right" disabled={!v.winner} loading={busy} onClick={confirm}>{t('tournament.sb.confirm')}</Button>
      </div>
    </div>
  )
}

/** Các set nhập tay: [[a, b], …] dạng chuỗi đang gõ. `max` = số set tối đa của luật. */
function SetsInput({ rows, setRows, max, names }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 8, font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
        <span />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.A}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.B}</span>
      </div>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 8, alignItems: 'center' }}>
          <Mono size={12} color="var(--text-muted)">{t('tournament.sb.set', { n: i + 1 })}</Mono>
          {[0, 1].map((j) => (
            <Input key={j} mono inputMode="numeric" size="sm" aria-label={t('tournament.sb.set', { n: i + 1 }) + ' ' + (j ? names.B : names.A)}
              value={rows[i]?.[j] ?? ''}
              onChange={(e) => setRows((r) => {
                const next = Array.from({ length: max }, (_, k) => [...(r[k] || ['', ''])])
                next[i][j] = e.target.value.replace(/\D/g, '')
                return next
              })} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Hàng đã gõ đủ hai ô → [[a, b], …] (bỏ hàng trống ở cuối). */
const toSets = (rows) => rows.filter((r) => r && r[0] !== '' && r[1] !== '' && r[0] != null && r[1] != null).map((r) => [Number(r[0]), Number(r[1])])

function ManualEntry({ match, names, onCommit }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const sets = toSets(rows)
  const w = matchWinner(sets, match.rule)
  const winner = w === 'A' || w === 'B' ? w : null
  const submit = async () => {
    setBusy(true)
    if (!(await onCommit({ sets, winner: winner || 'A', status: 'done' }))) setBusy(false)
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.sb.manualHint', { n: match.rule.sets })}</span>
      <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} />
      {winner && <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--status-transit-fg)' }}>{endedLine(sets, winner, names)}</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon="arrow-up-right" disabled={!sets.length} loading={busy} onClick={submit}>{t('tournament.sb.confirm')}</Button>
      </div>
    </div>
  )
}

function WalkoverEntry({ match, names, onCommit }) {
  const [status, setStatus] = useState('walkover')
  const [winner, setWinner] = useState(null)
  const [note, setNote] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    const ok = await onCommit({ status, winner, note: note.trim(), sets: status === 'retired' ? toSets(rows) : [] })
    if (!ok) setBusy(false)
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Seg options={['walkover', 'retired'].map((k) => ({ key: k, label: t('tournament.sb.wo.' + k) }))} value={status} onChange={setStatus} />
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.sb.wo.winner')}</span>
        <Seg options={['A', 'B'].map((k) => ({ key: k, label: names[k] }))} value={winner} onChange={setWinner} size={36} />
      </div>
      <Input label={t('tournament.sb.wo.note')} placeholder={t('tournament.sb.wo.notePh')} value={note} onChange={(e) => setNote(e.target.value)} />
      {status === 'retired' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.sb.wo.retiredSets')}</span>
          <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon="arrow-up-right" disabled={!winner || !note.trim()} loading={busy} onClick={submit}>{t('tournament.sb.confirm')}</Button>
      </div>
    </div>
  )
}

/** Sửa điểm trận đã xong — đội thắng giữ nguyên (đổi đội thắng = Hoàn tác rồi chốt lại). */
export function EditScoreDialog({ match, tour, db, onClose, onSave }) {
  const names = { A: teamName(tour, db, match.teamAId), B: teamName(tour, db, match.teamBId) }
  const [rows, setRows] = useState(() => match.sets.map((x) => [String(x[0]), String(x[1])]))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    if (await onSave(toSets(rows), reason.trim())) onClose()
    else setBusy(false)
  }
  return (
    <Dialog open width={520} title={t('tournament.editDlg.title', { code: matchCode(match) })} description={t('tournament.editDlg.hint')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} disabled={!reason.trim()} onClick={submit}>{t('common.save')}</Button>
        </>
      )}>
      <div style={{ display: 'grid', gap: 14 }}>
        <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} />
        <Input label={t('tournament.editDlg.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Dialog>
  )
}

export function UndoDialog({ match, onClose, onUndo }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    if (await onUndo(reason.trim())) onClose()
    else setBusy(false)
  }
  return (
    <Dialog open width={460} title={t('tournament.undoDlg.title', { code: matchCode(match) })} description={t('tournament.undoDlg.body')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" icon="undo-2" loading={busy} disabled={!reason.trim()} onClick={submit}>{t('tournament.bracket.undo')}</Button>
        </>
      )}>
      <Input label={t('tournament.undoDlg.reason')} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </Dialog>
  )
}

/** Câu kết trận (handoff): "Kết thúc · X thắng 2–1 sec (21–18, 19–21, 15–12)" — rồi mới bấm xác nhận. */
function endedLine(sets, winner, names) {
  const won = sets.filter(([a, b]) => (winner === 'A' ? a > b : b > a)).length
  return t('tournament.bracket.ended', {
    name: names[winner], w: won, l: sets.length - won, sets: sets.map(([a, b]) => `${a}–${b}`).join(', '),
  })
}
