// Rank themes and playstyle badges configuration and utilities.
// All user-facing strings are localized via i18n keys (RULES §3.1).

export const DEFAULT_RANK_THEME = 'street'

export const RANK_THEMES = [
  { key: 'street', labelKey: 'rankThemes.themeStreet', icon: 'zap' },
  { key: 'comedy', labelKey: 'rankThemes.themeComedy', icon: 'sparkles' },
  { key: 'destroyer', labelKey: 'rankThemes.themeDestroyer', icon: 'flame' },
  { key: 'slang', labelKey: 'rankThemes.themeSlang', icon: 'award' },
]

export const PLAYSTYLE_BADGES = [
  { key: 'vo_hut', icon: 'zap', color: '#FACC15', emoji: '🦅' },
  { key: 'boi_tham', icon: 'shield', color: '#38BDF8', emoji: '🏊' },
  { key: 'he_chua', icon: 'sparkles', color: '#EC4899', emoji: '🤡' },
  { key: 'cai_cau', icon: 'flame', color: '#F43F5E', emoji: '⚖️' },
  { key: 'doi_vot', icon: 'award', color: '#A855F7', emoji: '🏸' },
  { key: 'khoi_dong', icon: 'play', color: '#FB923C', emoji: '🧘' },
  { key: 'chia_san', icon: 'medal', color: '#10B981', emoji: '🤝' },
  { key: 'be_tong', icon: 'shield', color: '#94A3B8', emoji: '🧱' },
  { key: 'nguoc_dong', icon: 'crown', color: '#34D399', emoji: '🔄' },
  { key: 'ban_chim', icon: 'trophy', color: '#E11D48', emoji: '🎯' },
]

/**
 * Deterministically retrieves a playstyle badge for a member.
 * Consistent across renders and sessions for the same member ID.
 * @param {string} memberId
 * @returns {Object}
 */
export function getMemberBadge(memberId) {
  if (!memberId) {
    const defaultBadge = PLAYSTYLE_BADGES[0]
    return {
      ...defaultBadge,
      nameKey: `playstyleBadges.${defaultBadge.key}.name`,
      descKey: `playstyleBadges.${defaultBadge.key}.desc`,
    }
  }
  let hash = 0
  const str = String(memberId)
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PLAYSTYLE_BADGES.length
  const badge = PLAYSTYLE_BADGES[idx]
  return {
    ...badge,
    nameKey: `playstyleBadges.${badge.key}.name`,
    descKey: `playstyleBadges.${badge.key}.desc`,
  }
}
