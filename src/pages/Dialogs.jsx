import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Dialog, Icon, IconButton, Input, Select, StatusPill, Switch } from '#ds'
import { AvatarUpload, BankAccountSection, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { WD, dd, genDates, monthOf, monthTxt } from '#utils/dates.js'
import { checkOf, checkPreview, fmtK, genderTxt, intOf, offBackSuggest } from '#lib/money.js'
import { venueOptions } from '#lib/forms.js'
import { planScheduleEdit } from '#lib/schedules.js'
import { MANUAL_CATS, catLabel } from '#lib/ledger.js'
import {
  OPTIONAL_HEADERS, TEMPLATE_HEADERS, generateSampleCsv, parseAndValidateMembers, validateMemberRow,
} from '#lib/csv.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Dialogs() {
  const { ui, a } = useApp()
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
    importSettings: ImportSettingsDialog,
    offBack: OffBackDialog,
    zalo: ZaloDialog,
  }[ui.dialog]

  return (
    <>
      {D ? <D /> : null}
      {ui.confirm && <ConfirmDialog confirm={ui.confirm} onClose={() => a.closeConfirm()} />}
    </>
  )
}

function ConfirmDialog({ confirm, onClose }) {
  const {
    title = t('common.confirm'),
    message,
    desc,
    tone = 'danger', // 'danger' | 'warning' | 'info' | 'success'
    confirmText = t('common.confirm'),
    cancelText = t('common.cancel'),
    icon,
    onConfirm,
    onCancel,
    alertOnly = false,
  } = confirm

  const handleConfirm = () => {
    onClose()
    if (typeof onConfirm === 'function') onConfirm()
  }

  const handleCancel = () => {
    onClose()
    if (typeof onCancel === 'function') onCancel()
  }

  const toneConfig = {
    danger: {
      icon: icon || 'triangle-alert',
      iconColor: 'var(--status-incident)',
      iconBg: 'var(--status-incident-bg, rgba(239, 68, 68, 0.12))',
      btnVariant: 'danger',
    },
    warning: {
      icon: icon || 'alert-circle',
      iconColor: '#d97706',
      iconBg: 'rgba(217, 119, 6, 0.12)',
      btnVariant: 'primary',
    },
    info: {
      icon: icon || 'info',
      iconColor: 'var(--navy-600)',
      iconBg: 'var(--surface-brand-soft)',
      btnVariant: 'primary',
    },
    success: {
      icon: icon || 'circle-check',
      iconColor: 'var(--status-delivered)',
      iconBg: 'var(--status-delivered-bg)',
      btnVariant: 'primary',
    },
  }[tone] || {
    icon: icon || 'info',
    iconColor: 'var(--navy-600)',
    iconBg: 'var(--surface-brand-soft)',
    btnVariant: 'primary',
  }

  return (
    <Dialog open title={title} width={460} onClose={handleCancel}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingTop: 2 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: toneConfig.iconBg,
          color: toneConfig.iconColor,
        }}>
          <Icon name={toneConfig.icon} size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
          <div style={{ font: 'var(--type-body)', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {message}
          </div>
          {desc && (
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {desc}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 }}>
        {!alertOnly && (
          <Button variant="secondary" onClick={handleCancel}>
            {cancelText}
          </Button>
        )}
        <Button
          variant={toneConfig.btnVariant}
          icon={alertOnly ? undefined : (tone === 'danger' ? 'trash-2' : 'check')}
          onClick={handleConfirm}
          style={tone === 'danger' ? { background: 'var(--status-incident)', color: '#fff', borderColor: 'transparent' } : undefined}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  )
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

/**
 * Tạo lịch VÀ sửa lịch dùng chung một hộp thoại — `f.eSchedId` là cờ phân biệt. Gộp chứ không
 * nhân đôi: hai bản sao của cùng bộ ô nhập rồi sẽ lệch nhau, mà lệch ở đây là sinh sai buổi.
 */
function ScheduleDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form
  const dates = genDates(f.weekdays, f.start, f.end)
  const sched = f.eSchedId && db.schedules.find((x) => x.id === f.eSchedId)
  // Xem trước phải tính bằng ĐÚNG hàm mà action sẽ chạy — hộp thoại hứa gì thì app làm nấy.
  const plan = sched ? planScheduleEdit(db, sched, f) : null
  // Lịch tập BẮT BUỘC thuộc một nhóm: quỹ tháng, đơn giá một buổi và công nợ đều đếm theo
  // groupId. CLB chưa khai nhóm nào thì chặn ở đây và chỉ đường, đừng để bấm Tạo rồi mới báo.
  const noGroup = !db.groups.length

  return (
    <Shell
      title={t(sched ? 'schedules.editTitle' : 'schedules.dlgTitle')}
      desc={t(sched ? 'schedules.editDesc' : 'schedules.dlgDesc')}
      width={620}
      onSubmit={sched ? () => a.saveSchedule() : () => a.createSchedule(dates)}
      submitLabel={t(sched ? 'common.save' : 'common.create')}
      submitIcon="repeat"
      disabled={noGroup || (sched ? plan.blocked.length > 0 : !dates.length)}>
      {noGroup && (
        <Alert tone="danger" title={t('schedules.noGroupTitle')}>{t('schedules.noGroup')}</Alert>
      )}
      <Input label={t('schedules.fName')} value={f.sName || ''} onChange={(e) => a.setF('sName', e.target.value)} />
      {/* Đổi nhóm chỉ mở khi lịch còn MỀM (chưa buổi nào mở / qua ngày) — lúc đó dời được cả
          lũ buổi sang nhóm mới. Cứng rồi thì buổi cũ rớt lại nhóm cũ, mà đơn giá một buổi và
          công nợ đều đếm theo groupId. Chọn nhầm nhóm lúc tạo là chuyện thường, nên không
          khoá cứng vô điều kiện — xem `lib/schedules.js: canRebind`. */}
      <Select label={t('schedules.fGroup')} value={f.sGroup || db.groups[0]?.id}
        disabled={!!sched && !plan.soft}
        hint={sched ? t(plan.soft ? 'schedules.groupFree' : 'schedules.groupLocked') : undefined}
        options={db.groups.map((g) => ({ value: g.id, label: g.name }))}
        onChange={(e) => a.setScheduleGroup(e.target.value)} />

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

      {plan ? <EditPlan plan={plan} /> : (
        <Note>
          {dates.length
            ? t('schedules.preview', { n: dates.length, from: dd(dates[0]), to: dd(dates[dates.length - 1]) })
            : t('schedules.previewNone')}
          <div style={{ marginTop: 4, opacity: 0.85 }}>{t('schedules.previewSkip')}</div>
        </Note>
      )}
    </Shell>
  )
}

