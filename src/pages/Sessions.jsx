// Buổi tập: StatCard + danh sách buổi có tab lọc theo thiết kế mobile nâng cao.

import { Card, DataTable, Icon, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, SessionPill, sessionColumns, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import {
  billsOf, courtCost, courtNet, courtPayMode, courtTxt, fmt, fmtK,
  groupMembers, groupOf, guestPaidRev, guestRev, headCount,
  monthSessions, presentCount, sGuestsOnly, timeTxt,
} from '#lib/money.js'
import { dd, monthOf, wd } from '#utils/dates.js'
import { t } from '#i18n'

/**
 * Thẻ buổi tập phiên bản Mobile theo thiết kế B1:
 * - Nền card nâng một bậc (#18233A trên #0A111F)
 * - Header: Ngày (mono 17px) + Chip thứ + SessionPill
 * - Lưới 3 ô nhãn-giá trị: Điểm danh, Khách, Tổng đi
 * - Khung ngang: Tiền sân & Thu khách
 * - Nhóm (dot xanh ngọc) + Giờ tập + Địa điểm sân
 */
function SessionCardMobile({ s, db, onClick }) {
  const isSunday = wd(s.date) === 'CN'
  const grp = groupOf(db, s.groupId)
  const p = presentCount(db, s)
  const tot = groupMembers(db, s.groupId, monthOf(s.date)).length
  const gCount = sGuestsOnly(db, s.id).length
  const total = headCount(db, s)
  const net = courtNet(db, s)
  const rev = guestRev(db, s.id)
  const hasAttendance = s.status === 'open' || s.status === 'closed'
  const isFull = hasAttendance && tot > 0 && p >= tot

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        background: 'var(--surface-card, #18233A)',
        border: '1px solid var(--border-subtle, #33456A)',
        borderRadius: 14,
        padding: '13px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-xs)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* 1. Header: Ngày + Chip thứ + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{
          font: "600 17px/1 var(--font-mono, 'IBM Plex Mono', monospace)",
          color: 'var(--text-primary, #F2F6FC)',
          letterSpacing: '0.01em',
        }}>
          {dd(s.date)}
        </span>
        <span style={{
          font: "600 11.5px/1.35 var(--font-sans, 'IBM Plex Sans', sans-serif)",
          padding: '3px 9px',
          borderRadius: 7,
          background: isSunday
            ? 'var(--status-incident-bg, rgba(225, 68, 52, 0.14))'
            : 'var(--status-scheduled-bg, rgba(60, 116, 196, 0.14))',
          border: `1px solid ${isSunday ? 'rgba(239, 68, 68, 0.28)' : 'rgba(99, 102, 241, 0.25)'}`,
          color: isSunday ? 'var(--status-incident-fg, #FF9A8F)' : 'var(--status-scheduled-fg, #9FC0EA)',
          whiteSpace: 'nowrap',
        }}>
          {wd(s.date)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }} />
        <SessionPill status={s.status} size="sm" />
      </div>

      {/* 2. Lưới nhãn - giá trị 3 ô (Điểm danh | Khách | Tổng đi) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: 'var(--border-subtle, #2A3A58)',
        border: '1px solid var(--border-subtle, #2A3A58)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'var(--surface-sunken, #131D31)',
          padding: '7px 9px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          <span style={{
            font: "600 9.5px/1.2 var(--font-sans, 'IBM Plex Sans', sans-serif)",
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #9FB0C6)',
          }}>
            {t('sessionCol.attend')}
          </span>
          <span style={{
            font: "600 15px/1.1 var(--font-mono, 'IBM Plex Mono', monospace)",
            color: !hasAttendance
              ? 'var(--text-muted, #7F8FA6)'
              : isFull
                ? 'var(--status-delivered-fg, #7BE3A0)'
                : 'var(--text-primary, #F2F6FC)',
          }}>
            {hasAttendance ? `${p}/${tot}` : '—'}
          </span>
        </div>

        <div style={{
          background: 'var(--surface-sunken, #131D31)',
          padding: '7px 9px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          <span style={{
            font: "600 9.5px/1.2 var(--font-sans, 'IBM Plex Sans', sans-serif)",
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #9FB0C6)',
          }}>
            {t('sessionCol.guest')}
          </span>
          <span style={{
            font: "600 15px/1.1 var(--font-mono, 'IBM Plex Mono', monospace)",
            color: gCount > 0 ? 'var(--status-delayed-fg, #FBC15E)' : 'var(--text-muted, #7F8FA6)',
          }}>
            {gCount > 0 ? `+${gCount}` : '—'}
          </span>
        </div>

        <div style={{
          background: 'var(--surface-sunken, #131D31)',
          padding: '7px 9px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          <span style={{
            font: "600 9.5px/1.2 var(--font-sans, 'IBM Plex Sans', sans-serif)",
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #9FB0C6)',
          }}>
            {t('sessionCol.totalPeople')}
          </span>
          <span style={{
            font: "600 15px/1.1 var(--font-mono, 'IBM Plex Mono', monospace)",
            color: hasAttendance && total > 0 ? 'var(--status-scheduled-fg, #A9B4FF)' : 'var(--text-muted, #7F8FA6)',
          }}>
            {hasAttendance && total > 0 ? total : '—'}
          </span>
        </div>
      </div>

      {/* 3. Khung ngang [Tiền sân | Thu khách] */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--surface-sunken, #131D31)',
        border: '1px solid var(--border-subtle, #2A3A58)',
      }}>
        <div style={{
          flex: '1 1 110px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ font: "400 11.5px/1.3 var(--font-sans, 'IBM Plex Sans', sans-serif)", color: 'var(--text-muted, #A9B9CF)' }}>
            {t('sessionCol.court')}
          </span>
          <span style={{ font: "600 13px/1.2 var(--font-mono, 'IBM Plex Mono', monospace)", color: 'var(--text-primary, #F2F6FC)' }}>
            {fmtK(net)}
          </span>
        </div>

        <div style={{
          flex: '1 1 110px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ font: "400 11.5px/1.3 var(--font-sans, 'IBM Plex Sans', sans-serif)", color: 'var(--text-muted, #A9B9CF)' }}>
            {t('sessionCol.guestRev')}
          </span>
          <span style={{
            font: "600 13.5px/1.2 var(--font-mono, 'IBM Plex Mono', monospace)",
            color: rev > 0 ? 'var(--status-delivered-fg, #7BE3A0)' : 'var(--text-muted, #7F8FA6)',
          }}>
            {rev > 0 ? `+${fmtK(rev)}` : '0'}
          </span>
        </div>
      </div>

      {/* 4. [Nhóm + Giờ] và [Địa điểm / Sân] */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 9px',
            borderRadius: 7,
            background: 'var(--status-transit-bg, rgba(0, 178, 169, 0.12))',
            border: '1px solid rgba(0, 178, 169, 0.25)',
            font: "600 11.5px/1.3 var(--font-sans, 'IBM Plex Sans', sans-serif)",
            color: 'var(--status-transit-fg, #5BE0D3)',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--status-transit-fg, #5BE0D3)',
              flexShrink: 0,
            }} />
            <span>{grp.name}</span>
          </span>
          <span style={{
            font: "500 12px/1.3 var(--font-mono, 'IBM Plex Mono', monospace)",
            color: 'var(--text-secondary, #DCE5F2)',
          }}>
            {timeTxt(s)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <Icon
            name="map-pin"
            size={13}
            style={{ color: 'var(--status-transit-fg, #5BE0D3)', flexShrink: 0, marginTop: 2 }}
          />
          <span style={{
            font: "400 12px/1.45 var(--font-sans, 'IBM Plex Sans', sans-serif)",
            color: 'var(--text-secondary, #C5D3E6)',
            wordBreak: 'break-word',
          }}>
            {courtTxt(db, s)}
          </span>
        </div>
      </div>
    </article>
  )
}

export default function Sessions() {
  const { db, ui, a } = useApp()
  const isMobile = useMobile()
  const tab = ui.tab.sessions || 'all'
  const sess = monthSessions(db, db.month)
  const closed = sess.filter((s) => s.status === 'closed')
  const cancelled = sess.filter((s) => s.status === 'cancelled')
  const unclosed = sess.filter((s) => s.status === 'draft' || s.status === 'open')

  // Trả trọn tháng thì tiền sân lấy từ hoá đơn; trả từng buổi thì cộng các buổi đã chốt.
  const perMonth = courtPayMode(db) === 'month'
  const courtSpent = perMonth
    ? billsOf(db, db.month).reduce((x, b) => x + b.amount, 0)
    : closed.reduce((x, s) => x + courtCost(db, s), 0)

  const guestTotal = sess.reduce((x, s) => x + guestRev(db, s.id), 0)
  const guestPaid = sess.reduce((x, s) => x + guestPaidRev(db, s.id), 0)

  const rows = tab === 'open' ? unclosed : tab === 'closed' ? closed : tab === 'cancelled' ? cancelled : sess

  const tabItems = [
    { value: 'all', label: t('session.tabAll'), count: sess.length },
    { value: 'open', label: t('session.tabOpen'), count: unclosed.length },
    { value: 'closed', label: t('session.tabClosed'), count: closed.length },
  ]
  if (cancelled.length > 0) {
    tabItems.push({ value: 'cancelled', label: t('session.tabCancelled'), count: cancelled.length })
  }

  const countCaption = cancelled.length > 0
    ? t('session.statCountCancelled', {
      closed: closed.length,
      open: unclosed.length,
      cancelled: cancelled.length,
    })
    : t('session.statCountCaption', { closed: closed.length, open: unclosed.length })

  return (
    <>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Lưới 2 card: Buổi trong tháng & Tiền sân */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div style={{
              background: 'var(--surface-card, #18233A)',
              border: '1px solid var(--border-subtle, #33456A)',
              borderRadius: 12,
              padding: '12px 13px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}>
              <div style={{
                font: "600 10px/1.2 var(--font-sans)",
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #9FB0C6)',
              }}>
                {t('session.statCount')}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ font: "600 26px/1 var(--font-mono)", color: 'var(--status-scheduled-fg, #7EA8FF)' }}>
                  {sess.length}
                </span>
                <span style={{ font: "500 13px/1 var(--font-sans)", color: 'var(--text-secondary, #DCE5F2)' }}>
                  {t('units.session')}
                </span>
              </div>
              <div style={{ font: "400 12px/1.4 var(--font-sans)", color: 'var(--text-muted, #A9B9CF)' }}>
                {countCaption}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-card, #18233A)',
              border: '1px solid var(--border-subtle, #33456A)',
              borderRadius: 12,
              padding: '12px 13px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}>
              <div style={{
                font: "600 10px/1.2 var(--font-sans)",
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #9FB0C6)',
              }}>
                {t('session.statCourt')}
              </div>
              <div style={{ font: "600 21px/1.1 var(--font-mono)", color: 'var(--status-incident-fg, #FF8A7A)' }}>
                {fmt(courtSpent)}
              </div>
              <div style={{ font: "400 12px/1.4 var(--font-sans)", color: 'var(--text-muted, #A9B9CF)' }}>
                {t(perMonth ? 'session.statCourtMonth' : 'session.statCourtSession')}
              </div>
            </div>
          </div>

          {/* Card Thu khách giao lưu có 2 badge */}
          <div style={{
            background: 'var(--surface-card, #18233A)',
            border: '1px solid var(--border-subtle, #33456A)',
            borderRadius: 12,
            padding: '12px 13px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{
                font: "600 10px/1.2 var(--font-sans)",
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #9FB0C6)',
              }}>
                {t('session.statGuest')}
              </div>
              <div style={{ font: "600 21px/1.1 var(--font-mono)", color: 'var(--status-delivered-fg, #4ADE80)' }}>
                {fmt(guestTotal)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'var(--status-delivered-bg, #12301F)',
                border: '1px solid rgba(18, 168, 103, 0.3)',
                font: "500 12px/1.3 var(--font-mono)",
                color: 'var(--status-delivered-fg, #7BE3A0)',
              }}>
                {t('session.statGuestPaid', { amount: fmt(guestPaid) })}
              </span>
              <span style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'var(--status-delayed-bg, #33240F)',
                border: '1px solid rgba(224, 138, 0, 0.3)',
                font: "500 12px/1.3 var(--font-mono)",
                color: 'var(--status-delayed-fg, #FBC15E)',
              }}>
                {t('session.statGuestDebt', { amount: fmt(guestTotal - guestPaid) })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...GRID_STAT, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <StatCard label={t('session.statCount')} value={sess.length} unit={t('units.session')} icon="clipboard-check"
            caption={countCaption} />
          <StatCard label={t('session.statCourt')} value={fmt(courtSpent)} icon="landmark" tone="critical"
            caption={t(perMonth ? 'session.statCourtMonth' : 'session.statCourtSession')} />
          <StatCard label={t('session.statGuest')} value={fmt(guestTotal)} icon="user-round-plus" tone="positive"
            caption={t('session.statGuestCaption', { paid: fmt(guestPaid), debt: fmt(guestTotal - guestPaid) })} />
        </div>
      )}

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
          {/* Header danh sách & đếm buổi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 2px' }}>
            <span style={{ font: "600 15px/1.2 var(--font-sans)", color: 'var(--text-primary)' }}>
              {t('session.listTitle')}
            </span>
            <span style={{ font: "400 12px/1.2 var(--font-mono)", color: 'var(--text-muted)' }}>
              {rows.length} {t('units.session')}
            </span>
          </div>

          {/* Segmented tabs lọc */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${tabItems.length}, 1fr)`,
            gap: 4,
            padding: 4,
            borderRadius: 11,
            background: 'var(--surface-sunken, #131D31)',
            border: '1px solid var(--border-subtle, #2A3A58)',
          }}>
            {tabItems.map((item) => {
              const active = tab === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => a.setTab('sessions', item.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: active ? 'var(--teal-500, #00B2A9)' : 'transparent',
                    border: 0,
                    color: active ? '#04221F' : 'var(--text-secondary)',
                    font: "600 13px/1 var(--font-sans)",
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{
                    font: "600 11px/1 var(--font-mono)",
                    color: active ? '#04221F' : 'var(--text-muted)',
                    opacity: active ? 0.85 : 1,
                  }}>
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Danh sách thẻ buổi tập */}
          {rows.length === 0 ? (
            <Empty icon="calendar-days" title={t('session.emptyTitle')} hint={t('session.emptyHint')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((s) => (
                <SessionCardMobile key={s.id} s={s} db={db} onClick={() => a.openSession(s.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card
          title={t('session.listTitle')}
          icon="list"
          padding="0"
          actions={
            <TabTrack>
              <Tabs
                variant="segmented"
                items={tabItems}
                value={tab}
                onChange={(v) => a.setTab('sessions', v)}
              />
            </TabTrack>
          }
        >
          {rows.length === 0
            ? <Empty icon="calendar-days" title={t('session.emptyTitle')} hint={t('session.emptyHint')} />
            : <DataTable columns={sessionColumns(db)} rows={rows} rowKey="id" onRowClick={(r) => a.openSession(r.id)} />}
        </Card>
      )}
    </>
  )
}
