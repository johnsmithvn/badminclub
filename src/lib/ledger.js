// Sổ quỹ — nguồn DUY NHẤT của số dư. Mọi thay đổi tiền đổ về đây, không tính lại từ nhiều nguồn.
//
// QUAN TRỌNG: `cat` là KEY ổn định (dues, court, shuttle…), không phải chữ hiển thị.
// Key này tương ứng transactions.category trong DB — đổi ngôn ngữ KHÔNG được làm đổi dữ liệu đã ghi.
// Chữ hiển thị lấy bằng catLabel(cat) / label dựng từ i18n.

import { dd, monthOf, monthTxt } from '#utils/dates.js'
import { t } from '#i18n'
import {
  courtCost, courtExtraCost, courtPayMode, courtTxt,
  groupOf, guestOf, memberOf, payerName, sessionOf, soldTotal, timeTxt,
} from '#lib/money.js'

/** Các hạng mục sổ quỹ. Dùng key, đừng dùng chữ. */
export const CATS = {
  opening: 'opening',
  dues: 'dues',
  guest: 'guest',
  court: 'court',
  courtSold: 'courtSold',
  courtExtra: 'courtExtra',
  shuttle: 'shuttle',
  back: 'back',
  extra: 'extra',
  withdraw: 'withdraw',
  other: 'other',
}

/** Hạng mục người dùng được chọn khi ghi thu/chi tay. */
export const MANUAL_CATS = [CATS.withdraw, CATS.other, CATS.dues, CATS.guest, CATS.court, CATS.shuttle]

export const catLabel = (cat) => t('ledger.cat.' + cat)

const courtName = (db, c) => (db.courts.find((x) => x.id === c.courtId) || { name: t('common.unknown') }).name

