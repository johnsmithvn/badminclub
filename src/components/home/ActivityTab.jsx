// src/components/home/ActivityTab.jsx
import React, { useState, useEffect } from 'react'
import { Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { supabase } from '#supabase'
import { resolveActivityPayload } from '#lib/activity.js'
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

    switch (item.type) {
      case 'bounty_broken':
        return { icon: 'flame', color: '#FF2E7E', key: 'bounty_broken', badgeColor: 'rgba(255, 46, 126, 0.15)' }
      case 'challenge_completed':
        return { icon: 'trophy', color: '#FFE24B', key: 'challenge_completed', badgeColor: 'rgba(255, 226, 75, 0.15)' }
      case 'challenge_created':
        return { icon: 'swords', color: '#00F5D4', key: 'challenge_created', badgeColor: 'rgba(0, 245, 212, 0.15)' }
      case 'challenge_cancelled':
      case 'session_cancelled':
        return { icon: 'x', color: '#EF4444', key: item.type, badgeColor: 'rgba(239, 68, 68, 0.15)' }
      case 'session_opened':
        return { icon: 'calendar', color: '#3B82F6', key: 'session_opened', badgeColor: 'rgba(59, 130, 246, 0.15)' }
      case 'session_closed':
        return { icon: 'check', color: '#10B981', key: 'session_closed', badgeColor: 'rgba(16, 185, 129, 0.15)' }
      case 'member_joined':
        return { icon: 'user', color: '#EC4899', key: 'member_joined', badgeColor: 'rgba(236, 72, 153, 0.15)' }
      default:
        return { icon: 'activity', color: 'var(--text-accent, #00B2A9)', key: item.type, badgeColor: 'var(--surface-sunken)' }
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 0' }}>
      {/* Danh sách các sự kiện */}
      {events.length === 0 && !loading ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <Icon name="activity" size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15 }}>{t('activity.empty')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map((item) => {
            const meta = getEventMeta(item)
            const resolvedPayload = resolveActivityPayload(item, db)
            const text = t('activity.' + meta.key, resolvedPayload)

            return (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0, 0, 0, 0.08))',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: meta.badgeColor,
                    color: meta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={meta.icon} size={20} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      lineHeight: 1.45,
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                    }}
                  >
                    {text}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginTop: 6,
                    }}
                  >
                    {formatActivityTime(item.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nút xem thêm */}
      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button variant="secondary" onClick={handleLoadMore}>
            {t('activity.loadMore')}
          </Button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          {t('activity.loading')}
        </div>
      )}
    </div>
  )
}
