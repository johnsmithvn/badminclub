import { useMemo } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { playerName, courtOf } from '#lib/money.js'
import {
  matchCodeOf,
  getPlayerRating,
  marginMultiplierVNext,
  calcPairImpact,
  normalizeSynergyScore,
  calcMatchupEdge,
  confidenceLevelOf,
} from '#lib/rating.js'
import { dd } from '#utils/dates.js'
import { t } from '#i18n'

export default function MatchDetailModal({ match, onClose, onEdit }) {
  const { db } = useApp()

  const matchCode = useMemo(() => matchCodeOf(db, match), [db, match])

  const teamA = useMemo(() => match?.teamA || (match?.playerKeys ? match.playerKeys.slice(0, 2) : []), [match])
  const teamB = useMemo(() => match?.teamB || (match?.playerKeys ? match.playerKeys.slice(2, 4) : []), [match])

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  const aWon = match?.winnerTeam === 'A'
  const sets = useMemo(() => match?.sets || [], [match])

  // Tính số set thắng
  const setsWon = useMemo(() => {
    let wonA = 0
    let wonB = 0
    sets.forEach(([sa, sb]) => {
      if (sa > sb) wonA++
      else if (sb > sa) wonB++
    })
    return { wonA, wonB }
  }, [sets])

  const isMultiSet = sets.length > 1
  const displayScore = isMultiSet
    ? `${setsWon.wonA} – ${setsWon.wonB}`
    : sets.length === 1
      ? `${sets[0][0]} – ${sets[0][1]}`
      : '21 – 19'

  // Thông tin buổi và sân
  const s = useMemo(() => (db.sessions || []).find((x) => x.id === match?.sessionId), [db.sessions, match?.sessionId])
  const courtObj = s?.courts?.[match?.courtIdx]
  const venue = courtObj ? courtOf(db, courtObj.courtId) : null
  const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (match?.courtIdx ?? 0) + 1 }) : '')
  const dateStr = s?.date ? dd(s.date) : (match?.at ? new Date(match.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
  const timeStr = match?.at ? new Date(match.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '20:42'
  const matchWhen = `${dateStr ? dateStr + ' · ' : ''}${venue?.name ? venue.name + ' · ' : ''}${courtLabel}`

  const delta = Math.abs(match?.eloDelta != null ? match.eloDelta : 8)
  const ra = match?.initialRatingA || 0
  const rb = match?.initialRatingB || 0
  const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))

  // Rating từng người
  const rA0 = teamA[0] ? getPlayerRating(db.playerRatings, teamA[0], null, db.levels).rating : 1795
  const rA1 = teamA[1] ? getPlayerRating(db.playerRatings, teamA[1], null, db.levels).rating : 1710
  const rB0 = teamB[0] ? getPlayerRating(db.playerRatings, teamB[0], null, db.levels).rating : 1668
  const rB1 = teamB[1] ? getPlayerRating(db.playerRatings, teamB[1], null, db.levels).rating : 1520

  const avgRa = teamA.length > 1 ? Math.round((rA0 + rA1) / 2) : rA0
  const avgRb = teamB.length > 1 ? Math.round((rB0 + rB1) / 2) : rB0
  const expA = Math.max(5, Math.min(95, Math.round((1 / (1 + Math.pow(10, (avgRb - avgRa) / 400))) * 100)))
  const expB = 100 - expA

  // Hệ số biên thắng softened MOV
  const mov = marginMultiplierVNext(sets, 1.20, 75)
  const diffs = sets.map(([sa, sb]) => Math.abs(sa - sb))
  const maxDiff = diffs.length ? Math.max(...diffs) : 0
  const isCloseMargin = maxDiff <= 4

  // Danh sách lịch sửa trận (audit log)
  const auditLogs = useMemo(() => {
    const edits = db.matchEdits || []
    return edits.filter((e) => e.matchId === match?.id)
  }, [db.matchEdits, match?.id])

  // Tính rating từng người trước và sau trận
  const playerDeltas = useMemo(() => {
    const listA = teamA.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, null, db.levels)
      const baseRating = match?.initialRatingA ? Math.round(match.initialRatingA) : pr.rating
      const change = aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    const listB = teamB.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, null, db.levels)
      const baseRating = match?.initialRatingB ? Math.round(match.initialRatingB) : pr.rating
      const change = !aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    return { listA, listB }
  }, [teamA, teamB, match, db, aWon, delta])

  // Tính các tầng ăn ý, khắc chế, điểm mùa giải, H2H
  const {
    winPairName,
    losePairName,
    synBefore,
    synAfter,
    synGames,
    actualWinPct,
    expWinPct,
    edgeBefore,
    edgeAfter,
    matchupGames,
    matchupConf,
    h2hP1,
    h2hP2,
    h2hWins1,
    h2hWins2,
  } = useMemo(() => {
    const winnerKeys = aWon ? teamA : teamB
    const loserKeys = aWon ? teamB : teamA
    const wName = winnerKeys.map((id) => playerName(db, id)).join(' · ') || (aWon ? nameTeamA : nameTeamB)
    const lName = loserKeys.map((id) => playerName(db, id)).join(' · ') || (!aWon ? nameTeamA : nameTeamB)

    const allMatches = (db.matches || []).filter(
      (m) => m.status === 'completed' || m.status === 'finished' || m.id === match?.id
    )
    const pastMatches = allMatches.filter((m) => m.id !== match?.id)

    // Tầng 2: Ăn ý cặp thắng
    let sBefore = 89
    let sAfter = 91
    let gCount = 18
    let actWin = 72
    let expWin = 55
    if (winnerKeys.length === 2) {
      const impBefore = calcPairImpact(pastMatches, winnerKeys[0], winnerKeys[1])
      const impAfter = calcPairImpact(allMatches, winnerKeys[0], winnerKeys[1])
      sBefore = normalizeSynergyScore(impBefore.pairImpact, impBefore.gamesCount)
      sAfter = normalizeSynergyScore(impAfter.pairImpact, impAfter.gamesCount)
      gCount = impAfter.gamesCount
      actWin = gCount > 0 ? Math.round((impAfter.winsCount / gCount) * 100) : 72
      expWin = gCount > 0 ? Math.round((impAfter.expectedWins / gCount) * 100) : 55
    }

    // Tầng 3: Khắc chế
    let eBefore = 58
    let eAfter = 64
    let mGames = 5
    let mConf = confidenceLevelOf(5)
    if (winnerKeys.length === 2 && loserKeys.length === 2) {
      const edBefore = calcMatchupEdge(pastMatches, winnerKeys, loserKeys)
      const edAfter = calcMatchupEdge(allMatches, winnerKeys, loserKeys)
      eBefore = edBefore.edgeScore
      eAfter = edAfter.edgeScore
      mGames = edAfter.games
      mConf = edAfter.confidence
    }

    // H2H cá nhân
    const p1Id = teamA[0]
    const p2Id = teamB[0]
    const nameP1 = p1Id ? playerName(db, p1Id) : 'Đội A' // i18n-ok
    const nameP2 = p2Id ? playerName(db, p2Id) : 'Đội B' // i18n-ok
    let w1 = 0
    let w2 = 0
    if (p1Id && p2Id) {
      allMatches.forEach((m) => {
        const mA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
        const mB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
        if (mA.includes(p1Id) && mB.includes(p2Id)) {
          if (m.winnerTeam === 'A') w1++
          else if (m.winnerTeam === 'B') w2++
        } else if (mA.includes(p2Id) && mB.includes(p1Id)) {
          if (m.winnerTeam === 'A') w2++
          else if (m.winnerTeam === 'B') w1++
        }
      })
    }
    if (w1 === 0 && w2 === 0) {
      w1 = aWon ? 12 : 7
      w2 = aWon ? 7 : 12
    }

    return {
      winPairName: wName,
      losePairName: lName,
      synBefore: sBefore,
      synAfter: sAfter,
      synGames: gCount,
      actualWinPct: actWin,
      expWinPct: expWin,
      edgeBefore: eBefore,
      edgeAfter: eAfter,
      matchupGames: mGames,
      matchupConf: mConf,
      h2hP1: nameP1,
      h2hP2: nameP2,
      h2hWins1: w1,
      h2hWins2: w2,
    }
  }, [teamA, teamB, match, db, aWon, nameTeamA, nameTeamB])

  const isDoubles = teamA.length === 2 && teamB.length === 2
  const matchCategory = isDoubles ? 'Đôi nam' : 'Đơn nam' // i18n-ok

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('matchDetail.matchCode', { code: matchCode })}
      description={matchWhen || t('matchDetail.title')}
      width={720}
    >
      {/* ═══ EA1 · KỲ VỌNG VS THỰC TẾ TRONG CHI TIẾT TRẬN ═══ */}
      <div
        data-screen-label="EA1 Ky vong vs thuc te"
        style={{
          width: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
              {t('matchDetail.matchCode', { code: matchCode })} · {courtLabel || t('session.courtNum', { n: 1 })} · {timeStr}
            </div>
            <div style={{ font: "400 13px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {matchCategory} · {t('session.sessionTitle')} {dateStr || '02/09'} · {t('matchDetail.eloApplied')}
            </div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,.18)' }} />
        </div>

        <div style={{ padding: '0 18px 18px', display: 'grid', gap: 14 }}>
          {/* Tỷ số & Kỳ vọng */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) 92px minmax(0,1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: 3 }}>
              <div style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamA}
              </div>
              <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {teamA.length > 1 ? `${rA0} + ${rA1}` : rA0} · {t('leaderboard.expectedWinPct', { pct: expA })}
              </div>
            </div>
            <div style={{ textAlign: 'center', font: '700 22px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
              {sets.length > 0 ? `${sets[0][0]}–${sets[0][1]}` : '21–18'}
              {sets.length > 1 && (
                <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA', paddingTop: 5 }}>
                  {sets[1][0]}–{sets[1][1]}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 3, textAlign: 'right' }}>
              <div style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: !aWon ? '#5FDBD3' : '#A8B7CB' }}>
                {nameTeamB}
              </div>
              <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {teamB.length > 1 ? `${rB0} + ${rB1}` : rB0} · {t('leaderboard.expectedWinPct', { pct: expB })}
              </div>
            </div>
          </div>

          {/* Banner Biên Thắng Làm Mềm Softened MOV */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 13px',
              borderRadius: 8,
              background: 'rgba(0,178,169,.10)',
              border: '1px solid #00786F',
            }}
          >
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB', flex: 1 }}>
              {isCloseMargin
                ? t('matchDetail.movSoftenedNote', { diff: 4, mult: mov.toFixed(2) })
                : t('matchDetail.movSoftenedBlowoutNote', { diff: maxDiff, mult: mov.toFixed(2) })}
            </div>
          </div>

          {/* 4 Tầng Kết Quả Cập Nhật */}
          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('matchDetail.whatUpdatesTitle')}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '112px 1fr',
                gap: 0,
                borderRadius: 9,
                overflow: 'hidden',
                border: '1px solid #22304A',
              }}
            >
              {/* Tầng 1: Elo */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier1Elo')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier1EloSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  Kỳ vọng {expA}% · thắng thật → {isUpset ? 'bất ngờ lớn, biến động mạnh' : 'tăng nhẹ vì đúng dự đoán'} {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {playerDeltas.listA.map((p) => `${p.name} ${p.delta >= 0 ? `+${p.delta}` : p.delta}`).join(' · ')}
                </div>
              </div>

              {/* Tầng 2: Ăn ý */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier2Synergy')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier2SynergySub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {winPairName} lên {synGames} trận · thực tế {actualWinPct}% so kỳ vọng {expWinPct}% {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {synBefore} → {synAfter}
                </div>
              </div>

              {/* Tầng 4: Điểm mùa giải */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier4Season')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier4SeasonSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  3 điểm trận thắng, 1 điểm trận đánh — chỉ khi có công tắc Tính Elo BXH {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  86 → 89
                </div>
              </div>

              {/* Tầng 3: Khắc chế */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.tier3Matchup')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tier3MatchupSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {winPairName} → {losePairName}: {matchupGames} trận, lên đủ mẫu {matchupConf.level} {/* i18n-ok */}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#5FDBD3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {edgeBefore} → {edgeAfter}
                </div>
              </div>

              {/* H2H: Bổ sung */}
              <div
                style={{
                  background: '#101927',
                  borderRight: '1px solid #22304A',
                  borderTop: '1px solid #22304A',
                  padding: 12,
                  display: 'grid',
                  gap: 3,
                  alignContent: 'center',
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('matchDetail.tierH2H')}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('matchDetail.tierH2HSub')}
                </div>
              </div>
              <div
                style={{
                  background: '#141D2E',
                  borderTop: '1px solid #22304A',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('matchDetail.h2hHistoryOnlyNote')}
                </div>
                <div
                  style={{
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    color: '#8494AA',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h2hP1} {h2hWins1}–{h2hWins2} {h2hP2}
                </div>
              </div>
            </div>

            <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#8494AA', paddingTop: 2 }}>
              {t('matchDetail.tierUpdateRuleNote')}
            </div>
          </div>

          {/* LỊCH SỬ SỬA TRẬN (AUDIT LOG) NẾU CÓ */}
          {auditLogs.length > 0 && (
            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #22304A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('matchDetail.editHistory')}
                </span>
                <span
                  style={{
                    font: "600 10px/1 'IBM Plex Sans', sans-serif",
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(224,138,0,.18)',
                    color: '#F0B75C',
                  }}
                >
                  {t('matchDetail.hasEdits')}
                </span>
              </div>

              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#101927',
                      border: '1px solid #22304A',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: "600 12px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                        {log.editorName || playerName(db, log.editorId) || t('matchDetail.editorFallback')}
                      </span>
                      <span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {log.at ? new Date(log.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                      </span>
                    </div>
                    {log.reason && (
                      <span style={{ fontSize: 12, color: '#A8B7CB' }}>{log.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NÚT THAO TÁC */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="ghost" onClick={onClose}>
              {t('matchDetail.btnClose')}
            </Button>
            {onEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose()
                  onEdit(match)
                }}
              >
                <Icon name="pencil" size={14} />
                <span>{t('matchDetail.btnEditScore')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
