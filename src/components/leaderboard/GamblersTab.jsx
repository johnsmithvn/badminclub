import { useMemo } from 'react'
import { Avatar, Icon } from '#ds'
import { Empty } from '#ui'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'
import { gamblerBoard } from '#lib/challenge.js'
import { useTheme } from '#contexts/ThemeContext.jsx'
import cfg from '#config/app.json'
import { t } from '#i18n'

// Danh hiệu: icon, màu chữ (tối / sáng), chỉ số hiện trên thẻ. Thứ tự key = thứ tự thẻ trên màn hình.
const TITLES = {
  accuracy: { icon: 'sparkles', dark: '#C4B5FD', light: '#6D28D9', value: (r) => t('gamblers.accuracyValue', { rate: r.winRate, n: r.tickets }) },
  roi: { icon: 'trending-up', dark: '#5FDBD3', light: '#0F766E', value: (r) => t('gamblers.roiValue', { roi: r.roi, n: r.tickets }) },
  hotHand: { icon: 'zap', dark: '#F87171', light: '#B91C1C', value: (r) => t('gamblers.hotHandValue', { n: r.bestWinStreak }) },
  bigShot: { icon: 'target', dark: '#7DD3FC', light: '#0369A1', value: (r) => t('gamblers.bigShotValue', { n: r.biggestWin }) },
  staked: { icon: 'wallet', dark: '#F0D26A', light: '#B45309', value: (r) => t('gamblers.stakedValue', { n: r.staked }) },
  tickets: { icon: 'flame', dark: '#FDBA74', light: '#C2410C', value: (r) => t('gamblers.ticketsValue', { n: r.tickets }) },
  coldHand: { icon: 'trending-down', dark: '#CBD5E1', light: '#475569', value: (r) => t('gamblers.coldHandValue', { n: r.bestLoseStreak }) },
  donor: { icon: 'hand-coins', dark: '#F9A8D4', light: '#BE185D', value: (r) => t('gamblers.donorValue', { n: -r.net }) },
}
// Vạch trái cho top 3, cùng bộ màu với BXH mùa
const PLACE_BAR = { 1: 'linear-gradient(180deg,#F0D26A,#C9A227)', 2: 'linear-gradient(180deg,#C7D2E4,#8FA3BE)', 3: 'linear-gradient(180deg,#F5C09A,#A66A38)' }
const COLS = '46px minmax(0, 1fr) 96px 56px 64px 96px 70px 72px 88px'
const MONO = "'IBM Plex Mono', monospace"
const SANS = "'IBM Plex Sans', sans-serif"

const signed = (n) => (n > 0 ? `+${n}` : String(n))
const signColor = (n, isDark) => (n > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : n < 0 ? (isDark ? '#F87171' : '#DC2626') : 'var(--text-muted)')

/**
 * Thẻ số liệu tổng quan. KHÔNG dùng `StatCard` của DS: tone 'neutral' của nó tô số bằng
 * `--navy-700` cố định, sang chế độ tối là chữ navy trên nền navy — gần như không đọc được.
 */
