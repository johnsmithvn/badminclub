// Cài đặt: Chung · Cách chia tiền · Sân · Cầu · Nhóm cố định · Tài khoản & quyền (handoff 02 §7).

import { useState, useEffect } from 'react'
import { Alert, Avatar, Button, Card, Checkbox, Icon, IconButton, Input, Select, Switch, Tabs, Tag } from '#ds'
import { AvatarUpload, BankAccountSection, DeleteClubDialog, Empty, GRID_PAIR, LevelChip, Mono, Overline } from '#ui'
import { courtForm, groupForm } from '#lib/forms.js'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { WD, ddmy } from '#utils/dates.js'
import { ROLES, can, roleDesc } from '#lib/roles.js'
import { fmtK, genderTxt, intOf } from '#lib/money.js'
import { digits, mergeRows } from '#lib/members.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import Schedules from './Schedules.jsx'

const TABS = ['general', 'money', 'courts', 'groups', 'schedules', 'access']

export default function Settings() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.settings || 'general'
  const canEdit = can(db.viewAs || 'owner', 'settings')
  const pending = db.joinRequests || []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border-subtle)' }}>
        <Tabs
          variant="underline"
          items={TABS.map((k) => ({
            value: k,
            label: t('settings.tab' + k[0].toUpperCase() + k.slice(1)),
            count: k === 'access' ? pending.length : undefined,
          }))}
          value={tab === 'shuttles' ? 'courts' : tab}
          onChange={(v) => a.setTab('settings', v)}
          style={{ borderBottom: 'none' }}
        />
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              icon="upload"
              onClick={() => a.openDialog('importSettings', {})}
            >
              {t('settings.ioImport')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              onClick={a.exportSettings}
            >
              {t('settings.ioExport')}
            </Button>
          </div>
        )}
      </div>
      {tab === 'general' && <General canEdit={canEdit} />}
      {tab === 'money' && <MoneyTab canEdit={canEdit} />}
      {(tab === 'courts' || tab === 'shuttles') && <CourtsAndShuttles canEdit={canEdit} />}
      {tab === 'groups' && <Groups canEdit={canEdit} />}
      {tab === 'schedules' && <Schedules canEdit={canEdit} />}
      {tab === 'access' && <Access canEdit={canEdit} pending={pending} />}
    </>
  )
}

/* ---------------- Chung ---------------- */

