import { useState } from 'react'
import { Alert, Button, Card, Dialog, IconButton, Input } from '#ds'
import { Overline } from '#ui'
import { TEMPLATES, advanceCounts, defaultStage, templateOf } from '#lib/tournament/format.js'
import { eventTeams } from '#lib/tournament/pairing.js'
import { t } from '#i18n'

/**
 * Thể thức (handoff `isFormat`): chọn mẫu để dựng giai đoạn đầu tiên — mọi chỉnh sửa sâu (số bảng, luật,
 * bốc thăm, gợi ý thể thức, lưu mẫu CLB) đã dời hết sang "Sửa trên sơ đồ tự do" (FlowCanvas), tránh 2 màn
 * làm cùng một việc. Tab này còn lại 3 việc: chọn/xoá mẫu, xem nhanh hình giai đoạn, trạng thái sinh lịch.
 */
export default function FormatTab({ tour, event, a, canEdit, isMobile, onOpenBracket, onOpenFlow }) {
  const [resetting, setResetting] = useState(false)
  const stages = tour.stages.filter((s) => s.eventId === event.id).sort((x, y) => x.seq - y.seq)
  const saved = stages.find((s) => s.seq === 1) || null
  const stage = saved || defaultStage(event)
  const nextStage = stages.find((s) => s.seq === 2) || null
  const scheduled = Boolean(saved && saved.status !== 'pending')
  const editable = canEdit && !scheduled
  const full = eventTeams(tour, event.id).filter((x) => x.full)

  const currentTemplate = templateOf(tour, event) || 'ko'
  const isRR = stage.type === 'round_robin'
  const numGroups = stage.config?.numGroups || 1
  const advance = stage.config?.advancePerGroup || 2
  const plateStage = stages.find((s) => s.seq === 3) || null
  const plateLink = plateStage && (tour.stageLinks || []).find((l) => l.toStageId === plateStage.id)
  const plateK = plateLink ? (plateLink.ranks.length > 2 ? 'all' : plateLink.ranks.length) : 0
  const counts = advanceCounts(full.length, numGroups, advance, plateK)
  const matchCount = tour.matches.filter((m) => m.eventId === event.id && m.status !== 'bye').length

  const pickTemplate = (tplKey) => {
    if (!editable || tplKey === currentTemplate) return
    a.tourSaveTemplate(event.id, tplKey)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(200px,240px) minmax(0,1fr) minmax(240px,300px)', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Overline>{t('tournament.format.templates')}</Overline>
        {TEMPLATES.map((k) => {
          const on = currentTemplate === k
          return (
            <button key={k} type="button" disabled={!editable} onClick={() => pickTemplate(k)}
              style={{
                display: 'grid', gap: 5, textAlign: 'left', padding: '12px 14px', borderRadius: 10, color: 'inherit',
                cursor: editable ? 'pointer' : 'default', background: 'var(--surface-card)',
                border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                boxShadow: on ? '0 0 0 1px var(--teal-500)' : 'var(--shadow-xs)',
                transition: 'border-color .2s, box-shadow .2s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ font: '700 13.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.tpl.' + k)}</span>
                {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-500)' }} />}
              </div>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.tplSub.' + k)}</span>
            </button>
          )
        })}
        {currentTemplate === 'custom' && !scheduled && (
          <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--teal-500)', font: '600 12.5px/1.3 var(--font-sans)', color: 'var(--teal-300)', background: 'rgba(0, 178, 169, 0.05)' }}>
            {t('tournament.format.customized')}
          </div>
        )}
        {/* Mẫu CLB đã lưu (0060): bấm để dựng lại sơ đồ trong 1 bước */}
        {(tour.templates || []).map((x) => (
          <div key={x.id} style={{ position: 'relative' }}>
            <button type="button" disabled={!editable} onClick={() => pickTemplate('club:' + x.id)}
              style={{
                width: '100%', display: 'grid', gap: 5, textAlign: 'left', padding: '12px 34px 12px 14px', borderRadius: 10, color: 'inherit',
                cursor: editable ? 'pointer' : 'default', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
              }}>
              <span style={{ font: '700 13.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{x.name}</span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.clubTemplate', { n: x.graph?.stages?.length || 0 })}</span>
            </button>
            {canEdit && (
              <IconButton icon="trash-2" size="sm" label={t('tournament.format.deleteTemplate')} onClick={() => a.tourDeleteClubTemplate(x.id)}
                style={{ position: 'absolute', right: 6, top: 8 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* Stage Flow Pipeline (Diagram luồng đấu trực quan theo handoff) — chỉ xem, sửa ở Sơ đồ */}
        <div style={{
          padding: '14px 16px', background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--teal-500)', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, display: 'grid', placeItems: 'center', background: 'var(--teal-500)', color: '#04302C', font: '700 10.5px/1 var(--font-mono)' }}>1</span>
              <span style={{ font: '700 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
                {isRR ? t('tournament.format.groupStage') : t('tournament.round.final')}
              </span>
            </div>
            <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>
              {isRR ? t('tournament.format.groupSub', { groups: numGroups, teams: full.length }) : t('tournament.format.koSub', { teams: full.length })}
            </span>
          </div>
          {nextStage && (
            <>
              <span style={{ color: 'var(--border-strong)', font: '600 14px/1 var(--font-mono)' }}>──→</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-default)', minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, display: 'grid', placeItems: 'center', background: 'var(--surface-accent-soft)', color: 'var(--teal-300)', font: '700 10.5px/1 var(--font-mono)' }}>2</span>
                  <span style={{ font: '700 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
                    {t(plateStage ? 'tournament.stage.main' : 'tournament.format.koStage')}
                  </span>
                </div>
                <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{t('tournament.format.advanceSub', { n: counts.main })}</span>
              </div>
            </>
          )}
          {plateStage && (
            <>
              <span style={{ color: 'var(--border-strong)', font: '600 14px/1 var(--font-mono)' }}>──→</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-default)', minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, display: 'grid', placeItems: 'center', background: 'var(--surface-accent-soft)', color: 'var(--text-secondary)', font: '700 10.5px/1 var(--font-mono)' }}>3</span>
                  <span style={{ font: '700 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.stage.plate')}</span>
                </div>
                <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{t('tournament.format.plateSub', { n: counts.plate })}</span>
              </div>
            </>
          )}
        </div>

        <Card title={t('tournament.format.schedule')} padding="12px 16px">
          {scheduled ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--status-delivered-fg)' }}>
                {t('tournament.format.generated', { n: matchCount })}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" iconAfter="arrow-right" onClick={() => onOpenBracket(event.id)}>{t('tournament.format.openBracket')}</Button>
                {canEdit && <Button size="sm" variant="secondary" icon="rotate-ccw" onClick={() => setResetting(true)}>{t('tournament.format.reset')}</Button>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <Alert tone="info">{t('tournament.format.continueOnCanvas')}</Alert>
              {onOpenFlow && <div><Button iconAfter="arrow-right" onClick={() => onOpenFlow(event.id)}>{t('tournament.format.editOnCanvas')}</Button></div>}
            </div>
          )}
        </Card>
      </div>

      {resetting && <ResetDialog onClose={() => setResetting(false)} onReset={(reason) => a.tourResetSchedule(event.id, reason)} />}
    </div>
  )
}

function ResetDialog({ onClose, onReset }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    if (await onReset(reason.trim())) onClose()
    else setBusy(false)
  }
  return (
    <Dialog open width={460} title={t('tournament.format.resetTitle')} description={t('tournament.format.resetBody')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={submit}>{t('tournament.format.reset')}</Button>
        </>
      )}>
      <Input label={t('tournament.format.resetReason')} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </Dialog>
  )
}
