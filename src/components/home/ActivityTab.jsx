// src/components/home/ActivityTab.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { supabase } from '#supabase'
import { groupActivities2a } from '#lib/activity.js'
import { t } from '#i18n'

function renderTeam(team, color = 'var(--text-primary)', fontWeight = 600) {
  if (!team || !team.list || team.list.length === 0) return team?.names || ''
  return team.list.map((p) => (
    <React.Fragment key={p.id || p.name}>
      <span style={{ color, fontWeight }}>{p.name}</span>
      {p.sep && (
        <span style={{ color: 'var(--text-disabled)', fontWeight: 400, padding: '0 5px' }}>
          &amp;
        </span>
      )}
    </React.Fragment>
  ))
}

function renderLeadAvatar(e) {
  if (e.hasLeadAv && e.lead1) {
    if (e.lead2) {
      return (
        <div style={{ width: 34, height: 34, position: 'relative', flexShrink: 0 }}>
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: e.lead1.bg,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '600 9px/1 var(--font-sans)',
              overflow: 'hidden',
            }}
          >
            {e.lead1.avatarUrl ? (
              <img
                src={e.lead1.avatarUrl}
                alt={e.lead1.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              e.lead1.ini
            )}
          </span>
          <span
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: e.lead2.bg,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '600 8px/1 var(--font-sans)',
              border: '2px solid var(--surface-card)',
              overflow: 'hidden',
            }}
          >
            {e.lead2.avatarUrl ? (
              <img
                src={e.lead2.avatarUrl}
                alt={e.lead2.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              e.lead2.ini
            )}
          </span>
        </div>
      )
    }

    return (
      <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: e.lead1.bg,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '600 11px/1 var(--font-sans)',
            overflow: 'hidden',
          }}
        >
          {e.lead1.avatarUrl ? (
            <img
              src={e.lead1.avatarUrl}
              alt={e.lead1.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            e.lead1.ini
          )}
        </span>
      </div>
    )
  }

  if (e.hasLeadIcon) {
    return (
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: e.iconBg,
          color: e.iconFg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '600 14px/1 var(--font-sans)',
          flexShrink: 0,
        }}
      >
        {e.icon}
      </span>
    )
  }

  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: 'var(--surface-sunken)',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '600 14px/1 var(--font-sans)',
        flexShrink: 0,
      }}
    >
      •
    </span>
  )
}

