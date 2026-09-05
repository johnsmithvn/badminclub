import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
import { playerName } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function ScoreModal({ court, session, challenge, onClose, onSaved }) {
  const { db, a } = useApp()
  const [submitting, setSubmitting] = useState(false)

  // Xác định Đội A và Đội B từ court hoặc challenge
  const teamA = useMemo(() => {
    if (challenge) return challenge.teamA || []
    if (court && court.slots) return [court.slots[0], court.slots[1]].filter(Boolean)
    return []
  }, [challenge, court])

  const teamB = useMemo(() => {
    if (challenge) return challenge.teamB || []
    if (court && court.slots) return [court.slots[2], court.slots[3]].filter(Boolean)
    return []
  }, [challenge, court])

  // Trận chia sân / phong trào mặc định 1 set (1 ván 21đ). Kèo thách đấu BO3 mới mặc định 3 set.
  const isChallengeBo3 = challenge?.bestOf === 3
  const [sets, setSets] = useState(() => {
    if (isChallengeBo3) {
      return [[21, 0], [0, 21], [21, 0]]
    }
    return [[21, 0]]
  })

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  // Chuyển đổi giữa 1 Set và 3 Set
  const setMatchFormat = (mode) => {
    if (mode === 'single') {
      setSets([[sets[0]?.[0] ?? 21, sets[0]?.[1] ?? 0]])
    } else {
      setSets((prev) => {
        const next = [...prev]
        while (next.length < 3) next.push([21, 0])
        return next
      })
    }
  }

  // Điều chỉnh điểm set
  const updateScore = (setIdx, teamIdx, delta) => {
    setSets((prev) => {
      const next = prev.map((s, i) => {
        if (i !== setIdx) return s
        const val = Math.max(0, Math.min(30, (s[teamIdx] || 0) + delta))
        const newSet = [...s]
        newSet[teamIdx] = val
        return newSet
      })
      return next
    })
  }

  // Set điểm trực tiếp qua input
  const setScoreDirect = (setIdx, teamIdx, valStr) => {
    const val = parseInt(valStr, 10)
    const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(30, val))
    setSets((prev) => {
      const next = prev.map((s, i) => {
        if (i !== setIdx) return s
        const newSet = [...s]
        newSet[teamIdx] = safeVal
        return newSet
      })
      return next
    })
  }

  // Tính số set thắng của mỗi đội
  const setsWon = useMemo(() => {
    let wonA = 0
    let wonB = 0
    sets.forEach(([aScore, bScore]) => {
      if (aScore > bScore && (aScore >= 21 || aScore === 30)) {
        wonA++
      } else if (bScore > aScore && (bScore >= 21 || bScore === 30)) {
        wonB++
      } else if (aScore > bScore) {
        wonA++
      } else if (bScore > aScore) {
        wonB++
      }
    })
    return { wonA, wonB }
  }, [sets])

  const winnerTeam = setsWon.wonA > setsWon.wonB ? 'A' : setsWon.wonB > setsWon.wonA ? 'B' : null

  // Rating preview có tính K-Factor động và Margin Multiplier
  const playerDeltasPreview = useMemo(() => {
    if (!winnerTeam || teamA.length === 0 || teamB.length === 0) return null
    const ratingsMap = {}
    const gamesCountMap = {}
    ;[...teamA, ...teamB].forEach((id) => {
      const pr = getPlayerRating(db.playerRatings, id)
      ratingsMap[id] = pr.rating
      gamesCountMap[id] = pr.matchesCount || 0
    })
    return calcPlayerDeltas({
      teamA,
      teamB,
      aWon: winnerTeam === 'A',
      ratingsMap,
      gamesCountMap,
      sets,
    })
  }, [winnerTeam, teamA, teamB, sets, db.playerRatings])

  const ratingDeltaPreview = useMemo(() => {
    if (!playerDeltasPreview) return null
    const { deltas, multiplier } = playerDeltasPreview
    const deltasA = teamA.map((id) => ({
      id,
      name: playerName(db, id),
      delta: deltas?.[id] || 0,
    }))
    const deltasB = teamB.map((id) => ({
      id,
      name: playerName(db, id),
      delta: deltas?.[id] || 0,
    }))
    return {
      deltasA,
      deltasB,
      mult: multiplier || 1,
    }
  }, [playerDeltasPreview, teamA, teamB, db])

  const handleSave = () => {
    if (!winnerTeam || submitting) return
    setSubmitting(true)
    try {
      // Lọc các set hợp lệ
      const finalSets = sets.filter(([a, b]) => a > 0 || b > 0)
      const res = a.saveMatchScore({
        sessionId: session?.id || null,
        courtIdx: court?.courtIndex ?? 0,
        courtId: court?.courtId || null,
        challengeId: challenge?.id || court?.fromChallengeId || null,
        ratingEnabled: challenge ? challenge.ratingEnabled !== false : true,
        teamA,
        teamB,
        sets: finalSets.length ? finalSets : sets,
        winnerTeam,
        minutes: court?.minutes || cfg.match?.defaultMinutes || 20,
      })
      if (res && onSaved) onSaved(res)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const courtName = court ? court.name : ''
  const isChallenge = Boolean(challenge || court?.fromChallengeId)
  const challengeCode = challenge?.code || court?.fromChallengeCode || ''

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={S.title}>
              {t('scoreModal.title', { court: courtName || '1' })}
            </div>
            <div style={S.subtitle}>
              {isChallenge
                ? t('scoreModal.sourceFromChallenge', { code: challengeCode })
                : t('scoreModal.sourceFromSession')}
            </div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}>{t('common.close')}</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Tên 2 đội */}
          <div style={S.teamsHeader}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-transit-fg, #5FDBD3)' }}>
                {nameTeamA}
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled, #5B6B81)', padding: '0 8px' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)' }}>
                {nameTeamB}
              </span>
            </div>
          </div>

          {/* Tuỳ chọn số set: 1 Set (phong trào) vs 3 Set (BO3) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #A8B7CB)' }}>
              {t('scoreModal.matchFormat')}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setMatchFormat('single')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${sets.length === 1 ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--border-subtle, #22304A)'}`,
                  background: sets.length === 1 ? 'rgba(95,219,211,0.14)' : 'var(--surface-card, #141D2E)',
                  color: sets.length === 1 ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-muted, #8494AA)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('scoreModal.format1Set')}
              </button>
              <button
                type="button"
                onClick={() => setMatchFormat('bo3')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${sets.length === 3 ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--border-subtle, #22304A)'}`,
                  background: sets.length === 3 ? 'rgba(95,219,211,0.14)' : 'var(--surface-card, #141D2E)',
                  color: sets.length === 3 ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-muted, #8494AA)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('scoreModal.format3Set')}
              </button>
            </div>
          </div>

          {/* Stepper từng set */}
          <div style={{ display: 'grid', gap: 12 }}>
            {sets.map((set, setIdx) => {
              const [aScore, bScore] = set
              const aWon = aScore > bScore
              const bWon = bScore > aScore
              return (
                <div key={setIdx} style={{ display: 'grid', gap: 6 }}>
                  <div style={S.setRow}>
                    <span style={S.setLabel}>{t('scoreModal.setLabel', { n: setIdx + 1 })}</span>
                    
                    {/* Team A Stepper */}
                    <div style={S.stepper}>
                      <button
                        type="button"
                        onClick={() => updateScore(setIdx, 0, -1)}
                        style={S.stepBtn}
                      >−</button>
                      <input
                        type="number"
                        value={aScore}
                        onChange={(e) => setScoreDirect(setIdx, 0, e.target.value)}
                        style={{
                          ...S.scoreBox,
                          borderColor: aWon ? 'var(--teal-700, #00786F)' : 'var(--border-default, #2E3E5C)',
                          color: aWon ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-primary, #E9EFF7)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateScore(setIdx, 0, 1)}
                        style={S.stepBtn}
                      >+</button>
                    </div>

                    {/* Nút đổi điểm / đổi bên */}
                    <button
                      type="button"
                      title={t('scoreModal.swapScore')}
                      onClick={() => {
                        setSets((prev) => prev.map((s, i) => (i === setIdx ? [s[1], s[0]] : s)))
                      }}
                      style={S.swapBtn}
                    >
                      ⇄
                    </button>

                    {/* Team B Stepper */}
                    <div style={S.stepper}>
                      <button
                        type="button"
                        onClick={() => updateScore(setIdx, 1, -1)}
                        style={S.stepBtn}
                      >−</button>
                      <input
                        type="number"
                        value={bScore}
                        onChange={(e) => setScoreDirect(setIdx, 1, e.target.value)}
                        style={{
                          ...S.scoreBox,
                          borderColor: bWon ? 'var(--teal-700, #00786F)' : 'var(--border-default, #2E3E5C)',
                          color: bWon ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-primary, #E9EFF7)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateScore(setIdx, 1, 1)}
                        style={S.stepBtn}
                      >+</button>
                    </div>
                  </div>

                  {/* Tỷ số nhanh */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 4 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted, #8494AA)' }}>
                      {t('scoreModal.quickPresets')}:
                    </span>
                    {[
                      [21, 19],
                      [21, 18],
                      [21, 15],
                      [21, 12],
                      [21, 0],
                    ].map(([pa, pb]) => (
                      <button
                        key={`${pa}-${pb}`}
                        type="button"
                        onClick={() => {
                          setSets((prev) => prev.map((s, i) => {
                            if (i !== setIdx) return s
                            return s[1] > s[0] ? [pb, pa] : [pa, pb]
                          }))
                        }}
                        style={S.presetBtn}
                      >
                        {pa}–{pb}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Result preview */}
          <div style={S.summaryCard}>
            <div style={S.summaryRow}>
              <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('scoreModal.result')}</span>
              <span style={{ color: winnerTeam ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-primary, #E9EFF7)', fontWeight: 600 }}>
                {sets.length === 1
                  ? `${sets[0][0]} – ${sets[0][1]}`
                  : `${setsWon.wonA} – ${setsWon.wonB} (${sets.map(([a, b]) => `${a}-${b}`).join(', ')})`
                }
                {winnerTeam && ` · ${winnerTeam === 'A' ? nameTeamA : nameTeamB} ${t('scoreModal.won')}`}
              </span>
            </div>
            {ratingDeltaPreview && (
              <div style={{ ...S.summaryRow, alignItems: 'flex-start', paddingTop: 6, borderTop: '1px solid var(--border-subtle, #22304A)' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('scoreModal.ratingDelta')}</span>
                  {ratingDeltaPreview.mult > 1 && (
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(95,219,211,0.12)', color: 'var(--status-transit-fg, #5FDBD3)', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                      {t('rating.multiplier', { mult: ratingDeltaPreview.mult.toFixed(2), val: ratingDeltaPreview.mult.toFixed(2) })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 4, textAlign: 'right' }}>
                  <div style={{ color: 'var(--status-transit-fg, #5FDBD3)', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>
                    {ratingDeltaPreview.deltasA.map((p) => `${p.name} (${p.delta > 0 ? `+${p.delta}` : p.delta})`).join(' · ')}
                  </div>
                  <div style={{ color: 'var(--text-secondary, #A8B7CB)', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>
                    {ratingDeltaPreview.deltasB.map((p) => `${p.name} (${p.delta > 0 ? `+${p.delta}` : p.delta})`).join(' · ')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              disabled={!winnerTeam || submitting}
              onClick={handleSave}
              style={{
                ...S.saveBtn,
                opacity: !winnerTeam || submitting ? 0.45 : 1,
                cursor: !winnerTeam || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('common.saving') : t('scoreModal.save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={S.cancelBtn}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3,8,17,.72)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 999,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94vh',
    overflowY: 'auto',
    background: 'var(--surface-raised, #1A2437)',
    border: '1px solid var(--border-default, #2E3E5C)',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.60)',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    font: '600 17px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary, #E9EFF7)',
  },
  subtitle: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  closeBtn: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 6,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-default, #2E3E5C)',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    cursor: 'pointer',
  },
  body: {
    padding: 18,
    display: 'grid',
    gap: 14,
  },
  teamsHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  setRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  setLabel: {
    width: 50,
    font: '400 13px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 34,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-default, #2E3E5C)',
    color: 'var(--text-secondary, #A8B7CB)',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  swapBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid var(--border-subtle, #22304A)',
    borderRadius: 6,
    color: 'var(--text-muted, #8494AA)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  presetBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
    color: 'var(--text-secondary, #A8B7CB)',
    fontSize: 11.5,
    fontFamily: '"IBM Plex Mono", monospace',
    cursor: 'pointer',
  },
  scoreBox: {
    width: 48,
    height: 40,
    borderRadius: 6,
    background: 'var(--surface-card, #141D2E)',
    border: '1.5px solid var(--border-default, #2E3E5C)',
    textAlign: 'center',
    font: '700 18px/1 Barlow, sans-serif',
    outline: 'none',
  },
  summaryCard: {
    display: 'grid',
    gap: 7,
    padding: '11px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    fontSize: 13,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--navy-500, #1D50A0)',
    border: 'none',
    font: '700 14px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--gray-0, #FFFFFF)',
    boxShadow: '0 2px 10px rgba(29,80,160,.4)',
  },
  cancelBtn: {
    height: 44,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    borderRadius: 6,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-default, #2E3E5C)',
    font: '600 14px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    cursor: 'pointer',
  },
}
