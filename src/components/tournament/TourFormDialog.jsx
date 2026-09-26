import { useState } from 'react'
import { Alert, Button, Dialog, Input } from '#ds'
import { fmtK, intOf } from '#lib/money.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'

const blank = { name: '', startsOn: '', startTime: '', endTime: '', venue: '', courtLabels: [], feeMale: '', feeFemale: '', scope: 'club_only' }

/** Tạo / sửa thông tin chung của giải. `tour` rỗng = tạo mới. onSave(form) trả true khi xong. */
export default function TourFormDialog({ tour, onClose, onSave }) {
  // Tiền giữ nguyên chuỗi đang gõ, chỉ đổi sang số lúc lưu (khuôn của Dialogs.jsx) — định dạng
  // lại ở mỗi phím gõ thì fmtK làm tròn nghìn, gõ "15" là ô nhảy về 0.
  const [f, setF] = useState(() => {
    const x = { ...blank, ...(tour || {}) }
    return { ...x, feeMale: x.feeMale ? fmtK(x.feeMale) : '', feeFemale: x.feeFemale ? fmtK(x.feeFemale) : '' }
  })
  const [courts, setCourts] = useState((tour?.courtLabels || []).join(', '))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    if (!f.name.trim() || !f.startsOn) return setErr(t('tournament.form.needName'))
    setBusy(true)
    const ok = await onSave({
      name: f.name.trim(), startsOn: f.startsOn, startTime: f.startTime || null, endTime: f.endTime || null,
      venue: f.venue.trim(), feeMale: intOf(f.feeMale), feeFemale: intOf(f.feeFemale),
      courtLabels: courts.split(',').map((s) => s.trim()).filter(Boolean),
      scope: f.scope === 'open' ? 'open' : 'club_only',
    })
    if (!ok) setBusy(false)
  }

  const row = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }
  return (
    <Dialog
      open
      width={560}
      title={t(tour ? 'tournament.form.editTitle' : 'tournament.form.createTitle')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} onClick={submit}>{t(tour ? 'common.save' : 'tournament.create')}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Input label={t('tournament.form.name')} value={f.name} onChange={set('name')} autoFocus />
        <div style={row}>
          <Input label={t('tournament.form.startsOn')} type="date" mono value={f.startsOn} onChange={set('startsOn')} />
          <Input label={t('tournament.form.startTime')} type="time" mono value={f.startTime || ''} onChange={set('startTime')} />
          <Input label={t('tournament.form.endTime')} type="time" mono value={f.endTime || ''} onChange={set('endTime')} />
        </div>
        <Input label={t('tournament.form.venue')} value={f.venue} onChange={set('venue')} />
        {/* Mở rộng = thêm được người ngoài CLB ở tab Thí sinh (0059). */}
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.form.scope')}</span>
          <Seg options={['club_only', 'open'].map((k) => ({ key: k, label: t('tournament.scope.' + k) }))} value={f.scope || 'club_only'}
            onChange={(k) => setF((x) => ({ ...x, scope: k }))} />
        </div>
        <Input label={t('tournament.form.courts')} hint={t('tournament.form.courtsHint')} value={courts}
          onChange={(e) => setCourts(e.target.value)} />
        <div style={row}>
          <Input label={t('tournament.form.feeMale')} mono inputMode="numeric" suffix={t('units.dong')}
            value={f.feeMale} onChange={set('feeMale')} />
          <Input label={t('tournament.form.feeFemale')} mono inputMode="numeric" suffix={t('units.dong')}
            value={f.feeFemale} onChange={set('feeFemale')} />
        </div>
        {tour && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.form.feeHint')}</div>}
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Dialog>
  )
}
