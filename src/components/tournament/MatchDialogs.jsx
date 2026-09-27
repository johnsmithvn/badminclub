import { useId, useMemo, useState } from 'react'
import { Button, Dialog, Input } from '#ds'
import { Mono } from '#ui'
import { useMobile } from '#hooks/useMobile.js'
import { offRule, resultWinner, validateResult } from '#lib/tournament/scoring.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'
import { draftKey, matchCode, ruleLabel, teamName } from './tourUtils.js'

const dropDraft = (id) => { try { localStorage.removeItem(draftKey(id)) } catch { /* bỏ qua */ } }

// Tab ghi điểm dùng lần trước (theo máy). Mặc định là manual (Ghi điểm kiểu sân).
const TAB_KEY = 'tour.sb.tab'
const firstTab = () => {
  try { return localStorage.getItem(TAB_KEY) === 'walkover' ? 'walkover' : 'manual' } catch { return 'manual' }
}

const S = {
  teamsChoiceGrid: {
    display: 'grid',
    gap: 10,
  },
  teamChoiceCard: {
    borderRadius: 8,
    padding: '12px',
    background: 'var(--surface-sunken)',
    border: '1.5px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 0,
    overflow: 'hidden',
  },
  teamChoiceCardWon: {
    background: 'var(--status-transit-bg)',
    borderColor: 'var(--status-transit-fg)',
  },
  wonBadge: {
    font: '600 11px/1 var(--font-sans)',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--action-accent-bg, #00B2A9)',
    color: 'var(--action-accent-fg, #04302C)',
  },
  bigScoreWon: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1.5px solid var(--action-accent-bg, #00B2A9)',
    font: '700 24px/1 var(--font-mono, monospace)',
    color: 'var(--status-transit-fg)',
  },
  bigScoreLost: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '700 24px/1 var(--font-mono, monospace)',
    color: 'var(--text-muted)',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  presetBtn: {
    minHeight: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: '600 13px/1 var(--font-mono, monospace)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  presetBtnActive: {
    background: 'var(--action-primary-bg)',
    borderColor: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
  },
  customScoreBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  customScoreHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  customScoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  customTeamCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  customTeamName: {
    font: '600 13px/1.2 var(--font-sans)',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  stepperBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: 2,
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  stepBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm, 4px)',
  },
  scoreBox: {
    width: 52,
    height: 38,
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm, 4px)',
    background: 'var(--surface-card)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    padding: 0,
    outline: 'none',
  },
  swapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md, 8px)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
    marginTop: 20,
  },
  subPresetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 4,
    borderTop: '1px solid var(--border-subtle)',
  },
  subPresetBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '600 12px/1 var(--font-mono, monospace)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
}

/**
 * Ghi điểm một trận đấu giải (dùng chung phong cách ScoreModal của sân + tab Xử thua / Bỏ cuộc).
 * onCommit({ sets, winner, status, note }) → true khi chốt được (đội thắng lên vòng sau).
 * `next` (tuỳ chọn) = trận kế trong hàng chờ → thêm nút "Chốt & trận kế".
 */
export function ScoreDialog({ match, tour, db, next, onNext, onClose, onCommit, onStart, onCourt }) {
  const isMobile = useMobile(768)
  const [tab, setTabState] = useState(() => firstTab())
  const setTab = (k) => {
    setTabState(k)
    try { localStorage.setItem(TAB_KEY, k) } catch { /* bỏ qua */ }
  }
  const names = { A: teamName(tour, db, match.teamAId), B: teamName(tour, db, match.teamBId) }
  const event = tour.events.find((e) => e.id === match.eventId)
  const chain = next && onNext ? next : null
  const commit = async (payload, goNext) => {
    const ok = await onCommit(payload)
    if (ok) {
      dropDraft(match.id)
      if (goNext && chain) onNext(chain.id)
      else onClose()
    }
    return ok
  }
  const entry = { match, names, onCommit: commit, next: chain, isMobile }

  return (
    <Dialog
      open
      sheet={isMobile}
      width={560}
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{t('tournament.sb.title', { code: matchCode(match), event: event ? t('tournament.kind.' + event.kind) : '' })}</span>
          <span style={{ font: '600 11px/1 var(--font-mono)', color: 'var(--teal-300)', background: 'rgba(0,178,169,.12)', border: '1px solid var(--teal-500)', padding: '4px 8px', borderRadius: 5 }}>
            {ruleLabel(match.rule)}
          </span>
        </div>
      )}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Seg
          options={[
            { key: 'manual', label: t('tournament.sb.tab.manual') },
            { key: 'walkover', label: t('tournament.sb.tab.walkover') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tour.courtLabels.length > 0 && (match.status === 'ready' || match.status === 'live') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.bracket.court')}</span>
            <Seg options={tour.courtLabels.map((c) => ({ key: c, label: c }))} value={match.courtLabel || null} onChange={onCourt} />
          </div>
        )}
        {tab === 'manual' && <ManualEntry {...entry} />}
        {tab === 'walkover' && <WalkoverEntry {...entry} />}
      </div>
    </Dialog>
  )
}

