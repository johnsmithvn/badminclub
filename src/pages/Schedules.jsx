// Lịch tập cố định: tạo một lần, sinh buổi cho cả kỳ (handoff 02 §5).

import { useApp } from '#contexts/AppContext.jsx'
import { can } from '#lib/roles.js'
import SchedulesTab from '#components/settings/tabs/SchedulesTab.jsx'
import { t } from '#i18n'

export default function Schedules({ canEdit: propCanEdit }) {
  const { db, a } = useApp()
  const canEdit = propCanEdit !== undefined ? propCanEdit : can(db.viewAs || 'owner', 'sessions')

  return (
    <SchedulesTab
      db={db}
      canEdit={canEdit}
      onOpenDialog={(name, param) => a.openDialog(name, param)}
      onToggleSchedule={(id) => a.toggleSchedule(id)}
      onDeleteSchedule={(id, name, futureCount) => {
        a.confirm({
          title: t('schedules.delConfirmTitle', { name }),
          message: t('schedules.delConfirmMsg', { n: futureCount }),
          tone: 'danger',
          confirmText: t('common.delete'),
          onConfirm: () => a.deleteSchedule(id),
        })
      }}
    />
  )
}
