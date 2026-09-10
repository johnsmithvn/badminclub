// Sổ quỹ / Giao dịch — theo dõi chi tiết thu chi và dòng tiền CLB.
// Dữ liệu THẬT 100% từ ledger(db), không mock data, bảo toàn logic nghiệp vụ.

import { useMemo, useState, useEffect, useRef } from 'react'
import { Button, Icon, IconButton } from '#ds'
import { Empty, Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { dd, ddmy, monthOf, monthTxt, WD_FULL, weekdayOf, addMonth } from '#utils/dates.js'
import { fmt } from '#lib/money.js'
import {
  CATS, availableBalance, catLabel, editTarget, ledger,
  ledgerGrouped, monthFlow, undoTarget,
} from '#lib/ledger.js'
import { courtBillForm, editBillForm, editLedgerForm, ledgerForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

/** Bảng màu chuẩn cho từng danh mục giao dịch */
const CAT_COLORS = {
  [CATS.dues]: '#6C5CE7',
  [CATS.court]: '#0EA5A4',
  [CATS.guest]: '#3B82F6',
  [CATS.shuttle]: '#F59E0B',
  [CATS.courtSold]: '#10B981',
  [CATS.courtExtra]: '#06B6D4',
  [CATS.back]: '#EC4899',
  [CATS.extra]: '#8B5CF6',
  [CATS.withdraw]: '#EF4444',
  [CATS.opening]: '#64748B',
  [CATS.other]: '#A8A29E',
}

export default function Fund() {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const isMobile = useMobile(768)
  const canMoney = can(db.viewAs || 'owner', 'money')

  // Trạng thái bộ lọc
  const [quickDate, setQuickDate] = useState('all') // 'all' | 'today' | 'yesterday' | '7days'
  const [search, setSearch] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [dirFilter, setDirFilter] = useState('all') // 'all' | 'in' | 'out'
  const [catFilter, setCatFilter] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [expandedClusters, setExpandedClusters] = useState({})
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const filterRef = useRef(null)
  const timeRef = useRef(null)

  // Đóng filter popover khi click ra ngoài
  useEffect(() => {
    if (!filterOpen) return
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterOpen])

  // Đóng time popover khi click ra ngoài
  useEffect(() => {
    if (!timeOpen) return
    const handleClickOutside = (e) => {
      if (timeRef.current && !timeRef.current.contains(e.target)) {
        setTimeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [timeOpen])

  const quickTabs = useMemo(() => [
    { id: 'all', label: t('fund.tabAll') },
    { id: 'today', label: t('fund.tabToday') },
    { id: 'yesterday', label: t('fund.tabYesterday') },
    { id: '7days', label: t('fund.tab7Days') },
  ], [])

  // Số ngày trong tháng đang xem
  const [curYear, curMonthNum] = db.month.split('-').map(Number)
  const daysInMonth = new Date(curYear, curMonthNum, 0).getDate()

  // Dữ liệu thật từ sổ quỹ
  const allLedger = useMemo(() => ledger(db), [db])
  const monthLedger = useMemo(() => allLedger.filter((r) => monthOf(r.date) === db.month), [allLedger, db.month])
  const flow = useMemo(() => monthFlow(db, db.month), [db])
  const av = useMemo(() => availableBalance(db), [db])

  // Tính ngày hôm qua & 7 ngày trước từ db.today
  const { yesterdayStr, sevenDaysAgoStr } = useMemo(() => {
    const todayD = new Date(db.today + 'T00:00:00')
    const yestD = new Date(todayD)
    yestD.setDate(yestD.getDate() - 1)
    const sevenD = new Date(todayD)
    sevenD.setDate(sevenD.getDate() - 6)

    const toIso = (d) =>
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

    return { yesterdayStr: toIso(yestD), sevenDaysAgoStr: toIso(sevenD) }
  }, [db.today])

  // Lọc danh sách giao dịch
  const filteredRows = useMemo(() => {
    return monthLedger.filter((r) => {
      // 1. Lọc theo tab thời gian
      if (quickDate === 'today' && r.date !== db.today) return false
      if (quickDate === 'yesterday' && r.date !== yesterdayStr) return false
      if (quickDate === '7days' && (r.date < sevenDaysAgoStr || r.date > db.today)) return false

      // 2. Lọc theo ngày chọn trên biểu đồ sparkline
      if (selectedDay !== null) {
        const dNum = parseInt(r.date.slice(8, 10), 10)
        if (dNum !== selectedDay) return false
      }

      // 3. Lọc theo chiều thu / chi
      if (dirFilter !== 'all' && r.dir !== dirFilter) return false

      // 4. Lọc theo danh mục
      if (catFilter.length > 0 && !catFilter.includes(r.cat)) return false

      // 5. Tìm kiếm (nội dung, người trả, danh mục, số tiền)
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchLabel = (r.label || '').toLowerCase().includes(q)
        const matchBy = (r.by || '').toLowerCase().includes(q)
        const matchCat = catLabel(r.cat).toLowerCase().includes(q)
        const matchAmount = String(r.amount).includes(q)
        if (!matchLabel && !matchBy && !matchCat && !matchAmount) return false
      }

      return true
    })
  }, [monthLedger, quickDate, db.today, yesterdayStr, sevenDaysAgoStr, selectedDay, dirFilter, catFilter, search])

  // Gom nhóm danh sách theo Ngày và Cụm trùng loại
  const dateGroups = useMemo(() => {
    const map = {}
    const dates = []

    filteredRows.forEach((r) => {
      if (!map[r.date]) {
        map[r.date] = []
        dates.push(r.date)
      }
      map[r.date].push(r)
    })

    // Sắp xếp ngày mới nhất lên trước
    dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

    return dates.map((date) => {
      const dayRows = map[date]

      // Gom cụm giao dịch cùng ngày + cùng danh mục + cùng chiều
      const clusterMap = {}
      const clusterOrder = []

      dayRows.forEach((r) => {
        // Hoá đơn sân hoặc chi hộ giữ riêng từng dòng
        const k = (r.cat === CATS.court || r.dir === 'advance') ? r.id : `${r.cat}|${r.dir}`
        if (!clusterMap[k]) {
          clusterMap[k] = []
          clusterOrder.push(k)
        }
        clusterMap[k].push(r)
      })

      const items = clusterOrder.map((k) => {
        const list = clusterMap[k]
        if (list.length === 1) {
          const it = list[0]
          return {
            id: it.id,
            date: it.date,
            cat: it.cat,
            dir: it.dir,
            label: it.label,
            by: it.by,
            amount: it.amount,
            isAdvance: it.dir === 'advance',
            isCluster: false,
            kids: null,
            raw: it,
          }
        }
        // Giao dịch gom cụm
        const first = list[0]
        const totalAmount = list.reduce((s, x) => s + x.amount, 0)
        return {
          id: `cluster-${date}-${k}`,
          date,
          cat: first.cat,
          dir: first.dir,
          label: `${catLabel(first.cat)} · ${t('fund.txCount', { n: list.length })}`,
          by: first.by || t('fund.payerFund'),
          amount: totalAmount,
          isAdvance: false,
          isCluster: true,
          kids: list,
          raw: first,
        }
      })

      // Tiêu đề ngày hiển thị
      const wdNum = weekdayOf(date)
      const isToday = date === db.today
      const isYesterday = date === yesterdayStr
      let head = `${WD_FULL[wdNum]}, ${dd(date)}`
      if (isToday) head = `${t('common.today')} · ${WD_FULL[wdNum]}, ${dd(date)}`
      else if (isYesterday) head = `${t('fund.tabYesterday')} · ${WD_FULL[wdNum]}, ${dd(date)}`

      // Tổng chi ròng hoặc chi trong ngày
      const dayOut = dayRows.filter((x) => x.dir === 'out').reduce((s, x) => s + x.amount, 0)
      const dayIn = dayRows.filter((x) => x.dir === 'in').reduce((s, x) => s + x.amount, 0)
      const net = dayIn - dayOut

      return {
        date,
        head,
        total: dayOut > 0 ? `−${fmt(dayOut)}` : (net !== 0 ? `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}` : '0₫'),
        items,
      }
    })
  }, [filteredRows, db.today, yesterdayStr])

  // Danh sách phẳng để chọn item xem chi tiết
  const allDisplayItems = useMemo(() => {
    const list = []
    dateGroups.forEach((g) => {
      g.items.forEach((it) => {
        list.push(it)
        if (it.kids) {
          it.kids.forEach((k) => list.push({ ...k, raw: k }))
        }
      })
    })
    return list
  }, [dateGroups])

  // Giao dịch đang được chọn để xem chi tiết
  const selectedTx = useMemo(() => {
    if (selectedId) {
      const found = allDisplayItems.find((x) => x.id === selectedId)
      if (found) return found
    }
    return allDisplayItems[0] || null
  }, [allDisplayItems, selectedId])

  // Dữ liệu biểu đồ nhịp chi 30 ngày trong tháng
  const sparkDays = useMemo(() => {
    const spendByDay = {}
    monthLedger.forEach((r) => {
      const d = parseInt(r.date.slice(8, 10), 10)
      if (!spendByDay[d]) spendByDay[d] = { out: 0, in: 0, total: 0 }
      if (r.dir === 'out') spendByDay[d].out += r.amount
      else spendByDay[d].in += r.amount
      spendByDay[d].total += r.amount
    })

    const max = Math.max(...Object.values(spendByDay).map((x) => x.out), 1)

    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const data = spendByDay[d] || { out: 0, in: 0, total: 0 }
      const hasOut = data.out > 0
      const hasAny = data.total > 0
      const isPicked = selectedDay === d
      const heightPct = hasOut
        ? Math.max(10, Math.round((data.out / max) * 100))
        : (hasAny ? 10 : 4)

      // Nhãn ngày hiển thị ở các mốc 01, 05, 10, 15, 20, 25, 30
      const isLabeled = d === 1 || d % 5 === 0 || d === daysInMonth

      return {
        day: d,
        lbl: isLabeled ? String(d).padStart(2, '0') : '',
        h: heightPct,
        out: data.out,
        hasOut,
        isPicked,
      }
    })
  }, [monthLedger, daysInMonth, selectedDay])

  // Thống kê thẻ chỉ số
  const stats = useMemo(() => {
    const daysWithOut = new Set(monthLedger.filter((r) => r.dir === 'out').map((r) => r.date)).size
    const outTxs = monthLedger.filter((r) => r.dir === 'out')
    const outCount = outTxs.length

    return {
      outCount,
      daysWithOut,
    }
  }, [monthLedger])

  // Cơ cấu các nhóm chi trong kỳ
  const categoryBreakdown = useMemo(() => {
    const catTotals = {}
    filteredRows.forEach((r) => {
      catTotals[r.cat] = (catTotals[r.cat] || 0) + r.amount
    })

    const totalAll = Object.values(catTotals).reduce((s, v) => s + v, 0) || 1
    const entries = Object.keys(catTotals).map((cat) => ({
      cat,
      name: catLabel(cat),
      amount: catTotals[cat],
      col: CAT_COLORS[cat] || '#A8A29E',
      pct: Math.min(100, Math.round((catTotals[cat] / totalAll) * 100)),
    }))

    entries.sort((a, b) => b.amount - a.amount)
    return entries
  }, [filteredRows])

  // Lịch sử 6 tháng qua của danh mục đang chọn
  const categoryHistory6M = useMemo(() => {
    if (!selectedTx) return { list: [], trend: '' }

    const targetCat = selectedTx.cat
    const months = []
    for (let i = 5; i >= 0; i--) {
      months.push(addMonth(db.month, -i))
    }

    const monthSums = months.map((m) => {
      const sum = allLedger
        .filter((r) => monthOf(r.date) === m && r.cat === targetCat)
        .reduce((s, r) => s + r.amount, 0)
      return {
        month: m,
        lbl: 'T' + parseInt(m.slice(5, 7), 10),
        sum,
      }
    })

    const maxM = Math.max(...monthSums.map((x) => x.sum), 1)
    const curSum = monthSums[5].sum
    const prevSum = monthSums[4].sum

    let trend = t('fund.trendStable')
    if (curSum === maxM && curSum > 0) trend = t('fund.trendPeak')
    else if (curSum > prevSum) trend = t('fund.trendHigher')
    else if (curSum < prevSum) trend = t('fund.trendLower')

    const list = monthSums.map((m, idx) => ({
      lbl: m.lbl,
      h: m.sum > 0 ? Math.max(8, Math.round((m.sum / maxM) * 100)) : 4,
      isCurrent: idx === 5,
    }))

    return { list, trend }
  }, [selectedTx, db.month, allLedger])

  // Xuất file CSV dữ liệu thật
  const handleExportCsv = () => {
    const headers = [
      t('fund.csvHeaderDate'),
      t('fund.csvHeaderCat'),
      t('fund.csvHeaderLabel'),
      t('fund.csvHeaderBy'),
      t('fund.csvHeaderIn'),
      t('fund.csvHeaderOut'),
      t('fund.csvHeaderAmount'),
    ]

    const lines = filteredRows.map((r) => [
      `"${ddmy(r.date)}"`,
      `"${catLabel(r.cat)}"`,
      `"${(r.label || '').replace(/"/g, '""')}"`,
      `"${(r.by || '').replace(/"/g, '""')}"`,
      r.dir === 'in' ? r.amount : '',
      r.dir === 'out' ? r.amount : '',
      r.amount,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...lines.map((l) => l.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `giao-dich-${db.month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Chuyển đổi trạng thái bung/gộp cụm
  const toggleCluster = (id, e) => {
    if (e) e.stopPropagation()
    setExpandedClusters((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Xử lý chọn giao dịch
  const handleSelectTx = (it) => {
    setSelectedId(it.id)
    if (isMobile) setMobileDetailOpen(true)
  }

  // Các danh mục hiện diện trong tháng để lọc
  const activeCatsInMonth = useMemo(() => {
    const set = new Set(monthLedger.map((r) => r.cat))
    return Array.from(set)
  }, [monthLedger])

  return (
    <div style={S.container}>
      {/* ---------------- 1. TOP HEADER ---------------- */}
      <div style={{
        ...S.topHeader,
        ...(isMobile ? { height: 'auto', minHeight: 48, padding: '8px 0', gap: 8 } : {}),
      }}>
        <div style={{ ...S.topHeaderLeft, ...(isMobile ? { gap: 6 } : {}) }}>
          <h1 style={{ ...S.title, ...(isMobile ? { fontSize: 18 } : {}) }}>{t('fund.title')}</h1>
          {!isMobile && (
            <span style={S.subTitle}>
              {t('fund.txCountInDays', { n: filteredRows.length, days: stats.daysWithOut })} · {monthTxt(db.month)}
            </span>
          )}
        </div>

        <div style={{ ...S.topHeaderRight, ...(isMobile ? { gap: 6 } : {}) }}>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{ ...S.btnGhost, ...(isMobile ? { width: 34, height: 34, padding: 0 } : {}) }}
            title={t('fund.exportCsv')}
            aria-label={t('fund.exportCsv')}
          >
            <Icon name="download" size={15} />
            {!isMobile && <span style={{ marginLeft: 6 }}>{t('fund.exportCsv')}</span>}
          </button>

          {canMoney && (
            <button
              type="button"
              onClick={() => a.openDialog('bill', courtBillForm(db))}
              style={{ ...S.btnCourtBill, ...(isMobile ? { width: 34, height: 34, padding: 0 } : {}) }}
              title={t('fund.addBill')}
              aria-label={t('fund.addBill')}
            >
              <Icon name="landmark" size={15} />
              {!isMobile && <span style={{ marginLeft: 6 }}>{t('fund.addBill')}</span>}
            </button>
          )}

          {canMoney && (
            <button
              type="button"
              onClick={() => a.openDialog('ledger', ledgerForm(db))}
              style={{ ...S.btnPrimary, ...(isMobile ? { width: 34, height: 34, padding: 0 } : {}) }}
              title={t('fund.addTx')}
              aria-label={t('fund.addTx')}
            >
              <Icon name="plus" size={16} />
              {!isMobile && <span style={{ marginLeft: 6 }}>{t('fund.addTx')}</span>}
            </button>
          )}

          <IconButton
            icon={isDark ? 'sun' : 'moon'}
            size="sm"
            variant="ghost"
            style={S.themeBtn}
            label={isDark ? t('common.themeLight') : t('common.themeDark')}
            onClick={toggleTheme}
          />
        </div>
      </div>

      {/* ---------------- 2. HÀNG LỌC ---------------- */}
      <div style={{ ...S.filterBar, ...(isMobile ? { padding: '10px 0' } : {}) }}>
        <div style={{ ...S.filterBarInner, ...(isMobile ? { gap: 8 } : {}) }}>
          {/* Bộ chọn chuyển tháng */}
          <div style={{ ...S.monthNavBox, ...(isMobile ? { height: 34 } : {}) }}>
            <button
              type="button"
              onClick={() => a.shiftMonth(-1)}
              style={S.monthArrowBtn}
              aria-label={t('common.prevMonth')}
            >
              ‹
            </button>
            <div style={{ ...S.monthNavLabel, ...(isMobile ? { padding: '0 8px', fontSize: 12.5 } : {}) }}>
              <span>{monthTxt(db.month)}</span>
              <span style={S.daysBadge}>{t('fund.daysCount', { n: daysInMonth })}</span>
            </div>
            <button
              type="button"
              onClick={() => a.shiftMonth(1)}
              style={S.monthArrowBtn}
              aria-label={t('common.nextMonth')}
            >
              ›
            </button>
          </div>

          {!isMobile && <div style={S.verticalDivider} />}

          {/* Nút Lọc Popover */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              style={{
                ...S.filterBtn,
                ...(isMobile ? { padding: '0 10px', height: 34 } : {}),
                background: (catFilter.length > 0 || dirFilter !== 'all') ? '#F4F2FF' : 'var(--surface-card, #fff)',
                borderColor: (catFilter.length > 0 || dirFilter !== 'all') ? '#6C5CE7' : '#E3DFD8',
                color: (catFilter.length > 0 || dirFilter !== 'all') ? '#4F3FD1' : 'var(--text-primary, #1C1917)',
              }}
              title={t('common.filter')}
              aria-label={t('common.filter')}
            >
              <Icon name="filter" size={14} />
              {!isMobile && <span>{t('common.filter')}</span>}
              {(catFilter.length > 0 || dirFilter !== 'all') && (
                <span style={S.filterBadge}>
                  {catFilter.length + (dirFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {filterOpen && (
              <div style={{
                ...S.filterDropdown,
                ...(isMobile ? {
                  left: 'auto',
                  right: 0,
                  width: 'min(280px, calc(100vw - 32px))',
                  maxWidth: 'calc(100vw - 32px)',
                } : {}),
              }}>
                <div style={S.filterDropdownTitle}>{t('fund.filterDir')}</div>
                <div style={S.filterOptionGroup}>
                  {[
                    { key: 'all', label: t('fund.filterDirAll') },
                    { key: 'out', label: t('fund.filterDirOut') },
                    { key: 'in', label: t('fund.filterDirIn') },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDirFilter(opt.key)}
                      style={{
                        ...S.filterOptionBtn,
                        background: dirFilter === opt.key ? '#6C5CE7' : 'transparent',
                        color: dirFilter === opt.key ? '#fff' : 'var(--text-primary, #1C1917)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div style={{ ...S.filterDropdownTitle, marginTop: 14 }}>{t('fund.filterCats')}</div>
                <div style={S.catFilterGrid}>
                  {activeCatsInMonth.map((cat) => {
                    const isPicked = catFilter.includes(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCatFilter((prev) =>
                            isPicked ? prev.filter((c) => c !== cat) : [...prev, cat]
                          )
                        }}
                        style={{
                          ...S.catPickChip,
                          background: isPicked ? '#F4F2FF' : 'var(--surface-inset, #F3F0EB)',
                          borderColor: isPicked ? '#6C5CE7' : 'transparent',
                          color: isPicked ? '#4F3FD1' : 'var(--text-secondary, #57534E)',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLORS[cat] || '#A8A29E' }} />
                        <span>{catLabel(cat)}</span>
                      </button>
                    )
                  })}
                </div>

                {(catFilter.length > 0 || dirFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatFilter([])
                      setDirFilter('all')
                    }}
                    style={S.resetFilterBtn}
                  >
                    {t('fund.resetFilter')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Chọn mốc thời gian: Trên Mobile thu gọn thành Icon popover; Trên Desktop là 4 Tab */}
          {isMobile ? (
            <div style={{ position: 'relative' }} ref={timeRef}>
              <button
                type="button"
                onClick={() => setTimeOpen((v) => !v)}
                style={{
                  ...S.filterBtn,
                  padding: '0 10px',
                  height: 34,
                  background: quickDate !== 'all' ? '#F4F2FF' : 'var(--surface-card, #fff)',
                  borderColor: quickDate !== 'all' ? '#6C5CE7' : 'var(--border-subtle, #E3DFD8)',
                  color: quickDate !== 'all' ? '#4F3FD1' : 'var(--text-primary, #1C1917)',
                }}
                title={quickTabs.find((tab) => tab.id === quickDate)?.label || t('fund.tabAll')}
                aria-label={quickTabs.find((tab) => tab.id === quickDate)?.label || t('fund.tabAll')}
              >
                <Icon name="calendar-clock" size={14} />
                {quickDate !== 'all' && (
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                    {quickTabs.find((tab) => tab.id === quickDate)?.label}
                  </span>
                )}
              </button>

              {timeOpen && (
                <div style={{ ...S.filterDropdown, width: 160, left: 'auto', right: 0 }}>
                  <div style={S.filterDropdownTitle}>{t('fund.filterQuickDate')}</div>
                  <div style={S.filterOptionGroup}>
                    {quickTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setQuickDate(tab.id)
                          setSelectedDay(null)
                          setTimeOpen(false)
                        }}
                        style={{
                          ...S.filterOptionBtn,
                          background: quickDate === tab.id ? '#6C5CE7' : 'transparent',
                          color: quickDate === tab.id ? '#fff' : 'var(--text-primary, #1C1917)',
                          fontWeight: quickDate === tab.id ? 600 : 400,
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={S.quickTabBox}>
              {quickTabs.map((tab) => {
                const active = quickDate === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setQuickDate(tab.id)
                      setSelectedDay(null)
                    }}
                    style={{
                      ...S.quickTabBtn,
                      background: active ? '#6C5CE7' : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary, #57534E)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Ô tìm kiếm */}
          <div style={{
            ...S.compactSearchBox,
            ...(isMobile ? { width: '100%', maxWidth: '100%', minWidth: 0, marginTop: 4, height: 34 } : {}),
          }}>
            <Icon name="search" size={13} color="#A8A29E" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fund.searchPlaceholder')}
              style={S.compactSearchInput}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={S.clearSearchBtn}
                aria-label={t('common.cancel')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- 3. BIỂU ĐỒ SPARKLINE 30 NGÀY & THẺ CHỈ SỐ ---------------- */}
      <div style={{ ...S.sparklineSection, ...(isMobile ? { padding: '14px 0 12px' } : {}) }}>
        {/* Biểu đồ thanh hằng ngày (cuộn ngang mượt mà trên mobile để chạm chính xác) */}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingBottom: 4,
        }}>
          <div style={{
            ...S.sparklineChart,
            ...(isMobile ? { minWidth: 540, height: 60 } : {}),
          }}>
            {sparkDays.map((d) => (
              <div
                key={d.day}
                onClick={() => setSelectedDay(selectedDay === d.day ? null : d.day)}
                title={`${String(d.day).padStart(2, '0')}/${db.month.slice(5, 7)}: ${d.out > 0 ? fmt(d.out) : '0₫'}`}
                style={{
                  ...S.sparkBarCol,
                  opacity: selectedDay !== null && selectedDay !== d.day ? 0.35 : 1,
                }}
              >
                <div
                  style={{
                    ...S.sparkBar,
                    height: `${d.h}%`,
                    background: d.isPicked
                      ? '#6C5CE7'
                      : d.hasOut
                        ? 'var(--text-primary, #1C1917)'
                        : '#E7E3DC',
                  }}
                />
                <span
                  style={{
                    ...S.sparkLabel,
                    color: d.isPicked ? '#6C5CE7' : 'var(--text-muted, #A8A29E)',
                    fontWeight: d.isPicked ? 600 : 400,
                  }}
                >
                  {d.lbl}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Thẻ chỉ số tổng quan */}
        <div style={{
          ...S.statGrid,
          ...(isMobile ? { gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 } : {}),
        }}>
          <div style={{ ...S.statCard, ...(isMobile ? { padding: '10px 12px', minWidth: 0, overflow: 'hidden' } : {}) }}>
            <div style={S.statOverline}>{t('fund.spentThisPeriod')}</div>
            <div style={{
              ...S.statBigNumber,
              ...(isMobile ? { fontSize: 16, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
            }}>
              −{fmt(flow.out)}
            </div>
            <div style={{
              ...S.statSub,
              ...(isMobile ? { fontSize: 11, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
            }}>
              {t('fund.txCountInDays', { n: stats.outCount, days: stats.daysWithOut })}
            </div>
          </div>

          <div style={{ ...S.statCard, ...(isMobile ? { padding: '10px 12px', minWidth: 0, overflow: 'hidden' } : {}) }}>
            <div style={S.statOverline}>{t('fund.balanceNow')}</div>
            <div style={{
              ...S.statBigNumber,
              ...(isMobile ? { fontSize: 16, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
            }}>
              {fmt(av.balance)}
            </div>
            <div style={{
              ...S.statSub,
              ...(isMobile ? { fontSize: 11, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
            }}>
              {t('fund.available')}: {fmt(av.available)}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 4. MAIN SPLIT VIEW (DANH SÁCH + CHI TIẾT) ---------------- */}
      <div style={{
        ...S.mainSplit,
        ...(isMobile ? { flexDirection: 'column', gap: 14, padding: '14px 0 24px' } : {}),
      }}>
        {/* Cột Trái: Danh sách giao dịch gom theo ngày */}
        <div style={S.listColumn}>
          {dateGroups.length === 0 ? (
            <Empty icon="wallet" title={t('fund.empty')} hint={t('fund.noTxPeriod')} />
          ) : (
            dateGroups.map((g) => (
              <div key={g.date} style={S.dateGroup}>
                <div style={{ ...S.dateGroupHead, minWidth: 0, gap: 8 }}>
                  <span style={{ ...S.dateGroupTitle, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.head}
                  </span>
                  <span style={{ ...S.dateGroupTotal, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {g.total}
                  </span>
                </div>

                <div style={S.groupCardContainer}>
                  {g.items.map((it, idx) => {
                    const isSelected = selectedTx && selectedTx.id === it.id
                    const catColor = CAT_COLORS[it.cat] || '#A8A29E'
                    const isExpanded = !!expandedClusters[it.id]

                    return (
                      <div
                        key={it.id}
                        onClick={() => handleSelectTx(it)}
                        style={{
                          ...S.txRowContainer,
                          borderBottom: idx === g.items.length - 1 ? 'none' : '1px solid var(--border-subtle, #F3F0EB)',
                          background: isSelected ? (isDark ? 'var(--surface-accent-soft)' : '#F6F4FF') : 'var(--surface-card, #fff)',
                        }}
                      >
                        <div style={{
                          ...S.txRow,
                          ...(isMobile ? { padding: '10px 10px', gap: 8 } : {}),
                        }}>
                          <span style={{ ...S.colorIndicator, background: catColor }} />

                          <div style={{ ...S.txMainInfo, minWidth: 0 }}>
                            <div style={{
                              ...S.txTitleRow,
                              minWidth: 0,
                              flexWrap: isMobile ? 'wrap' : 'nowrap',
                              gap: 5,
                            }}>
                              <span style={{
                                ...S.txTitleText,
                                minWidth: 0,
                                flex: isMobile ? '1 1 auto' : '0 1 auto',
                                ...(isMobile ? { fontSize: 13.5 } : {})
                              }}>
                                {it.label}
                              </span>
                              {it.isCluster && (
                                <span style={S.clusterTag}>{t('fund.clusterTag')}</span>
                              )}
                              {it.isAdvance && (
                                <span style={S.advanceTag}>{t('fund.advanceTag')}</span>
                              )}
                            </div>
                            <div style={{
                              ...S.txSubtitleText,
                              minWidth: 0,
                              ...(isMobile ? { fontSize: 11.5 } : {})
                            }}>
                              {catLabel(it.cat)} · {it.by}
                            </div>
                          </div>

                          <div style={{
                            ...S.txAmountText,
                            ...(isMobile ? { fontSize: 13.5 } : {}),
                            color: it.dir === 'in' ? '#059669' : 'var(--text-primary, #1C1917)'
                          }}>
                            {it.dir === 'in' ? '+' : '−'}{fmt(it.amount)}
                          </div>

                          {it.isCluster ? (
                            <button
                              type="button"
                              onClick={(e) => toggleCluster(it.id, e)}
                              style={S.clusterToggleBtn}
                              aria-label={t('fund.clusterTag')}
                            >
                              {isExpanded ? '▴' : '▾'}
                            </button>
                          ) : (
                            <span style={S.chevronIcon}>›</span>
                          )}
                        </div>

                        {/* Danh sách con trong cụm gộp */}
                        {it.isCluster && isExpanded && it.kids && (
                          <div style={{
                            ...S.clusterKidsBox,
                            ...(isMobile ? { margin: '0 8px 10px 16px', paddingLeft: 8 } : {}),
                          }}>
                            {it.kids.map((kid) => (
                              <div
                                key={kid.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSelectTx(kid)
                                }}
                                style={{ ...S.clusterKidRow, ...(isMobile ? { gap: 6 } : {}) }}
                              >
                                <div style={{
                                  flex: 1,
                                  minWidth: 0,
                                  display: 'flex',
                                  flexDirection: isMobile ? 'column' : 'row',
                                  alignItems: isMobile ? 'flex-start' : 'center',
                                  gap: isMobile ? 1 : 8,
                                }}>
                                  <span style={{ ...S.kidNameText, ...(isMobile ? { fontSize: 12 } : {}) }}>
                                    {kid.label}
                                  </span>
                                  <span style={{ ...S.kidByText, ...(isMobile ? { fontSize: 11 } : {}) }}>
                                    {kid.by}
                                  </span>
                                </div>
                                <span style={{
                                  ...S.kidAmountText,
                                  ...(isMobile ? { fontSize: 12 } : {})
                                }}>
                                  {kid.dir === 'in' ? '+' : '−'}{fmt(kid.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cột Phải: Khung chi tiết giao dịch (Desktop) */}
        {!isMobile && selectedTx && (
          <div style={S.detailColumn}>
            <div style={S.detailCard}>
              {/* Header chi tiết */}
              <div style={S.detailHeader}>
                <div style={S.detailHeaderTop}>
                  <span style={S.detailOverline}>{t('fund.txDetail')}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={S.closeDetailBtn}
                    aria-label={t('common.close')}
                  >
                    ✕
                  </button>
                </div>

                <div style={S.detailHeroRow}>
                  <span
                    style={{
                      ...S.colorIndicatorLg,
                      background: CAT_COLORS[selectedTx.cat] || '#A8A29E',
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={S.detailTitle}>{selectedTx.label}</div>
                    <div style={S.detailSubtitle}>
                      {catLabel(selectedTx.cat)} · {selectedTx.by}
                    </div>
                  </div>
                </div>

                <div style={S.detailAmountBig}>
                  {selectedTx.dir === 'in' ? '+' : '−'}{fmt(selectedTx.amount)}
                </div>

                {/* Nút hành động */}
                <div style={S.detailActionsRow}>
                  {(() => {
                    const edit = editTarget(db, selectedTx.raw || selectedTx)
                    if (!edit || !canMoney) return null
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (edit.kind === 'bill') {
                            const b = db.courtBills.find((x) => x.id === edit.id)
                            if (b) a.openDialog('bill', editBillForm(b, db))
                          } else {
                            const m = db.manual.find((x) => x.id === edit.id)
                            if (m) a.openDialog('ledger', editLedgerForm(m))
                          }
                        }}
                        style={S.editActionBtn}
                      >
                        {t('fund.editThisTx')}
                      </button>
                    )
                  })()}

                  {(() => {
                    const undo = undoTarget(db, selectedTx.raw || selectedTx)
                    if (!undo || !canMoney) return null
                    return (
                      <button
                        type="button"
                        title={t('fund.undoHint')}
                        onClick={() => a.undoLedgerRow(selectedTx.id)}
                        style={S.deleteActionBtn}
                      >
                        <Icon name="undo-2" size={15} color="#DC2626" />
                      </button>
                    )
                  })()}
                </div>
              </div>

              {/* Bảng thông tin thuộc tính */}
              <div style={S.detailFieldsBox}>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldDate')}</span>
                  <span style={S.fieldVal}>{ddmy(selectedTx.date)}</span>
                </div>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldCat')}</span>
                  <span style={S.fieldVal}>{catLabel(selectedTx.cat)}</span>
                </div>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldDir')}</span>
                  <span style={S.fieldVal}>
                    {selectedTx.dir === 'in' ? t('fund.dirInLabel') : t('fund.dirOutLabel')}
                  </span>
                </div>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldBy')}</span>
                  <span style={S.fieldVal}>{selectedTx.by}</span>
                </div>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldLabel')}</span>
                  <span style={S.fieldVal}>{selectedTx.label}</span>
                </div>
                <div style={S.detailFieldRow}>
                  <span style={S.fieldKey}>{t('fund.fieldRef')}</span>
                  <span style={{ ...S.fieldVal, wordBreak: 'break-all' }}>{selectedTx.id}</span>
                </div>
              </div>

              {/* Lịch sử 6 tháng qua của danh mục */}
              <div style={S.detailTrendBox}>
                <div style={S.trendHeader}>
                  <span style={S.trendOverline}>{t('fund.trendLast6Months')}</span>
                  <span style={S.trendDesc}>{categoryHistory6M.trend}</span>
                </div>

                <div style={S.trendBars}>
                  {categoryHistory6M.list.map((m) => (
                    <div key={m.lbl} style={S.trendBarCol}>
                      <div
                        style={{
                          ...S.trendBar,
                          height: `${m.h}%`,
                          background: m.isCurrent
                            ? (CAT_COLORS[selectedTx.cat] || '#6C5CE7')
                            : '#E7E3DC',
                        }}
                      />
                      <span style={S.trendBarLabel}>{m.lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Thẻ cơ cấu các nhóm chi kỳ này */}
            <div style={S.catsBreakdownCard}>
              <div style={S.catsBreakdownHead}>
                <span style={S.catsBreakdownTitle}>{t('fund.categoriesThisPeriod')}</span>
                <span style={S.catsBreakdownCount}>
                  {t('fund.categoriesCount', { n: categoryBreakdown.length })}
                </span>
              </div>

              <div style={S.catsBreakdownList}>
                {categoryBreakdown.map((c) => (
                  <div
                    key={c.cat}
                    onClick={() => {
                      setCatFilter((prev) =>
                        prev.includes(c.cat) ? prev.filter((x) => x !== c.cat) : [...prev, c.cat]
                      )
                    }}
                    style={S.catProgressRow}
                  >
                    <div style={S.catProgressMeta}>
                      <span style={S.catProgressName}>{c.name}</span>
                      <span style={S.catProgressVal}>{fmt(c.amount)}</span>
                    </div>
                    <div style={S.catProgressBarBg}>
                      <div
                        style={{
                          ...S.catProgressBarFill,
                          width: `${c.pct}%`,
                          background: c.col,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- 5. MOBILE DETAIL BOTTOM SHEET ---------------- */}
      {isMobile && mobileDetailOpen && selectedTx && (
        <div style={S.mobileModalOverlay} onClick={() => setMobileDetailOpen(false)}>
          <div style={S.mobileBottomSheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.mobileSheetHandle} />

            <div style={S.detailHeroRow}>
              <span
                style={{
                  ...S.colorIndicatorLg,
                  background: CAT_COLORS[selectedTx.cat] || '#A8A29E',
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={S.detailTitle}>{selectedTx.label}</div>
                <div style={S.detailSubtitle}>
                  {catLabel(selectedTx.cat)} · {selectedTx.by}
                </div>
              </div>
            </div>

            <div style={S.detailAmountBig}>
              {selectedTx.dir === 'in' ? '+' : '−'}{fmt(selectedTx.amount)}
            </div>

            <div style={S.detailFieldsBox}>
              <div style={S.detailFieldRow}>
                <span style={S.fieldKey}>{t('fund.fieldDate')}</span>
                <span style={S.fieldVal}>{ddmy(selectedTx.date)}</span>
              </div>
              <div style={S.detailFieldRow}>
                <span style={S.fieldKey}>{t('fund.fieldCat')}</span>
                <span style={S.fieldVal}>{catLabel(selectedTx.cat)}</span>
              </div>
              <div style={S.detailFieldRow}>
                <span style={S.fieldKey}>{t('fund.fieldDir')}</span>
                <span style={S.fieldVal}>
                  {selectedTx.dir === 'in' ? t('fund.dirInLabel') : t('fund.dirOutLabel')}
                </span>
              </div>
              <div style={S.detailFieldRow}>
                <span style={S.fieldKey}>{t('fund.fieldBy')}</span>
                <span style={S.fieldVal}>{selectedTx.by}</span>
              </div>
              <div style={S.detailFieldRow}>
                <span style={S.fieldKey}>{t('fund.fieldRef')}</span>
                <span style={{ ...S.fieldVal, wordBreak: 'break-all' }}>{selectedTx.id}</span>
              </div>
            </div>

            {/* Lịch sử 6 tháng */}
            <div style={S.detailTrendBox}>
              <div style={S.trendHeader}>
                <span style={S.trendOverline}>{t('fund.trendLast6Months')}</span>
                <span style={S.trendDesc}>{categoryHistory6M.trend}</span>
              </div>
              <div style={S.trendBars}>
                {categoryHistory6M.list.map((m) => (
                  <div key={m.lbl} style={S.trendBarCol}>
                    <div
                      style={{
                        ...S.trendBar,
                        height: `${m.h}%`,
                        background: m.isCurrent
                          ? (CAT_COLORS[selectedTx.cat] || '#6C5CE7')
                          : '#E7E3DC',
                      }}
                    />
                    <span style={S.trendBarLabel}>{m.lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nút hành động Mobile */}
            <div style={S.mobileActionsRow}>
              {(() => {
                const edit = editTarget(db, selectedTx.raw || selectedTx)
                if (!edit || !canMoney) return null
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false)
                      if (edit.kind === 'bill') {
                        const b = db.courtBills.find((x) => x.id === edit.id)
                        if (b) a.openDialog('bill', editBillForm(b, db))
                      } else {
                        const m = db.manual.find((x) => x.id === edit.id)
                        if (m) a.openDialog('ledger', editLedgerForm(m))
                      }
                    }}
                    style={S.mobilePrimaryActionBtn}
                  >
                    {t('fund.editThisTx')}
                  </button>
                )
              })()}

              {(() => {
                const undo = undoTarget(db, selectedTx.raw || selectedTx)
                if (!undo || !canMoney) return null
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false)
                      a.undoLedgerRow(selectedTx.id)
                    }}
                    style={S.mobileDeleteActionBtn}
                  >
                    <Icon name="undo-2" size={17} color="#DC2626" />
                  </button>
                )
              })()}

              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                style={S.mobileCloseBtn}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   CÁC HÀM EXPORT TƯƠNG THÍCH NGƯỢC (Được Home.jsx và các component khác dùng)
   ========================================================================== */

export function FundOverviewCards() {
  const { db } = useApp()
  const flow = monthFlow(db, db.month)
  const net = flow.in - flow.out
  const av = availableBalance(db)
  const bal = av.balance

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-accent-soft)', border: '1px solid var(--teal-500)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colTotalIn')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-delivered)', marginTop: 4 }}>
          +{fmt(flow.in)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('fund.colTotalInSub')}
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colTotalOut')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-incident)', marginTop: 4 }}>
          −{fmt(flow.out)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('fund.colTotalOutSub')}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: net >= 0 ? 'var(--surface-accent-soft)' : 'var(--status-delayed-bg)',
        border: `1px solid ${net >= 0 ? 'var(--teal-500)' : 'var(--status-delayed)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colNet')}</div>
        <div style={{ font: 'var(--type-h2)', color: net >= 0 ? 'var(--status-delivered)' : 'var(--status-delayed)', marginTop: 4 }}>
          {(net >= 0 ? '+' : '') + fmt(net)}
        </div>
        <div style={{ font: 'var(--type-caption)', fontWeight: 600, color: net >= 0 ? 'var(--teal-800)' : 'var(--status-delayed)', marginTop: 2 }}>
          {t(net >= 0 ? 'fund.netUp' : 'fund.netDown')}
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colBalanceNow')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--text-primary)', marginTop: 4 }}>
          {fmt(bal)}
        </div>
      </div>
    </div>
  )
}

export function FundBalanceColumns() {
  const { db } = useApp()
  const groups = ledgerGrouped(db, db.month)
  const inGroups = groups.filter((g) => g.dir === 'in' && g.cat !== 'opening')
  const outGroups = groups.filter((g) => g.dir === 'out')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
          {t('fund.inTitle')}
        </div>
        <div style={{ display: 'grid' }}>
          {inGroups.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>{t('fund.inEmpty')}</div>
          ) : (
            inGroups.map((g) => (
              <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{catLabel(g.cat)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('fund.txCount', { n: g.items.length })}</div>
                </div>
                <Mono size={14} weight={600} color="var(--status-delivered)">+{fmt(g.amount)}</Mono>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ background: 'var(--surface-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
          {t('fund.outTitle')}
        </div>
        <div style={{ display: 'grid' }}>
          {outGroups.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>{t('fund.outEmpty')}</div>
          ) : (
            outGroups.map((g) => (
              <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{catLabel(g.cat)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('fund.txCount', { n: g.items.length })}</div>
                </div>
                <Mono size={14} weight={600} color="var(--status-incident)">−{fmt(g.amount)}</Mono>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function Detail() {
  return <Fund />
}

/* ==========================================================================
   STYLE SYSTEM (Khớp chuẩn thiết kế canvas pixel-perfect & responsive)
   ========================================================================== */

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflowX: 'hidden',
    fontFamily: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  topHeader: {
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 4px',
    borderBottom: '1px solid var(--border-subtle, #EDEAE4)',
    background: 'transparent',
    flexWrap: 'wrap',
    gap: 12,
  },
  topHeaderLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    lineHeight: 1,
  },
  subTitle: {
    fontSize: 13,
    color: 'var(--text-muted, #8A857D)',
  },
  topHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  btnGhost: {
    height: 36,
    padding: '0 14px',
    border: '1px solid var(--border-subtle, #E3DFD8)',
    borderRadius: 9,
    background: 'var(--surface-card, #fff)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary, #57534E)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  btnCourtBill: {
    height: 36,
    padding: '0 14px',
    border: '1px solid var(--border-subtle, #E3DFD8)',
    borderRadius: 9,
    background: 'var(--surface-card, #fff)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnPrimary: {
    height: 36,
    padding: '0 16px',
    borderRadius: 9,
    background: 'var(--text-primary, #1C1917)',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  themeBtn: {
    color: 'var(--text-secondary, #57534E)',
  },

  /* Hàng lọc 1 dòng */
  filterBar: {
    padding: '14px 0',
    borderBottom: '1px solid var(--border-subtle, #EDEAE4)',
    background: 'transparent',
  },
  filterBarInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  monthNavBox: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border-subtle, #E3DFD8)',
    borderRadius: 9,
    background: 'var(--surface-card, #fff)',
    flexShrink: 0,
  },
  monthArrowBtn: {
    width: 30,
    height: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 15,
    color: 'var(--text-muted, #A8A29E)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    borderLeft: '1px solid var(--border-subtle, #F0EDE7)',
    borderRight: '1px solid var(--border-subtle, #F0EDE7)',
    height: '100%',
  },
  daysBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: 6,
    background: 'var(--surface-inset, #F3F0EB)',
    color: 'var(--text-muted, #8A857D)',
  },
  verticalDivider: {
    width: 1,
    height: 20,
    background: 'var(--border-subtle, #EDEAE4)',
  },
  filterBtn: {
    height: 36,
    padding: '0 13px',
    borderRadius: 9,
    border: '1px solid var(--border-subtle, #E3DFD8)',
    fontSize: 13,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 9,
    background: '#6C5CE7',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    zIndex: 50,
    width: 280,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-subtle, #EDEAE4)',
    boxShadow: '0 12px 32px -8px rgba(0,0,0,0.18)',
  },
  filterDropdownTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--text-muted, #A8A29E)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  filterOptionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  filterOptionBtn: {
    padding: '7px 10px',
    borderRadius: 7,
    border: 'none',
    fontSize: 12.5,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  catFilterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  catPickChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    borderRadius: 7,
    fontSize: 12,
    border: '1px solid transparent',
    cursor: 'pointer',
  },
  resetFilterBtn: {
    marginTop: 12,
    width: '100%',
    padding: '6px 0',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'underline',
  },
  quickTabBox: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface-inset, #F3F0EB)',
    borderRadius: 9,
    padding: 3,
  },
  quickTabBtn: {
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  compactSearchBox: {
    height: 36,
    flex: 1,
    minWidth: 170,
    maxWidth: 280,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--border-subtle, #E3DFD8)',
    borderRadius: 9,
    background: 'var(--surface-card, #fff)',
    padding: '0 10px',
  },
  compactSearchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    color: 'var(--text-primary, #1C1917)',
    width: '100%',
  },
  clearSearchBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted, #A8A29E)',
    cursor: 'pointer',
    fontSize: 12,
    padding: 2,
  },

  /* Sparkline nhịp chi */
  sparklineSection: {
    padding: '20px 0 18px',
    borderBottom: '1px solid var(--border-subtle, #EDEAE4)',
  },
  sparklineChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 5,
    height: 74,
  },
  sparkBarCol: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    cursor: 'pointer',
  },
  sparkBar: {
    width: '100%',
    borderRadius: 3,
    transition: 'height 0.2s ease, background 0.2s ease',
  },
  sparkLabel: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 10,
    lineHeight: 1,
  },

  /* 4 Thẻ chỉ số */
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
    marginTop: 18,
  },
  statCard: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-subtle, #EDEAE4)',
    borderRadius: 14,
    padding: '14px 18px',
  },
  statOverline: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: 'var(--text-muted, #A8A29E)',
  },
  statBigNumber: {
    fontSize: 23,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    marginTop: 8,
    lineHeight: 1.15,
  },
  statSub: {
    fontSize: 12,
    color: 'var(--text-muted, #8A857D)',
    marginTop: 5,
  },

  /* Main Split View */
  mainSplit: {
    display: 'flex',
    gap: 24,
    padding: '20px 0 30px',
    alignItems: 'flex-start',
  },
  listColumn: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    boxSizing: 'border-box',
  },
  dateGroup: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  dateGroupHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '0 2px 8px',
    gap: 8,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  dateGroupTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary, #57534E)',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dateGroupTotal: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary, #1C1917)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  groupCardContainer: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-subtle, #EDEAE4)',
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  txRowContainer: {
    transition: 'background 0.15s ease',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  txRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 16px',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  colorIndicator: {
    width: 4,
    height: 30,
    borderRadius: 2,
    flexShrink: 0,
  },
  txMainInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  txTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
    maxWidth: '100%',
  },
  txTitleText: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary, #1C1917)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  clusterTag: {
    fontSize: 10.5,
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 600,
    color: '#0F766E',
    background: '#DBF5F1',
    padding: '2px 5px',
    borderRadius: 4,
    flexShrink: 0,
  },
  advanceTag: {
    fontSize: 10.5,
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 600,
    color: '#b45309',
    background: 'rgba(217, 119, 6, 0.12)',
    padding: '2px 5px',
    borderRadius: 4,
    flexShrink: 0,
  },
  txSubtitleText: {
    fontSize: 12,
    color: 'var(--text-muted, #A8A29E)',
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  txAmountText: {
    fontSize: 14.5,
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  chevronIcon: {
    fontSize: 15,
    color: '#CFC9C0',
    flexShrink: 0,
    width: 14,
    textAlign: 'right',
  },
  clusterToggleBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted, #8A857D)',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
    width: 14,
    textAlign: 'right',
  },
  clusterKidsBox: {
    margin: '0 16px 12px 48px',
    borderLeft: '1px solid var(--border-subtle, #EDEAE4)',
    paddingLeft: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  clusterKidRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontSize: 12.5,
  },
  kidNameText: {
    flex: 1,
    minWidth: 0,
    color: 'var(--text-secondary, #57534E)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  kidByText: {
    fontSize: 11.5,
    fontFamily: '"JetBrains Mono", monospace',
    color: 'var(--text-muted, #B5AFA6)',
    flexShrink: 0,
  },
  kidAmountText: {
    fontSize: 12.5,
    fontWeight: 500,
    color: 'var(--text-secondary, #57534E)',
    flexShrink: 0,
    textAlign: 'right',
  },

  /* Cột Phải: Khung chi tiết giao dịch */
  detailColumn: {
    width: 352,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 20,
  },
  detailCard: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-subtle, #EDEAE4)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailHeader: {
    padding: '16px 18px 14px',
    borderBottom: '1px solid var(--border-subtle, #F3F0EB)',
  },
  detailHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailOverline: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: 'var(--text-muted, #A8A29E)',
  },
  closeDetailBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted, #C4BFB7)',
    cursor: 'pointer',
    fontSize: 14,
  },
  detailHeroRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  colorIndicatorLg: {
    width: 4,
    height: 34,
    borderRadius: 2,
    flexShrink: 0,
  },
  detailTitle: {
    fontSize: 16.5,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    lineHeight: 1.3,
  },
  detailSubtitle: {
    fontSize: 12,
    color: 'var(--text-muted, #A8A29E)',
    marginTop: 4,
  },
  detailAmountBig: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
    marginTop: 14,
    lineHeight: 1.1,
  },
  detailActionsRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  editActionBtn: {
    height: 34,
    flex: 1,
    borderRadius: 9,
    background: 'var(--text-primary, #1C1917)',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: '1px solid #F3D6D6',
    background: 'var(--surface-card, #fff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  detailFieldsBox: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  detailFieldRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldKey: {
    fontSize: 12.5,
    color: 'var(--text-muted, #A8A29E)',
    flexShrink: 0,
  },
  fieldVal: {
    fontSize: 12.5,
    fontWeight: 500,
    color: 'var(--text-secondary, #44403C)',
    textAlign: 'right',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    minWidth: 0,
  },

  detailTrendBox: {
    padding: '14px 18px 16px',
    borderTop: '1px solid var(--border-subtle, #F3F0EB)',
  },
  trendHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  trendOverline: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: 'var(--text-muted, #A8A29E)',
  },
  trendDesc: {
    fontSize: 11.5,
    color: 'var(--text-muted, #8A857D)',
  },
  trendBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 7,
    height: 50,
    marginTop: 12,
  },
  trendBarCol: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  trendBar: {
    width: '100%',
    borderRadius: 3,
  },
  trendBarLabel: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 9.5,
    color: 'var(--text-muted, #B5AFA6)',
  },

  /* Card cơ cấu nhóm chi */
  catsBreakdownCard: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-subtle, #EDEAE4)',
    borderRadius: 16,
    padding: '16px 18px',
  },
  catsBreakdownHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  catsBreakdownTitle: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--text-primary, #1C1917)',
  },
  catsBreakdownCount: {
    fontSize: 12,
    color: 'var(--text-muted, #A8A29E)',
  },
  catsBreakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 14,
  },
  catProgressRow: {
    cursor: 'pointer',
  },
  catProgressMeta: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  catProgressName: {
    fontSize: 12.5,
    color: 'var(--text-secondary, #57534E)',
  },
  catProgressVal: {
    fontSize: 12.5,
    fontWeight: 500,
    color: 'var(--text-primary, #1C1917)',
  },
  catProgressBarBg: {
    height: 5,
    borderRadius: 3,
    background: 'var(--surface-inset, #F3F0EB)',
    marginTop: 6,
    overflow: 'hidden',
  },
  catProgressBarFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },

  /* Mobile Bottom Sheet */
  mobileModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(28, 25, 23, 0.55)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  mobileBottomSheet: {
    background: 'var(--surface-card, #FBFAF8)',
    borderRadius: '24px 24px 0 0',
    padding: '12px 18px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxHeight: '88vh',
    overflowY: 'auto',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  mobileSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    background: '#DDD8D0',
    alignSelf: 'center',
  },
  mobileActionsRow: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  mobilePrimaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    background: 'var(--text-primary, #1C1917)',
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  mobileDeleteActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 11,
    border: '1px solid #F3D6D6',
    background: 'var(--surface-card, #fff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  mobileCloseBtn: {
    height: 44,
    padding: '0 16px',
    borderRadius: 11,
    border: '1px solid var(--border-subtle, #E3DFD8)',
    background: 'var(--surface-card, #fff)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary, #57534E)',
    cursor: 'pointer',
  },
}