function General({ canEdit }) {
  const { db, a } = useApp()
  const c = db.club
  const bank = c.bank || {}

  return (
    <>
      <div style={GRID_PAIR}>
        <Card title={t('settings.clubTitle')} subtitle={t('settings.clubSub')} icon="building-2" padding="14px 16px">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <AvatarUpload
                name={c.name}
                value={c.avatarUrl || ''}
                size={64}
                disabled={!canEdit}
                onChange={(url) => a.setClub('avatarUrl', url)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input label={t('settings.fClubName')} value={c.name} disabled={!canEdit}
                  onChange={(e) => a.setClub('name', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4 }}>
              <Overline>{t('settings.fClubCode')}</Overline>
              <div style={S.codeBox}>
                <Mono weight={600} size={16} color="var(--navy-700)">{c.code}</Mono>
              </div>
              <div style={S.caption}>{t('settings.codeNote')}</div>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <Input label={t('settings.fLockDay')} mono value={String(c.lockDay || cfg.club.defaultLockDay)}
                disabled={!canEdit} onChange={(e) => a.setLockDay(e.target.value)} style={{ width: 120 }} />
              <div style={S.caption}>{t('settings.lockDayNote')}</div>
            </div>
          </div>
        </Card>

        <Card title={t('settings.privacyTitle')} subtitle={t('settings.privacySub')} icon="shield" padding="14px 16px">
          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle label={t('settings.seeDebt')} note={t('settings.seeDebtNote')} checked={!!c.seeDebtEachOther}
              disabled={!canEdit} onChange={() => a.setClub('seeDebtEachOther', !c.seeDebtEachOther)} />
            <Toggle label={t('settings.seeFund')} note={t('settings.seeFundNote')} checked={!!c.seeFund}
              disabled={!canEdit} onChange={() => a.setClub('seeFund', !c.seeFund)} />
            <Toggle label={t('settings.roundUnit')} note={t('settings.roundUnitNote')} checked={!!c.roundUnit}
              disabled={!canEdit} onChange={() => a.setClub('roundUnit', !c.roundUnit)} />
          </div>
        </Card>
      </div>

      <div style={GRID_PAIR}>
        <BankAccountSection
          bankHolder={bank.holder || ''}
          bankNo={bank.no || ''}
          bankName={bank.bank || ''}
          qrUrl={c.bankQrUrl || ''}
          canEdit={canEdit}
          onChange={({ bankHolder, bankNo, bankName, qrUrl }) => {
            a.setClub('bank', { holder: bankHolder, no: bankNo, bank: bankName })
            a.setClub('bankQrUrl', qrUrl)
          }}
        />

        <LevelsCard canEdit={canEdit} />
      </div>

      <DangerZone />
    </>
  )
}

/**
 * Vùng nguy hiểm — chỉ CHỦ CLB thấy. Không gộp vào thẻ "Thông tin CLB" bên trên: nút phá sạch
 * dữ liệu mà nằm cạnh ô sửa tên CLB là mời người ta bấm nhầm.
 *
 * Đọc vai từ `activeClub.role` (RPC my_clubs) chứ không đọc `db.viewAs` — `viewAs` là chế độ
 * "xem như vai khác", chủ CLB đang xem-như-thành-viên vẫn phải là chủ CLB. Cổng thật nằm ở
 * RPC `delete_club` dưới DB, đây chỉ là lớp tiện.
 */
function DangerZone() {
  const { db, toast } = useApp()
  const { activeClub } = useAuth()
  const [open, setOpen] = useState(false)
  if (!activeClub || activeClub.role !== 'owner') return null

  return (
    <>
      <Card title={t('settings.dangerTitle')} subtitle={t('settings.dangerSub')}
        icon="triangle-alert" padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
            {t('settings.delClubNote')}
          </div>
          <Button variant="danger" size="sm" icon="trash-2" onClick={() => setOpen(true)}>
            {t('clubs.delBtn')}
          </Button>
        </div>
      </Card>

      {open && (
        <DeleteClubDialog
          club={{ id: activeClub.id, name: db.club.name, code: db.club.code }}
          onClose={() => setOpen(false)}
          onDone={() => toast(t('toast.clubDeleted', { name: db.club.name }))}
        />
      )}
    </>
  )
}

/** Thang trình độ của CLB. Một ô chữ, phân cách bằng dấu phẩy, YẾU trước MẠNH sau. */
function LevelsCard({ canEdit }) {
  const { db, ui, a } = useApp()
  const saved = (db.levels || []).join(', ')
  const draft = ui.form.levelsText === undefined ? saved : ui.form.levelsText

  return (
    <Card title={t('settings.levelsTitle')} subtitle={t('settings.levelsSub')} icon="layers" padding="14px 16px">
      <div style={{ display: 'grid', gap: 9 }}>
        <Input label={t('settings.fLevels')} value={draft} disabled={!canEdit}
          onChange={(e) => a.setF('levelsText', e.target.value)} />
        <div style={S.caption}>{t('settings.levelsNote')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" icon="check" disabled={!canEdit || draft === saved}
            onClick={() => a.setLevels(draft)}>{t('common.save')}</Button>
          {/* CLB tạo trước khi đổi thang mặc định vẫn giữ thang cũ — nút này để khỏi gõ tay 9 bậc. */}
          <Button variant="secondary" size="sm" icon="sparkles" disabled={!canEdit}
            onClick={() => a.setF('levelsText', cfg.levelsDefault.join(', '))}>
            {t('settings.levelsSuggest')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

const Toggle = ({ label, note, checked, onChange, disabled }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    <div style={S.caption}>{note}</div>
  </div>
)

/* ---------------- Biểu phí (Cố định & Khách) ---------------- */

function MoneyTab({ canEdit }) {
  const { db, a } = useApp()
  const def = db.groups[0] || {}
  const noGroup = db.groups.length === 0

  // 1. Quỹ tháng cố định
  const [hasMonthlyFee, setHasMonthlyFee] = useState(Boolean(intOf(def.feeNam) > 0 || intOf(def.feeNu) > 0))
  const [feeNam, setFeeNam] = useState(String(def.feeNam || ''))
  const [feeNu, setFeeNu] = useState(String(def.feeNu || ''))

  // 2. Hoàn tiền khi vắng mặt (Back tiền)
  const [hasRefund, setHasRefund] = useState(def.hasRefund !== false && def.unitNam !== -1)
  const [customRefundUnit, setCustomRefundUnit] = useState(Boolean(intOf(def.unitNam) > 0 || intOf(def.unitNu) > 0))
  const [unitNam, setUnitNam] = useState(String(def.unitNam > 0 ? def.unitNam : ''))
  const [unitNu, setUnitNu] = useState(String(def.unitNu > 0 ? def.unitNu : ''))

  const [guestPrices, setGuestPrices] = useState(db.guestPrices)
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkWho, setBulkWho] = useState('both')
  const [bulkLevels, setBulkLevels] = useState([])

  useEffect(() => {
    const isFee = Boolean(intOf(def.feeNam) > 0 || intOf(def.feeNu) > 0)
    setHasMonthlyFee(isFee)
    setFeeNam(String(def.feeNam || ''))
    setFeeNu(String(def.feeNu || ''))

    const isRef = def.hasRefund !== false && def.unitNam !== -1
    const isCustom = Boolean(intOf(def.unitNam) > 0 || intOf(def.unitNu) > 0)
    setHasRefund(isRef)
    setCustomRefundUnit(isCustom)
    setUnitNam(String(def.unitNam > 0 ? def.unitNam : ''))
    setUnitNu(String(def.unitNu > 0 ? def.unitNu : ''))

    setGuestPrices(db.guestPrices)
  }, [def.feeNam, def.feeNu, def.unitNam, def.unitNu, def.hasRefund, db.guestPrices])

  const curHasMonthlyFee = Boolean(intOf(def.feeNam) > 0 || intOf(def.feeNu) > 0)
  const curHasRefund = def.hasRefund !== false && def.unitNam !== -1
  const curCustomRefundUnit = Boolean(intOf(def.unitNam) > 0 || intOf(def.unitNu) > 0)

  const isChanged =
    hasMonthlyFee !== curHasMonthlyFee ||
    (hasMonthlyFee && (feeNam !== String(def.feeNam || '') || feeNu !== String(def.feeNu || ''))) ||
    hasRefund !== curHasRefund ||
    (hasRefund && (customRefundUnit !== curCustomRefundUnit || (customRefundUnit && (unitNam !== String(def.unitNam > 0 ? def.unitNam : '') || unitNu !== String(def.unitNu > 0 ? def.unitNu : ''))))) ||
    JSON.stringify(guestPrices) !== JSON.stringify(db.guestPrices)

  const handleCancel = () => {
    setHasMonthlyFee(curHasMonthlyFee)
    setFeeNam(String(def.feeNam || ''))
    setFeeNu(String(def.feeNu || ''))
    setHasRefund(curHasRefund)
    setCustomRefundUnit(curCustomRefundUnit)
    setUnitNam(String(def.unitNam > 0 ? def.unitNam : ''))
    setUnitNu(String(def.unitNu > 0 ? def.unitNu : ''))
    setGuestPrices(db.guestPrices)
    setBulkLevels([])
    setBulkPrice('')
  }

  const handleSave = () => {
    a.saveMoneyTab({
      feeNam: hasMonthlyFee ? feeNam : 0,
      feeNu: hasMonthlyFee ? feeNu : 0,
      hasRefund,
      unitNam: hasRefund ? (customRefundUnit ? unitNam : 0) : -1,
      unitNu: hasRefund ? (customRefundUnit ? unitNu : 0) : -1,
      guestPrices,
    })
  }

  const setPrice = (level, gender, val) => {
    setGuestPrices((prev) => prev.map((p) => (p.level === level ? { ...p, [gender]: intOf(val) } : p)))
  }

  const toggleBulkLevel = (lv) => {
    setBulkLevels((prev) => (prev.indexOf(lv) >= 0 ? prev.filter((x) => x !== lv) : prev.concat([lv])))
  }

  const applyBulk = () => {
    const pr = intOf(bulkPrice)
    setGuestPrices((prev) => prev.map((p) => {
      if (bulkLevels.indexOf(p.level) < 0) return p
      return {
        ...p,
        nam: bulkWho === 'both' || bulkWho === 'nam' ? pr : p.nam,
        nu: bulkWho === 'both' || bulkWho === 'nu' ? pr : p.nu,
      }
    }))
    setBulkLevels([])
  }

  const sampleNam = guestPrices.find((p) => p.nam > 0)?.nam || 0
  const sampleNu = guestPrices.find((p) => p.nu > 0)?.nu || 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 1. Phí thành viên cố định */}
      <Card title={t('settings.generalFeeTitle')} subtitle={t('settings.generalFeeSub')} icon="banknote" padding="16px 18px">
        <div style={{ display: 'grid', gap: 16 }}>
          {noGroup && (
            <Alert tone="warning" title={t('settings.feeNoGroupTitle')}>{t('settings.feeNoGroup')}</Alert>
          )}

          {/* Block 1: Thu quỹ tháng cố định */}
          <div style={{ display: 'grid', gap: 10 }}>
            <Toggle
              label={t('settings.toggleFixedFee')}
              note={t('settings.toggleFixedFeeNote')}
              checked={hasMonthlyFee}
              disabled={!canEdit || noGroup}
              onChange={(e) => {
                const checked = e.target.checked
                setHasMonthlyFee(checked)
                if (checked && !feeNam && !feeNu) {
                  setFeeNam('250000')
                  setFeeNu('200000')
                }
              }}
            />

            {hasMonthlyFee && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                animation: 'fadeIn 0.15s ease',
              }}>
                <Input
                  label={t('settings.feeMale')}
                  mono
                  suffix={t('units.dong')}
                  placeholder="250000"
                  value={feeNam}
                  disabled={!canEdit || noGroup}
                  onChange={(e) => setFeeNam(e.target.value)}
                />
                <Input
                  label={t('settings.feeFemale')}
                  mono
                  suffix={t('units.dong')}
                  placeholder="200000"
                  value={feeNu}
                  disabled={!canEdit || noGroup}
                  onChange={(e) => setFeeNu(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Block 2: Hoàn tiền khi vắng mặt (Back tiền) */}
          <div style={{ display: 'grid', gap: 10 }}>
            <Toggle
              label={t('settings.toggleRefund')}
              note={t('settings.toggleRefundNote')}
              checked={hasRefund}
              disabled={!canEdit || noGroup}
              onChange={(e) => setHasRefund(e.target.checked)}
            />

            {hasRefund && (
              <div style={{
                display: 'grid',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                animation: 'fadeIn 0.15s ease',
              }}>
                <Toggle
                  label={t('settings.toggleCustomRefund')}
                  note={customRefundUnit ? t('settings.refundCustomNote') : t('settings.refundAutoNote')}
                  checked={customRefundUnit}
                  disabled={!canEdit || noGroup}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setCustomRefundUnit(checked)
                    if (checked && !unitNam && !unitNu) {
                      setUnitNam('50000')
                      setUnitNu('45000')
                    }
                  }}
                />

                {customRefundUnit && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Input
                        label={t('settings.unitMale')}
                        mono
                        suffix={t('units.dong')}
                        placeholder="50000"
                        value={unitNam}
                        disabled={!canEdit || noGroup}
                        onChange={(e) => setUnitNam(e.target.value)}
                      />
                      <Input
                        label={t('settings.unitFemale')}
                        mono
                        suffix={t('units.dong')}
                        placeholder="45000"
                        value={unitNu}
                        disabled={!canEdit || noGroup}
                        onChange={(e) => setUnitNu(e.target.value)}
                      />
                    </div>
                    {(sampleNam > 0 || sampleNu > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="sparkles"
                          disabled={!canEdit}
                          onClick={() => {
                            if (sampleNam) setUnitNam(String(sampleNam))
                            if (sampleNu) setUnitNu(String(sampleNu))
                          }}
                        >
                          {t('settings.unitFromGuest')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Giá khách giao lưu */}
      <Card title={t('settings.guestPriceTitle')} subtitle={t('settings.guestPriceSub')} icon="tags" padding="14px 16px">
        <div style={{ display: 'grid', gap: 12 }}>
          {canEdit && (
            <div style={S.bulkBox}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Input label={t('settings.bulkPrice')} mono suffix={t('units.dong')} style={{ width: 140 }}
                    value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
                  <Select label={t('settings.bulkWho')} style={{ width: 140 }} value={bulkWho}
                    options={[
                      { value: 'both', label: t('settings.bulkBoth') },
                      { value: 'nam', label: t('gender.nam') },
                      { value: 'nu', label: t('gender.nu') },
                    ]}
                    onChange={(e) => setBulkWho(e.target.value)} />
                  <Button variant="accent" size="sm" icon="check" disabled={!bulkLevels.length}
                    onClick={applyBulk}>
                    {t('settings.bulkApply', { n: bulkLevels.length })}
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Button variant="ghost" size="sm" onClick={() => setBulkLevels(db.levels)}>
                    {t('settings.bulkAll')}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={!bulkLevels.length} onClick={() => setBulkLevels([])}>
                    {t('settings.bulkClear')}
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {db.levels.map((l) => (
                  <button key={l} type="button" onClick={() => toggleBulkLevel(l)}
                    style={{ ...S.pick, ...(bulkLevels.indexOf(l) >= 0 ? S.pickOn : null) }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ma trận thẻ trình độ 2 cột cân đối, rộng rãi và không bị co chữ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: 10,
          }}>
            {guestPrices.map((p) => (
              <div key={p.level} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr',
                gap: 10,
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <LevelChip level={p.level} levels={db.levels} />
                </div>
                <Input
                  size="sm"
                  mono
                  suffix={t('units.dong')}
                  placeholder="Nam"
                  value={String(p.nam)}
                  disabled={!canEdit}
                  onChange={(e) => setPrice(p.level, 'nam', e.target.value)}
                />
                <Input
                  size="sm"
                  mono
                  suffix={t('units.dong')}
                  placeholder={t('gender.nu')}
                  value={String(p.nu)}
                  disabled={!canEdit}
                  onChange={(e) => setPrice(p.level, 'nu', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Thanh nút Lưu / Hủy cấp Tab - Pin nổi ở viewport, không che nội dung khi cuộn kịch */}
      <div style={{
        position: 'sticky',
        bottom: 16,
        zIndex: 30,
        display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
        padding: '14px 18px', background: 'var(--surface-card)', borderRadius: 12,
        border: '1px solid ' + (isChanged ? 'var(--status-delayed)' : 'var(--border-subtle)'),
        boxShadow: isChanged
          ? '0 10px 30px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12)'
          : '0 4px 16px rgba(0, 0, 0, 0.15)',
        marginTop: 16,
        marginBottom: 8,
      }}>
        <span style={{ marginRight: 'auto', font: 'var(--type-caption)', color: isChanged ? 'var(--status-delayed)' : 'var(--text-muted)' }}>
          {t(isChanged ? 'settings.dirtyPricing' : 'settings.syncedPricing')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon="rotate-ccw"
          disabled={!canEdit || !isChanged}
          onClick={handleCancel}
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon="check"
          disabled={!canEdit || !isChanged}
          onClick={handleSave}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Sân & Cầu ---------------- */

function CourtsAndShuttles({ canEdit }) {
  const { db, a } = useApp()
  // So định mức với số cầu thực tế của các buổi đã chốt KHÔNG còn cờ ước lượng.
  const real = db.sessions.filter((s) => s.status === 'closed' && !s.shuttleEst)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 1. Sân bãi & Giá thuê */}
      <Card
        title={t('settings.courtsTitle')}
        subtitle={t('settings.courtsSub')}
        icon="map-pin"
        padding="14px 16px"
        actions={canEdit && (
          <Button variant="secondary" size="sm" icon="plus"
            onClick={() => a.openDialog('newCourt', courtForm())}>
            {t('settings.addCourt')}
          </Button>
        )}
      >
        {db.courts.length === 0 ? (
          <Empty icon="map-pin" title={t('settings.noCourt')} hint={t('settings.noCourtHint')} />
        ) : (
          <div style={{ display: 'grid', gap: 10, overflowX: 'auto' }}>
            <div style={{ ...S.courtGrid, ...S.headRow }}>
              <span>{t('settings.colCourt')}</span>
              <span>{t('settings.colAddress')}</span>
              <span>{t('settings.colMapUrl')}</span>
              <span>{t('settings.colPrice')}</span>
              <span>{t('settings.colActive')}</span>
            </div>
            {db.courts.map((c) => (
              <div key={c.id} style={S.courtGrid}>
                <Input
                  size="sm"
                  value={c.name}
                  disabled={!canEdit}
                  placeholder={t('settings.phCourtName')}
                  style={{ fontWeight: 600 }}
                  onChange={(e) => a.setCourtField(c.id, 'name', e.target.value)}
                />
                <Input
                  size="sm"
                  value={c.addr || ''}
                  disabled={!canEdit}
                  placeholder={t('settings.phCourtAddr')}
                  onChange={(e) => a.setCourtField(c.id, 'addr', e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Input
                    size="sm"
                    value={c.mapUrl || ''}
                    disabled={!canEdit}
                    placeholder="https://maps.app.goo.gl/..."
                    style={{ flex: 1 }}
                    onChange={(e) => a.setCourtField(c.id, 'mapUrl', e.target.value)}
                  />
                  {c.mapUrl && (
                    <a
                      href={c.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: 6,
                        border: '1px solid var(--border-subtle)', background: 'var(--surface-brand-soft)',
                        color: 'var(--teal-600)', flexShrink: 0, textDecoration: 'none',
                      }}
                      title={t('settings.openMapTitle')}
                    >
                      <Icon name="map-pin" size={14} />
                    </a>
                  )}
                </div>
                <Input
                  size="sm"
                  mono
                  suffix={t('units.dongPerHour')}
                  value={String(c.price)}
                  disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'price', e.target.value)}
                />
                <Switch
                  checked={c.active !== false}
                  disabled={!canEdit}
                  onChange={() => a.setCourtField(c.id, 'active', c.active === false)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2. Loại cầu & Định mức cầu */}
      <Card
        title={t('settings.typesQuotaTitle')}
        subtitle={t('settings.typesQuotaSub')}
        icon="package-open"
        padding="14px 16px"
        actions={canEdit && (
          <Button variant="secondary" size="sm" icon="plus"
            onClick={() => a.addShuttleType()}>
            {t('settings.addType')}
          </Button>
        )}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Bảng các loại cầu */}
          {db.shuttleTypes.length === 0 ? (
            <Empty icon="package-open" title={t('settings.noType')} hint={t('settings.noTypeHint')} />
          ) : (
            <div style={{ display: 'grid', gap: 8, overflowX: 'auto' }}>
              <div style={{ ...S.typeGrid, ...S.headRow }}>
                <span>{t('settings.colType')}</span>
                <span>{t('settings.hPerTube')}</span>
                <span>{t('settings.hRefPrice')}</span>
                <span>{t('settings.hUse')}</span>
                <span />
              </div>
              {db.shuttleTypes.map((x) => (
                <div key={x.id} style={S.typeGrid}>
                  <Input size="sm" value={x.name} disabled={!canEdit} placeholder={t('settings.phTypeName')}
                    onChange={(e) => a.setShuttleType(x.id, 'name', e.target.value)} />
                  <Input size="sm" mono suffix={t('units.shuttle')} value={String(x.perTube)} disabled={!canEdit}
                    placeholder="12"
                    onChange={(e) => a.setShuttleType(x.id, 'perTube', e.target.value)} />
                  <Input size="sm" mono suffix={t('units.dong')} value={String(x.pricePerTube || 0)} disabled={!canEdit}
                    placeholder="0"
                    onChange={(e) => a.setShuttleType(x.id, 'pricePerTube', e.target.value)} />
                  <Switch checked={x.active !== false} disabled={!canEdit}
                    onChange={() => a.setShuttleType(x.id, 'active', x.active === false)} />
                  {canEdit && (
                    <IconButton
                      icon="trash-2"
                      size="sm"
                      variant="ghost"
                      style={{ color: 'var(--status-incident)', padding: 0 }}
                      label={t('common.delete')}
                      onClick={() => a.confirm({
                        title: t('settings.typeDelTitle', { name: x.name }),
                        message: t('settings.typeDelMsg'),
                        tone: 'danger',
                        confirmText: t('settings.typeDelOk'),
                        onConfirm: () => a.deleteShuttleType(x.id),
                      })}
                    />
                  )}
                </div>
              ))}
              <div style={S.caption}>{t('settings.typesNote')}</div>
            </div>
          )}

          {/* Định mức cầu mỗi buổi */}
          {db.groups.length > 0 && (
            <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Overline>{t('settings.quotaTitle')}</Overline>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.quotaSub')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {db.groups.map((g) => {
                  const mine = real.filter((s) => s.groupId === g.id)
                  const avg = mine.length ? Math.round(mine.reduce((x, s) => x + s.shuttleUsed, 0) / mine.length) : null
                  return (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '8px 12px', borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {avg === null ? t('settings.quotaNone') : t('settings.quotaAvg', { avg })}
                        </div>
                      </div>
                      <Input size="sm" mono suffix={t('units.shuttle')} value={String(g.quota)} disabled={!canEdit}
                        style={{ width: 85 }}
                        onChange={(e) => a.setGroupField(g.id, 'quota', e.target.value)} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Nhóm cố định ---------------- */

function Groups({ canEdit }) {
  const { db, a } = useApp()
  const noCourt = db.courts.length === 0

  const [draft, setDraft] = useState(db.groups)

  useEffect(() => {
    setDraft(db.groups)
  }, [db.groups])

  const isChanged = JSON.stringify(draft) !== JSON.stringify(db.groups)

  const updateGroup = (id, field, value) => {
    setDraft((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)))
  }

  const handleCancel = () => {
    setDraft(db.groups)
  }

  const handleSave = () => {
    a.saveGroupsTab(draft)
  }

  return (
    <Card title={t('settings.groupsTitle')} subtitle={t('settings.groupsSub')} icon="users" padding="14px 16px"
      actions={canEdit && (
        <Button variant="secondary" size="sm" icon="plus" disabled={noCourt}
          onClick={() => a.openDialog('newGroup', groupForm(db))}>{t('settings.addGroup')}</Button>
      )}>
      {draft.length === 0
        ? <Empty icon="users" title={t('settings.noGroup')}
            hint={noCourt ? t('settings.noCourtFirst') : t('settings.noGroupHint')} />
        : <div style={{ display: 'grid', gap: 14 }}>
            {draft.map((g, idx) => (
              <div key={g.id} style={S.groupBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {g.name || t('settings.groupNo', { n: idx + 1 })}
                    </span>
                  </div>
                  {/* Không còn "nhóm mặc định không xoá": đó là luật theo VỊ TRÍ trong mảng, mà
                      nhập cài đặt từ CLB khác là thứ tự đổi và người ta kẹt với một nhóm rác.
                      Chặn hay không giờ do `groupRefs` quyết theo dữ liệu thật. */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash-2"
                      onClick={() => {
                        a.confirm({
                          title: t('settings.groupDelTitle', { name: g.name }),
                          message: t('settings.groupDelMsg', { name: g.name }),
                          tone: 'danger',
                          confirmText: t('settings.groupDel'),
                          onConfirm: () => a.deleteGroup(g.id),
                        })
                      }}
                    >
                      {t('settings.groupDel')}
                    </Button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10 }}>
                  <Input label={t('settings.fGroupName')} value={g.name} disabled={!canEdit}
                    onChange={(e) => updateGroup(g.id, 'name', e.target.value)} />
                  <Input label={t('settings.fGroupShort')} value={g.short || ''} disabled={!canEdit}
                    onChange={(e) => updateGroup(g.id, 'short', e.target.value)} />
                  <Input label={t('settings.fGroupFrom')} mono value={g.from} disabled={!canEdit}
                    onChange={(e) => updateGroup(g.id, 'from', e.target.value)} />
                  <Input label={t('settings.fGroupTo')} mono value={g.to} disabled={!canEdit}
                    onChange={(e) => updateGroup(g.id, 'to', e.target.value)} />
                </div>
                {/* Nói thẳng hai ô giờ trên chỉ là giá trị điền sẵn. Trước đây chúng đứng ngang
                    hàng với biểu phí nên trông như nhóm cũng định nghĩa lịch — mà buổi tập lấy
                    giờ từ `schedule_slots`, sửa ở đây không đụng buổi nào. */}
                <div style={S.caption}>{t('settings.groupTimeNote')}</div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8, background: 'var(--surface-inset)',
                  font: 'var(--type-caption)', color: 'var(--text-secondary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Tag tone="accent" size="sm">{t('settings.pricingGeneral')}</Tag>
                    <span>
                      {t('settings.groupFeeLabel')}: <strong style={{ color: 'var(--text-primary)' }}>{fmtK(g.feeNam)}{t('units.dong')}</strong> ({t('gender.nam')}) · <strong style={{ color: 'var(--text-primary)' }}>{fmtK(g.feeNu)}{t('units.dong')}</strong> ({t('gender.nu')})
                      {' · '}
                      {g.unitNam > 0 || g.unitNu > 0
                        ? t('settings.groupBackUnit', {
                          male: fmtK(g.unitNam) + t('units.dong'),
                          female: fmtK(g.unitNu) + t('units.dong'),
                        })
                        : t('settings.groupBackGuest')}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>{t('settings.groupQuota', { n: g.quota || 24 })}</span>
                </div>
              </div>
            ))}

            {/* Thanh nút Lưu / Hủy cấp Tab - Pin nổi ở viewport, không che nội dung khi cuộn kịch */}
            <div style={{
              position: 'sticky',
              bottom: 16,
              zIndex: 30,
              display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
              padding: '14px 18px', background: 'var(--surface-card)', borderRadius: 12,
              border: '1px solid ' + (isChanged ? 'var(--status-delayed)' : 'var(--border-subtle)'),
              boxShadow: isChanged
                ? '0 10px 30px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12)'
                : '0 4px 16px rgba(0, 0, 0, 0.15)',
              marginTop: 16,
              marginBottom: 8,
            }}>
              <span style={{ marginRight: 'auto', font: 'var(--type-caption)', color: isChanged ? 'var(--status-delayed)' : 'var(--text-muted)' }}>
                {t(isChanged ? 'settings.dirtyGroups' : 'settings.syncedGroups')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon="rotate-ccw"
                disabled={!canEdit || !isChanged}
                onClick={handleCancel}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="check"
                disabled={!canEdit || !isChanged}
                onClick={handleSave}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>}
    </Card>
  )
}

/* ---------------- Tài khoản & quyền ---------------- */

/**
 * MỘT yêu cầu vào CLB đang chờ duyệt, kèm bảng chọn trường ghi đè.
 *
 * Hai bảng, không phải một: `profiles` là hồ sơ TÀI KHOẢN (một cái cho mọi CLB), `club_members`
 * là hồ sơ TRONG CLB này. Ghép chỉ gắn `user_id` — thông tin CLB đang có KHÔNG tự đổi theo hồ sơ
 * tài khoản, vì đó chính là thứ mọi bảng điểm danh, mọi dòng tiền cũ đang gọi tên. Muốn lấy
 * sang thì tick từng trường, và mặc định KHÔNG tick gì.
 *
 * Ghi đè xong không có đường lùi: bản ghi CLB là bản sao độc lập, gỡ ghép cũng không trả lại
 * giá trị cũ. Vì thế mỗi dòng in rõ "CLB đang có → sẽ thành", và trường không ghép được thì
 * khoá lại kèm lý do thay vì lặng lẽ bỏ qua (`lib/members.js: mergeRows`).
 */
function JoinRow({ r, canEdit, unlinked }) {
  const { db, ui, a } = useApp()
  const u = db.users.find((x) => x.id === r.userId) || {}
  // Bản ghi tay trùng SĐT — chọn sẵn để bấm nhầm "Tạo thành viên mới" không còn là lối dễ đi
  // nhất. Tạo mới ở đây là sinh ra người thứ hai cùng một con người: hai dòng cùng chạy song
  // song, và GỘP LẠI thì app chưa làm được.
  const dup = unlinked.find((m) => digits(m.phone) && digits(m.phone) === digits(u.phone))
  const pick = ui.form['join_' + r.id] ?? (dup ? dup.id : '')
  const target = unlinked.find((m) => m.id === pick) || null
  const rows = target ? mergeRows(target, u, db.levels) : []
  const ticked = ui.form['jf_' + r.id] || []
  // Lọc lại theo `rows` chứ không tin thẳng ô đã tick: đổi sang bản ghi khác thì một trường
  // đang tick có thể thành 'same' hoặc 'offScale', gửi đi là RPC bỏ qua trong im lặng còn toast
  // vẫn khoe đã ghi đè.
  const take = rows.filter((x) => !x.block && ticked.indexOf(x.field) >= 0).map((x) => x.field)

  // Đổi bản ghi đích thì xoá sạch ô đã tick: giá trị "sẽ thành" vừa đổi hết, giữ tick cũ là
  // ghi đè lên một người khác với lựa chọn dành cho người trước.
  const setPick = (id) => { a.setF('join_' + r.id, id); a.setF('jf_' + r.id, []) }
  const toggle = (field) => a.setF('jf_' + r.id,
    ticked.indexOf(field) >= 0 ? ticked.filter((x) => x !== field) : ticked.concat([field]))

  return (
    <div style={{ display: 'grid', gap: 9, padding: '11px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={u.name || ''} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.label}>{u.name}</div>
          <Mono color="var(--text-muted)">
            {t('settings.joinMeta', { phone: u.phone, code: r.code, date: ddmy(r.at) })}
          </Mono>
          {r.note && <div style={S.caption}>{r.note}</div>}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: 'grid', gap: 7 }}>
          {dup && (
            <div style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>
              {t('settings.joinDupWarn', { name: dup.name })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select size="sm" style={{ width: 240 }} value={pick}
              options={[{ value: '', label: t('settings.joinPickMember') }].concat(
                unlinked.map((m) => ({ value: m.id, label: m.name + ' · ' + (m.phone || '') }))
              )}
              onChange={(e) => setPick(e.target.value)} />
            {/* Chưa chọn ai mà bấm Ghép thì RPC nhận p_member_id = null và tạo người mới —
                nút nói một đằng làm một nẻo. Khoá lại. */}
            <Button variant="primary" size="sm" icon="link" disabled={!pick}
              onClick={() => a.approveJoin(r.id, pick, take)}>{t('settings.joinLink')}</Button>
            <Button variant="ghost" size="sm" icon="user-round-plus"
              onClick={() => a.approveJoin(r.id, null)}>{t('settings.joinCreate')}</Button>
            <Button variant="ghost" size="sm" icon="circle-x"
              onClick={() => a.rejectJoin(r.id)}>{t('settings.joinReject')}</Button>
          </div>

          {target && (
            <div style={S.mergeBox}>
              <Overline>{t('settings.mergeTitle')}</Overline>
              <div style={S.caption}>{t('settings.mergeHint')}</div>
              {rows.map((x) => (
                <div key={x.field} style={S.mergeRow}>
                  <Checkbox
                    label={t('settings.mergeField.' + x.field) || t('members.changeField.' + x.field) || x.field}
                    checked={ticked.indexOf(x.field) >= 0 && !x.block}
                    disabled={!!x.block}
                    onChange={() => toggle(x.field)}
                  />
                  {x.block
                    ? <span style={S.caption}>{t('settings.mergeBlock.' + x.block)}</span>
                    : <Mono color="var(--text-muted)">
                        {t('settings.mergeArrow', {
                          from: showVal(x.field, x.from) || t('common.notYet'),
                          to: showVal(x.field, x.to),
                        })}
                      </Mono>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Giới tính lưu bằng KEY ('nam' / 'nu'), bảng so sánh phải in ra chữ người đọc được. */
const showVal = (field, v) => {
  if (!v) return ''
  if (field === 'gender') return genderTxt(v)
  if (field === 'avatarUrl') return t('settings.mergeField.avatarUrl')
  if (field === 'qrUrl') return t('settings.mergeField.qrUrl')
  return v
}

function Access({ canEdit, pending }) {
  const { db, ui, a } = useApp()
  // `invite` cố ý không đọc nữa: mời qua SĐT đã gỡ khỏi client, chờ module riêng có gửi tin
  // thật. Cột `clubs.allow_invite` vẫn nằm dưới DB.
  const lm = { code: true, phone: true, ...db.club.linkModes }

  /**
   * Tài khoản đã gắn vào MỘT bản ghi nào đó của CLB này. Không được hiện lại ở ô ghép:
   * `linkMemberUser` tự bỏ ghép bản ghi cũ (một user chỉ gắn một bản ghi — `club_members`
   * có UNIQUE (club_id, user_id)), nên chọn nhầm là ÂM THẦM cướp tài khoản của người khác,
   * và toast chỉ báo ghép thành công chứ không nói ai vừa bị gỡ.
   */
  const takenUserIds = new Set(db.members.filter((m) => m.userId).map((m) => m.userId))

  // Tài khoản tra được bằng email (RPC `find_member_candidate`, 0013). Gộp thẳng vào danh sách
  // chọn của MỌI dòng thay vì làm một luồng ghép riêng: người dùng vẫn bấm đúng nút Ghép cũ,
  // và chỉ có một đường ghép duy nhất trong code.
  const [found, setFound] = useState([])
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [looking, setLooking] = useState(false)

  const lookup = async () => {
    setLookupErr('')
    setLooking(true)
    try {
      const r = await a.findMemberCandidate(lookupEmail)
      if (!r) setLookupErr(t('settings.lookupNone'))
      else if (r.alreadyInClub) setLookupErr(t('settings.lookupTaken', { name: r.name }))
      else {
        setFound((prev) => (prev.some((x) => x.id === r.id) ? prev : prev.concat([{ ...r, email: lookupEmail.trim() }])))
        setLookupEmail('')
      }
    } catch (e) {
      setLookupErr(e.message)
    }
    setLooking(false)
  }

  const freeUsers = (db.users || []).filter((u) => !takenUserIds.has(u.id))
    .concat(found.filter((u) => !takenUserIds.has(u.id) && !(db.users || []).some((x) => x.id === u.id)))

  /** Tài khoản có SĐT trùng và CHƯA gắn vào CLB này — chỉ gợi ý, không tự ghép. */
  const suggestFor = (m) => {
    if (!lm.phone || m.userId || !digits(m.phone)) return null
    return freeUsers.find((u) => digits(u.phone) === digits(m.phone)) || null
  }
  const unlinked = db.members.filter((m) => !m.userId && m.active !== false)
  // Ngõ cụt hay gặp: còn người chưa ghép nhưng không có tài khoản nào chờ ghép. `db.users` chỉ
  // gồm người ĐÃ ghép + người ĐANG XIN VÀO (storage.js), nên không có yêu cầu nào là ô chọn
  // rỗng. Báo rỗng không thôi thì người dùng đứng hình — phải chỉ luôn đường đi tiếp.
  const linkDeadEnd = unlinked.length > 0 && freeUsers.length === 0
  const linkedCount = db.members.filter((m) => m.userId).length

  return (
    <>
      <Card title={t('settings.joinTitle')} subtitle={t('settings.joinSub')} icon="user-round-plus" padding="14px">
        {pending.length === 0
          ? <Empty icon="circle-check" title={t('settings.joinEmpty')}
              hint={t('settings.joinEmptyHint', { code: db.club.code })} />
          : <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((r) => (
                <JoinRow key={r.id} r={r} canEdit={canEdit} unlinked={unlinked} />
              ))}
            </div>}
      </Card>

      <div style={{ ...GRID_PAIR, gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
        <Card title={t('settings.linkModesTitle')} subtitle={t('settings.linkModesSub')} icon="settings-2" padding="14px 16px">
          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle label={t('settings.modeCode')} note={t('settings.modeCodeNote', { code: db.club.code })}
              checked={lm.code} disabled={!canEdit} onChange={() => a.toggleLinkMode('code')} />
            <Toggle label={t('settings.modePhone')} note={t('settings.modePhoneNote')}
              checked={lm.phone} disabled={!canEdit} onChange={() => a.toggleLinkMode('phone')} />
          </div>
        </Card>

        <Card title={t('settings.rolesTitle')} subtitle={t('settings.rolesSub')} icon="shield" padding="14px 16px">
          <div style={{ display: 'grid', gap: 9 }}>
            {ROLES.map((r) => (
              <div key={r.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ ...S.rolePill, width: 92 }}>{r.label}</span>
                <span style={{ ...S.caption, flex: 1 }}>{roleDesc(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title={t('settings.membersTitle')}
        subtitle={t('settings.membersSub', { linked: linkedCount, total: db.members.length })}
        icon="users"
        padding="0"
      >
        {canEdit && (
          <div style={{ padding: '12px 14px 0', display: 'grid', gap: 8 }}>
            {linkDeadEnd && (
              <Alert tone="info" title={t('settings.linkNoFree')}>
                {t('settings.linkHint', { code: db.club.code })}
              </Alert>
            )}
            {/* Tra theo email CHÍNH XÁC. Tìm thấy thì tài khoản đó vào danh sách chọn của mọi
                dòng bên dưới — ghép vẫn bằng nút Ghép cũ, không đẻ luồng ghép thứ hai. */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Input
                label={t('settings.lookupLabel')}
                hint={t('settings.lookupHint')}
                placeholder="ten@email.com"
                style={{ minWidth: 260 }}
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') lookup() }}
              />
              <Button variant="secondary" icon="search" disabled={!lookupEmail.trim() || looking}
                onClick={lookup}>
                {t(looking ? 'settings.lookupBusy' : 'settings.lookupDo')}
              </Button>
            </div>
            {lookupErr && <Alert tone="warning">{lookupErr}</Alert>}
            {found.length > 0 && (
              <Alert tone="success" title={t('settings.lookupFound')}>
                {t('settings.lookupFoundHint', { names: found.map((u) => u.name).join(', ') })}
              </Alert>
            )}
          </div>
        )}
        <div style={{ display: 'grid', overflowX: 'auto' }}>
          <div style={{ ...S.accGrid, ...S.accHead }}>
            <span>{t('settings.colMember')}</span>
            <span>{t('settings.colPhone')}</span>
            <span>{t('settings.colAccount')}</span>
            <span>{t('settings.colRole')}</span>
            <span>{t('settings.colTodo')}</span>
          </div>
          {db.members.filter((m) => m.active !== false).map((m) => {
            const user = m.userId && db.users.find((u) => u.id === m.userId)
            const sug = suggestFor(m)
            return (
              <div key={m.id} style={{ ...S.accGrid, ...S.accRow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={m.name} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={S.label}>{m.name}</div>
                    {m.fullName && <div style={S.caption}>{m.fullName}</div>}
                  </div>
                </div>
                <Mono color="var(--text-muted)">{m.phone || t('common.unknown')}</Mono>
                <span>
                  {user
                    ? <span style={{ ...S.pill, background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }}>
                        {t('settings.accLinked', { name: user.nick || user.name })}
                      </span>
                    : <span style={{ ...S.pill, background: 'var(--status-idle-bg)', color: 'var(--status-idle-fg)' }}>
                        {t('settings.accNone')}
                      </span>}
                </span>
                <Select size="sm" value={m.role} disabled={!canEdit}
                  options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  onChange={(e) => a.setMemberRole(m.id, e.target.value)} />
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  {canEdit && user && (
                    <Button variant="ghost" size="sm" icon="unlink"
                      onClick={() => a.confirm({
                        title: t('settings.unlinkTitle', { name: m.name }),
                        message: t('settings.unlinkMsg', { account: user.nick || user.name, name: m.name }),
                        tone: 'warning',
                        confirmText: t('settings.doUnlink'),
                        onConfirm: () => a.unlinkMember(m.id),
                      })}>
                      {t('settings.doUnlink')}
                    </Button>
                  )}
                  {canEdit && !user && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Select
                        size="sm"
                        style={{ minWidth: 160 }}
                        value={ui.form['link_u_' + m.id] ?? (sug ? sug.id : '')}
                        disabled={freeUsers.length === 0}
                        options={[{
                          value: '',
                          label: t(freeUsers.length ? 'settings.linkPick' : 'settings.linkNoFree'),
                        }].concat(
                          // Hiện EMAIL cạnh tên: `db.users` toàn người có tài khoản thật, mà tên
                          // trong CLB thì trùng nhau như cơm bữa. Không có email thì không cách
                          // nào biết đang ghép đúng người hay không.
                          freeUsers.map((u) => ({
                            value: u.id,
                            label: [u.name || u.id, u.email, u.phone].filter(Boolean).join(' · '),
                          }))
                        )}
                        onChange={(e) => a.setF('link_u_' + m.id, e.target.value)}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon="link"
                        title={freeUsers.length === 0 ? t('settings.linkHint', { code: db.club.code }) : undefined}
                        disabled={!(ui.form['link_u_' + m.id] ?? (sug ? sug.id : ''))}
                        onClick={() => {
                          const targetUid = ui.form['link_u_' + m.id] ?? (sug ? sug.id : '')
                          if (targetUid) {
                            a.linkMemberUser(m.id, targetUid)
                            a.setF('link_u_' + m.id, undefined)
                          }
                        }}
                      >
                        {t('settings.doLink')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

const S = {
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  headRow: {
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)', paddingBottom: 2,
  },
  codeBox: {
    padding: '9px 12px', borderRadius: 8, background: 'var(--surface-brand-soft)',
    border: '1px solid var(--border-subtle)', width: 'fit-content', letterSpacing: '.12em',
  },
  bulkBox: {
    display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 8,
    background: 'var(--surface-inset)', border: '1px dashed var(--border-subtle)',
  },
  priceGrid: { display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 10, alignItems: 'center' },
  courtGrid: { display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.5fr 120px 60px', gap: 10, alignItems: 'center' },
  groupBox: { display: 'grid', gap: 8, padding: '11px 13px', borderRadius: 8, background: 'var(--surface-inset)' },
  mergeBox: {
    display: 'grid', gap: 7, padding: '10px 12px', borderRadius: 8,
    background: 'var(--surface-inset)', border: '1px dashed var(--border-subtle)',
  },
  mergeRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, flexWrap: 'wrap',
  },
  groupRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 },
  pick: {
    padding: '7px 12px', borderRadius: 99, border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)', color: 'var(--text-primary)',
    font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
  },
  pickOn: { borderColor: 'var(--teal-500)', background: 'var(--surface-accent-soft)' },
  typeGrid: { display: 'grid', gridTemplateColumns: '1.4fr 120px 140px 60px 36px', gap: 10, alignItems: 'center' },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '6px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)', textAlign: 'center',
  },
  pill: {
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    display: 'inline-block',
  },
  accGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr 150px 1.4fr', gap: 10, minWidth: 940 },
  accHead: {
    padding: '10px 18px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)',
  },
  accRow: { padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' },
}
