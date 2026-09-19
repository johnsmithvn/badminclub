import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
import { playerName, playerOf, myMember } from '#lib/money.js'
import { calculateMemberBadges, computeClubBadgeStats, getBadgeById, newlyUnlockedBadges } from '#lib/badges.js'
import { resolveSeason, seasonMatchesOf } from '#lib/season.js'
import { seenBadgesKey, markBadgeSeen } from '#utils/seenBadges.js'
import BadgeUnlockModal from '#components/badges/BadgeUnlockModal.jsx'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Chụp trạng thái danh hiệu của một thành viên.
 * Phải truyền ĐỦ season / seasonMatches / clubStats giống trang Danh hiệu và
 * GlobalBadgeUnlockHost — gọi trần thì đây thành nguồn sự thật thứ hai và modal sẽ chúc mừng
 * danh hiệu mà trang Danh hiệu không công nhận.
 */
function badgesSnapshotOf(memberId, dbSnapshot) {
  const season = resolveSeason(dbSnapshot)
  const seasonMatches = seasonMatchesOf(dbSnapshot, season) || []
  const clubStats = computeClubBadgeStats(dbSnapshot, season, seasonMatches)
  return calculateMemberBadges(memberId, dbSnapshot, season, seasonMatches, clubStats)
}

export default function ScoreModal({ court, session, challenge, onClose, onSaved, onLoadToCourt }) {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const [submitting, setSubmitting] = useState(false)
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const [pendingSavedRes, setPendingSavedRes] = useState(null)
  const currentMember = useMemo(() => myMember(db), [db])

  // Xác định Đội A và Đội B từ court hoặc challenge
  const teamA = useMemo(() => {
    if (court?.teamA?.length) return court.teamA
    if (challenge) return challenge.teamA || []
    if (court && court.slots) return [court.slots[0], court.slots[1]].filter(Boolean)
    return []
  }, [challenge, court])

  const teamB = useMemo(() => {
    if (court?.teamB?.length) return court.teamB
    if (challenge) return challenge.teamB || []
    if (court && court.slots) return [court.slots[2], court.slots[3]].filter(Boolean)
    return []
  }, [challenge, court])

  // Trận chia sân / phong trào mặc định 1 set (1 ván 21đ). Kèo thách đấu BO3 mới mặc định 3 set.
  const isChallengeBo3 = challenge?.bestOf === 3 || court?.bestOf === 3
  const [sets, setSets] = useState(() => {
    if (court?.initialSets?.length) return court.initialSets
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
      const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
      ratingsMap[id] = pr.rating
      gamesCountMap[id] = pr.gamesCount || 0
    })
    return calcPlayerDeltas({
      teamA,
      teamB,
      aWon: winnerTeam === 'A',
      ratingsMap,
      gamesCountMap,
      sets,
    })
  }, [winnerTeam, teamA, teamB, sets, db])

  const isRatingEnabled = challenge ? challenge.ratingEnabled !== false : (court?.ratingEnabled !== undefined ? court.ratingEnabled : true)

  const ratingDeltaPreview = useMemo(() => {
    if (!isRatingEnabled) return null
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
  }, [isRatingEnabled, playerDeltasPreview, teamA, teamB, db])

  const handleFinishScore = (highlightBadgeId = null) => {
    if (pendingSavedRes && onSaved) onSaved(pendingSavedRes)
    setUnlockedBadge(null)
    onClose()
    if (highlightBadgeId) {
      navigate(`/danh-hieu?tab=collection&highlight=${highlightBadgeId}`)
    }
  }

  const handleSave = () => {
    if (!winnerTeam || submitting) return
    setSubmitting(true)
    try {
      // 1. Kiểm tra huy hiệu trước khi lưu (nếu có currentMember)
      let badgesBefore = null
      if (currentMember?.id) {
        try {
          badgesBefore = badgesSnapshotOf(currentMember.id, db)
        } catch {
          badgesBefore = null
        }
      }

      // Lọc các set hợp lệ
      const finalSets = sets.filter(([a, b]) => a > 0 || b > 0)
      const res = a.saveMatchScore({
        sessionId: session?.id || null,
        courtIdx: court?.courtIndex ?? court?.courtIdx ?? 0,
        courtId: court?.courtId || null,
        challengeId: challenge?.id || court?.fromChallengeId || court?.selectedChallengeId || null,
        ratingEnabled: isRatingEnabled,
        teamA,
        teamB,
        sets: finalSets.length ? finalSets : sets,
        winnerTeam,
        minutes: court?.minutes || (court?.startedAt ? Math.max(1, Math.round((Date.now() - court.startedAt) / 60000)) : cfg.match?.defaultMinutes || 20),
      })

      // saveMatchScore trả kèm nextPlayerRatings — tách ra để phần dưới làm việc với một match
      // object sạch, đúng shape DB.
      const { nextPlayerRatings = null, ...savedMatch } = res || {}
      const saved = res ? savedMatch : null

      // 2. Kiểm tra nếu có bounty bị ngắt (AM4 case chính) hoặc có huy hiệu mới mở khóa
      let badgeToUnlock = null

      if (saved?.bountyBroken) {
        const losingTeam = saved.winnerTeam === 'A' ? teamB : teamA
        const winningTeam = saved.winnerTeam === 'A' ? teamA : teamB
        const victims = (saved.bountyVictimIds && saved.bountyVictimIds.length > 0) ? saved.bountyVictimIds : losingTeam
        const victimName = victims.map((id) => playerName(db, id)).join(' · ')
        const baseBadge = getBadgeById('ke_ngat_chuoi') || {}
        badgeToUnlock = {
          id: 'ke_ngat_chuoi',
          name: t('badges.items.ke_ngat_chuoi.name'),
          // Bậc lấy từ catalog. Viết cứng 'epic' thì modal chúc mừng và trang Danh hiệu hiện
          // hai bậc khác nhau cho cùng một danh hiệu (catalog đang là 'elite').
          tier: baseBadge.tier || 'elite',
          glyph: baseBadge.glyph || 'thunder',
          victim: victimName,
          streak: saved.brokenStreak || 5,
          xp: baseBadge.reward?.xp || 100,
          sp: baseBadge.reward?.seasonPts || 15,
          elo: saved.eloDelta || 18,
          winnerPlayerIds: winningTeam,
        }
      } else if (currentMember?.id && saved) {
        // Kiểm tra danh hiệu mở khóa mới của người chơi hiện tại
        try {
          const nextMatches = (db.matches || []).concat([saved])
          // Phải kèm playerRatings mới, không thì huy hiệu phụ thuộc Elo/tier vẫn tính trên rating cũ.
          // Trộn chứ không thay: nextPlayerRatings có thể chỉ chứa hội viên, thay nguyên map
          // là rating của khách biến mất khỏi bản mô phỏng.
          const nextDb = { ...db, matches: nextMatches, playerRatings: { ...db.playerRatings, ...nextPlayerRatings } }
          const badgesAfter = badgesSnapshotOf(currentMember.id, nextDb)
          const newlyUnlocked = newlyUnlockedBadges(badgesBefore, badgesAfter)
          if (newlyUnlocked.length > 0) {
            const nb = newlyUnlocked[0]
            badgeToUnlock = {
              id: nb.id,
              name: nb.name || nb.id,
              tier: nb.tier || 'epic',
              glyph: nb.glyph || 'crystal',
              story: nb.story || nb.desc || nb.cond,
              xp: nb.reward?.xp || 50,
              sp: nb.reward?.seasonPts || 10,
              elo: saved.eloDelta || 10,
            }
          }
        } catch (err) {
          console.warn('[ScoreModal] Lỗi tính badge mới sau trận:', err)
        }
      }

      if (badgeToUnlock) {
        // Phải ghi "đã xem" NGAY tại đây. GlobalBadgeUnlockHost quét lại ngay khi db đổi —
        // tức là trước khi người dùng kịp đóng modal này — nên ghi lúc đóng là quá muộn và
        // cùng một danh hiệu sẽ bung hai modal chồng nhau.
        markBadgeSeen(seenBadgesKey(db, currentMember?.id), badgeToUnlock.id)
        setPendingSavedRes(saved)
        setUnlockedBadge(badgeToUnlock)
        return
      }

      if (saved && onSaved) onSaved(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const courtName = court ? (court.name || court.courtLabel || (court.courtIdx !== undefined ? t('session.courtNum', { n: court.courtIdx + 1 }) : '')) : ''
  const isChallenge = Boolean(challenge || court?.fromChallengeId || court?.selectedChallengeId)
  const challengeCode = challenge?.code || court?.fromChallengeCode || court?.challengeCode || ''

  return (
    <>
      <Dialog
        open={!unlockedBadge}
        sheet={isMobile}
        width={520}
        title={isChallenge && challengeCode ? t('challenge.quickScoreChallengeTitle', { code: challengeCode }) : t('scoreModal.title', { court: courtName || '1' })}
        description={
          !isRatingEnabled
            ? t('scoreModal.sourceCasual')
            : isChallenge
              ? t('scoreModal.sourceFromChallenge', { code: challengeCode })
              : t('scoreModal.sourceFromSession')
        }
        onClose={onClose}
        style={{
          paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
        }}
        footer={
          <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
            {onLoadToCourt && (
              <button
                type="button"
                onClick={() => {
                  onLoadToCourt()
                  onClose()
                }}
                style={{
                  height: isMobile ? 56 : 44,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  font: '600 13px/1 "IBM Plex Sans", sans-serif',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {t('assign.loadBackToCourt')}
              </button>
            )}
            <button
              type="button"
              disabled={!winnerTeam || submitting}
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
                cursor: !winnerTeam || submitting ? 'not-allowed' : 'pointer',
                opacity: !winnerTeam || submitting ? 0.45 : 1,
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {submitting ? t('common.saving') : t('scoreModal.save')}
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

        {/* Tuỳ chọn số set: 1 Set (phong trào) vs 3 Set (BO3) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {t('scoreModal.matchFormat')}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setMatchFormat('single')}
              style={{
                padding: isMobile ? '6px 14px' : '4px 12px',
                minHeight: isMobile ? 36 : 28,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${sets.length === 1 ? 'var(--status-transit-fg)' : 'var(--border-subtle)'}`,
                background: sets.length === 1 ? 'var(--surface-nav-active)' : 'var(--surface-card)',
                color: sets.length === 1 ? 'var(--status-transit-fg)' : 'var(--text-muted)',
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
                padding: isMobile ? '6px 14px' : '4px 12px',
                minHeight: isMobile ? 36 : 28,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${sets.length === 3 ? 'var(--status-transit-fg)' : 'var(--border-subtle)'}`,
                background: sets.length === 3 ? 'var(--surface-nav-active)' : 'var(--surface-card)',
                color: sets.length === 3 ? 'var(--status-transit-fg)' : 'var(--text-muted)',
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

                  {/* Nút đổi điểm / đổi bên */}
                  <button
                    type="button"
                    title={t('scoreModal.swapScore')}
                    onClick={() => {
                      setSets((prev) => prev.map((s, i) => (i === setIdx ? [s[1], s[0]] : s)))
                    }}
                    style={{
                      ...S.swapBtn,
                      width: isMobile ? 44 : 32,
                      height: isMobile ? 44 : 32,
                    }}
                  >
                    ⇄
                  </button>

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

                {/* Tỷ số nhanh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
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
                      style={{
                        ...S.presetBtn,
                        padding: isMobile ? '6px 10px' : '3px 8px',
                        minHeight: isMobile ? 32 : 24,
                      }}
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
            <span style={{ color: 'var(--text-muted)' }}>{t('scoreModal.result')}</span>
            <span style={{ color: winnerTeam ? 'var(--status-transit-fg)' : 'var(--text-primary)', fontWeight: 600 }}>
              {sets.length === 1
                ? `${sets[0][0]} – ${sets[0][1]}`
                : `${setsWon.wonA} – ${setsWon.wonB} (${sets.map(([a, b]) => `${a}-${b}`).join(', ')})`
              }
              {winnerTeam && ` · ${winnerTeam === 'A' ? nameTeamA : nameTeamB} ${t('scoreModal.won')}`}
            </span>
          </div>
          {ratingDeltaPreview && (
            <div style={{ ...S.summaryRow, alignItems: 'flex-start', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('scoreModal.ratingDelta')}</span>
                {ratingDeltaPreview.mult > 1 && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-nav-active)', color: 'var(--status-transit-fg)', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                    {t('rating.multiplier', { mult: ratingDeltaPreview.mult.toFixed(2), val: ratingDeltaPreview.mult.toFixed(2) })}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gap: 4, textAlign: 'right' }}>
                <div style={{ color: 'var(--status-transit-fg)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {ratingDeltaPreview.deltasA.map((p) => `${p.name} (${p.delta > 0 ? `+${p.delta}` : p.delta})`).join(' · ')}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {ratingDeltaPreview.deltasB.map((p) => `${p.name} (${p.delta > 0 ? `+${p.delta}` : p.delta})`).join(' · ')}
                </div>
              </div>
            </div>
          )}
          {!isRatingEnabled && (
            <div style={{ ...S.summaryRow, alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('scoreModal.ratingDelta')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('scoreModal.unratedExplain')}</span>
            </div>
          )}
        </div>
      </div>
    </Dialog>

      {unlockedBadge && (
        <BadgeUnlockModal
          badge={unlockedBadge}
          isMobile={isMobile}
          shelfCount={(currentMember?.badge_shelf || currentMember?.badgeShelf || []).length}
          shelfIsFull={(currentMember?.badge_shelf || currentMember?.badgeShelf || []).length >= 3}
          onEquipShelf={(b) => {
            const targetId = currentMember?.id || (b.winnerPlayerIds && b.winnerPlayerIds[0])
            if (targetId && a.setMemberShelf) {
              const targetMem = (db.members || []).find((m) => m.id === targetId) || currentMember
              const cur = (targetMem?.badge_shelf || targetMem?.badgeShelf || []).slice()
              if (!cur.includes(b.id)) {
                if (cur.length >= 3) cur.pop()
                cur.unshift(b.id)
                a.setMemberShelf(targetId, cur)
              }
            }
            handleFinishScore()
          }}
          onViewCollection={(b) => {
            handleFinishScore(b?.id || unlockedBadge.id)
          }}
          onClose={() => handleFinishScore()}
        />
      )}
    </>
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
  swapBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  presetBtn: {
    borderRadius: 4,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    fontSize: 11.5,
    fontFamily: '"IBM Plex Mono", monospace',
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
  summaryCard: {
    display: 'grid',
    gap: 7,
    padding: '11px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    fontSize: 13,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
}

