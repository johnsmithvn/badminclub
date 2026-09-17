import { useState, useMemo } from 'react'
import { Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { courtOf, myMember, playerName, playerOf } from '#lib/money.js'
import { expectedScore, getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { getChallengeAcceptanceProgress, canMemberAcceptChallenge, getPredictionStats, getMemberPrediction } from '#lib/challenge.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import { t } from '#i18n'

export default function ChallengeDetailModal({ challenge, session, onClose, onDeployed, onScoreInput, onOpenMatch }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [predTeam, setPredTeam] = useState('A')
  const [predStake, setPredStake] = useState(1)
  const [now] = useState(() => Date.now())

  const c = useMemo(() => challenge || {}, [challenge])
  const myMem = myMember(db)
  const myId = myMem?.id || null
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  const teamA = useMemo(() => challenge?.teamA || [], [challenge?.teamA])
  const teamB = useMemo(() => challenge?.teamB || [], [challenge?.teamB])
  const isOpen = !teamB.length || (teamB && teamB.length < (teamA.length > 1 ? 2 : 1))

  const isCreator = Boolean(myId && c.createdBy === myId)
  const isTeamA = Boolean(myId && teamA.includes(myId))
  const isTeamB = Boolean(myId && teamB.includes(myId))
  const isParticipant = Boolean(myId && [...teamA, ...teamB].includes(myId))
  const isPending = c.status === 'pending'
  const isExpired = c.status === 'expired' || (c.expiresAt && new Date(c.expiresAt).getTime() <= now)
  const isAccepted = c.status === 'accepted' || c.status === 'oncourt'
  const isPlayed = c.status === 'played'

  const prog = useMemo(() => getChallengeAcceptanceProgress(c), [c])
  const canAccept = canMemberAcceptChallenge(c, myId, isAdmin)

  // Match liên quan nếu đã tạo/nhập tỷ số
  const matchObj = useMemo(() => {
    return (db.matches || []).find((m) => m.id === c.matchId || m.challengeId === c.id)
  }, [db.matches, c.matchId, c.id])
  const matchCode = matchObj ? matchCodeOf(db, matchObj) : (c.matchId ? `M-${c.matchId.slice(0, 4)}` : null)

  // Available partners for open challenge (only club members who checked in, excluding guests)
  const pickablePartners = useMemo(() => {
    if (!session) return []
    const att = db.attendance?.[session.id] || {}
    const busyIds = new Set([...teamA, ...(myId ? [myId] : [])])
    return (db.members || []).filter((m) => m.active !== false && att[m.id] === true && !busyIds.has(m.id))
  }, [db.attendance, db.members, session, teamA, myId])

  const getRating = (id) => getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels).rating

  // Calculate ratings
  const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0

  const resolvedTeamB = useMemo(() => {
    if (isOpen && selectedPartner) {
      return teamA.length > 1 ? [myId, selectedPartner] : [myId]
    }
    return teamB
  }, [isOpen, selectedPartner, teamB, teamA.length, myId])

  const ratB = resolvedTeamB.length
    ? Math.round(resolvedTeamB.reduce((sum, id) => sum + getRating(id), 0) / resolvedTeamB.length)
    : 0

  const gap = Math.abs(ratA - ratB)
  const pA = expectedScore(ratA, ratB || ratA)
  const pctA = Math.round(pA * 100)
  const pctB = 100 - pctA

  // H2H statistics between current user and opponent creator
  const opponentId = isTeamB ? teamA[0] : (isTeamA ? teamB[0] : teamA[0])
  const h2hMatches = useMemo(() => {
    if (!myId || !opponentId) return []
    return searchMatches(db.matches || [], { playerA: myId, playerB: opponentId, mode: 'vs' })
  }, [db.matches, myId, opponentId])

  const h2hWins = h2hMatches.filter((m) => {
    const wonA = m.winnerTeam === 'A'
    const isMeInA = (m.teamA || []).includes(myId)
    return (isMeInA && wonA) || (!isMeInA && !wonA)
  }).length
  const h2hLosses = h2hMatches.length - h2hWins

  const recent5 = h2hMatches.slice(0, 5).map((m) => {
    const wonA = m.winnerTeam === 'A'
    const isMeInA = (m.teamA || []).includes(myId)
    return (isMeInA && wonA) || (!isMeInA && !wonA) ? 'W' : 'L'
  })

  // Predictions
  const predictions = useMemo(() => db.challengePredictions || [], [db.challengePredictions])
  const predStats = useMemo(() => getPredictionStats(predictions, c.id), [predictions, c.id])
  const myPred = useMemo(() => getMemberPrediction(predictions, c.id, myId), [predictions, c.id, myId])
  const seasonRes = useMemo(() => calculateSeasonLeaderboard(db), [db])
  const myLbRow = useMemo(() => (seasonRes?.leaderboard || []).find((r) => r.id === myId), [seasonRes, myId])
  const totalSp = myLbRow?.totalSeasonPoints || 0
  const pendingSum = useMemo(() => predictions.filter((p) => p.memberId === myId && p.status === 'pending').reduce((sum, p) => sum + (Number(p.stakePoints) || 0), 0), [predictions, myId])
  const availableSp = Math.max(0, totalSp - pendingSum)
  const isPredLocked = Boolean(c.predictionsLocked || c.status === 'oncourt' || c.status === 'played' || c.status === 'cancelled' || isExpired)

  // Handlers
  const handlePlacePrediction = () => {
    if (!predTeam || !predStake) return
    setSubmitting(true)
    try {
      a.placePrediction({ challengeId: c.id, team: predTeam, stakePoints: predStake })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelPrediction = () => {
    if (!myPred) return
    setSubmitting(true)
    try {
      a.cancelPrediction(myPred.id)
    } finally {
      setSubmitting(false)
    }
  }
  const handleAccept = () => {
    setSubmitting(true)
    try {
      a.respondChallenge(c.id, true)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = () => {
    setSubmitting(true)
    try {
      a.respondChallenge(c.id, false)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptOpen = () => {
    if (teamA.length > 1 && !selectedPartner) {
      a.toast(t('challenge.pickTwo'))
      return
    }
    setSubmitting(true)
    try {
      a.acceptOpenChallenge({ challengeId: c.id, partnerId: selectedPartner })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    a.confirm({
      title: t('challenge.cancelTitle'),
      message: t('challenge.cancelMsg'),
      tone: 'danger',
      confirmText: t('challenge.cancelOk'),
      onConfirm: () => {
        setSubmitting(true)
        try {
          a.cancelChallenge(c.id)
          onClose()
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const handleDelete = () => {
    a.confirm({
      title: t('challenge.confirmDeleteTitle'),
      message: t('challenge.confirmDeleteMsg'),
      tone: 'danger',
      confirmText: t('challenge.btnDelete'),
      onConfirm: () => {
        setSubmitting(true)
        try {
          a.deleteChallenge(c.id)
          onClose()
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const creatorName = c.createdBy ? playerName(db, c.createdBy) : (teamA[0] ? playerName(db, teamA[0]) : '')
  const acceptorName = c.acceptedBy
    ? playerName(db, c.acceptedBy)
    : (teamB[0] ? playerName(db, teamB[0]) : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB')))

  const createdTimeStr = c.createdAt
    ? new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '20:14'
  const expireTimeStr = c.expiresAt
    ? new Date(c.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : (c.createdAt ? new Date(new Date(c.createdAt).getTime() + 60 * 60 * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '21:14')
  const acceptedTimeStr = c.acceptedAt
    ? new Date(c.acceptedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : createdTimeStr
  const courtName = c.courtId
    ? (courtOf(db, c.courtId)?.name || `${t('units.court')} ${c.courtId}`)
    : (c.courtName ? `${t('units.court')} ${c.courtName}` : '')
  const matchTimeStr = matchObj?.createdAt
    ? new Date(matchObj.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''

  const headerSubText = t('challenge.headerMeta', {
    creator: creatorName || t('challenge.teamA'),
    time: createdTimeStr,
    date: session?.date || '',
    court: courtName ? ` · ${courtName}` : '',
  })

  if (!challenge) return null

  return (
    <Dialog
      open
      sheet={isMobile}
      width={480}
      title={`${t('challenge.challenge')} ${c.code}`}
      description={headerSubText}
      onClose={onClose}
      style={{
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
          {isPending && isExpired && (
            <div style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--red-500, #ef4444)',
              color: 'var(--red-500, #ef4444)',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
            }}>
              {t('challenge.status.expired')}
            </div>
          )}

          {isPending && !isExpired && canAccept && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleAccept}
              style={{
                flex: 1,
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '700 15px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {isAdmin && !isParticipant ? t('challenge.btnAdminApprove') : t('challenge.btnAccept')}
            </button>
          )}

          {isPending && !isExpired && (isParticipant || isAdmin) && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleDecline}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 14px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('challenge.btnDecline')}
            </button>
          )}

          {isPending && !isExpired && isOpen && !isTeamA && !isCreator && (
            <button
              type="button"
              disabled={submitting || (teamA.length > 1 && !selectedPartner)}
              onClick={handleAcceptOpen}
              style={{
                flex: 1,
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '700 15px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: submitting || (teamA.length > 1 && !selectedPartner) ? 'not-allowed' : 'pointer',
                opacity: teamA.length > 1 && !selectedPartner ? 0.45 : 1,
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {t('challenge.btnAccept')}
            </button>
          )}

          {isAccepted && (
            <>
              {onDeployed && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onDeployed(c)
                  }}
                  style={{
                    flex: 1,
                    height: isMobile ? 56 : 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--status-delivered)',
                    border: 'none',
                    font: '700 15px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--gray-0)',
                    cursor: 'pointer',
                  }}
                >
                  {t('challenge.btnDeploy')}
                </button>
              )}
              {onScoreInput && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onScoreInput(c)
                  }}
                  style={{
                    flex: 1,
                    height: isMobile ? 56 : 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    font: '600 14px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--status-transit-fg)',
                    cursor: 'pointer',
                  }}
                >
                  {t('scoreModal.title')}
                </button>
              )}
            </>
          )}

          {isPending && (isCreator || isTeamA) && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleCancel}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 13px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('challenge.btnCancel')}
            </button>
          )}

          {/* DT3: Nút mở trực tiếp trận đấu nếu đã có match */}
          {matchObj && onOpenMatch && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenMatch(matchObj)
              }}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '600 14px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: 'pointer',
              }}
            >
              {t('challenge.btnOpenMatch', { code: matchCode })}
            </button>
          )}

          {/* Nút xoá vĩnh viễn kèo cho Admin */}
          {isAdmin && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleDelete}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 13px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <Icon name="trash-2" size={14} style={{ marginRight: 6 }} />
              <span>{t('challenge.btnDelete')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              height: isMobile ? 56 : 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              font: '600 14px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Matchup Card */}
        <div style={S.boxCard}>
          {isPending && !isExpired && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)', marginBottom: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {t('challenge.acceptedProgress', { count: prog.acceptedCount, total: prog.totalCount })}
              </span>
              {Boolean(myId && (c.acceptedPlayers || []).includes(myId)) && !prog.isFullyAccepted && (
                <span style={{ fontSize: 12, color: 'var(--status-delivered-fg)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={12} />
                  <span>{t('challenge.youAcceptedWaiting')}</span>
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {teamA.map((id) => {
                  const isAcc = (c.acceptedPlayers || []).includes(id)
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{playerName(db, id)}</span>
                      {isPending && isAcc && (
                        <Icon name="check" size={13} style={{ color: 'var(--status-delivered-fg)' }} title={t('challenge.statusAccepted')} />
                      )}
                    </span>
                  )
                })}
              </div>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: resolvedTeamB.length ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
                {resolvedTeamB.length ? resolvedTeamB.map((id) => {
                  const isAcc = (c.acceptedPlayers || []).includes(id)
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{playerName(db, id)}</span>
                      {isPending && isAcc && (
                        <Icon name="check" size={13} style={{ color: 'var(--status-delivered-fg)' }} title={t('challenge.statusAccepted')} />
                      )}
                    </span>
                  )
                }) : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB'))}
              </div>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratB > 0 ? t('challenge.avgRating', { r: ratB.toLocaleString('vi-VN') }) : '—'}
              </span>
            </div>
          </div>

          {/* Win% Bar */}
          {!isPlayed && ratB > 0 && (
            <div style={{ display: 'grid', gap: 5, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--status-transit-fg)', fontWeight: 600 }}>{pctA}%</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('rating.gap', { gap })}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{pctB}%</span>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                <div style={{ width: `${pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%' }} />
                <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
              </div>
            </div>
          )}
        </div>

        {/* K6: Dự đoán kết quả (Thưởng Season Points) */}
        {c.predictionsEnabled !== false && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="target" size={15} style={{ color: 'var(--status-transit-fg)' }} />
                <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {t('challenge.predictionTitle')}
                </span>
              </div>
              {isPredLocked ? (
                <span style={{
                  font: '600 11px/1 "IBM Plex Sans", sans-serif',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-chip)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {t('challenge.predictionLockedBadge')}
                </span>
              ) : (
                <span style={{ font: '400 11.5px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                  {t('challenge.predictionVotes', { count: predStats.totalCount, points: predStats.totalPoints })}
                </span>
              )}
            </div>

            {/* Thanh tỉ lệ dự đoán */}
            <div style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--action-accent-bg, var(--teal-500))', fontWeight: 600 }}>
                  {t('challenge.teamA')}: {predStats.pctA}% ({predStats.pointsA} SP)
                </span>
                <span style={{ color: 'var(--status-incident, var(--red-500))', fontWeight: 600 }}>
                  {t('challenge.teamB')}: {predStats.pctB}% ({predStats.pointsB} SP)
                </span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                <div style={{ width: `${predStats.pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%', transition: 'width 0.3s' }} />
                <div style={{ width: `${predStats.pctB}%`, background: 'var(--status-incident, var(--red-500))', height: '100%', transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Trường hợp đấu thủ trong trận: Cấm tham gia */}
            {isParticipant ? (
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-delayed-bg)',
                border: '1px solid var(--status-delayed)',
                fontSize: 12,
                color: 'var(--status-delayed-fg)',
                lineHeight: 1.4,
              }}>
                {t('challenge.predictionPlayerConflict')}
              </div>
            ) : myPred ? (
              /* Đã dự đoán */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                    {t('challenge.predictionMyVote', {
                      team: myPred.team === 'A' ? t('challenge.teamA') : t('challenge.teamB'),
                      points: myPred.stakePoints,
                    })}
                  </span>
                  <span style={{ font: '500 11.5px/1.2 "IBM Plex Sans", sans-serif', color: myPred.status === 'won' ? 'var(--status-delivered-fg)' : myPred.status === 'lost' ? 'var(--red-500, #ef4444)' : 'var(--text-muted)' }}>
                    {myPred.status === 'won'
                      ? t('challenge.predictionStatusWon', { net: myPred.stakePoints })
                      : myPred.status === 'lost'
                      ? t('challenge.predictionStatusLost', { stake: myPred.stakePoints })
                      : myPred.status === 'refunded'
                      ? t('challenge.predictionStatusRefunded', { points: myPred.payoutPoints })
                      : t('challenge.predictionStatusPending')}
                  </span>
                </div>
                {myPred.status === 'pending' && !isPredLocked && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCancelPrediction}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--red-500, #ef4444)',
                      font: '600 12px/1 "IBM Plex Sans", sans-serif',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {t('challenge.predictionCancelBtn')}
                  </button>
                )}
              </div>
            ) : isPredLocked ? (
              /* Chưa dự đoán nhưng kèo đã khoá */
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}>
                {t('challenge.predictionLockedDesc')}
              </div>
            ) : (
              /* Form đặt dự đoán */
              <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                {/* Chọn đội A hoặc B */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPredTeam('A')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: predTeam === 'A' ? 'rgba(0,178,169,0.14)' : 'var(--surface-sunken)',
                      border: predTeam === 'A' ? '1.5px solid var(--action-accent-bg, var(--teal-500))' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ font: '700 13px/1.2 "IBM Plex Sans", sans-serif', color: predTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-primary)' }}>
                      {t('challenge.teamA')}
                    </span>
                    <span style={{ font: '400 11px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                      {teamA.map((id) => playerName(db, id)).join(' · ')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPredTeam('B')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: predTeam === 'B' ? 'rgba(239,68,68,0.12)' : 'var(--surface-sunken)',
                      border: predTeam === 'B' ? '1.5px solid var(--status-incident, var(--red-500))' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ font: '700 13px/1.2 "IBM Plex Sans", sans-serif', color: predTeam === 'B' ? 'var(--red-500, #ef4444)' : 'var(--text-primary)' }}>
                      {t('challenge.teamB')}
                    </span>
                    <span style={{ font: '400 11px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                      {resolvedTeamB.length ? resolvedTeamB.map((id) => playerName(db, id)).join(' · ') : t('challenge.teamB')}
                    </span>
                  </button>
                </div>

                {/* Chọn mức SP: 1 SP / 2 SP / 3 SP */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ font: '500 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                    {t('challenge.predictionStakeLabel')}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3].map((pt) => {
                      const isSelected = predStake === pt
                      const disabled = pt > availableSp
                      return (
                        <button
                          key={pt}
                          type="button"
                          disabled={disabled}
                          onClick={() => setPredStake(pt)}
                          style={{
                            minWidth: 44,
                            padding: '5px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'var(--action-accent-bg, var(--teal-500))' : 'var(--surface-sunken)',
                            color: isSelected ? 'var(--gray-0, #fff)' : disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                            border: isSelected ? '1px solid var(--action-accent-bg, var(--teal-500))' : '1px solid var(--border-subtle)',
                            font: '700 12px/1 "IBM Plex Mono", monospace',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.5 : 1,
                          }}
                        >
                          {pt} SP
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Số SP khả dụng & Tỉ lệ thưởng */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <span>{t('challenge.predictionAvailableSp', { points: availableSp })}</span>
                  <span style={{ color: predStake > availableSp ? 'var(--red-500, #ef4444)' : 'var(--status-delivered-fg)' }}>
                    {t('challenge.predictionWinReward', { payout: predStake * 2, stake: predStake })}
                  </span>
                </div>

                {/* Nút gửi dự đoán */}
                <button
                  type="button"
                  disabled={submitting || !myId || predStake > availableSp}
                  onClick={handlePlacePrediction}
                  style={{
                    width: '100%',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--action-accent-bg, var(--teal-500))',
                    border: 'none',
                    font: '700 13.5px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--gray-0, #fff)',
                    cursor: (submitting || !myId || predStake > availableSp) ? 'not-allowed' : 'pointer',
                    opacity: (submitting || !myId || predStake > availableSp) ? 0.6 : 1,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <Icon name="target" size={14} />
                  <span>{t('challenge.predictionPlaceBtn')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* K5: Chọn đồng đội khi nhận kèo mở */}
        {isOpen && !isTeamA && !isCreator && teamA.length > 1 && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
              <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('challenge.pickTwo')}
              </span>
              <span style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('challenge.presentMembers')}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {pickablePartners.map((m) => {
                const isSelected = selectedPartner === m.id
                const r = getRating(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedPartner(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(0,178,169,0.12)' : 'var(--surface-sunken)',
                      border: isSelected ? '1.5px solid var(--status-transit-fg)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 999,
                      border: isSelected ? '5px solid var(--status-transit-fg)' : '1.5px solid var(--border-default)',
                    }} />
                    <span style={{ flex: 1, font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                      {m.name}
                    </span>
                    <span style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      {r} Elo
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* K4: Thống kê đối đầu H2H quá khứ */}
        {h2hMatches.length > 0 && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('challenge.h2hRecord')}
              </span>
              <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {h2hMatches.length} {t('units.match')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 0' }}>
              <span style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--status-delivered-fg)' }}>{h2hWins}</span>
              <span style={{ color: 'var(--text-disabled)', fontSize: 16 }}>–</span>
              <span style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--text-secondary)' }}>{h2hLosses}</span>
            </div>
            {recent5.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '400 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  5 {t('units.match')} {t('common.today')}:
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {recent5.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        width: 20, height: 20, borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        font: '700 11px/1 Barlow, sans-serif',
                        background: r === 'W' ? 'rgba(18,168,103,0.18)' : 'rgba(239,68,68,0.18)',
                        color: r === 'W' ? 'var(--status-delivered-fg)' : 'var(--red-500, #ef4444)',
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DT3: Timeline 4 bước tới Match */}
        <div style={S.boxCard}>
          <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            {t('challenge.timelineTitle')}
          </div>

          <div style={{ display: 'grid', gap: 0, position: 'relative' }}>
            {[
              {
                title: t('challenge.step1Create', { name: creatorName || t('challenge.teamA') }),
                sub: t('challenge.step1Sub', { time: createdTimeStr, expire: expireTimeStr }),
                status: 'done',
              },
              {
                title: t('challenge.step2Accept', { name: acceptorName || t('challenge.teamB') }),
                sub: (isAccepted || isPlayed)
                  ? t('challenge.step2Sub', { time: acceptedTimeStr })
                  : (c.status === 'declined'
                    ? t('challenge.toastDeclined')
                    : (prog.totalCount > 0 ? t('challenge.acceptedProgress', { count: prog.acceptedCount, total: prog.totalCount }) : t('challenge.status.pending'))),
                status: (isAccepted || isPlayed) ? 'done' : (isPending ? 'current' : 'pending'),
              },
              {
                title: t('challenge.step3WaitCourt'),
                sub: (courtName || c.deployedAt || isPlayed)
                  ? t('challenge.step3Sub', { time: c.deployedAt ? new Date(c.deployedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : acceptedTimeStr, court: courtName || t('units.court') })
                  : t('challenge.step3SubPending'),
                status: (isPlayed || courtName || c.deployedAt) ? 'done' : (isAccepted ? 'current' : 'pending'),
              },
              {
                title: t('challenge.step4Score', { match: matchCode || 'M-xxxx' }),
                sub: (matchObj || isPlayed)
                  ? t('challenge.step4Sub', { time: matchTimeStr || '—' })
                  : t('challenge.step4SubPending'),
                status: (matchObj || isPlayed) ? 'done' : 'pending',
              },
            ].map((st, idx, arr) => {
              const isLast = idx === arr.length - 1
              return (
                <div key={idx} style={{ display: 'flex', gap: 12, position: 'relative', minHeight: isLast ? undefined : 46 }}>
                  {/* Cột vạch nối và dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      marginTop: 3,
                      background: st.status === 'done' ? 'var(--status-delivered)' : st.status === 'current' ? 'var(--surface-card)' : 'var(--surface-sunken)',
                      border: st.status === 'done'
                        ? '2px solid var(--status-delivered)'
                        : st.status === 'current'
                        ? '2px solid var(--status-delivered)'
                        : '2px solid var(--border-default)',
                      boxShadow: st.status === 'current' ? '0 0 0 3px rgba(14, 138, 85, 0.16)' : 'none',
                      zIndex: 1,
                    }} />
                    {!isLast && (
                      <div style={{
                        flex: 1,
                        width: 2,
                        background: st.status === 'done' ? 'var(--status-delivered)' : 'var(--border-subtle)',
                        margin: '2px 0',
                      }} />
                    )}
                  </div>

                  {/* Cột thông tin bước */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                    <div style={{
                      font: '600 13px/1.3 "IBM Plex Sans", sans-serif',
                      color: st.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}>
                      {st.title}
                    </div>
                    <div style={{
                      font: '400 11.5px/1.3 "IBM Plex Mono", monospace',
                      color: st.status === 'pending' ? 'var(--text-disabled)' : 'var(--text-muted)',
                      marginTop: 2,
                    }}>
                      {st.sub}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* DT3: Bảng thông số kỹ thuật metadata */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{
            display: 'grid',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
            overflow: 'hidden',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaStatus')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{(c.status || 'pending').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaMatch')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: matchCode ? 'var(--status-delivered-fg)' : 'var(--text-disabled)' }}>
                {matchCode ? t('challenge.techMetaMatchCreated', { code: matchCode }) : t('challenge.techMetaMatchPending')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaRatingEnabled')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{c.ratingEnabled !== false ? 'true' : 'false'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaRatingAlgorithm')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('challenge.techMetaAlgoValue')}</span>
            </div>
          </div>
          <div style={{ font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
            {t('challenge.techMetaDeclinedNote')}
          </div>
        </div>

        {/* Notice về Elo */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0,178,169,0.08)',
          border: '1px solid rgba(0,178,169,0.2)',
          fontSize: 12,
          color: 'var(--status-transit-fg)',
          lineHeight: 1.4,
        }}>
          {c.ratingEnabled !== false ? t('challenge.ratedTag') : t('challenge.casualTag')} · {t('challenge.ratingHint')}
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  boxCard: {
    padding: '12px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}