/** Toàn bộ dòng thu chi, sắp theo ngày tăng dần. */
export function ledger(db) {
  const out = []

  out.push({
    id: 'open', date: db.club.openingDate, dir: 'in', cat: CATS.opening,
    label: t('ledger.label.opening'), amount: db.club.opening, by: db.club.openingBy || '',
  })

  db.dues.filter((d) => d.paid).forEach((d) =>
    out.push({
      id: 'du' + d.id, date: d.paidAt || d.month + '-01', dir: 'in', cat: CATS.dues,
      label: t('ledger.label.dues', {
        name: memberOf(db, d.memberId).name, group: groupOf(db, d.groupId).name, month: monthTxt(d.month),
      }),
      amount: d.amount, by: d.method,
    })
  )

  db.sessionGuests.filter((g) => g.paid).forEach((g) => {
    const s = sessionOf(db, g.sessionId)
    if (!s) return
    out.push({
      id: 'sg' + g.id, date: s.date, dir: 'in', cat: CATS.guest,
      label: t('ledger.label.guest', { name: guestOf(db, g.guestId).name, date: dd(s.date) }),
      amount: g.price, by: t('ledger.by.payNow'),
    })
  })

  if (courtPayMode(db) === 'session') {
    // Mỗi buổi đã chốt ghi 1 dòng chi tiền sân.
    db.sessions.filter((s) => s.status === 'closed').forEach((s) =>
      out.push({
        id: 'ct' + s.id, date: s.date, dir: 'out', cat: CATS.court,
        label: t('ledger.label.courtSession', { courts: courtTxt(db, s), time: timeTxt(s) }),
        amount: courtCost(db, s), by: groupOf(db, s.groupId).short,
      })
    )
  } else {
    // Trả trọn tháng: ghi đúng số đã chuyển theo hoá đơn, không ghi theo buổi.
    ;(db.courtBills || []).forEach((b) =>
      out.push({
        id: 'cb' + b.id, date: b.date, dir: 'out', cat: CATS.court,
        label: t('ledger.label.courtBill', {
          venue: b.venue, month: monthTxt(b.month).toLowerCase(), note: b.note ? ' · ' + b.note : '',
        }),
        amount: b.amount, by: payerName(db, b.payerId, b.payer),
      })
    )
  }

  db.sessions.forEach((s) => {
    if (s.status !== 'closed') return
    const sold = soldTotal(s)
    if (sold <= 0) return
    out.push({
      id: 'cs' + s.id, date: s.date, dir: 'in', cat: CATS.courtSold,
      label: t('ledger.label.sold', {
        courts: (s.courts || []).filter((c) => c.sold)
          .map((c) => courtName(db, c) + (c.soldTo ? ' → ' + c.soldTo : '')).join(', '),
        date: dd(s.date),
      }),
      amount: sold, by: groupOf(db, s.groupId).short,
    })
  })

  if (courtPayMode(db) === 'month') {
    // Sân thuê thêm nằm ngoài hoá đơn tháng nên vẫn ghi chi riêng theo buổi.
    db.sessions.filter((s) => s.status === 'closed').forEach((s) => {
      const ex = courtExtraCost(db, s)
      if (ex <= 0) return
      out.push({
        id: 'ce' + s.id, date: s.date, dir: 'out', cat: CATS.courtExtra,
        label: t('ledger.label.extra', {
          courts: (s.courts || []).filter((c) => c.extra)
            .map((c) => courtName(db, c) + ' · ' + c.from + ' → ' + c.to).join(', '),
          date: dd(s.date),
        }),
        amount: ex, by: groupOf(db, s.groupId).short,
      })
    })
  }

  db.purchases.filter((p) => p.total > 0).forEach((p) =>
    out.push({
      id: 'pu' + p.id, date: p.date, dir: 'out', cat: CATS.shuttle,
      label: t('ledger.label.shuttle', {
        type: (db.shuttleTypes.find((x) => x.id === p.typeId) || { name: '' }).name,
        tubes: p.tubes, qty: p.qty,
      }),
      amount: p.total, by: payerName(db, p.payerId, p.payer),
    })
  )

  // Đối chiếu buổi — hai chiều, đọc SỐ ĐÃ LƯU chứ không tính lại từ điểm danh hiện tại.
  //   amount ÂM  → chi, quỹ trả lại người vắng
  //   amount DƯƠNG → thu, người đi thêm buổi trả quỹ
  // settle='offset_next_dues' KHÔNG có dòng nào ở đây: nó trừ thẳng vào quỹ tháng sau, tiền
  // không đổi tay lần nào nên ghi vào sổ quỹ là bịa ra một giao dịch không có thật.
  ;(db.adjustments || []).forEach((x) => {
    if (!x.paid || x.settle !== 'cash' || !x.amount) return
    const back = x.amount < 0
    out.push({
      id: 'aj' + x.id, date: x.paidAt || x.month + '-28',
      dir: back ? 'out' : 'in', cat: back ? CATS.back : CATS.extra,
      label: t(back ? 'ledger.label.back' : 'ledger.label.extra', {
        name: memberOf(db, x.memberId).name, n: x.sessions,
      }),
      amount: Math.abs(x.amount), by: t('ledger.by.transfer'),
    })
  })

  db.manual.forEach((m) => out.push({ ...m }))

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Số dư luỹ kế toàn bộ, không theo tháng. */
export const fundBalance = (db) => ledger(db).reduce((t2, r) => t2 + (r.dir === 'in' ? r.amount : -r.amount), 0)

/** Thu/chi trong một tháng, KHÔNG tính dòng Số dư mang sang. */
export function monthFlow(db, m) {
  const l = ledger(db).filter((r) => monthOf(r.date) === m && r.cat !== CATS.opening)
  return {
    in: l.filter((r) => r.dir === 'in').reduce((t2, r) => t2 + r.amount, 0),
    out: l.filter((r) => r.dir === 'out').reduce((t2, r) => t2 + r.amount, 0),
  }
}

/** Gộp các dòng trùng ngày + hạng mục + chiều thành một dòng cha bung ra được. */
export function ledgerGrouped(db, month) {
  const rowsIn = ledger(db).filter((r) => monthOf(r.date) === month).reverse()
  const map = {}
  const order = []
  rowsIn.forEach((r) => {
    const k = r.date + '|' + r.cat + '|' + r.dir
    if (!map[k]) {
      map[k] = { key: k, date: r.date, cat: r.cat, dir: r.dir, items: [] }
      order.push(k)
    }
    map[k].items.push(r)
  })
  return order.map((k) => {
    const g = map[k]
    return { ...g, amount: g.items.reduce((t2, x) => t2 + x.amount, 0) }
  })
}

/** Bảng Tổng hợp theo tháng: mỗi ngày một dòng NGÀY · THU · CHI · QUỸ luỹ kế. */
export function dailySummary(db, month) {
  const all = ledger(db)
  const before = all.filter((r) => monthOf(r.date) < month)
    .reduce((t2, r) => t2 + (r.dir === 'in' ? r.amount : -r.amount), 0)
  const inMonth = all.filter((r) => monthOf(r.date) === month)
  const byDate = {}
  const order = []
  inMonth.forEach((r) => {
    if (!byDate[r.date]) {
      byDate[r.date] = { date: r.date, in: 0, out: 0 }
      order.push(r.date)
    }
    if (r.dir === 'in') byDate[r.date].in += r.amount
    else byDate[r.date].out += r.amount
  })
  order.sort()
  let run = before
  return {
    opening: before,
    rows: order.map((d) => {
      run += byDate[d].in - byDate[d].out
      return { ...byDate[d], balance: run }
    }),
  }
}
