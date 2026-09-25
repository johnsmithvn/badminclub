import { useState } from 'react'
import { Alert, Button, Card, Dialog, Input } from '#ds'
import { Mono, Overline } from '#ui'
import { playerName } from '#lib/money.js'
import { entriesOpen } from '#lib/tournament/hub.js'
import { eventTeams } from '#lib/tournament/pairing.js'
import { RULE_PRESETS, TEMPLATES, defaultStage, entrantsOf, koPreview, presetKeyOf } from '#lib/tournament/format.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'
import { ruleLabel } from './tourUtils.js'

const presetOpts = Object.keys(RULE_PRESETS).map((k) => ({ key: k, label: t('tournament.format.preset.' + k) }))

/**
 * Thể thức (handoff `isFormat`): trái mẫu có sẵn · giữa thẻ giai đoạn (các hàng tuỳ chọn) · phải xem trước
 * + lịch thi đấu. Mỗi lần chọn lưu ngay. Đã có lịch thì khoá — luật đã chép vào từng trận.
 */
export default function FormatTab({ tour, event, db, a, canEdit, isMobile, onOpenBracket }) {
  const [resetting, setResetting] = useState(false)
  const [swapFrom, setSwapFrom] = useState(null) // đội đang chọn để đổi số bốc thăm
  const saved = tour.stages.find((s) => s.eventId === event.id && s.seq === 1) || null
  const stage = saved || defaultStage(event)
  const scheduled = Boolean(saved && saved.status !== 'pending')
  const editable = canEdit && !scheduled
  const teams = eventTeams(tour, event.id)
  const full = teams.filter((x) => x.full)
  const preview = koPreview(full.length, stage)
  const seeding = stage.config?.seeding || 'seed'
  const save = (patch) => a.tourSaveStage(event.id, { ...stage, ...patch })
  // Đổi chỗ trong nhánh = đổi số bốc thăm hai đội (chỉ trước khi có lịch, mọi đội đã có số).
  const canSwap = editable && !entriesOpen(event) && teams.filter((x) => x.full).every((x) => Number.isInteger(x.drawNo))
  const pickSwap = (teamId) => {
    if (!swapFrom) return setSwapFrom(teamId)
    if (swapFrom !== teamId) a.tourSwapDraw(event.id, swapFrom, teamId)
    setSwapFrom(null)
  }
  const matchCount = tour.matches.filter((m) => m.eventId === event.id && m.status !== 'bye').length

  // Còn thiếu bước nào trước khi tạo lịch — nói đúng bước, không để nút xám câm.
  const blocker = !saved ? 'tournament.format.needFormat'
    : entriesOpen(event) ? 'tournament.format.needLineup'
      : entrantsOf(teams, seeding).error || null

  const row = (label, control) => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{label}</span>
      <span>{control}</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px,220px) minmax(0,1fr) minmax(240px,300px)', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <Overline>{t('tournament.format.templates')}</Overline>
        {TEMPLATES.map((k) => {
          const on = Boolean(saved)
          return (
            <button key={k} type="button" disabled={!editable} onClick={() => !saved && save(defaultStage(event))}
              style={{
                display: 'grid', gap: 5, textAlign: 'left', padding: '12px 14px', borderRadius: 10, color: 'inherit',
                cursor: editable && !saved ? 'pointer' : 'default', background: 'var(--surface-card)',
                border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`, boxShadow: on ? '0 0 0 1px var(--teal-500)' : 'var(--shadow-xs)',
              }}>
              <span style={{ font: '700 13.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.tpl.' + k)}</span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.tplSub.' + k)}</span>
            </button>
          )
        })}
      </div>

      <Card title={t('tournament.format.title', { name: t('tournament.kind.' + event.kind) })} icon="settings-2" padding="12px 18px 6px">
        {scheduled && <Alert tone="info">{t('tournament.format.lockedRules')}</Alert>}
        {row(t('tournament.format.qualify'), (
          <Seg options={presetOpts} value={presetKeyOf(stage.matchRule)} disabled={!editable}
            onChange={(k) => save({ matchRule: { ...RULE_PRESETS[k] } })} />
        ))}
        {row(t('tournament.format.ranking'), (
          <Seg options={presetOpts} value={presetKeyOf(stage.ruleOverrides?.final)} disabled={!editable}
            onChange={(k) => save({ ruleOverrides: { ...stage.ruleOverrides, final: { ...RULE_PRESETS[k] }, third: { ...RULE_PRESETS[k] } } })} />
        ))}
        {row(t('tournament.format.thirdPlace'), (
          <Seg options={[{ key: 'on', label: t('tournament.format.on') }, { key: 'off', label: t('tournament.format.off') }]}
            value={stage.config?.thirdPlace ? 'on' : 'off'} disabled={!editable}
            onChange={(k) => save({ config: { ...stage.config, thirdPlace: k === 'on' } })} />
        ))}
        {row(t('tournament.format.seeding'), (
          <Seg options={['seed', 'slot'].map((k) => ({ key: k, label: t('tournament.format.seed.' + k) }))} value={seeding} disabled={!editable}
            onChange={(k) => save({ config: { ...stage.config, seeding: k } })} />
        ))}
      </Card>

      <div style={{ display: 'grid', gap: 12 }}>
        <Card title={full.length >= 2 ? t('tournament.format.preview', { n: full.length }) : t('tournament.format.previewNone')} padding="10px 16px 12px">
          {preview.rounds.map((r) => (
            <div key={r.kind} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ flex: 1, font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.round.' + r.kind)}</span>
              <Mono size={11} color="var(--text-muted)">{ruleLabel(r.rule)}</Mono>
              <Mono size={12}>{t('tournament.format.previewRow', { n: r.matches })}</Mono>
            </div>
          ))}
          {preview.byes > 0 && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', paddingTop: 6 }}>{t('tournament.format.byes', { n: preview.byes })}</div>}
          {preview.total > 0 && (
            <div style={{ display: 'flex', minHeight: 36, alignItems: 'center', borderTop: '1px solid var(--border-default)' }}>
              <span style={{ flex: 1, font: '600 13px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.total')}</span>
              <Mono weight={700} size={14} color="var(--text-primary)">{preview.total}</Mono>
            </div>
          )}
        </Card>

        {seeding === 'slot' && full.length > 0 && (
          <Card title={t('tournament.format.draw')} subtitle={t('tournament.format.drawHint')} padding="10px 16px 12px"
            actions={editable && !entriesOpen(event) && (
              <Button size="sm" variant="secondary" icon="rotate-ccw" onClick={() => a.tourDraw(event.id)}>
                {t(full.some((x) => x.drawNo) ? 'tournament.format.redraw' : 'tournament.format.draw')}
              </Button>
            )}>
            {canSwap && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', paddingBottom: 6 }}>{t('tournament.format.swapHint')}</div>}
            {[...full].sort((x, y) => (x.drawNo ?? 99) - (y.drawNo ?? 99)).map((team) => (
              <div key={team.id}
                role={canSwap ? 'button' : undefined}
                tabIndex={canSwap ? 0 : undefined}
                aria-pressed={canSwap ? swapFrom === team.id : undefined}
                onClick={canSwap ? () => pickSwap(team.id) : undefined}
                onKeyDown={canSwap ? (e) => e.key === 'Enter' && pickSwap(team.id) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderTop: '1px solid var(--border-subtle)',
                  cursor: canSwap ? 'pointer' : 'default', borderRadius: 6, padding: '0 6px',
                  background: swapFrom === team.id ? 'var(--surface-accent-soft)' : 'transparent',
                }}>
                <Mono weight={700} size={12} color="var(--text-primary)" style={{ width: 34 }}>
                  {team.drawNo ? t('tournament.format.drawNo', { n: team.drawNo }) : '—'}
                </Mono>
                <span style={{ font: '500 12.5px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>
                  {team.players.map((p) => playerName(db, p.playerId)).join(' · ')}
                </span>
              </div>
            ))}
          </Card>
        )}

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
              {blocker && <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed-fg)' }}>{t(blocker)}</span>}
              {canEdit && <div><Button icon="calendar-plus" disabled={Boolean(blocker)} onClick={() => a.tourGenerate(event.id)}>{t('tournament.format.generate')}</Button></div>}
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
