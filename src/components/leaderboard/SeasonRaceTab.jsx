import { Avatar } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'

export default function SeasonRaceTab({
  seasonLeaderboardData,
  onOpenLedger,
  isMobile = false,
}) {
  const { isDark } = useTheme()

  if (!seasonLeaderboardData) return null

  const { season, leaderboard = [], topStats = {} } = seasonLeaderboardData
  const top1 = leaderboard[0] || null
  const top2 = leaderboard[1] || null
  const top3 = leaderboard[2] || null

  const totalSessionsExpected = season?.totalSessionsExpected || 14
  const playedSessions = topStats.playedSessionsCount || 11
  const progressPct = Math.min(100, Math.round((playedSessions / totalSessionsExpected) * 100)) || 74
  const remainingSessions = Math.max(0, totalSessionsExpected - playedSessions)
  const maxPossiblePts = remainingSessions * 3 * 22

  return (
    <div
      data-screen-label="SS1 Dua top mua giai"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 356px',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* CỘT TRÁI (BẢNG ĐUA TOP & TIẾN TRÌNH) */}
      <div style={{ display: 'grid', gap: 12 }}>
        {/* 1. Tiến trình mùa */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '13px 15px',
            display: 'grid',
            gap: 10,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.progressTitle')}
            </span>
            <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
              {t('season.sessionProgress', { n: playedSessions, total: totalSessionsExpected, pct: progressPct })}
            </span>
            <div style={{ flex: '1 1 0%' }} />
            <span
              style={{
                font: "600 11px/1 'IBM Plex Mono', monospace",
                padding: '5px 8px',
                borderRadius: 999,
                background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                border: '1px solid var(--teal-500)',
                color: isDark ? '#5FDBD3' : 'var(--teal-700)',
              }}
            >
              {t('season.running')}
            </span>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #00786F, #00B2A9)',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: "400 11px/1.2 'IBM Plex Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            <span>{season?.startDate?.slice(5) || '01/07'}</span>
            <span>{t('season.remainingSessionDesc', { n: remainingSessions, pts: maxPossiblePts || 190 })}</span>
            <span>{season?.endDate?.slice(5) || '30/09'}</span>
          </div>
        </div>

        {/* 2. Podium Top 3 */}
        {leaderboard.length >= 3 && (
          isMobile ? (
            /* Mobile Podium: Card #1 to ở trên, #2 và #3 chia 2 cột ở dưới */
            <div style={{ display: 'grid', gap: 10 }}>
              {/* #1 Dẫn Đầu (Gold Card) */}
              <div
                onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(201,162,39,.18), var(--surface-card))'
                    : 'linear-gradient(180deg, rgba(245,158,11,.14), var(--surface-card))',
                  border: '1px solid #C9A227',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309' }}>#1</div>
                  <span
                    style={{
                      font: "600 10px/1 'IBM Plex Mono', monospace",
                      letterSpacing: '.06em',
                      padding: '4px 7px',
                      borderRadius: 999,
                      background: '#C9A227',
                      color: '#2A1F00',
                    }}
                  >
                    {t('season.leaderBadge')}
                  </span>
                  <div style={{ flex: 1 }} />
                  {top1?.streak > 0 && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '4px 7px',
                        borderRadius: 999,
                        background: 'rgba(0,178,169,.14)',
                        border: '1px solid #00786F',
                        color: '#5FDBD3',
                      }}
                    >
                      streak {top1.streak}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={34} />
                    <span style={{ font: "600 17px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top1?.name}
                    </span>
                  </div>
                  <span style={{ font: "600 32px/1 'IBM Plex Mono', monospace", color: isDark ? '#F7E3A1' : '#B45309' }}>
                    {top1?.totalSeasonPoints?.toLocaleString()}
                  </span>
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#C6B683' : '#92400E' }}>
                  {top1?.matchesCount} {t('units.match')} · {top1?.winsCount}W–{top1?.lossesCount}L · {top1?.winRate}% · {top1?.upsetsCount} upset
                </div>
              </div>

              {/* #2 Á Quân & #3 Quý Quân chia 2 cột */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div
                  onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                  title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#2</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={26} />
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top2?.name}
                    </div>
                  </div>
                  <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                    {top2?.totalSeasonPoints?.toLocaleString()}
                  </div>
                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {top2?.matchesCount} {t('units.match')} · {top2?.winsCount}W–{top2?.lossesCount}L · {top2?.winRate}%
                  </div>
                </div>

                <div
                  onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                  title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#3</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={26} />
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top3?.name}
                    </div>
                  </div>
                  <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                    {top3?.totalSeasonPoints?.toLocaleString()}
                  </div>
                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {top3?.matchesCount} {t('units.match')} · {top3?.winsCount}W–{top3?.lossesCount}L · {top3?.winRate}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Podium: 3 cột ngang */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
                alignItems: 'end',
              }}
            >
              {/* #2 Á Quân */}
              <div
                onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#2</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={30} />
                  <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top2?.name}
                  </div>
                </div>
                <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  {top2?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {top2?.matchesCount} {t('units.match')} · {top2?.winsCount}W–{top2?.lossesCount}L · {top2?.winRate}%
                </div>
              </div>

              {/* #1 Dẫn Đầu (Gold Card) */}
              <div
                onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(201,162,39,.18), var(--surface-card))'
                    : 'linear-gradient(180deg, rgba(245,158,11,.14), var(--surface-card))',
                  border: '1px solid #C9A227',
                  borderRadius: 10,
                  padding: '18px 14px',
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309' }}>#1</div>
                  <span
                    style={{
                      font: "600 10px/1 'IBM Plex Mono', monospace",
                      letterSpacing: '.06em',
                      padding: '4px 7px',
                      borderRadius: 999,
                      background: '#C9A227',
                      color: '#2A1F00',
                    }}
                  >
                    {t('season.leaderBadge')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={36} />
                  <div style={{ font: "600 17px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top1?.name}
                  </div>
                </div>
                <div style={{ font: "600 32px/1 'IBM Plex Mono', monospace", color: isDark ? '#F7E3A1' : '#B45309' }}>
                  {top1?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#C6B683' : '#92400E' }}>
                  {top1?.matchesCount} {t('units.match')} · {top1?.winsCount}W–{top1?.lossesCount}L · {top1?.winRate}% · {top1?.upsetsCount} upset
                </div>
              </div>

              {/* #3 Quý Quân */}
              <div
                onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#3</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={30} />
                  <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top3?.name}
                  </div>
                </div>
                <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  {top3?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {top3?.matchesCount} {t('units.match')} · {top3?.winsCount}W–{top3?.lossesCount}L · {top3?.winRate}%
                </div>
              </div>
            </div>
          )
        )}

        {/* 3. Bảng Xếp Hạng Toàn Bộ */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div
            style={{
              padding: '10px 13px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.tableTotal', { total: leaderboard.length, count: leaderboard.length, n: leaderboard.length })}
            </span>
            {isMobile ? (
              <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                {t('season.legendFormulaShort')}
              </span>
            ) : (
              <span
                style={{
                  font: "600 11px/1 'IBM Plex Sans', sans-serif",
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: isDark ? 'rgba(29,80,160,.20)' : 'rgba(29,80,160,.10)',
                  border: '1px solid #1D50A0',
                  color: isDark ? '#B6CDEC' : '#1D50A0',
                }}
              >
                {t('season.columnsLegend')}
              </span>
            )}
          </div>

          {!isMobile && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px',
                padding: '8px 13px',
                borderBottom: '1px solid var(--border-subtle)',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              <span>#</span>
              <span>{t('season.colMember')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colPoints')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colRecord')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colMatches')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colWinRate')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colUpset')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colTrend')}</span>
            </div>
          )}

          {leaderboard.map((row) => {
            const isRank1 = row.rank === 1
            const isRank2 = row.rank === 2
            const isRank3 = row.rank === 3
            const rankColor = isRank1
              ? '#D97706'
              : isRank2 || isRank3
                ? (isDark ? '#A8B7CB' : 'var(--text-secondary)')
                : 'var(--text-muted)'

            if (isMobile) {
              return (
                <div
                  key={row.id}
                  onClick={() => onOpenLedger && onOpenLedger(row.id)}
                  title={`${t('season.viewLedgerBtn')}: ${row.name}`}
                  style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Dòng 1: Hạng + Avatar + Tên + Điểm mùa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 20, font: "600 13px/1 'IBM Plex Mono', monospace", color: rankColor }}>
                      {row.rank}
                    </span>
                    <Avatar name={row.name} src={row.avatarUrl || row.avatar} size={22} />
                    <span style={{ flex: '1 1 0%', minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.name}
                    </span>
                    <span
                      style={{
                        font: "600 15px/1 'IBM Plex Mono', monospace",
                        color: isRank1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                      }}
                    >
                      {row.totalSeasonPoints.toLocaleString()}
                    </span>
                  </div>

                  {/* Dòng 2: W-L, Win Rate, Upset, Badges */}
                  <div style={{ paddingLeft: 29, display: 'flex', alignItems: 'center', gap: 8, font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>
                      {row.winsCount}W–{row.lossesCount}L · {row.matchesCount} {t('units.match')} · {row.winRate}%
                    </span>
                    {row.upsetsCount > 0 && (
                      <span style={{ color: isDark ? '#F0D26A' : '#B45309', fontWeight: 600 }}>
                        {row.upsetsCount} upset
                      </span>
                    )}
                    {row.streak >= 3 && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                          border: '1px solid var(--teal-500)',
                          color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                        }}
                      >
                        streak {row.streak}
                      </span>
                    )}
                    {row.isInactive && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {t('season.inactiveBadge')}
                      </span>
                    )}
                    {!row.isQualified && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.10)',
                          border: '1px solid #D97706',
                          color: isDark ? '#FCD34D' : '#B45309',
                        }}
                      >
                        {row.matchesCount}/20
                      </span>
                    )}
                    {isRank1 && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(201,162,39,.16)' : 'rgba(245,158,11,.14)',
                          border: '1px solid #C9A227',
                          color: isDark ? '#F0D26A' : '#B45309',
                        }}
                      >
                        Top 1
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={row.id}
                onClick={() => onOpenLedger && onOpenLedger(row.id)}
                title={`${t('season.viewLedgerBtn')}: ${row.name}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px',
                  alignItems: 'center',
                  padding: '9px 13px',
                  borderBottom: '1px solid var(--border-subtle)',
                  font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Hạng */}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: rankColor, fontWeight: 600 }}>
                  {row.rank}
                </span>

                {/* Thành viên + Badges */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={row.name} src={row.avatarUrl || row.avatar} size={24} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </span>
                  {row.streak >= 3 && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                        border: '1px solid var(--teal-500)',
                        color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                      }}
                    >
                      streak {row.streak}
                    </span>
                  )}
                  {row.isInactive && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t('season.inactiveBadge')}
                    </span>
                  )}
                  {!row.isQualified && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.10)',
                        border: '1px solid #D97706',
                        color: isDark ? '#FCD34D' : '#B45309',
                      }}
                    >
                      {row.matchesCount}/20
                    </span>
                  )}
                </span>

                {/* Điểm mùa */}
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    color: isRank1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                  }}
                >
                  {row.totalSeasonPoints.toLocaleString()}
                </span>

                {/* W-L */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.winsCount}–{row.lossesCount}
                </span>

                {/* Số trận */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.matchesCount}
                </span>

                {/* Win Rate */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.winRate}%
                </span>

                {/* Điểm Upset */}
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: row.upsetsCount > 0 ? (isDark ? '#F0D26A' : '#B45309') : 'var(--text-muted)',
                    fontWeight: row.upsetsCount > 0 ? 600 : 400,
                  }}
                >
                  {row.upsetsCount}
                </span>

                {/* Xu hướng Sparkline SVG */}
                <span
                  style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
                  title={t('season.viewLedgerBtn')}
                >
                  <svg width="70" height="20" viewBox="0 0 70 20">
                    <polyline
                      points={
                        row.streak >= 2 || (row.winRate >= 50 && row.rank <= 5)
                          ? `0,${16 - (row.rank % 3)} 12,${14 - (row.rank % 3)} 24,${11 - (row.rank % 2)} 36,${12 - (row.rank % 3)} 48,${7 - (row.rank % 2)} 60,${4 - (row.rank % 2)} 70,2`
                          : `0,${10 + (row.rank % 3)} 12,${9 + (row.rank % 2)} 24,${11 + (row.rank % 3)} 36,10 48,12 60,11 70,13`
                      }
                      fill="none"
                      stroke={row.streak >= 2 || (row.winRate >= 50 && row.rank <= 5) ? '#00B2A9' : 'var(--text-muted)'}
                      strokeWidth="2"
                    />
                  </svg>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CỘT PHẢI (SẮP TRAO, ĐIỂM ĐẾN TỪ ĐÂU, MINI CHART) */}
      <div style={{ display: 'grid', gap: 12 }}>
        {/* 1. Bảng 5 dải điểm Elo (+14 / -8) */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '13px 15px',
            display: 'grid',
            gap: 11,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            {t('season.scaleTableTitle')}
          </div>
          <div style={{ display: 'grid', gap: 6, font: "400 12px/1.3 'IBM Plex Sans', sans-serif" }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, font: "600 11px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <span>{t('season.tierCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.winDeltaCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.lossDeltaCol')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierHeavyFavored')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+10</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-12</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierFavored')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+12</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-10</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-primary)', fontWeight: 600, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', padding: '2px 4px', borderRadius: 4 }}>
              <span>{t('season.tierBalanced')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 700 }}>+14</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-8</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierUnderdog')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+17</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-5</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierDeepUnderdog')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+22</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-3</span>
            </div>
          </div>
          <div style={{ font: "400 11px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 9, display: 'grid', gap: 3 }}>
            <div>• {t('season.ruleFloorZero')}</div>
            <div>• {t('season.ruleStreakMilestone')}</div>
            <div>• {t('season.ruleUpsetMilestone')}</div>
            <div>• {t('season.ruleMinMatches')}</div>
            <div>• {t('season.ruleInactive21Days')}</div>
          </div>
        </div>

        {/* 2. Đua top 3 qua từng buổi (Mini SVG Chart) */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '13px 15px',
            display: 'grid',
            gap: 10,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            {t('season.top3RaceTitle')}
          </div>
          <svg width="326" height="130" viewBox="0 0 326 130" style={{ width: '100%', overflow: 'visible' }}>
            <line x1="0" y1="34" x2="326" y2="34" stroke="var(--border-subtle)" strokeWidth="1" />
            <line x1="0" y1="70" x2="326" y2="70" stroke="var(--border-subtle)" strokeWidth="1" />
            <line x1="0" y1="106" x2="326" y2="106" stroke="var(--border-subtle)" strokeWidth="1" />
            <polyline points="8,106 60,70 112,70 164,34 216,34 268,34 318,34" fill="none" stroke="#F0D26A" strokeWidth="2.5" />
            <polyline points="8,34 60,34 112,34 164,70 216,70 268,70 318,70" fill="none" stroke="#7AA3DC" strokeWidth="2.5" />
            <polyline points="8,70 60,106 112,106 164,106 216,106 268,106 318,106" fill="none" stroke="#00B2A9" strokeWidth="2.5" />
            <text x="0" y="128" fill="var(--text-muted)" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 5 })}</text>
            <text x="278" y="128" fill="var(--text-muted)" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 11 })}</text>
          </svg>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', font: "400 11px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#F0D26A' }} />
              {top1?.name?.split(' ').pop() || 'Top 1'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#7AA3DC' }} />
              {top2?.name?.split(' ').pop() || 'Top 2'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#00B2A9' }} />
              {top3?.name?.split(' ').pop() || 'Top 3'}
            </span>
          </div>
          <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 9 }}>
            {t('season.leadSurgeDesc', { name: top1?.name || 'Top 1', chaser: top2?.name || 'Top 2' })}
          </div>
        </div>

        {/* 3. Sắp trao mùa này */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '13px 15px',
            display: 'grid',
            gap: 9,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            {t('season.awardsUpcomingTitle')}
          </div>
          <div style={{ display: 'grid', gap: 7, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardPointsKing')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {top1?.name} · {top1?.totalSeasonPoints}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardMostDiligent')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {topStats.mostAttendedPlayer?.name} · {topStats.mostAttendedPlayer?.attendedCount}/{playedSessions}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardUpsetHunter')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {topStats.mostUpsetsPlayer?.name} · {topStats.mostUpsetsPlayer?.upsetsCount} {t('units.times')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
