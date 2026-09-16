import { useMemo } from 'react'
import { t } from '#i18n'
import { calcPlanHealth, detectPlanIssues } from '#lib/planner.js'
import { Icon } from '#ds'

export default function PlannerHealthCol({
  rounds = [],
  challenges = [],
  wishes = [],
  players = [],
  ratingsMap = {},
  onScheduleChallenge,
  onViewRound,
  onOpenAddWish,
}) {
  const pMap = useMemo(() => {
    const map = {}
    ;(players || []).forEach((p) => { map[p.key || p.id] = p })
    return map
  }, [players])

  const pName = (k) => pMap[k]?.name || k || '?'

  // Tính sức khoẻ và cảnh báo
  const health = useMemo(
    () => calcPlanHealth(rounds, challenges, wishes, players, ratingsMap),
    [rounds, challenges, wishes, players, ratingsMap]
  )

  const issues = useMemo(
    () => detectPlanIssues(rounds, players, challenges, wishes),
    [rounds, players, challenges, wishes]
  )

  // Map challengeId -> roundIndex đã xếp
  const chalRoundMap = useMemo(() => {
    const map = {}
    rounds.forEach((r) => {
      ;(r.courts || []).forEach((c) => {
        if (c.challengeId) map[c.challengeId] = r.roundIndex
      })
    })
    return map
  }, [rounds])

  const totalReqCount = (challenges?.length || 0) + (wishes?.length || 0)

  return (
    <div style={S.colWrap}>
      {/* ---------------- 1. KÈO & NGUYỆN VỌNG ĐƯỢC YÊU CẦU ---------------- */}
      <div style={S.sectionHeader}>
        <span style={S.sectionTitleGold}>{t('planner.colChallenges')}</span>
        <span style={S.badgeCount}>{totalReqCount}</span>
      </div>

      <div style={S.reqList}>
        {/* Danh sách Kèo đấu */}
        {challenges.map((c) => {
          const nameA = (c.teamA || []).map(pName).join(' + ') || t('planner.teamADefault')
          const nameB = (c.teamB || []).map(pName).join(' + ') || t('planner.teamBDefault')
          const title = `${nameA} vs ${nameB}`
          const rIdx = chalRoundMap[c.id]
          const isPlaced = rIdx !== undefined

          return (
            <div
              key={c.id}
              style={{
                ...S.reqCard,
                borderColor: isPlaced ? 'rgba(240, 183, 92, 0.45)' : '#22304A',
              }}
            >
              <div style={S.reqCardTitle} title={title}>
                {title}
              </div>
              <div style={S.reqCardMeta}>
                <span style={S.confirmText}>
                  {c.bestOf ? `${c.bestOf} set` : '1 set'}
                </span>
                {isPlaced ? (
                  <span style={S.statePlaced}>
                    {t('planner.stateScheduled', { round: `R${rIdx + 1}` })}
                  </span>
                ) : (
                  <span style={S.stateUnplaced}>
                    {t('planner.stateUnscheduled')}
                  </span>
                )}
              </div>
              <div style={S.cardBtnRow}>
                {isPlaced ? (
                  <button
                    type="button"
                    onClick={() => onViewRound && onViewRound(rIdx)}
                    style={S.btnSecondary}
                  >
                    {t('planner.actViewRound', { n: rIdx + 1 })}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onScheduleChallenge && onScheduleChallenge(c.id)}
                    style={S.btnPrimary}
                  >
                    {t('planner.actAddToPlan')}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Danh sách Nguyện vọng thành viên */}
        {wishes.map((w) => {
          const mName = pName(w.memberId)
          const tName = pName(w.targetId)
          const text = w.text || (w.type === 'partner'
            ? t('planner.wishTextPartner', { mName, tName })
            : t('planner.wishTextOpponent', { mName, tName }))

          return (
            <div key={w.id} style={S.reqCard}>
              <div style={S.reqCardTitle}>{text}</div>
              <div style={S.reqCardMeta}>
                <span style={S.stateUnplaced}>{t('planner.stateUnscheduled')}</span>
              </div>
            </div>
          )
        })}

        {/* Nút thêm nguyện vọng */}
        {onOpenAddWish && (
          <button
            type="button"
            onClick={onOpenAddWish}
            style={S.btnAddWish}
          >
            <Icon name="plus" size={13} color="#5FDBD3" />
            <span>{t('planner.addWish')}</span>
          </button>
        )}
      </div>

      {/* ---------------- 2. SỨC KHOẺ KẾ HOẠCH ---------------- */}
      <div style={S.healthSection}>
        <div style={S.sectionTitleMuted}>{t('planner.healthTitle')}</div>
        <div style={S.healthGrid}>
          {/* Kèo đã thoả */}
          <div style={S.healthRow}>
            <span style={S.healthLabel}>{t('planner.healthReqs')}</span>
            <span style={{ ...S.healthValue, color: '#F0B75C' }}>
              {`${health.fulfilledReqs}/${health.totalReqs}`}
            </span>
          </div>

          {/* Số trận chênh nhau */}
          <div style={S.healthRow}>
            <span style={S.healthLabel}>{t('planner.healthLoadGap')}</span>
            <span
              style={{
                ...S.healthValue,
                color: health.loadGap >= 3 ? '#F08A7C' : '#5FDBD3',
              }}
            >
              {`${health.minLoad} → ${health.maxLoad}`}
            </span>
          </div>

          {/* Cân bằng trung bình */}
          <div style={S.healthRow}>
            <span style={S.healthLabel}>{t('planner.healthAvgBal')}</span>
            <span style={{ ...S.healthValue, color: '#5FDBD3' }}>
              {health.avgBalance}
            </span>
          </div>

          {/* Vòng chưa đủ người */}
          <div style={S.healthRow}>
            <span style={S.healthLabel}>{t('planner.healthIncomplete')}</span>
            <span
              style={{
                ...S.healthValue,
                color: health.incompleteCourts > 0 ? '#F08A7C' : '#5FDBD3',
              }}
            >
              {health.incompleteCourts}
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- 3. CẦN XỬ LÝ ---------------- */}
      <div style={S.issuesSection}>
        <div style={S.sectionTitleMuted}>{t('planner.issuesTitle')}</div>
        <div style={S.issuesList}>
          {issues.length === 0 ? (
            <div style={S.noIssuesText}>
              {t('planner.noIssues')}
            </div>
          ) : (
            issues.map((iss) => {
              const dotBg = iss.severity === 'danger'
                ? '#D63B2B'
                : iss.severity === 'warning'
                  ? '#F0B75C'
                  : '#5FDBD3'

              let message = ''
              if (iss.type === 'missing_players') {
                message = t('planner.issueMissing', {
                  round: iss.roundNum,
                  court: iss.courtNum,
                  placed: iss.totalPlaced,
                  missing: iss.missing,
                  free: iss.freeCount,
                })
              } else if (iss.type === 'load_skew') {
                message = t('planner.issueLoadSkew', {
                  low: iss.lowNames,
                  min: iss.min,
                  top: iss.topNames,
                  max: iss.max,
                })
              } else if (iss.type === 'consecutive_rounds') {
                message = t('planner.issueConsecutive', {
                  name: iss.name,
                  n: iss.count,
                })
              } else if (iss.type === 'unplaced_wish') {
                message = t('planner.issueUnplacedWish', {
                  text: iss.wishText,
                })
              }

              return (
                <div key={iss.id} style={S.issueRow}>
                  <span style={{ ...S.issueDot, background: dotBg }} />
                  <span style={S.issueText}>{message}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  colWrap: {
    width: 284,
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    background: '#0E1626',
    borderLeft: '1px solid #22304A',
    overflowY: 'auto',
  },
  sectionHeader: {
    padding: '11px 13px 9px',
    borderBottom: '1px solid #22304A',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitleGold: {
    flex: 1,
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    color: '#F0B75C',
    letterSpacing: '.09em',
    textTransform: 'uppercase',
  },
  sectionTitleMuted: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    letterSpacing: '.09em',
    textTransform: 'uppercase',
  },
  badgeCount: {
    font: '600 10.5px/1 "IBM Plex Mono", monospace',
    color: '#04302C',
    background: '#F0B75C',
    padding: '3px 6px',
    borderRadius: 999,
  },
  reqList: {
    padding: '9px',
    display: 'grid',
    gap: 8,
    borderBottom: '1px solid #22304A',
  },
  reqCard: {
    display: 'grid',
    gap: 6,
    padding: '10px 11px',
    borderRadius: 8,
    background: '#141D2E',
    border: '1px solid #22304A',
    transition: 'border-color 120ms ease',
  },
  reqCardTitle: {
    font: '600 12.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  reqCardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  confirmText: {
    font: '400 11px/1 "IBM Plex Mono", monospace',
    color: '#8494AA',
  },
  statePlaced: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#04302C',
    background: '#F0B75C',
    padding: '3px 6px',
    borderRadius: 4,
  },
  stateUnplaced: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    border: '1px solid #2E3E5C',
    padding: '2px 6px',
    borderRadius: 4,
  },
  cardBtnRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 2,
  },
  btnPrimary: {
    height: 27,
    padding: '0 10px',
    borderRadius: 5,
    background: '#0D5E3A',
    border: '1px solid #00875A',
    color: '#fff',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
  },
  btnSecondary: {
    height: 27,
    padding: '0 10px',
    borderRadius: 5,
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    color: '#E9EFF7',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
  },
  btnAddWish: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 30,
    borderRadius: 6,
    background: 'none',
    border: '1px dashed #2E3E5C',
    color: '#5FDBD3',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
  },
  healthSection: {
    padding: '11px 13px',
    display: 'grid',
    gap: 8,
    borderBottom: '1px solid #22304A',
  },
  healthGrid: {
    display: 'grid',
    gap: 7,
  },
  healthRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  healthLabel: {
    flex: 1,
    minWidth: 0,
    font: '400 12.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
  },
  healthValue: {
    font: '600 13px/1 "IBM Plex Mono", monospace',
  },
  issuesSection: {
    padding: '11px 13px',
    display: 'grid',
    gap: 7,
  },
  issuesList: {
    display: 'grid',
    gap: 8,
  },
  issueRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  issueDot: {
    width: 6,
    height: 6,
    flex: '0 0 auto',
    marginTop: 6,
    borderRadius: 999,
  },
  issueText: {
    flex: 1,
    minWidth: 0,
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
  },
  noIssuesText: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: '#54637B',
    fontStyle: 'italic',
  },
}
