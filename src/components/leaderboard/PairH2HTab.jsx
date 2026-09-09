import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge, rankPairs } from '#lib/rating.js'
import { useMobile } from '#hooks/useMobile.js'
import { SearchSelect } from '#ui'
import PairH2HModal from './PairH2HModal.jsx'

export default function PairH2HTab({
  db,
  membersMap = {},
  ratingsMap = {},
  matches = [],
}) {
  const isMobile = useMobile(900)

  const nameOf = (id) => {
    const mem = membersMap[id]
    return mem?.name || (typeof id === 'object' ? id?.name : id) || ''
  }

  // Danh sách toàn bộ các cặp đôi từ database
  const allPairs = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, { minGames: 1 }).rankedPairs || []
  }, [matches, membersMap, ratingsMap])

  // Danh sách toàn bộ thành viên để chọn
  const memberList = useMemo(() => {
    const rawList = (db?.members && db.members.length > 0)
      ? db.members
      : Object.values(membersMap)

    const list = (rawList || [])
      .filter((m) => m && (m.id || m.key))
      .map((m) => {
        const id = m.id || m.key
        const rating = ratingsMap[id] || m.rating || 0
        return {
          value: id,
          label: m.name || id,
          sub: rating ? `${rating} Elo` : (m.level || ''),
          level: m.level,
        }
      })
    return list.sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [db?.members, membersMap, ratingsMap])

  // Lấy 2 cặp đôi mặc định từ allPairs
  const defaultPairA = allPairs[0]?.key || ''
  const [initA1, initA2] = defaultPairA ? defaultPairA.split(':') : ['', '']
  const [playerA1, setPlayerA1] = useState(initA1 || '')
  const [playerA2, setPlayerA2] = useState(initA2 || '')

  const defaultPairB = (allPairs.find((p) => p.key !== defaultPairA)?.key) || ''
  const [initB1, initB2] = defaultPairB ? defaultPairB.split(':') : ['', '']
  const [playerB1, setPlayerB1] = useState(initB1 || '')
  const [playerB2, setPlayerB2] = useState(initB2 || '')

  const setPairA = (p1, p2) => {
    setPlayerA1(p1)
    setPlayerA2(p2)
  }

  const setPairB = (p1, p2) => {
    setPlayerB1(p1)
    setPlayerB2(p2)
  }

  const handleSwapSides = () => {
    const tA1 = playerA1
    const tA2 = playerA2
    setPlayerA1(playerB1)
    setPlayerA2(playerB2)
    setPlayerB1(tA1)
    setPlayerB2(tA2)
  }

  // Chuyển danh sách ID thành mảng hợp lệ
  const pairAIds = useMemo(() => {
    const ids = []
    if (playerA1) ids.push(playerA1)
    if (playerA2 && playerA2 !== playerA1) ids.push(playerA2)
    return ids.sort()
  }, [playerA1, playerA2])

  const pairBIds = useMemo(() => {
    const ids = []
    if (playerB1) ids.push(playerB1)
    if (playerB2 && playerB2 !== playerB1) ids.push(playerB2)
    return ids.sort()
  }, [playerB1, playerB2])

  const selectedPairAKey = pairAIds.length === 2 ? pairAIds.join(':') : ''
  const selectedPairBKey = pairBIds.length === 2 ? pairBIds.join(':') : ''

  // Bạn cặp quen của Người 1
  const frequentPartnersOfA1 = useMemo(() => {
    if (!playerA1) return []
    const partnerMap = new Map()
    ;(matches || []).forEach((m) => {
      if (!m || !m.winnerTeam) return
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      let partnerId = null
      if (teamA.includes(playerA1) && teamA.length >= 2) {
        partnerId = teamA[0] === playerA1 ? teamA[1] : teamA[0]
      } else if (teamB.includes(playerA1) && teamB.length >= 2) {
        partnerId = teamB[0] === playerA1 ? teamB[1] : teamB[0]
      }
      if (partnerId) {
        partnerMap.set(partnerId, (partnerMap.get(partnerId) || 0) + 1)
      }
    })
    return Array.from(partnerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => ({ id, name: nameOf(id), count }))
  }, [playerA1, matches, membersMap])

  // Tìm các cặp từng gặp Cặp A
  const opponentsOfA = useMemo(() => {
    if (pairAIds.length < 2) return []
    const [pA1, pA2] = pairAIds
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
      .map(([key, count]) => {
        const [o1, o2] = key.split(':')
        return {
          key,
          p1: o1,
          p2: o2,
          names: `${nameOf(o1)} · ${nameOf(o2)}`,
          count,
        }
      })
  }, [pairAIds, matches, membersMap])

  // Kình địch CLB
  const topRivalries = useMemo(() => {
    const matchupCount = new Map()
    ;(matches || []).forEach((m) => {
      if (!m || !m.winnerTeam) return
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      if (teamA.length >= 2 && teamB.length >= 2) {
        const keyA = [teamA[0], teamA[1]].sort().join(':')
        const keyB = [teamB[0], teamB[1]].sort().join(':')
        if (keyA === keyB) return
        const matchKey = [keyA, keyB].sort().join('__vs__')
        matchupCount.set(matchKey, (matchupCount.get(matchKey) || 0) + 1)
      }
    })
    return Array.from(matchupCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key, count]) => {
        const [kA, kB] = key.split('__vs__')
        const [a1, a2] = kA.split(':')
        const [b1, b2] = kB.split(':')
        return {
          key,
          a1, a2, b1, b2,
          nameA: `${nameOf(a1)} · ${nameOf(a2)}`,
          nameB: `${nameOf(b1)} · ${nameOf(b2)}`,
          count,
        }
      })
  }, [matches, membersMap])

  // Lọc options cho từng ô chọn để tránh trùng người
  const optionsA1 = memberList
  const optionsA2 = useMemo(() => memberList.filter((m) => m.value !== playerA1), [memberList, playerA1])
  const optionsB1 = useMemo(() => memberList.filter((m) => m.value !== playerA1 && m.value !== playerA2), [memberList, playerA1, playerA2])
  const optionsB2 = useMemo(() => memberList.filter((m) => m.value !== playerA1 && m.value !== playerA2 && m.value !== playerB1), [memberList, playerA1, playerA2, playerB1])

  // Modal P6 xem chi tiết khi ở mobile
  const [showP6Modal, setShowP6Modal] = useState(false)

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
          padding: '14px 16px',
          display: 'grid',
          gap: 12,
        }}
      >
        {/* Kình địch CLB gợi ý nhanh */}
        {topRivalries.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <span style={{ font: "600 11px/1 'IBM Plex Sans', sans-serif", color: '#F0B75C', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              🔥 {t('pairH2H.topRivalries')}:
            </span>
            {topRivalries.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setPairA(r.a1, r.a2)
                  setPairB(r.b1, r.b2)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  font: "500 12px/1 'IBM Plex Sans', sans-serif",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{r.nameA} <span style={{ color: '#8494AA' }}>vs</span> {r.nameB}</span>
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#00B2A9' }}>
                  ({t('pairH2H.gamesCountLabel', { n: r.count })})
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 48px minmax(0, 1fr) auto',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {/* CẶP A */}
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5FD9A2' }}>
                {t('pairH2H.pairA')}
              </span>
              {pairAIds.length === 2 && (
                <span style={{ font: "500 12px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {namesA}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SearchSelect
                placeholder={t('pairH2H.player1')}
                options={optionsA1}
                value={playerA1}
                onChange={(val) => {
                  setPlayerA1(val)
                  if (val === playerA2) setPlayerA2('')
                }}
                clearable
                size="md"
              />
              <SearchSelect
                placeholder={t('pairH2H.player2')}
                options={optionsA2}
                value={playerA2}
                onChange={(val) => setPlayerA2(val)}
                clearable
                size="md"
              />
            </div>

            {/* Gợi ý bạn cặp quen thuộc */}
            {frequentPartnersOfA1.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                <span style={{ font: "400 11px/1 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('pairH2H.frequentPartners')}:
                </span>
                {frequentPartnersOfA1.map((fp) => (
                  <button
                    key={fp.id}
                    type="button"
                    onClick={() => setPlayerA2(fp.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: playerA2 === fp.id ? 'rgba(0,178,169,0.25)' : 'rgba(255,255,255,0.06)',
                      border: playerA2 === fp.id ? '1px solid #00B2A9' : '1px solid #2E3E5C',
                      color: playerA2 === fp.id ? '#5FDBD3' : '#E9EFF7',
                      font: "500 11px/1 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fp.name} <span style={{ color: '#8494AA', fontFamily: "'IBM Plex Mono', monospace" }}>({fp.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cột giữa: VS & Swap */}
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              paddingTop: isMobile ? 0 : 20,
            }}
          >
            <span style={{ font: "700 13px/1 'IBM Plex Mono', monospace", color: '#5B6B81' }}>
              VS
            </span>
            <button
              type="button"
              onClick={handleSwapSides}
              title={t('pairH2H.swapSides')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                color: '#A8B7CB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.15s ease',
              }}
            >
              ⇄
            </button>
          </div>

          {/* CẶP B */}
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FF9A8F' }}>
                {t('pairH2H.pairB')}
              </span>
              {pairBIds.length === 2 && (
                <span style={{ font: "500 12px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {namesB}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SearchSelect
                placeholder={t('pairH2H.player3')}
                options={optionsB1}
                value={playerB1}
                onChange={(val) => {
                  setPlayerB1(val)
                  if (val === playerB2) setPlayerB2('')
                }}
                clearable
                size="md"
              />
              <SearchSelect
                placeholder={t('pairH2H.player4')}
                options={optionsB2}
                value={playerB2}
                onChange={(val) => setPlayerB2(val)}
                clearable
                size="md"
              />
            </div>

            {/* Gợi ý đối thủ từng gặp */}
            {opponentsOfA.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                <span style={{ font: "400 11px/1 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('pairH2H.historicOpponents')}:
                </span>
                {opponentsOfA.slice(0, 3).map((opp) => {
                  const isCur = selectedPairBKey === opp.key
                  return (
                    <button
                      key={opp.key}
                      type="button"
                      onClick={() => setPairB(opp.p1, opp.p2)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: isCur ? 'rgba(255,154,143,0.22)' : 'rgba(255,255,255,0.06)',
                        border: isCur ? '1px solid #FF9A8F' : '1px solid #2E3E5C',
                        color: isCur ? '#FF9A8F' : '#E9EFF7',
                        font: "500 11px/1 'IBM Plex Sans', sans-serif",
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opp.names} <span style={{ color: '#8494AA', fontFamily: "'IBM Plex Mono', monospace" }}>({opp.count})</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action buttons (CSV / Mobile Modal) */}
          <div style={{ display: 'flex', gap: 8, paddingTop: isMobile ? 8 : 22 }}>
            {isMobile ? (
              <button
                type="button"
                onClick={() => setShowP6Modal(true)}
                disabled={!matchupData}
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
                  opacity: matchupData ? 1 : 0.5,
                }}
              >
                {t('pairH2H.sheetTitle')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!matchupData?.matches?.length}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 6,
                  background: '#1A2437',
                  border: '1px solid #2E3E5C',
                  font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                  color: '#E9EFF7',
                  cursor: matchupData?.matches?.length ? 'pointer' : 'not-allowed',
                  opacity: matchupData?.matches?.length ? 1 : 0.4,
                }}
              >
                {t('pairH2H.exportCsv')}
              </button>
            )}
          </div>
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

            {/* Nếu 2 cặp chưa từng đấu trực tiếp, thông báo dự đoán theo Elo */}
            {gamesCount === 0 && (
              <div
                style={{
                  background: 'rgba(29,80,160,.16)',
                  border: '1px solid #1D50A0',
                  borderRadius: 6,
                  padding: '8px 12px',
                  font: "400 12px/1.4 'IBM Plex Sans', sans-serif",
                  color: '#9FC0EA',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>ℹ️ {t('pairH2H.noH2HYet')}</span>
              </div>
            )}

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
                  onClick={() => {
                    const [o1, o2] = om.key.split(':')
                    setPairB(o1, o2)
                  }}
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