/**
 * Nút chốt. Có trận kế trong hàng chờ → thêm "Chốt & trận kế" (chốt xong mở luôn trận đó).
 * onConfirm(goNext) — goNext = true khi bấm nút trận kế.
 */
function ConfirmBar({ next, disabled, busy, onConfirm }) {
  return (
    <>
      {next && (
        <Button variant="secondary" icon="arrow-right" disabled={disabled || busy} onClick={() => onConfirm(true)}>
          {t('tournament.sb.confirmNext', { code: matchCode(next) })}
        </Button>
      )}
      <Button icon="arrow-up-right" disabled={disabled} loading={busy} onClick={() => onConfirm(false)}>{t('tournament.sb.confirm')}</Button>
    </>
  )
}

/**
 * Ghi điểm: Tận dụng giao diện và trải nghiệm ScoreModal của sân (2 thẻ đội chọn winner, 4 preset nhanh, stepper custom score).
 * Trận 1 set: dùng SingleSetScoreModalEntry.
 * Trận nhiều set: dùng SetsInput.
 */
function ManualEntry({ match, names, next, onCommit, isMobile }) {
  const isMultiSet = (match.rule?.sets || 1) > 1
  if (isMultiSet) {
    return <MultiSetManualEntry match={match} names={names} next={next} onCommit={onCommit} />
  }
  return <SingleSetScoreModalEntry match={match} names={names} next={next} onCommit={onCommit} isMobile={isMobile} />
}

