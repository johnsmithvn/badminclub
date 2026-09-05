import { useState, useMemo } from 'react'
import { Dialog } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName } from '#lib/money.js'
import { matchCodeOf } from '#lib/rating.js'
import { t } from '#i18n'

export default function EditScoreModal({ match, onClose, onSaved }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
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

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

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
    <Dialog
      open
      sheet={isMobile}
      width={540}
      title={t('matchSearch.editTitle', { code: matchCodeOf(db, match) })}
      description={t('matchSearch.editDesc')}
      onClose={onClose}
      style={{
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            type="button"
            disabled={!newWinnerTeam || !reason.trim() || submitting}
            onClick={handleSave}
            style={{
              flex: 1,
              height: isMobile ? 56 : 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--action-primary-bg)',
              border: 'none',
              font: '700 15px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--gray-0)',
              cursor: !newWinnerTeam || !reason.trim() || submitting ? 'not-allowed' : 'pointer',
              opacity: !newWinnerTeam || !reason.trim() || submitting ? 0.45 : 1,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {submitting ? t('common.saving') : t('matchSearch.btnSaveEdit')}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: isMobile ? 56 : 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              font: '600 14px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Tên 2 đội */}
        <div style={S.teamsHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-transit-fg)' }}>
              {nameTeamA}
            </span>
          </div>
          <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)', padding: '0 8px' }}>VS</span>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <span style={{ font: '700 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
              {nameTeamB}
            </span>
          </div>
        </div>

        {/* So sánh tỷ số cũ vs mới */}
        <div style={S.compareBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('matchSearch.oldScore')}:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textDecoration: 'line-through' }}>
              {oldScoreStr} ({match.winnerTeam === 'A' ? nameTeamA : nameTeamB} {t('matchSearch.won')})
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--status-transit-fg)', fontWeight: 600 }}>{t('matchSearch.newScore')}:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-transit-fg)', fontWeight: 700 }}>
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
                    style={{
                      ...S.stepBtn,
                      width: isMobile ? 48 : 34,
                      height: isMobile ? 48 : 40,
                    }}
                  >−</button>
                  <input
                    type="number"
                    value={aScore}
                    onChange={(e) => setScoreDirect(setIdx, 0, e.target.value)}
                    style={{
                      ...S.scoreBox,
                      width: isMobile ? 54 : 48,
                      height: isMobile ? 48 : 40,
                      borderColor: aWon ? 'var(--teal-700)' : 'var(--border-default)',
                      color: aWon ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateScore(setIdx, 0, 1)}
                    style={{
                      ...S.stepBtn,
                      width: isMobile ? 48 : 34,
                      height: isMobile ? 48 : 40,
                    }}
                  >+</button>
                </div>

                <span style={{ color: 'var(--text-disabled)', fontWeight: 600 }}>–</span>

                {/* Team B Stepper */}
                <div style={S.stepper}>
                  <button
                    type="button"
                    onClick={() => updateScore(setIdx, 1, -1)}
                    style={{
                      ...S.stepBtn,
                      width: isMobile ? 48 : 34,
                      height: isMobile ? 48 : 40,
                    }}
                  >−</button>
                  <input
                    type="number"
                    value={bScore}
                    onChange={(e) => setScoreDirect(setIdx, 1, e.target.value)}
                    style={{
                      ...S.scoreBox,
                      width: isMobile ? 54 : 48,
                      height: isMobile ? 48 : 40,
                      borderColor: bWon ? 'var(--teal-700)' : 'var(--border-default)',
                      color: bWon ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateScore(setIdx, 1, 1)}
                    style={{
                      ...S.stepBtn,
                      width: isMobile ? 48 : 34,
                      height: isMobile ? 48 : 40,
                    }}
                  >+</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ô nhập lý do sửa */}
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
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
          <span style={{ color: 'var(--status-delayed-fg)', fontWeight: 600 }}>⚠️ {t('matchSearch.recalcNotice')}</span>
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--status-incident-fg, var(--red-500))', fontSize: 13, fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}
      </div>
    </Dialog>
  )
}

const S = {
  teamsHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  compareBox: {
    display: 'grid',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  setRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  setLabel: {
    width: 50,
    font: '400 13px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
  },
  scoreBox: {
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1.5px solid var(--border-default)',
    textAlign: 'center',
    font: '700 18px/1 Barlow, sans-serif',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    font: '400 13px/1.5 "IBM Plex Sans", sans-serif',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  noticeBox: {
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(240,183,92,.12)',
    border: '1px solid rgba(240,183,92,.3)',
    fontSize: 12.5,
    lineHeight: 1.4,
  },
}

