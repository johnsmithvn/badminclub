import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { courtOf, playerName } from '#lib/money.js'
import { expectedScore, getPlayerRating } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'

export default function SessionMatchesTab({ s }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [showCreate, setShowCreate] = useState(false)

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

  return (
    <div style={{ ...S.layout, gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 380px' }}>
      {/* ---------------- Cột trái: Bảng Trận đấu của buổi ---------------- */}
      <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
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

          {/* Table Headers & Rows với scroll ngang an toàn trên mobile */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 540 }}>
              <div style={S.tableHead}>
                <div style={S.thCell}>{t('matchSearch.colCode')}</div>
                <div style={S.thCell}>{t('matchSearch.colWhen')}</div>
                <div style={S.thCell}>{t('matchSearch.colWinner')}</div>
                <div style={{ ...S.thCell, textAlign: 'center' }}>{t('matchSearch.colScore')}</div>
                <div style={S.thCell}>{t('matchSearch.colLoser')}</div>
                <div style={S.thCell}>{t('matchSearch.colSource')}</div>
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

              const scoreStr = (m.sets || []).map(([a, b]) => `${a}-${b}`).join(', ')
              const courtName = m.courtId ? courtOf(db, m.courtId).name : t('units.court')
              const isFromChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
              const challenge = isFromChallenge ? (db.challenges || []).find((c) => c.id === m.challengeId) : null

              return (
                <div key={m.id} style={S.tableRow}>
                  <div style={S.tdCell}>
                    <span style={S.monoCode}>{m.code || 'M-000'}</span>
                  </div>
                  <div style={S.tdCell}>
                    <span style={S.monoMeta}>{courtName}</span>
                  </div>
                  <div style={{ ...S.tdCell, minWidth: 0 }}>
                    <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg, #5FD9A2)' }}>
                      {winnerNames}
                    </span>
                  </div>
                  <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center' }}>
                    <span style={{ font: '700 16px/1 Barlow, sans-serif', color: 'var(--text-primary, #E9EFF7)', whiteSpace: 'nowrap' }}>
                      {scoreStr}
                    </span>
                  </div>
                  <div style={{ ...S.tdCell, minWidth: 0 }}>
                    <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)' }}>
                      {loserNames}
                    </span>
                  </div>
                  <div style={S.tdCell}>
                    <span style={{
                      ...S.sourcePill,
                      background: isFromChallenge ? 'rgba(0,178,169,.14)' : 'rgba(255,255,255,.06)',
                      borderColor: isFromChallenge ? 'var(--teal-700, #00786F)' : 'var(--border-subtle, #22304A)',
                      color: isFromChallenge ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-muted, #8494AA)',
                    }}>
                      {isFromChallenge ? t('challenge.tag', { code: challenge?.code || '' }) : t('challenge.fromCourt')}
                    </span>
                  </div>
                </div>
              )
            })}

            {matches.length === 0 && (
              <div style={{ padding: '24px 16px', color: 'var(--text-muted, #8494AA)', fontSize: 13, textAlign: 'center' }}>
                {t('pages.sessions.noMatchesHint')}
              </div>
            )}
              </div>
            </div>
          </div>
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
                      background: isPlayed ? 'rgba(18,168,103,.14)' : isAccepted ? 'rgba(0,178,169,.14)' : 'rgba(224,138,0,.14)',
                      borderColor: isPlayed ? 'var(--green-600, #00875A)' : isAccepted ? 'var(--teal-700, #00786F)' : 'rgba(224,138,0,.3)',
                      color: isPlayed ? 'var(--status-delivered-fg, #5FD9A2)' : isAccepted ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--status-delayed-fg, #F0B75C)',
                    }}>
                      {c.status}
                    </span>
                  </div>

                  {/* 2 Đội */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>{namesA}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>{ratA}</div>
                    </div>
                    <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled, #5B6B81)' }}>VS</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)' }}>{namesB}</div>
                      <div style={{ font: '400 11.5px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>{ratB}</div>
                    </div>
                  </div>

                  {/* Win% Bar */}
                  {!isPlayed && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }}>
                        <span style={{ color: 'var(--status-transit-fg, #5FDBD3)' }}>{pctA}%</span>
                        <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('rating.gap', { gap })}</span>
                        <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{pctB}%</span>
                      </div>
                      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-page, #0B1220)' }}>
                        <div style={{ width: `${pctA}%`, background: 'var(--teal-500, #00B2A9)', height: '100%' }} />
                        <div style={{ width: `${pctB}%`, background: 'var(--border-default, #2E3E5C)', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>
                    BO{c.bestOf || 3} · {c.ratingEnabled ? t('challenge.rated') : t('challenge.casual')}
                  </div>

                  {/* Lịch sử đối đầu H2H (K4 / DK4 handoff) */}
                  {h2hMatches.length > 0 && (
                    <div style={S.h2hRow}>
                      <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('challenge.h2hRecord')}:</span>
                      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)', fontWeight: 600 }}>
                        {h2hWinsA}W – {h2hWinsB}L
                      </span>
                      <span style={{ color: 'var(--text-muted, #8494AA)', fontSize: 11 }}>
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
              <div style={{ color: 'var(--text-muted, #8494AA)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                {t('challenge.noSessionChallenges')}
              </div>
            )}
          </div>
        </div>

        {/* Card Kèo nối vào buổi thế nào */}
        <div style={S.card}>
          <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
            <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8494AA)' }}>
              {t('pages.sessions.wiringTitle')}
            </div>
            <div style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)' }}>
              {t('pages.sessions.wiringDesc')}
            </div>
            <div style={S.wiringBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>session_id</span>
                <span style={{ color: 'var(--text-primary, #E9EFF7)', fontWeight: 600 }}>{s.id.slice(0, 8)}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('pages.sessions.matchFromCourt')}</span>
                <span style={{ color: 'var(--text-primary, #E9EFF7)' }}>{fromSessionCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('pages.sessions.matchFromChallenge')}</span>
                <span style={{ color: 'var(--status-transit-fg, #5FDBD3)' }}>{fromChallengeCount}</span>
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
  card: {
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
    borderRadius: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary, #E9EFF7)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  monoMeta: {
    font: '400 12.5px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg, #5FDBD3)',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '88px 84px 1fr 96px 1fr 116px',
    background: 'var(--surface-inset, #101927)',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
  },
  thCell: {
    padding: '0 12px',
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted, #8494AA)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '88px 84px 1fr 96px 1fr 116px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    minHeight: 52,
    alignItems: 'center',
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
    borderRadius: 6,
    background: 'var(--navy-500, #1D50A0)',
    border: 'none',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--gray-0, #FFFFFF)',
    cursor: 'pointer',
  },
  challengeCard: {
    display: 'grid',
    gap: 8,
    padding: '12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
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
    borderRadius: 6,
    background: 'var(--navy-500, #1D50A0)',
    border: 'none',
    color: 'var(--gray-0, #FFFFFF)',
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
    borderRadius: 6,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-default, #2E3E5C)',
    color: 'var(--text-secondary, #A8B7CB)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  wiringBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 13px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    font: '400 13px/1.5 "IBM Plex Mono", monospace',
  },
  h2hRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 4,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
}
