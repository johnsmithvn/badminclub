import { useState } from 'react'
import { Alert, Button, Card, Dialog, Input } from '#ds'
import { Mono, Overline } from '#ui'
import { playerName } from '#lib/money.js'
import { entriesOpen } from '#lib/tournament/hub.js'
import { eventTeams } from '#lib/tournament/pairing.js'
import { RULE_PRESETS, TEMPLATES, advanceCounts, defaultStage, entrantsOf, koPreview, presetKeyOf, rrPreview, templateOf } from '#lib/tournament/format.js'
import { calcGroupBalance, snakeGroups } from '#lib/tournament/roundRobin.js'
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
  const stages = tour.stages.filter((s) => s.eventId === event.id).sort((x, y) => x.seq - y.seq)
  const saved = stages.find((s) => s.seq === 1) || null
  const stage = saved || defaultStage(event)
  const nextStage = stages.find((s) => s.seq === 2) || null
  const scheduled = Boolean(saved && saved.status !== 'pending')
  const editable = canEdit && !scheduled
  const teams = eventTeams(tour, event.id)
  const full = teams.filter((x) => x.full)

  const currentTemplate = templateOf(tour, event) || 'ko'

  const isRR = stage.type === 'round_robin'
  const preview = isRR ? rrPreview(full.length, stage) : koPreview(full.length, stage)
  const numGroups = stage.config?.numGroups || 1
  const advance = stage.config?.advancePerGroup || 2
  const plateStage = stages.find((s) => s.seq === 3) || null
  // Nhánh phụ lấy mấy hạng — đọc từ link (thứ thật sự quyết định), 'all' khi lấy thừa hạng.
  const plateLink = plateStage && (tour.stageLinks || []).find((l) => l.toStageId === plateStage.id)
  const plateK = plateLink ? (plateLink.ranks.length > 2 ? 'all' : plateLink.ranks.length) : 0
  const counts = advanceCounts(full.length, numGroups, advance, plateK)
  const nextPreview = nextStage ? koPreview(counts.main, nextStage) : null
  const platePreview = plateStage ? koPreview(counts.plate, plateStage) : null
  const koStages = stages.filter((s) => s.type === 'knockout')
  // Luật nhánh sau vòng bảng: nhánh chính và nhánh phụ dùng chung một luật.
  const saveKo = (patch) => koStages.forEach((s) => a.tourSaveStage(event.id, { ...s, ...patch(s) }))

  const seeding = stage.config?.seeding || 'seed'
  const save = (patch) => a.tourSaveStage(event.id, { ...stage, ...patch })
  const saveConfig = (cfgPatch) => save({ config: { ...stage.config, ...cfgPatch } })

  const pickTemplate = (tplKey) => {
    if (!editable || tplKey === currentTemplate) return
    a.tourSaveTemplate(event.id, tplKey)
  }

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
      : (isRR ? (full.length < numGroups * 2 ? 'tournament.format.tooFewForGroupsHint' : null) : (entrantsOf(teams, seeding).error || null))

  const row = (label, control) => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{label}</span>
      <span>{control}</span>
    </div>
  )

  const groupBal = isRR && numGroups > 1 && full.length >= numGroups * 2 ? calcGroupBalance(snakeGroups(full, numGroups)) : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px,220px) minmax(0,1fr) minmax(240px,300px)', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <Overline>{t('tournament.format.templates')}</Overline>
        {TEMPLATES.map((k) => {
          const on = currentTemplate === k
          return (
            <button key={k} type="button" disabled={!editable} onClick={() => pickTemplate(k)}
              style={{
                display: 'grid', gap: 5, textAlign: 'left', padding: '12px 14px', borderRadius: 10, color: 'inherit',
                cursor: editable ? 'pointer' : 'default', background: 'var(--surface-card)',
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
        
        {isRR ? (
          <>
            {row(t('tournament.format.groups'), (
              <Seg options={(currentTemplate === 'rr' ? [1, 2, 3, 4] : [2, 3, 4]).map((k) => ({ key: k, label: String(k) }))}
                value={numGroups} disabled={!editable}
                onChange={(k) => saveConfig({ numGroups: Number(k) })} />
            ))}
            {(currentTemplate === 'rr_ko' || currentTemplate === 'rr_ko_plate') && (
              row(t('tournament.format.advancePerGroup'), (
                <Seg options={[1, 2, 3].map((k) => ({ key: k, label: String(k) }))}
                  value={advance} disabled={!editable}
                  onChange={(k) => a.tourSetAdvance(event.id, { advance: Number(k) })} />
              ))
            )}
            {plateStage && (
              row(t('tournament.format.plateTakes'), (
                <Seg options={[1, 2, 'all'].map((k) => ({ key: k, label: t('tournament.format.plateOpt.' + k, { from: advance + 1, to: advance + 2 }) }))}
                  value={plateK} disabled={!editable}
                  onChange={(k) => a.tourSetAdvance(event.id, { plate: k })} />
              ))
            )}
            {row(t('tournament.format.legs'), (
              <Seg options={[{ key: 1, label: t('tournament.format.oneLeg') }, { key: 2, label: t('tournament.format.twoLegs') }]}
                value={stage.config?.legs || 1} disabled={!editable}
                onChange={(legs) => saveConfig({ legs: Number(legs) })} />
            ))}
            {row(t('tournament.format.qualify'), (
              <Seg options={presetOpts} value={presetKeyOf(stage.matchRule)} disabled={!editable}
                onChange={(k) => save({ matchRule: { ...RULE_PRESETS[k] } })} />
            ))}
            {nextStage && (
              <>
                {row(t('tournament.format.koQualify'), (
                  <Seg options={presetOpts} value={presetKeyOf(nextStage.matchRule)} disabled={!editable}
                    onChange={(k) => saveKo(() => ({ matchRule: { ...RULE_PRESETS[k] } }))} />
                ))}
                {row(t('tournament.format.ranking'), (
                  <Seg options={presetOpts} value={presetKeyOf(nextStage.ruleOverrides?.final)} disabled={!editable}
                    onChange={(k) => saveKo((s) => ({ ruleOverrides: { ...s.ruleOverrides, final: { ...RULE_PRESETS[k] }, third: { ...RULE_PRESETS[k] } } }))} />
                ))}
              </>
            )}
            {groupBal && (
              row(t('tournament.format.groupBalance'), (
                <Mono size={12} weight={600} color={groupBal.isBalanced ? 'var(--status-delivered-fg)' : 'var(--status-delayed-fg)'}>
                  {groupBal.isBalanced ? t('tournament.format.balanced') : t('tournament.format.unbalanced')} (±{groupBal.spread})
                </Mono>
              ))
            )}
          </>
        ) : (
          <>
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
                onChange={(k) => saveConfig({ thirdPlace: k === 'on' })} />
            ))}
            {row(t('tournament.format.seeding'), (
              <Seg options={['seed', 'slot'].map((k) => ({ key: k, label: t('tournament.format.seed.' + k) }))} value={seeding} disabled={!editable}
                onChange={(k) => saveConfig({ seeding: k })} />
            ))}
          </>
        )}
      </Card>

      <div style={{ display: 'grid', gap: 12 }}>
        <Card title={full.length >= 2 ? t('tournament.format.preview', { n: full.length }) : t('tournament.format.previewNone')} padding="10px 16px 12px">
          {isRR ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ flex: 1, font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.groupStage')} ({t('tournament.format.groupCount', { n: preview.numGroups })})</span>
                <Mono size={11} color="var(--text-muted)">{ruleLabel(preview.rule)}</Mono>
                <Mono size={12}>{t('tournament.format.previewRow', { n: preview.total })}</Mono>
              </div>
              {nextStage && nextPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ flex: 1, font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t(plateStage ? 'tournament.stage.main' : 'tournament.format.koStage')}</span>
                  <Mono size={11} color="var(--text-muted)">{ruleLabel(nextStage.matchRule)}</Mono>
                  <Mono size={12}>{t('tournament.format.previewRow', { n: nextPreview.total })}</Mono>
                </div>
              )}
              {platePreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ flex: 1, font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.stage.plate')}</span>
                  <Mono size={11} color="var(--text-muted)">{ruleLabel(plateStage.matchRule)}</Mono>
                  <Mono size={12}>{t('tournament.format.previewRow', { n: platePreview.total })}</Mono>
                </div>
              )}
              <div style={{ display: 'flex', minHeight: 36, alignItems: 'center', borderTop: '1px solid var(--border-default)' }}>
                <span style={{ flex: 1, font: '600 13px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.total')}</span>
                <Mono weight={700} size={14} color="var(--text-primary)">{preview.total + (nextPreview?.total || 0) + (platePreview?.total || 0)}</Mono>
              </div>
            </>
          ) : (
            <>
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
            </>
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
