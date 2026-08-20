// Tất cả dialog của app, mount một lần ở AppLayout. ui.dialog quyết định cái nào mở.
// Form nằm ở ui.form; giá trị mặc định ở #lib/forms.js.

import { Button, Dialog, Input, Select, Switch } from '#ds'
import { Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { WD, dd, genDates } from '#utils/dates.js'
import { estSessions, fmtK, genderTxt, stock } from '#lib/money.js'
import { MANUAL_CATS, catLabel } from '#lib/ledger.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Dialogs() {
  const { ui } = useApp()
  const D = {
    schedule: ScheduleDialog,
    adhoc: AdhocDialog,
    addcourt: AddCourtDialog,
    newCourt: NewCourtDialog,
    newGroup: NewGroupDialog,
    purchase: PurchaseDialog,
    check: CheckDialog,
    bill: BillDialog,
    ledger: LedgerDialog,
    addMember: AddMemberDialog,
    editMember: EditMemberDialog,
    zalo: ZaloDialog,
  }[ui.dialog]
  return D ? <D /> : null
}

/* ---------------- helper dùng chung ---------------- */

function Shell({ title, desc, width, onSubmit, submitLabel, submitIcon, children, disabled }) {
  const { a } = useApp()
  return (
    <Dialog open title={title} description={desc} width={width || 560} onClose={() => a.closeDialog()}>
      <div style={{ display: 'grid', gap: 12 }}>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <Button variant="secondary" onClick={() => a.closeDialog()}>{t('common.cancel')}</Button>
          {onSubmit && (
            <Button variant="primary" icon={submitIcon || 'check'} onClick={onSubmit} disabled={disabled}>
              {submitLabel || t('common.save')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const Note = ({ children, tone }) => (
  <div style={{
    padding: '10px 12px', borderRadius: 8, font: 'var(--type-caption)',
    background: tone === 'warn' ? 'var(--status-delayed-bg)' : 'var(--surface-inset)',
    color: tone === 'warn' ? 'var(--status-delayed-fg)' : 'var(--text-secondary)',
  }}>
    {children}
  </div>
)

/** Các dòng sân dùng chung cho dialog tạo lịch và buổi đột xuất. */
function CourtRows() {
  const { db, ui, a } = useApp()
  const rows = ui.form.rows || []
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Overline>{t('schedules.fCourts')}</Overline>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
          <Select value={r.courtId} options={db.courts.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(e) => a.setRow(i, 'courtId', e.target.value)} />
          <Input type="time" mono value={r.from} onChange={(e) => a.setRow(i, 'from', e.target.value)} />
          <Input type="time" mono value={r.to} onChange={(e) => a.setRow(i, 'to', e.target.value)} />
          <Button variant="ghost" size="sm" icon="trash-2" disabled={rows.length < 2}
            onClick={() => a.delRow(i)} />
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => a.addRow()}>{t('schedules.addRow')}</Button>
      </div>
    </div>
  )
}

/* ---------------- tạo lịch hàng loạt ---------------- */

function ScheduleDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const dates = genDates(f.weekdays, f.start, f.end)

  return (
    <Shell title={t('schedules.dlgTitle')} desc={t('schedules.dlgDesc')} width={620}
      onSubmit={() => a.createSchedule(dates)} submitLabel={t('common.create')} submitIcon="repeat"
      disabled={!dates.length}>
      <Input label={t('schedules.fName')} value={f.sName || ''} onChange={(e) => a.setF('sName', e.target.value)} />
      <Select label={t('schedules.fGroup')} value={f.sGroup}
        options={db.groups.map((g) => ({ value: g.id, label: g.name }))}
        onChange={(e) => a.setF('sGroup', e.target.value)} />

      <div style={{ display: 'grid', gap: 6 }}>
        <Overline>{t('schedules.fWeekdays')}</Overline>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WD.map((w, i) => {
            const on = (f.weekdays || []).indexOf(i) >= 0
            return (
              <button key={i} type="button" onClick={() => a.toggleWeekday(i)} style={{
                padding: '7px 12px', borderRadius: 99, border: '1px solid',
                borderColor: on ? 'var(--navy-700)' : 'var(--border-subtle)',
                background: on ? 'var(--navy-700)' : 'var(--surface-card)',
                color: on ? '#fff' : 'var(--text-primary)',
                font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
              }}>{w}</button>
            )
          })}
        </div>
      </div>

      <CourtRows />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('schedules.fFrom')} type="date" mono value={f.start || ''}
          onChange={(e) => a.setF('start', e.target.value)} />
        <Input label={t('schedules.fTo')} type="date" mono value={f.end || ''}
          onChange={(e) => a.setF('end', e.target.value)} />
      </div>

      <Note>
        {dates.length
          ? t('schedules.preview', { n: dates.length, from: dd(dates[0]), to: dd(dates[dates.length - 1]) })
          : t('schedules.previewNone')}
        <div style={{ marginTop: 4, opacity: 0.85 }}>{t('schedules.previewSkip')}</div>
      </Note>
    </Shell>
  )
}

