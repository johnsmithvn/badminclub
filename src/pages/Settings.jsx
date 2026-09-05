// Cài đặt: Chung · Biểu phí · Sân & Cầu · Nhóm & mức thu · Lịch tập cố định · Tài khoản & quyền
// Handoff 2c: "Giữ tab, siết ngữ pháp" — 6 tab, ngữ pháp hàng dữ liệu 170px, thanh lưu nổi batch ở đáy.

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { can } from '#lib/roles.js'
import { intOf, levelOf } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

import { FloatingSaveBar } from '#components/settings/SettingsComponents.jsx'
import GeneralTab from '#components/settings/tabs/GeneralTab.jsx'
import MoneyTab from '#components/settings/tabs/MoneyTab.jsx'
import CourtsTab from '#components/settings/tabs/CourtsTab.jsx'
import GroupsTab from '#components/settings/tabs/GroupsTab.jsx'
import SchedulesTab from '#components/settings/tabs/SchedulesTab.jsx'
import AccessTab from '#components/settings/tabs/AccessTab.jsx'

const TABS = ['general', 'money', 'courts', 'groups', 'schedules', 'access']

/** Khớp CHECK `clubs_debt_banner_chk` ở migration 0019. Thêm kiểu mới phải sửa cả hai. */
const DEBT_BANNERS = ['slim', 'alert', 'bar', 'off']

