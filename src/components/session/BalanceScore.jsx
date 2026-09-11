import { ConfidenceChip } from '#ui'
import { t } from '#i18n'

/**
 * M2 · Sheet Điểm cân bằng · BalanceScore.jsx
 * Bottom sheet hiển thị 6 chỉ số chi tiết của điểm cân bằng:
 * 1. Cân rating
 * 2. Đổi partner
 * 3. Đổi đối thủ
 * 4. Đều lượt đánh
 * [MỚI] không cộng vào điểm tổng
 * 5. Ăn ý cặp
 * 6. Khắc chế
 */
export default function BalanceScore({
  balanceDetails,
  effectiveAnalysis = null,
  ratingA = 0,
  ratingB = 0,
  pctA = 50,
  pctB = 50,
  teamAName = '',
  teamBName = '',
  onApplySuggestion,
  onClose,
}) {
  if (!balanceDetails) return null

  const {
    totalScore = 88,
    canRating = { delta: 0, score: 100 },
    partner = { score: 100 },
    opponent = { score: 100 },
    fairness = { score: 100 },
    pairAInfo = null,
    pairBInfo = null,
    matchup = null,
  } = balanceDetails

  const delta = canRating.delta ?? 0

  // 5. Ăn ý cặp (chỉ số mới - không cộng vào điểm tổng)
  const hasSynA = pairAInfo && pairAInfo.gamesCount >= 5
  const hasSynB = pairBInfo && pairBInfo.gamesCount >= 5
  let pairSynergyScore = null
  if (hasSynA && hasSynB) {
    pairSynergyScore = Math.round((pairAInfo.synergyScore + pairBInfo.synergyScore) / 2)
  } else if (hasSynA) {
    pairSynergyScore = pairAInfo.synergyScore
  } else if (hasSynB) {
    pairSynergyScore = pairBInfo.synergyScore
  }
  const hasPairSynergy = pairSynergyScore !== null

  // Độ tin của Ăn ý = cặp YẾU mẫu hơn khi cả hai cùng đủ trận (điểm là trung bình của hai cặp,
  // nên chỉ đáng tin tới mức cặp ít trận hơn). Chưa cặp nào đủ thì lấy cặp nhiều trận nhất,
  // khớp với câu "còn thiếu mấy trận" ở phần giải trình bên dưới.
  const synGamesA = pairAInfo?.gamesCount || 0
  const synGamesB = pairBInfo?.gamesCount || 0
  const synConfGames = hasSynA && hasSynB
    ? Math.min(synGamesA, synGamesB)
    : hasSynA ? synGamesA
      : hasSynB ? synGamesB
        : Math.max(synGamesA, synGamesB)

  // 6. Khắc chế (chỉ số mới - không cộng vào điểm tổng)
  const matchupGames = matchup?.gamesCount || 0
  const hasMatchup = matchupGames >= 5
  const matchupScore = hasMatchup ? (matchup.advantageScore ?? 50) : null

  // Xây dựng câu giải trình cặp ăn ý & khắc chế
  const fallbackA = t('assign.slotTeamLabel', { team: 'A', n: 1 })
  const fallbackB = t('assign.slotTeamLabel', { team: 'B', n: 1 })
  const synergyNotes = []
  if (hasSynA) {
    synergyNotes.push(t('assign.pairSynergyNote', { name: teamAName || fallbackA, score: pairAInfo.synergyScore, games: pairAInfo.gamesCount }))
  }
  if (hasSynB) {
    synergyNotes.push(t('assign.pairSynergyNote', { name: teamBName || fallbackB, score: pairBInfo.synergyScore, games: pairBInfo.gamesCount }))
  }
  if (!hasSynA && !hasSynB) {
    const maxGames = Math.max(pairAInfo?.gamesCount || 0, pairBInfo?.gamesCount || 0)
    if (maxGames > 0) {
      synergyNotes.push(t('assign.synergyNeedMoreGames', { n: maxGames, min: 5 }))
    }
  }

  const matchupNote = hasMatchup
    ? t('assign.matchupAdvantageNote', {
        name: (matchupScore >= 50 ? teamAName : teamBName) || fallbackA,
        score: matchupScore,
        games: matchupGames,
      })
    : t('assign.matchupNotEnoughNote', { games: matchupGames })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3,8,17,.68)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="M2 Sheet diem can bang"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#141D2E',
          borderTop: '1px solid #2E3E5C',
          borderRadius: '16px 16px 0 0',
          padding: '10px 16px 22px',
          display: 'grid',
          gap: 13,
          boxShadow: '0 -8px 32px rgba(0,0,0,.60)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: '#2E3E5C',
            justifySelf: 'center',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ flex: 1, font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
            {t('assign.balanceScore')}
          </div>
          <div style={{ font: '700 32px/1 Barlow, sans-serif', color: '#E9EFF7' }}>
            {totalScore}
          </div>
        </div>

        {/* 6 chỉ số */}
        <div style={{ display: 'grid', gap: 10 }}>
          {/* 1. Cân rating */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span style={{ font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
              {t('assign.canRating')}
            </span>
            <span style={{ height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${canRating.score}%`, background: '#00B2A9', height: '100%' }} />
            </span>
            <span style={{ textAlign: 'right', font: '400 12.5px/1 "IBM Plex Mono", monospace', color: '#8494AA' }}>
              Δ{delta}
            </span>
          </div>

          {/* 2. Đổi partner */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span style={{ font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
              {t('assign.partnerVariety')}
            </span>
            <span style={{ height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${partner.score}%`, background: '#00B2A9', height: '100%' }} />
            </span>
            <span style={{ textAlign: 'right', font: '400 12.5px/1 "IBM Plex Mono", monospace', color: '#8494AA' }}>
              {partner.score}
            </span>
          </div>

          {/* 3. Đổi đối thủ */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span style={{ font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
              {t('assign.opponentVariety')}
            </span>
            <span style={{ height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${opponent.score}%`, background: '#00B2A9', height: '100%' }} />
            </span>
            <span style={{ textAlign: 'right', font: '400 12.5px/1 "IBM Plex Mono", monospace', color: '#8494AA' }}>
              {opponent.score}
            </span>
          </div>

          {/* 4. Đều lượt đánh */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span style={{ font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
              {t('assign.fairnessPlays')}
            </span>
            <span style={{ height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
              <span
                style={{
                  width: `${fairness.score}%`,
                  background: fairness.score < 80 ? '#E08A00' : '#00B2A9',
                  height: '100%',
                }}
              />
            </span>
            <span
              style={{
                textAlign: 'right',
                font: '400 12.5px/1 "IBM Plex Mono", monospace',
                color: fairness.score < 80 ? '#F0B75C' : '#8494AA',
              }}
            >
              {fairness.score}
            </span>
          </div>

          {/* Divider: MỚI không cộng vào điểm tổng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 2px' }}>
            <span
              style={{
                font: '600 9.5px/1 "IBM Plex Mono", monospace',
                padding: '4px 6px',
                borderRadius: 3,
                background: 'rgba(0,178,169,.18)',
                color: '#5FDBD3',
              }}
            >
              {t('assign.newBadge')}
            </span>
            <span style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
              {t('assign.notAddedToTotal')}
            </span>
            <span style={{ flex: 1, height: 1, background: '#22304A' }} />
          </div>

          {/* 5. Ăn ý cặp */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif',
                color: hasPairSynergy ? '#A8B7CB' : '#5B6B81',
              }}
            >
              {t('assign.pairChemistry')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <ConfidenceChip games={synConfGames} />
              {hasPairSynergy ? (
                <span style={{ flex: 1, height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${pairSynergyScore}%`, background: '#00B2A9', height: '100%' }} />
                </span>
              ) : (
                <span style={{ flex: 1, height: 5, borderRadius: 999, background: '#101927', border: '1px dashed #2E3E5C', display: 'flex' }} />
              )}
            </span>
            <span
              style={{
                textAlign: 'right',
                font: '400 12.5px/1 "IBM Plex Mono", monospace',
                color: hasPairSynergy ? '#8494AA' : '#5B6B81',
              }}
            >
              {hasPairSynergy ? pairSynergyScore : '—'}
            </span>
          </div>

          {/* 6. Khắc chế */}
          <div style={{ display: 'grid', gridTemplateColumns: '94px minmax(0,1fr) 34px', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                font: '400 13.5px/1.3 "IBM Plex Sans", sans-serif',
                color: hasMatchup ? '#A8B7CB' : '#5B6B81',
              }}
            >
              {t('assign.matchupEdge')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <ConfidenceChip games={matchupGames} />
              {hasMatchup ? (
                <span style={{ flex: 1, height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
                  <span style={{ width: `${matchupScore}%`, background: '#00B2A9', height: '100%' }} />
                </span>
              ) : (
                <span style={{ flex: 1, height: 5, borderRadius: 999, background: '#101927', border: '1px dashed #2E3E5C', display: 'flex' }} />
              )}
            </span>
            <span
              style={{
                textAlign: 'right',
                font: '400 12.5px/1 "IBM Plex Mono", monospace',
                color: hasMatchup ? '#8494AA' : '#5B6B81',
              }}
            >
              {hasMatchup ? matchupScore : '—'}
            </span>
          </div>
        </div>

        {/* Giải trình tự động */}
        <div style={{ borderTop: '1px solid #22304A', paddingTop: 12, display: 'grid', gap: 8 }}>
          <div style={{ font: '400 13.5px/1.55 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
            {t('assign.balanceNoteGeneral', { delta })}
          </div>
          <div style={{ font: '400 13.5px/1.55 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
            {[...synergyNotes, matchupNote].filter(Boolean).join(' ')}
          </div>
        </div>

        {/* 7. [NẾU LÀ TRẬN CHÉO GIỚI] KHỐI EFFECTIVE RATING (SO SÁNH 2 CÁCH TÍNH) */}
        {effectiveAnalysis && effectiveAnalysis.isCrossGender && (
          <div
            style={{
              display: 'grid',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 8,
              background: '#101927',
              border: '1px solid #00B2A9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: '#E9EFF7' }}>
                  {t('assign.twoWayBalance')}
                </div>
                <div style={{ font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA', marginTop: 2 }}>
                  {t('assign.twoWaySub')}
                </div>
              </div>
              <span
                style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(0,178,169,.18)',
                  color: '#5FDBD3',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.calibratedTag')}
              </span>
            </div>

            {/* 2 thanh so sánh: Rating thô vs Effective rating */}
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              {/* Rating thô */}
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                    {t('assign.rawRating')}
                  </span>
                  <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: '#A8B7CB' }}>
                    {ratingA} vs {ratingB} · {t('assign.skewDiff', { d: effectiveAnalysis.rawDelta })}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: '#22304A', display: 'flex' }}>
                  <div style={{ width: `${pctA}%`, height: '100%', background: '#3D5478' }} />
                  <div style={{ width: `${pctB}%`, height: '100%', background: '#1F2C42' }} />
                </div>
              </div>

              {/* Effective rating */}
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: '#5FDBD3' }}>
                    {t('assign.effectiveRating')}
                  </span>
                  <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: '#5FDBD3' }}>
                    {effectiveAnalysis.effA} vs {effectiveAnalysis.effB} · {t('assign.skewDiff', { d: effectiveAnalysis.effDelta })}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: '#22304A', display: 'flex' }}>
                  <div style={{ width: `${Math.round((effectiveAnalysis.effA / (effectiveAnalysis.effA + effectiveAnalysis.effB)) * 100)}%`, height: '100%', background: '#00B2A9' }} />
                  <div style={{ width: `${Math.round((effectiveAnalysis.effB / (effectiveAnalysis.effA + effectiveAnalysis.effB)) * 100)}%`, height: '100%', background: '#22304A' }} />
                </div>
              </div>
            </div>

            <div style={{ font: '400 12px/1.45 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
              {t('assign.effectiveDesc', { n: effectiveAnalysis.sampleMatches, pct: effectiveAnalysis.femaleWinRate })}
            </div>

            {/* Gợi ý xếp khác */}
            {effectiveAnalysis.suggestion && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: '#141D2E',
                  border: '1px solid #2E3E5C',
                  marginTop: 2,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: '#E9EFF7' }}>
                    {t('assign.swapAction', { p1: effectiveAnalysis.suggestion.p1Name, p2: effectiveAnalysis.suggestion.p2Name })}
                  </div>
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#5FDBD3', marginTop: 2 }}>
                    {t('assign.skewDiff', { d: effectiveAnalysis.suggestion.newDelta })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onApplySuggestion && onApplySuggestion(effectiveAnalysis.suggestion)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: '#00B2A9',
                    border: 'none',
                    font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
                    color: '#04302C',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {t('assign.swapNow')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Khối hướng dẫn Đọc thanh thế nào */}
        <div
          style={{
            display: 'grid',
            gap: 7,
            padding: '11px 12px',
            borderRadius: 6,
            background: '#101927',
            border: '1px solid #22304A',
          }}
        >
          <div
            style={{
              font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            {t('assign.howToReadBarsTitle')}
          </div>
          <div style={{ font: '400 12.5px/1.55 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
            {t('assign.howToReadBarsDesc', { min: 5, score: totalScore })}
          </div>
        </div>

        {/* Nút Đóng */}
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 56,
            borderRadius: 6,
            background: '#1D50A0',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '600 15px/1 "IBM Plex Sans", sans-serif',
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
