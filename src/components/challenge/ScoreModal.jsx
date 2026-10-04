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
} from '#lib/season.js'
import { badgesSnapshotOf, getBadgeById, newlyUnlockedBadges, cleanShelf } from '#lib/badges.js'
import { seenBadgesKey, markBadgeSeen } from '#utils/seenBadges.js'
import { elapsedMin } from '#utils/dates.js'
import BadgeUnlockModal from '#components/badges/BadgeUnlockModal.jsx'
import ScorePicker from '#components/challenge/ScorePicker.jsx'
import { scoreStateFrom } from '#lib/scorePicker.js'
import { t } from '#i18n'
import cfg from '#config/app.js'

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

  // Tỷ số & Đội thắng — logic chuyển trạng thái nằm ở #lib/scorePicker.js, UI ở ScorePicker
  const [score, setScore] = useState(() => scoreStateFrom(court?.initialSets))
  const { winnerTeam, scoreA, scoreB } = score

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
        // Trận xếp sẵn bấm ▶ từ sớm nhưng thường đánh xong mới ghi một loạt — khoảng từ lúc bấm ▶
        // tới lúc ghi không phải thời lượng trận. Vượt số phút mặc định thì lấy số mặc định.
        minutes: court?.minutes || (court?.startedAt
          ? Math.min(elapsedMin(court.startedAt), cfg.match?.defaultMinutes || 20)
          : cfg.match?.defaultMinutes || 20),
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
          elo: saved.eloDelta, // Elo thật của trận; không có thì modal ẩn chip, không điền số bịa
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
              elo: saved.eloDelta,
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

          <ScorePicker
            db={db}
            teamA={teamA}
            teamB={teamB}
            ratingA={ratingA}
            ratingB={ratingB}
            ratingEnabled={isRatingEnabled}
            playerDeltas={playerDeltas}
            seasonDeltas={seasonDeltas}
            isMobile={isMobile}
            value={score}
            onChange={setScore}
          />
        </div>
      </Dialog>

      {unlockedBadge && (
        <BadgeUnlockModal
          badge={unlockedBadge}
          isMobile={isMobile}
          shelfCount={cleanShelf(currentMember?.badge_shelf || currentMember?.badgeShelf).length}
          shelfIsFull={cleanShelf(currentMember?.badge_shelf || currentMember?.badgeShelf).length >= 3}
          onEquipShelf={(b) => {
            const targetId = currentMember?.id || (b.winnerPlayerIds && b.winnerPlayerIds[0])
            if (targetId && a.setMemberShelf) {
              const targetMem = (db.members || []).find((m) => m.id === targetId) || currentMember
              a.setMemberShelf(targetId, [b.id, ...(targetMem?.badge_shelf || targetMem?.badgeShelf || [])])
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
