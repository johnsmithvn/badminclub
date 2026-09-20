import { useState, useMemo, Fragment } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName, courtOf, playerOf } from '#lib/money.js'
import {
  matchCodeOf,
  getPlayerRating,
  marginMultiplierVNext,
  calcPairImpact,
  calcMatchupEdge,
  confidenceLevelOf,
  DEFAULT_RATING,
} from '#lib/rating.js'
import { calcSeasonMatchDeltaFinal, isChallengeMatch } from '#lib/season.js'
import { dd } from '#utils/dates.js'
import { buildPlayableVideoUrl, parseVideoProvider } from '#utils/videoUtils.js'
import { VideoPlayerModal } from '#components/challenge/VideoPlayerModal.jsx'
import { t } from '#i18n'

export default function MatchDetailModal({ match, onClose, onEdit }) {
  const { db } = useApp()
  const isMobile = useMobile(640)
  const [watchingVideo, setWatchingVideo] = useState(false)

  const liveMatch = (db.matches || []).find((m) => m.id === match?.id) || match
  const matchCode = useMemo(() => matchCodeOf(db, liveMatch), [db, liveMatch])

  const teamA = useMemo(() => liveMatch?.teamA || (liveMatch?.playerKeys ? liveMatch.playerKeys.slice(0, 2) : []), [liveMatch])
  const teamB = useMemo(() => liveMatch?.teamB || (liveMatch?.playerKeys ? liveMatch.playerKeys.slice(2, 4) : []), [liveMatch])

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  const aWon = liveMatch?.winnerTeam === 'A'
  const sets = useMemo(() => liveMatch?.sets || [], [liveMatch])


  // Thông tin buổi và sân
  const s = useMemo(() => (db.sessions || []).find((x) => x.id === liveMatch?.sessionId), [db.sessions, liveMatch?.sessionId])
  const courtObj = s?.courts?.[liveMatch?.courtIdx]
  const venue = courtObj ? courtOf(db, courtObj.courtId) : null
  const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (liveMatch?.courtIdx ?? 0) + 1 }) : '')
  const dateStr = s?.date ? dd(s.date) : (liveMatch?.at ? new Date(liveMatch.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
  const timeStr = liveMatch?.at ? new Date(liveMatch.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '20:42'
  const matchWhen = `${dateStr ? dateStr + ' · ' : ''}${venue?.name ? venue.name + ' · ' : ''}${courtLabel}`

  const delta = Math.abs(liveMatch?.eloDelta != null ? liveMatch.eloDelta : 8)
  const ra = liveMatch?.initialRatingA || 0
  const rb = liveMatch?.initialRatingB || 0
  const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))

  const hasVideo = Boolean(liveMatch?.videoUrl)
  const videoPlayUrl = hasVideo ? buildPlayableVideoUrl(liveMatch.videoUrl, liveMatch.videoTimestamp) : null
  const vProvider = hasVideo ? parseVideoProvider(liveMatch.videoUrl) : null
  const videoProviderLabel = vProvider === 'youtube' ? 'YouTube' : vProvider === 'drive' ? 'Google Drive' : vProvider === 'icloud' ? 'iCloud' : 'Video'

  // Rating từng người
  const ratingOf = (id) => (id ? getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels).rating : DEFAULT_RATING)
  const rA0 = ratingOf(teamA[0])
  const rA1 = ratingOf(teamA[1])
  const rB0 = ratingOf(teamB[0])
  const rB1 = ratingOf(teamB[1])

  const avgRa = teamA.length > 1 ? Math.round((rA0 + rA1) / 2) : rA0
  const avgRb = teamB.length > 1 ? Math.round((rB0 + rB1) / 2) : rB0
  const expA = Math.max(5, Math.min(95, Math.round((1 / (1 + Math.pow(10, (avgRb - avgRa) / 400))) * 100)))
  const expB = 100 - expA

  // Hệ số biên thắng softened MOV
  const mov = marginMultiplierVNext(sets, 1.20, 75)
  const diffs = sets.map(([sa, sb]) => Math.abs(sa - sb))
  const maxDiff = diffs.length ? Math.max(...diffs) : 0
  const isCloseMargin = maxDiff <= 4

  // Danh sách lịch sửa trận (audit log)
  const auditLogs = useMemo(() => {
    const edits = db.matchEdits || []
    return edits.filter((e) => e.matchId === match?.id)
  }, [db.matchEdits, match?.id])

  // Tính rating từng người trước và sau trận
  const playerDeltas = useMemo(() => {
    const listA = teamA.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
      const baseRating = match?.initialRatingA ? Math.round(match.initialRatingA) : pr.rating
      const change = aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    const listB = teamB.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
      const baseRating = match?.initialRatingB ? Math.round(match.initialRatingB) : pr.rating
      const change = !aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    return { listA, listB }
  }, [teamA, teamB, match, db, aWon, delta])

  // Tính các tầng ăn ý, khắc chế, điểm mùa giải, H2H
  const {
    winPairName,
    losePairName,
    synBefore,
    synAfter,
    synGames,
    actualWinPct,
    expWinPct,
    edgeBefore,
    edgeAfter,
    matchupGames,
    matchupConf,
    h2hP1,
    h2hP2,
    h2hWins1,
    h2hWins2,
    seasonDelta,
  } = useMemo(() => {
    const winnerKeys = aWon ? teamA : teamB
    const loserKeys = aWon ? teamB : teamA
    const wName = winnerKeys.map((id) => playerName(db, id)).join(' · ') || (aWon ? nameTeamA : nameTeamB)
    const lName = loserKeys.map((id) => playerName(db, id)).join(' · ') || (!aWon ? nameTeamA : nameTeamB)

    const allMatches = (db.matches || []).filter(
      (m) => m.status === 'completed' || m.status === 'finished' || m.id === match?.id
    )
    const pastMatches = allMatches.filter((m) => m.id !== match?.id)

    // Tầng 2: Ăn ý cặp thắng
    let sBefore = 50
    let sAfter = 50
    let gCount = 0
    let actWin = 50
    let expWin = 50
    if (winnerKeys.length === 2) {
      const impBefore = calcPairImpact(pastMatches, winnerKeys[0], winnerKeys[1])
      const impAfter = calcPairImpact(allMatches, winnerKeys[0], winnerKeys[1])
      sBefore = impBefore.synergyScore ?? 50
      sAfter = impAfter.synergyScore ?? 50
      gCount = impAfter.gamesCount ?? 0
      actWin = impAfter.actualWinPct ?? 50
      expWin = impAfter.expectedWinPct ?? 50
    }

    // Tầng 3: Khắc chế
    let eBefore = 50
    let eAfter = 50
    let mGames = 0
    let mConf = confidenceLevelOf(0)
    if (winnerKeys.length === 2 && loserKeys.length === 2) {
      const edBefore = calcMatchupEdge(pastMatches, winnerKeys, loserKeys)
      const edAfter = calcMatchupEdge(allMatches, winnerKeys, loserKeys)
      eBefore = edBefore.advantageScore ?? 50
      eAfter = edAfter.advantageScore ?? 50
      mGames = edAfter.gamesCount ?? 0
      mConf = edAfter.confidence || confidenceLevelOf(mGames)
    }

    // H2H cá nhân
    const p1Id = teamA[0]
    const p2Id = teamB[0]
    const nameP1 = p1Id ? playerName(db, p1Id) : 'Đội A' // i18n-ok
    const nameP2 = p2Id ? playerName(db, p2Id) : 'Đội B' // i18n-ok
    let w1 = 0
    let w2 = 0
    if (p1Id && p2Id) {
      allMatches.forEach((m) => {
        const mA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
        const mB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
        if (mA.includes(p1Id) && mB.includes(p2Id)) {
          if (m.winnerTeam === 'A') w1++
          else if (m.winnerTeam === 'B') w2++
        } else if (mA.includes(p2Id) && mB.includes(p1Id)) {
          if (m.winnerTeam === 'A') w2++
          else if (m.winnerTeam === 'B') w1++
        }
      })
    }

    // Tầng 4: Điểm mùa giải
    const winElo = aWon ? ra : rb
    const loseElo = aWon ? rb : ra
    // Trận từ kèo ăn hệ số điểm mùa — phải hiện đúng con số đã vào sổ, không phải delta gốc.
    const seasonDelta = match?.ratingEnabled !== false
      ? calcSeasonMatchDeltaFinal(winElo, loseElo, true, { isChallenge: isChallengeMatch(match) }).delta
      : 0

    return {
      winPairName: wName,
      losePairName: lName,
      synBefore: sBefore,
      synAfter: sAfter,
      synGames: gCount,
      actualWinPct: actWin,
      expWinPct: expWin,
      edgeBefore: eBefore,
      edgeAfter: eAfter,
      matchupGames: mGames,
      matchupConf: mConf,
      h2hP1: nameP1,
      h2hP2: nameP2,
      h2hWins1: w1,
      h2hWins2: w2,
      seasonDelta,
    }
  }, [teamA, teamB, match, db, aWon, nameTeamA, nameTeamB, ra, rb])

  const isDoubles = teamA.length === 2 && teamB.length === 2
  const matchCategory = isDoubles ? 'Đôi nam' : 'Đơn nam' // i18n-ok

  const tiers = useMemo(() => [
    {
      key: 'elo',
      title: t('matchDetail.tier1Elo'),
      sub: t('matchDetail.tier1EloSub'),
      desc: `Kỳ vọng ${expA}% · thắng thật → ${isUpset ? 'bất ngờ lớn, biến động mạnh' : 'tăng nhẹ vì đúng dự đoán'}`, // i18n-ok
      value: playerDeltas.listA.map((p) => `${p.name} ${p.delta >= 0 ? `+${p.delta}` : p.delta}`).join(' · '),
      color: '#5FDBD3',
    },
    {
      key: 'synergy',
      title: t('matchDetail.tier2Synergy'),
      sub: t('matchDetail.tier2SynergySub'),
      desc: `${winPairName} lên ${synGames} trận · thực tế ${actualWinPct}% so kỳ vọng ${expWinPct}%`, // i18n-ok
      value: `${synBefore} → ${synAfter}`,
      color: '#5FDBD3',
    },
    {
      key: 'season',
      title: t('matchDetail.tier4Season'),
      sub: t('matchDetail.tier4SeasonSub'),
      desc: match?.ratingEnabled === false
        ? t('matchDetail.tier4Casual')
        : t('matchDetail.tier4PointsEarned', { pts: seasonDelta }),
      value: match?.ratingEnabled === false ? '+0' : (seasonDelta >= 0 ? `+${seasonDelta}` : `${seasonDelta}`),
      color: '#5FDBD3',
    },
    {
      key: 'matchup',
      title: t('matchDetail.tier3Matchup'),
      sub: t('matchDetail.tier3MatchupSub'),
      desc: `${winPairName} → ${losePairName}: ${matchupGames} trận, lên đủ mẫu ${matchupConf?.tier || 'R1'}`, // i18n-ok
      value: `${edgeBefore} → ${edgeAfter}`,
      color: '#5FDBD3',
    },
    {
      key: 'h2h',
      title: t('matchDetail.tierH2H'),
      sub: t('matchDetail.tierH2HSub'),
      desc: t('matchDetail.h2hHistoryOnlyNote'),
      value: `${h2hP1} ${h2hWins1}–${h2hWins2} ${h2hP2}`,
      color: '#8494AA',
    },
  ], [t, expA, isUpset, playerDeltas.listA, winPairName, synGames, actualWinPct, expWinPct, synBefore, synAfter, match?.ratingEnabled, seasonDelta, losePairName, matchupGames, matchupConf, h2hP1, h2hWins1, h2hWins2, h2hP2])

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={t('matchDetail.matchCode', { code: matchCode })}
        description={matchWhen || t('matchDetail.title')}
        width={isMobile ? '100%' : 720}
        style={{
          paddingBottom: isMobile ? 'calc(14px + env(safe-area-inset-bottom, 0px))' : undefined,
        }}
      >
      {/* ═══ EA1 · KỲ VỌNG VS THỰC TẾ TRONG CHI TIẾT TRẬN ═══ */}
      <div
        data-screen-label="EA1 Ky vong vs thuc te"
        style={{
          width: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 11 : 14,
          margin: isMobile ? '-4px -6px' : undefined,
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: isMobile ? '10px 12px' : '14px 18px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: isMobile ? '600 15px/1.25 Barlow, sans-serif' : '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
              {t('matchDetail.matchCode', { code: matchCode })} · {courtLabel || t('session.courtNum', { n: 1 })} · {timeStr}
            </div>
            <div style={{ font: isMobile ? "400 12px/1.4 'IBM Plex Mono', monospace" : "400 13px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {matchCategory} · {t('session.sessionTitle')} {dateStr || '02/09'} · {t('matchDetail.eloApplied')}
            </div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,.18)' }} />
        </div>

        <div style={{ padding: isMobile ? '0 12px 14px' : '0 18px 18px', display: 'grid', gap: isMobile ? 11 : 14 }}>
          {/* Tỷ số & Kỳ vọng */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: isMobile ? '10px 8px' : 14,
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0,1fr) 72px minmax(0,1fr)' : 'minmax(0,1fr) 92px minmax(0,1fr)',
              gap: isMobile ? 8 : 12,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: 3 }}>
              <div style={{ font: isMobile ? "600 13px/1.3 'IBM Plex Sans', sans-serif" : "600 14px/1.3 'IBM Plex Sans', sans-serif", color: aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamA}
              </div>
              <div style={{ font: isMobile ? "400 10.5px/1.35 'IBM Plex Mono', monospace" : "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {teamA.length > 1 ? `${rA0} + ${rA1}` : rA0} · {t('leaderboard.expectedWinPct', { pct: expA })}
              </div>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ font: isMobile ? '700 19px/1 Barlow, sans-serif' : '700 22px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
                {sets.length > 1
                  ? `${sets.filter(([sa, sb]) => sa > sb).length}–${sets.filter(([sa, sb]) => sb > sa).length}`
                  : (sets.length > 0 ? `${sets[0][0]}–${sets[0][1]}` : '21–18')}
              </div>
              {sets.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', paddingTop: 6 }}>
                  {sets.map(([sa, sb], sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        font: "500 11px/1.2 'IBM Plex Mono', monospace",
                        color: sa > sb ? (aWon ? '#5FDBD3' : '#E9EFF7') : (sb > sa ? (!aWon ? '#5FDBD3' : '#E9EFF7') : '#8494AA'),
                        background: 'rgba(255,255,255,.06)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid #22304A',
                      }}
                      title={`Set ${sIdx + 1}`}
                    >
                      {sa}–{sb}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 3, textAlign: 'right' }}>
              <div style={{ font: isMobile ? "600 13px/1.3 'IBM Plex Sans', sans-serif" : "600 14px/1.3 'IBM Plex Sans', sans-serif", color: !aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamB}
              </div>
              <div style={{ font: isMobile ? "400 10.5px/1.35 'IBM Plex Mono', monospace" : "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {teamB.length > 1 ? `${rB0} + ${rB1}` : rB0} · {t('leaderboard.expectedWinPct', { pct: expB })}
              </div>
            </div>
          </div>

          {/* Banner Video trận đấu nếu có */}
          {hasVideo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 8,
                background: 'rgba(225,68,52,.09)',
                border: '1px solid rgba(225,68,52,.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(225,68,52,.20)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FF9A8F',
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  ▶
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                  <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#FFB0A5' }}>
                    {videoProviderLabel} {match.videoTimestamp ? `· ${match.videoTimestamp}` : ''}
                  </div>
                  <div style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {match.videoNote || match.videoUrl}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (videoPlayUrl) window.open(videoPlayUrl, '_blank')
                }}
                style={{
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 12px',
                  borderRadius: 6,
                  background: '#E14434',
                  border: 'none',
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(225,68,52,.35)',
                }}
              >
                <span>{t('matchVideo.btnWatch')}</span>
                <span style={{ fontSize: 11 }}>↗</span>
              </button>
            </div>
          )}

          {/* Banner Biên Thắng Làm Mềm Softened MOV */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: isMobile ? '8px 10px' : '10px 13px',
              borderRadius: 8,
              background: 'rgba(0,178,169,.10)',
              border: '1px solid #00786F',
            }}
          >
            <div style={{ font: isMobile ? "400 12px/1.45 'IBM Plex Sans', sans-serif" : "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB', flex: 1 }}>
              {isCloseMargin
                ? t('matchDetail.movSoftenedNote', { diff: 4, mult: mov.toFixed(2) })
                : t('matchDetail.movSoftenedBlowoutNote', { diff: maxDiff, mult: mov.toFixed(2) })}
            </div>
          </div>

          {/* 4 Tầng Kết Quả Cập Nhật */}
          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('matchDetail.whatUpdatesTitle')}
            </div>

            {isMobile ? (
              /* Mobile: Bố cục dạng thẻ xếp chồng không bị ép dẹp chữ */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 9,
                  overflow: 'hidden',
                  border: '1px solid #22304A',
                  background: '#141D2E',
                }}
              >
                {tiers.map((tier, idx) => (
                  <div
                    key={tier.key}
                    style={{
                      padding: '10px 12px',
                      borderTop: idx === 0 ? 'none' : '1px solid #22304A',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                          {tier.title}
                        </span>
                        <span
                          style={{
                            font: "500 10.5px/1 'IBM Plex Mono', monospace",
                            color: '#8494AA',
                            background: '#101927',
                            padding: '2px 5px',
                            borderRadius: 4,
                            border: '1px solid #22304A',
                          }}
                        >
                          {tier.sub}
                        </span>
                      </div>
                      <div
                        style={{
                          font: "600 12px/1.2 'IBM Plex Mono', monospace",
                          color: tier.color,
                          textAlign: 'right',
                          flexShrink: 0,
                        }}
                      >
                        {tier.value}
                      </div>
                    </div>
                    <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                      {tier.desc}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Bố cục 2 cột truyền thống với căn đều hai bên */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  gap: 0,
                  borderRadius: 9,
                  overflow: 'hidden',
                  border: '1px solid #22304A',
                }}
              >
                {tiers.map((tier, idx) => (
                  <Fragment key={tier.key}>
                    <div
                      style={{
                        background: '#101927',
                        borderRight: '1px solid #22304A',
                        borderTop: idx === 0 ? 'none' : '1px solid #22304A',
                        padding: 12,
                        display: 'grid',
                        gap: 3,
                        alignContent: 'center',
                      }}
                    >
                      <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                        {tier.title}
                      </div>
                      <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {tier.sub}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#141D2E',
                        borderTop: idx === 0 ? 'none' : '1px solid #22304A',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB', flex: 1, minWidth: 0 }}>
                        {tier.desc}
                      </div>
                      <div
                        style={{
                          font: "600 13px/1 'IBM Plex Mono', monospace",
                          color: tier.color,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {tier.value}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            )}

            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA', paddingTop: 2 }}>
              {t('matchDetail.tierUpdateRuleNote')}
            </div>
          </div>

          {/* LỊCH SỬ SỬA TRẬN (AUDIT LOG) NẾU CÓ */}
          {auditLogs.length > 0 && (
            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #22304A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.editHistory')}
                </span>
                <span
                  style={{
                    font: "600 10px/1 'IBM Plex Sans', sans-serif",
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(224,138,0,.18)',
                    color: '#F0B75C',
                  }}
                >
                  {t('matchDetail.hasEdits')}
                </span>
              </div>

              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#101927',
                      border: '1px solid #22304A',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: "600 12px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                        {log.editorName || playerName(db, log.editorId) || t('matchDetail.editorFallback')}
                      </span>
                      <span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {log.at ? new Date(log.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                      </span>
                    </div>
                    {log.reason && (
                      <span style={{ fontSize: 12, color: '#A8B7CB' }}>{log.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NÚT THAO TÁC */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: isMobile ? 'stretch' : 'flex-end',
              flexWrap: 'wrap',
              paddingTop: 6,
            }}
          >
            <Button variant="ghost" onClick={onClose} style={{ flex: isMobile ? 1 : undefined }}>
              {t('matchDetail.btnClose')}
            </Button>
            {hasVideo && (
              <Button
                variant="secondary"
                onClick={() => setWatchingVideo(true)}
                style={{ flex: isMobile ? 1 : undefined }}
              >
                <span style={{ fontSize: 11 }}>▶</span>
                <span>{t('matchVideo.btnWatch')}{Number(liveMatch?.videoViews) > 0 ? ` · ${liveMatch.videoViews}` : ''}</span>
              </Button>
            )}
            {onEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose()
                  onEdit(liveMatch)
                }}
                style={{ flex: isMobile ? 1 : undefined }}
              >
                <Icon name="pencil" size={14} />
                <span>{t('matchDetail.btnEditScore')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
    {watchingVideo && (
      <VideoPlayerModal
        match={liveMatch}
        matchCode={matchCode}
        onClose={() => setWatchingVideo(false)}
      />
    )}
    </>
  )
}
