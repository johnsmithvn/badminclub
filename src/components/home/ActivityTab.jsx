// src/components/home/ActivityTab.jsx
import React, { useState, useEffect } from 'react'
import { Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { supabase } from '#supabase'
import { resolveActivityPayload } from '#lib/activity.js'
import { botLineKey, getBotChallengeReaction } from '#lib/bot.js'
import { t } from '#i18n'

function formatActivityTime(rawTs) {
  if (!rawTs) return ''
  const d = new Date(rawTs)
  if (isNaN(d.getTime())) return String(rawTs)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${hours}:${minutes} · ${day}/${month}`
}

export default function ActivityTab() {
  const { db } = useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const PAGE_SIZE = 20

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      if (!db.clubId || !supabase) {
        setLoading(false)
        return
      }

      const from = 0
      const to = PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .eq('club_id', db.clubId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (cancelled) return
      if (error) {
        console.warn('Error fetching activity events:', error.message)
      } else {
        setEvents(data || [])
        setPage(1)
        setHasMore((data || []).length === PAGE_SIZE)
      }
      setLoading(false)
    }

    loadInitial()
    return () => {
      cancelled = true
    }
  }, [db.clubId])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    setLoading(true)
    try {
      const from = (nextPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .eq('club_id', db.clubId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.warn('Error fetching activity events:', error.message)
        return
      }

      // `range()` là cửa sổ theo offset: có sự kiện mới chèn vào giữa lúc đang xem thêm là
      // cả cửa sổ trượt xuống và trang sau lặp lại dòng của trang trước (React kêu trùng key).
      setEvents((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...(data || []).filter((x) => !seen.has(x.id))]
      })
      setHasMore((data || []).length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }

  const getEventMeta = (item) => {
    if (item.type === 'match_recorded') {
      const narrative = item.payload?.narrativeType || 'normal'
      switch (narrative) {
        case 'clutch':
          return { icon: 'zap', color: '#00F5D4', key: 'match_clutch', badgeColor: 'rgba(0, 245, 212, 0.15)' }
        case 'blowout':
          return { icon: 'flame', color: '#A855F7', key: 'match_blowout', badgeColor: 'rgba(168, 85, 247, 0.15)' }
        case 'comeback':
          return { icon: 'repeat', color: '#10B981', key: 'match_comeback', badgeColor: 'rgba(16, 185, 129, 0.15)' }
        default:
          return { icon: 'activity', color: '#3B82F6', key: 'match_normal', badgeColor: 'rgba(59, 130, 246, 0.15)' }
      }
    }

    // Bot nói: câu chữ nằm ở `bot.remark.*` chứ không phải `activity.*`, nên trả `fullKey` để
    // chỗ render bỏ qua tiền tố. Biến thể chọn bằng chính `item.id` — dòng nào cũng ra đúng một
    // câu cố định của nó, mà không phải lưu số thứ tự xuống DB.
    if (item.type === 'bot_remark') {
      return {
        icon: 'sparkles',
        color: '#A855F7',
        key: 'bot_remark',
        fullKey: botLineKey('remark', item.payload?.kind, item.id),
        badgeColor: 'rgba(168, 85, 247, 0.15)',
      }
    }

    switch (item.type) {
      case 'bounty_broken':
        return { icon: 'flame', color: '#FF2E7E', key: 'bounty_broken', badgeColor: 'rgba(255, 46, 126, 0.15)' }
      case 'challenge_completed':
        return { icon: 'trophy', color: '#FFE24B', key: 'challenge_completed', badgeColor: 'rgba(255, 226, 75, 0.15)' }
      case 'challenge_created':
        return { icon: 'swords', color: '#00F5D4', key: 'challenge_created', badgeColor: 'rgba(0, 245, 212, 0.15)' }
      case 'challenge_declined':
      case 'challenge_cancelled':
      case 'session_cancelled':
        return { icon: 'x', color: '#EF4444', key: item.type, badgeColor: 'rgba(239, 68, 68, 0.15)' }
      case 'session_opened':
        return { icon: 'calendar', color: '#3B82F6', key: 'session_opened', badgeColor: 'rgba(59, 130, 246, 0.15)' }
      case 'session_closed':
        return { icon: 'check', color: '#10B981', key: 'session_closed', badgeColor: 'rgba(16, 185, 129, 0.15)' }
      case 'member_joined':
        return { icon: 'user', color: '#EC4899', key: 'member_joined', badgeColor: 'rgba(236, 72, 153, 0.15)' }
      case 'arcade_played': {
        const outcome = item.payload?.outcome
        const isWon = outcome === 'won'
        return {
          icon: 'sparkles',
          color: isWon ? '#10B981' : (outcome === 'lost' ? '#FF2E7E' : '#FFE24B'),
          key: `arcade_${outcome || 'played'}`,
          badgeColor: isWon ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 46, 126, 0.15)',
        }
      }
      default:
        return { icon: 'activity', color: 'var(--text-accent, #00B2A9)', key: item.type, badgeColor: 'var(--surface-sunken)' }
    }
  }

  return (
    <div style={S.container}>
      {/* Danh sách các sự kiện */}
      {events.length === 0 && !loading ? (
        <div style={S.card}>
          <div style={S.emptyState}>
            <Icon name="activity" size={32} style={{ opacity: 0.4 }} />
            <div>{t('activity.empty')}</div>
          </div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={S.headerRow}>
            <span style={S.headerTitle}>{t('activity.tabName')}</span>
            <span style={S.countBadge}>{events.length}</span>
          </div>
          <div style={S.eventsList}>
            {events.map((item) => {
              const meta = getEventMeta(item)
              const resolvedPayload = resolveActivityPayload(item, db)
              // `fullKey` là đường thoát cho loại có câu chữ nằm ngoài nhánh `activity.*` (bot).
              const text = meta.fullKey
                ? t(meta.fullKey, resolvedPayload)
                : t('activity.' + meta.key, resolvedPayload)

              // Phản ứng từ Bot (nếu là sự kiện từ chối hoặc huỷ kèo)
              let botReaction = null
              if (item.type === 'challenge_declined' || item.type === 'challenge_cancelled') {
                const chal = (db.challenges || []).find((c) => c.id === (item.ref_id || item.refId || item.payload?.chalId))
                if (chal) {
                  botReaction = getBotChallengeReaction(db, {
                    ...chal,
                    status: item.type === 'challenge_declined' ? 'declined' : 'cancelled',
                    declinedBy: item.payload?.declinedById,
                  })
                }
              }

              return (
                <div key={item.id} style={S.eventRow}>
                  <span style={{ ...S.dot, background: meta.color }} />
                  <div style={S.eventContent}>
                    <div style={S.eventTitle}>{text}</div>
                    {botReaction?.lineKey && (
                      <div style={S.botCommentBubble}>
                        <div style={S.botCommentHead}>
                          <Icon name="sparkles" size={12} color="#A855F7" />
                          <span style={S.botCommentAuthor}>{botReaction.params?.bot || ''}</span>
                        </div>
                        <div style={S.botCommentText}>“{t(botReaction.lineKey, botReaction.params || {})}”</div>
                      </div>
                    )}
                    <div style={S.eventTime}>{formatActivityTime(item.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Nút xem thêm */}
      {hasMore && !loading && (
        <div style={S.loadMoreBox}>
          <Button variant="secondary" onClick={handleLoadMore}>
            {t('activity.loadMore')}
          </Button>
        </div>
      )}

      {loading && (
        <div style={S.loadingBox}>
          {t('activity.loading')}
        </div>
      )}
    </div>
  )
}

const S = {
  container: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '16px 0 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    padding: '16px 18px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerTitle: {
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  countBadge: {
    font: '500 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--surface-sunken)',
    padding: '3px 7px',
    borderRadius: 999,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '2px 0',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 6,
  },
  eventContent: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    font: '500 13px/1.4 var(--font-sans)',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  botCommentBubble: {
    marginTop: 6,
    padding: '7px 10px',
    borderRadius: 'var(--radius-md, 8px)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  botCommentHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  botCommentAuthor: {
    font: '600 11px/1.2 var(--font-sans)',
    color: '#A855F7',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  botCommentText: {
    font: '400 12.5px/1.4 var(--font-sans)',
    fontStyle: 'italic',
    color: 'var(--text-primary)',
  },
  eventTime: {
    font: '400 11px/1.2 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 3,
  },
  emptyState: {
    padding: '48px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    font: '500 14px/1.4 var(--font-sans)',
  },
  loadMoreBox: {
    textAlign: 'center',
    marginTop: 8,
  },
  loadingBox: {
    textAlign: 'center',
    padding: '16px 0',
    color: 'var(--text-muted)',
    font: '400 13px/1.4 var(--font-sans)',
  },
}