/* ---------------- buổi đột xuất ---------------- */

function AdhocDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('adhoc.dlgTitle')} desc={t('adhoc.dlgDesc')} width={560}
      onSubmit={() => a.createAdhoc()} submitLabel={t('common.create')} submitIcon="calendar-plus">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('adhoc.fDate')} type="date" mono value={f.aDate || ''}
          onChange={(e) => a.setF('aDate', e.target.value)} />
        <Select label={t('adhoc.fGroup')} value={f.aGroup}
          options={[{ value: 'ALL', label: t('adhoc.allClub') }].concat(
            db.groups.map((g) => ({ value: g.id, label: g.name }))
          )}
          onChange={(e) => a.setF('aGroup', e.target.value)} />
      </div>
      <CourtRows />
    </Shell>
  )
}

/* ---------------- thêm sân cho buổi ---------------- */

function AddCourtDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('addCourt.dlgTitle')} desc={t('addCourt.dlgDesc')}
      onSubmit={() => a.addSessionCourt()} submitLabel={t('common.add')} submitIcon="plus">
      <Select label={t('addCourt.fCourt')} value={f.acCourt}
        options={db.courts.map((c) => ({ value: c.id, label: c.name + ' · ' + fmtK(c.price) + ' đ/h' }))}
        onChange={(e) => a.setF('acCourt', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('addCourt.fFrom')} type="time" mono value={f.acFrom || ''}
          onChange={(e) => a.setF('acFrom', e.target.value)} />
        <Input label={t('addCourt.fTo')} type="time" mono value={f.acTo || ''}
          onChange={(e) => a.setF('acTo', e.target.value)} />
      </div>
      <Note tone="warn">{t('session.courtRule')}</Note>
    </Shell>
  )
}

/* ---------------- nhập kho cầu ---------------- */

function PurchaseDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const type = db.shuttleTypes.find((x) => x.id === f.pType) || db.shuttleTypes[0] || { perTube: cfg.shuttle.perTubeDefault }
  const qty = (parseInt(f.pTubes || 0, 10) || 0) * type.perTube + (parseInt(f.pExtra || 0, 10) || 0)
  const total = parseInt(f.pTotal || 0, 10) || 0

  return (
    <Shell title={t('shuttles.dlgTitle')} desc={t('shuttles.dlgDesc')}
      onSubmit={() => a.createPurchase()} submitLabel={t('shuttles.addPurchase')} submitIcon="shopping-cart">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('shuttles.fDate')} type="date" mono value={f.pDate || ''}
          onChange={(e) => a.setF('pDate', e.target.value)} />
        <Select label={t('shuttles.fType')} value={f.pType}
          options={db.shuttleTypes.map((x) => ({ value: x.id, label: x.name + ' · ' + x.perTube + ' quả/ống' }))}
          onChange={(e) => a.setF('pType', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 10 }}>
        <Input label={t('shuttles.fTubes')} mono value={String(f.pTubes ?? '')}
          onChange={(e) => a.setF('pTubes', e.target.value)} />
        <Input label={t('shuttles.fExtra')} mono value={String(f.pExtra ?? '')}
          onChange={(e) => a.setF('pExtra', e.target.value)} />
        <Input label={t('shuttles.fTotal')} mono suffix={t('units.dong')} value={String(f.pTotal ?? '')}
          onChange={(e) => a.setF('pTotal', e.target.value)} />
      </div>
      <Input label={t('shuttles.fPayer')} value={f.pPayer || ''} onChange={(e) => a.setF('pPayer', e.target.value)} />
      <Note>
        {!qty
          ? t('shuttles.previewNeedQty')
          : !total
            ? t('shuttles.previewNeedTotal', { qty })
            : t('shuttles.preview', { qty, unit: fmtK(Math.round(total / qty)) })}
      </Note>
    </Shell>
  )
}

/* ---------------- kiểm kho ---------------- */

function CheckDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const st = stock(db)
  const est = estSessions(db, db.month)
  const counted = parseInt(f.ckCount || 0, 10) || 0
  const diff = st.left - counted

  return (
    <Shell title={t('shuttles.checkDlgTitle')} desc={t('shuttles.checkDlgDesc')}
      onSubmit={() => a.applyCheck()} submitLabel={t('shuttles.doCheck')} submitIcon="scale">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('shuttles.fCheckDate')} type="date" mono value={f.ckDate || ''}
          onChange={(e) => a.setF('ckDate', e.target.value)} />
        <Input label={t('shuttles.fCheckCount')} mono suffix={t('units.shuttle')} value={String(f.ckCount ?? '')}
          onChange={(e) => a.setF('ckCount', e.target.value)} />
      </div>
      <Note tone={diff !== 0 && !est.length ? 'warn' : undefined}>
        {t('shuttles.checkPreview', { system: st.left, diff: (diff > 0 ? '+' : '') + diff, n: est.length })}
        {diff !== 0 && !est.length && <div style={{ marginTop: 4 }}>{t('shuttles.checkNoEst')}</div>}
      </Note>
    </Shell>
  )
}