function StatTile({ label, value, unit, icon, color, caption }) {
  return (
    <div style={{ minWidth: 0, display: 'grid', gap: 8, alignContent: 'start', padding: 14, borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ font: `600 11px/1.2 ${SANS}`, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        <Icon name={icon} size={17} style={{ color: color || 'var(--text-muted)', flexShrink: 0 }} />
      </div>
      <div style={{ font: "700 28px/1 'Barlow', sans-serif", color: color || 'var(--text-primary)', whiteSpace: 'nowrap' }}>
        {value}
        {unit && <span style={{ font: `600 12px/1 ${SANS}`, color: 'var(--text-muted)', marginLeft: 5 }}>{unit}</span>}
      </div>
      <span style={{ font: `400 12px/1.35 ${SANS}`, color: 'var(--text-muted)' }}>{caption}</span>
    </div>
  )
}

function TitleChip({ k, isDark, iconOnly }) {
  const st = TITLES[k]
  const fg = isDark ? st.dark : st.light
  return (
    <span
      title={t(`gamblers.${k}`)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap',
        padding: iconOnly ? 4 : '3px 7px', borderRadius: 999, font: `600 10.5px/1 ${SANS}`,
        color: fg, background: `${fg}1f`, border: `1px solid ${fg}55`,
      }}
    >
      <Icon name={st.icon} size={11} />
      {!iconOnly && t(`gamblers.${k}`)}
    </span>
  )
}

/** 5 phiếu gần nhất, cũ → mới. Ô trống khi chưa đủ 5 phiếu. */
function FormDots({ form, isDark }) {
  const slots = [...Array(5 - form.length).fill(null), ...form]
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {slots.map((f, i) => (
        <span
          key={i}
          style={{
            width: 9, height: 9, borderRadius: 999, flexShrink: 0,
            background: f === 'won' ? (isDark ? '#5FDBD3' : '#0D9488') : f === 'lost' ? (isDark ? '#F87171' : '#DC2626') : 'transparent',
            border: f ? 'none' : '1px solid var(--border-default)',
          }}
        />
      ))}
    </span>
  )
}

/** "Đang trúng 3 liền" / "Đang trượt 4 liền" — chỉ hiện khi chuỗi từ 2. */
function StreakChip({ streak, isDark }) {
  if (streak.n < 2) return null
  const fg = streak.won ? (isDark ? '#F87171' : '#B91C1C') : (isDark ? '#CBD5E1' : '#475569')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, font: `600 10.5px/1 ${SANS}`, color: fg, background: `${fg}1f`, border: `1px solid ${fg}55`, whiteSpace: 'nowrap' }}>
      <Icon name={streak.won ? 'flame' : 'trending-down'} size={11} />
      {t(streak.won ? 'gamblers.streakWon' : 'gamblers.streakLost', { n: streak.n })}
    </span>
  )
}

/** Thẻ bục vinh danh. #1 thẻ vàng có vương miện, #2 / #3 thẻ thường. */
function PodiumCard({ row, isDark, isMe }) {
  if (!row) return <div />
  const gold = row.rank === 1
  return (
    <div
      style={{
        minWidth: 0, display: 'grid', gap: 8, borderRadius: 10,
        padding: gold ? '18px 14px' : 14,
        background: gold
          ? (isDark ? 'linear-gradient(180deg, rgba(201,162,39,.18), var(--surface-card))' : 'linear-gradient(180deg, rgba(245,158,11,.14), var(--surface-card))')
          : 'var(--surface-card)',
        border: gold ? '1px solid #C9A227' : `1px solid ${isMe ? 'var(--teal-500)' : 'var(--border-default)'}`,
        boxShadow: gold ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <RankMedalIcon rank={row.rank} size={gold ? 30 : 26} />
        {gold && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: `600 10px/1 ${MONO}`, letterSpacing: '.06em', padding: '4px 7px', borderRadius: 999, background: '#C9A227', color: '#2A1F00' }}>
            <Icon name="crown" size={11} />
            {t('gamblers.king')}
          </span>
        )}
        <StreakChip streak={row.streak} isDark={isDark} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <Avatar name={row.name} src={row.avatarUrl} size={gold ? 36 : 30} />
        <span title={row.name} style={{ font: `600 ${gold ? 17 : 15}px/1.2 ${SANS}`, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </span>
      </div>
      <div style={{ font: `600 ${gold ? 32 : 26}px/1 ${MONO}`, color: signColor(row.net, isDark) }}>
        {signed(row.net)}
        <span style={{ font: `500 12px/1 ${SANS}`, color: 'var(--text-muted)', marginLeft: 6 }}>SP</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FormDots form={row.form} isDark={isDark} />
        <span style={{ font: `400 12px/1.3 ${MONO}`, color: 'var(--text-muted)' }}>
          {t('gamblers.podiumMeta', { tickets: row.tickets, wins: row.wins, losses: row.losses, roi: signed(row.roi) })}
        </span>
      </div>
      {row.titles.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {row.titles.map((k) => <TitleChip key={k} k={k} isDark={isDark} />)}
        </div>
      )}
    </div>
  )
}

