// Rank themes, tier titles, and playstyle badge definitions.
// Separated from vi.json into a dedicated game content configuration.

import rankData from './rankThemes.json' with { type: 'json' }

export const DEFAULT_RANK_THEME = 'street'

export const RANK_THEMES = rankData.themes

export const PLAYSTYLE_BADGES = rankData.playstyleBadges

/**
 * Lấy tên bậc rank theo theme và key bậc.
 * @param {string} themeKey
 * @param {string} tierKey
 * @returns {string}
 */
export function getTierName(themeKey = 'street', tierKey) {
  return rankData.tierNames?.[themeKey]?.[tierKey] || tierKey
}

/**
 * Lấy câu mô tả tấu hài cho bậc rank.
 * @param {string} tierKey
 * @returns {string}
 */
export function getComedyQuip(tierKey) {
  return rankData.comedyQuips?.[tierKey] || ''
}

/**
 * Deterministically retrieves a playstyle badge for a member.
 * Consistent across renders and sessions for the same member ID.
 * @param {string} memberId
 * @returns {Object}
 */
export function getMemberBadge(memberId) {
  if (!memberId) return PLAYSTYLE_BADGES[0]
  let hash = 0
  const str = String(memberId)
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PLAYSTYLE_BADGES.length
  return PLAYSTYLE_BADGES[idx]
}
