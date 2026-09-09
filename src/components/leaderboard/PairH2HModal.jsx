import { useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge } from '#lib/rating.js'

export default function PairH2HModal({
  pairA = [], // [id1, id2]
  pairB = [], // [id3, id4]
  matches = [],
  membersMap = {},
  ratingsMap = {},
  onClose,
}) {
  const nameOf = (id) => {
    const mem = membersMap[id]
    return mem?.name || (typeof id === 'object' ? id?.name : id) || ''
  }

  const namesA = pairA.map(nameOf).join(' · ')
  const namesB = pairB.map(nameOf).join(' · ')

  const matchup = useMemo(() => {
    if (!pairA?.length || !pairB?.length) return null
    return calcMatchupEdge(matches, pairA, pairB, ratingsMap)
  }, [pairA, pairB, matches, ratingsMap])

  if (!matchup) return null

  const {
    gamesCount,
    winsCount,
    actualWinPct,
    expectedWinPct,
    matchupImpact,
    advantageScore,
    confidence,
    firstMatchDate,
    avgScoreDiff,
    matches: h2hMatches = [],
  } = matchup

  const winsB = gamesCount - winsCount
  const winPctA = gamesCount > 0 ? actualWinPct : 50

  const firstDateStr = firstMatchDate
    ? new Date(firstMatchDate).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
    : '—'

  // 3 trận gần nhất (mới nhất xếp trước)
  const recent3 = [...h2hMatches].reverse().slice(0, 3)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(3, 8, 17, 0.72)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="P6 Sheet doi dau v1.1"
        style={{
          position: 'relative',
          background: '#141D2E',
          borderTop: '1px solid #2E3E5C',
          borderRadius: '16px 16px 0 0',
          padding: '10px 16px 24px',
          display: 'grid',
          gap: 12,
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: '#2E3E5C',
            justifySelf: 'center',
          }}
        />

        {/* Tiêu đề & Subtitle */}
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
            {namesA} vs {namesB}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('pairH2H.sheetSub', {
              matches: gamesCount,
              tier: confidence?.tier || 'R1',
              date: firstDateStr,
            })}
          </div>
        </div>

        {/* Card Tỉ số đối đầu */}
        <div
          style={{
            padding: 13,
            borderRadius: 10,
            background: '#101927',
            border: '1px solid #22304A',
            display: 'grid',
            gap: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <div style={{ font: '700 34px/1 Barlow, sans-serif', color: '#5FD9A2' }}>{winsCount}</div>
              <div style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('pairH2H.winsCount', { name: namesA })}
              </div>
            </div>
            <span style={{ font: "400 20px/1.5 'IBM Plex Mono', monospace", color: '#5B6B81' }}>–</span>
            <div>
              <div style={{ font: '700 34px/1 Barlow, sans-serif', color: '#FF9A8F' }}>{winsB}</div>
              <div style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('pairH2H.winsCount', { name: namesB })}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <span
              style={{
                font: "600 13px/1 'IBM Plex Mono', monospace",
                padding: '7px 9px',
                borderRadius: 999,
                background: 'rgba(18,168,103,.20)',
                color: '#5FD9A2',
              }}
            >
              {winPctA}%
            </span>
          </div>

          <span style={{ height: 8, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex' }}>
            <span style={{ width: `${winPctA}%`, background: '#12A867' }} />
            <span style={{ flex: 1, background: '#B33A2C' }} />
          </span>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                font: '700 20px/1 Barlow, sans-serif',
                color: matchupImpact >= 0 ? '#5FD9A2' : '#FF9A8F',
              }}
            >
              {matchupImpact >= 0 ? `+${matchupImpact}pp` : `${matchupImpact}pp`}
            </span>
            <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('pairH2H.vsExp', { exp: expectedWinPct })}
            </span>
          </div>
        </div>

        {/* Chênh điểm trung bình */}
        <div style={{ display: 'grid', gap: 7 }}>
          <div
            style={{
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            {t('pairH2H.avgDiffTitle')}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 12px',
              borderRadius: 6,
              background: '#101927',
              border: '1px solid #22304A',
            }}
          >
            <span style={{ flex: 1, font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('pairH2H.avgDiffWinLabel')}
            </span>
            <span style={{ font: "600 15px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
              {avgScoreDiff}
            </span>
          </div>
        </div>

        {/* 3 trận gần nhất */}
        <div style={{ display: 'grid', gap: 7 }}>
          <div
            style={{
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            {t('pairH2H.recent3Matches')}
          </div>
          {recent3.length > 0 ? (
            recent3.map((mItem, idx) => {
              const m = mItem.match || {}
              const dateStr = mItem.at
                ? new Date(mItem.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                : '—'
              const venue = m.venue || m.courtName || 'CLB'
              const scoreStr = (mItem.sets || []).map(([a, b]) => `${a}–${b}`).join(', ') || '—'

              return (
                <div
                  key={mItem.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 12px',
                    borderRadius: 6,
                    background: '#101927',
                    border: '1px solid #22304A',
                  }}
                >
                  <span
                    style={{
                      font: "600 11px/20px 'IBM Plex Mono', monospace",
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      background: mItem.won ? 'rgba(18,168,103,.24)' : 'rgba(225,68,52,.22)',
                      color: mItem.won ? '#5FD9A2' : '#FF9A8F',
                      textAlign: 'center',
                    }}
                  >
                    {mItem.won ? 'T' : 'B'}
                  </span>
                  <span style={{ flex: 1, font: "400 12.5px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {dateStr} · {venue}
                  </span>
                  <span style={{ font: "600 14px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                    {scoreStr}
                  </span>
                </div>
              )
            })
          ) : (
            <div style={{ padding: 10, textAlign: 'center', color: '#8494AA', fontSize: 12 }}>
              {t('pairH2H.noMatchHistory')}
            </div>
          )}
        </div>

        {/* Chú thích đáy P6 */}
        <div
          style={{
            padding: '11px 12px',
            borderRadius: 6,
            background: '#101927',
            border: '1px solid #22304A',
            font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif",
            color: '#A8B7CB',
          }}
        >
          {t('pairH2H.p6FooterNote', { score: advantageScore })}
        </div>
      </div>
    </div>
  )
}
