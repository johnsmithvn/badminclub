import { useState, useMemo } from 'react'
import { Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName } from '#lib/money.js'
import { matchCodeOf, teamRating, calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
import { t } from '#i18n'

export default function EditScoreModal({ match, onClose, onSaved }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 1. Quản lý Ngày & Giờ thi đấu của trận
  const session = useMemo(() => {
    return (db.sessions || []).find((s) => s.id === match.sessionId)
  }, [db.sessions, match.sessionId])

  const { initDateStr, initTimeStr } = useMemo(() => {
    const ts = match.at || (session?.date ? new Date(session.date).getTime() : Date.now())
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return {
      initDateStr: `${y}-${m}-${day}`,
      initTimeStr: `${hh}:${mm}`,
    }
  }, [match.at, session?.date])

  const [dateStr, setDateStr] = useState(initDateStr)
  const [timeStr, setTimeStr] = useState(initTimeStr)

  // Điều chỉnh giờ nhanh (-15p, +15p, Bây giờ)
  const adjustMinutes = (delta) => {
    const [hh, mm] = (timeStr || '20:00').split(':').map(Number)
    let total = (isNaN(hh) ? 20 : hh) * 60 + (isNaN(mm) ? 0 : mm) + delta
    if (total < 0) total += 24 * 60
    total = total % (24 * 60)
    const newH = String(Math.floor(total / 60)).padStart(2, '0')
    const newM = String(total % 60).padStart(2, '0')
    setTimeStr(`${newH}:${newM}`)
  }

  const setTimeToNow = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setDateStr(`${y}-${m}-${day}`)
    setTimeStr(`${hh}:${mm}`)
  }

  const finalTimestamp = useMemo(() => {
    if (!dateStr || !timeStr) return match.at || Date.now()
    const [y, m, d] = dateStr.split('-').map(Number)
    const [hh, mm] = timeStr.split(':').map(Number)
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
    return dt.getTime()
  }, [dateStr, timeStr, match.at])

  // 2. Quản lý điểm các set
  const oldSets = match.sets || []
  const [sets, setSets] = useState(() => {
    if (oldSets.length > 0) {
      return oldSets.map((s) => [s[0], s[1]])
    }
    return [[21, 19]]
  })
  const [activeSetIdx, setActiveSetIdx] = useState(0)

  const teamA = match.teamA || []
  const teamB = match.teamB || []

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  // Rating trung bình 2 đội
  const ratingsMap = useMemo(() => {
    const map = {}
    ;(db.playerRatings || []).forEach((r) => {
      map[r.memberId] = r.rating
    })
    return map
  }, [db.playerRatings])

  const ratingA = useMemo(() => teamRating(teamA, ratingsMap), [teamA, ratingsMap])
  const ratingB = useMemo(() => teamRating(teamB, ratingsMap), [teamB, ratingsMap])

  // Chuyển đổi định dạng trận 1 Set vs 3 Set (BO3)
  const setMatchFormat = (mode) => {
    if (mode === 'single') {
      setSets((prev) => [[prev[0]?.[0] ?? 21, prev[0]?.[1] ?? 19]])
      setActiveSetIdx(0)
    } else {
      setSets((prev) => {
        const next = [...prev]
        while (next.length < 3) {
          next.push([21, 19])
        }
        return next
      })
    }
  }

  // Set đang chọn chỉnh sửa
  const currentSet = sets[activeSetIdx] || sets[0] || [21, 19]
  const [scoreA, scoreB] = currentSet
  const activeWinner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null

  // Phát hiện preset hiện tại của set đang chọn
  const activePreset = useMemo(() => {
    const maxS = Math.max(scoreA, scoreB)
    const minS = Math.min(scoreA, scoreB)
    if (maxS === 21 && minS === 19) return '21-19'
    if (maxS === 21 && minS === 15) return '21-15'
    if (maxS === 21 && minS === 11) return '21-11'
    return 'custom'
  }, [scoreA, scoreB])

  const [customExpanded, setCustomExpanded] = useState(false)
  const showCustomBox = customExpanded || activePreset === 'custom'

  // Chạm 1 chạm vào thẻ đội -> Chọn đội đó thắng set hiện tại
  const handleSelectWinner = (team) => {
    setSets((prev) => {
      const next = [...prev]
      const curr = next[activeSetIdx] || [21, 19]
      const curA = curr[0]
      const curB = curr[1]
      let newA, newB

      if (activePreset === '21-19') {
        newA = team === 'A' ? 21 : 19
        newB = team === 'B' ? 21 : 19
      } else if (activePreset === '21-15') {
        newA = team === 'A' ? 21 : 15
        newB = team === 'B' ? 21 : 15
      } else if (activePreset === '21-11') {
        newA = team === 'A' ? 21 : 11
        newB = team === 'B' ? 21 : 11
      } else {
        // Chế độ tùy chỉnh: hoán đổi điểm nếu đội vừa chọn đang bị điểm thấp hơn hoặc hòa
        if (team === 'A' && curA <= curB) {
          newA = Math.max(curA, curB) || 21
          newB = Math.min(curA, curB) === newA ? Math.max(0, newA - 2) : Math.min(curA, curB)
        } else if (team === 'B' && curB <= curA) {
          newB = Math.max(curA, curB) || 21
          newA = Math.min(curA, curB) === newB ? Math.max(0, newB - 2) : Math.min(curA, curB)
        } else {
          newA = curA
          newB = curB
        }
      }
      next[activeSetIdx] = [newA, newB]
      return next
    })
  }

  // Chọn nút preset tỷ số (21-19, 21-15, 21-11, Khác)
  const handleSelectPreset = (preset) => {
    if (preset === 'custom') {
      setCustomExpanded(true)
      return
    }
    setCustomExpanded(false)
    const [pa, pb] = preset.split('-').map(Number)
    setSets((prev) => {
      const next = [...prev]
      const curr = next[activeSetIdx] || [21, 19]
      const winnerIsB = curr[1] > curr[0]
      next[activeSetIdx] = winnerIsB ? [pb, pa] : [pa, pb]
      return next
    })
  }

  // Điều chỉnh tỷ số tùy chỉnh bằng Stepper [-] / [+]
  const updateScore = (setIdx, teamIdx, delta) => {
    setCustomExpanded(true)
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

  // Nhập điểm trực tiếp
  const setScoreDirect = (setIdx, teamIdx, valStr) => {
    setCustomExpanded(true)
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

  // Đảo tỷ số set hiện tại
  const handleSwapActiveScores = () => {
    setCustomExpanded(true)
    setSets((prev) => {
      const next = [...prev]
      const curr = next[activeSetIdx] || [21, 19]
      next[activeSetIdx] = [curr[1], curr[0]]
      return next
    })
  }

  // Áp dụng tỷ số phụ từ danh sách preset mở rộng
  const handleApplySubPreset = (pa, pb) => {
    setCustomExpanded(true)
    setSets((prev) => {
      const next = [...prev]
      const curr = next[activeSetIdx] || [21, 19]
      const winnerIsB = curr[1] > curr[0]
      next[activeSetIdx] = winnerIsB ? [pb, pa] : [pa, pb]
      return next
    })
  }

  // Tổng hợp số set thắng của mỗi bên
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
  const hasTieSet = sets.some(([a, b]) => a === b)
  const isMatchTied = hasTieSet || setsWon.wonA === setsWon.wonB

  // Tính preview biến động điểm Elo
  const playerDeltasPreview = useMemo(() => {
    if (!newWinnerTeam || teamA.length === 0 || teamB.length === 0 || match.ratingEnabled === false) return null
    try {
      const gamesCountMap = {}
      ;[...teamA, ...teamB].forEach((id) => {
        const pr = getPlayerRating(db.playerRatings, id)
        gamesCountMap[id] = pr?.gamesCount || 0
      })
      const validSets = sets.filter(([a, b]) => a > 0 || b > 0)
      return calcPlayerDeltas({
        teamA,
        teamB,
        aWon: newWinnerTeam === 'A',
        ratingsMap,
        gamesCountMap,
        sets: validSets.length ? validSets : sets,
      })
    } catch {
      return null
    }
  }, [newWinnerTeam, teamA, teamB, sets, ratingsMap, db.playerRatings, match.ratingEnabled])

  // Lưu điểm & giờ (KHÔNG bắt buộc nhập lý do)
  const handleSave = async () => {
    if (isMatchTied || !newWinnerTeam) {
      setErrorMsg(t('matchSearch.noTie'))
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = a.editMatchScore({
        matchId: match.id,
        sets,
        at: finalTimestamp,
        reason: t('matchSearch.btnSaveEdit'),
      })
      if (res && onSaved) onSaved(res)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || t('matchSearch.errorEdit'))
    } finally {
      setSubmitting(false)
    }
  }

  // Xóa trận đấu
  const handleCancelMatch = () => {
    a.confirm({
      title: t('matchSearch.cancelMatchTitle'),
      message: t('matchSearch.cancelMatchMsg'),
      tone: 'danger',
      confirmText: t('matchSearch.cancelMatchOk'),
      onConfirm: () => {
        try {
          a.cancelMatch({ matchId: match.id, reason: t('common.delete') })
          if (onSaved) onSaved({ matchId: match.id, cancelled: true })
          onClose()
        } catch (err) {
          setErrorMsg(err.message || t('matchSearch.errorEdit'))
        }
      },
    })
  }

  const matchEdits = useMemo(() => {
    return (db.matchEdits || []).filter((e) => e.matchId === match.id)
  }, [db.matchEdits, match.id])

  const oldScoreStr = oldSets.map(([a, b]) => `${a}-${b}`).join(', ')
  const newScoreStr = sets.map(([a, b]) => `${a}-${b}`).join(', ')

  return (
    <Dialog
      open
      sheet={isMobile}
      width={560}
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
            disabled={!newWinnerTeam || isMatchTied || submitting}
            onClick={handleSave}
            style={{
              flex: 1,
              height: isMobile ? 54 : 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--action-primary-bg)',
              border: 'none',
              font: '700 15px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--action-primary-fg, #ffffff)',
              cursor: !newWinnerTeam || isMatchTied || submitting ? 'not-allowed' : 'pointer',
              opacity: !newWinnerTeam || isMatchTied || submitting ? 0.45 : 1,
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? t('common.saving') : t('matchSearch.btnSaveEdit')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleCancelMatch}
            style={{
              height: isMobile ? 54 : 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              font: '600 13px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--status-incident-fg, #ef4444)',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {t('common.delete')}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: isMobile ? 54 : 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
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
        {/* 1. KHỐI CHỈNH SỬA GIỜ VÀ NGÀY THI ĐẤU */}
        <div style={S.timeEditorBox}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={15} color="var(--status-transit-fg)" />
              <span style={{ font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('matchSearch.colWhen')}
              </span>
            </div>
            {/* Nút chỉnh nhanh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => adjustMinutes(-15)}
                style={S.timeNudgeBtn}
                title={t('matchSearch.timeSub15')}
              >
                −15p
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(15)}
                style={S.timeNudgeBtn}
                title={t('matchSearch.timeAdd15')}
              >
                +15p
              </button>
              <button
                type="button"
                onClick={setTimeToNow}
                style={S.timeNudgeBtn}
                title={t('matchSearch.timeNowTitle')}
              >
                {t('matchSearch.timeNow')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              style={S.dateInput}
            />
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              style={S.timeInput}
            />
          </div>
        </div>

        {/* 2. KHỐI SO SÁNH TỶ SỐ CŨ VS MỚI */}
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

        {/* 3. ĐIỀU CHỈNH ĐỊNH DẠNG SET (1 SET vs 3 SET) & TABS NẾU CÓ NHIỀU SET */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sets.length > 1 &&
              sets.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveSetIdx(idx)
                    setCustomExpanded(false)
                  }}
                  style={{
                    ...S.setTabBtn,
                    ...(activeSetIdx === idx ? S.setTabBtnActive : {}),
                  }}
                >
                  <span>{t('scoreModal.setLabel', { n: idx + 1 })}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>({s[0]}-{s[1]})</span>
                </button>
              ))}
          </div>

          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setMatchFormat('single')}
              style={{
                ...S.formatBtn,
                ...(sets.length === 1 ? S.formatBtnActive : {}),
              }}
            >
              {t('scoreModal.format1Set')}
            </button>
            <button
              type="button"
              onClick={() => setMatchFormat('bo3')}
              style={{
                ...S.formatBtn,
                ...(sets.length === 3 ? S.formatBtnActive : {}),
              }}
            >
              {t('scoreModal.format3Set')}
            </button>
          </div>
        </div>

        {/* 4. KHỐI NHẬP TỶ SỐ MỀM MẠI (THEO PHONG CÁCH MÀN GHI ĐIỂM) */}
        <div style={S.scoreLoggerBox}>
          <div style={S.instructionHeader}>
            {t('scoreModal.instruction')}
          </div>

          {/* 2 Thẻ Đội A và Đội B */}
          <div style={S.teamsChoiceGrid}>
            {/* Thẻ Đội A */}
            <div
              onClick={() => handleSelectWinner('A')}
              style={{
                ...S.teamChoiceCard,
                ...(activeWinner === 'A' ? S.teamChoiceCardWon : {}),
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: activeWinner === 'A' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {nameTeamA}
                </div>
                <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: activeWinner === 'A' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                  {ratingA > 0 ? `${t('scoreModal.teamAvg')}: ${ratingA}` : t('scoreModal.teamAvg')}
                </div>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setCustomExpanded(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                title={t('scoreModal.customScoreTitle')}
              >
                {activeWinner === 'A' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
                <div style={activeWinner === 'A' ? S.bigScoreWon : S.bigScoreLost}>
                  {scoreA}
                </div>
              </div>
            </div>

            {/* Thẻ Đội B */}
            <div
              onClick={() => handleSelectWinner('B')}
              style={{
                ...S.teamChoiceCard,
                ...(activeWinner === 'B' ? S.teamChoiceCardWon : {}),
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: activeWinner === 'B' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {nameTeamB}
                </div>
                <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: activeWinner === 'B' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                  {ratingB > 0 ? `${t('scoreModal.teamAvg')}: ${ratingB}` : t('scoreModal.teamAvg')}
                </div>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setCustomExpanded(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                title={t('scoreModal.customScoreTitle')}
              >
                {activeWinner === 'B' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
                <div style={activeWinner === 'B' ? S.bigScoreWon : S.bigScoreLost}>
                  {scoreB}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Nút preset tỷ số nhanh */}
          <div style={S.presetRow}>
            {['21-19', '21-15', '21-11'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                style={{
                  ...S.presetBtn,
                  ...(activePreset === p && !customExpanded ? S.presetBtnActive : {}),
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
                ...(showCustomBox ? S.presetBtnActive : {}),
              }}
            >
              {t('scoreModal.presetOther')}
            </button>
          </div>

          {/* Khối tùy chỉnh tỷ số chi tiết (khi chọn "Khác" hoặc tỷ số ngoài chuẩn) */}
          {showCustomBox && (
            <div style={S.customScoreBox}>
              <div style={S.customScoreHeader}>
                <span style={{ font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                  {t('scoreModal.customScoreTitle')} ({t('scoreModal.setLabel', { n: activeSetIdx + 1 })})
                </span>
                {scoreA === scoreB && (
                  <span style={{ color: 'var(--status-delayed-fg, #f59e0b)', fontSize: 11.5, fontWeight: 500 }}>
                    {t('quickMatch.errTie')}
                  </span>
                )}
              </div>

              <div style={S.customScoreRow}>
                {/* Cột điểm Đội A */}
                <div style={S.customTeamCol}>
                  <span style={S.customTeamName}>{nameTeamA}</span>
                  <div style={S.stepperBox}>
                    <button
                      type="button"
                      onClick={() => updateScore(activeSetIdx, 0, -1)}
                      style={S.stepBtn}
                      title="-1"
                    >−</button>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={scoreA}
                      onChange={(e) => setScoreDirect(activeSetIdx, 0, e.target.value)}
                      style={{
                        ...S.scoreBox,
                        borderColor: activeWinner === 'A' ? 'var(--status-transit-fg)' : 'var(--border-default)',
                        color: activeWinner === 'A' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateScore(activeSetIdx, 0, 1)}
                      style={S.stepBtn}
                      title="+1"
                    >+</button>
                  </div>
                </div>

                {/* Nút đổi điểm hai bên */}
                <button
                  type="button"
                  title={t('scoreModal.swapScore')}
                  onClick={handleSwapActiveScores}
                  style={S.swapBtn}
                >
                  ⇄
                </button>

                {/* Cột điểm Đội B */}
                <div style={S.customTeamCol}>
                  <span style={S.customTeamName}>{nameTeamB}</span>
                  <div style={S.stepperBox}>
                    <button
                      type="button"
                      onClick={() => updateScore(activeSetIdx, 1, -1)}
                      style={S.stepBtn}
                      title="-1"
                    >−</button>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={scoreB}
                      onChange={(e) => setScoreDirect(activeSetIdx, 1, e.target.value)}
                      style={{
                        ...S.scoreBox,
                        borderColor: activeWinner === 'B' ? 'var(--status-transit-fg)' : 'var(--border-default)',
                        color: activeWinner === 'B' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateScore(activeSetIdx, 1, 1)}
                      style={S.stepBtn}
                      title="+1"
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Hàng tỷ số nhanh bổ sung */}
              <div style={S.subPresetRow}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('scoreModal.quickPresets')}:
                </span>
                {[
                  [21, 18],
                  [21, 16],
                  [21, 14],
                  [21, 12],
                  [21, 0],
                  [30, 29],
                ].map(([pa, pb]) => (
                  <button
                    key={`${pa}-${pb}`}
                    type="button"
                    onClick={() => handleApplySubPreset(pa, pb)}
                    style={S.subPresetBtn}
                  >
                    {pa}–{pb}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. PREVIEW BIẾN ĐỘNG RATING ELO DỰ KIẾN */}
        {playerDeltasPreview && (
          <div style={S.ratingPreviewBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                {t('scoreModal.ratingDelta')}
              </span>
              {playerDeltasPreview.multiplier > 1 && (
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-nav-active)', color: 'var(--status-transit-fg)', fontWeight: 600 }}>
                  {t('rating.multiplier', { mult: playerDeltasPreview.multiplier.toFixed(2), val: playerDeltasPreview.multiplier.toFixed(2) })}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <div style={{ color: 'var(--status-transit-fg)' }}>
                {teamA.map((id) => `${playerName(db, id)} (${playerDeltasPreview.deltas?.[id] > 0 ? `+${playerDeltasPreview.deltas[id]}` : playerDeltasPreview.deltas?.[id] || 0})`).join(' · ')}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {teamB.map((id) => `${playerName(db, id)} (${playerDeltasPreview.deltas?.[id] > 0 ? `+${playerDeltasPreview.deltas[id]}` : playerDeltasPreview.deltas?.[id] || 0})`).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* 6. CẢNH BÁO AUDIT & CASCADE */}
        <div style={S.noticeBox}>
          <span style={{ color: 'var(--status-delayed-fg)', fontWeight: 600 }}>⚠️ {t('matchSearch.recalcNotice')}</span>
        </div>

        {/* 7. LỊCH SỬ CHỈNH SỬA NẾU CÓ */}
        {matchEdits.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
            <span style={{ font: '600 12px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
              {t('common.more')} ({matchEdits.length})
            </span>
            <div style={{ display: 'grid', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
              {matchEdits.map((ed) => (
                <div
                  key={ed.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-inset)',
                    fontSize: 12,
                    borderLeft: '2px solid var(--status-transit-fg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>{playerName(db, ed.editedBy) || t('common.unknown')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(ed.editedAt).toLocaleDateString('vi-VN')} {new Date(ed.editedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {ed.reason} {ed.newValue && `(${ed.newValue})`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
  timeEditorBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  timeNudgeBtn: {
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  dateInput: {
    flex: 1,
    height: 38,
    padding: '0 10px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    outline: 'none',
  },
  timeInput: {
    width: 120,
    height: 38,
    padding: '0 10px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    textAlign: 'center',
    outline: 'none',
  },
  compareBox: {
    display: 'grid',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  formatBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    color: 'var(--text-muted)',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  formatBtnActive: {
    borderColor: 'var(--status-transit-fg)',
    background: 'var(--surface-nav-active)',
    color: 'var(--status-transit-fg)',
  },
  setTabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  setTabBtnActive: {
    borderColor: 'var(--status-transit-fg)',
    background: 'var(--surface-nav-active)',
    color: 'var(--status-transit-fg)',
  },
  scoreLoggerBox: {
    display: 'grid',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  instructionHeader: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  teamsChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 10,
  },
  teamChoiceCard: {
    borderRadius: 10,
    padding: '12px',
    background: 'var(--surface-card)',
    border: '1.5px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  teamChoiceCardWon: {
    background: 'var(--status-transit-bg)',
    borderColor: 'var(--status-transit-fg)',
  },
  wonBadge: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
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
    font: '700 24px/1 Barlow, sans-serif',
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
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--text-muted)',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  presetBtn: {
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '600 13px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  presetBtnActive: {
    background: 'var(--action-primary-bg)',
    borderColor: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg, #ffffff)',
  },
  customScoreBox: {
    background: 'var(--surface-card)',
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
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
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
    background: 'var(--surface-sunken)',
    borderRadius: 'var(--radius-md)',
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
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
  },
  scoreBox: {
    width: 52,
    height: 38,
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)',
    fontFamily: 'var(--font-mono)',
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
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
    marginTop: 20,
    transition: 'all 0.15s ease',
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
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: '600 11px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  ratingPreviewBox: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
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
