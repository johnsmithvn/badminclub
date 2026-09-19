import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { teamRating, calcPlayerDeltas, getPlayerRating } from '#lib/rating.js'
import { playerName, playerOf, myMember } from '#lib/money.js'
import { getChallengeSeriesProgress } from '#lib/challenge.js'
import {
  seasonConfigOf,
  calcSeasonMatchDeltaFinal,
  challengeMultiplierOf,
  resolveSeason,
  seasonMatchesOf,
} from '#lib/season.js'
import { calculateMemberBadges, computeClubBadgeStats, getBadgeById, newlyUnlockedBadges } from '#lib/badges.js'
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
  const currentMember = useMemo(() => myMember(db), [db])

  // Xác định Đội A và Đội B từ court hoặc challenge
  const teamA = useMemo(() => {
    if (court?.teamA?.length) return court.teamA
    if (challenge?.teamA?.length) return challenge.teamA
    if (court && court.slots) return [court.slots[0], court.slots[1]].filter(Boolean)
    return []
  }, [challenge, court])

  const teamB = useMemo(() => {
    if (court?.teamB?.length) return court.teamB
    if (challenge?.teamB?.length) return challenge.teamB
    if (court && court.slots) return [court.slots[2], court.slots[3]].filter(Boolean)
    return []
  }, [challenge, court])

  // Challenge tương ứng
  const activeChallenge = useMemo(() => {
    if (challenge) return challenge
    const cid = court?.fromChallengeId || court?.selectedChallengeId
    if (cid) {
      return (db.challenges || []).find((c) => c.id === cid) || null
    }
    return null
  }, [challenge, court, db.challenges])

  // Tiến độ chuỗi BO3/BO5 nếu có
  const activeSeriesProg = useMemo(() => {
    if (!activeChallenge || (activeChallenge.bestOf || 1) <= 1) return null
    return getChallengeSeriesProgress(activeChallenge, db.matches || [])
  }, [activeChallenge, db.matches])

  // Tỷ số & Đội thắng (đồng bộ UI/UX với ghi điểm chia sân)
  const [winnerTeam, setWinnerTeam] = useState(() => {
    if (court?.initialSets?.[0]) {
      const [sa, sb] = court.initialSets[0]
      if (sa > sb) return 'A'
      if (sb > sa) return 'B'
    }
    return 'A'
  })

  const [presetScore, setPresetScore] = useState(() => {
    if (court?.initialSets?.[0]) {
      const [sa, sb] = court.initialSets[0]
      const pair = `${Math.max(sa, sb)}-${Math.min(sa, sb)}`
      if (['21-19', '21-15', '21-11'].includes(pair)) return pair
      return 'custom'
    }
    return '21-19'
  })

  const [scoreA, setScoreA] = useState(() => court?.initialSets?.[0]?.[0] ?? 21)
  const [scoreB, setScoreB] = useState(() => court?.initialSets?.[0]?.[1] ?? 19)

  const [showChangesBox, setShowChangesBox] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const [pendingSavedRes, setPendingSavedRes] = useState(null)

  const isRatingEnabled = activeChallenge
    ? activeChallenge.ratingEnabled !== false
    : (court?.ratingEnabled !== undefined ? court.ratingEnabled : true)

  // Map ratings thô của các đấu thủ
  const rawRatingsMap = useMemo(() => {
    const map = {}
    ;[...teamA, ...teamB].forEach((id) => {
      const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
      map[id] = pr.rating
    })
    return map
  }, [teamA, teamB, db.playerRatings, db.levels, db.members, db.guests])

  const ratingA = useMemo(() => Math.round(teamRating(teamA, rawRatingsMap)), [teamA, rawRatingsMap])
  const ratingB = useMemo(() => Math.round(teamRating(teamB, rawRatingsMap)), [teamB, rawRatingsMap])

  // Biến động Elo dự kiến cho từng người
  const playerDeltas = useMemo(() => {
    if (!teamA.length || !teamB.length || !isRatingEnabled || !winnerTeam) return {}
    try {
      const gamesCountMap = {}
      ;[...teamA, ...teamB].forEach((id) => {
        const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
        gamesCountMap[id] = pr.gamesCount || 0
      })
      const { deltas } = calcPlayerDeltas({
        teamA,
        teamB,
        aWon: winnerTeam === 'A',
        ratingsMap: rawRatingsMap,
        gamesCountMap,
        sets: [[Number(scoreA), Number(scoreB)]],
      })
      return deltas || {}
    } catch {
      return {}
    }
  }, [teamA, teamB, isRatingEnabled, winnerTeam, rawRatingsMap, scoreA, scoreB, db.playerRatings, db.levels])

  // Dự báo điểm mùa giải
  const seasonDeltas = useMemo(() => {
    if (!teamA.length || !teamB.length || !winnerTeam || !isRatingEnabled) return {}
    try {
      const seasonCfg = seasonConfigOf(db)
      const upsetMinGap = seasonCfg.bonusConfig?.upsetMinGap ?? 150
      const upsetBonus = seasonCfg.bonusConfig?.upset150 ?? 5
      const isChal = Boolean(activeChallenge?.id)
      const out = {}
      const put = (ids, myElo, oppElo, won) => {
        const { delta } = calcSeasonMatchDeltaFinal(myElo, oppElo, won, {
          isChallenge: isChal,
          scaleConfig: seasonCfg.deltaScale,
          multiplier: challengeMultiplierOf(db),
        })
        const bonus = won && (oppElo - myElo >= upsetMinGap) ? upsetBonus : 0
        ids.forEach((id) => { out[id] = delta + bonus })
      }
      put(teamA, ratingA, ratingB, winnerTeam === 'A')
      put(teamB, ratingB, ratingA, winnerTeam === 'B')
      return out
    } catch {
      return {}
    }
  }, [teamA, teamB, winnerTeam, isRatingEnabled, ratingA, ratingB, db, activeChallenge])

  // Đổi đội thắng (1 chạm)
  const handleSelectWinner = (team) => {
    setWinnerTeam(team)
    if (presetScore === '21-19') {
      setScoreA(team === 'A' ? 21 : 19)
      setScoreB(team === 'B' ? 21 : 19)
    } else if (presetScore === '21-15') {
      setScoreA(team === 'A' ? 21 : 15)
      setScoreB(team === 'B' ? 21 : 15)
    } else if (presetScore === '21-11') {
      setScoreA(team === 'A' ? 21 : 11)
      setScoreB(team === 'B' ? 21 : 11)
    } else if (presetScore === 'custom') {
      if (team === 'A' && scoreA < scoreB) {
        const tmp = scoreA
        setScoreA(scoreB)
        setScoreB(tmp)
      } else if (team === 'B' && scoreB < scoreA) {
        const tmp = scoreA
        setScoreA(scoreB)
        setScoreB(tmp)
      }
    }
  }

  // Chọn preset tỷ số nhanh (21-19, 21-15, 21-11, Khác)
  const handleSelectPreset = (preset) => {
    setPresetScore(preset)
    if (preset === '21-19') {
      setScoreA(winnerTeam === 'A' ? 21 : 19)
      setScoreB(winnerTeam === 'B' ? 21 : 19)
    } else if (preset === '21-15') {
      setScoreA(winnerTeam === 'A' ? 21 : 15)
      setScoreB(winnerTeam === 'B' ? 21 : 15)
    } else if (preset === '21-11') {
      setScoreA(winnerTeam === 'A' ? 21 : 11)
      setScoreB(winnerTeam === 'B' ? 21 : 11)
    }
  }

  // Tăng/giảm tỷ số tùy chỉnh
  const updateCustomScore = (team, delta) => {
    setPresetScore('custom')
    if (team === 'A') {
      const next = Math.max(0, Math.min(30, Number(scoreA || 0) + delta))
      setScoreA(next)
      if (next > scoreB) setWinnerTeam('A')
      else if (next < scoreB) setWinnerTeam('B')
    } else {
      const next = Math.max(0, Math.min(30, Number(scoreB || 0) + delta))
      setScoreB(next)
      if (next > scoreA) setWinnerTeam('B')
      else if (next < scoreA) setWinnerTeam('A')
    }
  }

  // Nhập điểm trực tiếp qua ô input
  const setCustomScoreDirect = (team, valStr) => {
    setPresetScore('custom')
    const val = parseInt(valStr, 10)
    const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(30, val))
    if (team === 'A') {
      setScoreA(safeVal)
      if (safeVal > scoreB) setWinnerTeam('A')
      else if (safeVal < scoreB) setWinnerTeam('B')
    } else {
      setScoreB(safeVal)
      if (safeVal > scoreA) setWinnerTeam('B')
      else if (safeVal < scoreA) setWinnerTeam('A')
    }
  }

  // Nút đổi điểm hai bên
  const handleSwapCustomScore = () => {
    setPresetScore('custom')
    const tmpA = scoreA
    const tmpB = scoreB
    setScoreA(tmpB)
    setScoreB(tmpA)
    if (tmpB > tmpA) setWinnerTeam('A')
    else if (tmpA > tmpB) setWinnerTeam('B')
  }

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

    if (Number(scoreA) === Number(scoreB)) {
      a.toast(t('quickMatch.errTie'))
      return
    }

    setSubmitting(true)
    try {
      // 1. Kiểm tra huy hiệu trước khi lưu
      let badgesBefore = null
      if (currentMember?.id) {
        try {
          badgesBefore = badgesSnapshotOf(currentMember.id, db)
        } catch {
          badgesBefore = null
        }
      }

      const playedSets = [[Number(scoreA), Number(scoreB)]]
      const res = a.saveMatchScore({
        sessionId: session?.id || null,
        courtIdx: court?.courtIndex ?? court?.courtIdx ?? 0,
        courtId: court?.courtId || null,
        challengeId: activeChallenge?.id || null,
        ratingEnabled: isRatingEnabled,
        teamA,
        teamB,
        sets: playedSets,
        winnerTeam,
        minutes: court?.minutes || (court?.startedAt ? Math.max(1, Math.round((Date.now() - court.startedAt) / 60000)) : cfg.match?.defaultMinutes || 20),
      })

      const { nextPlayerRatings = null, ...savedMatch } = res || {}
      const saved = res ? savedMatch : null

      // 2. Kiểm tra nếu có bounty bị ngắt hoặc huy hiệu mới
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
        try {
          const nextMatches = (db.matches || []).concat([saved])
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
  const isChallenge = Boolean(activeChallenge)
  const challengeCode = activeChallenge?.code || ''

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
                style={S.secondaryBtn}
              >
                {t('assign.loadBackToCourt')}
              </button>
            )}
            <button
              type="button"
              disabled={!winnerTeam || submitting}
              onClick={handleSave}
              style={{
                ...S.bigSaveBtn,
                flex: 1,
                opacity: !winnerTeam || submitting ? 0.45 : 1,
                cursor: !winnerTeam || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? t('common.saving')
                : (activeChallenge && (activeChallenge.bestOf || 1) > 1
                    ? t('challenge.saveSetBtn', { set: activeSeriesProg?.nextSetNumber || 1 })
                    : t('scoreModal.saveResult'))}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={S.cancelBtn}
            >
              {t('common.cancel')}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Banner tiến độ chuỗi nếu là kèo thách đấu BO3/BO5 */}
          {activeChallenge && (activeChallenge.bestOf || 1) > 1 && (
            <div style={S.seriesBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Icon name="flame" size={16} style={{ color: '#C084FC' }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {t('challenge.seriesProgressTitle', {
                    code: activeChallenge.code,
                    set: activeSeriesProg?.nextSetNumber || 1,
                    bestOf: activeChallenge.bestOf || 1,
                  })}
                </span>
                {activeSeriesProg?.totalSetsPlayed > 0 && (
                  <span style={S.seriesBadge}>
                    {t('challenge.seriesCurrentScore', { score: activeSeriesProg.seriesScoreText })}
                  </span>
                )}
                {activeSeriesProg?.isDecider && (
                  <span style={S.deciderBadge}>
                    {t('challenge.deciderSet')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Hướng dẫn */}
          <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
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
                <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: winnerTeam === 'A' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {teamA.map((k) => playerName(db, k)).join(' · ')}
                </div>
                <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: winnerTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                  {t('scoreModal.teamAvg', { t: 'A', r: ratingA })}
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
                <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: winnerTeam === 'B' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {teamB.map((k) => playerName(db, k)).join(' · ')}
                </div>
                <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: winnerTeam === 'B' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                  {t('scoreModal.teamAvg', { t: 'B', r: ratingB })}
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
            {['21-19', '21-15', '21-11'].map((p) => (
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
                <span style={{ font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                  {t('scoreModal.customScoreTitle')}
                </span>
                {Number(scoreA) === Number(scoreB) && (
                  <span style={{ color: 'var(--status-delayed-fg)', fontSize: 11.5, fontWeight: 500 }}>
                    {t('quickMatch.errTie')}
                  </span>
                )}
              </div>

              <div style={S.customScoreRow}>
                {/* Cột điểm Đội A */}
                <div style={S.customTeamCol}>
                  <span style={S.customTeamName}>
                    {teamA.map((k) => playerName(db, k)).join(' · ')}
                  </span>
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
                      max={30}
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
                  <span style={S.customTeamName}>
                    {teamB.map((k) => playerName(db, k)).join(' · ')}
                  </span>
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
                      max={30}
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
                    {winnerTeam === 'B' ? `${pb}–${pa}` : `${pa}–${pb}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Box thay đổi Elo & SP - Dạng Collapsible Accordion */}
          <div style={S.changesBox}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowChangesBox((prev) => !prev)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowChangesBox((prev) => !prev) }}
              style={S.changesToggleHeader}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {t('scoreModal.postMatchChanges')}
                </span>
                <span style={{ font: '500 11px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                  · {isRatingEnabled ? t('scoreModal.changesPreviewTag') : t('scoreModal.unratedChange')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--teal-600, #00B2A9)' }}>
                <span>{showChangesBox ? t('scoreModal.collapseChanges') : t('scoreModal.expandChanges')}</span>
                <span style={{ fontSize: 13, transform: showChangesBox ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
              </div>
            </div>

            {showChangesBox && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  {[...teamA, ...teamB].map((k) => {
                    const inA = teamA.includes(k)
                    const isWon = (inA && winnerTeam === 'A') || (!inA && winnerTeam === 'B')
                    const dVal = playerDeltas[k]
                    const deltaTxt = dVal != null ? (dVal > 0 ? `+${dVal}` : `${dVal}`) : '—'
                    const sVal = seasonDeltas[k]
                    const seasonTxt = sVal != null ? (sVal > 0 ? `+${sVal}` : `${sVal}`) : '—'
                    return (
                      <div key={k} style={S.changeRow}>
                        <span style={{ font: '600 14px "IBM Plex Sans", sans-serif', color: isWon ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {playerName(db, k)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {isRatingEnabled ? (
                            <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: isWon ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
                              {t('scoreModal.ratingChange', { d: deltaTxt })}
                            </span>
                          ) : (
                            <span style={{ font: '500 12px "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                              {t('scoreModal.unratedChange')}
                            </span>
                          )}
                          {isRatingEnabled && (
                            <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: sVal > 0 ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
                              {t('scoreModal.seasonPointChange', { pts: seasonTxt })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ font: '400 12px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 6 }}>
                  {isRatingEnabled ? t('scoreModal.seasonPointExplain') : t('scoreModal.unratedExplain')}
                </div>
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
  seriesBanner: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(168, 85, 247, 0.12)',
    border: '1px solid rgba(168, 85, 247, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  seriesBadge: {
    fontSize: 11.5,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(168, 85, 247, 0.25)',
    color: '#E9D5FF',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
  },
  deciderBadge: {
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 4,
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#F87171',
    fontWeight: 700,
  },
  teamsChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  teamChoiceCard: {
    borderRadius: 10,
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
    minHeight: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: '600 13px/1 "IBM Plex Mono", monospace',
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
    background: 'var(--surface-card)',
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
    font: '600 12px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  changesBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  changesToggleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
    gap: 8,
    minHeight: 26,
  },
  changeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
  bigSaveBtn: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: 'var(--action-accent-bg, #00B2A9)',
    border: 'none',
    font: '700 15px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--action-accent-fg, #04302C)',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 178, 169, 0.3)',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderRadius: 8,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  cancelBtn: {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    borderRadius: 8,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
}