export default function Settings() {
  const { db, ui, a } = useApp()
  const { activeClub } = useAuth()
  const tab = ui.tab.settings || 'general'
  const activeTab = tab === 'shuttles' ? 'courts' : tab
  const canEdit = can(db.viewAs || 'owner', 'settings')
  const pending = db.joinRequests || []

  // ----------------- Baseline & Draft State Management -----------------
  const defGroup = db.groups[0] || {}

  const [generalDraft, setGeneralDraft] = useState({
    name: db.club?.name || '',
    avatarUrl: db.club?.avatarUrl || '',
    code: db.club?.code || '',
    lockDay: db.club?.lockDay || cfg.club.defaultLockDay,
    seeDebtEachOther: Boolean(db.club?.seeDebtEachOther),
    seeFund: Boolean(db.club?.seeFund),
    roundUnit: Boolean(db.club?.roundUnit),
    debtBanner: db.club?.debtBanner || 'slim',
    bank: {
      holder: db.club?.bank?.holder || '',
      no: db.club?.bank?.no || '',
      bank: db.club?.bank?.bank || '',
    },
    levels: db.levels || cfg.levelsDefault,
  })

  const [moneyDraft, setMoneyDraft] = useState({
    hasMonthlyFee: Boolean(intOf(defGroup.feeNam) > 0 || intOf(defGroup.feeNu) > 0),
    feeNam: String(defGroup.feeNam || ''),
    feeNu: String(defGroup.feeNu || ''),
    hasRefund: defGroup.hasRefund !== false && defGroup.unitNam !== -1,
    customRefundUnit: Boolean(intOf(defGroup.unitNam) > 0 || intOf(defGroup.unitNu) > 0),
    unitNam: String(defGroup.unitNam > 0 ? defGroup.unitNam : ''),
    unitNu: String(defGroup.unitNu > 0 ? defGroup.unitNu : ''),
    guestPrices: db.guestPrices || [],
  })

  const [courtsDraft, setCourtsDraft] = useState(db.courts || [])
  const [shuttleTypesDraft, setShuttleTypesDraft] = useState(db.shuttleTypes || [])
  const [groupsDraft, setGroupsDraft] = useState(db.groups || [])

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Đồng bộ lại draft khi db thay đổi từ bên ngoài (nạp mới / đồng bộ)
  useEffect(() => {
    setGeneralDraft({
      name: db.club?.name || '',
      avatarUrl: db.club?.avatarUrl || '',
      code: db.club?.code || '',
      lockDay: db.club?.lockDay || cfg.club.defaultLockDay,
      seeDebtEachOther: Boolean(db.club?.seeDebtEachOther),
      seeFund: Boolean(db.club?.seeFund),
      roundUnit: Boolean(db.club?.roundUnit),
      debtBanner: db.club?.debtBanner || 'slim',
      bank: {
        holder: db.club?.bank?.holder || '',
        no: db.club?.bank?.no || '',
        bank: db.club?.bank?.bank || '',
      },
      levels: db.levels || cfg.levelsDefault,
    })

    const dg = db.groups[0] || {}
    setMoneyDraft({
      hasMonthlyFee: Boolean(intOf(dg.feeNam) > 0 || intOf(dg.feeNu) > 0),
      feeNam: String(dg.feeNam || ''),
      feeNu: String(dg.feeNu || ''),
      hasRefund: dg.hasRefund !== false && dg.unitNam !== -1,
      customRefundUnit: Boolean(intOf(dg.unitNam) > 0 || intOf(dg.unitNu) > 0),
      unitNam: String(dg.unitNam > 0 ? dg.unitNam : ''),
      unitNu: String(dg.unitNu > 0 ? dg.unitNu : ''),
      guestPrices: db.guestPrices || [],
    })

    setCourtsDraft(db.courts || [])
    setShuttleTypesDraft(db.shuttleTypes || [])
    setGroupsDraft(db.groups || [])
  }, [db])

  // ----------------- Tính toán danh sách thay đổi (Dirty Tracker) -----------------
  const dirtyFields = useMemo(() => {
    const list = []
    if (!canEdit) return list

    // General tab
    if (generalDraft.name !== (db.club?.name || '')) list.push(t('settings.fieldClubName'))
    if (generalDraft.avatarUrl !== (db.club?.avatarUrl || '')) list.push(t('settings.fieldAvatar'))
    if (String(generalDraft.lockDay) !== String(db.club?.lockDay || cfg.club.defaultLockDay)) list.push(t('settings.fieldLockDay'))
    if (generalDraft.seeDebtEachOther !== Boolean(db.club?.seeDebtEachOther)) list.push(t('settings.fieldSeeDebt'))
    if (generalDraft.seeFund !== Boolean(db.club?.seeFund)) list.push(t('settings.fieldSeeFund'))
    if (generalDraft.roundUnit !== Boolean(db.club?.roundUnit)) list.push(t('settings.fieldRoundUnit'))
    if (generalDraft.debtBanner !== (db.club?.debtBanner || 'slim')) list.push(t('settings.fieldDebtBanner'))
    if (JSON.stringify(generalDraft.bank) !== JSON.stringify(db.club?.bank || {})) list.push(t('settings.fieldBank'))
    if (JSON.stringify(generalDraft.levels) !== JSON.stringify(db.levels || [])) list.push(t('settings.fieldLevels'))

    // Money tab
    const curHasMonthlyFee = Boolean(intOf(defGroup.feeNam) > 0 || intOf(defGroup.feeNu) > 0)
    const curHasRefund = defGroup.hasRefund !== false && defGroup.unitNam !== -1
    const curCustomRefundUnit = Boolean(intOf(defGroup.unitNam) > 0 || intOf(defGroup.unitNu) > 0)

    const isFeeChanged =
      moneyDraft.hasMonthlyFee !== curHasMonthlyFee ||
      (moneyDraft.hasMonthlyFee &&
        (moneyDraft.feeNam !== String(defGroup.feeNam || '') || moneyDraft.feeNu !== String(defGroup.feeNu || '')))

    const isRefundChanged =
      moneyDraft.hasRefund !== curHasRefund ||
      (moneyDraft.hasRefund &&
        (moneyDraft.customRefundUnit !== curCustomRefundUnit ||
          (moneyDraft.customRefundUnit &&
            (moneyDraft.unitNam !== String(defGroup.unitNam > 0 ? defGroup.unitNam : '') ||
              moneyDraft.unitNu !== String(defGroup.unitNu > 0 ? defGroup.unitNu : '')))))

    if (isFeeChanged) list.push(t('settings.fieldMonthlyFee'))
    if (isRefundChanged) list.push(t('settings.fieldRefund'))
    if (JSON.stringify(moneyDraft.guestPrices) !== JSON.stringify(db.guestPrices || [])) list.push(t('settings.fieldGuestPrices'))

    // Courts & Shuttles tab
    if (JSON.stringify(courtsDraft) !== JSON.stringify(db.courts || [])) list.push(t('settings.fieldCourts'))
    if (JSON.stringify(shuttleTypesDraft) !== JSON.stringify(db.shuttleTypes || [])) list.push(t('settings.fieldShuttles'))

    // Groups tab (quota và các field nhóm)
    if (JSON.stringify(groupsDraft) !== JSON.stringify(db.groups || [])) list.push(t('settings.fieldGroups'))

    return list
  }, [
    canEdit, generalDraft, db.club, db.levels, defGroup.feeNam, defGroup.feeNu, defGroup.hasRefund,
    defGroup.unitNam, defGroup.unitNu, moneyDraft, db.guestPrices, courtsDraft, db.courts,
    shuttleTypesDraft, db.shuttleTypes, groupsDraft, db.groups,
  ])

  // Cảnh báo người dùng nếu rời trang khi còn thay đổi chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyFields.length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirtyFields.length])

  // ----------------- Xử lý Hoàn tác & Lưu thay đổi -----------------
  const handleRevert = useCallback(() => {
    setGeneralDraft({
      name: db.club?.name || '',
      avatarUrl: db.club?.avatarUrl || '',
      code: db.club?.code || '',
      lockDay: db.club?.lockDay || cfg.club.defaultLockDay,
      seeDebtEachOther: Boolean(db.club?.seeDebtEachOther),
      seeFund: Boolean(db.club?.seeFund),
      roundUnit: Boolean(db.club?.roundUnit),
      debtBanner: db.club?.debtBanner || 'slim',
      bank: {
        holder: db.club?.bank?.holder || '',
        no: db.club?.bank?.no || '',
        bank: db.club?.bank?.bank || '',
      },
      levels: db.levels || cfg.levelsDefault,
    })

    const dg = db.groups[0] || {}
    setMoneyDraft({
      hasMonthlyFee: Boolean(intOf(dg.feeNam) > 0 || intOf(dg.feeNu) > 0),
      feeNam: String(dg.feeNam || ''),
      feeNu: String(dg.feeNu || ''),
      hasRefund: dg.hasRefund !== false && dg.unitNam !== -1,
      customRefundUnit: Boolean(intOf(dg.unitNam) > 0 || intOf(dg.unitNu) > 0),
      unitNam: String(dg.unitNam > 0 ? dg.unitNam : ''),
      unitNu: String(dg.unitNu > 0 ? dg.unitNu : ''),
      guestPrices: db.guestPrices || [],
    })

    setCourtsDraft(db.courts || [])
    setShuttleTypesDraft(db.shuttleTypes || [])
    setGroupsDraft(db.groups || [])
    setSaveError(null)
  }, [db])

  const handleSaveAll = async () => {
    if (!canEdit || dirtyFields.length === 0) return
    setIsSaving(true)
    setSaveError(null)
    try {
      // 1. Lưu General Tab
      if (generalDraft.name !== (db.club?.name || '')) a.setClub('name', generalDraft.name)
      if (generalDraft.avatarUrl !== (db.club?.avatarUrl || '')) a.setClub('avatarUrl', generalDraft.avatarUrl)
      if (String(generalDraft.lockDay) !== String(db.club?.lockDay || cfg.club.defaultLockDay)) {
        a.setLockDay(generalDraft.lockDay)
      }
      if (generalDraft.seeDebtEachOther !== Boolean(db.club?.seeDebtEachOther)) {
        a.setClub('seeDebtEachOther', generalDraft.seeDebtEachOther)
      }
      if (generalDraft.seeFund !== Boolean(db.club?.seeFund)) {
        a.setClub('seeFund', generalDraft.seeFund)
      }
      if (generalDraft.roundUnit !== Boolean(db.club?.roundUnit)) {
        a.setClub('roundUnit', generalDraft.roundUnit)
      }
      if (generalDraft.debtBanner !== (db.club?.debtBanner || 'slim')) {
        a.setClub('debtBanner', generalDraft.debtBanner)
      }
      if (JSON.stringify(generalDraft.bank) !== JSON.stringify(db.club?.bank || {})) {
        a.setClub('bank', generalDraft.bank)
      }
      if (JSON.stringify(generalDraft.levels) !== JSON.stringify(db.levels || [])) {
        a.setLevels(generalDraft.levels.join(', '))
      }

      // 2. Lưu Money Tab
      const curHasMonthlyFee = Boolean(intOf(defGroup.feeNam) > 0 || intOf(defGroup.feeNu) > 0)
      const curHasRefund = defGroup.hasRefund !== false && defGroup.unitNam !== -1
      const curCustomRefundUnit = Boolean(intOf(defGroup.unitNam) > 0 || intOf(defGroup.unitNu) > 0)

      const isFeeChanged =
        moneyDraft.hasMonthlyFee !== curHasMonthlyFee ||
        (moneyDraft.hasMonthlyFee &&
          (moneyDraft.feeNam !== String(defGroup.feeNam || '') || moneyDraft.feeNu !== String(defGroup.feeNu || '')))

      const isRefundChanged =
        moneyDraft.hasRefund !== curHasRefund ||
        (moneyDraft.hasRefund &&
          (moneyDraft.customRefundUnit !== curCustomRefundUnit ||
            (moneyDraft.customRefundUnit &&
              (moneyDraft.unitNam !== String(defGroup.unitNam > 0 ? defGroup.unitNam : '') ||
                moneyDraft.unitNu !== String(defGroup.unitNu > 0 ? defGroup.unitNu : '')))))

      const isGuestPricesChanged = JSON.stringify(moneyDraft.guestPrices) !== JSON.stringify(db.guestPrices || [])

      if (isFeeChanged || isRefundChanged || isGuestPricesChanged) {
        a.saveMoneyTab({
          feeNam: moneyDraft.hasMonthlyFee ? moneyDraft.feeNam : 0,
          feeNu: moneyDraft.hasMonthlyFee ? moneyDraft.feeNu : 0,
          hasRefund: moneyDraft.hasRefund,
          unitNam: moneyDraft.hasRefund ? (moneyDraft.customRefundUnit ? moneyDraft.unitNam : 0) : -1,
          unitNu: moneyDraft.hasRefund ? (moneyDraft.customRefundUnit ? moneyDraft.unitNu : 0) : -1,
          guestPrices: moneyDraft.guestPrices,
        })
      }

      // 3. Lưu Courts
      if (JSON.stringify(courtsDraft) !== JSON.stringify(db.courts || [])) {
        courtsDraft.forEach((c) => {
          const orig = (db.courts || []).find((x) => x.id === c.id)
          if (!orig || JSON.stringify(c) !== JSON.stringify(orig)) {
            a.setCourtField(c.id, 'name', c.name)
            a.setCourtField(c.id, 'addr', c.addr)
            a.setCourtField(c.id, 'mapUrl', c.mapUrl)
            a.setCourtField(c.id, 'price', c.price)
            a.setCourtField(c.id, 'active', c.active)
          }
        })
      }

      // 4. Lưu Shuttle Types
      if (JSON.stringify(shuttleTypesDraft) !== JSON.stringify(db.shuttleTypes || [])) {
        shuttleTypesDraft.forEach((st) => {
          const orig = (db.shuttleTypes || []).find((x) => x.id === st.id)
          if (!orig || JSON.stringify(st) !== JSON.stringify(orig)) {
            a.setShuttleType(st.id, 'name', st.name)
            a.setShuttleType(st.id, 'perTube', st.perTube)
            a.setShuttleType(st.id, 'pricePerTube', st.pricePerTube)
            a.setShuttleType(st.id, 'active', st.active)
          }
        })
      }

      // 5. Lưu Groups
      if (JSON.stringify(groupsDraft) !== JSON.stringify(db.groups || [])) {
        a.saveGroupsTab(groupsDraft)
      }

      setIsSaved(true)
      setTimeout(() => {
        setIsSaved(false)
      }, 2000)
    } catch (err) {
      setSaveError(err.message || t('settings.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  // ----------------- Callbacks cho các tab con -----------------
  const handleGeneralChange = (key, val) => {
    setGeneralDraft((prev) => ({ ...prev, [key]: val }))
  }

  const handleMoneyChange = (key, val) => {
    setMoneyDraft((prev) => ({ ...prev, [key]: val }))
  }

  const handleCourtChange = (id, field, val) => {
    setCourtsDraft((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === 'price' ? intOf(val) : val } : c))
    )
  }

  const handleShuttleTypeChange = (id, field, val) => {
    setShuttleTypesDraft((prev) =>
      prev.map((st) =>
        st.id === id
          ? {
              ...st,
              [field]: field === 'perTube' ? Number(val) || 12 : field === 'pricePerTube' ? intOf(val) : val,
            }
          : st
      )
    )
  }

  const handleGroupQuotaChange = (groupId, quota) => {
    setGroupsDraft((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, quota: intOf(quota) } : g))
    )
  }

  const handleGroupFieldChange = (groupId, field, val) => {
    setGroupsDraft((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, [field]: val } : g))
    )
  }

  const usedLevels = useMemo(() => {
    return Array.from(new Set((db.members || []).map((m) => levelOf(m, db.month)).filter(Boolean)))
  }, [db.members, db.month])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <style>{`
        @keyframes slideUpSaveBar {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .hover-cell:hover {
          background: #fbfcfe;
        }
        @media (max-width: 833px) {
          .settings-form-row:not(.settings-form-row--toggle) {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .settings-form-label {
            width: 100% !important;
            padding-top: 0 !important;
          }
          .settings-save-bar {
            height: auto !important;
            padding: 12px 16px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
        }
      `}</style>

      {/* HEADER 96px: Hàng 1 tiêu đề + Nhập/Xuất · Hàng 2: 6 tab */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e7ebf2',
          padding: '14px 28px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 20,
          margin: '-20px -22px 20px -22px',
        }}
      >
        {/* Hàng 1: Tiêu đề trang + Xuất/Nhập cài đặt */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: '#10203c', letterSpacing: '-0.01em', margin: 0 }}>
              {t('settings.appTitle')}
            </h1>
            <span style={{ fontSize: 13, color: '#8b98ab' }}>
              {t('settings.appDesc')}
            </span>
          </div>

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

        {/* Hàng 2: 6 Tab điều hướng duy nhất */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {TABS.map((k) => {
            const isActive = activeTab === k
            const isAccess = k === 'access'
            const count = isAccess ? pending.length : 0

            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => a.setTab('settings', k)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 0 11px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #0d8b8a' : '2px solid transparent',
                  color: isActive ? '#10203c' : '#6b7a90',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                  outline: 'none',
                }}
              >
                <span>{t('settings.tab' + k[0].toUpperCase() + k.slice(1))}</span>
                {isAccess && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 6,
                      background: count > 0 ? '#0d8b8a' : '#eef1f6',
                      color: count > 0 ? '#fff' : '#8b98ab',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* VÙNG NỘI DUNG 6 TAB */}
      <div style={{ paddingBottom: dirtyFields.length > 0 ? 80 : 20 }}>
        {activeTab === 'general' && (
          <GeneralTab
            data={generalDraft}
            onChange={handleGeneralChange}
            canEdit={canEdit}
            usedLevels={usedLevels}
            activeClub={activeClub}
            onClubDeleted={() => {
              a.toast(t('toast.clubDeleted', { name: db.club?.name }))
            }}
          />
        )}

        {activeTab === 'money' && (
          <MoneyTab
            data={moneyDraft}
            onChange={handleMoneyChange}
            canEdit={canEdit}
            levels={generalDraft.levels || db.levels || []}
            noGroup={db.groups.length === 0}
          />
        )}

        {activeTab === 'courts' && (
          <CourtsTab
            courts={courtsDraft}
            shuttleTypes={shuttleTypesDraft}
            groups={groupsDraft}
            sessions={db.sessions || []}
            canEdit={canEdit}
            onCourtChange={handleCourtChange}
            onShuttleTypeChange={handleShuttleTypeChange}
            onGroupQuotaChange={handleGroupQuotaChange}
            onOpenDialog={(name, param) => a.openDialog(name, param)}
            onDeleteCourt={(id, name) => {
              a.confirm({
                title: t('settings.courtDelTitle', { name }),
                message: t('settings.courtDelMsg', { name }),
                tone: 'danger',
                confirmText: t('common.delete'),
                onConfirm: () => a.deleteCourt(id),
              })
            }}
            onDeleteShuttleType={(id, name) => {
              a.confirm({
                title: t('settings.typeDelTitle', { name }),
                message: t('settings.typeDelMsg'),
                tone: 'danger',
                confirmText: t('settings.typeDelOk'),
                onConfirm: () => a.deleteShuttleType(id),
              })
            }}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsTab
            groups={groupsDraft}
            courts={courtsDraft}
            db={db}
            canEdit={canEdit}
            onGroupFieldChange={handleGroupFieldChange}
            onOpenDialog={(name, param) => a.openDialog(name, param)}
            onDeleteGroup={(id, name) => {
              a.confirm({
                title: t('settings.groupDelTitle', { name }),
                message: t('settings.groupDelMsg', { name }),
                tone: 'danger',
                confirmText: t('settings.groupDel'),
                onConfirm: () => a.deleteGroup(id),
              })
            }}
          />
        )}

        {activeTab === 'schedules' && (
          <SchedulesTab
            db={db}
            canEdit={canEdit}
            onOpenDialog={(name, param) => a.openDialog(name, param)}
            onToggleSchedule={(id) => a.toggleSchedule(id)}
            onDeleteSchedule={(id) => a.deleteSchedule(id)}
          />
        )}

        {activeTab === 'access' && (
          <AccessTab
            db={db}
            ui={ui}
            a={a}
            canEdit={canEdit}
            pending={pending}
            onLinkModeToggle={(mode) => a.toggleLinkMode(mode)}
            onMemberRoleChange={(memberId, role) => a.setMemberRole(memberId, role)}
          />
        )}
      </div>

      {/* THANH LƯU NỔI TẬP TRUNG (FLOATING SAVE BAR) */}
      <FloatingSaveBar
        dirtyCount={dirtyFields.length}
        fieldNames={dirtyFields}
        onSave={handleSaveAll}
        onRevert={handleRevert}
        isSaving={isSaving}
        isSaved={isSaved}
        saveError={saveError}
      />
    </div>
  )
}
