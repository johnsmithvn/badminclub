import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '#contexts/AppContext.jsx'
import { courtOf, myMember, playerName, playerOf } from '#lib/money.js'
import { expectedScore, getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { firstEmptyCourtIdx } from '#lib/assign.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import ChallengeDetailModal from '#components/challenge/ChallengeDetailModal.jsx'
import ScoreModal from '#components/challenge/ScoreModal.jsx'
import AttachVideoModal, { MatchVideoInlineExpander } from '#components/challenge/AttachVideoModal.jsx'
import { buildPlayableVideoUrl, formatGapMinutes, calcSessionTimeStats, parseVideoProvider, formatVideoDisplayLabel } from '#utils/videoUtils.js'

export default function SessionMatchesTab({ s, onSwitchTab }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [searchParams] = useSearchParams()
  const targetMatchId = searchParams.get('matchId')
  const [showCreate, setShowCreate] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const [editingMatch, setEditingMatch] = useState(null)
  const [attachVideoMatch, setAttachVideoMatch] = useState(null)
  const [expandedVideoMatchId, setExpandedVideoMatchId] = useState(null)
  const [challengeTab, setChallengeTab] = useState('my')
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [scoringChallenge, setScoringChallenge] = useState(null)

  // Danh sách các trận trong buổi này
  const matches = useMemo(() => {
    return (db.matches || [])
      .filter((m) => m.sessionId === s.id)
      .slice()
      .sort((m1, m2) => (m2.at || 0) - (m1.at || 0))
  }, [db.matches, s.id])

  // Tự động cuộn và làm nổi bật trận đấu nếu được chuyển tiếp từ màn Tìm trận
  useEffect(() => {
    if (targetMatchId) {
      const el = document.getElementById(`session-match-${targetMatchId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [targetMatchId, matches])

  // Tính khoảng cách giữa các trận trong buổi
  const matchesWithGap = useMemo(() => {
    const sorted = [...matches].sort((a, b) => (b.at || 0) - (a.at || 0))
    return sorted.map((m, idx) => {
      const prevMatch = sorted.slice(idx + 1).find((other) => other.at && m.at && other.at < m.at)
      const gapText = formatGapMinutes(m.at, prevMatch?.at)
      return {
        ...m,
        gapText: prevMatch ? gapText : (idx === sorted.length - 1 ? t('matchVideo.sessionOpen') : gapText),
      }
    })
  }, [matches])

  // Thống kê thời gian và video của buổi
  const timeStats = useMemo(() => calcSessionTimeStats(matches), [matches])
  const matchesWithVideo = useMemo(() => matches.filter((m) => Boolean(m.videoUrl)), [matches])
  const matchesWithoutVideo = useMemo(() => matches.filter((m) => !m.videoUrl), [matches])

  // Danh sách kèo trong buổi này
  const challenges = useMemo(() => {
    return (db.challenges || [])
      .filter((c) => c.sessionId === s.id)
      .slice()
      .sort((c1, c2) => (c2.createdAt || '').localeCompare(c1.createdAt || ''))
  }, [db.challenges, s.id])

  const myMem = myMember(db)
  const myId = myMem?.id || null

  const myChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (!myId) return false
      return c.createdBy === myId || (c.teamA || []).includes(myId) || (c.teamB || []).includes(myId)
    })
  }, [challenges, myId])

  const pendingChallenges = useMemo(() => {
    return challenges.filter((c) => c.status === 'pending')
  }, [challenges])

  const openChallenges = useMemo(() => {
    return challenges.filter((c) => !c.teamB?.length || (c.teamB && c.teamB.length < (c.teamA?.length > 1 ? 2 : 1)))
  }, [challenges])

  const playedChallenges = useMemo(() => {
    return challenges.filter((c) => c.status === 'played')
  }, [challenges])

  const displayedChallenges = useMemo(() => {
    if (challengeTab === 'my') return myChallenges.length ? myChallenges : challenges
    if (challengeTab === 'pending') return pendingChallenges
    if (challengeTab === 'open') return openChallenges
    if (challengeTab === 'played') return playedChallenges
    return challenges
  }, [challengeTab, myChallenges, pendingChallenges, openChallenges, playedChallenges, challenges])

  const memberNameOf = (id) => playerName(db, id)

  const getRating = (mid) => getPlayerRating(db.playerRatings, mid, playerOf(db, mid), db.levels).rating

  // Đếm số trận từ nguồn
  const fromSessionCount = matches.filter((m) => m.sourceType === 'session' || (!m.sourceType && !m.challengeId)).length
  const fromChallengeCount = matches.filter((m) => m.sourceType === 'challenge' || m.challengeId).length
  const totalMin = matches.reduce((acc, m) => acc + (m.minutes || 0), 0)

  // Đếm số trận cân bằng (lệch ban đầu <= 120 điểm hoặc có set sát <= 3 điểm)
  const balancedCount = useMemo(() => {
    return matches.filter((m) => {
      if (m.initialRatingA != null && m.initialRatingB != null) {
        return Math.abs(m.initialRatingA - m.initialRatingB) <= 120
      }
      if (m.sets && m.sets.length) {
        return m.sets.some(([aScore, bScore]) => Math.abs(aScore - bScore) <= 3)
      }
      return false
    }).length
  }, [matches])

  // Đưa kèo lên sân trống
  const handleDeployChallenge = (challenge) => {
    const curLu = db.lineups?.[s.id] || {}
    const emptyCourtIdx = firstEmptyCourtIdx(curLu, s)
    if (emptyCourtIdx === undefined) {
      a.toast(t('challenge.noEmptyCourt'))
      if (onSwitchTab) onSwitchTab('courts')
      return
    }
    a.deployChallenge(challenge.id, emptyCourtIdx)
    if (onSwitchTab) onSwitchTab('courts')
  }

  return (
    <div style={{ ...S.layout, gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 380px' }}>
      {/* ---------------- Cột trái: Bảng Trận đấu của buổi ---------------- */}
      <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
        {/* 4 StatCards thống kê buổi */}
        <div style={{ ...S.statGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))' }}>
          <div style={S.statCard}>
            <div style={S.statLabel}>{t('pages.sessions.statTotalMatches')}</div>
            <div style={S.statValue}>{matches.length}</div>
            <div style={S.statSub}>{t('pages.sessions.statTotalMinutes', { min: totalMin })}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>{t('pages.sessions.statCourtMatches')}</div>
            <div style={{ ...S.statValue, color: 'var(--text-primary)' }}>{fromSessionCount}</div>
            <div style={S.statSub}>{t('pages.sessions.statCourtMatchesDesc')}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>{t('pages.sessions.statChallengeMatches')}</div>
            <div style={{ ...S.statValue, color: 'var(--status-transit-fg)' }}>{fromChallengeCount}</div>
            <div style={S.statSub}>{t('pages.sessions.statChallengeMatchesDesc')}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>{t('pages.sessions.statBalancedMatches')}</div>
            <div style={{ ...S.statValue, color: 'var(--status-delivered-fg)' }}>{balancedCount}</div>
            <div style={S.statSub}>{t('pages.sessions.statBalancedMatchesDesc')}</div>
          </div>
        </div>

        {/* Card Bảng trận đấu */}
        <div style={S.card}>
          {/* Header Bảng */}
          <div style={S.cardHead}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <div style={S.cardTitle}>
                {t('pages.sessions.matchesCount', { n: matches.length })}
              </div>
              <div style={S.cardSub}>
                {t('pages.sessions.matchesSub')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {matchesWithVideo.length > 0 && (
                <div
                  style={{
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: 999,
                    background: 'rgba(0,178,169,.14)',
                    border: '1px solid rgba(0,178,169,.42)',
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: '#5FDBD3',
                  }}
                >
                  {t('matchVideo.hasVideoCount', { n: matchesWithVideo.length })}
                </div>
              )}
              <span style={S.monoMeta}>
                {matches.length} {t('units.match')} · {totalMin} {t('units.minute')}
              </span>
            </div>
          </div>

          {/* Render theo mobile card list hoặc desktop table */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {matchesWithGap.map((m) => {
                const teamA = m.teamA || []
                const teamB = m.teamB || []
                const aWon = m.winnerTeam === 'A'
                const winnerTeam = aWon ? teamA : teamB
                const loserTeam = aWon ? teamB : teamA
                const winnerNames = winnerTeam.map(memberNameOf).join(' · ')
                const loserNames = loserTeam.map(memberNameOf).join(' · ')

                const scoreSets = (m.sets || []).map(([a, b]) => ({
                  winPts: aWon ? a : b,
                  losePts: aWon ? b : a,
                }))
                const isMultiSet = scoreSets.length > 1
                const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
                const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0
                const fullScoreStr = isMultiSet
                  ? `${winSetsCount}–${loseSetsCount} (${scoreSets.map((s) => `${s.winPts}-${s.losePts}`).join(', ')})`
                  : (scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '')
                const courtObj = (s.courts || [])[m.courtIdx]
                const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                const courtLabel = courtObj?.label
                  ? courtObj.label
                  : ((s.courts || []).length > 1 ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : (venue?.name || t('session.courtNum', { n: 1 })))
                const matchTime = m.at
                  ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : (courtObj ? courtObj.from : '')
                const courtTimeStr = matchTime ? `${courtLabel} · ${matchTime}` : courtLabel
                const matchCode = matchCodeOf(db, m)
                const isFromChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                const challenge = isFromChallenge ? (db.challenges || []).find((c) => c.id === m.challengeId) : null
                const hasElo = m.ratingEnabled !== false && m.eloDelta != null && m.eloDelta !== 0
                const absDelta = Math.abs(m.eloDelta || 0)
                const deltaStr = hasElo ? `+${absDelta}` : '—'
                const isTarget = targetMatchId === m.id
                const hasVideo = Boolean(m.videoUrl)
                const vProvider = parseVideoProvider(m.videoUrl)
                const videoTagLabel = vProvider === 'youtube' ? 'YouTube' : vProvider === 'drive' ? 'Drive' : vProvider === 'icloud' ? 'iCloud' : 'Video'

                return (
                  <div
                    key={m.id}
                    id={`session-match-${m.id}`}
                    style={{
                      background: isTarget ? 'var(--surface-brand-soft, rgba(0, 178, 169, 0.08))' : 'var(--surface-card)',
                      border: isTarget ? '2px solid var(--teal-500)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-card)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {/* Hàng 1: Mã trận + Sân/giờ và Nút sửa + Nút video */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={S.monoCode}>{matchCode}</span>
                        <span style={S.monoMeta}>{courtTimeStr}</span>
                        {m.gapText && (
                          <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                            ({m.gapText})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasVideo ? (
                          <a
                            href={buildPlayableVideoUrl(m.videoUrl, m.videoTimestamp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              height: 24,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '0 8px',
                              borderRadius: 999,
                              background: 'rgba(225,68,52,.14)',
                              border: '1px solid rgba(225,68,52,.45)',
                              font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                              color: '#FF9A8F',
                              cursor: 'pointer',
                              textDecoration: 'none',
                            }}
                          >
                            <span>▶</span>
                            <span>{videoTagLabel}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedVideoMatchId((prev) => (prev === m.id ? null : m.id))}
                            style={{
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 8px',
                              borderRadius: 999,
                              border: '1px dashed var(--border-default)',
                              background: 'transparent',
                              font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {t('matchVideo.btnAttach')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingMatch(m)}
                          style={{
                            ...S.editInlineBtn,
                            height: 24,
                            padding: '0 8px',
                            fontSize: 11,
                          }}
                        >
                          {t('matchSearch.btnEdit')}
                        </button>
                      </div>
                    </div>

                    {/* Hàng 2: Thắng vs Thua + Tỷ số */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: 4,
                            background: 'rgba(240,183,92,0.15)', color: 'var(--status-delayed-fg)', fontSize: 10, flexShrink: 0,
                          }}>
                            👑
                          </span>
                          <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winnerNames}
                          </span>
                        </div>
                        <div style={{ font: '500 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)', paddingLeft: 23, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {loserNames}
                        </div>
                      </div>

                      {/* Cụm tỷ số */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {scoreSets.map((st, sIdx) => (
                          <div key={sIdx} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--border-subtle)',
                            font: '700 14px/1 "Barlow", sans-serif',
                          }}>
                            <span style={{ color: 'var(--status-delivered-fg)', fontWeight: 800 }}>{st.winPts}</span>
                            <span style={{ margin: '0 2px', opacity: 0.35 }}>:</span>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{st.losePts}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hàng 3: Delta Elo & Nguồn */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{
                        font: '600 12px/1 "IBM Plex Mono", monospace',
                        color: hasElo ? 'var(--status-delivered-fg)' : 'var(--text-disabled)',
                      }}>
                        {hasElo ? `Elo: ${deltaStr}` : t('challenge.casual')}
                      </span>
                      <span style={{
                        ...S.sourcePill,
                        background: isFromChallenge ? 'var(--surface-nav-active)' : 'var(--surface-card)',
                        borderColor: isFromChallenge ? 'var(--teal-700)' : 'var(--border-subtle)',
                        color: isFromChallenge ? 'var(--status-transit-fg)' : 'var(--text-muted)',
                      }}>
                        {isFromChallenge ? t('challenge.tag', { code: challenge?.code || '' }) : t('challenge.fromCourt')}
                      </span>
                    </div>

                    {/* Inline Expander khi bấm + Link trên mobile */}
                    {expandedVideoMatchId === m.id && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-subtle)' }}>
                        <MatchVideoInlineExpander
                          match={m}
                          matchCode={matchCode}
                          timeStr={matchTime}
                          courtVenueStr={`${courtLabel} · ${venue?.name || ''}`}
                          teamText={`${winnerNames} vs ${loserNames}`}
                          scoreText={fullScoreStr}
                          onSave={(videoData) => {
                            a.attachMatchVideo(m.id, videoData)
                            setExpandedVideoMatchId(null)
                          }}
                          onCancel={() => setExpandedVideoMatchId(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {matches.length === 0 && (
                <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  {t('pages.sessions.noMatchesHint')}
                </div>
              )}
            </div>
          ) : (
            /* Table Headers & Rows với scroll ngang an toàn trên desktop */
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 880 }}>
                {/* Header Cột */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 46px 64px 68px minmax(0,1fr) 88px minmax(0,1fr) 84px 94px 64px',
                    background: 'var(--surface-inset)',
                    borderBottom: '1px solid var(--border-subtle)',
                    font: "600 10.5px/1.2 'IBM Plex Sans', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ padding: '9px 0 9px 14px' }}>{t('matchVideo.colCode')}</div>
                  <div style={{ padding: '9px 2px' }} />
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colTime')}</div>
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colCourt')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colWinner')}</div>
                  <div style={{ padding: '9px 8px', textAlign: 'center' }}>{t('matchVideo.colScore')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colLoser')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('pages.sessions.colDelta')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('matchVideo.colVideo')}</div>
                  <div style={{ padding: '9px 14px 9px 6px', textAlign: 'right' }}>{t('matchVideo.colSource')}</div>
                </div>

                {/* Rows */}
                <div style={{ display: 'grid' }}>
                  {matchesWithGap.map((m) => {
                    const teamA = m.teamA || []
                    const teamB = m.teamB || []
                    const aWon = m.winnerTeam === 'A'
                    const winnerTeam = aWon ? teamA : teamB
                    const loserTeam = aWon ? teamB : teamA
                    const winnerNames = winnerTeam.map(memberNameOf).join(' · ')
                    const loserNames = loserTeam.map(memberNameOf).join(' · ')

                    const scoreSets = (m.sets || []).map(([a, b]) => ({
                      winPts: aWon ? a : b,
                      losePts: aWon ? b : a,
                    }))
                    const isMultiSet = scoreSets.length > 1
                    const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
                    const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0
                    const fullScoreStr = isMultiSet
                      ? `${winSetsCount}–${loseSetsCount} (${scoreSets.map((s) => `${s.winPts}-${s.losePts}`).join(', ')})`
                      : (scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '')

                    const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                    const isRated = m.ratingEnabled !== false
                    const winnerDeltaStr = isRated ? (winnerTeam.length > 1 ? `+${absDelta} · +${absDelta}` : `+${absDelta}`) : t('challenge.casual')
                    const loserDeltaStr = isRated ? (loserTeam.length > 1 ? `−${absDelta} · −${absDelta}` : `−${absDelta}`) : t('challenge.casual')

                    const ra = m.initialRatingA || 0
                    const rb = m.initialRatingB || 0
                    const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                    const isClose = (m.sets || []).some((st) => st && st[0] != null && st[1] != null && Math.abs(st[0] - st[1]) <= 3)
                    const isStreak = (m.brokenStreak || 0) >= 3

                    const courtObj = (s.courts || [])[m.courtIdx]
                    const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                    const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                    const matchTime = m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (courtObj?.from || '19:00')
                    const matchCode = matchCodeOf(db, m)

                    // Vạch màu trái và background
                    let leftBorderColor = 'transparent'
                    let rowBg = 'transparent'
                    if (isUpset) {
                      leftBorderColor = '#E14434'
                      rowBg = 'rgba(225,68,52,.06)'
                    } else if (isClose) {
                      leftBorderColor = '#E08A00'
                      rowBg = 'rgba(224,138,0,.06)'
                    } else if (isStreak) {
                      leftBorderColor = '#00B2A9'
                      rowBg = 'rgba(0,178,169,.05)'
                    }

                    const isTarget = targetMatchId === m.id
                    if (isTarget) {
                      rowBg = 'var(--surface-brand-soft, rgba(0, 178, 169, 0.12))'
                      leftBorderColor = 'var(--teal-500)'
                    }

                    const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                    const hasVideo = Boolean(m.videoUrl)
                    const vProvider = parseVideoProvider(m.videoUrl)
                    const videoTagLabel = vProvider === 'youtube' ? 'YouTube' : vProvider === 'drive' ? 'Drive' : vProvider === 'icloud' ? 'iCloud' : 'Video'

                    return (
                      <div key={m.id} style={{ display: 'grid' }}>
                        <div
                          id={`session-match-${m.id}`}
                          style={{
                            position: 'relative',
                            display: 'grid',
                            gridTemplateColumns: '52px 46px 64px 68px minmax(0,1fr) 88px minmax(0,1fr) 84px 94px 64px',
                            alignItems: 'center',
                            minHeight: 50,
                            borderBottom: '1px solid var(--border-subtle)',
                            background: rowBg,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Vạch màu bên trái 2px */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 2,
                              background: leftBorderColor,
                            }}
                          />

                          {/* Cột 1: Mã */}
                          <div style={{ padding: '0 0 0 14px' }}>
                            <span style={{ font: "600 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                              {matchCode}
                            </span>
                          </div>

                          {/* Cột 2: Sửa */}
                          <div style={{ padding: '0 2px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              style={{
                                height: 22,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 8px',
                                borderRadius: 5,
                                background: 'var(--surface-raised)',
                                border: '1px solid var(--border-default)',
                                font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              {t('matchSearch.btnEdit')}
                            </button>
                          </div>

                          {/* Cột 3: Giờ + khoảng cách */}
                          <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                              {matchTime}
                            </span>
                            <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                              {m.gapText || '+0′'}
                            </span>
                          </div>

                          {/* Cột 4: Sân */}
                          <div style={{ padding: '0 6px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }} title={venue?.name}>
                              {courtLabel || t('session.courtNum', { n: 1 })}
                            </span>
                          </div>

                          {/* Cột 5: Đội thắng */}
                          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {winnerNames}
                            </span>
                            <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-delivered-fg)' }}>
                              {winnerDeltaStr}
                            </span>
                          </div>

                          {/* Cột 6: Tỷ số */}
                          <div style={{ padding: '0 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ font: "600 16px/1 'IBM Plex Mono', monospace" }}>
                              <span style={{ color: 'var(--teal-500)' }}>
                                {isMultiSet ? winSetsCount : (scoreSets.length > 0 ? scoreSets[0].winPts : 21)}
                              </span>
                              <span style={{ color: 'var(--text-muted)', padding: '0 3px' }}>–</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isMultiSet ? loseSetsCount : (scoreSets.length > 0 ? scoreSets[0].losePts : 19)}
                              </span>
                            </div>
                            {isMultiSet && (
                              <div
                                style={{
                                  font: "500 10.5px/1.2 'IBM Plex Mono', monospace",
                                  color: 'var(--text-muted)',
                                  marginTop: 3,
                                  whiteSpace: 'nowrap',
                                }}
                                title={scoreSets.map((s) => `${s.winPts}–${s.losePts}`).join(', ')}
                              >
                                {scoreSets.map((s) => `${s.winPts}:${s.losePts}`).join(' ')}
                              </div>
                            )}
                          </div>

                          {/* Cột 7: Đội thua */}
                          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ font: "500 12.5px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {loserNames}
                            </span>
                            <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-incident-fg)' }}>
                              {loserDeltaStr}
                            </span>
                          </div>

                          {/* Cột 8: Delta Elo */}
                          <div style={{ padding: '0 6px', textAlign: 'center' }}>
                            <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: isRated ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>
                              {isRated ? `+${absDelta}` : '—'}
                            </span>
                          </div>

                          {/* Cột 9: Video */}
                          <div style={{ padding: '0 6px', display: 'flex', justifyContent: 'center' }}>
                            {hasVideo ? (
                              <a
                                href={buildPlayableVideoUrl(m.videoUrl, m.videoTimestamp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  height: 24,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '0 9px',
                                  borderRadius: 999,
                                  background: 'rgba(225,68,52,.14)',
                                  border: '1px solid rgba(225,68,52,.45)',
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: '#FF9A8F',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  whiteSpace: 'nowrap',
                                }}
                                title={m.videoUrl}
                              >
                                <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace" }}>▶</span>
                                <span>{videoTagLabel}</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedVideoMatchId((prev) => (prev === m.id ? null : m.id))}
                                style={{
                                  height: 24,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '0 9px',
                                  borderRadius: 999,
                                  border: '1px dashed var(--border-default)',
                                  background: 'transparent',
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {t('matchVideo.btnAttach')}
                              </button>
                            )}
                          </div>

                          {/* Cột 10: Nguồn */}
                          <div style={{ padding: '0 14px 0 6px', textAlign: 'right', font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                            {isChallenge ? t('challenge.challenge') : t('challenge.fromCourt')}
                          </div>
                        </div>

                        {/* Dòng Inline Expander gắn Video */}
                        {expandedVideoMatchId === m.id && (
                          <MatchVideoInlineExpander
                            match={m}
                            matchCode={matchCode}
                            timeStr={matchTime}
                            courtVenueStr={`${courtLabel} · ${venue?.name || ''}`}
                            teamText={`${winnerNames} vs ${loserNames}`}
                            scoreText={fullScoreStr}
                            onSave={(videoData) => {
                              a.attachMatchVideo(m.id, videoData)
                              setExpandedVideoMatchId(null)
                            }}
                            onCancel={() => setExpandedVideoMatchId(null)}
                          />
                        )}
                      </div>
                    )
                  })}

                  {matches.length === 0 && (
                    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                      {t('pages.sessions.noMatchesHint')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Cột phải: Video buổi + Mốc giờ + Kèo ---------------- */}
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        {/* Card 1: Video của buổi (X/Y) */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <div style={S.cardTitle}>
                {t('matchVideo.sessionVideosTitle')}
              </div>
              <div style={S.cardSub}>
                {t('matchVideo.sessionVideosSub')}
              </div>
            </div>
            <div
              style={{
                height: 24,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderRadius: 999,
                background: matchesWithVideo.length > 0 ? 'rgba(0,178,169,.14)' : 'var(--surface-inset)',
                border: '1px solid',
                borderColor: matchesWithVideo.length > 0 ? 'rgba(0,178,169,.42)' : 'var(--border-subtle)',
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                color: matchesWithVideo.length > 0 ? '#5FDBD3' : 'var(--text-muted)',
              }}
            >
              {t('matchVideo.sessionVideosCount', { count: matchesWithVideo.length, total: matches.length })}
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
            {/* Danh sách video đã gắn */}
            {matchesWithVideo.map((m) => {
              const courtObj = (s.courts || [])[m.courtIdx]
              const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : t('session.courtNum', { n: 1 }))
              const matchTime = m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (courtObj?.from || '19:00')
              const matchCode = matchCodeOf(db, m)
              const vProvider = parseVideoProvider(m.videoUrl)
              const videoTagLabel = vProvider === 'youtube' ? 'YouTube' : vProvider === 'drive' ? 'Drive' : vProvider === 'icloud' ? 'iCloud' : 'Video'
              const displayLabel = formatVideoDisplayLabel(m.videoUrl, m.videoTimestamp)

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '9px 11px',
                    borderRadius: 8,
                    background: 'var(--surface-inset)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                        {matchCode}
                      </span>
                      <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                        {matchTime} · {courtLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a
                        href={buildPlayableVideoUrl(m.videoUrl, m.videoTimestamp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          height: 22,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '0 8px',
                          borderRadius: 4,
                          background: 'rgba(225,68,52,.14)',
                          border: '1px solid rgba(225,68,52,.45)',
                          font: "600 10px/1 'IBM Plex Sans', sans-serif",
                          color: '#FF9A8F',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        <span>▶</span>
                        <span>{videoTagLabel}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setAttachVideoMatch(m)}
                        style={{
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 7px',
                          borderRadius: 4,
                          background: 'var(--surface-card)',
                          border: '1px solid var(--border-subtle)',
                          font: "500 10.5px/1 'IBM Plex Sans', sans-serif",
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {t('common.edit')}
                      </button>
                    </div>
                  </div>

                  <div style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                    {displayLabel}
                  </div>
                  {m.videoNote && (
                    <div style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {m.videoNote}
                    </div>
                  )}
                </div>
              )
            })}

            {matchesWithVideo.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>
                {t('matchVideo.noVideosYet')}
              </div>
            )}

            {/* Nút gắn video các trận còn lại */}
            {matchesWithoutVideo.length > 0 && (
              <button
                type="button"
                onClick={() => setAttachVideoMatch(matchesWithoutVideo[0])}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 7,
                  border: '1px dashed var(--border-default)',
                  background: 'transparent',
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: 'var(--teal-500)',
                  cursor: 'pointer',
                }}
              >
                <span>+</span>
                <span>{t('matchVideo.btnAttachRemaining', { count: matchesWithoutVideo.length })}</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Mốc giờ của buổi */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <div style={S.cardTitle}>
                {t('matchVideo.sessionTimeTitle')}
              </div>
              <div style={S.cardSub}>
                {t('matchVideo.sessionTimeSub')}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ font: "400 12.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('matchVideo.statFirstMatch')}
              </span>
              <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                {timeStats.firstMatchTime}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ font: "400 12.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('matchVideo.statLastMatch')}
              </span>
              <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                {timeStats.lastMatchTime}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ font: "400 12.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('matchVideo.statLongestRest')}
              </span>
              <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-delayed-fg)' }}>
                {timeStats.longestRestText}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ font: "400 12.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('matchVideo.statAvgDuration')}
              </span>
              <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                {timeStats.avgDurationText}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Kèo trong buổi */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <div style={S.cardTitle}>{t('challenge.sessionChallengesTitle')}</div>
              <div style={S.cardSub}>{t('challenge.sessionChallengesSub')}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={S.createBtn}
            >
              {t('challenge.btnCreate')}
            </button>
          </div>

          {/* Sub-tabs K1 (Của tôi, Đang chờ, Đang mở, Đã đấu) */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
            {[
              { id: 'my', label: t('challenge.tabMy'), count: myChallenges.length },
              { id: 'pending', label: t('challenge.tabPending'), count: pendingChallenges.length, color: 'var(--status-delayed-fg)' },
              { id: 'open', label: t('challenge.tabOpen'), count: openChallenges.length, color: 'var(--status-transit-fg)' },
              { id: 'played', label: t('challenge.tabPlayed'), count: playedChallenges.length },
            ].map((tb) => {
              const active = challengeTab === tb.id
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setChallengeTab(tb.id)}
                  style={{
                    flex: 1,
                    minHeight: 34,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--surface-card)' : 'transparent',
                    border: active ? '1px solid var(--border-default)' : '1px solid transparent',
                    cursor: 'pointer',
                    boxShadow: active ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  <span style={{ font: '600 11.5px/1 "IBM Plex Sans", sans-serif', color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {tb.label}
                  </span>
                  <span style={{ font: '500 11px/1 "IBM Plex Mono", monospace', color: tb.color || (active ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                    {tb.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
            {displayedChallenges.map((c) => {
              const teamA = c.teamA || []
              const teamB = c.teamB || []
              const namesA = teamA.map(memberNameOf).join(' · ')
              const namesB = teamB.length ? teamB.map(memberNameOf).join(' · ') : t('challenge.teamEmptyHint')
              const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0
              const ratB = teamB.length ? Math.round(teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length) : 0
              const gap = Math.abs(ratA - ratB)
              const pA = expectedScore(ratA, ratB || ratA)
              const pctA = Math.round(pA * 100)
              const pctB = 100 - pctA

              const pA1 = teamA[0]
              const pB1 = teamB[0]
              const h2hMatches = (pA1 && pB1)
                ? searchMatches(db.matches || [], { playerAId: pA1, playerBId: pB1, mode: 'vs' })
                : []
              const h2hWinsA = h2hMatches.filter((m) => {
                const wonA = m.winnerTeam === 'A'
                const isAInTeamA = (m.teamA || []).includes(pA1)
                return (isAInTeamA && wonA) || (!isAInTeamA && !wonA)
              }).length
              const h2hWinsB = h2hMatches.length - h2hWinsA

              const isPlayed = c.status === 'played'
              const isPending = c.status === 'pending'
              const isAccepted = c.status === 'accepted'

              // DT2 countdown hết hạn
              const expTime = c.expiresAt ? new Date(c.expiresAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() + 60 * 60 * 1000 : null)
              let expStr = '24:12'
              if (expTime) {
                const diff = expTime - now
                if (diff <= 0) {
                  expStr = '00:00'
                } else {
                  const mins = Math.floor(diff / 60000)
                  const secs = Math.floor((diff % 60000) / 1000)
                  expStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`
                }
              }

              const statusText = isPending
                ? `${t('challenge.status.pending')} · ${t('challenge.expiresIn', { time: expStr })}`
                : (t('challenge.status.' + c.status) || c.status)

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChallenge(c)}
                  style={{
                    ...S.challengeCard,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Code & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={S.monoCode}>{c.code}</span>
                    <span style={{
                      ...S.statusBadge,
                      background: isPlayed ? 'var(--surface-brand-soft)' : isAccepted ? 'var(--surface-nav-active)' : 'rgba(240,183,92,0.14)',
                      borderColor: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--teal-700)' : 'var(--border-subtle)',
                      color: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--status-transit-fg)' : 'var(--status-delayed-fg)',
                    }}>
                      {statusText}
                    </span>
                  </div>

                  {/* 2 Đội với TB rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>{namesA}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                        {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                    <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>{namesB}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                        {ratB > 0 ? t('challenge.avgRating', { r: ratB.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* DT2: Cảnh báo lệch điểm */}
                  {gap > 0 && ratA > 0 && ratB > 0 && (
                    <div style={S.warnBox}>
                      {t('challenge.gapWarningNotBlocked', { gap: gap.toLocaleString('vi-VN') })}
                    </div>
                  )}

                  {/* Win% Bar */}
                  {!isPlayed && ratB > 0 && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--status-transit-fg)' }}>{pctA}%</span>
                        <span style={{ color: 'var(--text-muted)' }}>{t('rating.gap', { gap })}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{pctB}%</span>
                      </div>
                      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-page)' }}>
                        <div style={{ width: `${pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%' }} />
                        <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* H2H Tag nếu có lịch sử */}
                  {h2hMatches.length > 0 && (
                    <div style={S.h2hRow}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('challenge.matchupH2H')}:</span>
                      <span style={{ color: 'var(--status-delivered-fg)', fontWeight: 600 }}>{h2hWinsA}T</span>
                      <span style={{ color: 'var(--text-disabled)' }}>–</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{h2hWinsB}B</span>
                    </div>
                  )}

                  {/* DT2 Action buttons tuỳ trạng thái: Nhận / Từ chối trực tiếp trên thẻ Pending */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          a.respondChallenge(c.id, true)
                        }}
                        style={{
                          ...S.smallPrimaryBtn,
                          background: 'var(--status-delivered)',
                        }}
                      >
                        {t('challenge.btnAccept')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          a.respondChallenge(c.id, false)
                        }}
                        style={S.smallGhostBtn}
                      >
                        {t('challenge.btnDecline')}
                      </button>
                    </div>
                  )}

                  {isAccepted && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeployChallenge(c)
                        }}
                        style={S.smallPrimaryBtn}
                      >
                        {t('challenge.deployToCourt')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setScoringChallenge(c)
                        }}
                        style={S.smallGhostBtn}
                      >
                        {t('scoreModal.title')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {displayedChallenges.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                {t('challenge.noSessionChallenges')}
              </div>
            )}
          </div>

          {/* DT2: Dòng chú thích đáy rail */}
          <div style={{ padding: '0 14px 12px', font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
            {t('challenge.railChallengeNote')}
          </div>
        </div>

        {/* Card 4: Kèo nối vào buổi thế nào */}
        <div style={S.card}>
          <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
            <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {t('pages.sessions.wiringTitle')}
            </div>
            <div style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
              {t('pages.sessions.wiringDesc')}
            </div>
            <div style={S.wiringBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>session_id</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.id.slice(0, 8)}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('pages.sessions.matchFromCourt')}</span>
                <span style={{ color: 'var(--text-primary)' }}>{fromSessionCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('pages.sessions.matchFromChallenge')}</span>
                <span style={{ color: 'var(--status-transit-fg)' }}>{fromChallengeCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal tạo kèo */}
      {showCreate && (
        <CreateChallengeModal
          session={s}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}

      {/* Modal sửa điểm */}
      {editingMatch && (
        <EditScoreModal
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSaved={() => setEditingMatch(null)}
        />
      )}

      {/* Modal gắn video độc lập */}
      {attachVideoMatch && (
        <AttachVideoModal
          match={attachVideoMatch}
          matchCode={matchCodeOf(db, attachVideoMatch)}
          timeStr={attachVideoMatch.at ? new Date(attachVideoMatch.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '19:00'}
          courtVenueStr={courtOf(db, (s.courts || [])[attachVideoMatch.courtIdx]?.courtId)?.name || t('session.courtNum', { n: 1 })}
          teamText={`${(attachVideoMatch.winnerTeam === 'A' ? attachVideoMatch.teamA : attachVideoMatch.teamB || []).map(memberNameOf).join(' · ')} vs ${(attachVideoMatch.winnerTeam === 'A' ? attachVideoMatch.teamB : attachVideoMatch.teamA || []).map(memberNameOf).join(' · ')}`}
          scoreText={(attachVideoMatch.sets || []).map(([a, b]) => `${a}–${b}`).join(', ')}
          onClose={() => setAttachVideoMatch(null)}
          onSaved={() => setAttachVideoMatch(null)}
        />
      )}

      {/* Modal chi tiết/thao tác kèo (K4 / K5 / K7) */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          session={s}
          onClose={() => setSelectedChallenge(null)}
          onDeployed={(c) => {
            setSelectedChallenge(null)
            handleDeployChallenge(c)
          }}
          onScoreInput={(c) => {
            setSelectedChallenge(null)
            setScoringChallenge(c)
          }}
          onOpenMatch={(m) => {
            setSelectedChallenge(null)
            setEditingMatch(m)
          }}
        />
      )}

      {/* Modal ghi điểm cho kèo (K8) */}
      {scoringChallenge && (
        <ScoreModal
          challenge={scoringChallenge}
          session={s}
          onClose={() => setScoringChallenge(null)}
          onSaved={() => setScoringChallenge(null)}
        />
      )}
    </div>
  )
}

const S = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gap: 16,
    alignItems: 'start',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
    gap: 12,
  },
  statCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-card)',
    padding: '12px 14px',
    display: 'grid',
    gap: 4,
  },
  statLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statValue: {
    font: '700 24px/1.1 Barlow, sans-serif',
    color: 'var(--text-primary)',
  },
  statSub: {
    font: '400 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
  },
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-xs)',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  monoMeta: {
    font: '400 12.5px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg)',
  },
  editInlineBtn: {
    height: 28,
    padding: '0 10px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  sourcePill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
  createBtn: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--action-primary-bg)',
    border: 'none',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--gray-0)',
    cursor: 'pointer',
  },
  challengeCard: {
    display: 'grid',
    gap: 8,
    padding: '12px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
  },
  smallPrimaryBtn: {
    flex: 1,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'var(--action-primary-bg)',
    border: 'none',
    color: 'var(--gray-0)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  smallGhostBtn: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  wiringBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 13px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    font: '400 13px/1.5 "IBM Plex Mono", monospace',
  },
  h2hRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 4,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  warnBox: {
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(217, 119, 6, 0.08)',
    border: '1px solid rgba(217, 119, 6, 0.25)',
    color: 'var(--status-delayed-fg)',
    font: '500 11.5px/1.4 "IBM Plex Sans", sans-serif',
  },
}
