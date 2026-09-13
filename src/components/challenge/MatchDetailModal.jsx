import { useMemo } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
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
import { calcSeasonMatchDelta } from '#lib/season.js'
import { dd } from '#utils/dates.js'
import { buildPlayableVideoUrl, parseVideoProvider } from '#utils/videoUtils.js'
import { VideoPlayerModal } from '#components/challenge/VideoPlayerModal.jsx'
import { t } from '#i18n'

export default function MatchDetailModal({ match, onClose, onEdit }) {
  const { db } = useApp()
  const [watchingVideo, setWatchingVideo] = useState(false)

  const matchCode = useMemo(() => matchCodeOf(db, match), [db, match])

  const teamA = useMemo(() => match?.teamA || (match?.playerKeys ? match.playerKeys.slice(0, 2) : []), [match])
  const teamB = useMemo(() => match?.teamB || (match?.playerKeys ? match.playerKeys.slice(2, 4) : []), [match])

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  const aWon = match?.winnerTeam === 'A'
  const sets = useMemo(() => match?.sets || [], [match])


  // Thông tin buổi và sân
  const s = useMemo(() => (db.sessions || []).find((x) => x.id === match?.sessionId), [db.sessions, match?.sessionId])
  const courtObj = s?.courts?.[match?.courtIdx]
  const venue = courtObj ? courtOf(db, courtObj.courtId) : null
  const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (match?.courtIdx ?? 0) + 1 }) : '')
  const dateStr = s?.date ? dd(s.date) : (match?.at ? new Date(match.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
  const timeStr = match?.at ? new Date(match.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '20:42'
  const matchWhen = `${dateStr ? dateStr + ' · ' : ''}${venue?.name ? venue.name + ' · ' : ''}${courtLabel}`

  const delta = Math.abs(match?.eloDelta != null ? match.eloDelta : 8)
  const ra = match?.initialRatingA || 0
  const rb = match?.initialRatingB || 0
  const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))

  const hasVideo = Boolean(match?.videoUrl)
  const videoPlayUrl = hasVideo ? buildPlayableVideoUrl(match.videoUrl, match.videoTimestamp) : null
  const vProvider = hasVideo ? parseVideoProvider(match.videoUrl) : null
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
    const seasonDelta = match?.ratingEnabled !== false
      ? calcSeasonMatchDelta(winElo, loseElo, true).delta
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

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={t('matchDetail.matchCode', { code: matchCode })}
        description={matchWhen || t('matchDetail.title')}
        width={720}
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
          gap: 14,
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
              {t('matchDetail.matchCode', { code: matchCode })} · {courtLabel || t('session.courtNum', { n: 1 })} · {timeStr}
            </div>
            <div style={{ font: "400 13px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {matchCategory} · {t('session.sessionTitle')} {dateStr || '02/09'} · {t('matchDetail.eloApplied')}
            </div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,.18)' }} />
        </div>

        <div style={{ padding: '0 18px 18px', display: 'grid', gap: 14 }}>
          {/* Tỷ số & Kỳ vọng */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) 92px minmax(0,1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: 3 }}>
              <div style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamA}
              </div>
              <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {teamA.length > 1 ? `${rA0} + ${rA1}` : rA0} · {t('leaderboard.expectedWinPct', { pct: expA })}
              </div>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
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
              <div style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: !aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamB}
              </div>
              <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
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
              padding: '10px 13px',
              borderRadius: 8,
              background: 'rgba(0,178,169,.10)',
              border: '1px solid #00786F',
            }}
          >
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB', flex: 1 }}>
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '112px 1fr',
                gap: 0,
                borderRadius: 9,
                overflow: 'hidden',
                border: '1px solid #22304A',
              }}
            >
              {/* Tầng 1: Elo */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier1Elo')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier1EloSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  Kỳ vọng {expA}% · thắng thật → {isUpset ? 'bất ngờ lớn, biến động mạnh' : 'tăng nhẹ vì đúng dự đoán'} {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {playerDeltas.listA.map((p) => `${p.name} ${p.delta >= 0 ? `+${p.delta}` : p.delta}`).join(' · ')}
                </div>
              </div>

              {/* Tầng 2: Ăn ý */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier2Synergy')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier2SynergySub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {winPairName} lên {synGames} trận · thực tế {actualWinPct}% so kỳ vọng {expWinPct}% {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {synBefore} → {synAfter}
                </div>
              </div>

              {/* Tầng 4: Điểm mùa giải */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier4Season')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier4SeasonSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {match?.ratingEnabled === false
                    ? t('matchDetail.tier4Casual')
                    : t('matchDetail.tier4PointsEarned', { pts: seasonDelta })}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {match?.ratingEnabled === false ? '+0' : (seasonDelta >= 0 ? `+${seasonDelta}` : `${seasonDelta}`)}
                </div>
              </div>

              {/* Tầng 3: Khắc chế */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier3Matchup')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier3MatchupSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {winPairName} → {losePairName}: {matchupGames} trận, lên đủ mẫu {matchupConf?.tier || 'R1'} {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {edgeBefore} → {edgeAfter}
                </div>
              </div>

              {/* H2H: Bổ sung */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('matchDetail.tierH2H')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tierH2HSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('matchDetail.h2hHistoryOnlyNote')}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#8494AA',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h2hP1} {h2hWins1}–{h2hWins2} {h2hP2}
                </div>
              </div>
            </div>

            <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#8494AA', paddingTop: 2 }}>
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
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="ghost" onClick={onClose}>
              {t('matchDetail.btnClose')}
            </Button>
            {hasVideo && (
              <Button
                variant="secondary"
                onClick={() => setWatchingVideo(true)}
              >
                <span style={{ fontSize: 11 }}>▶</span>
                <span>{t('matchVideo.btnWatch')}</span>
              </Button>
            )}
            {onEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose()
                  onEdit(match)
                }}
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
        match={match}
        matchCode={matchCode}
        onClose={() => setWatchingVideo(false)}
      />
    )}
    </>
  )
}
