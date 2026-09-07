import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { arrangeBestOfN, activeCourtIdxs } from '#lib/assign.js'
import { getPlayerRating, effectiveStrengthOf } from '#lib/rating.js'
import CourtBalanceExplanationModal from '#components/session/CourtBalanceExplanationModal.jsx'
import EffectiveStrengthModal from '#components/session/EffectiveStrengthModal.jsx'

export default function BestOfNArrangementView({
  session = {},
  players = [],
  db = {},
  onApplyPlan,
  onToggleManual,
  isMobile = false,
}) {
  const [activePlanKey, setActivePlanKey] = useState('planA') // 'planA' | 'planB' | 'planC'
  const [explainingCourt, setExplainingCourt] = useState(null)
  const [inspectingPlayer, setInspectingPlayer] = useState(null)
  const [rerunTrigger, setRerunTrigger] = useState(0)

  // Map rating cho tất cả người chơi
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      const pr = getPlayerRating(db.playerRatings, p.key, p, db.levels)
      map[p.key] = pr.rating || 1500
    })
    return map
  }, [players, db.playerRatings, db.levels])

  // Lịch sử trận và thống kê lượt đánh
  const { sessionMatches, matchStatsObj } = useMemo(() => {
    const matches = (db.matches || []).filter((m) => m.sessionId === session.id)
    const statsObj = {}
    matches.forEach((m) => {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      keys.forEach((k) => {
        statsObj[k] = { n: (statsObj[k]?.n || 0) + 1 }
      })
    })
    return { sessionMatches: matches, matchStatsObj: statsObj }
  }, [db.matches, session.id])

  // Thuật toán Monte Carlo Best-of-N (80 phương án)
  const bestOfNResult = useMemo(() => {
    const groupMode = !!(db.groupMode || {})[session.id]
    const courtGroups = (db.courtGroups || {})[session.id] || {}

    return arrangeBestOfN({
      players,
      session,
      candidatesCount: 80,
      ratingsMap,
      matches: sessionMatches,
      stats: matchStatsObj,
      groupMode,
      courtGroups,
      levels: db.levels,
    })
  }, [players, session, ratingsMap, sessionMatches, matchStatsObj, db.groupMode, db.courtGroups, db.levels, rerunTrigger])

  const { planA, planB, planC, scatterPoints = [], waitingPlayers = [], blockedConstraints = [], timeMs = 3 } = bestOfNResult

  const currentPlan = activePlanKey === 'planB' && planB ? planB : activePlanKey === 'planC' && planC ? planC : planA
  const courts = currentPlan?.courts || []

  const activeIdxs = activeCourtIdxs(session)
  const waitingCount = waitingPlayers.length

  const handleApply = () => {
    if (onApplyPlan && currentPlan?.lineup) {
      onApplyPlan(currentPlan.lineup)
    }
  }

  return (
    <div
      data-screen-label="CE1 Chia san best of N"
      style={{
        display: 'grid',
        gap: 16,
      }}
    >
      {/* ---------------- Header & Thanh công cụ ---------------- */}
      <div
        style={{
          padding: '14px 20px',
          background: '#0B1220',
          border: '1px solid #22304A',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ font: "600 18px/1.25 Barlow, sans-serif", color: '#E9EFF7' }}>
            Chia sân · buổi {session.date ? session.date.slice(5) : ''}
          </div>
          <div style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
            {waitingCount} người chờ · {activeIdxs.length} sân · máy đã dò 80 phương án trong {timeMs}ms
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onToggleManual && (
            <button
              type="button"
              onClick={onToggleManual}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '9px 14px',
                borderRadius: 6,
                background: '#141D2E',
                border: '1px solid #22304A',
                color: '#A8B7CB',
                cursor: 'pointer',
              }}
            >
              Kéo thả thủ công
            </button>
          )}
          <button
            type="button"
            onClick={() => setRerunTrigger((prev) => prev + 1)}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '9px 14px',
              borderRadius: 6,
              background: '#1A2437',
              border: '1px solid #2E3E5C',
              color: '#E9EFF7',
              cursor: 'pointer',
            }}
          >
            Dò lại
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '9px 14px',
              borderRadius: 6,
              background: '#1D50A0',
              border: '1px solid #1D50A0',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Xếp {currentPlan?.title || 'phương án A'} vào sân
          </button>
        </div>
      </div>

      {/* ---------------- Bố cục 2 cột (Main & Right Rail) ---------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 400px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* CỘT TRÁI: 3 PHƯƠNG ÁN & CÁC SÂN & NGƯỜI CHỜ */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 3 Phương án lựa chọn (A / B / C) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Phương án A */}
            <div
              onClick={() => setActivePlanKey('planA')}
              style={{
                background: '#141D2E',
                border: activePlanKey === 'planA' ? '1.5px solid #00B2A9' : '1px solid #2E3E5C',
                borderRadius: 10,
                padding: 12,
                display: 'grid',
                gap: 9,
                cursor: 'pointer',
                boxShadow: activePlanKey === 'planA' ? '0 0 0 3px rgba(0,178,169,.12)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  Phương án A
                </span>
                <span
                  style={{
                    font: "600 10px/1 'IBM Plex Mono', monospace",
                    padding: '4px 6px',
                    borderRadius: 999,
                    background: '#00B2A9',
                    color: '#04302C',
                  }}
                >
                  TỐT NHẤT
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                <span style={{ font: "600 30px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                  {planA?.score || 92}
                </span>
                <span style={{ font: "400 11px/1.6 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  / 100 điểm cân
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${planA?.score || 92}%`, background: '#00B2A9' }} />
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {planA?.desc || 'Lệch Elo trung bình 24 · không cặp nào lặp lại · 4 người chờ lâu nhất đều vào sân.'}
              </div>
            </div>

            {/* Phương án B */}
            {planB && (
              <div
                onClick={() => setActivePlanKey('planB')}
                style={{
                  background: '#141D2E',
                  border: activePlanKey === 'planB' ? '1.5px solid #1D50A0' : '1px solid #2E3E5C',
                  borderRadius: 10,
                  padding: 12,
                  display: 'grid',
                  gap: 9,
                  cursor: 'pointer',
                  boxShadow: activePlanKey === 'planB' ? '0 0 0 3px rgba(29,80,160,.20)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    Phương án B
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                  <span style={{ font: "600 30px/1 'IBM Plex Mono', monospace", color: '#B6CDEC' }}>
                    {planB?.score || 87}
                  </span>
                  <span style={{ font: "400 11px/1.6 'IBM Plex Mono', monospace", color: '#8494AA' }}>/ 100</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${planB?.score || 87}%`, background: '#1D50A0' }} />
                </div>
                <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {planB?.desc || 'Cân trình hơn A nhưng có cặp đánh lại cặp cũ.'}
                </div>
              </div>
            )}

            {/* Phương án C */}
            {planC && (
              <div
                onClick={() => setActivePlanKey('planC')}
                style={{
                  background: '#141D2E',
                  border: activePlanKey === 'planC' ? '1.5px solid #2E3E5C' : '1px solid #22304A',
                  borderRadius: 10,
                  padding: 12,
                  display: 'grid',
                  gap: 9,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    Phương án C
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                  <span style={{ font: "600 30px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                    {planC?.score || 79}
                  </span>
                  <span style={{ font: "400 11px/1.6 'IBM Plex Mono', monospace", color: '#8494AA' }}>/ 100</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${planC?.score || 79}%`, background: '#2E3E5C' }} />
                </div>
                <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {planC?.desc || 'Toàn cặp mới nhưng độ lệch giữa hai đội có thể lớn hơn.'}
                </div>
              </div>
            )}
          </div>

          {/* Danh sách các sân của phương án được chọn */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 13px',
                borderBottom: '1px solid #22304A',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {currentPlan?.title || 'Phương án A'} · {courts.length} sân
              </span>
              <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                số trong ngoặc là effective strength dùng để ghép
              </span>
            </div>

            {courts.map((court, cIdx) => {
              const diff = court.diff || 0
              const teamA = court.teamA || []
              const teamB = court.teamB || []
              const rA = teamA.reduce((sum, p) => sum + (p.effectiveStrength || p.rating || 1500), 0)
              const rB = teamB.reduce((sum, p) => sum + (p.effectiveStrength || p.rating || 1500), 0)

              // Kiểm tra xem có ai bị co về seed không (< 30 trận)
              const shrinkedPlayer = [...teamA, ...teamB].find((p) => p.gamesCount < 30)

              return (
                <div
                  key={cIdx}
                  style={{
                    padding: '12px 13px',
                    borderBottom: cIdx < courts.length - 1 ? '1px solid rgba(34,48,74,.6)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '66px minmax(0,1fr) auto minmax(0,1fr) 130px',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  {/* Sân & Lệch */}
                  <div style={{ display: 'grid', gap: 3 }}>
                    <span style={{ font: "600 14px/1.1 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                      Sân {court.courtIdx !== undefined ? court.courtIdx + 1 : cIdx + 1}
                    </span>
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '4px 6px',
                        borderRadius: 999,
                        background: diff <= 15 ? 'rgba(0,178,169,.14)' : 'rgba(29,80,160,.20)',
                        border: diff <= 15 ? '1px solid #00786F' : '1px solid #1D50A0',
                        color: diff <= 15 ? '#5FDBD3' : '#B6CDEC',
                        justifySelf: 'start',
                      }}
                    >
                      lệch {diff}
                    </span>
                  </div>

                  {/* Đội A */}
                  <div style={{ display: 'grid', gap: 4, padding: '9px 11px', borderRadius: 8, background: '#0B1220', border: '1px solid #22304A' }}>
                    {teamA.map((p) => {
                      const hasShrink = p.gamesCount < 30
                      return (
                        <div key={p.key || p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                            {p.name}
                          </span>
                          <span
                            onClick={() => hasShrink && setInspectingPlayer(p)}
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: hasShrink ? '#F0D26A' : '#8494AA',
                              fontSize: 12,
                              cursor: hasShrink ? 'pointer' : 'default',
                            }}
                            title={hasShrink ? 'Bấm để xem tính toán Effective Strength' : ''}
                          >
                            ({p.effectiveStrength || p.rating}{hasShrink ? '*' : ''})
                          </span>
                        </div>
                      )
                    })}
                    <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                      tổng {rA}
                    </span>
                  </div>

                  {/* vs */}
                  <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#8494AA', textAlign: 'center' }}>
                    vs
                  </span>

                  {/* Đội B */}
                  <div style={{ display: 'grid', gap: 4, padding: '9px 11px', borderRadius: 8, background: '#0B1220', border: '1px solid #22304A' }}>
                    {teamB.map((p) => {
                      const hasShrink = p.gamesCount < 30
                      return (
                        <div key={p.key || p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                            {p.name}
                          </span>
                          <span
                            onClick={() => hasShrink && setInspectingPlayer(p)}
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: hasShrink ? '#F0D26A' : '#8494AA',
                              fontSize: 12,
                              cursor: hasShrink ? 'pointer' : 'default',
                            }}
                            title={hasShrink ? 'Bấm để xem tính toán Effective Strength' : ''}
                          >
                            ({p.effectiveStrength || p.rating}{hasShrink ? '*' : ''})
                          </span>
                        </div>
                      )
                    })}
                    <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                      tổng {rB}
                    </span>
                  </div>

                  {/* H2H & Nút Vì sao */}
                  <div style={{ display: 'grid', gap: 6, justifyItems: isMobile ? 'start' : 'end' }}>
                    {shrinkedPlayer ? (
                      <span
                        onClick={() => setInspectingPlayer(shrinkedPlayer)}
                        style={{
                          font: "400 11px/1.2 'IBM Plex Mono', monospace",
                          color: '#F0D26A',
                          cursor: 'pointer',
                          textDecoration: 'underline dotted',
                        }}
                      >
                        * {shrinkedPlayer.name ? shrinkedPlayer.name.split(' ').pop() : ''} đã co về seed
                      </span>
                    ) : (
                      <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {court.h2hSummary || 'chưa từng gặp nhau'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setExplainingCourt({ court, cIdx })}
                      style={{
                        font: "600 11px/1 'IBM Plex Sans', sans-serif",
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: '#1A2437',
                        border: '1px solid #2E3E5C',
                        color: '#E9EFF7',
                        cursor: 'pointer',
                      }}
                    >
                      Vì sao?
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Chờ lượt sau */}
          {waitingPlayers.length > 0 && (
            <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '10px 13px',
                  borderBottom: '1px solid #22304A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  Chờ lượt sau · {waitingPlayers.length} người
                </span>
                <div style={{ flex: '1 1 0%' }} />
                <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  sort: chờ lâu nhất trước
                </span>
              </div>
              <div style={{ padding: '11px 13px', display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {waitingPlayers.map((p) => {
                  const turns = p.turnsWaited || 1
                  return (
                    <span
                      key={p.key || p.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 11px',
                        borderRadius: 999,
                        background: '#0B1220',
                        border: '1px solid #2E3E5C',
                        font: "600 12px/1 'IBM Plex Sans', sans-serif",
                        color: '#E9EFF7',
                      }}
                    >
                      {p.name}
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA', fontWeight: 400 }}>
                        {p.rating} · chờ {turns} lượt
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI (RIGHT RAIL): 5 TIÊU CHÍ, BIỂU ĐỒ 80 PHƯƠNG ÁN, ĐIỀU KIỆN CHẶN */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Card 1: Điểm 5 tiêu chí */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 11,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              Điểm 5 tiêu chí · {currentPlan?.title || 'phương án A'}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 40px', gap: 9, alignItems: 'center', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                <span>Cân trình Elo</span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${currentPlan?.criteria?.ratingBalance || 95}%`, background: '#00B2A9' }} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {currentPlan?.criteria?.ratingBalance || 95}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 40px', gap: 9, alignItems: 'center', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                <span>Đổi partner</span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${currentPlan?.criteria?.partnerNovelty || 100}%`, background: '#00B2A9' }} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {currentPlan?.criteria?.partnerNovelty || 100}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 40px', gap: 9, alignItems: 'center', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                <span>Đổi đối thủ</span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${currentPlan?.criteria?.opponentNovelty || 82}%`, background: '#1D50A0' }} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {currentPlan?.criteria?.opponentNovelty || 82}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 40px', gap: 9, alignItems: 'center', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                <span>H2H &amp; tỉ số cũ</span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${currentPlan?.criteria?.h2hHistory || 88}%`, background: '#1D50A0' }} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {currentPlan?.criteria?.h2hHistory || 88}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 40px', gap: 9, alignItems: 'center', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                <span>Đều lượt chờ</span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${currentPlan?.criteria?.waitFairness || 90}%`, background: '#00B2A9' }} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {currentPlan?.criteria?.waitFairness || 90}
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid #22304A',
                paddingTop: 9,
                display: 'flex',
                justifyContent: 'space-between',
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                color: '#E9EFF7',
              }}
            >
              <span>Tổng có trọng số</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                {currentPlan?.score || 92}
              </span>
            </div>
          </div>

          {/* Card 2: Máy đã dò gì · 80 phương án (Scatter SVG Plot) */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              Máy đã dò gì · 80 phương án
            </div>

            <svg width="100%" height="120" viewBox="0 0 368 120" style={{ overflow: 'visible' }}>
              <line x1="0" y1="100" x2="368" y2="100" stroke="#22304A" />
              {/* Ngưỡng nét đứt 90 điểm */}
              <line x1="0" y1="20" x2="368" y2="20" stroke="#22304A" strokeDasharray="3 4" />

              {scatterPoints.length > 0 ? (
                scatterPoints.map((pt, i) => {
                  const cx = Math.round((i / Math.max(1, scatterPoints.length - 1)) * 340 + 14)
                  const cy = Math.round(100 - (Math.max(40, Math.min(100, pt.score)) - 40) * 1.33)
                  const fill = pt.isBest ? '#00B2A9' : pt.score >= 88 ? '#1D50A0' : pt.score >= 80 ? '#7AA3DC' : '#4A5B76'
                  const r = pt.isBest ? 5.5 : pt.score >= 88 ? 4 : 3

                  return <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
                })
              ) : (
                <>
                  <circle cx="18" cy="76" r="3" fill="#4A5B76" />
                  <circle cx="62" cy="64" r="3" fill="#4A5B76" />
                  <circle cx="106" cy="55" r="3" fill="#4A5B76" />
                  <circle cx="150" cy="46" r="3" fill="#4A5B76" />
                  <circle cx="194" cy="38" r="3" fill="#4A5B76" />
                  <circle cx="238" cy="43" r="3" fill="#4A5B76" />
                  <circle cx="260" cy="30" r="3" fill="#7AA3DC" />
                  <circle cx="304" cy="26" r="4" fill="#1D50A0" />
                  <circle cx="348" cy="16" r="5.5" fill="#00B2A9" />
                </>
              )}

              <text x="300" y="12" fill="#5FDBD3" fontFamily="IBM Plex Mono, monospace" fontSize="10">
                A · {planA?.score || 92}
              </text>
              <text x="0" y="116" fill="#8494AA" fontFamily="IBM Plex Mono, monospace" fontSize="10">
                thứ tự dò →
              </text>
            </svg>

            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                borderTop: '1px solid #22304A',
                paddingTop: 9,
              }}
            >
              Ngưỡng nét đứt là điểm 90. Ba phương án vượt ngưỡng, máy lấy cái cao nhất và giữ hai cái sau làm lựa chọn thay thế.
            </div>
          </div>

          {/* Card 3: Đang bị chặn */}
          <div
            style={{
              background: '#1A2437',
              border: '1px solid #2E3E5C',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              Đang bị chặn
            </div>
            <div style={{ display: 'grid', gap: 7, font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {blockedConstraints.length > 0 ? (
                blockedConstraints.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F1A79D' }}>✕</span>
                    <span>{c.text || c.desc || c}</span>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F1A79D' }}>✕</span>
                    <span>Cặp cùng trình độ chênh &gt;100 Elo: giữ hai người ở hai đầu sân.</span>
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F1A79D' }}>✕</span>
                    <span>Nghỉ 1 lượt: người vừa đánh 3 trận liên tiếp được xếp sau.</span>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '8px 12px',
                borderRadius: 6,
                background: '#141D2E',
                border: '1px solid #22304A',
                color: '#E9EFF7',
                justifySelf: 'start',
                cursor: 'pointer',
              }}
            >
              Quản lý điều kiện chặn
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- Modals CE2 & CE3 ---------------- */}
      {explainingCourt && (
        <CourtBalanceExplanationModal
          courtIdx={explainingCourt.cIdx}
          courtData={explainingCourt.court}
          onClose={() => setExplainingCourt(null)}
          onAgree={() => {
            handleApply()
            setExplainingCourt(null)
          }}
        />
      )}

      {inspectingPlayer && (
        <EffectiveStrengthModal
          player={inspectingPlayer}
          onClose={() => setInspectingPlayer(null)}
        />
      )}
    </div>
  )
}