/**
 * Xem trước kế hoạch sửa — bốn con số, nói thẳng cái gì mất cái gì còn, TRƯỚC khi bấm Lưu.
 * Xoá một buổi là xoá cả điểm danh, trận và tiền khách đã thu của buổi đó, nên đây không phải
 * chỗ để nói "sẽ cập nhật một số buổi".
 */
function EditPlan({ plan }) {
  const skip = plan.locked.length + plan.past.length
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {plan.blocked.map((k) => <Alert key={k} tone="danger">{t(k)}</Alert>)}
      <Note tone={plan.remove.length ? 'warn' : undefined}>
        {t('schedules.planLine', {
          keep: plan.keep.length, add: plan.add.length, remove: plan.remove.length,
        })}
        {skip > 0 && (
          <div style={{ marginTop: 4, opacity: 0.85 }}>{t('schedules.planSkip', { n: skip })}</div>
        )}
      </Note>
      {/* Đổi số buổi của một tháng là đổi MẪU SỐ của đơn giá một buổi (quỹ tháng ÷ số buổi) —
          tiền back của cả nhóm trong tháng đó tính lại. Phải nói ra, không ai tự đoán được. */}
      {plan.monthsTouched.length > 0 && (
        <Alert tone="warning" title={t('schedules.monthWarnTitle')}>
          {t('schedules.monthWarn', { months: plan.monthsTouched.map(monthTxt).join(', ') })}
        </Alert>
      )}
    </div>
  )
}

/* ---------------- buổi đột xuất ---------------- */

