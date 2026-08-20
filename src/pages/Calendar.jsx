// Lịch tháng: lưới 6×7, mỗi ngày hiện chip buổi màu theo trạng thái (handoff 02 §5).

import { Card } from '#ds'
import { Empty, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { monthGrid, monthTxt, WD } from '#utils/dates.js'
import { groupOf, monthSessions, statusMeta, timeTxt } from '#lib/money.js'
import { t } from '#i18n'

export default function Calendar() {
  const { db, a } = useApp()
  const weeks = monthGrid(db.month)
  const sess = monthSessions(db, db.month)

  // Gom buổi theo ngày để tra O(1) khi vẽ lưới.
  const byDate = {}
  db.sessions.forEach((s) => {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  })

  return (
    <Card
      title={t('calendar.title', { month: monthTxt(db.month).toLowerCase() })}
      subtitle={t('calendar.sub')}
      icon="calendar-days"
      padding="14px 16px"
      actions={<Mono color="var(--text-muted)">{t('calendar.countInMonth', { n: sess.length })}</Mono>}
    >
      {sess.length === 0 && <Empty icon="calendar-days" title={t('calendar.empty')} hint={t('calendar.emptyHint')} />}

      <div style={S.grid}>
        {WD.map((w) => <Overline key={w} style={S.wdHead}>{w}</Overline>)}
        {weeks.flat().map((d) => {
          const list = byDate[d.iso] || []
          const isToday = d.iso === db.today
          return (
            <div key={d.iso} style={{
              ...S.cell,
              background: d.inMonth ? 'var(--surface-card)' : 'var(--surface-inset)',
              borderColor: isToday ? 'var(--navy-700)' : 'var(--border-subtle)',
              opacity: d.inMonth ? 1 : 0.55,
            }}>
              <div style={S.dayRow}>
                <Mono weight={isToday ? 600 : 400} color={isToday ? 'var(--navy-700)' : 'var(--text-muted)'}>
                  {String(d.day).padStart(2, '0')}
                </Mono>
                {isToday && <span style={S.todayTag}>{t('calendar.today')}</span>}
              </div>
              {list.map((s) => {
                const meta = statusMeta(s.status)
                return (
                  <button key={s.id} type="button" onClick={() => a.openSession(s.id)} style={{
                    ...S.chip,
                    background: `var(--status-${meta.pill === 'cancelled' ? 'idle' : meta.pill}-bg)`,
                    color: `var(--status-${meta.pill === 'cancelled' ? 'idle' : meta.pill}-fg)`,
                  }}>
                    <span style={S.chipName}>{groupOf(db, s.groupId).short || groupOf(db, s.groupId).name}</span>
                    <span style={S.chipTime}>{timeTxt(s)}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(96px,1fr))', gap: 6, overflowX: 'auto' },
  wdHead: { textAlign: 'center', padding: '2px 0 4px' },
  cell: {
    minHeight: 84, border: '1px solid', borderRadius: 8, padding: 6,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  dayRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  todayTag: {
    font: '600 9px/1 var(--font-sans)', padding: '3px 5px', borderRadius: 99,
    background: 'var(--navy-700)', color: '#fff', whiteSpace: 'nowrap',
  },
  chip: {
    width: '100%', textAlign: 'left', border: 0, borderRadius: 6, padding: '4px 6px',
    cursor: 'pointer', display: 'grid', gap: 1, font: 'inherit',
  },
  chipName: { font: '600 11px/1.2 var(--font-sans)' },
  chipTime: { font: '400 10px/1.2 var(--font-mono)', opacity: 0.8 },
}