/* ---------------- hoá đơn sân ---------------- */

function BillDialog() {
  const { ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('fund.billDlgTitle')} desc={t('fund.billDlgDesc')}
      onSubmit={() => a.createCourtBill()} submitLabel={t('common.save')} submitIcon="landmark">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('fund.billDate')} type="date" mono value={f.bDate || ''}
          onChange={(e) => a.setF('bDate', e.target.value)} />
        <Input label={t('fund.fMonth')} mono value={f.bMonth || ''} onChange={(e) => a.setF('bMonth', e.target.value)} />
      </div>
      <Input label={t('fund.billVenue')} value={f.bVenue || ''} onChange={(e) => a.setF('bVenue', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('fund.billAmount')} mono suffix={t('units.dong')} value={String(f.bAmount ?? '')}
          onChange={(e) => a.setF('bAmount', e.target.value)} />
        <Input label={t('fund.billPayer')} value={f.bPayer || ''} onChange={(e) => a.setF('bPayer', e.target.value)} />
      </div>
      <Input label={t('fund.billNote')} value={f.bNote || ''} onChange={(e) => a.setF('bNote', e.target.value)} />
    </Shell>
  )
}

/* ---------------- ghi thu / chi tay ---------------- */

function LedgerDialog() {
  const { ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('fund.dlgTitle')} desc={t('fund.dlgDesc')}
      onSubmit={() => a.createLedger()} submitLabel={t('common.save')} submitIcon="wallet">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
        <Input label={t('fund.fDate')} type="date" mono value={f.lDate || ''}
          onChange={(e) => a.setF('lDate', e.target.value)} />
        <Select label={t('fund.fDir')} value={f.lDir}
          options={[{ value: 'in', label: t('fund.dirIn') }, { value: 'out', label: t('fund.dirOut') }]}
          onChange={(e) => a.setF('lDir', e.target.value)} />
        <Select label={t('fund.fCat')} value={f.lCat}
          options={MANUAL_CATS.map((c) => ({ value: c, label: catLabel(c) }))}
          onChange={(e) => a.setF('lCat', e.target.value)} />
      </div>
      <Input label={t('fund.fLabel')} value={f.lLabel || ''} onChange={(e) => a.setF('lLabel', e.target.value)} />
      <Input label={t('fund.fAmount')} mono suffix={t('units.dong')} value={String(f.lAmount ?? '')}
        onChange={(e) => a.setF('lAmount', e.target.value)} />
    </Shell>
  )
}

/* ---------------- thêm sân của CLB ---------------- */

function NewCourtDialog() {
  const { ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('settings.dlgCourtTitle')} desc={t('settings.dlgCourtDesc')}
      onSubmit={() => a.addCourt()} submitLabel={t('common.add')} submitIcon="plus">
      <Input label={t('settings.fCourtName')} value={f.cName || ''} onChange={(e) => a.setF('cName', e.target.value)} />
      <Input label={t('settings.fCourtAddr')} value={f.cAddr || ''} onChange={(e) => a.setF('cAddr', e.target.value)} />
      <Input label={t('settings.fCourtPrice')} mono suffix={t('units.dong')} value={f.cPrice || ''}
        onChange={(e) => a.setF('cPrice', e.target.value)} />
    </Shell>
  )
}

/* ---------------- thêm nhóm cố định ---------------- */

function NewGroupDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const picked = f.grCourts || []
  const toggle = (cid) =>
    a.setF('grCourts', picked.indexOf(cid) >= 0 ? picked.filter((x) => x !== cid) : picked.concat([cid]))

  return (
    <Shell title={t('settings.dlgGroupTitle')} desc={t('settings.dlgGroupDesc')} width={600}
      onSubmit={() => a.addGroup()} submitLabel={t('common.add')} submitIcon="plus">
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 10 }}>
        <Input label={t('settings.fGroupName')} value={f.grName || ''} onChange={(e) => a.setF('grName', e.target.value)} />
        <Input label={t('settings.fGroupShort')} value={f.grShort || ''} onChange={(e) => a.setF('grShort', e.target.value)} />
        <Select label={t('settings.fGroupWeekday')} value={String(f.grWeekday)}
          options={WD.map((w, i) => ({ value: String(i), label: w }))}
          onChange={(e) => a.setF('grWeekday', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <Input label={t('settings.fGroupFrom')} mono value={f.grFrom || ''} onChange={(e) => a.setF('grFrom', e.target.value)} />
        <Input label={t('settings.fGroupTo')} mono value={f.grTo || ''} onChange={(e) => a.setF('grTo', e.target.value)} />
        <Input label={t('settings.colFeeMale')} mono value={f.grFeeNam || ''} onChange={(e) => a.setF('grFeeNam', e.target.value)} />
        <Input label={t('settings.colFeeFemale')} mono value={f.grFeeNu || ''} onChange={(e) => a.setF('grFeeNu', e.target.value)} />
      </div>
      <Input label={t('settings.colQuota')} mono suffix={t('units.shuttle')} value={f.grQuota || ''}
        onChange={(e) => a.setF('grQuota', e.target.value)} />
      <div style={{ display: 'grid', gap: 6 }}>
        <Overline>{t('settings.fGroupCourts')}</Overline>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {db.courts.map((c) => {
            const on = picked.indexOf(c.id) >= 0
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} style={{
                padding: '7px 12px', borderRadius: 99, border: '1px solid',
                borderColor: on ? 'var(--teal-500)' : 'var(--border-subtle)',
                background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                color: 'var(--text-primary)', font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
              }}>{c.name}</button>
            )
          })}
        </div>
      </div>
      <Note>{t('settings.dlgGroupNote')}</Note>
    </Shell>
  )
}

/* ---------------- thêm thành viên ---------------- */

function AddMemberDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('members.dlgAddTitle')} desc={t('members.dlgAddDesc')}
      onSubmit={() => a.createMember()} submitLabel={t('common.add')} submitIcon="user-round-plus">
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
        <Input label={t('members.fName')} value={f.mName || ''} onChange={(e) => a.setF('mName', e.target.value)} />
        <Input label={t('members.fPhone')} mono value={f.mPhone || ''} onChange={(e) => a.setF('mPhone', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Select label={t('members.fGender')} value={f.mGender}
          options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))}
          onChange={(e) => a.setF('mGender', e.target.value)} />
        <Select label={t('members.fLevel')} value={f.mLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => a.setF('mLevel', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <Overline>{t('members.fGroups')}</Overline>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {db.groups.map((g) => {
            const on = (f.mGroups || []).indexOf(g.id) >= 0
            return (
              <button key={g.id} type="button" onClick={() => a.toggleMemberGroup(g.id)} style={{
                padding: '7px 12px', borderRadius: 99, border: '1px solid',
                borderColor: on ? 'var(--teal-500)' : 'var(--border-subtle)',
                background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                color: 'var(--text-primary)', font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
              }}>{g.name}</button>
            )
          })}
        </div>
      </div>

      <Select label={t('members.fStart')} value={f.mStart}
        options={[
          { value: 'next', label: t('members.startNext') },
          { value: 'now', label: t('members.startNow') },
          { value: 'none', label: t('members.startNone') },
        ]}
        onChange={(e) => a.setF('mStart', e.target.value)} />
    </Shell>
  )
}

/* ---------------- sửa thành viên ---------------- */

function EditMemberDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('members.dlgEditTitle')}
      onSubmit={() => a.saveMember()} submitLabel={t('common.save')}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
        <Input label={t('members.fName')} value={f.eName || ''} onChange={(e) => a.setF('eName', e.target.value)} />
        <Input label={t('members.fPhone')} mono value={f.ePhone || ''} onChange={(e) => a.setF('ePhone', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Select label={t('members.fGender')} value={f.eGender}
          options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))}
          onChange={(e) => a.setF('eGender', e.target.value)} />
        <Select label={t('members.fLevel')} value={f.eLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => a.setF('eLevel', e.target.value)} />
      </div>
      <Select label={t('members.fWhen')} value={f.eWhen}
        options={[
          { value: 'now', label: t('members.whenNow') },
          { value: 'next', label: t('members.whenNext') },
        ]}
        onChange={(e) => a.setF('eWhen', e.target.value)} />
      <Note>{t('members.editGroupNote')}</Note>
    </Shell>
  )
}

/* ---------------- báo cáo Zalo ---------------- */

function ZaloDialog() {
  const { ui } = useApp()
  const txt = ui.form.zaloText || ''
  return (
    <Shell title={t('dialog.zaloTitle')} desc={t('dialog.zaloDesc')} width={620}
      onSubmit={() => {
        try { navigator.clipboard.writeText(txt) } catch { /* clipboard bị chặn */ }
      }}
      submitLabel={t('dialog.copyAgain')} submitIcon="send">
      <pre style={{
        margin: 0, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-inset)',
        font: 'var(--type-mono)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
        maxHeight: 360, overflowY: 'auto',
      }}>
        {txt}
      </pre>
    </Shell>
  )
}