function AdhocDialog() {
  const { ui, a } = useApp()
  const f = ui.form
  return (
    <Shell title={t('adhoc.dlgTitle')} desc={t('adhoc.dlgDesc')} width={560}
      onSubmit={() => a.createAdhoc()} submitLabel={t('common.create')} submitIcon="calendar-plus">
      <Input label={t('adhoc.fDate')} type="date" mono value={f.aDate || ''}
        onChange={(e) => a.setF('aDate', e.target.value)} />
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
        options={db.courts.map((c) => ({ value: c.id, label: c.name + ' · ' + fmtK(c.price) + ' ' + t('units.dongPerHour') }))}
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
          options={db.shuttleTypes.map((x) => ({ value: x.id, label: x.name + ' · ' + x.perTube + ' ' + t('units.shuttlePerTube') }))}
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
    <Shell
      title={t(f.eBillId ? 'fund.billEditTitle' : 'fund.billDlgTitle')}
      desc={t(f.eBillId ? 'fund.billEditDesc' : 'fund.billDlgDesc')}
      onSubmit={() => (f.eBillId ? a.saveCourtBill() : a.createCourtBill())}
      submitLabel={t('common.save')} submitIcon="landmark">
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
    <Shell
      title={t(f.eLedgerId ? 'fund.dlgEditTitle' : 'fund.dlgTitle')}
      desc={t('fund.dlgDesc')}
      onSubmit={() => (f.eLedgerId ? a.saveLedger() : a.createLedger())}
      submitLabel={t('common.save')} submitIcon="wallet">
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
      <Input
        label={t('settings.fCourtMapUrl')}
        placeholder="https://maps.app.goo.gl/..."
        hint={t('settings.fCourtMapUrlHint')}
        value={f.cMapUrl || ''}
        onChange={(e) => a.setF('cMapUrl', e.target.value)}
      />
      <Input label={t('settings.fCourtPrice')} mono suffix={t('units.dong')} value={f.cPrice || ''}
        onChange={(e) => a.setF('cPrice', e.target.value)} />
    </Shell>
  )
}

/* ---------------- thêm nhóm cố định ---------------- */

