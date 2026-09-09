import { useState, useMemo } from 'react'
import { Dialog } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { courtOf, myMember, playerName } from '#lib/money.js'
import { expectedScore, getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { t } from '#i18n'

export default function ChallengeDetailModal({ challenge, session, onClose, onDeployed, onScoreInput, onOpenMatch }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const c = challenge || {}
  const myMem = myMember(db)
  const myId = myMem?.id || null

  const teamA = useMemo(() => challenge?.teamA || [], [challenge?.teamA])
  const teamB = useMemo(() => challenge?.teamB || [], [challenge?.teamB])
  const isOpen = !teamB.length || (teamB && teamB.length < (teamA.length > 1 ? 2 : 1))

  const isCreator = Boolean(myId && c.createdBy === myId)
  const isTeamA = Boolean(myId && teamA.includes(myId))
  const isTeamB = Boolean(myId && teamB.includes(myId))
  const isPending = c.status === 'pending'
  const isAccepted = c.status === 'accepted'
  const isPlayed = c.status === 'played'

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

  const getRating = (id) => getPlayerRating(db.playerRatings, id).rating

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
    return searchMatches(db.matches || [], { playerAId: myId, playerBId: opponentId, mode: 'vs' })
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

  // Handlers
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

  const namesA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const namesB = resolvedTeamB.length
    ? resolvedTeamB.map((id) => playerName(db, id)).join(' · ')
    : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB'))

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
          {isPending && isTeamB && (
            <>
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
                {t('challenge.btnAccept')}
              </button>
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
            </>
          )}

          {isOpen && !isTeamA && !isCreator && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {namesA}
              </span>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: isOpen ? 'var(--status-delayed-fg)' : 'var(--text-secondary)' }}>
                {namesB}
              </span>
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
                  : (c.status === 'declined' ? t('challenge.toastDeclined') : t('challenge.status.pending')),
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
