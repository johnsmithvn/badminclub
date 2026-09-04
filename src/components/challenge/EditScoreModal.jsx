import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'

export default function EditScoreModal({ match, onClose, onSaved }) {
  const { db, a } = useApp()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const oldSets = match.sets || []
  const [sets, setSets] = useState(() => {
    if (oldSets.length > 0) {
      return oldSets.map((s) => [s[0], s[1]])
    }
    return [[21, 19]]
  })

  const teamA = match.teamA || []
  const teamB = match.teamB || []

  const memberNameOf = (id) => (db.members.find((m) => m.id === id) || {}).name || id
  const nameTeamA = teamA.map(memberNameOf).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map(memberNameOf).join(' · ') || t('challenge.teamB')

  // Cập nhật điểm set
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

  // Thắng bao nhiêu set
  const setsWon = useMemo(() => {
    let wonA = 0
    let wonB = 0
    sets.forEach(([aScore, bScore]) => {
      if (aScore > bScore) wonA++
      else if (bScore > aScore) wonB++
    })
    return { wonA, wonB }
  }, [sets])

  const newWinnerTeam = setsWon.wonA > setsWon.wonB ? 'A' : setsWon.wonB > setsWon.wonA ? 'B' : null



  const handleSave = async () => {
    if (!reason.trim()) {
      setErrorMsg(t('matchSearch.reasonRequired'))
      return
    }
    if (!newWinnerTeam) {
      setErrorMsg(t('matchSearch.noTie'))
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = a.editMatchScore({
        matchId: match.id,
        sets,
        reason: reason.trim(),
      })
      if (res && onSaved) onSaved(res)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || t('matchSearch.errorEdit'))
    } finally {
      setSubmitting(false)
    }
  }

  const oldScoreStr = oldSets.map(([a, b]) => `${a}-${b}`).join(', ')
  const newScoreStr = sets.map(([a, b]) => `${a}-${b}`).join(', ')

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={S.title}>
              {t('matchSearch.editTitle', { code: match.code || match.id })}
            </div>
            <div style={S.subtitle}>{t('matchSearch.editDesc')}</div>
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

          {/* So sánh tỷ số cũ vs mới */}
          <div style={S.compareBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#8494AA' }}>{t('matchSearch.oldScore')}:</span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#E9EFF7', textDecoration: 'line-through' }}>
                {oldScoreStr} ({match.winnerTeam === 'A' ? nameTeamA : nameTeamB} {t('matchSearch.won')})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#5FDBD3', fontWeight: 600 }}>{t('matchSearch.newScore')}:</span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#5FDBD3', fontWeight: 700 }}>
                {newScoreStr} {newWinnerTeam ? `(${newWinnerTeam === 'A' ? nameTeamA : nameTeamB} ${t('matchSearch.won')})` : ''}
              </span>
            </div>
          </div>

          {/* Điều chỉnh điểm từng set */}
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

          {/* Ô nhập lý do sửa */}
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif', color: '#E9EFF7' }}>
              {t('matchSearch.fieldReason')}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('matchSearch.phReason')}
              style={S.textarea}
            />
          </div>

          {/* Cảnh báo audit & cascade */}
          <div style={S.noticeBox}>
            <span style={{ color: '#F0B75C', fontWeight: 600 }}>⚠️ {t('matchSearch.recalcNotice')}</span>
          </div>

          {errorMsg && (
            <div style={{ color: '#FF9A8F', fontSize: 13, fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              disabled={!newWinnerTeam || !reason.trim() || submitting}
              onClick={handleSave}
              style={{
                ...S.saveBtn,
                opacity: !newWinnerTeam || !reason.trim() || submitting ? 0.45 : 1,
                cursor: !newWinnerTeam || !reason.trim() || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('common.saving') : t('matchSearch.btnSaveEdit')}
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
    padding: 20,
    zIndex: 999,
  },
  modal: {
    width: '100%',
    maxWidth: 540,
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.60)',
    overflow: 'hidden',
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
  compareBox: {
    display: 'grid',
    gap: 6,
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
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    background: '#101927',
    border: '1px solid #2E3E5C',
    color: '#E9EFF7',
    font: '400 13px/1.5 "IBM Plex Sans", sans-serif',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  noticeBox: {
    padding: '9px 12px',
    borderRadius: 6,
    background: 'rgba(224,138,0,.12)',
    border: '1px solid rgba(224,138,0,.3)',
    fontSize: 12.5,
    lineHeight: 1.4,
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