function SingleSetScoreModalEntry({ match, names, next, onCommit, isMobile }) {
  const rule = match.rule || {}
  const targetPoints = rule.points || 21
  const maxCap = rule.cap || (rule.win_by_two ? Math.min(30, targetPoints + 9) : targetPoints)

  const presets = useMemo(() => {
    if (targetPoints === 30) return ['30-28', '30-25', '30-20']
    if (targetPoints === 15) return ['15-13', '15-11', '15-8']
    return ['21-19', '21-15', '21-11']
  }, [targetPoints])

  const subPresets = useMemo(() => {
    if (targetPoints === 30) return [[30, 27], [30, 24], [30, 15], [30, 0]]
    if (targetPoints === 15) return [[15, 12], [15, 10], [15, 5], [15, 0]]
    return [[21, 18], [21, 16], [21, 14], [21, 12], [21, 0], [30, 29]]
  }, [targetPoints])

  const [winnerTeam, setWinnerTeam] = useState(() => {
    if (match.sets?.[0]) {
      const [sa, sb] = match.sets[0]
      if (sa > sb) return 'A'
      if (sb > sa) return 'B'
    }
    return null
  })

  const [presetScore, setPresetScore] = useState(() => {
    if (match.sets?.[0]) {
      const [sa, sb] = match.sets[0]
      const pair = `${Math.max(sa, sb)}-${Math.min(sa, sb)}`
      if (presets.includes(pair)) return pair
      return 'custom'
    }
    return null
  })

  const [scoreA, setScoreA] = useState(() => {
    if (match.sets?.[0]) return match.sets[0][0]
    return targetPoints
  })

  const [scoreB, setScoreB] = useState(() => {
    if (match.sets?.[0]) return match.sets[0][1]
    const parts = presets[0].split('-')
    return Number(parts[1])
  })

  const [busy, setBusy] = useState(false)

  const handleSelectWinner = (team) => {
    setWinnerTeam(team)
    if (!presetScore) setPresetScore(presets[0])
    const aVal = Number(scoreA)
    const bVal = Number(scoreB)
    if (team === 'A' && bVal > aVal) {
      setScoreA(bVal)
      setScoreB(aVal)
    } else if (team === 'B' && aVal > bVal) {
      setScoreA(bVal)
      setScoreB(aVal)
    }
  }

  const handleSelectPreset = (p) => {
    setPresetScore(p)
    if (p === 'custom') return
    const team = winnerTeam || 'A'
    if (!winnerTeam) setWinnerTeam('A')
    const [high, low] = p.split('-').map(Number)
    if (team === 'A') {
      setScoreA(high)
      setScoreB(low)
    } else {
      setScoreA(low)
      setScoreB(high)
    }
  }

  const updateCustomScore = (team, delta) => {
    setPresetScore('custom')
    if (team === 'A') {
      const nextScore = Math.max(0, Math.min(maxCap, Number(scoreA) + delta))
      setScoreA(nextScore)
      if (nextScore > Number(scoreB)) setWinnerTeam('A')
      else if (Number(scoreB) > nextScore) setWinnerTeam('B')
    } else {
      const nextScore = Math.max(0, Math.min(maxCap, Number(scoreB) + delta))
      setScoreB(nextScore)
      if (nextScore > Number(scoreA)) setWinnerTeam('B')
      else if (Number(scoreA) > nextScore) setWinnerTeam('A')
    }
  }

  const setCustomScoreDirect = (team, valStr) => {
    setPresetScore('custom')
    const num = valStr === '' ? 0 : Number(valStr)
    if (isNaN(num)) return
    const clamped = Math.max(0, Math.min(maxCap, num))
    if (team === 'A') {
      setScoreA(clamped)
      if (clamped > Number(scoreB)) setWinnerTeam('A')
      else if (Number(scoreB) > clamped) setWinnerTeam('B')
    } else {
      setScoreB(clamped)
      if (clamped > Number(scoreA)) setWinnerTeam('B')
      else if (Number(scoreA) > clamped) setWinnerTeam('A')
    }
  }

  const handleSwapCustomScore = () => {
    setPresetScore('custom')
    const tmpA = scoreA
    const tmpB = scoreB
    setScoreA(tmpB)
    setScoreB(tmpA)
    if (Number(tmpB) > Number(tmpA)) setWinnerTeam('A')
    else if (Number(tmpA) > Number(tmpB)) setWinnerTeam('B')
  }

  const isTie = Number(scoreA) === Number(scoreB)
  const sets = winnerTeam ? [[Number(scoreA), Number(scoreB)]] : []
  const lax = winnerTeam ? offRule(sets, rule) : 0

  const submit = async (goNext) => {
    if (!winnerTeam || isTie || busy) return
    setBusy(true)
    const ok = await onCommit({ sets, winner: winnerTeam, status: 'done' }, goNext)
    if (!ok) setBusy(false)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Hướng dẫn */}
      <div style={{ font: '600 11px/1.2 var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {t('scoreModal.instruction')}
      </div>

      {/* 2 Thẻ Đội A và Đội B */}
      <div style={{ ...S.teamsChoiceGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {/* Thẻ Đội A */}
        <div
          onClick={() => handleSelectWinner('A')}
          style={{
            ...S.teamChoiceCard,
            ...(winnerTeam === 'A' ? S.teamChoiceCardWon : {}),
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 15px/1.25 var(--font-sans)', color: winnerTeam === 'A' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {names.A}
            </div>
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation()
              setPresetScore('custom')
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            title={t('scoreModal.customScoreTitle')}
          >
            {winnerTeam === 'A' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
            <div style={winnerTeam === 'A' ? S.bigScoreWon : S.bigScoreLost}>
              {scoreA}
            </div>
          </div>
        </div>

        {/* Thẻ Đội B */}
        <div
          onClick={() => handleSelectWinner('B')}
          style={{
            ...S.teamChoiceCard,
            ...(winnerTeam === 'B' ? S.teamChoiceCardWon : {}),
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 15px/1.25 var(--font-sans)', color: winnerTeam === 'B' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {names.B}
            </div>
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation()
              setPresetScore('custom')
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            title={t('scoreModal.customScoreTitle')}
          >
            {winnerTeam === 'B' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
            <div style={winnerTeam === 'B' ? S.bigScoreWon : S.bigScoreLost}>
              {scoreB}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Nút preset tỷ số nhanh */}
      <div style={S.presetRow}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleSelectPreset(p)}
            style={{
              ...S.presetBtn,
              ...(presetScore === p ? S.presetBtnActive : {}),
            }}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleSelectPreset('custom')}
          style={{
            ...S.presetBtn,
            ...(presetScore === 'custom' ? S.presetBtnActive : {}),
          }}
        >
          {t('scoreModal.presetOther')}
        </button>
      </div>

      {/* Bộ nhập tỷ số tùy chỉnh khi bấm "Khác" hoặc bấm ô điểm */}
      {presetScore === 'custom' && (
        <div style={S.customScoreBox}>
          <div style={S.customScoreHeader}>
            <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--text-secondary)' }}>
              {t('scoreModal.customScoreTitle')}
            </span>
            {isTie && (
              <span style={{ color: 'var(--status-delayed-fg)', fontSize: 11.5, fontWeight: 500 }}>
                {t('quickMatch.errTie')}
              </span>
            )}
          </div>

          <div style={S.customScoreRow}>
            {/* Cột điểm Đội A */}
            <div style={S.customTeamCol}>
              <span style={S.customTeamName}>{names.A}</span>
              <div style={S.stepperBox}>
                <button
                  type="button"
                  onClick={() => updateCustomScore('A', -1)}
                  style={S.stepBtn}
                  title="-1"
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={maxCap}
                  value={scoreA}
                  onChange={(e) => setCustomScoreDirect('A', e.target.value)}
                  style={{
                    ...S.scoreBox,
                    borderColor: winnerTeam === 'A' ? 'var(--teal-700)' : 'var(--border-default)',
                    color: winnerTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => updateCustomScore('A', 1)}
                  style={S.stepBtn}
                  title="+1"
                >+</button>
              </div>
            </div>

            {/* Nút đổi điểm */}
            <button
              type="button"
              title={t('scoreModal.swapScore')}
              onClick={handleSwapCustomScore}
              style={S.swapBtn}
            >
              ⇄
            </button>

            {/* Cột điểm Đội B */}
            <div style={S.customTeamCol}>
              <span style={S.customTeamName}>{names.B}</span>
              <div style={S.stepperBox}>
                <button
                  type="button"
                  onClick={() => updateCustomScore('B', -1)}
                  style={S.stepBtn}
                  title="-1"
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={maxCap}
                  value={scoreB}
                  onChange={(e) => setCustomScoreDirect('B', e.target.value)}
                  style={{
                    ...S.scoreBox,
                    borderColor: winnerTeam === 'B' ? 'var(--teal-700)' : 'var(--border-default)',
                    color: winnerTeam === 'B' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => updateCustomScore('B', 1)}
                  style={S.stepBtn}
                  title="+1"
                >+</button>
              </div>
            </div>
          </div>

          {/* Preset điểm bổ sung */}
          <div style={S.subPresetRow}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('scoreModal.quickPresets')}:
            </span>
            {subPresets.map(([pa, pb]) => (
              <button
                key={`${pa}-${pb}`}
                type="button"
                onClick={() => {
                  if (winnerTeam === 'B') {
                    setScoreA(pb)
                    setScoreB(pa)
                  } else {
                    setScoreA(pa)
                    setScoreB(pb)
                  }
                }}
                style={S.subPresetBtn}
              >
                {pa}–{pb}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dòng kết quả / thông báo */}
      {winnerTeam && !isTie && (
        <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--status-transit-fg)' }}>
          {endedLine(sets, winnerTeam, names)}
        </span>
      )}
      {winnerTeam && lax > 0 && (
        <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
          {t('tournament.sb.offRule', { n: lax, rule: ruleLabel(rule) })}
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <ConfirmBar next={next} disabled={!winnerTeam || isTie} busy={busy} onConfirm={submit} />
      </div>
    </div>
  )
}

/** Hàng đã gõ đủ hai ô → [[a, b], …] (bỏ hàng trống ở cuối). */
const toSets = (rows) => rows.filter((r) => r && r[0] !== '' && r[1] !== '' && r[0] != null && r[1] != null).map((r) => [Number(r[0]), Number(r[1])])

/**
 * Các set nhập tay: [[a, b], …] dạng chuỗi đang gõ. `max` = số set tối đa của luật.
 * Gõ nhanh: gõ đủ 2 chữ số tự nhảy sang ô kế; Enter = sang ô kế, hoặc chốt khi `onSubmit` trả true.
 * `compact`: chỉ hiện số set cần (thắng ceil(max/2) set); hoà set → hiện thêm set quyết định.
 */
function SetsInput({ rows, setRows, max, names, compact, onSubmit, autoFocus }) {
  const uid = useId()
  const fid = (i, j) => `${uid}-${i}-${j}`
  const need = Math.ceil(max / 2)
  const filled = toSets(rows)
  const decided = filled.filter(([a, b]) => a > b).length >= need || filled.filter(([a, b]) => b > a).length >= need
  const shown = compact ? Math.min(max, Math.max(need, filled.length + (decided ? 0 : 1))) : max
  // Ô kế có thể vừa mới hiện (set quyết định) → chờ render xong mới focus.
  const focusNext = (i, j) => setTimeout(() => {
    const el = document.getElementById(j === 0 ? fid(i, 1) : fid(i + 1, 0))
    if (el) el.focus()
  }, 0)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 8, font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
        <span />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.A}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.B}</span>
      </div>
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 8, alignItems: 'center' }}>
          <Mono size={12} color="var(--text-muted)">{t('tournament.sb.set', { n: i + 1 })}</Mono>
          {[0, 1].map((j) => (
            <Input key={j} id={fid(i, j)} mono inputMode="numeric" enterKeyHint={onSubmit ? 'done' : 'next'} size="sm"
              aria-label={t('tournament.sb.set', { n: i + 1 }) + ' ' + (j ? names.B : names.A)}
              autoFocus={autoFocus && i === 0 && j === 0}
              value={rows[i]?.[j] ?? ''}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (!onSubmit || !onSubmit()) focusNext(i, j)
              }}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                setRows((r) => {
                  const nextRows = Array.from({ length: max }, (_, k) => [...(r[k] || ['', ''])])
                  nextRows[i][j] = val
                  return nextRows
                })
                if (val.length === 2) focusNext(i, j)
              }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Ô lý do + các lý do hay gặp: chạm 1 lần là điền (`chips` = khoá i18n dưới tournament.reason). */
function ReasonField({ label, placeholder, value, onChange, chips, autoFocus }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Input label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map((k) => {
          const text = t('tournament.reason.' + k)
          const on = value.trim() === text
          return (
            <button key={k} type="button" onClick={() => onChange(text)} style={{
              padding: '5px 10px', borderRadius: 99, cursor: 'pointer', font: '500 12px/1.2 var(--font-sans)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-inset)',
              border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiSetManualEntry({ match, names, next, onCommit }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const sets = toSets(rows)
  const winner = resultWinner(sets, match.rule)
  const error = sets.length ? validateResult(sets, match.rule) : null
  const lax = winner ? offRule(sets, match.rule) : 0
  const submit = async (goNext) => {
    setBusy(true)
    if (!(await onCommit({ sets, winner, status: 'done' }, goNext))) setBusy(false)
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.sb.manualHint', { n: match.rule.sets, need: Math.ceil(match.rule.sets / 2) })}</span>
      <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} compact autoFocus
        onSubmit={() => { if (!winner || busy) return false; submit(Boolean(next)); return true }} />
      {winner && <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--status-transit-fg)' }}>{endedLine(sets, winner, names)}</span>}
      {winner && lax > 0 && (
        <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.sb.offRule', { n: lax, rule: ruleLabel(match.rule) })}</span>
      )}
      {error && error !== 'tournament.err.matchNotFinished' && (
        <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed-fg)' }}>{t(error)}</span>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <ConfirmBar next={next} disabled={!winner} busy={busy} onConfirm={submit} />
      </div>
    </div>
  )
}

function WalkoverEntry({ match, names, next, onCommit }) {
  const [status, setStatus] = useState('walkover')
  const [winner, setWinner] = useState(null)
  const [note, setNote] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const submit = async (goNext) => {
    setBusy(true)
    const ok = await onCommit({ status, winner, note: note.trim(), sets: status === 'retired' ? toSets(rows) : [] }, goNext)
    if (!ok) setBusy(false)
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Seg options={['walkover', 'retired'].map((k) => ({ key: k, label: t('tournament.sb.wo.' + k) }))} value={status} onChange={setStatus} />
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.sb.wo.winner')}</span>
        <Seg options={['A', 'B'].map((k) => ({ key: k, label: names[k] }))} value={winner} onChange={setWinner} size={36} />
      </div>
      <ReasonField label={t('tournament.sb.wo.note')} placeholder={t('tournament.sb.wo.notePh')} value={note} onChange={setNote}
        chips={status === 'retired' ? ['injury', 'tired', 'late'] : ['absent', 'withdrew', 'late']} />
      {status === 'retired' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{t('tournament.sb.wo.retiredSets')}</span>
          <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <ConfirmBar next={next} disabled={!winner || !note.trim()} busy={busy} onConfirm={submit} />
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
        <SetsInput rows={rows} setRows={setRows} max={match.rule.sets} names={names} compact />
        <ReasonField label={t('tournament.editDlg.reason')} value={reason} onChange={setReason} chips={['typo', 'referee']} />
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
      <ReasonField label={t('tournament.undoDlg.reason')} value={reason} onChange={setReason} chips={['typo', 'wrongWinner', 'replay']} autoFocus />
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
