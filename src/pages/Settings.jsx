// Cài đặt: Chung · Cách chia tiền · Sân · Cầu · Nhóm cố định · Tài khoản & quyền (handoff 02 §7).

import { useState, useEffect } from 'react'
import { Alert, Avatar, Button, Card, Input, Select, Switch, Tabs, Tag } from '#ds'
import { DeleteClubDialog, Empty, GRID_PAIR, Mono, Overline } from '#ui'
import { courtForm, groupForm } from '#lib/forms.js'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { WD, ddmy } from '#utils/dates.js'
import { ROLES, can, roleDesc } from '#lib/roles.js'
import { fmtK, intOf } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import Schedules from './Schedules.jsx'

const TABS = ['general', 'money', 'courts', 'shuttles', 'groups', 'schedules', 'access']

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
          value={tab}
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
      {tab === 'courts' && <Courts canEdit={canEdit} />}
      {tab === 'shuttles' && <ShuttleTab canEdit={canEdit} />}
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
          <div style={{ display: 'grid', gap: 12 }}>
            <Input label={t('settings.fClubName')} value={c.name} disabled={!canEdit}
              onChange={(e) => a.setClub('name', e.target.value)} />
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
        <Card title={t('settings.bankTitle')} subtitle={t('settings.bankSub')} icon="landmark" padding="14px 16px">
          <div style={{ display: 'grid', gap: '9px 12px', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
            <Overline>{t('settings.fBankHolder')}</Overline>
            <Mono color="var(--text-primary)">{bank.holder || t('common.unknown')}</Mono>
            <Overline>{t('settings.fBankNo')}</Overline>
            <Mono color="var(--text-primary)">{bank.no || t('common.unknown')}</Mono>
            <Overline>{t('settings.fBankName')}</Overline>
            <Mono color="var(--text-primary)">{bank.bank || t('common.unknown')}</Mono>
          </div>
        </Card>

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

  const [feeNam, setFeeNam] = useState(String(def.feeNam ?? ''))
  const [feeNu, setFeeNu] = useState(String(def.feeNu ?? ''))
  const [unitNam, setUnitNam] = useState(String(def.unitNam ?? ''))
  const [unitNu, setUnitNu] = useState(String(def.unitNu ?? ''))
  const [guestPrices, setGuestPrices] = useState(db.guestPrices)

  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkWho, setBulkWho] = useState('both')
  const [bulkLevels, setBulkLevels] = useState([])

  useEffect(() => {
    setFeeNam(String(def.feeNam ?? ''))
    setFeeNu(String(def.feeNu ?? ''))
    setUnitNam(String(def.unitNam ?? ''))
    setUnitNu(String(def.unitNu ?? ''))
    setGuestPrices(db.guestPrices)
  }, [def.feeNam, def.feeNu, def.unitNam, def.unitNu, db.guestPrices])

  const isChanged =
    feeNam !== String(def.feeNam ?? '') ||
    feeNu !== String(def.feeNu ?? '') ||
    unitNam !== String(def.unitNam ?? '') ||
    unitNu !== String(def.unitNu ?? '') ||
    JSON.stringify(guestPrices) !== JSON.stringify(db.guestPrices)

  const handleCancel = () => {
    setFeeNam(String(def.feeNam ?? ''))
    setFeeNu(String(def.feeNu ?? ''))
    setUnitNam(String(def.unitNam ?? ''))
    setUnitNu(String(def.unitNu ?? ''))
    setGuestPrices(db.guestPrices)
    setBulkLevels([])
    setBulkPrice('')
  }

  const handleSave = () => {
    a.saveMoneyTab({
      feeNam,
      feeNu,
      unitNam,
      unitNu,
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
      <Card title={t('settings.generalFeeTitle')} subtitle={t('settings.generalFeeSub')} icon="banknote" padding="14px 16px">
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label={t('settings.feeMale')}
              mono
              suffix={t('units.dong')}
              value={feeNam}
              disabled={!canEdit}
              onChange={(e) => setFeeNam(e.target.value)}
            />
            <Input
              label={t('settings.feeFemale')}
              mono
              suffix={t('units.dong')}
              value={feeNu}
              disabled={!canEdit}
              onChange={(e) => setFeeNu(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label={t('settings.unitMale')}
                mono
                suffix={t('units.dong')}
                value={unitNam}
                disabled={!canEdit}
                onChange={(e) => setUnitNam(e.target.value)}
              />
              <Input
                label={t('settings.unitFemale')}
                mono
                suffix={t('units.dong')}
                value={unitNu}
                disabled={!canEdit}
                onChange={(e) => setUnitNu(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={S.caption}>{t('settings.unitNote')}</div>
              {(sampleNam > 0 || sampleNu > 0) && (
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
                  Lấy theo giá vãng lai
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Giá khách giao lưu */}
      <Card title={t('settings.guestPriceTitle')} subtitle={t('settings.guestPriceSub')} icon="tags" padding="14px 16px">
        <div style={{ display: 'grid', gap: 12 }}>
          {canEdit && (
            <div style={S.bulkBox}>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Input label={t('settings.bulkPrice')} mono suffix={t('units.dong')} style={{ width: 150 }}
                  value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
                <Select label={t('settings.bulkWho')} style={{ width: 150 }} value={bulkWho}
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
              <div style={{ display: 'grid', gap: 5 }}>
                <Overline>{t('settings.bulkPick')}</Overline>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {db.levels.map((l) => (
                    <button key={l} type="button" onClick={() => toggleBulkLevel(l)}
                      style={{ ...S.pick, ...(bulkLevels.indexOf(l) >= 0 ? S.pickOn : null) }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ ...S.priceGrid, ...S.headRow }}>
            <span>{t('settings.colLevel')}</span>
            <span>{t('settings.colMale')}</span>
            <span>{t('settings.colFemale')}</span>
          </div>
          {guestPrices.map((p) => (
            <div key={p.level} style={S.priceGrid}>
              <span style={S.label}>{p.level}</span>
              <Input mono suffix={t('units.dong')} value={String(p.nam)} disabled={!canEdit}
                onChange={(e) => setPrice(p.level, 'nam', e.target.value)} />
              <Input mono suffix={t('units.dong')} value={String(p.nu)} disabled={!canEdit}
                onChange={(e) => setPrice(p.level, 'nu', e.target.value)} />
            </div>
          ))}
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
          {isChanged ? '● Có thay đổi chưa lưu trên tab Biểu phí' : 'Đã đồng bộ toàn bộ biểu phí'}
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

/* ---------------- Sân ---------------- */

function Courts({ canEdit }) {
  const { db, a } = useApp()
  return (
    <Card title={t('settings.courtsTitle')} subtitle={t('settings.courtsSub')} icon="map-pin" padding="14px 16px"
      actions={canEdit && (
        <Button variant="secondary" size="sm" icon="plus"
          onClick={() => a.openDialog('newCourt', courtForm())}>{t('settings.addCourt')}</Button>
      )}>
      {db.courts.length === 0
        ? <Empty icon="map-pin" title={t('settings.noCourt')} hint={t('settings.noCourtHint')} />
        : <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ ...S.courtGrid, ...S.headRow }}>
              <span>{t('settings.colCourt')}</span>
              <span>{t('settings.colAddress')}</span>
              <span>{t('settings.colPrice')}</span>
              <span>{t('settings.colActive')}</span>
            </div>
            {db.courts.map((c) => (
              <div key={c.id} style={S.courtGrid}>
                <Input value={c.name} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'name', e.target.value)} />
                <Input value={c.addr || ''} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'addr', e.target.value)} />
                <Input mono suffix={t('units.dong')} value={String(c.price)} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'price', e.target.value)} />
                <Switch checked={c.active !== false} disabled={!canEdit}
                  onChange={() => a.setCourtField(c.id, 'active', c.active === false)} />
              </div>
            ))}
          </div>}
    </Card>
  )
}

/* ---------------- Cầu ---------------- */

function ShuttleTab({ canEdit }) {
  const { db, a } = useApp()
  // So định mức với số cầu thực tế của các buổi đã chốt KHÔNG còn cờ ước lượng.
  const real = db.sessions.filter((s) => s.status === 'closed' && !s.shuttleEst)

  return (
    <>
      <Card title={t('settings.quotaTitle')} subtitle={t('settings.quotaSub')} icon="package" padding="14px 16px">
        <div style={{ display: 'grid', gap: 12 }}>
          {db.groups.map((g) => {
            const mine = real.filter((s) => s.groupId === g.id)
            const avg = mine.length ? Math.round(mine.reduce((x, s) => x + s.shuttleUsed, 0) / mine.length) : null
            return (
              <div key={g.id} style={{ display: 'grid', gap: 4 }}>
                <Input label={g.name} mono suffix={t('units.shuttle')} value={String(g.quota)} disabled={!canEdit}
                  onChange={(e) => a.setGroupField(g.id, 'quota', e.target.value)} style={{ maxWidth: 260 }} />
                <div style={S.caption}>
                  {avg === null ? t('settings.quotaNoData') : t('settings.quotaCompare', { avg })}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title={t('settings.typesTitle')} subtitle={t('settings.typesSub')} icon="package-open" padding="14px 16px"
        actions={canEdit && (
          <Button variant="secondary" size="sm" icon="plus"
            onClick={() => a.addShuttleType()}>{t('settings.addType')}</Button>
        )}>
        {db.shuttleTypes.length === 0
          ? <Empty icon="package-open" title={t('settings.noType')} hint={t('settings.noTypeHint')} />
          : <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...S.typeGrid, ...S.headRow }}>
                <span>{t('settings.colType')}</span>
                <span>{t('settings.colPerTube')}</span>
                <span>{t('settings.colRefPrice')}</span>
                <span>{t('settings.colActive')}</span>
              </div>
              {db.shuttleTypes.map((x) => (
                <div key={x.id} style={S.typeGrid}>
                  <Input value={x.name} disabled={!canEdit} onChange={(e) => a.setShuttleType(x.id, 'name', e.target.value)} />
                  <Input mono suffix={t('units.shuttle')} value={String(x.perTube)} disabled={!canEdit}
                    onChange={(e) => a.setShuttleType(x.id, 'perTube', e.target.value)} />
                  <Input mono suffix={t('units.dong')} value={String(x.pricePerTube || 0)} disabled={!canEdit}
                    onChange={(e) => a.setShuttleType(x.id, 'pricePerTube', e.target.value)} />
                  <Switch checked={x.active !== false} disabled={!canEdit}
                    onChange={() => a.setShuttleType(x.id, 'active', x.active === false)} />
                </div>
              ))}
              <div style={S.caption}>{t('settings.typesNote')}</div>
            </div>}
      </Card>
    </>
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
                      {g.name || 'Nhóm #' + (idx + 1)}
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
                          title: `Xoá nhóm "${g.name}"?`,
                          message: t('settings.groupDelMsg', { name: g.name }),
                          tone: 'danger',
                          confirmText: 'Xoá nhóm',
                          onConfirm: () => a.deleteGroup(g.id),
                        })
                      }}
                    >
                      Xoá nhóm
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
                      Quỹ: <strong style={{ color: 'var(--text-primary)' }}>{fmtK(g.feeNam)}đ</strong> (Nam) · <strong style={{ color: 'var(--text-primary)' }}>{fmtK(g.feeNu)}đ</strong> (Nữ)
                      {g.unitNam > 0 || g.unitNu > 0
                        ? ` · Back: ${fmtK(g.unitNam)}đ (Nam) / ${fmtK(g.unitNu)}đ (Nữ)`
                        : ` · Back: Theo giá vãng lai`}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>Định mức: {g.quota || 24} quả</span>
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
                {isChanged ? '● Có thay đổi chưa lưu trên tab Nhóm cố định' : 'Đã đồng bộ thông tin nhóm'}
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

function Access({ canEdit, pending }) {
  const { db, ui, a } = useApp()
  // `invite` cố ý không đọc nữa: mời qua SĐT đã gỡ khỏi client, chờ module riêng có gửi tin
  // thật. Cột `clubs.allow_invite` vẫn nằm dưới DB.
  const lm = { code: true, phone: true, ...db.club.linkModes }
  const digits = (x) => (x || '').replace(/\D/g, '')

  /**
   * Tài khoản đã gắn vào MỘT bản ghi nào đó của CLB này. Không được hiện lại ở ô ghép:
   * `linkMemberUser` tự bỏ ghép bản ghi cũ (một user chỉ gắn một bản ghi — `club_members`
   * có UNIQUE (club_id, user_id)), nên chọn nhầm là ÂM THẦM cướp tài khoản của người khác,
   * và toast chỉ báo ghép thành công chứ không nói ai vừa bị gỡ.
   */
  const takenUserIds = new Set(db.members.filter((m) => m.userId).map((m) => m.userId))
  const freeUsers = (db.users || []).filter((u) => !takenUserIds.has(u.id))

  /** Tài khoản có SĐT trùng và CHƯA gắn vào CLB này — chỉ gợi ý, không tự ghép. */
  const suggestFor = (m) => {
    if (!lm.phone || m.userId || !digits(m.phone)) return null
    return freeUsers.find((u) => digits(u.phone) === digits(m.phone)) || null
  }
  const unlinked = db.members.filter((m) => !m.userId && m.active !== false)
  const linkedCount = db.members.filter((m) => m.userId).length

  return (
    <>
      <Card title={t('settings.joinTitle')} subtitle={t('settings.joinSub')} icon="user-round-plus" padding="14px">
        {pending.length === 0
          ? <Empty icon="circle-check" title={t('settings.joinEmpty')}
              hint={t('settings.joinEmptyHint', { code: db.club.code })} />
          : <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((r) => {
                const u = db.users.find((x) => x.id === r.userId) || {}
                // Bản ghi tay trùng SĐT — chọn sẵn để bấm nhầm "Tạo thành viên mới" không còn
                // là lối dễ đi nhất. Tạo mới ở đây là sinh ra người thứ hai cùng một con
                // người: hai dòng cùng chạy song song, và GỘP LẠI thì app chưa làm được.
                const dup = unlinked.find((m) => digits(m.phone) && digits(m.phone) === digits(u.phone))
                const pick = ui.form['join_' + r.id] ?? (dup ? dup.id : '')
                return (
                  <div key={r.id} style={{ display: 'grid', gap: 9, padding: '11px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
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
                            onChange={(e) => a.setF('join_' + r.id, e.target.value)} />
                          {/* Chưa chọn ai mà bấm Ghép thì RPC nhận p_member_id = null và tạo
                              người mới — nút nói một đằng làm một nẻo. Khoá lại. */}
                          <Button variant="primary" size="sm" icon="link" disabled={!pick}
                            onClick={() => a.approveJoin(r.id, pick)}>{t('settings.joinLink')}</Button>
                          <Button variant="ghost" size="sm" icon="user-round-plus"
                            onClick={() => a.approveJoin(r.id, null)}>{t('settings.joinCreate')}</Button>
                          <Button variant="ghost" size="sm" icon="circle-x"
                            onClick={() => a.rejectJoin(r.id)}>{t('settings.joinReject')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
                  <span style={S.label}>{m.name}</span>
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
                        title: `Bỏ ghép tài khoản của "${m.name}"?`,
                        message: `Hủy liên kết giữa tài khoản "${user.nick || user.name}" và thành viên "${m.name}"?`,
                        tone: 'warning',
                        confirmText: 'Bỏ ghép',
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
                          freeUsers.map((u) => ({
                            value: u.id,
                            label: (u.name || u.phone || u.id) + (u.phone ? ` · ${u.phone}` : ''),
                          }))
                        )}
                        onChange={(e) => a.setF('link_u_' + m.id, e.target.value)}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon="link"
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
  courtGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 70px', gap: 10, alignItems: 'center' },
  groupBox: { display: 'grid', gap: 8, padding: '11px 13px', borderRadius: 8, background: 'var(--surface-inset)' },
  groupRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 },
  pick: {
    padding: '7px 12px', borderRadius: 99, border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)', color: 'var(--text-primary)',
    font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
  },
  pickOn: { borderColor: 'var(--teal-500)', background: 'var(--surface-accent-soft)' },
  typeGrid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 70px', gap: 10, alignItems: 'center' },
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
