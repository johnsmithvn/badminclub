import React from 'react'
import { Button } from '#ds'
import {
  SettingsCard,
  EmptyState,
} from '#components/settings/SettingsComponents.jsx'
import { WD, ddmy } from '#utils/dates.js'
import { courtOf, groupOf } from '#lib/money.js'
import { editScheduleForm, scheduleForm } from '#lib/forms.js'
import { planScheduleDelete } from '#lib/schedules.js'
import { t } from '#i18n'

export default function SchedulesTab({
  db,
  canEdit = true,
  onOpenDialog,
  onToggleSchedule,
  onDeleteSchedule,
}) {
  const schedules = db.schedules || []

  return (
    <SettingsCard
      title={t('schedules.listTitle')}
      subtitle={t('schedules.listSub')}
      icon="repeat"
      fullWidth
      action={
        canEdit && (
          <Button
            variant="primary"
            size="sm"
            icon="repeat"
            onClick={() => onOpenDialog('schedule', scheduleForm(db))}
          >
            {t('schedules.create')}
          </Button>
        )
      }
      bodyPadding="0 20px 20px"
    >
      {schedules.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={t('schedules.empty')}
          hint={t('schedules.emptyHint')}
        />
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1.6fr 1.5fr 90px 100px 140px',
              background: '#f7f9fc',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.07em',
              color: '#8b98ab',
            }}
          >
            <div>{t('settings.colScheduleName')}</div>
            <div>{t('settings.colScheduleGroup')}</div>
            <div>{t('settings.colScheduleWeekdays')}</div>
            <div>{t('settings.colScheduleCourtsTime')}</div>
            <div>{t('settings.colScheduleDateRange')}</div>
            <div style={{ textAlign: 'right' }}>{t('settings.colScheduleGenerated')}</div>
            <div style={{ textAlign: 'center' }}>{t('settings.colScheduleStatus')}</div>
            <div style={{ textAlign: 'right' }}></div>
          </div>

          {schedules.map((r) => {
            const drop = planScheduleDelete(db, r)
            const count = (db.sessions || []).filter((s) => s.scheduleId === r.id).length
            const grp = groupOf(db, r.groupId)
            const weekdaysText = (r.weekdays || []).map((w) => WD[w]).join(', ')
            const courtsText = (r.rows || [])
              .map((x) => `${courtOf(db, x.courtId).name} ${x.from}→${x.to}`)
              .join(' · ')
            const dateRange = `${ddmy(r.start)} → ${r.end ? ddmy(r.end) : t('schedules.openEnded')}`

            return (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1.6fr 1.5fr 90px 100px 140px',
                  alignItems: 'center',
                  padding: '12px 12px',
                  borderBottom: '1px solid #f6f8fb',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: '#10203c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </div>
                <div style={{ color: '#42526b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {grp.name}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: '#2a3a54' }}>
                  {weekdaysText}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#5c6b81' }}>
                  {courtsText}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#42526b' }}>
                  {dateRange}
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#10203c' }}>
                  {t('settings.sessionsCount', { count })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span
                    style={{
                      font: '600 11px/1 var(--font-sans)',
                      padding: '4px 8px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                      background: r.active ? '#eef7f6' : '#f2f5f9',
                      border: `1px solid ${r.active ? '#cfe7e5' : '#e4e9f1'}`,
                      color: r.active ? '#0a6f6d' : '#8b98ab',
                    }}
                  >
                    {r.active ? t('settings.running') : t('settings.paused')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenDialog('schedule', editScheduleForm(r))}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#0d8b8a',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSchedule && onToggleSchedule(r.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#0d8b8a',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {r.active ? t('settings.turnOff') : t('settings.turnOn')}
                      </button>
                      <button
                        type="button"
                        disabled={!drop.ok}
                        title={!drop.ok ? t('schedules.delBlocked') : undefined}
                        onClick={() => onDeleteSchedule && onDeleteSchedule(r.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: drop.ok ? '#c0392b' : '#a9b4c4',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: drop.ok ? 'pointer' : 'not-allowed',
                          padding: 0,
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SettingsCard>
  )
}
