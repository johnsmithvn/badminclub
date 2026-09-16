import { useState } from 'react'
import { t } from '#i18n'
import { Button, Dialog, Icon } from '#ds'
import { validateChallengeAttendance, validateWishAttendance } from '#lib/planner'

export default function PlannerAutoModal({
  isOpen = false,
  onClose,
  onSubmit,
  courtsCount = 2,
  roundsCount = 8,
  playersCount = 16,
  challenges = [],
  wishes = [],
  attendance = {},
  players = [],
  db = null,
}) {
  const [mode, setMode] = useState('fill') // 'fill' | 'replace'
  const [strategy, setStrategy] = useState('elo') // 'elo' | 'social' | 'gender'
  const [splitHalf, setSplitHalf] = useState(false)
  const [selectedChallengeIds, setSelectedChallengeIds] = useState([])
  const [selectedWishIds, setSelectedWishIds] = useState([])

  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      const validChalIds = challenges
        .filter(c => validateChallengeAttendance(c, attendance, players, db).valid)
        .map(c => c.id)
      const validWishIds = wishes
        .filter(w => validateWishAttendance(w, attendance, players, db).valid)
        .map(w => w.id)

      setSelectedChallengeIds(validChalIds)
      setSelectedWishIds(validWishIds)
    }
  }

  if (!isOpen) return null

  const canSplit = courtsCount >= 2 && playersCount >= 8 && roundsCount >= 4

  const getPlayerName = (mid) => {
    const p = players.find(x => x.id === mid) || db?.members?.find(m => m.id === mid)
    return p?.name || mid
  }

  const toggleChallenge = (id) => {
    setSelectedChallengeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleWish = (id) => {
    setSelectedWishIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleStart = () => {
    onSubmit({
      mode,
      strategy,
      splitHalf: canSplit ? splitHalf : false,
      selectedChallengeIds,
      selectedWishIds,
    })
    onClose()
  }

  return (
    <Dialog
      title={t('planner.autoModalTitle')}
      onClose={onClose}
      footer={
        <div style={S.footerWrap}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleStart}>
            <Icon name="sparkles" size={14} color="#0E1E2E" />
            <span>{t('planner.btnStartAutoPlan')}</span>
          </Button>
        </div>
      }
    >
      <div style={S.modalBody}>
        {/* Section 1: Scope */}
        <div>
          <div style={S.sectionHeading}>{t('planner.autoModalScope')}</div>
          <div style={S.optionGrid}>
            <button
              type="button"
              onClick={() => setMode('fill')}
              style={{
                ...S.optionCard,
                ...(mode === 'fill' ? S.optionCardActive : {}),
              }}
            >
              <div style={S.cardHeader}>
                <div style={{
                  ...S.radioDot,
                  ...(mode === 'fill' ? S.radioDotActive : {}),
                }}>
                  {mode === 'fill' && <div style={S.radioInner} />}
                </div>
                <span style={S.cardTitle}>{t('planner.modeFill')}</span>
              </div>
              <div style={S.cardDesc}>{t('planner.modeFillDesc')}</div>
            </button>

            <button
              type="button"
              onClick={() => setMode('replace')}
              style={{
                ...S.optionCard,
                ...(mode === 'replace' ? S.optionCardActive : {}),
              }}
            >
              <div style={S.cardHeader}>
                <div style={{
                  ...S.radioDot,
                  ...(mode === 'replace' ? S.radioDotActive : {}),
                }}>
                  {mode === 'replace' && <div style={S.radioInner} />}
                </div>
                <span style={S.cardTitle}>{t('planner.modeReplace')}</span>
              </div>
              <div style={S.cardDesc}>{t('planner.modeReplaceDesc')}</div>
            </button>
          </div>
        </div>

        {/* Section 2: Strategy */}
        <div>
          <div style={S.sectionHeading}>{t('planner.autoModalStrategy')}</div>
          <div style={S.strategyStack}>
            {/* Strategy: Elo */}
            <button
              type="button"
              onClick={() => setStrategy('elo')}
              style={{
                ...S.strategyCard,
                ...(strategy === 'elo' ? S.optionCardActive : {}),
              }}
            >
              <div style={S.strategyIconBox}>
                <Icon name="scale" size={16} color={strategy === 'elo' ? '#5FDBD3' : '#8494AA'} />
              </div>
              <div style={S.strategyContent}>
                <div style={S.strategyTitleRow}>
                  <span style={S.cardTitle}>{t('planner.strategyElo')}</span>
                  {strategy === 'elo' && (
                    <span style={S.activeBadge}><Icon name="check" size={12} color="#5FDBD3" /></span>
                  )}
                </div>
                <div style={S.cardDesc}>{t('planner.strategyEloDesc')}</div>
              </div>
            </button>

            {/* Strategy: Social */}
            <button
              type="button"
              onClick={() => setStrategy('social')}
              style={{
                ...S.strategyCard,
                ...(strategy === 'social' ? S.optionCardActive : {}),
              }}
            >
              <div style={S.strategyIconBox}>
                <Icon name="users" size={16} color={strategy === 'social' ? '#5FDBD3' : '#8494AA'} />
              </div>
              <div style={S.strategyContent}>
                <div style={S.strategyTitleRow}>
                  <span style={S.cardTitle}>{t('planner.strategySocial')}</span>
                  {strategy === 'social' && (
                    <span style={S.activeBadge}><Icon name="check" size={12} color="#5FDBD3" /></span>
                  )}
                </div>
                <div style={S.cardDesc}>{t('planner.strategySocialDesc')}</div>
              </div>
            </button>

            {/* Strategy: Gender */}
            <button
              type="button"
              onClick={() => setStrategy('gender')}
              style={{
                ...S.strategyCard,
                ...(strategy === 'gender' ? S.optionCardActive : {}),
              }}
            >
              <div style={S.strategyIconBox}>
                <Icon name="shield" size={16} color={strategy === 'gender' ? '#5FDBD3' : '#8494AA'} />
              </div>
              <div style={S.strategyContent}>
                <div style={S.strategyTitleRow}>
                  <span style={S.cardTitle}>{t('planner.strategyGender')}</span>
                  {strategy === 'gender' && (
                    <span style={S.activeBadge}><Icon name="check" size={12} color="#5FDBD3" /></span>
                  )}
                </div>
                <div style={S.cardDesc}>{t('planner.strategyGenderDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Section 3: Advanced Split Half (if applicable) */}
        {canSplit && (
          <div>
            <div style={S.sectionHeading}>{t('planner.autoModalAdvanced')}</div>
            <label style={S.checkboxRow}>
              <input
                type="checkbox"
                checked={splitHalf}
                onChange={(e) => setSplitHalf(e.target.checked)}
                style={S.checkboxInput}
              />
              <div style={S.checkboxText}>
                <div style={S.checkboxTitle}>{t('planner.splitHalfLabel')}</div>
                <div style={S.checkboxDesc}>{t('planner.splitHalfDesc')}</div>
              </div>
            </label>
          </div>
        )}

        {/* Section 4: Priority Challenges & Wishes */}
        <div>
          <div style={S.sectionHeading}>{t('planner.autoModalReqsTitle')}</div>
          {challenges.length === 0 && wishes.length === 0 ? (
            <div style={S.emptyReqsText}>{t('planner.autoModalNoReqs')}</div>
          ) : (
            <div style={S.reqsStack}>
              {challenges.map(c => {
                const check = validateChallengeAttendance(c, attendance, players, db)
                const isSelected = selectedChallengeIds.includes(c.id)
                const teamA = (c.teamA || []).map(getPlayerName).join(' + ')
                const teamB = (c.teamB || []).map(getPlayerName).join(' + ')
                return (
                  <label
                    key={c.id}
                    style={{
                      ...S.reqRow,
                      ...(!check.valid ? S.reqRowDisabled : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!check.valid}
                      checked={isSelected && check.valid}
                      onChange={() => toggleChallenge(c.id)}
                      style={S.checkboxInput}
                    />
                    <div style={S.reqContent}>
                      <div style={S.reqHeader}>
                        <span style={S.tagChal}>{t('planner.tagChallenge')}</span>
                        <span style={S.reqTitle}>
                          {teamA} <span style={{ color: 'var(--text-muted)' }}>{t('planner.vs')}</span> {teamB}
                        </span>
                      </div>
                      {!check.valid && (
                        <div style={S.absentBadge}>
                          ⚠️ {t('planner.absentPlayerBadge', { names: check.absentNames.join(', ') })}
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}

              {wishes.map(w => {
                const check = validateWishAttendance(w, attendance, players, db)
                const isSelected = selectedWishIds.includes(w.id)
                const p1 = getPlayerName(w.memberId)
                const p2 = getPlayerName(w.targetId)
                return (
                  <label
                    key={w.id}
                    style={{
                      ...S.reqRow,
                      ...(!check.valid ? S.reqRowDisabled : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!check.valid}
                      checked={isSelected && check.valid}
                      onChange={() => toggleWish(w.id)}
                      style={S.checkboxInput}
                    />
                    <div style={S.reqContent}>
                      <div style={S.reqHeader}>
                        <span style={S.tagWish}>{t('planner.tagWish')}</span>
                        <span style={S.reqTitle}>
                          {t('planner.wishTextPartner', { mName: p1, tName: p2 })}
                        </span>
                      </div>
                      {!check.valid && (
                        <div style={S.absentBadge}>
                          ⚠️ {t('planner.absentPlayerBadge', { names: check.absentNames.join(', ') })}
                        </div>
                      )}
                      {w.note && (
                        <div style={S.reqNote}>"{w.note}"</div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  footerWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: '4px 0',
  },
  sectionHeading: {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  optionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  optionCardActive: {
    borderColor: '#5FDBD3',
    background: 'rgba(95, 219, 211, 0.08)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '1.5px solid var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDotActive: {
    borderColor: '#5FDBD3',
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#5FDBD3',
  },
  cardTitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  cardDesc: {
    fontFamily: 'var(--font-sans)',
    fontSize: 11.5,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  strategyStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  strategyCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  strategyIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  strategyContent: {
    flex: 1,
    minWidth: 0,
  },
  strategyTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  activeBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'rgba(95, 219, 211, 0.15)',
    color: '#5FDBD3',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  checkboxInput: {
    marginTop: 3,
    accentColor: '#5FDBD3',
    cursor: 'pointer',
  },
  checkboxText: {
    flex: 1,
  },
  checkboxTitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  checkboxDesc: {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  emptyReqsText: {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px 12px',
    background: 'var(--surface-inset)',
    borderRadius: 8,
  },
  reqsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 200,
    overflowY: 'auto',
  },
  reqRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  reqRowDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
    background: 'rgba(239, 68, 68, 0.04)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  reqContent: {
    flex: 1,
    minWidth: 0,
  },
  reqHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  reqTitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  tagChal: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'rgba(240, 183, 92, 0.15)',
    color: '#F0B75C',
    border: '1px solid rgba(240, 183, 92, 0.3)',
    flexShrink: 0,
  },
  tagWish: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'rgba(139, 92, 246, 0.15)',
    color: '#A78BFA',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    flexShrink: 0,
  },
  absentBadge: {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    color: '#EF4444',
    fontWeight: 600,
    marginTop: 3,
  },
  reqNote: {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    marginTop: 2,
  },
}
