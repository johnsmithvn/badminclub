import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Dialog, Icon, IconButton, Input, Select, StatusPill, Switch } from '#ds'
import { Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { WD, dd, genDates, monthOf, monthTxt } from '#utils/dates.js'
import { checkOf, checkPreview, fmtK, genderTxt, intOf, offBackSuggest } from '#lib/money.js'
import { venueOptions } from '#lib/forms.js'
import { MANUAL_CATS, catLabel } from '#lib/ledger.js'
import { generateSampleCsv, parseAndValidateMembers, validateMemberRow } from '#lib/csv.js'
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
    importMembers: ImportMembersDialog,
    offBack: OffBackDialog,
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

/**
 * Ô chọn người trả. Trỏ về BẢN GHI thành viên chứ không gõ tên: "Thuý" / "Thúy" / "Thuy" gõ tay
 * là ba người khác nhau trong báo cáo, và không lần ngược được từ khoản chi về người ứng tiền.
 * Bỏ trống = quỹ CLB tự trả.
 */
function PayerSelect({ field }) {
  const { db, ui, a } = useApp()
  return (
    <Select label={t('fund.fPayer')} value={ui.form[field] || ''}
      hint={t('fund.fPayerHint')}
      options={[{ value: '', label: t('fund.payerFund') }].concat(
        db.members.filter((m) => m.active !== false).map((m) => ({ value: m.id, label: m.name }))
      )}
      onChange={(e) => a.setF(field, e.target.value)} />
  )
}

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
      <Select label={t('schedules.fGroup')} value={f.sGroup || db.groups[0]?.id}
        options={db.groups.map((g, idx) => ({ value: g.id, label: g.name + (idx === 0 ? ' (Mặc định)' : '') }))}
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
  // intOf chứ không parseInt: xem trước phải ra đúng số mà createPurchase sẽ lưu.
  const qty = intOf(f.pTubes) * type.perTube + intOf(f.pExtra)
  const total = intOf(f.pTotal)
  // Cùng cái ngày mà createPurchase sẽ dùng, để xem trước không nói khác lúc bấm.
  const pDate = f.pDate || db.today
  // Tháng của ngày nhập đã kiểm kho rồi thì ẩn ô đếm tủ — mỗi tháng chỉ một lần (uq_check_month).
  const checked = checkOf(db, monthOf(pDate))
  const left = !checked && String(f.pLeft ?? '').trim() !== '' ? checkPreview(db, pDate, f.pLeft) : null

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
      <PayerSelect field="pPayer" />

      {/* Đếm tủ lúc mua tự nhiên hơn bắt nhớ đếm cuối tháng — mua cầu thì đằng nào cũng mở tủ. */}
      {!checked && (
        <Input label={t('shuttles.fLeft')} mono suffix={t('units.shuttle')} value={String(f.pLeft ?? '')}
          hint={t('shuttles.fLeftHint')} onChange={(e) => a.setF('pLeft', e.target.value)} />
      )}

      <Note>
        {!qty
          ? t('shuttles.previewNeedQty')
          : !total
            ? t('shuttles.previewNeedTotal', { qty })
            : t('shuttles.preview', { qty, unit: fmtK(Math.round(total / qty)) })}
        {left && <div style={{ marginTop: 4 }}>
          {left.diff !== 0 && !left.n
            ? t('shuttles.checkNoEst')
            : left.diff === 0
              ? t('shuttles.leftMatch', { system: left.systemLeft })
              : t('shuttles.leftSpread', {
                  system: left.systemLeft, diff: (left.diff > 0 ? '+' : '') + left.diff,
                  n: left.n, month: monthTxt(left.month),
                })}
        </div>}
      </Note>
    </Shell>
  )
}

/* ---------------- kiểm kho ---------------- */

function CheckDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const p = checkPreview(db, f.ckDate, f.ckCount)
  const noEst = p.diff !== 0 && !p.n

  return (
    <Shell title={t('shuttles.checkDlgTitle')} desc={t('shuttles.checkDlgDesc')}
      onSubmit={() => a.applyCheck()} submitLabel={t('shuttles.doCheck')} submitIcon="scale">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('shuttles.fCheckDate')} type="date" mono value={f.ckDate || ''}
          onChange={(e) => a.setF('ckDate', e.target.value)} />
        <Input label={t('shuttles.fCheckCount')} mono suffix={t('units.shuttle')} value={String(f.ckCount ?? '')}
          onChange={(e) => a.setF('ckCount', e.target.value)} />
      </div>
      <Note tone={noEst ? 'warn' : undefined}>
        {p.diff === 0
          ? t('shuttles.checkPreviewMatch', { system: p.systemLeft })
          : t('shuttles.checkPreview', {
              system: p.systemLeft, diff: (p.diff > 0 ? '+' : '') + p.diff, n: p.n,
              month: monthTxt(p.month), share: (p.share > 0 ? '+' : '') + p.share,
            })}
        {noEst && <div style={{ marginTop: 4 }}>{t('shuttles.checkNoEst')}</div>}
      </Note>
    </Shell>
  )
}

/* ---------------- hoá đơn sân ---------------- */

function BillDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const venues = venueOptions(db)
  return (
    <Shell title={t('fund.billDlgTitle')} desc={t('fund.billDlgDesc')}
      onSubmit={() => a.createCourtBill()} submitLabel={t('common.save')} submitIcon="landmark">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('fund.billDate')} type="date" mono value={f.bDate || ''}
          onChange={(e) => a.setF('bDate', e.target.value)} />
        <Input label={t('fund.fMonth')} mono value={f.bMonth || ''} onChange={(e) => a.setF('bMonth', e.target.value)} />
      </div>
      {/* Địa điểm lấy từ danh sách sân trong Cài đặt, khỏi gõ tay lệch tên mỗi tháng một kiểu.
          CLB chưa khai sân nào thì vẫn cho gõ, không chặn đường nhập hoá đơn. */}
      {venues.length
        ? <Select label={t('fund.billVenue')} value={f.bVenue || ''}
            hint={t('fund.billVenueHint')}
            options={venues.map((v) => ({ value: v, label: v }))}
            onChange={(e) => a.setF('bVenue', e.target.value)} />
        : <Input label={t('fund.billVenue')} hint={t('fund.billVenueEmpty')} value={f.bVenue || ''}
            onChange={(e) => a.setF('bVenue', e.target.value)} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('fund.billAmount')} mono suffix={t('units.dong')} value={String(f.bAmount ?? '')}
          onChange={(e) => a.setF('bAmount', e.target.value)} />
        <PayerSelect field="bPayer" />
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
    <Shell title={t('settings.dlgGroupTitle')} desc={t('settings.dlgGroupDesc')} width={520}
      onSubmit={() => a.addGroup()} submitLabel={t('common.add')} submitIcon="plus">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('settings.fGroupName')} value={f.grName || ''} onChange={(e) => a.setF('grName', e.target.value)} />
        <Input label={t('settings.fGroupShort')} value={f.grShort || ''} onChange={(e) => a.setF('grShort', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Select label={t('settings.fGroupWeekday')} value={String(f.grWeekday)}
          options={WD.map((w, i) => ({ value: String(i), label: w }))}
          onChange={(e) => a.setF('grWeekday', e.target.value)} />
        <Input label={t('settings.fGroupFrom')} mono value={f.grFrom || ''} onChange={(e) => a.setF('grFrom', e.target.value)} />
        <Input label={t('settings.fGroupTo')} mono value={f.grTo || ''} onChange={(e) => a.setF('grTo', e.target.value)} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 8, background: 'var(--surface-inset)',
        font: 'var(--type-caption)', color: 'var(--text-secondary)',
      }}>
        <span>
          Biểu phí áp dụng: <strong style={{ color: 'var(--text-primary)' }}>{fmtK(db.groups[0]?.feeNam || 0)}đ</strong> (Nam) · <strong style={{ color: 'var(--text-primary)' }}>{fmtK(db.groups[0]?.feeNu || 0)}đ</strong> (Nữ)
        </span>
        <Input label={t('settings.colQuota')} mono suffix={t('units.shuttle')} value={f.grQuota || ''}
          style={{ width: 110 }} onChange={(e) => a.setF('grQuota', e.target.value)} />
      </div>
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
      <Note tone="warn">
        Lưu ý: Sau khi tạo nhóm mới, bạn cần vào trang Thành viên để gán thành viên vào nhóm này thì mới phát sinh quỹ tháng và điểm danh theo lịch của nhóm này.
      </Note>
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
          {db.groups.map((g, idx) => {
            const on = (f.mGroups || []).indexOf(g.id) >= 0 || ((!f.mGroups || f.mGroups.length === 0) && idx === 0)
            return (
              <button key={g.id} type="button" onClick={() => a.toggleMemberGroup(g.id)} style={{
                padding: '7px 12px', borderRadius: 99, border: '1px solid',
                borderColor: on ? 'var(--teal-500)' : 'var(--border-subtle)',
                background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                color: 'var(--text-primary)', font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
              }}>
                {g.name} {idx === 0 ? '(Mặc định)' : ''}
              </button>
            )
          })}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
          Nếu không chọn nhóm nào, thành viên sẽ tự động thuộc nhóm mặc định.
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
        hint={t('members.fWhenHint')}
        options={[
          { value: 'now', label: t('members.whenNow') },
          { value: 'next', label: t('members.whenNext') },
        ]}
        onChange={(e) => a.setF('eWhen', e.target.value)} />

      {/* Nhóm cố định sửa ngay tại đây. Gỡ HẾT nhóm = thành người đi lẻ (vãng lai). */}
      <div style={{ display: 'grid', gap: 7 }}>
        <Overline>{t('members.fGroups')}</Overline>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {db.groups.map((g) => {
            const on = (f.eGroups || []).indexOf(g.id) >= 0
            return (
              <button key={g.id} type="button" onClick={() => a.toggleMemberGroup(g.id, 'eGroups')} style={{
                padding: '7px 12px', borderRadius: 99, border: '1px solid',
                borderColor: on ? 'var(--teal-500)' : 'var(--border-subtle)',
                background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                color: 'var(--text-primary)', font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
              }}>{g.name}</button>
            )
          })}
          {!db.groups.length && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
            {t('members.noGroupYet')}
          </span>}
        </div>
      </div>

      <Select label={t('members.fWhenGroup')} value={f.eWhenGroup || 'next'}
        hint={t('members.fWhenGroupHint')}
        options={[
          { value: 'next', label: t('members.groupNext') },
          { value: 'now', label: t('members.groupNow') },
        ]}
        onChange={(e) => a.setF('eWhenGroup', e.target.value)} />

      <Note tone={(f.eGroups || []).length ? undefined : 'warn'}>
        {(f.eGroups || []).length ? t('members.editGroupNote') : t('members.editGroupNone')}
      </Note>
    </Shell>
  )
}

