import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge, rankPairs } from '#lib/rating.js'
import { useMobile } from '#hooks/useMobile.js'
import PairH2HModal from './PairH2HModal.jsx'

export default function PairH2HTab({
  db,
  membersMap = {},
  ratingsMap = {},
  matches = [],
}) {
  const isMobile = useMobile(900)

  // Danh sách toàn bộ các cặp đôi từ database
  const allPairs = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, { minGames: 1 }).rankedPairs || []
  }, [matches, membersMap, ratingsMap])

  // Lấy 2 cặp đôi mặc định: Cặp 1 và cặp hay gặp cặp 1 nhất
  const defaultPairA = allPairs[0]?.key || ''
  const [selectedPairAKey, setSelectedPairAKey] = useState(defaultPairA)

  // Tìm các cặp từng gặp Cặp A
  const opponentsOfA = useMemo(() => {
    if (!selectedPairAKey) return []
    const [pA1, pA2] = selectedPairAKey.split(':')
    const oppMap = new Map()

    ;(matches || []).forEach((m) => {
      if (!m || !m.winnerTeam) return
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

      const inA = (teamA.includes(pA1) && teamA.includes(pA2))
      const inB = (teamB.includes(pA1) && teamB.includes(pA2))

      if (inA && teamB.length >= 2) {
        const oppKey = [teamB[0], teamB[1]].sort().join(':')
        oppMap.set(oppKey, (oppMap.get(oppKey) || 0) + 1)
      } else if (inB && teamA.length >= 2) {
        const oppKey = [teamA[0], teamA[1]].sort().join(':')
        oppMap.set(oppKey, (oppMap.get(oppKey) || 0) + 1)
      }
    })

    return Array.from(oppMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }))
  }, [selectedPairAKey, matches])

  const defaultPairB = opponentsOfA[0]?.key || (allPairs.find((p) => p.key !== selectedPairAKey)?.key || '')
  const [selectedPairBKey, setSelectedPairBKey] = useState(defaultPairB)

  // Modal P6 xem chi tiết khi ở mobile
  const [showP6Modal, setShowP6Modal] = useState(false)

  // Chuyển key dạng "p1:p2" thành mảng ID
  const pairAIds = useMemo(() => {
    if (!selectedPairAKey) return []
    return selectedPairAKey.split(':')
  }, [selectedPairAKey])

  const pairBIds = useMemo(() => {
    if (!selectedPairBKey) return []
    return selectedPairBKey.split(':')
  }, [selectedPairBKey])

  const nameOf = (id) => {
    const mem = membersMap[id]
    return mem?.name || (typeof id === 'object' ? id?.name : id) || ''
  }

  const namesA = pairAIds.map(nameOf).join(' · ')
  const namesB = pairBIds.map(nameOf).join(' · ')

  // Tính toán chỉ số đối đầu thô & kỵ giơ
  const matchupData = useMemo(() => {
    if (!pairAIds.length || !pairBIds.length) return null
    return calcMatchupEdge(matches, pairAIds, pairBIds, ratingsMap)
  }, [matches, pairAIds, pairBIds, ratingsMap])

  // Các đối đầu khác của Cặp A (cho card phải)
  const otherMatchups = useMemo(() => {
    if (!selectedPairAKey) return []
    return opponentsOfA
      .filter((opp) => opp.key !== selectedPairBKey)
      .slice(0, 5)
      .map((opp) => {
        const oppIds = opp.key.split(':')
        const oppNames = oppIds.map(nameOf).join(' · ')
        const edge = calcMatchupEdge(matches, pairAIds, oppIds, ratingsMap)
        const winsB = edge.gamesCount - edge.winsCount
        return {
          key: opp.key,
          names: oppNames,
          record: `${edge.winsCount}T–${winsB}B`,
          tier: edge.confidence?.tier || 'R1',
        }
      })
  }, [selectedPairAKey, selectedPairBKey, opponentsOfA, matches, pairAIds, ratingsMap, membersMap])

  // Xuất CSV lịch sử đối đầu của 2 cặp
  const handleExportCsv = () => {
    if (!matchupData?.matches?.length) return
    let csv = 'data:text/csv;charset=utf-8,\uFEFF'
    csv += 'Mã trận,Thời gian,Cặp A,Tỉ số,Cặp B,Kết quả,Sân\n' // i18n-ok: csv header
    matchupData.matches.forEach((mItem) => {
      const m = mItem.match || {}
      const time = mItem.at ? new Date(mItem.at).toLocaleString('vi-VN') : ''
      const score = (mItem.sets || []).map(([a, b]) => `${a}-${b}`).join('; ')
      const result = mItem.won ? 'Cặp A Thắng' : 'Cặp B Thắng' // i18n-ok: csv status
      const venue = m.venue || m.courtName || 'CLB'
      csv += `"${m.code || m.id || ''}","${time}","${namesA}","${score}","${namesB}","${result}","${venue}"\n`
    })
    const encoded = encodeURI(csv)
    const link = document.createElement('a')
    link.setAttribute('href', encoded)
    link.setAttribute('download', `doi_dau_${namesA}_vs_${namesB}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const {
    gamesCount = 0,
    winsCount = 0,
    actualWinPct = 50,
    expectedWinPct = 50,
    matchupImpact = 0,
    advantageScore = 50,
    firstMatchDate = null,
    avgScoreDiff = '0.0',
    matches: h2hMatches = [],
  } = matchupData || {}

  const winsB = gamesCount - winsCount
  const winPctA = gamesCount > 0 ? actualWinPct : 50

  const firstDateStr = firstMatchDate
    ? new Date(firstMatchDate).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
    : '—'

  // Sắp xếp các trận: mới nhất lên trước
  const sortedMatches = useMemo(() => {
    return [...h2hMatches].reverse()
  }, [h2hMatches])

  return (
    <div
      data-screen-label="AY1c Tab doi dau"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: isMobile ? '12px 14px' : '0 0 24px',
      }}
    >
      {/* ---------------- 1. Bộ chọn Tra cứu hai cặp (Tra đối đầu) ---------------- */}
      <div
        style={{
          background: '#141D2E',
          border: '1px solid #22304A',
          borderRadius: 10,
          padding: '13px 16px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 34px minmax(0, 1fr) auto',
          gap: 12,
          alignItems: 'end',
        }}
      >
        {/* Chọn Cặp A */}
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
            {t('pairH2H.pairA')}
          </span>
          <select
            value={selectedPairAKey}
            onChange={(e) => {
              setSelectedPairAKey(e.target.value)
              // Tự chọn cặp B hợp lý nếu trùng
              if (e.target.value === selectedPairBKey) {
                const alt = allPairs.find((p) => p.key !== e.target.value)?.key || ''
                setSelectedPairBKey(alt)
              }
            }}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 6,
              background: '#101927',
              border: '1px solid #2E3E5C',
              font: "500 13.5px/1 'IBM Plex Sans', sans-serif",
              color: '#E9EFF7',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {allPairs.map((p) => (
              <option key={p.key} value={p.key}>
                {p.names.join(' · ')} ({p.gamesCount} trận)
              </option>
            ))}
          </select>
        </div>

        {/* Chữ vs */}
        <div
          style={{
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: "600 13px/1 'IBM Plex Mono', monospace",
            color: '#5B6B81',
          }}
        >
          vs
        </div>

        {/* Chọn Cặp B */}
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
            {t('pairH2H.pairB')}
          </span>
          <select
            value={selectedPairBKey}
            onChange={(e) => setSelectedPairBKey(e.target.value)}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 6,
              background: '#101927',
              border: '1px solid #2E3E5C',
              font: "500 13.5px/1 'IBM Plex Sans', sans-serif",
              color: '#E9EFF7',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {allPairs
              .filter((p) => p.key !== selectedPairAKey)
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.names.join(' · ')} ({p.gamesCount} trận)
                </option>
              ))}
          </select>
        </div>

        {/* Nút hành động */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isMobile ? (
            <button
              type="button"
              onClick={() => setShowP6Modal(true)}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 6,
                background: '#00B2A9',
                border: 'none',
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                color: '#04302C',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              {t('pairH2H.sheetTitle')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 6,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                color: '#E9EFF7',
                cursor: 'pointer',
              }}
            >
              {t('pairH2H.exportCsv')}
            </button>
          )}
        </div>
      </div>

      {/* ---------------- 2. Main Layout (Cột trái & Cột phải) ---------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 420px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ================= CỘT TRÁI ================= */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Card 1: Bảng tổng quan đối đầu */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '16px 18px',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ font: '700 44px/1 Barlow, sans-serif', color: '#5FD9A2' }}>
                  {winsCount}
                </div>
                <div style={{ font: "400 12.5px/1.35 'IBM Plex Sans', sans-serif", color: '#8494AA', marginTop: 4 }}>
                  {t('pairH2H.winsCount', { name: namesA })}
                </div>
              </div>
              <span style={{ font: "400 26px/1.7 'IBM Plex Mono', monospace", color: '#5B6B81' }}>–</span>
              <div>
                <div style={{ font: '700 44px/1 Barlow, sans-serif', color: '#FF9A8F' }}>
                  {winsB}
                </div>
                <div style={{ font: "400 12.5px/1.35 'IBM Plex Sans', sans-serif", color: '#8494AA', marginTop: 4 }}>
                  {t('pairH2H.winsCount', { name: namesB })}
                </div>
              </div>
              <div style={{ flex: '1 1 0%' }} />
              <div style={{ textAlign: 'right', display: 'grid', gap: 4 }}>
                <span
                  style={{
                    font: "600 15px/1 'IBM Plex Mono', monospace",
                    padding: '8px 11px',
                    borderRadius: 999,
                    background: 'rgba(18,168,103,.20)',
                    color: '#5FD9A2',
                    justifySelf: 'end',
                  }}
                >
                  {winPctA}%
                </span>
                <span style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('pairH2H.expLabel', { exp: expectedWinPct })}
                </span>
              </div>
            </div>

            {/* Thanh tỉ lệ thắng hai màu */}
            <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${winPctA}%`, background: '#12A867' }} />
              <span style={{ flex: 1, background: '#B33A2C' }} />
            </span>

            {/* 3 ô thống kê con */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ padding: '11px 13px', borderRadius: 6, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
                <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('pairH2H.exceedExp')}
                </span>
                <span style={{ font: '700 20px/1 Barlow, sans-serif', color: matchupImpact >= 0 ? '#5FD9A2' : '#FF9A8F' }}>
                  {matchupImpact >= 0 ? `+${matchupImpact}pp` : `${matchupImpact}pp`}
                </span>
              </div>
              <div style={{ padding: '11px 13px', borderRadius: 6, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
                <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('pairH2H.avgScoreDiff')}
                </span>
                <span style={{ font: '700 20px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
                  {avgScoreDiff}
                </span>
              </div>
              <div style={{ padding: '11px 13px', borderRadius: 6, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
                <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('pairH2H.firstMet')}
                </span>
                <span style={{ font: '700 20px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
                  {firstDateStr}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Danh sách toàn bộ các trận */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '11px 15px',
                background: '#101927',
                borderBottom: '1px solid #22304A',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ flex: 1, font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                {t('pairH2H.allMatchesHeader', { count: gamesCount })}
              </span>
              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('pairH2H.newestFirst')}
              </span>
            </div>

            {sortedMatches.length > 0 ? (
              sortedMatches.map((mItem, idx) => {
                const m = mItem.match || {}
                const dateStr = mItem.at
                  ? new Date(mItem.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                  : '—'
                const courtNum = m.courtId || m.courtIndex || 1
                const venue = m.venue || m.courtName || 'CLB'
                const scoreStr = (mItem.sets || []).map(([a, b]) => `${a}–${b}`).join(', ') || '—'

                return (
                  <div
                    key={mItem.id || idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '26px 54px minmax(0, 1fr) auto' : '26px 78px minmax(0, 1fr) 92px 74px',
                      gap: 12,
                      padding: '11px 15px',
                      alignItems: 'center',
                      borderBottom: idx === sortedMatches.length - 1 ? 'none' : '1px solid #22304A',
                    }}
                  >
                    <span
                      style={{
                        font: "600 11px/20px 'IBM Plex Mono', monospace",
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        textAlign: 'center',
                        background: mItem.won ? 'rgba(18,168,103,.24)' : 'rgba(225,68,52,.22)',
                        color: mItem.won ? '#5FD9A2' : '#FF9A8F',
                      }}
                    >
                      {mItem.won ? 'T' : 'B'}
                    </span>
                    <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                      {dateStr}
                    </span>
                    <span
                      style={{
                        font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif",
                        color: '#8494AA',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t('pairH2H.matchSessionCourt', { date: dateStr, court: courtNum })}
                    </span>
                    <span style={{ textAlign: 'right', font: "600 14px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                      {scoreStr}
                    </span>
                    {!isMobile && (
                      <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {venue}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#8494AA', font: "400 13px 'IBM Plex Sans', sans-serif" }}>
                {t('pairH2H.noMatchHistory')}
              </div>
            )}
          </div>
        </div>

        {/* ================= CỘT PHẢI ================= */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Card 1: Đối đầu khác của Cặp A */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '11px 14px',
                background: '#101927',
                borderBottom: '1px solid #22304A',
                font: "600 13px/1.3 'IBM Plex Sans', sans-serif",
                color: '#fff',
              }}
            >
              {t('pairH2H.otherH2HOf', { name: namesA })}
            </div>
            {otherMatchups.length > 0 ? (
              otherMatchups.map((om, oIdx) => (
                <div
                  key={om.key}
                  onClick={() => setSelectedPairBKey(om.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 14px',
                    borderBottom: oIdx === otherMatchups.length - 1 ? 'none' : '1px solid #22304A',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1A263D' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: "400 13.5px/1.3 'IBM Plex Sans', sans-serif",
                      color: '#E9EFF7',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    vs {om.names}
                  </span>
                  <span style={{ font: "400 13px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                    {om.record}
                  </span>
                  <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                    {om.tier}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: '#8494AA', fontSize: 12 }}>
                {t('pairH2H.noMatchHistory')}
              </div>
            )}
          </div>

          {/* Card 2: Giải thích Đối đầu khác khắc chế thế nào */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
              {t('pairH2H.h2hVsEdgeTitle')}
            </div>
            <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('pairH2H.h2hVsEdgeDesc')}
            </div>
            <div style={{ display: 'grid', gap: 8, paddingTop: 2 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: '#101927',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ flex: 1, font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('pairH2H.weightH2H')}
                </span>
                <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  4
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: '#101927',
                  border: '1px solid #00786F',
                }}
              >
                <span style={{ flex: 1, font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('pairH2H.weightEdge')}
                </span>
                <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                  8
                </span>
              </div>
            </div>
            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                borderTop: '1px solid #22304A',
                paddingTop: 10,
              }}
            >
              {t('pairH2H.h2hWeightNote')}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet P6 trên Mobile */}
      {showP6Modal && (
        <PairH2HModal
          pairA={pairAIds}
          pairB={pairBIds}
          matches={matches}
          membersMap={membersMap}
          ratingsMap={ratingsMap}
          onClose={() => setShowP6Modal(false)}
        />
      )}
    </div>
  )
}
