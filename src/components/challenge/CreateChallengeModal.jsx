import { useState, useMemo } from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import {
  expectedScore, calcEloDelta, getPlayerRating, confidenceProgress,
  BALANCE_THRESHOLD, IMBALANCE_THRESHOLD,
} from '#lib/rating.js'
import { playerName, playerOf } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function CreateChallengeModal({ session, onClose, onCreated, initialTeamA = [], initialTeamB = [] }) {
  const { db, a } = useApp()
  const [teamA, setTeamA] = useState(initialTeamA)
  const [teamB, setTeamB] = useState(initialTeamB)
  const [bestOf, setBestOf] = useState(cfg.challenge?.defaultBestOf || 3)
  const [ratingEnabled, setRatingEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedSessionId, setSelectedSessionId] = useState(() => session?.id || null)
  const activeSession = useMemo(() => {
    if (session) return session
    if (!selectedSessionId) return null
    return (db.sessions || []).find((s) => s.id === selectedSessionId) || null
  }, [session, db.sessions, selectedSessionId])

  // Toàn bộ thành viên hoạt động trong CLB
  const allActiveMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  // Danh sách thành viên đã điểm danh có mặt trong buổi
  const presentMembers = useMemo(() => {
    if (!activeSession) return []
    const att = db.attendance?.[activeSession.id] || {}
    return allActiveMembers.filter((m) => att[m.id] === true)
  }, [activeSession, db.attendance, allActiveMembers])

  // Trạng thái lọc: nếu buổi có người có mặt thì có thể lọc người có mặt, mặc định hoặc khi chọn Tất cả thì cho phép chọn bất kỳ thành viên nào
  const [onlyPresent, setOnlyPresent] = useState(false)

  // Danh sách thành viên chọn:
  // - Nếu không gắn buổi: toàn bộ thành viên CLB
  // - Nếu gắn buổi nhưng buổi chưa có ai có mặt: fallback toàn bộ thành viên CLB (không chặn trống)
  // - Nếu gắn buổi và bật lọc có mặt: chỉ người có mặt
  const pickableMembers = useMemo(() => {
    if (activeSession && onlyPresent && presentMembers.length > 0) {
      return presentMembers
    }
    return allActiveMembers
  }, [activeSession, onlyPresent, presentMembers, allActiveMembers])

  const [searchQuery, setSearchQuery] = useState('')
  const displayedPickableMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return pickableMembers
    return pickableMembers.filter((m) => (m.name || '').toLowerCase().includes(q))
  }, [pickableMembers, searchQuery])

  // Lấy rating của từng người (an toàn với cả Map lẫn Array)
  const getRating = (mid) => getPlayerRating(db.playerRatings, mid, playerOf(db, mid), db.levels).rating

  // Luân chuyển: Chưa chọn -> Đội A -> Đội B -> Chưa chọn
  const cycleMember = (mid) => {
    if (teamA.includes(mid)) {
      setTeamA(teamA.filter((id) => id !== mid))
      if (teamB.length < 2) {
        setTeamB([...teamB, mid])
      }
    } else if (teamB.includes(mid)) {
      setTeamB(teamB.filter((id) => id !== mid))
    } else {
      if (teamA.length < 2) {
        setTeamA([...teamA, mid])
      } else if (teamB.length < 2) {
        setTeamB([...teamB, mid])
      }
    }
  }

  // Tính rating trung bình
  const avgRatingA = useMemo(() => {
    if (!teamA.length) return 0
    const sum = teamA.reduce((acc, id) => acc + getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels).rating, 0)
    return Math.round(sum / teamA.length)
  }, [teamA, db])

  const avgRatingB = useMemo(() => {
    if (!teamB.length) return 0
    const sum = teamB.reduce((acc, id) => acc + getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels).rating, 0)
    return Math.round(sum / teamB.length)
  }, [teamB, db])

  const gap = Math.abs(avgRatingA - avgRatingB)
  const isImbalanced = gap > IMBALANCE_THRESHOLD

  // Elo win%
  const [pctA, pctB] = useMemo(() => {
    if (!teamA.length || !teamB.length) return [50, 50]
    const pA = expectedScore(avgRatingA, avgRatingB)
    const roundA = Math.round(pA * 100)
    return [roundA, 100 - roundA]
  }, [avgRatingA, avgRatingB, teamA, teamB])

  const deltaA_win = calcEloDelta(avgRatingA, avgRatingB, true).deltaA
  const deltaB_win = calcEloDelta(avgRatingA, avgRatingB, false).deltaB

  const ready = (teamA.length === 2 && teamB.length === 2) || (teamA.length === 1 && teamB.length === 1)

  const handleSubmit = () => {
    if (!ready || submitting) return
    setSubmitting(true)
    try {
      const created = a.createChallenge({
        sessionId: activeSession ? activeSession.id : null,
        teamA,
        teamB,
        bestOf,
        ratingEnabled,
      })
      if (created && onCreated) onCreated(created)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const memberNameOf = (id) => playerName(db, id)

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Modal Header */}
        <div style={S.header}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={S.title}>
              {activeSession ? t('challenge.createTitleSession', { date: activeSession.date.slice(5) }) : t('challenge.createTitle')}
            </div>
            <div style={S.subtitle}>{t('challenge.createSub')}</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}>{t('common.close')}</button>
        </div>

        {!session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('challenge.chooseSession')}:</span>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => {
                setSelectedSessionId(e.target.value || null)
                setOnlyPresent(false)
              }}
              style={{ background: 'transparent', border: 'none', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <option value="" style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }}>
                {t('matchesPage.noSessionLinked')}
              </option>
              {(db.sessions || []).slice(0, 12).map((s) => (
                <option key={s.id} value={s.id} style={{ background: 'var(--surface-card)', color: 'var(--text-primary)' }}>
                  {t('challenge.sessionItemDate', { date: s.date })} {s.title ? `· ${s.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={S.body}>
          {/* 2 Đội preview */}
          <div style={S.teamsRow}>
            {/* Đội A */}
            <div style={{ ...S.teamCard, borderColor: 'var(--teal-700)' }}>
              <div style={S.teamHead}>
                <span style={S.teamLabelA}>{t('challenge.teamA')}</span>
                <span style={S.teamRatingMono}>{teamA.length ? avgRatingA : '—'}</span>
              </div>
              <div style={S.teamNames}>
                {teamA.length ? teamA.map(memberNameOf).join(' · ') : <span style={S.faintText}>{t('challenge.teamEmptyHint')}</span>}
              </div>
              {teamA.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {teamA.map((id) => {
                    const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
                    const conf = confidenceProgress(pr.gamesCount || 0)
                    return (
                      <span key={id} style={confTagStyle(conf.level)}>
                        {conf.level} · {t('challenge.gamesCountMeta', { n: pr.gamesCount || 0 })}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Đội B */}
            <div style={{ ...S.teamCard, borderColor: 'var(--border-default)' }}>
              <div style={S.teamHead}>
                <span style={S.teamLabelB}>{t('challenge.teamB')}</span>
                <span style={S.teamRatingMono}>{teamB.length ? avgRatingB : '—'}</span>
              </div>
              <div style={S.teamNames}>
                {teamB.length ? teamB.map(memberNameOf).join(' · ') : <span style={S.faintText}>{t('challenge.teamEmptyHint')}</span>}
              </div>
              {teamB.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {teamB.map((id) => {
                    const pr = getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels)
                    const conf = confidenceProgress(pr.gamesCount || 0)
                    return (
                      <span key={id} style={confTagStyle(conf.level)}>
                        {conf.level} · {t('challenge.gamesCountMeta', { n: pr.gamesCount || 0 })}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Danh sách thành viên chọn */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={S.sectionLabel}>
                {activeSession && onlyPresent && presentMembers.length > 0
                  ? t('challenge.presentMembers', { n: displayedPickableMembers.length })
                  : t('challenge.pickableAll', { n: displayedPickableMembers.length })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Ô tìm kiếm nhanh thành viên */}
                <div style={{ position: 'relative', width: 140 }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder={t('challenge.searchMemberPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 22px 4px 26px',
                      borderRadius: 6,
                      fontSize: 12,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>

                {activeSession && presentMembers.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setOnlyPresent(true)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid',
                        cursor: 'pointer',
                        background: onlyPresent ? 'var(--teal-700)' : 'transparent',
                        borderColor: onlyPresent ? 'var(--teal-500)' : 'var(--border-subtle)',
                        color: onlyPresent ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {t('challenge.filterPresent', { n: presentMembers.length })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlyPresent(false)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid',
                        cursor: 'pointer',
                        background: !onlyPresent ? 'var(--teal-700)' : 'transparent',
                        borderColor: !onlyPresent ? 'var(--teal-500)' : 'var(--border-subtle)',
                        color: !onlyPresent ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {t('challenge.filterAll', { n: allActiveMembers.length })}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {activeSession && presentMembers.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('challenge.noPresentFallback')}
              </div>
            )}
            <div style={S.chipWrap}>
              {displayedPickableMembers.map((m) => {
                const inA = teamA.includes(m.id)
                const inB = teamB.includes(m.id)
                const r = getRating(m.id)
                const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
                const conf = confidenceProgress(pr.gamesCount || 0)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => cycleMember(m.id)}
                    style={{
                      ...S.playerChip,
                      background: inA ? 'var(--navy-500)' : inB ? 'var(--navy-800)' : 'var(--surface-card)',
                      borderColor: inA ? 'var(--navy-400)' : inB ? 'var(--navy-600)' : 'var(--border-subtle)',
                      color: inA || inB ? 'var(--action-primary-fg)' : 'var(--text-primary)',
                    }}
                  >
                    <span>{m.name}</span>
                    <span style={{ ...S.monoRating, color: inA || inB ? 'var(--navy-200)' : 'var(--text-muted)' }}>{r}</span>
                    <span style={confBadgeStyle(conf.level)}>{conf.level}</span>
                    {inA && <span style={S.teamTag}>A</span>}
                    {inB && <span style={S.teamTag}>B</span>}
                  </button>
                )
              })}
              {displayedPickableMembers.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 4px' }}>
                  {searchQuery ? t('challenge.noMatchingMembers') : t('challenge.noPresentMembers')}
                </div>
              )}
            </div>
          </div>

          {/* Độ cân & Đánh giá cân kèo */}
          <div style={S.analysisRow}>
            <div style={S.analysisCard}>
              <div style={S.sectionLabel}>{t('challenge.balanceTitle')}</div>
              <div style={S.pctRow}>
                <span style={{ ...S.pctNum, color: 'var(--status-transit-fg)' }}>{pctA}%</span>
                <span style={S.gapMono}>{t('rating.gap', { gap })}</span>
                <span style={{ ...S.pctNum, color: 'var(--text-secondary)' }}>{pctB}%</span>
              </div>
              <div style={S.barTrack}>
                <div style={{ width: `${pctA}%`, background: 'var(--teal-500)', height: '100%' }} />
                <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: isImbalanced ? 'var(--status-delayed-fg)' : gap <= BALANCE_THRESHOLD ? 'var(--status-delivered-fg)' : 'var(--status-transit-fg)',
                marginTop: 2,
              }}>
                {isImbalanced ? t('challenge.imbalancedWarn', { gap: IMBALANCE_THRESHOLD }) : gap <= BALANCE_THRESHOLD ? t('challenge.veryBalanced') : t('challenge.quiteBalanced')}
              </div>
            </div>

            <div style={S.analysisCard}>
              <button
                type="button"
                onClick={() => setRatingEnabled(!ratingEnabled)}
                style={S.checkboxRow}
              >
                <div style={{
                  ...S.checkboxBox,
                  background: ratingEnabled ? 'var(--teal-500)' : 'transparent',
                  borderColor: ratingEnabled ? 'var(--teal-500)' : 'var(--border-default)',
                }}>
                  {ratingEnabled && <Icon name="check" size={12} color="var(--teal-900)" />}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ font: '600 13px/1.4 var(--font-sans)', color: 'var(--text-primary)' }}>
                    {t('challenge.rateOptionTitle')}
                  </div>
                  <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>
                    {t('challenge.rateOptionHint')}
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('challenge.format')}:</span>
                {[1, 3].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBestOf(b)}
                    style={{
                      ...S.boBtn,
                      background: bestOf === b ? 'var(--navy-500)' : 'var(--surface-card)',
                      borderColor: bestOf === b ? 'var(--navy-400)' : 'var(--border-default)',
                      color: bestOf === b ? 'var(--action-primary-fg)' : 'var(--text-secondary)',
                    }}
                  >
                    BO{b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cảnh báo K3: Kèo lệch trình độ & Chi tiết delta 2 kịch bản */}
          {isImbalanced && (
            <div style={S.imbalanceDetailedCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-delayed-fg)', fontWeight: 600, fontSize: 13 }}>
                <span>⚠️</span> {t('challenge.imbalancedWarn', { gap })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 4 }}>
                <div style={S.scenarioBox}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{t('challenge.ifWinA')}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--status-delivered-fg)', fontWeight: 600 }}>
                    +{deltaA_win} / -{deltaA_win}
                  </div>
                </div>
                <div style={S.scenarioBox}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{t('challenge.ifWinB')}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--status-delayed-fg)', fontWeight: 600 }}>
                    +{deltaB_win} / -{deltaB_win}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                {t('challenge.imbalanceNotice')}
              </div>
            </div>
          )}

          {/* Action footer */}
          <div style={S.actionRow}>
            <button
              type="button"
              disabled={!ready || submitting}
              onClick={handleSubmit}
              style={{
                ...S.submitBtn,
                opacity: !ready || submitting ? 0.45 : 1,
                cursor: !ready || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('common.saving') : t('challenge.btnSend')}
            </button>
            <span style={S.submitHint}>
              {!ready ? t('challenge.needBothTeams') : t('challenge.readyToSend')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3,8,17,.72)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 999,
  },
  modal: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '94vh',
    overflowY: 'auto',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.60)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    font: '600 17px/1.25 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  subtitle: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: '600 13px/1 var(--font-sans)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  body: {
    padding: 18,
    display: 'grid',
    gap: 16,
  },
  teamsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: 12,
  },
  teamCard: {
    display: 'grid',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid',
  },
  teamHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLabelA: {
    font: '600 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--status-transit-fg)',
  },
  teamLabelB: {
    font: '600 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  teamRatingMono: {
    font: '600 13px/1.3 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  teamNames: {
    font: '600 14px/1.4 var(--font-sans)',
    color: 'var(--text-primary)',
    minHeight: 22,
  },
  faintText: {
    color: 'var(--text-disabled)',
    fontWeight: 400,
    fontSize: 13,
  },
  sectionLabel: {
    font: '600 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    maxHeight: 180,
    overflowY: 'auto',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    boxSizing: 'border-box',
  },
  playerChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 9px',
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    font: '500 12.5px/1.2 var(--font-sans)',
    transition: 'all 0.15s ease',
  },
  monoRating: {
    font: '400 11.5px/1 var(--font-mono)',
  },
  teamTag: {
    font: '700 10px/1 var(--font-sans)',
    padding: '2px 4px',
    borderRadius: 3,
    background: 'var(--teal-500)',
    color: 'var(--teal-900)',
  },
  analysisRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
    alignItems: 'start',
  },
  analysisCard: {
    display: 'grid',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  pctRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  pctNum: {
    font: '700 22px/1 var(--font-display)',
  },
  gapMono: {
    font: '400 12px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  barTrack: {
    display: 'flex',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'var(--surface-page)',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  boBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid',
    font: '600 12px/1 var(--font-mono)',
    cursor: 'pointer',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 8,
  },
  submitBtn: {
    height: 42,
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    borderRadius: 6,
    background: 'var(--action-primary-bg)',
    border: 'none',
    font: '700 14px/1 var(--font-sans)',
    color: 'var(--action-primary-fg)',
    boxShadow: 'var(--shadow-sm)',
  },
  submitHint: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  imbalanceDetailedCard: {
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--surface-warning-soft)',
    border: '1px solid var(--status-delayed-fg)',
    display: 'grid',
    gap: 6,
  },
  scenarioBox: {
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: 2,
  },
}

const confBadgeStyle = (level) => {
  const base = {
    font: '700 9px/1 var(--font-mono)',
    padding: '2px 4px',
    borderRadius: 3,
  }
  if (level === 'R1') return { ...base, background: 'var(--surface-danger-soft)', color: 'var(--status-incident-fg)' }
  if (level === 'R2') return { ...base, background: 'var(--surface-warning-soft)', color: 'var(--status-delayed-fg)' }
  if (level === 'R3') return { ...base, background: 'var(--surface-brand-soft)', color: 'var(--status-scheduled-fg)' }
  return { ...base, background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }
}

const confTagStyle = (level) => {
  const base = {
    font: '600 10px/1 var(--font-mono)',
    padding: '3px 6px',
    borderRadius: 4,
  }
  if (level === 'R1') return { ...base, background: 'var(--surface-danger-soft)', color: 'var(--status-incident-fg)' }
  if (level === 'R2') return { ...base, background: 'var(--surface-warning-soft)', color: 'var(--status-delayed-fg)' }
  if (level === 'R3') return { ...base, background: 'var(--surface-brand-soft)', color: 'var(--status-scheduled-fg)' }
  return { ...base, background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }
}