/* ---------------- ngưng hoạt động: có trả lại tiền không ---------------- */

/**
 * Người đang cố định mà đã đóng quỹ tháng này thì quỹ đang giữ tiền của những buổi họ sẽ
 * không đánh nữa. Hỏi đúng một lần ở đây, và KHÔNG chặn: bỏ qua thì vẫn ngưng được, cuối
 * tháng đổi ý vẫn ghi tay được một dòng chi hạng mục "Back cố định nghỉ" ở Sổ quỹ.
 *
 * Ba lối ra khác nhau, cố ý không gộp: Huỷ = không ngưng · Chỉ ngưng = ngưng, không trả ·
 * Ngưng và trả = ngưng, ghi một dòng chi.
 */
function OffBackDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const s = offBackSuggest(db, f.obId)
  if (!s) return null

  return (
    <Shell
      title={t('members.offBackTitle', { name: s.name })}
      desc={t('members.offBackDesc', { groups: s.groups, n: s.sessions })}
      width={520}
      submitLabel={t('members.offBackDo')}
      submitIcon="banknote"
      disabled={intOf(f.obAmount) <= 0}
      onSubmit={() => a.deactivate(f.obId, f.obAmount)}
    >
      <Input label={t('members.offBackAmount')} mono suffix={t('units.dong')}
        value={f.obAmount || ''}
        hint={t('members.offBackHint', { amount: fmtK(s.amount), n: s.sessions })}
        onChange={(e) => a.setF('obAmount', e.target.value)} />
      <Note>{t('members.offBackNote')}</Note>
      <div>
        <Button variant="secondary" icon="user-round-minus" onClick={() => a.deactivate(f.obId, 0)}>
          {t('members.offBackSkip')}
        </Button>
      </div>
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

/* ---------------- nhập thành viên từ file CSV ---------------- */

function ImportMembersDialog() {
  const { db, a } = useApp()
  const fileInputRef = useRef(null)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState('file') // 'file' | 'paste'
  const [start, setStart] = useState('next') // 'next' | 'now' | 'none'
  const [dragOver, setDragOver] = useState(false)
  const [rows, setRows] = useState([])
  const [headerError, setHeaderError] = useState(null)

  // Map số điện thoại thành viên hiện có để cảnh báo trùng
  const phoneMap = useMemo(() => {
    const m = new Map()
    db.members.forEach((mem) => {
      if (mem.phone) m.set(mem.phone.replace(/\D/g, ''), mem.name)
    })
    return m
  }, [db.members])

  // Khi csvText thay đổi -> parse lần đầu và đưa vào state rows
  const handleParse = (text) => {
    setCsvText(text)
    if (!text.trim()) {
      setRows([])
      setHeaderError(null)
      return
    }
    const res = parseAndValidateMembers(text, db.levels, db.groups, db.members)
    setHeaderError(res.headerError)
    setRows(res.rows)
  }

  // Chỉnh sửa từng trường của 1 dòng trực tiếp trên bảng mapping
  const updateRowField = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const updated = { ...r, [field]: value }
        return validateMemberRow(updated, db.levels, phoneMap)
      })
    )
  }

  // Xoá 1 dòng khỏi bảng mapping
  const removeRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const handleDownloadTemplate = () => {
    const content = generateSampleCsv(db.levels, db.groups)
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mau_thanh_vien_${db.clubId || 'clb'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      handleParse(evt.target.result || '')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files && e.dataTransfer.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      handleParse(evt.target.result || '')
    }
    reader.readAsText(file, 'utf-8')
  }

  // Kiểm tra số lượng hợp lệ và lỗi
  const errorCount = rows.filter((r) => r.status === 'error').length
  const warnCount = rows.filter((r) => r.status === 'warn').length
  const validCount = rows.filter((r) => r.status === 'valid').length
  const canSave = rows.length > 0 && errorCount === 0 && !headerError

  const handleSubmit = () => {
    if (!canSave) return
    a.importMembers(rows, { start })
  }

  return (
    <Dialog open title={t('members.dlgImportTitle')} description={t('members.dlgImportDesc')} width={780} onClose={() => a.closeDialog()}>
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Tải file mẫu chuẩn */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-brand-soft)', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-caption)', color: 'var(--navy-700)' }}>
            <Icon name="file-spreadsheet" size={16} />
            <span>Mẫu CSV chuẩn 5 cột: <strong>Họ và tên · Số điện thoại · Giới tính · Trình độ · Nhóm cố định</strong></span>
          </div>
          <Button variant="ghost" size="sm" icon="download" onClick={handleDownloadTemplate}>
            {t('members.downloadTemplate')}
          </Button>
        </div>

        {/* Tab chọn cách nạp dữ liệu */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
          <Button
            variant={activeTab === 'file' ? 'secondary' : 'ghost'}
            size="sm"
            icon="upload"
            onClick={() => setActiveTab('file')}
          >
            Tải file lên
          </Button>
          <Button
            variant={activeTab === 'paste' ? 'secondary' : 'ghost'}
            size="sm"
            icon="clipboard-check"
            onClick={() => setActiveTab('paste')}
          >
            Dán văn bản
          </Button>
        </div>

        {activeTab === 'file' ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              padding: '22px 16px', borderRadius: 10, border: '2px dashed',
              borderColor: dragOver ? 'var(--teal-500)' : 'var(--border-default)',
              background: dragOver ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
            <Icon name="upload" size={26} style={{ color: 'var(--teal-600)' }} />
            <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>
              {fileName ? `File đã nạp: ${fileName}` : t('members.importDropText') + ' ' + t('members.importChooseFile')}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              File CSV phải giữ nguyên đúng 5 tên cột theo file mẫu của hệ thống
            </div>
          </div>
        ) : (
          <div>
            <textarea
              rows={4}
              placeholder={t('members.importPastePlaceholder')}
              value={csvText}
              onChange={(e) => { setFileName(''); handleParse(e.target.value) }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--field-bg)',
                font: 'var(--type-mono)', fontSize: 13, color: 'var(--text-primary)',
                resize: 'vertical', outline: 0, boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Cảnh báo nếu sai tiêu đề cột */}
        {headerError && (
          <Alert tone="danger">
            {headerError}
          </Alert>
        )}

        {/* Bảng mapping và xem/chỉnh sửa trực tiếp */}
        {rows.length > 0 && !headerError && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>
                Bảng xem và chỉnh sửa trực tiếp ({rows.length} người)
              </div>
              <div style={{ display: 'flex', gap: 10, font: 'var(--type-caption)' }}>
                <span style={{ color: 'var(--status-delivered)' }}>
                  ✓ {validCount} hợp lệ
                </span>
                {warnCount > 0 && (
                  <span style={{ color: 'var(--status-delayed)' }}>
                    ⚠️ {warnCount} trùng SĐT
                  </span>
                )}
                {errorCount > 0 && (
                  <span style={{ color: 'var(--status-incident)', fontWeight: 600 }}>
                    ✗ {errorCount} thiếu trường bắt buộc
                  </span>
                )}
              </div>
            </div>

            {errorCount > 0 && (
              <Alert tone="danger">
                Có {errorCount} dòng thiếu thông tin bắt buộc (Họ và tên). Vui lòng nhập trực tiếp trên bảng hoặc bấm biểu tượng thùng rác để xoá dòng trước khi lưu.
              </Alert>
            )}

            <div style={{
              maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-subtle)',
              borderRadius: 8, background: 'var(--surface-card)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--type-caption)' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 8px', width: 28 }}>#</th>
                    <th style={{ padding: '8px 8px', width: 170 }}>Họ và tên *</th>
                    <th style={{ padding: '8px 8px', width: 120 }}>Số điện thoại</th>
                    <th style={{ padding: '8px 8px', width: 85 }}>Giới tính *</th>
                    <th style={{ padding: '8px 8px', width: 105 }}>Trình độ *</th>
                    <th style={{ padding: '8px 8px', width: 140 }}>Nhóm cố định</th>
                    <th style={{ padding: '8px 8px', width: 40, textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isErr = r.status === 'error'
                    return (
                      <tr key={r.id} style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isErr ? 'var(--surface-brand-soft)' : 'transparent',
                      }}>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            value={r.name}
                            placeholder="Nhập họ tên..."
                            onChange={(e) => updateRowField(r.id, 'name', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 6,
                              border: isErr ? '1px solid var(--red-600)' : '1px solid var(--border-default)',
                              background: 'var(--field-bg)', font: 'var(--type-label)',
                              color: 'var(--text-primary)', outline: 0, boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            value={r.phone}
                            placeholder="SĐT..."
                            onChange={(e) => updateRowField(r.id, 'phone', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 6,
                              border: '1px solid var(--border-default)', background: 'var(--field-bg)',
                              font: 'var(--type-mono)', color: 'var(--text-primary)', outline: 0, boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select
                            value={r.gender}
                            onChange={(e) => updateRowField(r.id, 'gender', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 4px', borderRadius: 6,
                              border: '1px solid var(--border-default)', background: 'var(--field-bg)',
                              font: 'var(--type-caption)', color: 'var(--text-primary)', outline: 0,
                            }}
                          >
                            <option value="nam">Nam</option>
                            <option value="nu">Nữ</option>
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select
                            value={r.level}
                            onChange={(e) => updateRowField(r.id, 'level', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 4px', borderRadius: 6,
                              border: '1px solid var(--border-default)', background: 'var(--field-bg)',
                              font: 'var(--type-caption)', color: 'var(--text-primary)', outline: 0,
                            }}
                          >
                            {db.levels.map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select
                            value={r.groupId}
                            onChange={(e) => updateRowField(r.id, 'groupId', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 4px', borderRadius: 6,
                              border: '1px solid var(--border-default)', background: 'var(--field-bg)',
                              font: 'var(--type-caption)', color: 'var(--text-primary)', outline: 0,
                            }}
                          >
                            <option value="">-- Mặc định ({db.groups[0]?.name || 'Cố định'}) --</option>
                            {db.groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            label="Xoá dòng này"
                            onClick={() => removeRow(r.id)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tuỳ chọn bắt đầu cố định từ khi nào */}
            <div style={{ maxWidth: 300 }}>
              <Select
                label={t('members.importStartOption')}
                value={start}
                options={[
                  { value: 'next', label: t('members.startNext') },
                  { value: 'now', label: t('members.startNow') },
                  { value: 'none', label: t('members.startNone') },
                ]}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Nút thao tác */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" onClick={() => a.closeDialog()}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            icon="user-round-plus"
            disabled={!canSave}
            onClick={handleSubmit}
          >
            {rows.length > 0
              ? t('members.importSubmit', { n: rows.length })
              : 'Lưu danh sách'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

