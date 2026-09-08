import { useState, useMemo, useEffect } from 'react'
import { Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName } from '#lib/money.js'
import { matchCodeOf, teamRating, calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
import { t } from '#i18n'

export default function EditScoreModal({ match: initialMatch, onClose, onSaved, onNavigateMatch }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [currentMatch, setCurrentMatch] = useState(initialMatch)
  const match = currentMatch || initialMatch
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [reason, setReason] = useState('')

  // Danh sách các trận để điều hướng Trận trước / Trận sau
  const { prevMatch, nextMatch } = useMemo(() => {
    const allMatches = db.matches || []
    const idx = allMatches.findIndex((m) => m.id === match.id)
    return {
      prevMatch: idx > 0 ? allMatches[idx - 1] : null,
      nextMatch: idx >= 0 && idx < allMatches.length - 1 ? allMatches[idx + 1] : null,
    }
  }, [db.matches, match.id])

  const handleNavigate = (targetMatch) => {
    if (!targetMatch) return
    setCurrentMatch(targetMatch)
    if (onNavigateMatch) onNavigateMatch(targetMatch)
  }

  // 1. Quản lý Ngày & Giờ thi đấu của trận
  const session = useMemo(() => {
    return (db.sessions || []).find((s) => s.id === match.sessionId)
  }, [db.sessions, match.sessionId])

  const courtObj = session?.courts?.[match.courtIdx]
  const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (match.courtIdx ?? 0) + 1 }) : '')

  const { initDateStr, initTimeStr } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
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

  // Cập nhật date/time khi chuyển trận
  useEffect(() => {
    setDateStr(initDateStr)
    setTimeStr(initTimeStr)
  }, [initDateStr, initTimeStr])

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
    // eslint-disable-next-line react-hooks/purity
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

  // Reset sets khi đổi trận
  useEffect(() => {
    if (oldSets.length > 0) {
      setSets(oldSets.map((s) => [s[0], s[1]]))
    } else {
      setSets([[21, 19]])
    }
    setActiveSetIdx(0)
  }, [match.id, oldSets])

  const teamA = match.teamA || []
  const teamB = match.teamB || []

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  // Rating trung bình 2 đội
  const ratingsMap = useMemo(() => {
    const map = {}
    if (Array.isArray(db.playerRatings)) {
      db.playerRatings.forEach((r) => {
        const mid = r.memberId || r.playerId || r.id
        if (mid) map[mid] = r.rating
      })
    } else if (db.playerRatings && typeof db.playerRatings === 'object') {
      Object.entries(db.playerRatings).forEach(([mid, r]) => {
        map[mid] = typeof r === 'object' && r !== null ? r.rating : r
      })
    }
    ;[...teamA, ...teamB].forEach((id) => {
      if (map[id] == null) {
        const mem = (db.members || []).find((m) => m.id === id) || (db.guests || []).find((g) => g.id === id)
        const pr = getPlayerRating(db.playerRatings, id, mem, db.levels)
        map[id] = pr?.rating || 1500
      }
    })
    return map
  }, [db.playerRatings, db.members, db.guests, db.levels, teamA, teamB])

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
        const mem = (db.members || []).find((m) => m.id === id) || (db.guests || []).find((g) => g.id === id)
        const pr = getPlayerRating(db.playerRatings, id, mem, db.levels)
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
  }, [newWinnerTeam, teamA, teamB, sets, ratingsMap, db.playerRatings, db.members, db.guests, db.levels, match.ratingEnabled])

  // Thống kê tác động Cascade (Screen DS2: Sửa trận cũ ảnh hưởng gì)
  const subsequentStats = useMemo(() => {
    const allMatches = db.matches || []
    const matchTime = match.at || (match.createdAt ? Date.parse(match.createdAt) : 0)
    const subsequent = allMatches.filter((m) => {
      if (m.id === match.id) return false
      const mTime = m.at || (m.createdAt ? Date.parse(m.createdAt) : 0)
      return mTime >= matchTime
    })
    const playerSet = new Set()
    ;[...teamA, ...teamB].forEach((id) => playerSet.add(id))
    const monthsSet = new Set()
    if (match.at) {
      const d = new Date(match.at)
      if (!isNaN(d.getTime())) {
        monthsSet.add(`T${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
    }
    subsequent.forEach((m) => {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      keys.forEach((k) => playerSet.add(k))
      if (m.at) {
        const d = new Date(m.at)
        if (!isNaN(d.getTime())) {
          monthsSet.add(`T${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
      }
    })
    return {
      subsequentCount: subsequent.length,
      affectedPlayersCount: playerSet.size,
      affectedMonths: Array.from(monthsSet).join(' · ') || 'T09',
      algorithm: match.ratingAlgorithm || 'ELO_V1',
    }
  }, [db.matches, match, teamA, teamB])

  // Bảng so sánh Rating Before vs After của 4 VĐV (Screen DS2)
  const ratingComparison = useMemo(() => {
    const oldDelta = Math.abs(match.eloDelta != null ? match.eloDelta : 8)
    const oldWonA = match.winnerTeam === 'A'
    const newWonA = newWinnerTeam === 'A'
    const newDelta = Math.abs(playerDeltasPreview?.delta != null ? playerDeltasPreview.delta : 8)

    const computeRow = (id, inTeamA) => {
      const mem = (db.members || []).find((m) => m.id === id) || (db.guests || []).find((g) => g.id === id)
      const pr = getPlayerRating(db.playerRatings, id, mem, db.levels)
      const baseRating = inTeamA
        ? (match.initialRatingA ? Math.round(match.initialRatingA) : pr.rating)
        : (match.initialRatingB ? Math.round(match.initialRatingB) : pr.rating)

      const oldChange = (inTeamA && oldWonA) || (!inTeamA && !oldWonA) ? oldDelta : -oldDelta
      const oldAfter = baseRating + oldChange

      const pDelta = playerDeltasPreview?.deltas?.[id]
      const newChange = pDelta != null ? pDelta : ((inTeamA && newWonA) || (!inTeamA && !newWonA) ? newDelta : -newDelta)
      const newAfter = baseRating + newChange

      return {
        id,
        name: playerName(db, id),
        baseRating,
        oldChange,
        oldAfter,
        newChange,
        newAfter,
      }
    }

    return {
      teamA: teamA.map((id) => computeRow(id, true)),
      teamB: teamB.map((id) => computeRow(id, false)),
    }
  }, [match, teamA, teamB, newWinnerTeam, playerDeltasPreview, db.playerRatings, db.members, db.guests, db.levels, db])

  // Lưu điểm & giờ
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
        reason: reason.trim() || t('matchSearch.btnSaveEdit'),
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
          a.cancelMatch({ matchId: match.id, reason: reason.trim() || t('common.delete') })
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

  const oldScoreStr = oldSets.map(([aScore, bScore]) => `${aScore}–${bScore}`).join(', ')
  const newScoreStr = sets.map(([aScore, bScore]) => `${aScore}–${bScore}`).join(', ')
  const isScoreModified = oldScoreStr !== newScoreStr

  return (
    <Dialog
      open
      sheet={isMobile}
      width={isMobile ? 560 : 960}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ font: '700 18px/1.2 Barlow, sans-serif' }}>
              {t('matchDetail.matchCode', { code: matchCodeOf(db, match) })}
            </span>
            <span style={{ font: '400 13px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
              {dateStr ? `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}` : ''} · {courtLabel || t('challenge.fromCourt')} · {sets.length > 1 ? 'BO3' : 'BO1'}
            </span>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                disabled={!prevMatch}
                onClick={() => handleNavigate(prevMatch)}
                style={{
                  ...S.navMatchBtn,
                  opacity: prevMatch ? 1 : 0.4,
                  cursor: prevMatch ? 'pointer' : 'not-allowed',
                }}
                title={prevMatch ? matchCodeOf(db, prevMatch) : undefined}
              >
                ← {t('matchSearch.btnPrevMatch')}
              </button>
              <button
                type="button"
                disabled={!nextMatch}
                onClick={() => handleNavigate(nextMatch)}
                style={{
                  ...S.navMatchBtn,
                  opacity: nextMatch ? 1 : 0.4,
                  cursor: nextMatch ? 'pointer' : 'not-allowed',
                }}
                title={nextMatch ? matchCodeOf(db, nextMatch) : undefined}
              >
                {t('matchSearch.btnNextMatch')} →
              </button>
            </div>
          )}
        </div>
      }
      onClose={onClose}
      style={{
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={submitting}
            onClick={handleCancelMatch}
            style={{
              height: isMobile ? 50 : 42,
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
              height: isMobile ? 50 : 42,
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              font: '600 13px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!newWinnerTeam || isMatchTied || submitting}
            onClick={handleSave}
            style={{
              height: isMobile ? 50 : 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--action-primary-bg)',
              border: 'none',
              font: '700 14px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--action-primary-fg, #ffffff)',
              cursor: !newWinnerTeam || isMatchTied || submitting ? 'not-allowed' : 'pointer',
              opacity: !newWinnerTeam || isMatchTied || submitting ? 0.45 : 1,
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? t('common.saving') : t('matchSearch.btnSaveAndRecalc')}
          </button>
        </div>
      }
    >
      {/* Banner thông báo trạng thái chỉnh sửa */}
      {isScoreModified && (
        <div style={{
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 178, 169, 0.12)',
          border: '1px solid #00B2A9',
          color: '#5FDBD3',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>✎</span>
          <span>{t('matchSearch.editingNotice', { set: activeSetIdx + 1, oldScore: oldScoreStr, newScore: newScoreStr })}</span>
        </div>
      )}

      {/* Grid 2 cột trên Desktop (DS2 chuẩn handoff) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* CỘT TRÁI: Nhập điểm, Đổi giờ, Preview Rating 4 người */}
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

          {/* 2. ĐIỀU CHỈNH ĐỊNH DẠNG SET (1 SET vs 3 SET) & TABS NẾU CÓ NHIỀU SET */}
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

          {/* 3. KHỐI NHẬP TỶ SỐ (PRESETS + CUSTOM) */}
          <div style={S.scoreLoggerBox}>
            <div style={S.instructionHeader}>
              {t('scoreModal.instruction')}
            </div>

            <div style={S.teamsChoiceGrid}>
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
                  <div style={S.customTeamCol}>
                    <span style={S.customTeamName}>{nameTeamA}</span>
                    <div style={S.stepperBox}>
                      <button
                        type="button"
                        onClick={() => updateScore(activeSetIdx, 0, -1)}
                        style={S.stepBtn}
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
                      >+</button>
                    </div>
                  </div>

                  <button
                    type="button"
                    title={t('scoreModal.swapScore')}
                    onClick={handleSwapActiveScores}
                    style={S.swapBtn}
                  >
                    ⇄
                  </button>

                  <div style={S.customTeamCol}>
                    <span style={S.customTeamName}>{nameTeamB}</span>
                    <div style={S.stepperBox}>
                      <button
                        type="button"
                        onClick={() => updateScore(activeSetIdx, 1, -1)}
                        style={S.stepBtn}
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
                      >+</button>
                    </div>
                  </div>
                </div>

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

          {/* 4. BẢNG SO SÁNH RATING BEFORE VS AFTER CỦA 4 VĐV (Chuẩn DS2) */}
          <div style={{
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'var(--surface-card)',
            }}>
              <span style={{ font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('matchSearch.ratingCurrentSaved')}
              </span>
              <span style={{ font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--status-transit-fg)' }}>
                {t('matchSearch.ratingAfterEdit')}
              </span>
            </div>

            <div style={{ padding: '10px 14px', display: 'grid', gap: 8 }}>
              {[...ratingComparison.teamA, ...ratingComparison.teamB].map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--text-primary)', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name}
                  </span>
                  {/* Rating đang lưu */}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {row.baseRating} <span style={{ color: row.oldChange >= 0 ? '#5FD9A2' : '#FF8578' }}>{row.oldChange >= 0 ? `+${row.oldChange}` : row.oldChange}</span> → {row.oldAfter}
                  </span>
                  {/* Sau khi sửa */}
                  <span style={{ color: 'var(--status-transit-fg)', fontWeight: 700 }}>
                    <span style={{ color: row.newChange >= 0 ? '#5FD9A2' : '#FF8578' }}>{row.newChange >= 0 ? `+${row.newChange}` : row.newChange}</span> → {row.newAfter}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: Giải trình Cascade Recalculation + Audit Log + Lý do sửa */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 1. THẺ SỬA TRẬN CŨ ẢNH HƯỞNG GÌ (Chuẩn DS2 lines 2719-2735) */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: 14,
            display: 'grid',
            gap: 12,
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 15px/1.25 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                {t('matchSearch.cascadeImpactTitle')}
              </div>
              <div style={{ font: '400 12.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('matchSearch.cascadeRecalcSub', { count: subsequentStats.subsequentCount })}
              </div>
            </div>

            {/* Grid 4 chỉ số */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchSearch.cascadeRecalcMatches')}</span>
                <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>{subsequentStats.subsequentCount + 1}</span>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchSearch.cascadeRecalcPlayers')}</span>
                <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>{subsequentStats.affectedPlayersCount}</span>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchSearch.cascadeAffectedMonths')}</span>
                <span style={{ font: '700 15px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>{subsequentStats.affectedMonths}</span>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchSearch.ratingAlgorithm')}</span>
                <span style={{ font: '700 13px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg)' }}>{subsequentStats.algorithm}</span>
              </div>
            </div>

            <div style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
              {t('matchSearch.frozenAlgorithmNotice')}
            </div>
          </div>

          {/* 2. THẺ LỊCH SỬ SỬA TRẬN (AUDIT LOG - Chuẩn DS2 lines 2695-2715) */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: 14,
            display: 'grid',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: '600 14px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('matchSearch.auditTitle')}
              </div>
              <span style={{
                font: '600 10.5px/1 "IBM Plex Sans", sans-serif',
                padding: '3px 8px',
                borderRadius: 999,
                background: matchEdits.length > 0 ? 'rgba(0,178,169,.15)' : 'var(--surface-sunken)',
                color: matchEdits.length > 0 ? '#5FDBD3' : 'var(--text-muted)',
              }}>
                {matchEdits.length > 0 ? t('matchSearch.auditHasEdits') : t('matchSearch.auditRecordsCount', { count: 0 })}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {matchEdits.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                  {t('matchSearch.auditRecordsCount', { count: 0 })}
                </div>
              ) : (
                matchEdits.map((ed) => (
                  <div
                    key={ed.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-sunken)',
                      fontSize: 12,
                      borderLeft: '2px solid var(--status-transit-fg)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{playerName(db, ed.editedBy) || t('common.unknown')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {new Date(ed.editedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} {new Date(ed.editedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {ed.reason || t('matchSearch.btnSaveEdit')} {ed.newValue && `(${ed.newValue})`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. THẺ LÝ DO SỬA (BẮT BUỘC THEO SỔ KIỂM TOÁN - Chuẩn DS2 lines 2736-2745) */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: 14,
            display: 'grid',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <label style={{ font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('matchSearch.fieldReason')}
              </label>
              <span style={{ font: '400 11.5px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('matchSearch.editDesc')}
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('matchSearch.phReason')}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--status-incident-fg, var(--red-500))', fontSize: 13, fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  navMatchBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
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
