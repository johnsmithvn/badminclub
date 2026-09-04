import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
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

  const bestOf = challenge?.bestOf || 3
  const numSets = bestOf === 1 ? 1 : 3

  // State các set: [[21, 19], [18, 21], [21, 15]]
  const [sets, setSets] = useState(() => {
    const initial = []
    for (let i = 0; i < numSets; i++) {
      initial.push([21, 0])
    }
    return initial
  })

  const memberNameOf = (id) => (db.members.find((m) => m.id === id) || {}).name || id
  const nameTeamA = teamA.map(memberNameOf).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map(memberNameOf).join(' · ') || t('challenge.teamB')

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

  const targetWins = Math.ceil(numSets / 2)
  const isComplete = setsWon.wonA >= targetWins || setsWon.wonB >= targetWins
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
      name: memberNameOf(id),
      delta: deltas?.[id] || 0,
    }))
    const deltasB = teamB.map((id) => ({
      id,
      name: memberNameOf(id),
      delta: deltas?.[id] || 0,
    }))
    return {
      deltasA,
      deltasB,
      mult: multiplier || 1,
    }
  }, [playerDeltasPreview, teamA, teamB, db.members])

  const handleSave = async () => {
    if (!winnerTeam || submitting) return
    setSubmitting(true)
    try {
      // Lọc các set hợp lệ
      const finalSets = sets.filter(([a, b]) => a > 0 || b > 0)
      const res = await a.saveMatchScore({
        sid: session?.id || null,
        sessionId: session?.id || null,
        ci: court?.courtIndex ?? 0,
        courtIdx: court?.courtIndex ?? 0,
        courtIndex: court?.courtIndex ?? 0,
        courtId: court?.courtId || null,
        challengeId: challenge?.id || court?.fromChallengeId || null,
        challengeCode: challenge?.code || court?.fromChallengeCode || null,
        ratingEnabled: challenge ? challenge.ratingEnabled !== false : true,
        teamA,
        teamB,
        sets: finalSets.length ? finalSets : sets,
        winnerTeam,
        minutes: court?.minutes || cfg.match?.defaultMinutes || 20,
      })
      if (res && onSaved) onSaved(res)
      onClose()
    } catch (err) {
      console.error(err)
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
              <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: '#5FDBD3' }}>
                {nameTeamA}
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: '#5B6B81', padding: '0 8px' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
                {nameTeamB}
              </span>
            </div>
          </div>

          {/* Stepper từng set */}
          <div style={{ display: 'grid', gap: 10 }}>
            {sets.map((set, setIdx) => {
              const [aScore, bScore] = set
              const aWon = aScore > bScore
              const bWon = bScore > aScore
              return (
                <div key={setIdx} style={S.setRow}>
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
                        borderColor: aWon ? '#00786F' : '#2E3E5C',
                        color: aWon ? '#5FDBD3' : '#E9EFF7',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateScore(setIdx, 0, 1)}
                      style={S.stepBtn}
                    >+</button>
                  </div>

                  <span style={{ color: '#5B6B81', fontWeight: 600 }}>–</span>

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
                        borderColor: bWon ? '#00786F' : '#2E3E5C',
                        color: bWon ? '#5FDBD3' : '#E9EFF7',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateScore(setIdx, 1, 1)}
                      style={S.stepBtn}
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Result preview */}
          <div style={S.summaryCard}>
            <div style={S.summaryRow}>
              <span style={{ color: '#8494AA' }}>{t('scoreModal.result')}</span>
              <span style={{ color: winnerTeam ? '#5FDBD3' : '#E9EFF7', fontWeight: 600 }}>
                {setsWon.wonA} – {setsWon.wonB}
                {winnerTeam && ` · ${winnerTeam === 'A' ? nameTeamA : nameTeamB} ${t('scoreModal.won')}`}
              </span>
            </div>
            {ratingDeltaPreview && (
              <div style={{ ...S.summaryRow, alignItems: 'flex-start', paddingTop: 6, borderTop: '1px solid #22304A' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={{ color: '#8494AA' }}>{t('scoreModal.ratingDelta')}</span>
                  {ratingDeltaPreview.mult > 1 && (
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(95,219,211,0.12)', color: '#5FDBD3', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                      {t('rating.multiplier', { val: ratingDeltaPreview.mult.toFixed(2) })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 4, textAlign: 'right' }}>
                  <div style={{ color: '#5FDBD3', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>
                    {ratingDeltaPreview.deltasA.map((p) => `${p.name} (${p.delta > 0 ? `+${p.delta}` : p.delta})`).join(' · ')}
                  </div>
                  <div style={{ color: '#A8B7CB', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>
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
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.60)',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid #22304A',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    font: '600 17px/1.25 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  subtitle: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  closeBtn: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 6,
    background: '#141D2E',
    border: '1px solid #2E3E5C',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
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
    background: '#101927',
    border: '1px solid #22304A',
  },
  setRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
  },
  setLabel: {
    width: 50,
    font: '400 13px/1.4 "IBM Plex Mono", monospace',
    color: '#8494AA',
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
    background: '#141D2E',
    border: '1px solid #2E3E5C',
    color: '#A8B7CB',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  scoreBox: {
    width: 48,
    height: 40,
    borderRadius: 6,
    background: '#141D2E',
    border: '1.5px solid #2E3E5C',
    textAlign: 'center',
    font: '700 18px/1 Barlow, sans-serif',
    outline: 'none',
  },
  summaryCard: {
    display: 'grid',
    gap: 7,
    padding: '11px 14px',
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
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
    background: '#1D50A0',
    border: 'none',
    font: '700 14px/1 "IBM Plex Sans", sans-serif',
    color: '#FFFFFF',
    boxShadow: '0 2px 10px rgba(29,80,160,.4)',
  },
  cancelBtn: {
    height: 44,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    borderRadius: 6,
    background: '#141D2E',
    border: '1px solid #2E3E5C',
    font: '600 14px/1 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
    cursor: 'pointer',
  },
}
