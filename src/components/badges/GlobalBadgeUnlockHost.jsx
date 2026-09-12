import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import { calculateMemberBadges, computeClubBadgeStats, TIER_ORDER } from '#lib/badges.js'
import { resolveSeason, seasonMatchesOf } from '#lib/season.js'
import cfgBadges from '#config/badges.json' with { type: 'json' }
import BadgeUnlockModal from './BadgeUnlockModal.jsx'

/** Số ô kệ trưng bày — cùng nguồn với trang Danh hiệu, không hard-code (RULES §3.2). */
const SHELF_SLOTS = cfgBadges.shelfSlots ?? 3

/**
 * GlobalBadgeUnlockHost: Listener mở khóa danh hiệu toàn cục.
 * - CHỈ kích hoạt cho chính người nhận được danh hiệu (myMember).
 * - Bất kể khi nào có điểm trận đấu được nhập mà người chơi chưa online/chưa đăng nhập,
 *   thì ở lần online/đăng nhập tiếp theo khi người đó mở app (ở bất kỳ màn nào),
 *   modal mở khóa phong cách Anime sẽ tự động bung lên chúc mừng!
 */
export default function GlobalBadgeUnlockHost() {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const [pendingBadges, setPendingBadges] = useState([])

  // 1. Nhận diện thành viên của tài khoản đang đăng nhập
  const me = useMemo(() => {
    if (!db) return null
    return myMember(db)
  }, [db])

  // 2. Tính toán danh sách danh hiệu đã mở khóa của chính chủ.
  // Phải truyền ĐÚNG bộ tham số như trang Danh hiệu (`pages/Badges.jsx`). Gọi trần thì đây
  // là nguồn sự thật thứ hai: hễ lệch là modal "chúc mừng mở khoá" bắn cho danh hiệu mà
  // trang Danh hiệu không công nhận.
  // CHỈ danh hiệu chính thức: 10 danh hiệu `fun` (Tự phong) tự mở cho MỌI người, nên nếu lấy
  // `unlocked` thì thêm một badge fun vào catalog là cả CLB bị bắn modal cho thứ không ai
  // giành được. Sắp theo bậc để `[0]` đúng nghĩa "cao nhất" — `calculateMemberBadges` push
  // theo thứ tự catalog, không sắp sẵn.
  const unlockedBadges = useMemo(() => {
    if (!me?.id || !db) return []
    const season = resolveSeason(db)
    const seasonMatches = seasonMatchesOf(db, season) || []
    const clubStats = computeClubBadgeStats(db, season, seasonMatches)
    const res = calculateMemberBadges(me.id, db, season, seasonMatches, clubStats)
    return (res?.officialUnlocked || []).slice().sort(
      (x, y) => (TIER_ORDER[y.tier] || 0) - (TIER_ORDER[x.tier] || 0),
    )
  }, [me, db])

  // Key lưu trữ danh hiệu đã xem theo từng CLB và từng thành viên
  const storageKey = useMemo(() => {
    if (!me?.id) return null
    const clubId = db?.clubId || db?.id || 'default'
    return `badminclub_seen_badges_${clubId}_${me.id}`
  }, [me?.id, db?.clubId, db?.id])

  // 3. Quét danh hiệu mới mở khóa (unseen badges)
  useEffect(() => {
    if (!storageKey || !me?.id || unlockedBadges.length === 0) return

    let seenIds = []
    let hasStoredRecord = false

    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        // Phải là mảng mới dùng được. Giá trị lạ (đổi format, người dùng nghịch, app khác
        // cùng origin) mà lọt xuống dưới thì `seenIds.includes` ném TypeError — và component
        // này mount TOÀN APP, nên lỗi đó trắng màn ở mọi trang chứ không riêng trang Danh hiệu.
        if (Array.isArray(parsed)) {
          seenIds = parsed
          hasStoredRecord = true
        }
      }
    } catch {
      seenIds = []
      hasStoredRecord = false
    }

    if (!hasStoredRecord) {
      // Lần đầu tiên tính năng chạy trên trình duyệt này:
      // Để người chơi trải nghiệm ngay, chọn danh hiệu cao nhất để chúc mừng chào đón,
      // và đánh dấu các danh hiệu cũ khác là đã xem để không bị spam nhiều lần.
      const topBadge = unlockedBadges[0]
      const otherIds = unlockedBadges.slice(1).map((b) => b.id)
      try {
        localStorage.setItem(storageKey, JSON.stringify(otherIds))
      } catch {
        // storage disabled or quota full
      }
      setPendingBadges([topBadge])
    } else {
      // Tìm các danh hiệu đã unlocked nhưng chưa có trong danh sách đã xem
      const unseen = unlockedBadges.filter((b) => !seenIds.includes(b.id))
      if (unseen.length > 0) {
        setPendingBadges((prev) => {
          // Thêm các danh hiệu chưa có trong hàng đợi hiện tại
          const prevIds = new Set(prev.map((b) => b.id))
          const toAdd = unseen.filter((b) => !prevIds.has(b.id))
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev
        })
      }
    }
  }, [storageKey, me?.id, unlockedBadges])

  // Đánh dấu một danh hiệu là đã xem và lưu vào localStorage
  const markAsSeen = useCallback(
    (badgeId) => {
      if (!storageKey || !badgeId) return
      try {
        let seenIds = []
        const raw = localStorage.getItem(storageKey)
        if (raw) seenIds = JSON.parse(raw)
        if (!seenIds.includes(badgeId)) {
          seenIds.push(badgeId)
          localStorage.setItem(storageKey, JSON.stringify(seenIds))
        }
      } catch {
        // ignore storage error
      }
    },
    [storageKey],
  )

  const activeBadge = pendingBadges[0] || null

  // Đóng modal danh hiệu hiện tại
  const handleClose = useCallback(() => {
    if (!activeBadge) return
    markAsSeen(activeBadge.id)
    setPendingBadges((prev) => prev.slice(1))
  }, [activeBadge, markAsSeen])

  // Gắn danh hiệu lên kệ của tôi
  const handleEquipShelf = useCallback(
    (badge) => {
      if (!badge || !me?.id) return
      const currentShelf = (me.badgeShelf || me.badge_shelf || []).slice()
      const foundIdx = currentShelf.indexOf(badge.id)

      if (foundIdx < 0) {
        if (currentShelf.length >= SHELF_SLOTS) {
          currentShelf.pop() // Kệ đầy 3 ô -> thay ô cuối cùng
        }
        currentShelf.unshift(badge.id)

        if (a && a.setMemberShelf) {
          a.setMemberShelf(me.id, currentShelf)
        }
      }

      handleClose()
    },
    [me, a, handleClose],
  )

  // Xem bộ sưu tập cá nhân
  const handleViewCollection = useCallback(
    (badge) => {
      const targetBadge = badge || activeBadge
      const badgeId = targetBadge?.id
      handleClose()

      const search = new URLSearchParams()
      search.set('tab', 'collection')
      if (badgeId) search.set('highlight', badgeId)
      search.set('t', String(Date.now()))

      navigate(`/danh-hieu?${search.toString()}`, {
        state: {
          tab: 'collection',
          badgeId,
          memberId: me?.id,
          t: Date.now(),
        },
      })
    },
    [handleClose, navigate, activeBadge, me?.id],
  )

  if (!activeBadge || !me) return null

  const currentShelf = me.badgeShelf || me.badge_shelf || []
  const shelfCount = currentShelf.length
  const shelfIsFull = shelfCount >= SHELF_SLOTS

  return (
    <BadgeUnlockModal
      badge={activeBadge}
      shelfCount={shelfCount}
      shelfIsFull={shelfIsFull}
      onClose={handleClose}
      onEquipShelf={handleEquipShelf}
      onViewCollection={handleViewCollection}
    />
  )
}
