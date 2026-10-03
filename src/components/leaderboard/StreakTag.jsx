import { Icon } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import cfgBadges from '#config/badges.js'

// Ngưỡng và phần thưởng treo thưởng lấy đúng nguồn với getActiveBounties (lib/badges.js) —
// tag ghi số nào thì bảng truy nã trả đúng số đó.
const BOUNTY = cfgBadges.bounty || {}
const BOUNTY_MIN = BOUNTY.minStreakSingle ?? 5
const HOT_STREAK = BOUNTY.hotStreak ?? 6
const REWARD_HOT = BOUNTY.rewardHot ?? { xp: 100, seasonPts: 15 }
const REWARD_NORMAL = BOUNTY.rewardNormal ?? { xp: 80, seasonPts: 12 }
// Mốc chuỗi đầu tiên có thưởng điểm mùa (season.bonusConfig.streak3).
const STREAK_MIN = 3

/**
 * Tag chuỗi thắng trên BXH — dùng chung cho tab Đua mùa và Elo (phương án C, 2026-10-03).
 * - 3 → dưới mốc treo thưởng: lửa + "chuỗi N", viền cam.
 * - Từ mốc treo thưởng: lệnh truy nã kiểu áp phích, ghi luôn XP treo thưởng. Nền giấy chữ nâu
 *   đặc — bản cũ chữ hồng trên nền hồng + phát sáng, gần như không đọc được.
 *
 * `onDark`: tag nằm trên nền tối cố định (thẻ mobile, bục podium); bỏ trống thì theo theme.
 * `compact`: chỗ hẹp (thẻ top 2/3 mobile) — bỏ phần XP, câu đầy đủ nằm ở title.
 */
export default function StreakTag({ streak = 0, onDark, compact = false }) {
  const { isDark } = useTheme()
  if (streak < STREAK_MIN) return null
  const dark = onDark ?? isDark

  if (streak >= BOUNTY_MIN) {
    const reward = streak >= HOT_STREAK ? REWARD_HOT : REWARD_NORMAL
    return (
      <span
        title={t('badges.bountyPosterTitle', { n: streak, xp: reward.xp, pts: reward.seasonPts })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          padding: compact ? '2px 5px' : '3px 7px',
          borderRadius: 4,
          background: '#F3E2B8',
          border: '1px dashed #8A5A1E',
          color: '#4A2E0C',
          font: `700 ${compact ? 9.5 : 10.5}px/1 'Oswald', sans-serif`,
          letterSpacing: '.04em',
          whiteSpace: 'nowrap',
          transform: 'rotate(-2deg)',
        }}
      >
        {compact
          ? t('badges.bountyPosterShort', { n: streak })
          : t('badges.bountyPosterTag', { n: streak, xp: reward.xp })}
      </span>
    )
  }

  return (
    <span
      title={t('badges.streakTagTitle', { n: streak })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
        padding: compact ? '2px 5px' : '3px 7px',
        borderRadius: 999,
        background: dark ? 'rgba(240,138,36,.16)' : '#FFF1E0',
        border: `1px solid ${dark ? '#B5651D' : '#F0B47A'}`,
        color: dark ? '#FFB36B' : '#9A4A00',
        font: `600 ${compact ? 9.5 : 10.5}px/1 'IBM Plex Sans', sans-serif`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name="flame" size={compact ? 10 : 11} />
      {t('badges.streakTag', { n: streak })}
    </span>
  )
}
