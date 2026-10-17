import { useEffect, useState } from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import { pickTip } from '#lib/library.js'
import { t } from '#i18n'
import cfg from '#config/app.js'

// Kết quả tung theo từng CLB, sống tới khi nạp lại trang = một lần mở app. Rời Home rồi quay lại
// không tung lại, nên dải không chợt hiện chợt tắt. `{ post: null }` = lần này không gợi ý (hoặc
// đang nạp) — có mặt trong cache là đủ để không tung / không nạp lần hai.
const rolled = {}

/**
 * Dải "Gợi ý tập" dưới header Home (17b): thỉnh thoảng gợi ý một bài trong Thư viện.
 * Hiện ngẫu nhiên theo `cfg.library.tipChance`; chỉ khi tung trúng mới nạp danh sách bài.
 * Bấm → mở bài, rồi ẩn tới lần mở app sau. Cha đặt `key={clubId}` để đổi CLB là tung lại.
 */
export default function LibraryTipBar({ isMobile }) {
  const { db, a } = useApp()
  const clubId = db.clubId
  const me = myMember(db)?.id || null
  const [post, setPost] = useState(() => rolled[clubId]?.post || null)

  useEffect(() => {
    if (!clubId || rolled[clubId]) return
    rolled[clubId] = { post: null }
    if (Math.random() >= cfg.library.tipChance) return
    // Gợi ý không quan trọng tới mức báo lỗi: nạp hỏng thì thôi không hiện.
    a.libLoad()
      .then((r) => {
        const p = pickTip(r.posts, r.marks, me)
        rolled[clubId] = { post: p }
        setPost(p)
      })
      .catch((e) => console.warn('[library] Không nạp được bài gợi ý:', e?.message || e))
  }, [a, clubId, me])

  if (!post) return null

  const open = () => {
    rolled[clubId] = { post: null }
    setPost(null)
    a.go('libraryPost', post.id)
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('library.tipAria', { title: post.title })}
      style={{ ...S.bar, minHeight: isMobile ? 48 : 44 }}
    >
      <span style={S.dot} />
      <span style={S.label}>{t('library.tipLabel')}</span>
      <span style={S.title} title={post.title}>{post.title}</span>
      <Icon name="chevron-right" size={18} style={{ flexShrink: 0, color: 'var(--status-delayed-fg)' }} />
    </button>
  )
}

const S = {
  bar: {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '0 10px 0 14px',
    borderRadius: 'var(--radius-card, 12px)',
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--status-delayed-bg)',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  dot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: 999,
    background: 'var(--status-delayed-fg)',
  },
  label: {
    flexShrink: 0,
    font: '600 12.5px/1 var(--font-sans)',
    color: 'var(--status-delayed-fg)',
  },
  title: {
    flex: 1,
    minWidth: 0,
    font: '500 12.5px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}