function NewGroupDialog() {
  const { db, ui, a } = useApp()
  const f = ui.form

  return (
    <Shell title={t('settings.dlgGroupTitle')} desc={t('settings.dlgGroupDesc')} width={520}
      onSubmit={() => a.addGroup()} submitLabel={t('common.add')} submitIcon="plus">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('settings.fGroupName')} value={f.grName || ''} onChange={(e) => a.setF('grName', e.target.value)} />
        <Input label={t('settings.fGroupShort')} value={f.grShort || ''} onChange={(e) => a.setF('grShort', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('settings.fGroupFrom')} mono value={f.grFrom || ''} onChange={(e) => a.setF('grFrom', e.target.value)} />
        <Input label={t('settings.fGroupTo')} mono value={f.grTo || ''} onChange={(e) => a.setF('grTo', e.target.value)} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 8, background: 'var(--surface-inset)',
        font: 'var(--type-caption)', color: 'var(--text-secondary)',
      }}>
        <span>
          {t('settings.groupFeeApplied')}: <strong style={{ color: 'var(--text-primary)' }}>{fmtK(db.groups[0]?.feeNam || 0)}{t('units.dong')}</strong> ({t('gender.nam')}) · <strong style={{ color: 'var(--text-primary)' }}>{fmtK(db.groups[0]?.feeNu || 0)}{t('units.dong')}</strong> ({t('gender.nu')})
        </span>
        <Input label={t('settings.colQuota')} mono suffix={t('units.shuttle')} value={f.grQuota || ''}
          style={{ width: 110 }} onChange={(e) => a.setF('grQuota', e.target.value)} />
      </div>
      <Note tone="warn">
        {t('settings.dlgGroupWarn')}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AvatarUpload
          name={f.mName || ''}
          value={f.mAvatarUrl || ''}
          size={56}
          onChange={(url) => a.setF('mAvatarUrl', url)}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input label={t('members.fName')} value={f.mName || ''} onChange={(e) => a.setF('mName', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('members.fPhone')} mono value={f.mPhone || ''} onChange={(e) => a.setF('mPhone', e.target.value)} />
        <Input label={t('members.fEmail')} hint={t('members.fEmailHint')}
          value={f.mEmail || ''} onChange={(e) => a.setF('mEmail', e.target.value)} />
      </div>

      <Input label={t('members.fFull')} hint={t('members.fFullHint')}
        value={f.mFull || ''} onChange={(e) => a.setF('mFull', e.target.value)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Select label={t('members.fGender')} value={f.mGender}
          options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))}
          onChange={(e) => a.setF('mGender', e.target.value)} />
        <Select label={t('members.fLevel')} value={f.mLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => a.setF('mLevel', e.target.value)} />
      </div>

      <Input
        label={t('members.fNote')}
        placeholder={t('members.phNote')}
        value={f.mNote || ''}
        onChange={(e) => a.setF('mNote', e.target.value)}
      />

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
              }}>
                {g.name}
              </button>
            )
          })}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
          {t('members.addGroupNone')}
        </div>
      </div>

      <Select label={t('members.fStart')} value={f.mStart}
        options={[
          { value: 'next', label: t('members.startNext') },
          { value: 'now', label: t('members.startNow') },
          { value: 'none', label: t('members.startNone') },
        ]}
        onChange={(e) => a.setF('mStart', e.target.value)} />

      {/* Thông tin tài khoản ngân hàng & QR nhận tiền */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <BankAccountSection
          card={false}
          bankHolder={f.mBankHolder || ''}
          bankNo={f.mBankNo || ''}
          bankName={f.mBankName || ''}
          canEdit
          onChange={({ bankHolder, bankNo, bankName }) => {
            a.setF('mBankHolder', bankHolder)
            a.setF('mBankNo', bankNo)
            a.setF('mBankName', bankName)
          }}
        />
      </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AvatarUpload
          name={f.eName || ''}
          value={f.eAvatarUrl || ''}
          size={56}
          onChange={(url) => a.setF('eAvatarUrl', url)}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input label={t('members.fName')} value={f.eName || ''} onChange={(e) => a.setF('eName', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label={t('members.fPhone')} mono value={f.ePhone || ''} onChange={(e) => a.setF('ePhone', e.target.value)} />
        <Input label={t('members.fEmail')} hint={t('members.fEmailHint')}
          value={f.eEmail || ''} onChange={(e) => a.setF('eEmail', e.target.value)} />
      </div>

      <Input label={t('members.fFull')} hint={t('members.fFullHint')}
        value={f.eFull || ''} onChange={(e) => a.setF('eFull', e.target.value)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Select label={t('members.fGender')} value={f.eGender}
          options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))}
          onChange={(e) => a.setF('eGender', e.target.value)} />
        <Select label={t('members.fLevel')} value={f.eLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => a.setF('eLevel', e.target.value)} />
      </div>
      <Input
        label={t('members.fNote')}
        placeholder={t('members.phNote')}
        value={f.eNote || ''}
        onChange={(e) => a.setF('eNote', e.target.value)}
      />

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

      {/* Thông tin tài khoản ngân hàng & QR nhận tiền */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <BankAccountSection
          card={false}
          bankHolder={f.eBankHolder || ''}
          bankNo={f.eBankNo || ''}
          bankName={f.eBankName || ''}
          canEdit
          onChange={({ bankHolder, bankNo, bankName }) => {
            a.setF('eBankHolder', bankHolder)
            a.setF('eBankNo', bankNo)
            a.setF('eBankName', bankName)
          }}
        />
      </div>

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
            <span>
              {t('members.importTplHead', { n: TEMPLATE_HEADERS.length })}: <strong>{TEMPLATE_HEADERS.join(' · ')}</strong>
              {' — ' + t('members.importTplMore') + ': '}<strong>{OPTIONAL_HEADERS.join(' · ')}</strong>
            </span>
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
            {t('members.importTabFile')}
          </Button>
          <Button
            variant={activeTab === 'paste' ? 'secondary' : 'ghost'}
            size="sm"
            icon="clipboard-check"
            onClick={() => setActiveTab('paste')}
          >
            {t('members.importTabPaste')}
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
              {fileName ? t('members.importLoaded', { name: fileName }) : t('members.importDropText') + ' ' + t('members.importChooseFile')}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              {t('members.importHeaderNote', { n: TEMPLATE_HEADERS.length })}
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
                {t('members.importEditTitle', { n: rows.length })}
              </div>
              <div style={{ display: 'flex', gap: 10, font: 'var(--type-caption)' }}>
                <span style={{ color: 'var(--status-delivered)' }}>
                  {t('members.importValid', { n: validCount })}
                </span>
                {warnCount > 0 && (
                  <span style={{ color: 'var(--status-delayed)' }}>
                    {t('members.importWarnDup', { n: warnCount })}
                  </span>
                )}
                {errorCount > 0 && (
                  <span style={{ color: 'var(--status-incident)', fontWeight: 600 }}>
                    {t('members.importErrCount', { n: errorCount })}
                  </span>
                )}
              </div>
            </div>

            {errorCount > 0 && (
              <Alert tone="danger">
                {t('members.importErrAlert', { n: errorCount })}
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
                    <th style={{ padding: '8px 8px', width: 170 }}>{t('members.importColName')}</th>
                    <th style={{ padding: '8px 8px', width: 120 }}>{t('members.importColPhone')}</th>
                    <th style={{ padding: '8px 8px', width: 85 }}>{t('members.importColGender')}</th>
                    <th style={{ padding: '8px 8px', width: 105 }}>{t('members.importColLevel')}</th>
                    <th style={{ padding: '8px 8px', minWidth: 160 }}>{t('members.colGroups')}</th>
                    <th style={{ padding: '8px 8px', width: 40, textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isErr = r.status === 'error'
                    const isWarn = r.status === 'warn'
                    const rowBg = isErr
                      ? 'var(--surface-danger-soft)'
                      : isWarn
                        ? 'var(--surface-warning-soft)'
                        : 'transparent'
                    return (
                      <tr key={r.id} style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: rowBg,
                      }}>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            value={r.name}
                            placeholder={t('members.phName')}
                            onChange={(e) => updateRowField(r.id, 'name', e.target.value)}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 6,
                              border: `1px solid ${isErr ? 'var(--status-incident)' : 'var(--border-default)'}`,
                              background: 'var(--field-bg)', font: 'var(--type-label)',
                              color: 'var(--text-primary)', outline: 0, boxSizing: 'border-box',
                            }}
                          />
                          {/* Hai cột tuỳ chọn hiện ở đây thay vì thành cột riêng: dialog chỉ rộng
                              780px, thêm hai cột nữa là bảng bóp nát. Sửa được sau ở màn Thành viên. */}
                          {(r.fullName || r.email) && (
                            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', paddingTop: 3 }}>
                              {[r.fullName, r.email].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            value={r.phone}
                            placeholder={t('members.phPhone')}
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
                            <option value="nu">{t('gender.nu')}</option>
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
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {db.groups.map((g) => {
                              const gids = Array.isArray(r.groupIds) ? r.groupIds : (r.groupId ? [r.groupId] : [])
                              const checked = gids.includes(g.id)
                              return (
                                <label
                                  key={g.id}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 7px', borderRadius: 6,
                                    background: checked ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                                    border: `1px solid ${checked ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                                    cursor: 'pointer', font: 'var(--type-caption)',
                                    userSelect: 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    style={{ cursor: 'pointer', margin: 0 }}
                                    onChange={() => {
                                      const nextGids = checked ? gids.filter((x) => x !== g.id) : gids.concat([g.id])
                                      updateRowField(r.id, 'groupIds', nextGids)
                                      updateRowField(r.id, 'groupId', nextGids[0] || '')
                                    }}
                                  />
                                  <span style={{ fontWeight: checked ? 600 : 400, color: checked ? 'var(--teal-700)' : 'var(--text-secondary)' }}>
                                    {g.short || g.name}
                                  </span>
                                </label>
                              )
                            })}
                            {(!r.groupIds || r.groupIds.length === 0) && !r.groupId && (
                              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>
                                {t('members.soloShort')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            label={t('members.importDelRow')}
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
              : t('members.importSave')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/* Nhập cài đặt của CLB khác: chọn file .json đã xuất, tick phần muốn lấy, áp vào CLB đang xem.
   File chỉ chứa CẤU HÌNH (biểu phí · sân · loại cầu · nhóm) — không có thành viên, quỹ hay
   giao dịch, nên nhập nhầm cũng không đụng tới tiền đã ghi. */

/** Các phần chọn được trong file. `key` chính là cờ truyền cho a.applyImportedSettings(). */
const IMPORT_PARTS = [
  { key: 'includeClub', label: () => t('settings.ioPartClub'), meta: (d) => t('settings.ioPartClubMeta', { n: (d.club?.levels || []).length }) },
  { key: 'includeMoney', label: () => t('settings.ioPartMoney'), meta: (d) => t('settings.ioPartMoneyMeta', { n: (d.money?.guestPrices || []).length }) },
  { key: 'includeCourts', label: () => t('settings.ioPartCourts'), meta: (d) => nameList(d.courts) },
  { key: 'includeShuttles', label: () => t('settings.ioPartShuttles'), meta: (d) => nameList(d.shuttleTypes) },
  { key: 'includeGroups', label: () => t('settings.ioPartGroups'), meta: (d) => nameList(d.groups) },
]

const nameList = (list) => (list && list.length
  ? t('settings.ioNames', { n: list.length, names: list.map((x) => x.name).join(' · ') })
  : t('settings.ioNone'))

const ALL_PARTS = Object.fromEntries(IMPORT_PARTS.map((p) => [p.key, true]))

function ImportSettingsDialog() {
  const { a } = useApp()
  const fileRef = useRef(null)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [fileName, setFileName] = useState('')
  const [picked, setPicked] = useState(ALL_PARTS)

  const fail = (msg) => { setErr(msg); setData(null) }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      let parsed
      try {
        parsed = JSON.parse(ev.target.result)
      } catch {
        return fail(t('settings.ioErrParse'))
      }
      // Không có dấu nhận dạng thì đây là JSON của thứ khác — dừng ở đây, đừng đoán.
      if (!parsed || parsed.schema !== 'badminclub_settings') return fail(t('settings.ioErrSchema'))
      setData(parsed)
    }
    reader.onerror = () => fail(t('settings.ioErrRead'))
    reader.readAsText(file)
  }

  const anyPicked = IMPORT_PARTS.some((p) => picked[p.key])

  return (
    <Dialog open title={t('settings.ioTitle')} width={620} onClose={() => a.closeDialog()}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>
          {t('settings.ioDesc')}
        </div>

        <div onClick={() => fileRef.current?.click()} style={S.drop}>
          <input
            type="file"
            accept=".json,application/json"
            ref={fileRef}
            style={{ display: 'none' }}
            onChange={onFile}
          />
          <Icon name="upload" size={28} style={{ margin: '0 auto 8px', color: 'var(--teal-600)' }} />
          <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>
            {fileName || t('settings.ioPick')}
          </div>
          <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 4 }}>
            {t('settings.ioPickHint')}
          </div>
        </div>

        {err && <Alert tone="danger" title={t('settings.ioErrTitle')}>{err}</Alert>}

        {data && (
          <div style={S.parts}>
            <Overline>
              {t('settings.ioFrom', {
                club: data.clubName || t('common.unknown'),
                date: String(data.exportedAt || '').slice(0, 10),
                v: data.version || 1,
              })}
            </Overline>
            {IMPORT_PARTS.map((p) => (
              <Checkbox
                key={p.key}
                label={p.label()}
                description={p.meta(data)}
                checked={picked[p.key]}
                onChange={(e) => setPicked((s) => ({ ...s, [p.key]: e.target.checked }))}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="secondary" onClick={() => a.closeDialog()}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!data || !anyPicked}
            onClick={() => a.applyImportedSettings(data, picked)}
          >
            {t('settings.ioApply')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  drop: {
    border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '22px 16px',
    textAlign: 'center', cursor: 'pointer', background: 'var(--surface-inset)',
  },
  parts: {
    display: 'grid', gap: 10, padding: 14, borderRadius: 10,
    border: '1px solid var(--border-subtle)', background: 'var(--surface-card)',
  },
}
