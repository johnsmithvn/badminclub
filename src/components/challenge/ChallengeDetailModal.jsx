import { useState, useMemo } from 'react'
import { Dialog } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { myMember, playerName } from '#lib/money.js'
import { expectedScore, getPlayerRating } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { t } from '#i18n'

export default function ChallengeDetailModal({ challenge, session, onClose, onDeployed, onScoreInput }) {
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
    if (!window.confirm(t('common.confirm') + '?')) return
    setSubmitting(true)
    try {
      a.cancelChallenge(c.id)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const namesA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const namesB = resolvedTeamB.length
    ? resolvedTeamB.map((id) => playerName(db, id)).join(' · ')
    : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB'))

  if (!challenge) return null

  return (
    <Dialog
      open
      sheet={isMobile}
      width={480}
      title={`${t('challenge.challenge')} ${c.code}`}
      description={c.scheduledAt || (session ? `${t('units.session')} ${session.date}` : '')}
      onClose={onClose}
      style={{
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
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
                  background: 'var(--action-primary-bg)',
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
                background: 'var(--action-primary-bg)',
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
                    background: 'var(--action-primary-bg)',
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
                {ratA} Elo
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: isOpen ? 'var(--status-delayed-fg)' : 'var(--text-secondary)' }}>
                {namesB}
              </span>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratB ? `${ratB} Elo` : '—'}
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
                <div style={{ width: `${pctA}%`, background: 'var(--action-primary-bg)', height: '100%' }} />
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

        {/* K7: Timeline tiến trình kèo */}
        <div style={S.boxCard}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--status-transit-fg)', marginTop: 3 }} />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {playerName(db, c.createdBy)} {t('challenge.create')}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            </div>

            {c.status !== 'pending' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: isAccepted || isPlayed ? 'var(--status-delivered-fg)' : 'var(--red-500)', marginTop: 3 }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {c.status === 'accepted' || c.status === 'played' ? t('challenge.toastAccepted') : t('challenge.toastDeclined')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {c.acceptedAt ? new Date(c.acceptedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            )}

            {c.matchId && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--status-transit-fg)', marginTop: 3 }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    Match: {c.matchId}
                  </span>
                </div>
              </div>
            )}
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
