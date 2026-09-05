import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { courtOf, playerName } from '#lib/money.js'
import { expectedScore, getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { firstEmptyCourtIdx } from '#lib/assign.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'

export default function SessionMatchesTab({ s, onSwitchTab }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [showCreate, setShowCreate] = useState(false)
  const [editingMatch, setEditingMatch] = useState(null)

  // Danh sách các trận trong buổi này
  const matches = useMemo(() => {
    return (db.matches || [])
      .filter((m) => m.sessionId === s.id)
      .slice()
      .sort((m1, m2) => (m2.createdAt || '').localeCompare(m1.createdAt || ''))
  }, [db.matches, s.id])

  // Danh sách kèo trong buổi này
  const challenges = useMemo(() => {
    return (db.challenges || [])
      .filter((c) => c.sessionId === s.id)
      .slice()
      .sort((c1, c2) => (c2.createdAt || '').localeCompare(c1.createdAt || ''))
  }, [db.challenges, s.id])

  const memberNameOf = (id) => playerName(db, id)

  const getRating = (mid) => getPlayerRating(db.playerRatings, mid).rating

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
            <span style={S.monoMeta}>
              {matches.length} {t('units.match')} · {totalMin} {t('units.minute')}
            </span>
          </div>

          {/* Render theo mobile card list hoặc desktop table */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {matches.map((m) => {
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
                const courtObj = (s.courts || [])[m.courtIdx]
                const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                const courtLabel = courtObj?.label
                  ? courtObj.label
                  : ((s.courts || []).length > 1 ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : (venue?.name || t('units.court')))
                const matchTime = m.at
                  ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : (courtObj ? courtObj.from : '')
                const courtTimeStr = matchTime ? `${courtLabel} · ${matchTime}` : courtLabel
                const matchCode = matchCodeOf(db, m)
                const isFromChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                const challenge = isFromChallenge ? (db.challenges || []).find((c) => c.id === m.challengeId) : null
                const hasElo = m.ratingEnabled !== false && m.eloDelta != null && m.eloDelta !== 0
                const deltaStr = hasElo ? `${m.eloDelta > 0 ? '+' : ''}${m.eloDelta}` : '—'

                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-card)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Hàng 1: Mã trận + Sân/giờ và Nút sửa */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={S.monoCode}>{matchCode}</span>
                        <span style={S.monoMeta}>{courtTimeStr}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingMatch(m)}
                        style={{
                          ...S.editInlineBtn,
                          height: 32,
                          padding: '0 12px',
                        }}
                      >
                        {t('matchSearch.btnEdit')}
                      </button>
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
              <div style={{ minWidth: 680 }}>
                <div style={S.tableHead}>
                  <div style={S.thCell}>{t('matchSearch.colCode')}</div>
                  <div style={S.thCell}>{t('matchSearch.colWhen')}</div>
                  <div style={S.thCell}>{t('matchSearch.colWinner')}</div>
                  <div style={{ ...S.thCell, textAlign: 'center' }}>{t('matchSearch.colScore')}</div>
                  <div style={S.thCell}>{t('matchSearch.colLoser')}</div>
                  <div style={S.thCell}>{t('pages.sessions.colDelta')}</div>
                  <div style={S.thCell}>{t('matchSearch.colSource')}</div>
                  <div style={{ ...S.thCell, textAlign: 'right' }}>{t('pages.sessions.colAction')}</div>
                </div>

                {/* Rows */}
                <div style={{ display: 'grid' }}>
                  {matches.map((m) => {
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
                    const courtObj = (s.courts || [])[m.courtIdx]
                    const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                    const courtLabel = courtObj?.label
                      ? courtObj.label
                      : ((s.courts || []).length > 1 ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : (venue?.name || t('units.court')))
                    const matchTime = m.at
                      ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : (courtObj ? courtObj.from : '')
                    const courtTimeStr = matchTime ? `${courtLabel} · ${matchTime}` : courtLabel
                    const matchCode = matchCodeOf(db, m)
                    const isFromChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                    const challenge = isFromChallenge ? (db.challenges || []).find((c) => c.id === m.challengeId) : null
                    const hasElo = m.ratingEnabled !== false && m.eloDelta != null && m.eloDelta !== 0
                    const deltaStr = hasElo ? `${m.eloDelta > 0 ? '+' : ''}${m.eloDelta}` : '—'

                    return (
                      <div key={m.id} style={S.tableRow}>
                        <div style={S.tdCell}>
                          <span style={S.monoCode}>{matchCode}</span>
                        </div>
                        <div style={S.tdCell}>
                          <span style={S.monoMeta} title={venue?.name}>{courtTimeStr}</span>
                        </div>
                        <div style={{ ...S.tdCell, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 20, height: 20, borderRadius: 6,
                            background: 'rgba(240,183,92,0.15)', color: 'var(--status-delayed-fg)', fontSize: 11, flexShrink: 0,
                          }} title={t('matchSearch.colWinner')}>
                            👑
                          </span>
                          <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winnerNames}
                          </span>
                        </div>
                        <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {scoreSets.map((st, sIdx) => (
                            <div key={sIdx} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'var(--surface-sunken)',
                              border: '1px solid var(--border-subtle)',
                              font: '700 14px/1 "Barlow", sans-serif',
                              letterSpacing: '0.03em',
                            }}>
                              <span style={{ color: 'var(--status-delivered-fg)', fontWeight: 800 }}>{st.winPts}</span>
                              <span style={{ margin: '0 3px', opacity: 0.35, fontWeight: 400 }}>:</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{st.losePts}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ ...S.tdCell, minWidth: 0 }}>
                          <span style={{ font: '500 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {loserNames}
                          </span>
                        </div>
                        <div style={S.tdCell}>
                          <span style={{
                            font: '600 12.5px/1 "IBM Plex Mono", monospace',
                            color: hasElo ? 'var(--status-delivered-fg)' : 'var(--text-disabled)',
                          }}>
                            {deltaStr}
                          </span>
                        </div>
                        <div style={S.tdCell}>
                          <span style={{
                            ...S.sourcePill,
                            background: isFromChallenge ? 'var(--surface-nav-active)' : 'var(--surface-card)',
                            borderColor: isFromChallenge ? 'var(--teal-700)' : 'var(--border-subtle)',
                            color: isFromChallenge ? 'var(--status-transit-fg)' : 'var(--text-muted)',
                          }}>
                            {isFromChallenge ? t('challenge.tag', { code: challenge?.code || '' }) : t('challenge.fromCourt')}
                          </span>
                        </div>
                        <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setEditingMatch(m)}
                            style={S.editInlineBtn}
                          >
                            {t('matchSearch.btnEdit')}
                          </button>
                        </div>
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

      {/* ---------------- Cột phải: Kèo trong buổi + Thẻ kết nối ---------------- */}
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        {/* Card Kèo trong buổi */}
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

          <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
            {challenges.map((c) => {
              const teamA = c.teamA || []
              const teamB = c.teamB || []
              const namesA = teamA.map(memberNameOf).join(' · ')
              const namesB = teamB.map(memberNameOf).join(' · ')
              const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0
              const ratB = teamB.length ? Math.round(teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length) : 0
              const gap = Math.abs(ratA - ratB)
              const pA = expectedScore(ratA, ratB)
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

              return (
                <div key={c.id} style={S.challengeCard}>
                  {/* Code & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={S.monoCode}>{c.code}</span>
                    <span style={{
                      ...S.statusBadge,
                      background: isPlayed ? 'var(--surface-brand-soft)' : isAccepted ? 'var(--surface-nav-active)' : 'rgba(240,183,92,0.14)',
                      borderColor: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--teal-700)' : 'var(--border-subtle)',
                      color: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--status-transit-fg)' : 'var(--status-delayed-fg)',
                    }}>
                      {c.status}
                    </span>
                  </div>

                  {/* 2 Đội */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>{namesA}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>{ratA}</div>
                    </div>
                    <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>{namesB}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>{ratB}</div>
                    </div>
                  </div>

                  {/* Win% Bar */}
                  {!isPlayed && (
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

                  {/* Meta */}
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    BO{c.bestOf || 3} · {c.ratingEnabled ? t('challenge.rated') : t('challenge.casual')}
                  </div>

                  {/* Lịch sử đối đầu H2H (K4 / DK4 handoff) */}
                  {h2hMatches.length > 0 && (
                    <div style={S.h2hRow}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('challenge.h2hRecord')}:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-transit-fg)', fontWeight: 600 }}>
                        {h2hWinsA}W – {h2hWinsB}L
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        ({h2hMatches.length} {t('units.match')})
                      </span>
                    </div>
                  )}

                  {/* Contextual actions */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => a.respondChallenge(c.id, true)}
                        style={S.smallPrimaryBtn}
                      >
                        {t('challenge.accept')}
                      </button>
                      <button
                        type="button"
                        onClick={() => a.respondChallenge(c.id, false)}
                        style={S.smallGhostBtn}
                      >
                        {t('challenge.decline')}
                      </button>
                    </div>
                  )}

                  {isAccepted && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleDeployChallenge(c)}
                        style={S.smallPrimaryBtn}
                      >
                        {t('challenge.deployToCourt')}
                      </button>
                      <button
                        type="button"
                        onClick={() => a.cancelChallenge(c.id)}
                        style={S.smallGhostBtn}
                      >
                        {t('challenge.cancel')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {challenges.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                {t('challenge.noSessionChallenges')}
              </div>
            )}
          </div>
        </div>

        {/* Card Kèo nối vào buổi thế nào */}
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
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '88px 84px 1fr 96px 1fr 90px 116px 64px',
    background: 'var(--surface-inset)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  thCell: {
    padding: '0 12px',
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '88px 84px 1fr 96px 1fr 90px 116px 64px',
    borderBottom: '1px solid var(--border-subtle)',
    minHeight: 52,
    alignItems: 'center',
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
  tdCell: {
    padding: '0 12px',
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
}