/** BXH "Sòng bạc" — chỉ người đã cược trong mùa, xếp theo lãi ròng, kèm danh hiệu và xu hướng. */
export default function GamblersTab({ seasonRes, isMobile, myId }) {
  const { isDark } = useTheme()
  const minTickets = cfg.challenge?.gamblerMinTickets ?? 5
  const rows = useMemo(() => gamblerBoard(seasonRes, minTickets), [seasonRes, minTickets])

  if (rows.length === 0) {
    return <Empty icon="hand-coins" title={t('gamblers.empty')} hint={t('gamblers.emptyHint')} />
  }

  const [top1, top2, top3] = rows
  const holderOf = (k) => rows.find((r) => r.titles.includes(k)) || null
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0)
  const totalTickets = sum((r) => r.tickets)
  const totalWins = sum((r) => r.wins)
  const totalStaked = sum((r) => r.staked)
  const totalNet = sum((r) => r.net)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <span style={{ font: "600 16px/1.2 'Barlow', sans-serif", color: 'var(--text-primary)' }}>
        {t('gamblers.title', { season: seasonRes?.season?.name || '' })}
      </span>

      {/* Tổng quan cả sòng */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
        <StatTile label={t('gamblers.statPlayers')} value={rows.length} icon="users"
          caption={t('gamblers.statPlayersCaption', { n: totalTickets })} />
        <StatTile label={t('gamblers.statHitRate')} value={`${Math.round((totalWins / totalTickets) * 100)}%`} icon="target"
          color={isDark ? '#5FDBD3' : '#0D9488'}
          caption={t('gamblers.statHitRateCaption', { wins: totalWins, losses: totalTickets - totalWins })} />
        <StatTile label={t('gamblers.statStaked')} value={totalStaked} unit="SP" icon="wallet"
          color={isDark ? '#F0D26A' : '#B45309'}
          caption={t('gamblers.statStakedCaption', { n: Math.round(totalStaked / totalTickets) })} />
        <StatTile label={t('gamblers.statNet')} value={signed(totalNet)} unit="SP"
          icon={totalNet >= 0 ? 'trending-up' : 'trending-down'} color={signColor(totalNet, isDark)}
          caption={t(totalNet >= 0 ? 'gamblers.statNetUp' : 'gamblers.statNetDown')} />
      </div>

      {/* Bục top 3 */}
      {isMobile ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <PodiumCard row={top1} isDark={isDark} isMe={top1.id === myId} />
          {top2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <PodiumCard row={top2} isDark={isDark} isMe={top2.id === myId} />
              <PodiumCard row={top3} isDark={isDark} isMe={top3?.id === myId} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
          <PodiumCard row={top2} isDark={isDark} isMe={top2?.id === myId} />
          <PodiumCard row={top1} isDark={isDark} isMe={top1.id === myId} />
          <PodiumCard row={top3} isDark={isDark} isMe={top3?.id === myId} />
        </div>
      )}

      {/* Danh hiệu mùa */}
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ font: `600 12px/1.2 ${SANS}`, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {t('gamblers.titlesHeading')}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {Object.keys(TITLES).map((k) => {
            const holder = holderOf(k)
            const fg = isDark ? TITLES[k].dark : TITLES[k].light
            return (
              <div key={k} style={{ minWidth: 0, display: 'grid', gap: 7, alignContent: 'start', padding: 12, borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${fg}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 13px/1.2 ${SANS}`, color: fg }}>
                  <Icon name={TITLES[k].icon} size={14} />
                  {t(`gamblers.${k}`)}
                </span>
                <span style={{ font: `400 11.5px/1.35 ${SANS}`, color: 'var(--text-muted)' }}>
                  {t(`gamblers.${k}Desc`, { n: minTickets, streak: cfg.challenge?.gamblerMinStreak ?? 3 })}
                </span>
                {holder ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={holder.name} src={holder.avatarUrl} size={26} />
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <span title={holder.name} style={{ font: `600 13px/1.2 ${SANS}`, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {holder.name}
                      </span>
                      <span style={{ font: `500 11.5px/1.2 ${MONO}`, color: 'var(--text-secondary)' }}>{TITLES[k].value(holder)}</span>
                    </div>
                  </div>
                ) : (
                  <span style={{ font: `400 12px/1.3 ${SANS}`, color: 'var(--text-muted)' }}>{t('gamblers.titleVacant')}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bảng đầy đủ */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '8px 13px', borderBottom: '1px solid var(--border-subtle)', font: `600 11px/1.2 ${SANS}`, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <span>#</span>
            <span>{t('gamblers.colPlayer')}</span>
            <span>Form</span>
            <span style={{ textAlign: 'right' }}>{t('gamblers.colTickets')}</span>
            <span style={{ textAlign: 'right' }}>W-L</span>
            <span style={{ textAlign: 'right' }}>Win Rate</span>
            <span style={{ textAlign: 'right' }}>ROI</span>
            <span style={{ textAlign: 'right' }}>{t('gamblers.colStaked')}</span>
            <span style={{ textAlign: 'right' }}>{t('gamblers.colNet')}</span>
          </div>
        )}
        {rows.map((r) => {
          const isMe = r.id === myId
          return (
            <div
              key={r.id}
              style={{
                position: 'relative', minWidth: 0, alignItems: 'center', gap: isMobile ? 10 : 0,
                display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : COLS,
                padding: isMobile ? '10px 12px' : '9px 13px',
                borderBottom: '1px solid var(--border-subtle)',
                background: isMe ? 'var(--surface-accent-soft)' : 'transparent',
                font: `400 13px/1.3 ${SANS}`,
              }}
            >
              {PLACE_BAR[r.rank] && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: PLACE_BAR[r.rank] }} />}
              <RankMedalIcon rank={r.rank} size={28} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: isMobile ? '1 1 0%' : undefined }}>
                <Avatar name={r.name} src={r.avatarUrl} size={isMobile ? 30 : 24} />
                <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span title={r.name} style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    {r.titles.map((k) => <TitleChip key={k} k={k} isDark={isDark} iconOnly />)}
                  </span>
                  {isMobile && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <FormDots form={r.form} isDark={isDark} />
                      <span style={{ font: `400 11.5px/1.2 ${MONO}`, color: 'var(--text-muted)' }}>
                        {t('gamblers.rowMetaMobile', { tickets: r.tickets, wins: r.wins, losses: r.losses, roi: signed(r.roi) })}
                      </span>
                    </span>
                  )}
                </span>
              </span>
              {!isMobile && (
                <>
                  <span title={r.streak.n >= 2 ? t(r.streak.won ? 'gamblers.streakWon' : 'gamblers.streakLost', { n: r.streak.n }) : undefined}>
                    <FormDots form={r.form} isDark={isDark} />
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: MONO, color: 'var(--text-secondary)' }}>{r.tickets}</span>
                  <span style={{ textAlign: 'right', fontFamily: MONO, color: 'var(--text-secondary)' }}>{r.wins}–{r.losses}</span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <span style={{ width: 34, height: 5, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${r.winRate}%`, background: 'var(--teal-500)' }} />
                    </span>
                    <span style={{ fontFamily: MONO, color: 'var(--text-secondary)', minWidth: 34, textAlign: 'right' }}>{r.winRate}%</span>
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: MONO, color: signColor(r.roi, isDark) }}>{signed(r.roi)}%</span>
                  <span style={{ textAlign: 'right', fontFamily: MONO, color: 'var(--text-secondary)' }}>{r.staked}</span>
                </>
              )}
              <span style={{ textAlign: 'right', fontFamily: MONO, fontWeight: 700, fontSize: isMobile ? 15 : 13, color: signColor(r.net, isDark), flexShrink: 0 }}>
                {signed(r.net)}
              </span>
            </div>
          )
        })}
      </div>

      <span style={{ font: `400 11.5px/1.45 ${SANS}`, color: 'var(--text-muted)' }}>{t('gamblers.footnote')}</span>
    </div>
  )
}
