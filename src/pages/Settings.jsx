// Cài đặt: Chung · Biểu phí · Sân & Cầu · Nhóm & mức thu · Lịch tập cố định · Tài khoản & quyền
// Handoff 2c: "Giữ tab, siết ngữ pháp" — 6 tab, ngữ pháp hàng dữ liệu 170px, thanh lưu nổi batch ở đáy.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { can } from '#lib/roles.js'
import { intOf, monthSessions } from '#lib/money.js'
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
  const activeTab = ui.tab.settings || 'general'
  const canEdit = can(db.viewAs || 'owner', 'settings')
  const pending = db.joinRequests || []

  // ----------------- Baseline & Draft State Management -----------------
  const defGroup = useMemo(() => db.groups?.[0] || {}, [db.groups])

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
  const [groupsDraft, setGroupsDraft] = useState(db.groups || [])

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // ----------------- Tính toán danh sách thay đổi (Dirty Tracker) -----------------
  const dirtyGeneral = useMemo(() => {
    const list = []
    if (generalDraft.name !== (db.club?.name || '')) list.push(t('settings.fieldClubName'))
    if (generalDraft.avatarUrl !== (db.club?.avatarUrl || '')) list.push(t('settings.fieldAvatar'))
    if (String(generalDraft.lockDay) !== String(db.club?.lockDay || cfg.club.defaultLockDay)) list.push(t('settings.fieldLockDay'))
    if (generalDraft.seeDebtEachOther !== Boolean(db.club?.seeDebtEachOther)) list.push(t('settings.fieldSeeDebt'))
    if (generalDraft.seeFund !== Boolean(db.club?.seeFund)) list.push(t('settings.fieldSeeFund'))
    if (generalDraft.roundUnit !== Boolean(db.club?.roundUnit)) list.push(t('settings.fieldRoundUnit'))
    if (generalDraft.debtBanner !== (db.club?.debtBanner || 'slim')) list.push(t('settings.fieldDebtBanner'))
    if (JSON.stringify(generalDraft.bank) !== JSON.stringify(db.club?.bank || {})) list.push(t('settings.fieldBank'))
    if (JSON.stringify(generalDraft.levels) !== JSON.stringify(db.levels || [])) list.push(t('settings.fieldLevels'))
    return list
  }, [generalDraft, db.club, db.levels])

  const dirtyMoney = useMemo(() => {
    const list = []
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
    return list
  }, [moneyDraft, defGroup, db.guestPrices])

  const dirtyCourts = useMemo(() => {
    if (JSON.stringify(courtsDraft) !== JSON.stringify(db.courts || [])) return [t('settings.fieldCourts')]
    return []
  }, [courtsDraft, db.courts])

  const dirtyGroups = useMemo(() => {
    if (JSON.stringify(groupsDraft) !== JSON.stringify(db.groups || [])) return [t('settings.fieldGroups')]
    return []
  }, [groupsDraft, db.groups])

  const dirtyFields = useMemo(() => {
    if (!canEdit) return []
    return [...dirtyGeneral, ...dirtyMoney, ...dirtyCourts, ...dirtyGroups]
  }, [canEdit, dirtyGeneral, dirtyMoney, dirtyCourts, dirtyGroups])

  // Tránh xoá trắng draft khi db đổi reference (Item 2)
  const prevClubIdRef = useRef(db.club?.id)

  const syncCleanDrafts = useCallback(() => {
    // Chỉ reset draft nếu tab đó KHÔNG dirty
    if (dirtyGeneral.length === 0) {
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
    }

    if (dirtyMoney.length === 0) {
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
    }

    if (dirtyCourts.length === 0) setCourtsDraft(db.courts || [])
    if (dirtyGroups.length === 0) setGroupsDraft(db.groups || [])
  }, [db, dirtyGeneral.length, dirtyMoney.length, dirtyCourts.length, dirtyGroups.length])

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

    const dg = db.groups?.[0] || {}
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
    setGroupsDraft(db.groups || [])
    setSaveError(null)
  }, [db])

  useEffect(() => {
    if (db.club?.id !== prevClubIdRef.current) {
      prevClubIdRef.current = db.club?.id
      // Đổi hẳn CLB: reset toàn bộ draft
      handleRevert()
      return
    }
    syncCleanDrafts()
  }, [db.club?.id, syncCleanDrafts, handleRevert])

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

  const handleSaveAll = async () => {
    if (!canEdit || dirtyFields.length === 0) return
    setIsSaving(true)
    setSaveError(null)

    // Validate trước khi lưu
    for (const g of groupsDraft) {
      if (g.from && g.to && g.from >= g.to) {
        setSaveError(t('settings.errGroupTime'))
        setIsSaving(false)
        return
      }
      const isDup = groupsDraft.some(
        (x) => x.id !== g.id && (x.name || '').trim().toLowerCase() === (g.name || '').trim().toLowerCase()
      )
      if (isDup) {
        setSaveError(t('settings.errGroupDupName'))
        setIsSaving(false)
        return
      }
    }

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
      const isFeeChanged = dirtyMoney.includes(t('settings.fieldMonthlyFee'))
      const isRefundChanged = dirtyMoney.includes(t('settings.fieldRefund'))
      const isGuestPricesChanged = dirtyMoney.includes(t('settings.fieldGuestPrices'))

      const newClubFeeNam = moneyDraft.hasMonthlyFee ? intOf(moneyDraft.feeNam) : 0
      const newClubFeeNu = moneyDraft.hasMonthlyFee ? intOf(moneyDraft.feeNu) : 0
      const newClubUnitNam = moneyDraft.hasRefund ? (moneyDraft.customRefundUnit ? intOf(moneyDraft.unitNam) : 0) : -1
      const newClubUnitNu = moneyDraft.hasRefund ? (moneyDraft.customRefundUnit ? intOf(moneyDraft.unitNu) : 0) : -1

      if (isFeeChanged || isRefundChanged || isGuestPricesChanged) {
        a.saveMoneyTab({
          feeNam: newClubFeeNam,
          feeNu: newClubFeeNu,
          hasRefund: moneyDraft.hasRefund,
          unitNam: newClubUnitNam,
          unitNu: newClubUnitNu,
          guestPrices: moneyDraft.guestPrices,
        })
      }

      // 3. Lưu Courts
      if (dirtyCourts.length > 0) {
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

      // 4. Lưu Groups (Đồng bộ mức phí CLB cho các nhóm không có mức riêng để tránh bị nuốt)
      if (dirtyGroups.length > 0 || isFeeChanged || isRefundChanged) {
        const syncedGroups = groupsDraft.map((g, idx) => {
          const isCustom =
            idx !== 0 &&
            (intOf(g.feeNam) !== intOf(defGroup.feeNam) ||
              intOf(g.feeNu) !== intOf(defGroup.feeNu) ||
              intOf(g.unitNam) !== intOf(defGroup.unitNam) ||
              intOf(g.unitNu) !== intOf(defGroup.unitNu))

          if (isCustom) return g
          return {
            ...g,
            feeNam: newClubFeeNam,
            feeNu: newClubFeeNu,
            unitNam: newClubUnitNam,
            unitNu: newClubUnitNu,
          }
        })
        a.saveGroupsTab(syncedGroups)
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
    // Đồng bộ bậc mới vào guestPrices (Item 9)
    if (key === 'levels' && Array.isArray(val)) {
      setMoneyDraft((prev) => {
        const currentPrices = prev.guestPrices || []
        const updatedPrices = val.map((lv) => {
          const existing = currentPrices.find((p) => p.level === lv)
          return existing || { level: lv, nam: 0, nu: 0 }
        })
        return { ...prev, guestPrices: updatedPrices }
      })
    }
  }

  const handleMoneyChange = (key, val) => {
    setMoneyDraft((prev) => ({ ...prev, [key]: val }))
  }

  const handleCourtChange = (id, field, val) => {
    setCourtsDraft((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === 'price' ? intOf(val) : val } : c))
    )
  }

  const handleGroupFieldChange = (groupId, field, val) => {
    if (typeof field === 'object') {
      setGroupsDraft((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...field } : g)))
    } else {
      setGroupsDraft((prev) => prev.map((g) => (g.id === groupId ? { ...g, [field]: val } : g)))
    }
  }

  // Ngưỡng cảnh báo "tiền hoàn 1 buổi > quỹ tháng / số buổi": đếm buổi THẬT của tháng đang xem,
  // không suy từ số lịch — một lịch `weekdays:[T3,T6]` là 8 buổi/tháng chứ không phải 1.
  // Chưa có buổi nào thì để 1: ngưỡng bằng cả quỹ tháng, không cảnh báo nhầm khi CLB còn trống.
  const sessionsPerMonth = useMemo(
    () => Math.max(1, monthSessions(db, db.month).filter((s) => s.groupId === defGroup.id).length),
    [db, defGroup.id]
  )

  // Quét toàn diện usedLevels theo appActions:1614-1624 (Item 8)
  const usedLevels = useMemo(() => {
    const set = new Set()
    ;(db.members || []).forEach((m) => {
      if (m.level) set.add(m.level)
      if (m.pendingLevel) set.add(m.pendingLevel)
      ;(m.levelHistory || []).forEach((h) => {
        if (h.level) set.add(h.level)
      })
    })
    ;(db.guests || []).forEach((g) => {
      if (g.level) set.add(g.level)
    })
    ;(db.sessionGuests || []).forEach((sg) => {
      if (sg.level) set.add(sg.level)
    })
    return Array.from(set)
  }, [db.members, db.guests, db.sessionGuests])

  // Hỗ trợ điều hướng bằng phím mũi tên trên thanh tab (Item 15)
  const handleTabKeyDown = (e, currentKey) => {
    const idx = TABS.indexOf(currentKey)
    if (idx < 0) return
    let nextIdx = -1
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = TABS.length - 1

    if (nextIdx >= 0) {
      e.preventDefault()
      const nextKey = TABS[nextIdx]
      a.setTab('settings', nextKey)
      const el = document.getElementById(`tab-${nextKey}`)
      if (el) el.focus()
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <style>{`
        @keyframes slideUpSaveBar {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Handoff §3.7: hover là của cả HÀNG, và phải SÁNG LÊN. Ở theme sáng --surface-inset
           (#FAFBFD) đúng sắc đó; ở theme tối nó TỐI HƠN card nên phải đổi sang --surface-raised. */
        .settings-table-row:hover { background: var(--surface-inset); }
        [data-theme="dark"] .settings-table-row:hover,
        .theme-dark .settings-table-row:hover { background: var(--surface-raised); }

        /* Ô sửa-tại-chỗ dùng viền chứ không dùng nền, để không đá nhau với hover của hàng. */
        .hover-cell:hover { box-shadow: inset 0 0 0 1px var(--border-default); }

        /* ---------- 834–1279px: một cột, nhãn 150px, bảng cuộn ngang giữ cột đầu ---------- */
        @media (min-width: 834px) and (max-width: 1279px) {
          .settings-form-label { width: 150px !important; }

          /* Cột đầu dính lại khi cuộn ngang. Nền phải đục, nếu không chữ cột 2 chạy xuyên qua. */
          .settings-table-head > *:first-child,
          .settings-table-row > *:first-child {
            position: sticky;
            left: 0;
            z-index: 1;
            background: inherit;
          }
          .settings-table-row { background: var(--surface-card); }

          /* §8: thanh lưu 64px và bỏ danh sách tên field, chỉ còn con số. */
          .settings-save-bar { height: 64px !important; }
          .settings-save-names { display: none !important; }
        }

        @media (max-width: 1279px) {
          .settings-general-grid { grid-template-columns: 1fr !important; }
        }

        /* ---------- < 834px: nhãn lên trên, chạm 44px, mỗi dòng bảng là một thẻ dọc ---------- */
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

          /* Hit target tối thiểu 44px (§8). DS Input render <input> trần nên set thẳng lên nó. */
          .settings-card input:not([type="checkbox"]):not([type="radio"]),
          .settings-card select {
            min-height: 44px !important;
          }
          .settings-stepper { height: 44px !important; }
          .settings-stepper__btn { width: 44px !important; height: 44px !important; }
          .settings-stepper__input { min-height: auto !important; }
          .settings-toggle { width: 44px !important; height: 26px !important; }
          .settings-toggle__thumb { width: 22px !important; height: 22px !important; }
          .settings-toggle--on .settings-toggle__thumb { left: 20px !important; }

          /* Tab thành chip cuộn ngang. */
          .settings-tab {
            padding: 8px 14px !important;
            border-radius: 999px !important;
            border-bottom: none !important;
            background: var(--surface-inset) !important;
          }
          .settings-tab[aria-selected="true"] {
            background: var(--surface-accent-soft) !important;
            color: var(--text-accent) !important;
          }
          .settings-tabs { gap: 8px !important; }

          /* Vệt mờ báo "còn cuộn được nữa". Chỉ bật ở đây vì <834px là chỗ 6 tab chắc chắn tràn. */
          .settings-tabs-wrap { position: relative; }
          .settings-tabs-wrap::after {
            content: '›';
            position: absolute;
            top: 0;
            right: 0;
            bottom: 2px;
            width: 32px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 4px;
            font-size: 15px;
            color: var(--text-muted);
            pointer-events: none;
            background: linear-gradient(to right, transparent, var(--surface-card) 60%);
          }

          /* Mỗi dòng bảng thành một thẻ dọc nhãn–giá trị; nhãn lấy từ data-label của ô. */
          .settings-table-scroll { overflow-x: visible !important; }
          .settings-table-head { display: none !important; }
          .settings-table-row {
            grid-template-columns: 1fr !important;
            gap: 10px;
            border: 1px solid var(--border-subtle) !important;
            border-radius: 10px;
            padding: 12px 14px !important;
            margin-bottom: 10px;
          }
          .settings-table-row > * {
            display: flex !important;
            align-items: center;
            justify-content: space-between !important;
            gap: 12px;
            text-align: left !important;
            min-width: 0;
          }
          .settings-table-row > *[data-label]:not([data-label=""])::before {
            content: attr(data-label);
            flex: none;
            font: 700 11px/1.4 var(--font-sans);
            letter-spacing: .07em;
            color: var(--text-muted);
          }

          /* §8: thanh lưu hai hàng, nút cao 46px, Lưu chiếm phần còn lại. */
          .settings-save-bar {
            height: auto !important;
            padding: 12px 16px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .settings-save-names { display: none !important; }
          .settings-save-actions { justify-content: stretch !important; }
          .settings-save-revert { flex: none; height: 46px !important; }
          .settings-save-submit { flex: 1; height: 46px !important; }
        }
      `}</style>

      {/* Dải tab của trang. Tiêu đề + Nhập/Xuất cài đặt nằm ở AppHeader (xem chú thích dưới). */}
      <div
        style={{
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 28px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 20,
          margin: '-20px -22px 20px -22px',
        }}
      >
        {/* Hàng 1 của handoff §1 ("tiêu đề + Nhập/Xuất") nằm hẳn ở AppHeader: tiêu đề lấy từ
            `pages.settings.title/desc`, hai nút Nhập/Xuất đặt cạnh nút đổi theme.
            Hàng 2 — 6 tab — là tất cả những gì còn lại ở đây. Bọc thêm một lớp để đặt vệt mờ báo
            còn cuộn được ở màn hẹp (§8): pseudo-element không gắn được lên chính tablist. */}
        <div className="settings-tabs-wrap">
        <div
          role="tablist"
          aria-label={t('settings.appTitle')}
          className="settings-tabs"
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
                id={`tab-${k}`}
                type="button"
                className="settings-tab"
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`tabpanel-${k}`}
                onClick={() => a.setTab('settings', k)}
                onKeyDown={(e) => handleTabKeyDown(e, k)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 0 11px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--action-accent-bg)' : '2px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                  outlineColor: 'var(--border-focus-color)',
                }}
              >
                <span>{t('settings.tab' + k[0].toUpperCase() + k.slice(1))}</span>
                {isAccess && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 6,
                      background: count > 0 ? 'var(--action-accent-bg)' : 'var(--surface-page)',
                      color: count > 0 ? 'var(--action-accent-fg)' : 'var(--text-muted)',
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
      </div>

      {/* VÙNG NỘI DUNG 6 TAB */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        style={{ paddingBottom: dirtyFields.length > 0 ? 80 : 20 }}
      >
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
            defGroup={defGroup}
            sessionsPerMonth={sessionsPerMonth}
          />
        )}

        {activeTab === 'courts' && (
          <CourtsTab
            courts={courtsDraft}
            canEdit={canEdit}
            onCourtChange={handleCourtChange}
            onOpenDialog={(name, param) => a.openDialog(name, param)}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsTab
            groups={groupsDraft}
            courts={courtsDraft}
            db={db}
            canEdit={canEdit}
            defGroup={defGroup}
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
            onDeleteSchedule={(id, name, futureCount) => {
              a.confirm({
                title: t('schedules.delConfirmTitle', { name }),
                message: t('schedules.delConfirmMsg', { n: futureCount }),
                tone: 'danger',
                confirmText: t('common.delete'),
                onConfirm: () => a.deleteSchedule(id),
              })
            }}
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
