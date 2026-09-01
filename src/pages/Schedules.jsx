// Lịch tập cố định: tạo một lần, sinh buổi cho cả kỳ (handoff 02 §5).

import { Button, Card, DataTable } from '#ds'
import { Empty, Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { WD, ddmy } from '#utils/dates.js'
import { courtOf, groupOf } from '#lib/money.js'
import { editScheduleForm, scheduleForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function Schedules({ canEdit: propCanEdit }) {
  const { db, a } = useApp()
  const canEdit = propCanEdit !== undefined ? propCanEdit : can(db.viewAs || 'owner', 'sessions')

  const columns = [
    { key: 'name', header: t('schedules.colName'), render: (r) => r.name },
    { key: 'group', header: t('schedules.colGroup'), render: (r) => groupOf(db, r.groupId).name },
    {
      key: 'wd', header: t('schedules.colWeekdays'), mono: true,
      render: (r) => (r.weekdays || []).map((w) => WD[w]).join(', '),
    },
    {
      key: 'courts', header: t('schedules.colCourts'), mono: true, muted: true,
      render: (r) => (r.rows || []).map((x) => courtOf(db, x.courtId).name + ' ' + x.from + '→' + x.to).join(' · '),
    },
    {
      key: 'range', header: t('schedules.colRange'), mono: true,
      render: (r) => ddmy(r.start) + ' → ' + (r.end ? ddmy(r.end) : t('schedules.openEnded')),
    },
    {
      key: 'n', header: t('schedules.colSessions'), align: 'right', mono: true,
      render: (r) => t('schedules.sessionsGenerated', { n: db.sessions.filter((s) => s.scheduleId === r.id).length }),
    },
    {
      key: 'st', header: t('schedules.colStatus'),
      render: (r) => (
        <span style={{
          font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
          background: r.active ? 'var(--status-transit-bg)' : 'var(--status-idle-bg)',
          color: r.active ? 'var(--status-transit-fg)' : 'var(--status-idle-fg)',
        }}>
          {t(r.active ? 'schedules.active' : 'schedules.paused')}
        </span>
      ),
    },
    {
      key: 'act', header: '', align: 'right',
      render: (r) => canEdit && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" icon="settings-2"
            onClick={() => a.openDialog('schedule', editScheduleForm(r))}>
            {t('schedules.edit')}
          </Button>
          <Button variant="ghost" size="sm" icon={r.active ? 'pause' : 'play'}
            onClick={() => a.toggleSchedule(r.id)}>
            {t(r.active ? 'schedules.turnOff' : 'schedules.turnOn')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card
      title={t('schedules.listTitle')}
      subtitle={t('schedules.listSub')}
      icon="repeat"
      padding="0"
      actions={canEdit && (
        <Button variant="primary" size="sm" icon="repeat"
          onClick={() => a.openDialog('schedule', scheduleForm(db))}>
          {t('schedules.create')}
        </Button>
      )}
    >
      {db.schedules.length === 0
        ? <Empty icon="repeat" title={t('schedules.empty')} hint={t('schedules.emptyHint')} />
        : <DataTable columns={columns} rows={db.schedules} rowKey="id" />}
    </Card>
  )
}
