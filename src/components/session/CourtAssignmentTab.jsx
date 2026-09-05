import { useState, useMemo, useCallback } from 'react'
import { Button, Card, Icon, IconButton, Input, Select, Switch } from '#ds'
import { LevelChip, Mono, Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { courtOf, playerName, genderTxt } from '#lib/money.js'
import { sessionPlayers } from '#lib/assign.js'
import {
  expectedScore, evalBalance, getPlayerRating,
  rankTierOf, teamRating,
} from '#lib/rating.js'
import { t } from '#i18n'

export default function CourtAssignmentTab({ s }) {
  const { db, a } = useApp()
  const isMobile = useMobile(768)

  // Mode: 'doubles' (2 vs 2) hoặc 'singles' (1 vs 1)
  const [mode, setMode] = useState('doubles')
  const maxPerTeam = mode === 'doubles' ? 2 : 1

  // Đội A & Đội B (mảng id các đấu thủ)
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])

  // Cài đặt trận
  const [courtIdx, setCourtIdx] = useState(0)
  const [ratingEnabled, setRatingEnabled] = useState(true)
  const [selectedChallengeId, setSelectedChallengeId] = useState(null)

  // Tỷ số
  const [scoreA, setScoreA] = useState(21)
  const [scoreB, setScoreB] = useState(19)
  const [isBo3, setIsBo3] = useState(false)
  const [bo3Sets, setBo3Sets] = useState([
    [21, 19],
    [19, 21],
    [21, 18],
  ])

  // Tìm kiếm người trong pool
  const [searchQuery, setSearchQuery] = useState('')

  // Danh sách người tham gia buổi (đã điểm danh có mặt hoặc khách)
  const players = useMemo(() => sessionPlayers(db, s), [db, s])

  // Map rating cho tất cả người trong pool
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      map[p.key] = getPlayerRating(db.playerRatings, p.key).rating
    })
    return map
  }, [players, db.playerRatings])

  // Danh sách các trận đã đấu trong buổi này
  const sessionMatches = useMemo(() => {
    return (db.matches || [])
      .filter((m) => m.sessionId === s.id)
      .slice()
      .sort((m1, m2) => (m2.at || 0) - (m1.at || 0))
  }, [db.matches, s.id])

  // Đếm số trận đã chơi trong buổi hôm nay cho từng người
  const matchCountMap = useMemo(() => {
    const counts = {}
    sessionMatches.forEach((m) => {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      keys.forEach((k) => {
        counts[k] = (counts[k] || 0) + 1
      })
    })
    return counts
  }, [sessionMatches])

  // Danh sách các sân còn hoạt động trong buổi
  const courtOptions = useMemo(() => {
    const list = (s.courts || []).filter((c) => !c.sold)
    if (!list.length) return [{ value: 0, label: t('session.courtNum', { n: 1 }) }]
    return list.map((c, i) => ({
      value: i,
      label: c.label
        ? `${c.label} · ${courtOf(db, c.courtId).name}`
        : `${t('session.courtNum', { n: i + 1 })} · ${courtOf(db, c.courtId).name}`,
    }))
  }, [s.courts, db])

  // Kèo đã nhận trong buổi (chưa kết thúc)
  const acceptedChallenges = useMemo(() => {
    return (db.challenges || []).filter((c) => c.sessionId === s.id && c.status === 'accepted')
  }, [db.challenges, s.id])

  // Đổi mode đơn/đôi
  const handleSwitchMode = (newMode) => {
    setMode(newMode)
    const newMax = newMode === 'doubles' ? 2 : 1
    if (teamA.length > newMax) setTeamA(teamA.slice(0, newMax))
    if (teamB.length > newMax) setTeamB(teamB.slice(0, newMax))
  }

  // Chạm vào người trong danh sách chờ: tự xếp vào slot trống hoặc gỡ ra nếu đã có tên
  const handleTogglePlayer = useCallback((key) => {
    if (teamA.includes(key)) {
      setTeamA((prev) => prev.filter((k) => k !== key))
      return
    }
    if (teamB.includes(key)) {
      setTeamB((prev) => prev.filter((k) => k !== key))
      return
    }
    if (teamA.length < maxPerTeam) {
      setTeamA((prev) => [...prev, key])
    } else if (teamB.length < maxPerTeam) {
      setTeamB((prev) => [...prev, key])
    } else {
      a.toast(t('quickMatch.errFullSlots', { req: maxPerTeam }))
    }
  }, [teamA, teamB, maxPerTeam, a])

  // Tự động xếp những người đánh ít nhất vào các slot trống
  const handleAutoPickFewest = () => {
    const unselected = players.filter((p) => !teamA.includes(p.key) && !teamB.includes(p.key))
    unselected.sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0))

    const needed = (maxPerTeam * 2) - (teamA.length + teamB.length)
    if (needed <= 0) return

    const picked = unselected.slice(0, needed).map((p) => p.key)
    let pIdx = 0
    const nextA = [...teamA]
    while (nextA.length < maxPerTeam && pIdx < picked.length) {
      nextA.push(picked[pIdx++])
    }
    const nextB = [...teamB]
    while (nextB.length < maxPerTeam && pIdx < picked.length) {
      nextB.push(picked[pIdx++])
    }
    setTeamA(nextA)
    setTeamB(nextB)
  }

  // Đổi vị trí hai đội A và B
  const handleSwapTeams = () => {
    const tempA = teamA
    setTeamA(teamB)
    setTeamB(tempA)
  }

  // Xoá trắng 2 đội
  const handleClearAll = () => {
    setTeamA([])
    setTeamB([])
    setSelectedChallengeId(null)
  }

  // Nạp kèo đã nhận vào form
  const handleLoadChallenge = (c) => {
    const isDbl = (c.teamA || []).length > 1 || (c.teamB || []).length > 1
    const targetMode = isDbl ? 'doubles' : 'singles'
    setMode(targetMode)
    setTeamA(c.teamA || [])
    setTeamB(c.teamB || [])
    setSelectedChallengeId(c.id)
    setRatingEnabled(c.ratingEnabled !== false)
    if ((c.bestOf || 1) > 1) {
      setIsBo3(true)
    }
    a.toast(t('quickMatch.loadChalSuccess', { code: c.code || '' }))
  }

  // Tính Elo trung bình và độ cân bằng
  const ratingA = useMemo(() => teamRating(teamA, ratingsMap), [teamA, ratingsMap])
  const ratingB = useMemo(() => teamRating(teamB, ratingsMap), [teamB, ratingsMap])

  const balanceInfo = useMemo(() => {
    if (!teamA.length || !teamB.length) return null
    const expA = expectedScore(ratingA, ratingB)
    const pctA = Math.round(expA * 100)
    const pctB = 100 - pctA
    const evalRes = evalBalance(ratingA, ratingB)
    return { pctA, pctB, evalRes }
  }, [teamA, teamB, ratingA, ratingB])

  // Preset tỷ số nhanh
  const applyPreset = (sa, sb) => {
    setScoreA(sa)
    setScoreB(sb)
  }

  // Đảo chiều điểm số (Set 1)
  const handleSwapScore = () => {
    const temp = scoreA
    setScoreA(scoreB)
    setScoreB(temp)
  }

  // Lưu kết quả trận
  const handleSaveResult = () => {
    if (teamA.length < maxPerTeam || teamB.length < maxPerTeam) {
      a.toast(t('quickMatch.errNotEnough', { req: maxPerTeam }))
      return
    }

    const playedSets = isBo3
      ? bo3Sets.filter(([sa, sb]) => sa > 0 || sb > 0)
      : [[Number(scoreA), Number(scoreB)]]

    if (!playedSets.length) {
      a.toast(t('quickMatch.errNoScore'))
      return
    }

    // Kiểm tra hòa set
    for (let i = 0; i < playedSets.length; i++) {
      const [sa, sb] = playedSets[i]
      if (sa === sb) {
        a.toast(t('quickMatch.errTie'))
        return
      }
    }

    a.saveMatchScore({
      sid: s.id,
      ci: courtIdx,
      teamA,
      teamB,
      sets: playedSets,
      challengeId: selectedChallengeId,
      ratingEnabled,
    })

    // Reset sạch form sẵn sàng ghi trận tiếp theo ngay lập tức
    setTeamA([])
    setTeamB([])
    setSelectedChallengeId(null)
    setScoreA(21)
    setScoreB(19)
    setBo3Sets([
      [21, 19],
      [19, 21],
      [21, 18],
    ])
    a.toast(t('quickMatch.saveSuccess'))
  }

  // Lọc người trong pool theo ô tìm kiếm
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players
    const q = searchQuery.toLowerCase()
    return players.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q)
      const levelMatch = (p.level || '').toLowerCase().includes(q)
      return nameMatch || levelMatch
    })
  }, [players, searchQuery])

  return (
    <div style={S.container}>
      {/* ---------------- Banner Kèo đã nhận (nếu có) ---------------- */}
      {acceptedChallenges.length > 0 && (
        <div style={S.chalBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="flame" size={16} color="var(--status-transit-fg)" />
            <span style={{ font: '600 13px/1.4 var(--font-sans)', color: 'var(--text-primary)' }}>
              {t('quickMatch.pendingChalBanner', { n: acceptedChallenges.length })}:
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {acceptedChallenges.map((c) => {
              const nameA = (c.teamA || []).map((id) => playerName(db, id)).join(' + ') || t('quickMatch.teamA')
              const nameB = (c.teamB || []).map((id) => playerName(db, id)).join(' + ') || t('quickMatch.teamB')
              return (
                <div key={c.id} style={S.chalChip}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nameA}</span>
                  <span style={{ color: 'var(--text-muted)' }}>vs</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nameB}</span>
                  <span style={S.tagSub}>{c.bestOf || 1} set</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download"
                    onClick={() => handleLoadChallenge(c)}
                  >
                    {t('quickMatch.loadChal')}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------- KHUNG GHI KẾT QUẢ NHANH (QUICK MATCH LOGGER) ---------------- */}
      <Card
        title={t('quickMatch.title')}
        subtitle={t('quickMatch.sub')}
        icon="sparkles"
        padding="16px 20px"
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Thanh công cụ: Mode Switcher + Chọn Sân + Tính Elo */}
          <div style={S.topToolbar}>
            {/* Mode Switcher */}
            <div style={S.modeTrack}>
              <button
                type="button"
                onClick={() => handleSwitchMode('doubles')}
                style={{
                  ...S.modeBtn,
                  ...(mode === 'doubles' ? S.modeBtnActive : {}),
                }}
              >
                <Icon name="users" size={14} />
                <span>{t('quickMatch.modeDoubles')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('singles')}
                style={{
                  ...S.modeBtn,
                  ...(mode === 'singles' ? S.modeBtnActive : {}),
                }}
              >
                <Icon name="user-round" size={14} />
                <span>{t('quickMatch.modeSingles')}</span>
              </button>
            </div>

            {/* Sân & Tuỳ chọn Elo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <Select
                  size="sm"
                  value={courtIdx}
                  options={courtOptions}
                  onChange={(e) => setCourtIdx(Number(e.target.value))}
                />
              </div>
              <label style={S.toggleLabel}>
                <Switch
                  checked={ratingEnabled}
                  onChange={(val) => setRatingEnabled(val)}
                />
                <span style={{ font: '500 13px/1 var(--font-sans)', color: ratingEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {ratingEnabled ? t('quickMatch.rateElo') : t('quickMatch.unrated')}
                </span>
              </label>
            </div>
          </div>

          {/* Sân đấu Visual VS (Đội A vs Đội B) */}
          <div style={{ ...S.vsContainer, gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr' }}>
            {/* Box Đội A */}
            <div style={S.teamBox}>
              <div style={S.teamHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...S.teamTag, background: 'var(--status-transit-bg)', color: 'var(--status-transit-fg)' }}>
                    {t('quickMatch.teamA')}
                  </span>
                  <span style={S.teamRatingText}>
                    {teamA.length ? `${t('rating.rating')} ~ ${ratingA}` : ''}
                  </span>
                </div>
                <span style={S.slotCountBadge}>
                  {teamA.length}/{maxPerTeam}
                </span>
              </div>

              <div style={S.slotsGrid}>
                {Array.from({ length: maxPerTeam }).map((_, idx) => {
                  const key = teamA[idx]
                  if (key) {
                    const pr = getPlayerRating(db.playerRatings, key)
                    const p = players.find((x) => x.key === key) || {}
                    const tier = rankTierOf(pr.rating)
                    return (
                      <div key={key} style={S.filledSlot}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={S.playerName}>{playerName(db, key)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {genderTxt(p.gender)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ ...S.tierPill, color: tier.color }}>
                              {tier.label} ({pr.rating})
                            </span>
                          </div>
                        </div>
                        <IconButton
                          icon="x"
                          size="sm"
                          variant="ghost"
                          onClick={() => setTeamA(teamA.filter((k) => k !== key))}
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={idx} style={S.emptySlot}>
                      <Icon name="user-round-plus" size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t('challenge.pickTwo')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* VS Badge & Balance Indicator ở giữa */}
            <div style={S.vsCenter}>
              <div style={S.vsBadge}>
                {t('quickMatch.vs')}
              </div>
              {balanceInfo && (
                <div style={S.balanceBox}>
                  <div style={{
                    ...S.balanceTag,
                    background: balanceInfo.evalRes.level === 'balanced'
                      ? 'var(--status-delivered-bg)'
                      : balanceInfo.evalRes.level === 'slight'
                        ? 'var(--status-delayed-bg)'
                        : 'var(--status-incident-bg)',
                    color: balanceInfo.evalRes.level === 'balanced'
                      ? 'var(--status-delivered-fg)'
                      : balanceInfo.evalRes.level === 'slight'
                        ? 'var(--status-delayed-fg)'
                        : 'var(--status-incident-fg)',
                  }}>
                    {t(balanceInfo.evalRes.labelKey)}
                  </div>
                  <div style={S.balanceBarWrap}>
                    <div style={{ ...S.balanceBarA, width: `${balanceInfo.pctA}%` }} />
                    <div style={{ ...S.balanceBarB, width: `${balanceInfo.pctB}%` }} />
                  </div>
                  <span style={S.balanceSub}>
                    {balanceInfo.pctA}% – {balanceInfo.pctB}% (Δ {balanceInfo.evalRes.gap})
                  </span>
                </div>
              )}
            </div>

            {/* Box Đội B */}
            <div style={S.teamBox}>
              <div style={S.teamHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...S.teamTag, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }}>
                    {t('quickMatch.teamB')}
                  </span>
                  <span style={S.teamRatingText}>
                    {teamB.length ? `${t('rating.rating')} ~ ${ratingB}` : ''}
                  </span>
                </div>
                <span style={S.slotCountBadge}>
                  {teamB.length}/{maxPerTeam}
                </span>
              </div>

              <div style={S.slotsGrid}>
                {Array.from({ length: maxPerTeam }).map((_, idx) => {
                  const key = teamB[idx]
                  if (key) {
                    const pr = getPlayerRating(db.playerRatings, key)
                    const p = players.find((x) => x.key === key) || {}
                    const tier = rankTierOf(pr.rating)
                    return (
                      <div key={key} style={S.filledSlot}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={S.playerName}>{playerName(db, key)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {genderTxt(p.gender)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ ...S.tierPill, color: tier.color }}>
                              {tier.label} ({pr.rating})
                            </span>
                          </div>
                        </div>
                        <IconButton
                          icon="x"
                          size="sm"
                          variant="ghost"
                          onClick={() => setTeamB(teamB.filter((k) => k !== key))}
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={idx} style={S.emptySlot}>
                      <Icon name="user-round-plus" size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t('challenge.pickTwo')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Công cụ nhanh điều phối slot */}
          <div style={S.slotActionsRow}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                icon="shuffle"
                onClick={handleAutoPickFewest}
              >
                {t('quickMatch.autoPick')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon="repeat"
                onClick={handleSwapTeams}
              >
                {t('quickMatch.swapTeams')}
              </Button>
            </div>
            {(teamA.length > 0 || teamB.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                icon="rotate-ccw"
                onClick={handleClearAll}
              >
                {t('quickMatch.clearAll')}
              </Button>
            )}
          </div>

          {/* Danh sách người có mặt tại sân (Player Pool) */}
          <div style={S.poolSection}>
            <div style={S.poolHeader}>
              <div>
                <span style={S.poolTitle}>{t('quickMatch.poolTitle')}</span>
                <span style={S.poolCount}>({players.length})</span>
                <div style={S.poolSub}>{t('quickMatch.poolSub')}</div>
              </div>
              <div style={{ width: 220 }}>
                <Input
                  size="sm"
                  placeholder={t('quickMatch.searchPh')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div style={S.poolGrid}>
              {filteredPlayers.map((p) => {
                const inA = teamA.includes(p.key)
                const inB = teamB.includes(p.key)
                const isSelected = inA || inB
                const pr = getPlayerRating(db.playerRatings, p.key)
                const tier = rankTierOf(pr.rating)
                const played = matchCountMap[p.key] || 0

                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleTogglePlayer(p.key)}
                    style={{
                      ...S.playerChip,
                      ...(inA ? S.playerChipA : {}),
                      ...(inB ? S.playerChipB : {}),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={S.chipName}>{p.name}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {genderTxt(p.gender)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ ...S.chipTier, color: tier.color }}>
                        {tier.label}
                      </span>
                      <span style={S.chipPlayed}>
                        {t('quickMatch.playedCount', { n: played })}
                      </span>
                      {isSelected && (
                        <span style={S.chipSelectedBadge}>
                          {inA ? 'A' : 'B'}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---------------- KHỐI NHẬP TỶ SỐ ---------------- */}
          <div style={S.scoreCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="trophy" size={16} color="var(--status-delayed-fg)" />
                <span style={{ font: '600 14px/1 var(--font-sans)', color: 'var(--text-primary)' }}>
                  {t('quickMatch.scoreTitle')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBo3(!isBo3)}
                >
                  {isBo3 ? t('quickMatch.set1') : t('quickMatch.setBo3')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="repeat"
                  onClick={handleSwapScore}
                >
                  {t('quickMatch.swapScore')}
                </Button>
              </div>
            </div>

            {/* Giao diện nhập 1 Set thông dụng */}
            {!isBo3 ? (
              <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                <div style={S.singleScoreRow}>
                  {/* Điểm Đội A */}
                  <div style={S.scoreInputBox}>
                    <span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--status-transit-fg)' }}>
                      {t('quickMatch.teamA')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        style={S.stepBtn}
                        onClick={() => setScoreA(Math.max(0, Number(scoreA) - 1))}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={scoreA}
                        onChange={(e) => setScoreA(Number(e.target.value))}
                        style={S.scoreBigInput}
                      />
                      <button
                        type="button"
                        style={S.stepBtn}
                        onClick={() => setScoreA(Math.min(30, Number(scoreA) + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <span style={{ font: '700 22px/1 var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                    –
                  </span>

                  {/* Điểm Đội B */}
                  <div style={S.scoreInputBox}>
                    <span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--status-delayed-fg)' }}>
                      {t('quickMatch.teamB')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        style={S.stepBtn}
                        onClick={() => setScoreB(Math.max(0, Number(scoreB) - 1))}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={scoreB}
                        onChange={(e) => setScoreB(Number(e.target.value))}
                        style={S.scoreBigInput}
                      />
                      <button
                        type="button"
                        style={S.stepBtn}
                        onClick={() => setScoreB(Math.min(30, Number(scoreB) + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset tỷ số thường gặp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('quickMatch.quickPresets')}</span>
                  {[[21, 19], [21, 15], [21, 12], [21, 8], [30, 29]].map(([pa, pb]) => (
                    <button
                      key={`${pa}-${pb}`}
                      type="button"
                      onClick={() => applyPreset(pa, pb)}
                      style={S.presetBtn}
                    >
                      {pa} - {pb}
                    </button>
                  ))}
                  {[[19, 21], [15, 21], [12, 21], [8, 21], [29, 30]].map(([pa, pb]) => (
                    <button
                      key={`${pa}-${pb}`}
                      type="button"
                      onClick={() => applyPreset(pa, pb)}
                      style={{ ...S.presetBtn, color: 'var(--status-delayed-fg)' }}
                    >
                      {pa} - {pb}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Giao diện 3 Sets (BO3) */
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                {[0, 1, 2].map((sIdx) => (
                  <div key={sIdx} style={S.bo3Row}>
                    <span style={{ font: '600 12.5px/1 var(--font-sans)', color: 'var(--text-secondary)', width: 60 }}>
                      {t('quickMatch.scoreSet', { n: sIdx + 1 })}:
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={bo3Sets[sIdx][0]}
                      onChange={(e) => {
                        const next = [...bo3Sets]
                        next[sIdx] = [Number(e.target.value), next[sIdx][1]]
                        setBo3Sets(next)
                      }}
                      style={S.bo3Input}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>–</span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={bo3Sets[sIdx][1]}
                      onChange={(e) => {
                        const next = [...bo3Sets]
                        next[sIdx] = [next[sIdx][0], Number(e.target.value)]
                        setBo3Sets(next)
                      }}
                      style={S.bo3Input}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------------- NÚT LƯU KẾT QUẢ & TÍNH ELO (CTA CHÍNH) ---------------- */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <Button
              variant="primary"
              size="lg"
              icon="circle-check"
              disabled={teamA.length < maxPerTeam || teamB.length < maxPerTeam}
              style={{
                background: 'var(--action-success-bg)',
                borderColor: 'var(--action-success-border)',
                fontWeight: 700,
                padding: '0 24px',
                minHeight: 46,
                fontSize: 15,
                boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 135, 90, 0.25))',
              }}
              onClick={handleSaveResult}
            >
              {t('quickMatch.saveResult')}
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------------- BẢNG LỊCH SỬ CÁC TRẬN ĐÃ ĐẤU TRONG BUỔI ---------------- */}
      <Card
        title={t('quickMatch.historyTitle')}
        subtitle={t('quickMatch.historySub')}
        icon="history"
        padding="16px 20px"
        actions={
          <span style={S.historyBadge}>
            {sessionMatches.length} {t('quickMatch.matchCode').toLowerCase()}
          </span>
        }
      >
        {sessionMatches.length === 0 ? (
          <Empty
            icon="flame"
            title={t('quickMatch.emptyHistory')}
            hint={t('quickMatch.emptyHistoryHint')}
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sessionMatches.map((m) => {
              const aWon = m.winnerTeam === 'A'
              const namesA = (m.teamA || []).map((id) => playerName(db, id)).join(' · ')
              const namesB = (m.teamB || []).map((id) => playerName(db, id)).join(' · ')
              const delta = Math.abs(m.eloDelta || 0)

              return (
                <div key={m.id} style={S.matchRow}>
                  {/* Mã trận & Sân */}
                  <div style={S.matchMetaCol}>
                    <span style={S.matchCodeBadge}>{m.code || 'M'}</span>
                    <span style={S.matchCourtText}>
                      {courtOf(db, (s.courts || [])[m.courtIdx]?.courtId)?.name || t('session.courtNum', { n: m.courtIdx + 1 })}
                    </span>
                    <span style={m.challengeId ? S.sourceTagChallenge : S.sourceTagQuick}>
                      {m.challengeId ? t('quickMatch.sourceChallenge') : t('quickMatch.sourceQuick')}
                    </span>
                  </div>

                  {/* Đội A vs Đội B & Điểm số */}
                  <div style={S.matchTeamsCol}>
                    {/* Đội A */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{
                        ...S.matchPlayerNames,
                        color: aWon ? 'var(--status-delivered-fg)' : 'var(--text-primary)',
                        fontWeight: aWon ? 700 : 500,
                      }}>
                        {aWon && <Icon name="check" size={13} style={{ marginRight: 4, display: 'inline' }} />}
                        {namesA}
                      </span>
                      <span style={{
                        ...S.matchScoreBadge,
                        color: aWon ? 'var(--status-delivered-fg)' : 'var(--text-muted)',
                      }}>
                        {(m.sets || []).map((r) => r[0]).join(' / ') || '—'}
                      </span>
                    </div>

                    {/* Đội B */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                      <span style={{
                        ...S.matchPlayerNames,
                        color: !aWon ? 'var(--status-delivered-fg)' : 'var(--text-primary)',
                        fontWeight: !aWon ? 700 : 500,
                      }}>
                        {!aWon && <Icon name="check" size={13} style={{ marginRight: 4, display: 'inline' }} />}
                        {namesB}
                      </span>
                      <span style={{
                        ...S.matchScoreBadge,
                        color: !aWon ? 'var(--status-delivered-fg)' : 'var(--text-muted)',
                      }}>
                        {(m.sets || []).map((r) => r[1]).join(' / ') || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Biến động Elo */}
                  <div style={S.matchEloCol}>
                    {m.ratingEnabled !== false && delta > 0 ? (
                      <span style={S.eloDeltaBadge}>
                        ±{delta} Elo
                      </span>
                    ) : (
                      <span style={S.unratedText}>
                        {t('quickMatch.unrated')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

const S = {
  container: {
    display: 'grid',
    gap: 16,
  },
  chalBanner: {
    padding: '12px 16px',
    borderRadius: 8,
    background: 'var(--status-transit-bg)',
    border: '1px solid var(--status-transit)',
  },
  chalChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    fontSize: 12.5,
  },
  tagSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    padding: '1px 6px',
    borderRadius: 99,
    background: 'var(--surface-inset)',
  },
  topToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingBottom: 12,
    borderBottom: '1px solid var(--border-subtle)',
  },
  modeTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    font: '600 12.5px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.15))',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  vsContainer: {
    display: 'grid',
    gap: 12,
    alignItems: 'center',
  },
  teamBox: {
    display: 'grid',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  teamHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamTag: {
    font: '700 11px/1 var(--font-sans)',
    letterSpacing: 'var(--tracking-caps)',
    padding: '3px 8px',
    borderRadius: 99,
  },
  teamRatingText: {
    fontSize: 12,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-muted)',
  },
  slotCountBadge: {
    fontSize: 11.5,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-muted)',
  },
  slotsGrid: {
    display: 'grid',
    gap: 8,
  },
  filledSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
  emptySlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px 10px',
    borderRadius: 6,
    border: '1px dashed var(--border-subtle)',
    background: 'transparent',
  },
  playerName: {
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  tierPill: {
    font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: 'var(--tracking-caps)',
  },
  vsCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 0',
  },
  vsBadge: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: '800 13px/1 var(--font-sans)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1))',
  },
  balanceBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 140,
  },
  balanceTag: {
    font: '700 10px/1 var(--font-sans)',
    letterSpacing: 'var(--tracking-caps)',
    padding: '2px 8px',
    borderRadius: 99,
  },
  balanceBarWrap: {
    display: 'flex',
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    background: 'var(--surface-sunken)',
  },
  balanceBarA: {
    background: 'var(--status-transit-fg)',
    transition: 'width 0.2s ease',
  },
  balanceBarB: {
    background: 'var(--status-delayed-fg)',
    transition: 'width 0.2s ease',
  },
  balanceSub: {
    fontSize: 11,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-muted)',
  },
  slotActionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  poolSection: {
    display: 'grid',
    gap: 10,
    paddingTop: 10,
    borderTop: '1px solid var(--border-subtle)',
  },
  poolHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  poolTitle: {
    font: '600 13.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  poolCount: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginLeft: 4,
  },
  poolSub: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  poolGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 7,
    maxHeight: 220,
    overflowY: 'auto',
    padding: '4px 1px',
  },
  playerChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 11px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  playerChipA: {
    background: 'var(--status-transit-bg)',
    borderColor: 'var(--status-transit-fg)',
  },
  playerChipB: {
    background: 'var(--status-delayed-bg)',
    borderColor: 'var(--status-delayed-fg)',
  },
  chipName: {
    font: '600 12.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  chipTier: {
    font: '600 10.5px/1 var(--font-sans)',
  },
  chipPlayed: {
    fontSize: 11,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-muted)',
  },
  chipSelectedBadge: {
    font: '700 10px/1 var(--font-sans)',
    padding: '1px 5px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  scoreCard: {
    padding: 12,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  singleScoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  scoreInputBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  stepBtn: {
    width: 32,
    height: 38,
    borderRadius: 6,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    font: '700 16px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  scoreBigInput: {
    width: 68,
    height: 38,
    borderRadius: 6,
    border: '1px solid var(--border-default)',
    background: 'var(--surface-card)',
    textAlign: 'center',
    font: '700 20px/1 var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  presetBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    font: '600 11px/1 var(--font-mono, monospace)',
    color: 'var(--status-transit-fg)',
    cursor: 'pointer',
  },
  bo3Row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  bo3Input: {
    width: 56,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--border-default)',
    background: 'var(--surface-card)',
    textAlign: 'center',
    font: '600 14px/1 var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  historyBadge: {
    font: '600 11.5px/1 var(--font-mono, monospace)',
    padding: '3px 8px',
    borderRadius: 99,
    background: 'var(--surface-inset)',
    color: 'var(--text-muted)',
  },
  matchRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  matchMetaCol: {
    display: 'grid',
    gap: 4,
  },
  matchCodeBadge: {
    font: '700 12px/1 var(--font-mono, monospace)',
    color: 'var(--text-primary)',
  },
  matchCourtText: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
  },
  sourceTagQuick: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: 'var(--tracking-caps)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    color: 'var(--text-secondary)',
    width: 'fit-content',
  },
  sourceTagChallenge: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: 'var(--tracking-caps)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--status-transit-bg)',
    color: 'var(--status-transit-fg)',
    width: 'fit-content',
  },
  matchTeamsCol: {
    display: 'grid',
    gap: 2,
    minWidth: 0,
  },
  matchPlayerNames: {
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matchScoreBadge: {
    font: '700 13.5px/1 var(--font-mono, monospace)',
  },
  matchEloCol: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  eloDeltaBadge: {
    font: '700 12px/1 var(--font-mono, monospace)',
    padding: '3px 8px',
    borderRadius: 99,
    background: 'var(--status-delivered-bg)',
    color: 'var(--status-delivered-fg)',
  },
  unratedText: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
  },
}
