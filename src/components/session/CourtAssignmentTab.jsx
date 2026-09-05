import { useState, useRef, useMemo } from 'react'
import { Button, Card, Icon, Input, Select, Switch } from '#ds'
import { LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { elapsedMin, useClock } from '#hooks/useClock.js'
import { courtOf, playerName } from '#lib/money.js'
import {
  ASSIGN_MODES, activeCourtIdxs, courtSlotIds,
  sessionPlayers, slotIds,
} from '#lib/assign.js'
import {
  expectedScore, evalBalance, getPlayerRating,
  computeClubCalibration, effectiveRating, confidenceProgress,
} from '#lib/rating.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import ScoreModal from '#components/challenge/ScoreModal.jsx'

export default function CourtAssignmentTab({ s }) {
  const { db, a } = useApp()
  const [scoringCourt, setScoringCourt] = useState(null)
  const [selectedPoolKey, setSelectedPoolKey] = useState(null)
  const dragKey = useRef(null)

  // Clock hook để re-render định kỳ khi có sân đang bấm giờ
  const anyPlaying = Object.values((db.playing || {})[s.id] || {}).some(Boolean)
  useClock(anyPlaying)

  const players = sessionPlayers(db, s)
  const pmap = useMemo(() => {
    const map = {}
    players.forEach((p) => { map[p.key] = p })
    return map
  }, [players])

  const lineup = (db.lineups || {})[s.id] || {}
  const placed = Object.values(lineup)
  const groupMode = !!(db.groupMode || {})[s.id]
  const courtGroups = useMemo(() => (db.courtGroups || {})[s.id] || {}, [db.courtGroups, s.id])
  const idxs = activeCourtIdxs(s)

  const membersMap = useMemo(() => {
    const map = {}
    ;(db.members || []).forEach((m) => { map[m.id] = m })
    return map
  }, [db.members])

  const [applyCalibration, setApplyCalibration] = useState(true)

  const calList = useMemo(() => {
    return computeClubCalibration(db.matches || [], membersMap)
  }, [db.matches, membersMap])

  const cal100_300 = useMemo(() => {
    return calList.find((c) => c.bucket === '100-300') || calList[0]
  }, [calList])

  // Lấy rating thô và hiệu dụng của từng người
  const getPlayerInfo = (key) => {
    const pr = getPlayerRating(db.playerRatings, key)
    const mem = membersMap[key] || pmap[key] || {}
    const conf = confidenceProgress(pr.gamesCount || 0)
    const isFemale = mem.gender === 'nu' || mem.gender === 'Nữ' // i18n-ok: data matching
    const adj = (applyCalibration && isFemale && cal100_300?.learnedAdjustment) ? cal100_300.learnedAdjustment : 0
    return {
      rawRating: pr.rating,
      effRating: pr.rating + adj,
      hasAdjustment: adj !== 0,
      adj,
      confLevel: conf.level,
      gamesCount: pr.gamesCount || 0,
      isFemale,
      gender: mem.gender,
    }
  }

  // Lấy rating của từng người
  const getRating = (playerId) => getPlayerInfo(playerId).rawRating

  // Danh sách chờ (Pool): những người ĐÃ ĐIỂM DANH CÓ MẶT hoặc EXTRA mà chưa lên sân
  const pool = useMemo(() => {
    const att = db.attendance[s.id] || {}
    // Người có mặt hoặc extra
    const presentPlayers = players.filter((p) => {
      // p.key có thể là member id hoặc guest:id
      if (p.guest) return true // khách trong buổi cũng được tính nếu đã thêm
      return att[p.key] === true || att[p.key] === 'extra'
    })
    return groupMode
      ? presentPlayers.filter((p) => courtGroups[p.key] === undefined)
      : presentPlayers.filter((p) => placed.indexOf(p.key) < 0)
  }, [players, db.attendance, s.id, groupMode, courtGroups, placed])

  // Kèo đã nhận, đang chờ sân
  const acceptedChallenges = useMemo(() => {
    return (db.challenges || []).filter((c) => c.sessionId === s.id && c.status === 'accepted')
  }, [db.challenges, s.id])

  // Thao tác Drag & Drop
  const drop = (e, fn) => {
    e.preventDefault()
    let k = dragKey.current
    try { k = e.dataTransfer.getData('text/plain') || k } catch { /* Safari */ }
    if (k) fn(k)
  }

  const dragProps = (key) => ({
    draggable: true,
    onDragStart: (e) => {
      dragKey.current = key
      try {
        e.dataTransfer.setData('text/plain', key)
        e.dataTransfer.effectAllowed = 'move'
      } catch { /* ignore */ }
    },
  })

  // Đưa kèo lên sân trống
  const handleDeployChallenge = (challenge) => {
    // Tìm sân đầu tiên hoàn toàn trống
    const emptyCourtIdx = idxs.find((ci) => {
      const slots = courtSlotIds(ci)
      return slots.every((sl) => !lineup[sl])
    })

    if (emptyCourtIdx === undefined) {
      a.toast(t('challenge.noEmptyCourt'))
      return
    }

    a.deployChallenge(challenge.id, emptyCourtIdx)
  }

  // Slot click handler
  const handleSlotClick = (slotId, currentKey) => {
    if (selectedPoolKey) {
      // Đặt người được chọn vào ô
      a.place(s.id, slotId, selectedPoolKey)
      setSelectedPoolKey(null)
    } else if (currentKey) {
      // Bỏ người ra khỏi ô
      if (groupMode) {
        a.clearSlot(s.id, slotId)
      } else {
        a.removeFromCourt(s.id, currentKey)
      }
    }
  }

  // Trả sân: gỡ tất cả 4 slot
  const handleClearCourt = (ci) => {
    const slots = courtSlotIds(ci)
    slots.forEach((sl) => {
      const k = lineup[sl]
      if (k) {
        if (groupMode) {
          a.clearSlot(s.id, sl)
        } else {
          a.removeFromCourt(s.id, k)
        }
      }
    })
  }

  // Gợi ý cặp cân nhất lên sân trống
  const handleSuggestPair = (ci) => {
    if (pool.length < 4) return
    const slots = courtSlotIds(ci)
    const candidates = pool.slice(0, 4)
    candidates.forEach((p, idx) => {
      a.place(s.id, slots[idx], p.key)
    })
  }

  const memberNameOf = (id) => playerName(db, id)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ---------------- 0. Banner Hiệu chỉnh Chéo giới (Handoff GD1) ---------------- */}
      {cal100_300 && cal100_300.sampleSize >= 5 && cal100_300.learnedAdjustment !== 0 && (
        <div style={S.calBanner}>
          <div style={S.calIcon}>≈</div>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
            <div style={S.calTitle}>{t('courtAssign.crossGenderBannerTitle')}</div>
            <div style={S.calDesc}>
              {t('courtAssign.crossGenderBannerDesc', {
                sampleSize: cal100_300.sampleSize,
                pct: Math.round(cal100_300.observedWinRate * 100),
                adj: cal100_300.learnedAdjustment > 0 ? `+${cal100_300.learnedAdjustment}` : cal100_300.learnedAdjustment,
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApplyCalibration(!applyCalibration)}
            style={S.calToggleBtn}
          >
            {t(applyCalibration ? 'courtAssign.disableCalibration' : 'courtAssign.enableCalibration')}
          </button>
        </div>
      )}

      {/* ---------------- 1. Pool người chờ ---------------- */}
      <div style={S.poolCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={S.cardTitle}>
              {groupMode ? t('assign.poolTitleGrouped') : t('courtAssign.waitingPool', { n: pool.length })}
            </div>
            <div style={S.cardSub}>
              {groupMode
                ? t('assign.poolSubGrouped', { waiting: pool.length, total: players.length })
                : t('courtAssign.poolRatingSub')}
            </div>
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 6,
            background: selectedPoolKey ? 'var(--navy-500, #1D50A0)' : 'var(--surface-inset, #101927)',
            border: `1px solid ${selectedPoolKey ? 'var(--navy-400, #3C74C4)' : 'var(--border-subtle, #22304A)'}`,
            color: selectedPoolKey ? 'var(--gray-0, #FFFFFF)' : 'var(--text-muted, #8494AA)',
          }}>
            {selectedPoolKey
              ? t('courtAssign.selHintActive', { name: (pmap[selectedPoolKey] || {}).name })
              : t('courtAssign.selHintNone')}
          </span>
        </div>

        <div
          style={S.poolChips}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => drop(e, (k) => a.removeFromCourt(s.id, k))}
        >
          {pool.map((p) => {
            const isSelected = selectedPoolKey === p.key
            const info = getPlayerInfo(p.key)
            return (
              <button
                key={p.key}
                type="button"
                {...dragProps(p.key)}
                onClick={() => setSelectedPoolKey(isSelected ? null : p.key)}
                style={{
                  ...S.poolChip,
                  background: isSelected ? 'var(--navy-500, #1D50A0)' : 'var(--surface-card, #141D2E)',
                  borderColor: isSelected ? 'var(--navy-400, #3C74C4)' : 'var(--border-subtle, #22304A)',
                  color: isSelected ? 'var(--gray-0, #FFFFFF)' : 'var(--text-primary, #E9EFF7)',
                  boxShadow: isSelected ? '0 0 0 1px var(--navy-400, #3C74C4)' : 'none',
                }}
              >
                <span>{p.name}</span>
                <span style={info.isFemale ? S.genderBadgeNu : S.genderBadgeNam}>
                  {t(info.isFemale ? 'gender.nu' : 'gender.nam')}
                </span>
                {info.hasAdjustment ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={S.ratingStrike}>{info.rawRating}</span>
                    <span style={S.ratingEff}>{info.effRating}</span>
                  </span>
                ) : (
                  <span style={{ ...S.monoVal, color: isSelected ? 'var(--navy-200, #C0D8F8)' : 'var(--text-muted, #8494AA)' }}>
                    {info.rawRating}
                  </span>
                )}
                <span style={confBadgeStyle(info.confLevel)}>{info.confLevel}</span>
                <LevelChip level={p.level} levels={db.levels} />
              </button>
            )
          })}
          {pool.length === 0 && (
            <span style={{ color: 'var(--text-muted, #8494AA)', fontSize: 13, padding: '8px 0' }}>
              {groupMode
                ? t('courtAssign.poolAllGrouped')
                : t('courtAssign.poolEmpty')}
            </span>
          )}
        </div>
        {pool.length > 0 && (
          <div style={S.rawRatingDesc}>{t('courtAssign.rawRatingCrossDesc')}</div>
        )}
      </div>

      {/* ---------------- 2. Kèo đã nhận, đang chờ sân (conditional) ---------------- */}
      {acceptedChallenges.length > 0 && (
        <div style={S.acceptedCard}>
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ ...S.cardTitle, color: 'var(--status-transit-fg, #5FDBD3)' }}>
              {t('challenge.waitingCourtTitle')}
            </div>
            <div style={S.cardSub}>
              {t('challenge.waitingCourtDesc')}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {acceptedChallenges.map((c) => {
              const namesA = (c.teamA || []).map(memberNameOf).join(' · ')
              const namesB = (c.teamB || []).map(memberNameOf).join(' · ')
              return (
                <div key={c.id} style={S.acceptedRow}>
                  <span style={S.challengeCode}>{c.code}</span>
                  <span style={{ flex: 1, minWidth: 200, font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                    {namesA} <span style={{ color: 'var(--text-disabled, #5B6B81)', fontWeight: 400 }}>vs</span> {namesB}
                  </span>
                  <span style={S.challengeMeta}>BO{c.bestOf || 3} · {c.ratingEnabled ? t('challenge.rated') : t('challenge.casual')}</span>
                  <button
                    type="button"
                    onClick={() => handleDeployChallenge(c)}
                    style={S.deployBtn}
                  >
                    {t('challenge.deployToCourt')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------- 3. Thanh công cụ Chia sân (5 thuật toán tự động) ---------------- */}
      <Toolbar s={s} lineup={lineup} idxs={idxs} />

      {/* ---------------- 4. Grid các sân 2x2 ---------------- */}
      <div style={S.courtGrid}>
        {idxs.map((ci) => {
          const c = s.courts[ci]
          const venueName = courtOf(db, c.courtId).name
          const courtName = c.label
            ? `${c.label} · ${venueName}`
            : ((s.courts || []).length > 1 ? `${t('assign.courtTitle', { name: ci + 1 })} · ${venueName}` : venueName)
          const slots = courtSlotIds(ci)
          const startedAt = ((db.playing || {})[s.id] || {})[ci]
          const mins = ((db.courtMin || {})[s.id] || {})[ci]
          const minutes = mins === undefined ? cfg.match.defaultMinutes : mins
          const running = elapsedMin(startedAt)

          // Lấy 4 người trên sân
          const p0 = lineup[slots[0]] ? pmap[lineup[slots[0]]] : null
          const p1 = lineup[slots[1]] ? pmap[lineup[slots[1]]] : null
          const p2 = lineup[slots[2]] ? pmap[lineup[slots[2]]] : null
          const p3 = lineup[slots[3]] ? pmap[lineup[slots[3]]] : null
          const filledCount = [p0, p1, p2, p3].filter(Boolean).length
          const isFull = filledCount === 4
          const rosterHere = players.filter((p) => courtGroups[p.key] === ci)
          const benchPlayers = rosterHere.filter((p) => placed.indexOf(p.key) < 0)

          // Kiểm tra xem sân này có phải từ kèo không
          const attachedChallenge = (db.challenges || []).find((ch) => ch.sessionId === s.id && ch.status === 'oncourt' && ch.courtIndex === ci)

          // Tính độ cân khi đủ 4 người
          let balance = null
          if (isFull) {
            const inf0 = getPlayerInfo(p0.key)
            const inf1 = getPlayerInfo(p1.key)
            const inf2 = getPlayerInfo(p2.key)
            const inf3 = getPlayerInfo(p3.key)
            const teamAFemale = inf0.isFemale || inf1.isFemale
            const teamBFemale = inf2.isFemale || inf3.isFemale
            const isCrossMatch = (teamAFemale && !teamBFemale) || (!teamAFemale && teamBFemale)

            const rawAvgA = Math.round((inf0.rawRating + inf1.rawRating) / 2)
            const rawAvgB = Math.round((inf2.rawRating + inf3.rawRating) / 2)
            const rawGap = Math.abs(rawAvgA - rawAvgB)
            const rawEval = evalBalance(rawAvgA, rawAvgB)

            const effAvgA = applyCalibration && isCrossMatch ? Math.round((inf0.effRating + inf1.effRating) / 2) : rawAvgA
            const effAvgB = applyCalibration && isCrossMatch ? Math.round((inf2.effRating + inf3.effRating) / 2) : rawAvgB
            const gap = Math.abs(effAvgA - effAvgB)
            const pA = expectedScore(effAvgA, effAvgB)
            const pctA = Math.round(pA * 100)
            const evalRes = evalBalance(effAvgA, effAvgB)
            balance = {
              rawAvgA,
              rawAvgB,
              rawGap,
              rawLabel: t(rawEval.labelKey),
              effAvgA,
              effAvgB,
              isEff: effAvgA !== rawAvgA || effAvgB !== rawAvgB,
              gap,
              pctA,
              pctB: 100 - pctA,
              level: evalRes.level,
              label: t(evalRes.labelKey),
              color: evalRes.level === 'imbalanced' ? 'var(--status-delayed-fg, #F0B75C)' : evalRes.level === 'balanced' ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--status-transit-fg, #5FDBD3)',
            }
          }

          const SlotBox = ({ p, slotId }) => {
            const isHighlighted = Boolean(selectedPoolKey && !p)
            const inf = p ? getPlayerInfo(p.key) : null
            return (
              <button
                type="button"
                onClick={() => handleSlotClick(slotId, p?.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(e, (k) => a.place(s.id, slotId, k))}
                style={{
                  ...S.slotBox,
                  background: p ? 'var(--surface-inset, #101927)' : isHighlighted ? 'rgba(60,116,196,.12)' : 'var(--surface-page, #0B1220)',
                  borderColor: p ? 'var(--border-subtle, #22304A)' : isHighlighted ? 'var(--navy-400, #3C74C4)' : 'var(--navy-900, #1F2A3F)',
                  borderStyle: p ? 'solid' : 'dashed',
                  cursor: 'pointer',
                }}
              >
                {p ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>{p.name}</span>
                        <span style={inf.isFemale ? S.genderBadgeNu : S.genderBadgeNam}>
                          {t(inf.isFemale ? 'gender.nu' : 'gender.nam')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {inf.hasAdjustment ? (
                          <>
                            <span style={S.ratingStrike}>{inf.rawRating}</span>
                            <span style={S.ratingEff}>{inf.effRating}</span>
                          </>
                        ) : (
                          <span style={{ font: '400 11px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>{inf.rawRating}</span>
                        )}
                        <span style={confBadgeStyle(inf.confLevel)}>{inf.confLevel}</span>
                      </div>
                    </div>
                    <LevelChip level={p.level} levels={db.levels} />
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: isHighlighted ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-disabled, #5B6B81)', fontWeight: 500 }}>
                    + {isHighlighted
                        ? t('courtAssign.slotPlace', { name: (pmap[selectedPoolKey] || {}).name || '' })
                        : t('courtAssign.slotEmpty')}
                  </span>
                )}
              </button>
            )
          }

          return (
            <div key={ci} style={{
              ...S.courtCard,
              borderColor: attachedChallenge ? 'var(--teal-700, #00786F)' : 'var(--border-subtle, #22304A)',
            }}>
              {/* Header Sân */}
              <div style={S.courtHead}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: '600 16px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                      {courtName}
                    </span>
                    {c.extra && <span style={S.tagAmber}>{t('assign.extraTag')}</span>}
                  </div>
                  <div style={S.courtMeta}>
                    {startedAt ? t('courtAssign.playingMin', { min: running }) : `${c.from} → ${c.to}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {filledCount === 0 && pool.length >= 4 && (
                    <button
                      type="button"
                      onClick={() => handleSuggestPair(ci)}
                      style={S.suggestBtn}
                    >
                      {t('courtAssign.suggestBalancedPair')}
                    </button>
                  )}
                  {/* Pill trạng thái */}
                  <span style={{
                    ...S.statusPill,
                    background: attachedChallenge ? 'rgba(0,178,169,.14)' : startedAt ? 'rgba(18,168,103,.14)' : 'rgba(255,255,255,.05)',
                    borderColor: attachedChallenge ? 'var(--teal-700, #00786F)' : startedAt ? 'var(--green-600, #00875A)' : 'var(--border-subtle, #22304A)',
                    color: attachedChallenge ? 'var(--status-transit-fg, #5FDBD3)' : startedAt ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--text-muted, #8494AA)',
                  }}>
                    {attachedChallenge
                      ? `${t('courtAssign.statusFromChallenge')} ${attachedChallenge.code}`
                      : startedAt ? t('courtAssign.statusPlaying') : filledCount > 0 ? t('courtAssign.filledCount', { n: filledCount }) : t('courtAssign.statusEmpty')}
                  </span>
                </div>
              </div>

              {/* Timer Bar */}
              <div style={S.timerBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    size="sm"
                    variant={startedAt ? 'secondary' : 'primary'}
                    icon={startedAt ? 'pause' : 'play'}
                    onClick={() => a.startCourt(s.id, ci)}
                  >
                    {t(startedAt ? 'assign.pause' : 'assign.start')}
                  </Button>
                  <Input
                    size="sm"
                    mono
                    suffix={t('units.minute')}
                    value={String(minutes)}
                    onChange={(e) => a.setCourtMin(s.id, ci, e.target.value)}
                    style={{ width: 88 }}
                  />
                </div>
              </div>

              {/* Body Sân: 2x2 Slots với VS */}
              <div style={S.courtBody}>
                {groupMode && (
                  <div
                    style={S.rosterBox}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, (k) => a.assignToCourt(s.id, k, ci))}
                    onClick={() => {
                      if (selectedPoolKey && courtGroups[selectedPoolKey] !== ci) {
                        a.assignToCourt(s.id, selectedPoolKey, ci)
                        setSelectedPoolKey(null)
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={S.rosterTitle}>
                        {t('assign.rosterCount', { n: rosterHere.length, on: filledCount })}
                      </span>
                      {benchPlayers.length > 0 && (
                        <span style={S.rosterBadge}>
                          {t('courtAssign.benchWaiting', { n: benchPlayers.length })}
                        </span>
                      )}
                    </div>
                    <div style={S.rosterChips}>
                      {benchPlayers.map((p) => {
                        const isSelected = selectedPoolKey === p.key
                        const inf = getPlayerInfo(p.key)
                        return (
                          <div
                            key={p.key}
                            {...dragProps(p.key)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPoolKey(isSelected ? null : p.key)
                            }}
                            style={{
                              ...S.rosterChip,
                              background: isSelected ? 'var(--navy-500, #1D50A0)' : 'var(--surface-inset, #101927)',
                              borderColor: isSelected ? 'var(--navy-400, #3C74C4)' : 'var(--border-subtle, #22304A)',
                              boxShadow: isSelected ? '0 0 0 1px var(--navy-400, #3C74C4)' : 'none',
                            }}
                          >
                            <span style={{ color: isSelected ? 'var(--gray-0, #FFFFFF)' : 'var(--text-primary, #E9EFF7)' }}>
                              {p.name}
                            </span>
                            <span style={inf.isFemale ? S.genderBadgeNu : S.genderBadgeNam}>
                              {t(inf.isFemale ? 'gender.nu' : 'gender.nam')}
                            </span>
                            {inf.hasAdjustment ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={S.ratingStrike}>{inf.rawRating}</span>
                                <span style={S.ratingEff}>{inf.effRating}</span>
                              </span>
                            ) : (
                              <span style={{ ...S.monoVal, color: isSelected ? 'var(--navy-200, #C0D8F8)' : 'var(--text-muted, #8494AA)' }}>
                                {inf.rawRating}
                              </span>
                            )}
                            <span style={confBadgeStyle(inf.confLevel)}>{inf.confLevel}</span>
                            <LevelChip level={p.level} levels={db.levels} />
                            <button
                              type="button"
                              title={t('courtAssign.unassignTitle')}
                              onClick={(e) => {
                                e.stopPropagation()
                                a.removeFromCourt(s.id, p.key)
                                if (selectedPoolKey === p.key) setSelectedPoolKey(null)
                              }}
                              style={S.chipRemoveBtn}
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                      {benchPlayers.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--text-disabled, #5B6B81)', padding: '2px 0' }}>
                          {rosterHere.length === 0 ? t('assign.rosterEmpty') : t('courtAssign.rosterAllPlaying')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div style={S.slotsGrid}>
                  {/* Đội A */}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <SlotBox p={p0} slotId={slots[0]} />
                    <SlotBox p={p1} slotId={slots[1]} />
                  </div>

                  {/* VS divider */}
                  <div style={S.vsDivider}>
                    <div style={S.vsLine} />
                    <span style={S.vsText}>VS</span>
                    <div style={S.vsLine} />
                  </div>

                  {/* Đội B */}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <SlotBox p={p2} slotId={slots[2]} />
                    <SlotBox p={p3} slotId={slots[3]} />
                  </div>
                </div>

                {/* Balance Row */}
                <div style={S.balanceRow}>
                  {balance ? (
                    <div style={{ display: 'grid', gap: 3, width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ font: '600 13px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>{balance.pctA}%</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>
                            {t('rating.gap', { gap: balance.gap })} {balance.isEff ? `· ${t('courtAssign.effective')}` : ''}
                          </span>
                          <span style={{ font: '600 13px/1 "IBM Plex Mono", monospace', color: 'var(--text-secondary, #A8B7CB)' }}>{balance.pctB}%</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: balance.color }}>
                          {balance.label}
                        </span>
                      </div>
                      {balance.isEff && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>
                          {t('courtAssign.rawRatingNote', { gap: balance.rawGap, label: balance.rawLabel })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-disabled, #5B6B81)' }}>
                      {t('courtAssign.needFour')}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    disabled={!isFull}
                    onClick={() => setScoringCourt({
                      courtId: c.courtId,
                      courtIndex: ci,
                      name: courtName,
                      slots: [p0?.key, p1?.key, p2?.key, p3?.key],
                      fromChallengeId: attachedChallenge?.id,
                      fromChallengeCode: attachedChallenge?.code,
                      minutes: running || minutes,
                    })}
                    style={{
                      ...S.finishBtn,
                      background: isFull ? 'var(--navy-500, #1D50A0)' : 'var(--surface-card, #141D2E)',
                      borderColor: isFull ? 'var(--navy-400, #3C74C4)' : 'var(--border-subtle, #22304A)',
                      color: isFull ? 'var(--gray-0, #FFFFFF)' : 'var(--text-disabled, #5B6B81)',
                      cursor: isFull ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isFull ? t('courtAssign.finishBtn') : t('courtAssign.finishBtnDisabled')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearCourt(ci)}
                    style={S.clearBtn}
                  >
                    {t('courtAssign.clearBtn')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Score Modal */}
      {scoringCourt && (
        <ScoreModal
          court={scoringCourt}
          session={s}
          challenge={scoringCourt.fromChallengeId ? (db.challenges || []).find((c) => c.id === scoringCourt.fromChallengeId) : null}
          onClose={() => setScoringCourt(null)}
          onSaved={() => {
            setScoringCourt(null)
            handleClearCourt(scoringCourt.courtIndex)
          }}
        />
      )}
    </div>
  )
}

/** Thanh công cụ: chọn chế độ xếp, xếp ngay, xóa, chia đều */
function Toolbar({ s, lineup, idxs }) {
  const { ui, a, db } = useApp()
  const mode = ui.asnMode || 'balance'
  const total = slotIds(s).length
  const on = Object.keys(lineup).length
  const groupMode = !!(db.groupMode || {})[s.id]

  return (
    <div style={S.toolbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            value={mode}
            options={ASSIGN_MODES.map((m) => ({ value: m.value, label: m.label }))}
            onChange={(e) => a.setAsnMode(e.target.value)}
            style={{ width: 220 }}
          />
          <Button variant="primary" icon="wand-sparkles" onClick={() => a.arrange(s.id, mode)}>
            {t('assign.arrangeNow')}
          </Button>
          <Button variant="secondary" icon="eraser" onClick={() => a.clearLineup(s.id)}>
            {t('assign.clear')}
          </Button>
          {idxs.length > 1 && (
            <Button variant="secondary" icon="split" onClick={() => a.autoSplitCourts(s.id)}>
              {t('assign.splitEven')}
            </Button>
          )}
        </div>

        <div style={S.seatsBadge}>
          {t('assign.seats', { on, total, courts: idxs.length })}
        </div>
      </div>

      {idxs.length > 1 && (
        <div style={S.groupBar}>
          <Switch
            label={t('assign.groupModeLabel')}
            checked={groupMode}
            onChange={() => a.toggleGroupMode(s.id)}
          />
          <span style={S.caption}>{t(groupMode ? 'assign.groupModeOn' : 'assign.groupModeOff')}</span>
        </div>
      )}
    </div>
  )
}

const S = {
  poolCard: {
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
    borderRadius: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
    padding: '14px 16px',
    display: 'grid',
    gap: 10,
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary, #E9EFF7)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  poolChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 40,
    alignItems: 'center',
  },
  poolChip: {
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
  monoVal: {
    font: '400 12px/1 "IBM Plex Mono", monospace',
  },
  acceptedCard: {
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--teal-700, #00786F)',
    borderRadius: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
    padding: '14px 16px',
    display: 'grid',
    gap: 10,
  },
  acceptedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--teal-700, #00786F)',
  },
  challengeCode: {
    font: '600 13px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg, #5FDBD3)',
  },
  challengeMeta: {
    font: '400 13px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
  },
  deployBtn: {
    height: 36,
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
  toolbar: {
    padding: '12px 14px',
    borderRadius: 10,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  seatsBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-primary, #E9EFF7)',
  },
  courtGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: 16,
    alignItems: 'start',
  },
  courtCard: {
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
    borderRadius: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
    overflow: 'hidden',
  },
  courtHead: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  courtMeta: {
    font: '400 13px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid',
  },
  timerBar: {
    padding: '8px 14px',
    background: 'var(--surface-inset, #101927)',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courtBody: {
    padding: '12px 14px',
    display: 'grid',
    gap: 10,
  },
  slotsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 28px 1fr',
    gap: 8,
    alignItems: 'center',
  },
  slotBox: {
    minHeight: 46,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  vsDivider: {
    display: 'grid',
    justifyItems: 'center',
    gap: 4,
  },
  vsLine: {
    width: 1,
    height: 18,
    background: 'var(--border-subtle, #22304A)',
  },
  vsText: {
    font: '700 12px/1 Barlow, sans-serif',
    color: 'var(--text-disabled, #5B6B81)',
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  finishBtn: {
    flex: 1,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
  },
  clearBtn: {
    height: 40,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    borderRadius: 6,
    background: 'var(--surface-raised, #1A2437)',
    border: '1px solid var(--border-default, #2E3E5C)',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    cursor: 'pointer',
  },
  tagAmber: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(224,138,0,.18)',
    color: 'var(--status-delayed-fg, #F0B75C)',
  },
  rosterBox: {
    padding: '10px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px dashed var(--navy-600, #163B75)',
    display: 'grid',
    gap: 8,
  },
  rosterTitle: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rosterBadge: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    padding: '2px 6px',
    borderRadius: 99,
    background: 'rgba(95, 219, 211, 0.12)',
    color: 'var(--status-transit-fg, #5FDBD3)',
    border: '1px solid rgba(95, 219, 211, 0.25)',
  },
  rosterChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    minHeight: 28,
  },
  rosterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid',
    cursor: 'grab',
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    transition: 'all 0.15s ease',
  },
  chipRemoveBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #8494AA)',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: 14,
    lineHeight: 1,
    marginLeft: 2,
    borderRadius: 3,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    marginTop: 10,
  },
  caption: {
    font: '400 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  calBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 8,
    background: 'rgba(0,178,169,.10)',
    border: '1px solid var(--teal-700, #00786F)',
  },
  calIcon: {
    width: 22,
    height: 22,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'var(--teal-500, #00B2A9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: '700 13px/1 Barlow, sans-serif',
    color: 'var(--teal-900, #04302C)',
  },
  calTitle: {
    font: '600 14px/1.35 "IBM Plex Sans", sans-serif',
    color: 'var(--status-transit-fg, #5FDBD3)',
  },
  calDesc: {
    font: '400 13px/1.5 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
  },
  calToggleBtn: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    padding: '6px 10px',
    borderRadius: 999,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-default, #2E3E5C)',
    color: 'var(--text-secondary, #A8B7CB)',
    whiteSpace: 'nowrap',
    alignSelf: 'center',
    cursor: 'pointer',
  },
  genderBadgeNu: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    padding: '2px 5px',
    borderRadius: 999,
    background: 'rgba(236,72,153,.16)',
    color: '#F0A5CD',
  },
  genderBadgeNam: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    padding: '2px 5px',
    borderRadius: 999,
    background: 'rgba(60,116,196,.18)',
    color: 'var(--navy-200, #9FC0EA)',
  },
  ratingStrike: {
    font: '400 11px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
    textDecoration: 'line-through',
  },
  ratingEff: {
    font: '600 12px/1 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg, #5FDBD3)',
  },
  rawRatingDesc: {
    font: '400 12px/1.5 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
    paddingTop: 6,
    borderTop: '1px dashed var(--border-subtle, #22304A)',
  },
  suggestBtn: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    padding: '5px 10px',
    borderRadius: 6,
    background: 'var(--surface-raised, #1A2437)',
    border: '1px solid var(--border-default, #2E3E5C)',
    color: 'var(--text-primary, #E9EFF7)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}

const confBadgeStyle = (level) => {
  const base = {
    font: '700 9px/1 "IBM Plex Mono", monospace',
    padding: '2px 4px',
    borderRadius: 3,
  }
  if (level === 'R1') return { ...base, background: 'rgba(214,59,43,.22)', color: '#F09A8E' }
  if (level === 'R2') return { ...base, background: 'rgba(240,183,92,.22)', color: 'var(--status-delayed-fg, #F0B75C)' }
  if (level === 'R3') return { ...base, background: 'rgba(60,116,196,.22)', color: 'var(--navy-200, #9FC0EA)' }
  return { ...base, background: 'rgba(95,217,162,.20)', color: 'var(--status-delivered-fg, #5FD9A2)' }
}
