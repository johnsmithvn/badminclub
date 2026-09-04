import { useState, useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { expectedScore, calcEloDelta, getPlayerRating } from '#lib/rating.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function CreateChallengeModal({ session, onClose, onCreated, initialTeamA = [], initialTeamB = [] }) {
  const { db, a } = useApp()
  const [teamA, setTeamA] = useState(initialTeamA)
  const [teamB, setTeamB] = useState(initialTeamB)
  const [bestOf, setBestOf] = useState(cfg.challenge?.defaultBestOf || 3)
  const [ratingEnabled, setRatingEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Danh sách thành viên: nếu trong buổi, chỉ lấy những người đã ĐIỂM DANH CÓ MẶT (att[m.id] === true)
  // Khách (guests) KHÔNG được tham gia kèo theo đặc tả handoff.
  const pickableMembers = useMemo(() => {
    if (session) {
      const att = db.attendance[session.id] || {}
      return db.members.filter((m) => m.active !== false && att[m.id] === true)
    }
    return db.members.filter((m) => m.active !== false)
  }, [db.attendance, db.members, session])

  // Lấy rating của từng người (an toàn với cả Map lẫn Array)
  const getRating = (mid) => getPlayerRating(db.playerRatings, mid).rating

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
    const sum = teamA.reduce((acc, id) => acc + getPlayerRating(db.playerRatings, id).rating, 0)
    return Math.round(sum / teamA.length)
  }, [teamA, db.playerRatings])

  const avgRatingB = useMemo(() => {
    if (!teamB.length) return 0
    const sum = teamB.reduce((acc, id) => acc + getPlayerRating(db.playerRatings, id).rating, 0)
    return Math.round(sum / teamB.length)
  }, [teamB, db.playerRatings])

  const gap = Math.abs(avgRatingA - avgRatingB)
  const isImbalanced = gap > (cfg.rating?.thresholds?.imbalanced || 250)

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
        sessionId: session ? session.id : null,
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

  const memberNameOf = (id) => (db.members.find((m) => m.id === id) || {}).name || id

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Modal Header */}
        <div style={S.header}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={S.title}>
              {session ? t('challenge.createTitleSession', { date: session.date.slice(5) }) : t('challenge.createTitle')}
            </div>
            <div style={S.subtitle}>{t('challenge.createSub')}</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}>{t('common.close')}</button>
        </div>

        <div style={S.body}>
          {/* 2 Đội preview */}
          <div style={S.teamsRow}>
            {/* Đội A */}
            <div style={{ ...S.teamCard, borderColor: '#00786F' }}>
              <div style={S.teamHead}>
                <span style={S.teamLabelA}>{t('challenge.teamA')}</span>
                <span style={S.teamRatingMono}>{teamA.length ? avgRatingA : '—'}</span>
              </div>
              <div style={S.teamNames}>
                {teamA.length ? teamA.map(memberNameOf).join(' · ') : <span style={S.faintText}>{t('challenge.teamEmptyHint')}</span>}
              </div>
            </div>

            {/* Đội B */}
            <div style={{ ...S.teamCard, borderColor: '#2E3E5C' }}>
              <div style={S.teamHead}>
                <span style={S.teamLabelB}>{t('challenge.teamB')}</span>
                <span style={S.teamRatingMono}>{teamB.length ? avgRatingB : '—'}</span>
              </div>
              <div style={S.teamNames}>
                {teamB.length ? teamB.map(memberNameOf).join(' · ') : <span style={S.faintText}>{t('challenge.teamEmptyHint')}</span>}
              </div>
            </div>
          </div>

          {/* Danh sách thành viên chọn */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={S.sectionLabel}>
              {t('challenge.pickableLabel', { n: pickableMembers.length })}
            </div>
            <div style={S.chipWrap}>
              {pickableMembers.map((m) => {
                const inA = teamA.includes(m.id)
                const inB = teamB.includes(m.id)
                const r = getRating(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => cycleMember(m.id)}
                    style={{
                      ...S.playerChip,
                      background: inA ? '#1D50A0' : inB ? '#1F3452' : '#141D2E',
                      borderColor: inA ? '#3C74C4' : inB ? '#3A5A8C' : '#22304A',
                      color: inA || inB ? '#FFFFFF' : '#E9EFF7',
                    }}
                  >
                    <span>{m.name}</span>
                    <span style={{ ...S.monoRating, color: inA || inB ? '#C0D8F8' : '#8494AA' }}>{r}</span>
                    {inA && <span style={S.teamTag}>A</span>}
                    {inB && <span style={S.teamTag}>B</span>}
                  </button>
                )
              })}
              {pickableMembers.length === 0 && (
                <div style={{ color: '#8494AA', fontSize: 13 }}>{t('challenge.noPresentMembers')}</div>
              )}
            </div>
            <div style={S.guestNotice}>{t('challenge.guestNotice')}</div>
          </div>

          {/* Độ cân & Đánh giá cân kèo */}
          <div style={S.analysisRow}>
            <div style={S.analysisCard}>
              <div style={S.sectionLabel}>{t('challenge.balanceTitle')}</div>
              <div style={S.pctRow}>
                <span style={{ ...S.pctNum, color: '#5FDBD3' }}>{pctA}%</span>
                <span style={S.gapMono}>{t('rating.gap', { gap })}</span>
                <span style={{ ...S.pctNum, color: '#A8B7CB' }}>{pctB}%</span>
              </div>
              <div style={S.barTrack}>
                <div style={{ width: `${pctA}%`, background: '#00B2A9', height: '100%' }} />
                <div style={{ width: `${pctB}%`, background: '#2E3E5C', height: '100%' }} />
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: isImbalanced ? '#F0B75C' : gap <= 120 ? '#5FD9A2' : '#5FDBD3',
                marginTop: 2,
              }}>
                {isImbalanced ? t('challenge.imbalancedWarn') : gap <= 120 ? t('challenge.veryBalanced') : t('challenge.quiteBalanced')}
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
                  background: ratingEnabled ? '#00B2A9' : 'transparent',
                  borderColor: ratingEnabled ? '#00B2A9' : '#2E3E5C',
                }}>
                  {ratingEnabled && <span style={{ color: '#04302C', fontWeight: 700, fontSize: 13 }}>✓</span>}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ font: '600 13px/1.4 "IBM Plex Sans", sans-serif', color: '#E9EFF7' }}>
                    {t('challenge.rateOptionTitle')}
                  </div>
                  <div style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
                    {t('challenge.rateOptionHint')}
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#8494AA' }}>{t('challenge.format')}:</span>
                {[1, 3].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBestOf(b)}
                    style={{
                      ...S.boBtn,
                      background: bestOf === b ? '#1D50A0' : '#141D2E',
                      borderColor: bestOf === b ? '#3C74C4' : '#2E3E5C',
                      color: bestOf === b ? '#FFFFFF' : '#A8B7CB',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F0B75C', fontWeight: 600, fontSize: 13 }}>
                <span>⚠️</span> {t('challenge.imbalancedWarn', { gap })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 4 }}>
                <div style={S.scenarioBox}>
                  <div style={{ color: '#8494AA', fontSize: 11, fontWeight: 600 }}>{t('challenge.ifWinA')}</div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5, color: '#5FD9A2', fontWeight: 600 }}>
                    +{deltaA_win} / -{deltaA_win}
                  </div>
                </div>
                <div style={S.scenarioBox}>
                  <div style={{ color: '#8494AA', fontSize: 11, fontWeight: 600 }}>{t('challenge.ifWinB')}</div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5, color: '#F0B75C', fontWeight: 600 }}>
                    +{deltaB_win} / -{deltaB_win}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#8494AA', fontStyle: 'italic', marginTop: 2 }}>
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
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.60)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid #22304A',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    font: '600 17px/1.25 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  subtitle: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  closeBtn: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 6,
    background: '#141D2E',
    border: '1px solid #2E3E5C',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
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
    background: '#101927',
    border: '1px solid',
  },
  teamHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLabelA: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#5FDBD3',
  },
  teamLabelB: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#8494AA',
  },
  teamRatingMono: {
    font: '600 13px/1.3 "IBM Plex Mono", monospace',
    color: '#E9EFF7',
  },
  teamNames: {
    font: '600 14px/1.4 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    minHeight: 22,
  },
  faintText: {
    color: '#5B6B81',
    fontWeight: 400,
    fontSize: 13,
  },
  sectionLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#8494AA',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
    transition: 'all 0.15s ease',
  },
  monoRating: {
    font: '400 12px/1 "IBM Plex Mono", monospace',
  },
  teamTag: {
    font: '700 10px/1 "IBM Plex Sans", sans-serif',
    padding: '2px 4px',
    borderRadius: 3,
    background: '#00B2A9',
    color: '#04302C',
  },
  guestNotice: {
    font: '400 12.5px/1.4 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
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
    background: '#101927',
    border: '1px solid #22304A',
  },
  pctRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  pctNum: {
    font: '700 22px/1 Barlow, sans-serif',
  },
  gapMono: {
    font: '400 12px/1.3 "IBM Plex Mono", monospace',
    color: '#8494AA',
  },
  barTrack: {
    display: 'flex',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    background: '#0B1220',
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
    font: '600 12px/1 "IBM Plex Mono", monospace',
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
    background: '#1D50A0',
    border: 'none',
    font: '700 14px/1 "IBM Plex Sans", sans-serif',
    color: '#FFFFFF',
    boxShadow: '0 2px 10px rgba(29,80,160,.4)',
  },
  submitHint: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  imbalanceDetailedCard: {
    padding: '12px 14px',
    borderRadius: 8,
    background: 'rgba(224,138,0,.10)',
    border: '1px solid #F0B75C',
    display: 'grid',
    gap: 6,
  },
  scenarioBox: {
    padding: '8px 10px',
    borderRadius: 6,
    background: '#101927',
    border: '1px solid #22304A',
    display: 'grid',
    gap: 2,
  },
}