/** Nút "Xem lịch sử thay đổi" + danh sách các bản, cũ → mới. Bản cuối là bản đang có hiệu lực. */
function renderHistory(e, isOpen, onToggle) {
  if (!e.history?.length) return null
  // Nút nằm TRONG một dòng bấm được: chặn cả click lẫn Enter, không thì mở lịch sử là bị đưa
  // sang trang khác.
  const stop = (ev) => ev.stopPropagation()
  return (
    <>
      <button
        type="button"
        onClick={(ev) => { stop(ev); onToggle(e.id) }}
        onKeyDown={stop}
        style={S.historyToggle}
      >
        {isOpen ? t('activity.historyHide') : t('activity.historyShow', { n: e.history.length })}
      </button>
      {isOpen && (
        <div style={S.historyList} onClick={stop}>
          {e.history.map((h, i) => {
            const isLast = i === e.history.length - 1
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: '600 12px/1.35 var(--font-sans)', color: 'var(--text-secondary)' }}>
                  {h.t && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {h.t} ·{' '}
                    </span>
                  )}
                  {t('activity.hist_' + h.kind)}
                  {h.by && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {h.by}</span>}
                </span>
                {(h.winners || h.raw) && (
                  <span style={{ font: '400 12px/1.35 var(--font-sans)', color: isLast ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {h.winners ? t('activity.versionWin', { winners: h.winners, score: h.score }) : h.raw}
                  </span>
                )}
                {h.reason && (
                  <span style={{ font: 'italic 400 12px/1.35 var(--font-sans)', color: 'var(--text-muted)' }}>
                    “{h.reason}”
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function renderCenterContent(e, isHistoryOpen, onToggleHistory) {
  if (e.isMatch) {
    // Trận đã huỷ: không còn ai "thắng" — tên đội thắng thôi tô màu nhấn.
    const winColor = e.isCancelled ? 'var(--text-secondary)' : 'var(--status-transit-fg)'
    return (
      <>
        <span>
          <span style={{ color: winColor, fontWeight: 600 }}>
            {renderTeam(e.W, winColor, 600)}
          </span>
          {' '}{e.verb}{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {renderTeam(e.L, 'var(--text-primary)', 500)}
          </span>
        </span>
        <span style={{ font: '500 12px/1.4 var(--font-sans)', fontStyle: 'italic', color: e.capColor }}>
          {e.caption}
        </span>
        {e.hasStreak && (
          <span
            style={{
              alignSelf: 'flex-start',
              font: '500 12px/1.3 var(--font-sans)',
              color: 'var(--status-incident-fg)',
              background: 'var(--status-incident-bg)',
              padding: '5px 8px',
              borderRadius: 6,
            }}
          >
            🔥 {e.streakText}
          </span>
        )}
        {renderHistory(e, isHistoryOpen, onToggleHistory)}
      </>
    )
  }

  if (e.isResolved) {
    const winColor = e.isVoid ? 'var(--text-secondary)' : 'var(--status-delayed-fg)'
    return (
      <>
        <span style={{ font: '600 11px/1 var(--font-mono)', color: winColor, letterSpacing: '.05em' }}>
          {t('activity.resolvedTag', { code: e.code })}
        </span>
        <span>
          <span style={{ color: winColor, fontWeight: 600 }}>
            {renderTeam(e.W, winColor, 600)}
          </span>
          {' '}{t('activity.resolvedDefeated')}{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {renderTeam(e.L, 'var(--text-primary)', 500)}
          </span>
          {' '}{t('activity.resolvedFinal')}
        </span>
        {e.isVoid && (
          <span style={{ font: '500 12px/1.4 var(--font-sans)', fontStyle: 'italic', color: 'var(--status-incident-fg)' }}>
            {t('activity.resultVoid')}
          </span>
        )}
        {renderHistory(e, isHistoryOpen, onToggleHistory)}
      </>
    )
  }

  if (e.isMatchChange) {
    return (
      <>
        <span>
          {e.actor && <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{e.actor} </span>}
          {e.head}
        </span>
        {(e.before || e.after) && (
          <span style={{ font: '400 13px/1.4 var(--font-sans)' }}>
            {e.before && (
              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{e.before}</span>
            )}
            {e.before && e.after && <span style={{ color: 'var(--text-disabled)' }}> → </span>}
            {e.after && <span style={{ color: 'var(--text-primary)' }}>{e.after}</span>}
          </span>
        )}
        {e.isCancelChange && (
          <span style={{ font: '500 12px/1.4 var(--font-sans)', fontStyle: 'italic', color: 'var(--status-incident-fg)' }}>
            {t('activity.recalcNote')}
          </span>
        )}
        {e.reason && (
          <span style={{ font: 'italic 400 12px/1.35 var(--font-sans)', color: 'var(--text-muted)' }}>“{e.reason}”</span>
        )}
      </>
    )
  }

  if (e.isKeo) {
    return (
      <>
        <span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {renderTeam(e.A, 'var(--text-primary)', 600)}
          </span>
          {' '}{t('activity.challengeVs')}{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {renderTeam(e.B, 'var(--text-primary)', 600)}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px/1 var(--font-sans)' }}>
          <span style={{ font: '600 12px/1 var(--font-mono)', color: 'var(--text-accent)' }}>
            ⚔️ {e.code}
          </span>
          {e.keoStatus && (
            <>
              <span style={{ color: 'var(--text-disabled)' }}>·</span>
              <span>{e.keoStatus}</span>
            </>
          )}
        </span>
      </>
    )
  }

  if (e.singleAccept) {
    return (
      <span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {t('activity.keoAcceptedHead', { code: e.code })}
        </span>{' '}
        {t('activity.keoAcceptedTail')}
      </span>
    )
  }

  if (e.isSession) {
    return (
      <>
        <span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{e.title}</span>{' '}
          {t('activity.sessionOpenedTail')}
        </span>
        {/* Chỉ là chữ nhấn — bấm đâu trên dòng cũng tới trang buổi (xem `link`). */}
        {e.canRsvp && (
          <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--text-link)' }}>
            {t('activity.rsvpNow')}
          </span>
        )}
      </>
    )
  }

  if (e.isCancel) {
    return (
      <span style={{ color: 'var(--text-muted)' }}>
        {t('activity.keoCancelledPre')}{' '}
        <span style={{ fontFamily: 'var(--font-mono)', textDecoration: 'line-through' }}>
          {e.code}
        </span>{' '}
        {t('activity.keoCancelledPost')}
      </span>
    )
  }

  if (e.isBounty) {
    return (
      <span>
        🔥{' '}
        <span style={{ color: 'var(--status-transit-fg)', fontWeight: 600 }}>
          {renderTeam(e.breakers, 'var(--status-transit-fg)', 600)}
        </span>{' '}
        {t('activity.bountyTail', { streak: e.streak, victim: e.victims?.names || '' })}
      </span>
    )
  }

  if (e.isMemberJoined) {
    return (
      <span>
        👋 {t('activity.memberJoinedPre')}{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{e.name}</span>{' '}
        {t('activity.memberJoinedPost')}
      </span>
    )
  }

  if (e.isSessionState) {
    return (
      <span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{e.title}</span>{' '}
        {e.isClosed ? t('activity.sessionClosedTail') : t('activity.sessionCancelledTail')}
      </span>
    )
  }

  return <span>{e.text}</span>
}

function renderRightColumn(e) {
  // Trận / kết quả kèo đã bị huỷ: tỉ số gạch ngang, mờ đi — vẫn để đó cho biết cái gì bị huỷ.
  const struck = e.isCancelled || e.isVoid
  const scoreStyle = (color) => ({
    font: '600 16px/1 var(--font-mono)',
    color: struck ? 'var(--text-disabled)' : color,
    textDecoration: struck ? 'line-through' : 'none',
    whiteSpace: 'nowrap',
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 52, flexShrink: 0 }}>
      {e.isMatch && (
        <span style={scoreStyle('var(--status-transit-fg)')}>
          {e.ws}
          {e.ls !== '' && <span style={{ color: 'var(--text-disabled)' }}>–{e.ls}</span>}
        </span>
      )}
      {e.isResolved && (
        <span style={scoreStyle('var(--status-delayed-fg)')}>
          {e.ws}
          {e.ls !== '' && <span style={{ color: 'var(--text-disabled)' }}>–{e.ls}</span>}
        </span>
      )}
      <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>
        {e.t}
      </span>
      {e.badge && <span style={S.badge(e.badge.tone)}>{e.badge.text}</span>}
    </div>
  )
}

export default function ActivityTab() {
  const { db } = useApp()
  const navigate = useNavigate()
  const [hoverId, setHoverId] = useState(null)
  const [openHistory, setOpenHistory] = useState(() => new Set())
  const toggleHistory = (id) => setOpenHistory((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
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

  const days = useMemo(() => groupActivities2a(events, db), [events, db])
  // Đếm DÒNG đang hiện, không đếm sự kiện: dòng chặn chuỗi gộp vào trận nên hai số khác nhau.
  const rowCount = days.reduce((n, d) => n + d.items.length, 0)

  return (
    <div style={S.container}>
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
            <span style={S.countBadge}>{rowCount}</span>
          </div>
          <div>
            {days.map((d) => (
              <React.Fragment key={d.dateKey}>
                <div style={S.dayHeader}>{d.labelUpper}</div>
                {d.items.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      ...S.eventRow(e.align),
                      ...(e.link ? { cursor: 'pointer' } : null),
                      ...(e.link && hoverId === e.id ? { background: 'var(--action-ghost-bg-hover)' } : null),
                    }}
                    {...(e.link ? {
                      role: 'link',
                      tabIndex: 0,
                      onClick: () => navigate(e.link),
                      onKeyDown: (ev) => { if (ev.key === 'Enter') navigate(e.link) },
                      onMouseEnter: () => setHoverId(e.id),
                      onMouseLeave: () => setHoverId(null),
                    } : null)}
                  >
                    {renderLeadAvatar(e)}
                    <div style={S.centerCol}>
                      {renderCenterContent(e, openHistory.has(e.id), toggleHistory)}
                    </div>
                    {renderRightColumn(e)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

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
  // Không chặn bề rộng: trải theo khung như các tab anh em (Thành tích, Sân đấu). Bản 2a vẽ
  // 560px là khổ canvas thiết kế, không phải giới hạn — trên PC chặn lại là hở hai bên.
  container: {
    padding: '16px 0 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 18px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerTitle: {
    font: '600 12px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  countBadge: {
    font: '500 11px/1 var(--font-mono)',
    color: 'var(--text-secondary)',
    background: 'var(--surface-sunken)',
    padding: '4px 8px',
    borderRadius: 10,
  },
  dayHeader: {
    padding: '14px 18px 6px',
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    background: 'var(--surface-inset)',
    borderTop: '1px solid var(--border-subtle)',
  },
  eventRow: (align = 'start') => ({
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) auto',
    gap: 12,
    alignItems: align,
    padding: '12px 18px',
    borderTop: '1px solid var(--border-subtle)',
    transition: 'background 140ms ease',
  }),
  centerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 0,
    font: '400 14px/1.45 var(--font-sans)',
    color: 'var(--text-secondary)',
    wordBreak: 'break-word',
  },
  badge: (tone) => ({
    font: '600 10px/1 var(--font-sans)',
    padding: '3px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    background: tone === 'danger' ? 'var(--status-incident-bg)' : 'var(--status-delayed-bg)',
    color: tone === 'danger' ? 'var(--status-incident-fg)' : 'var(--status-delayed-fg)',
  }),
  historyToggle: {
    alignSelf: 'flex-start',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    font: '600 12px/1.3 var(--font-sans)',
    color: 'var(--text-link)',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 2,
    paddingLeft: 10,
    borderLeft: '2px solid var(--border-subtle)',
    cursor: 'default',
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
