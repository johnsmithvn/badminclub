// Sổ quỹ — nguồn DUY NHẤT của số dư. Mọi thay đổi tiền đổ về đây, không tính lại từ nhiều nguồn.
//
// QUAN TRỌNG: `cat` là KEY ổn định (dues, court, shuttle…), không phải chữ hiển thị.
// Key này tương ứng transactions.category trong DB — đổi ngôn ngữ KHÔNG được làm đổi dữ liệu đã ghi.
// Chữ hiển thị lấy bằng catLabel(cat) / label dựng từ i18n.

import { dd, monthOf, monthTxt } from '#utils/dates.js'
import { t } from '#i18n'
import {
  advanceRows, billsOf, courtCost, courtExtraCost, courtPayMode, courtTxt, dueState, fmtK,
  chargeName, groupOf, isVault, memberOf, monthSessions, payerName, sessionOf, soldTotal,
  timeTxt,
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

/**
 * Hạng mục người dùng được chọn khi ghi thu/chi tay.
 * `back` có mặt vì trả lại tiền cho người ngưng giữa tháng đi qua đây (không phải qua bảng
 * đối chiếu): người đó không còn cố định nữa nên `adjustRows` không sinh dòng cho họ.
 */
export const MANUAL_CATS = [CATS.withdraw, CATS.other, CATS.dues, CATS.guest, CATS.court, CATS.shuttle, CATS.back]

export const catLabel = (cat) => t('ledger.cat.' + cat)

const courtName = (db, c) => (db.courts.find((x) => x.id === c.courtId) || { name: t('common.unknown') }).name

/**
 * Ngày khoản chi thật sự rời két — LUẬT NGƯỜI GIỮ QUỸ (migration 0011).
 * Két trả thì tiền ra ngay hôm đó. Thành viên ứng thì quỹ chưa mất gì; chỉ khi CLB trả lại
 * người ta (`repaidAt`) mới có tiền rời két. Trả về '' = chưa có dòng nào trong sổ.
 */
const paidOn = (db, x) => (isVault(db, x.payerId) ? x.date : x.repaidAt || '')

/**
 * Dòng chi của khoản ứng mang ngày TRẢ LẠI, không phải ngày mua — không nói rõ thì người đọc
 * tưởng hôm đó mới đi mua cầu. Ghi luôn ngày mua gốc vào nhãn.
 */
const repayTag = (db, x) =>
  isVault(db, x.payerId) ? '' : ' · ' + t('ledger.label.repay', { name: memberOf(db, x.payerId).name, date: dd(x.date) })

/** Toàn bộ dòng thu chi, sắp theo ngày tăng dần. */
export function ledger(db) {
  const out = []

  out.push({
    id: 'open', date: db.club.openingDate, dir: 'in', cat: CATS.opening,
    label: t('ledger.label.opening'), amount: db.club.opening, by: db.club.openingBy || '',
  })

  // Ghi đúng số ĐÃ NHẬN, không phải số phải đóng: đóng thiếu thì sổ quỹ chỉ được thấy phần
  // đã vào tay. ponytail: một khoản = một dòng, chưa tách được từng lần thu vì lịch sử thu
  // nằm ở `transactions` — làm ở P6 (Issue 2).
  db.dues.forEach((d) => {
    const st = dueState(d)
    if (st.paid <= 0) return
    out.push({
      id: 'du' + d.id, date: d.paidAt || d.month + '-01', dir: 'in', cat: CATS.dues,
      label: t(st.full ? 'ledger.label.dues' : 'ledger.label.duesPartial', {
        name: memberOf(db, d.memberId).name, group: groupOf(db, d.groupId).name,
        month: monthTxt(d.month), remain: fmtK(st.remain),
      }),
      amount: st.paid, by: d.method,
    })
  })

  db.sessionGuests.filter((g) => g.paid).forEach((g) => {
    const s = sessionOf(db, g.sessionId)
    if (!s) return
    out.push({
      id: 'sg' + g.id, date: s.date, dir: 'in', cat: CATS.guest,
      label: t('ledger.label.guest', { name: chargeName(db, g), date: dd(s.date) }),
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
    ;(db.courtBills || []).forEach((b) => {
      const at = paidOn(db, b)
      if (!at) return                       // thành viên ứng, CLB chưa trả lại → quỹ chưa mất gì
      out.push({
        id: 'cb' + b.id, date: at, dir: 'out', cat: CATS.court,
        label: t('ledger.label.courtBill', {
          venue: b.venue, month: monthTxt(b.month).toLowerCase(), note: b.note ? ' · ' + b.note : '',
        }) + repayTag(db, b),
        amount: b.amount, by: payerName(db, b.payerId, b.payer),
      })
    })
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

  db.purchases.filter((p) => p.total > 0).forEach((p) => {
    const at = paidOn(db, p)
    if (!at) return                         // thành viên ứng, CLB chưa trả lại → quỹ chưa mất gì
    out.push({
      id: 'pu' + p.id, date: at, dir: 'out', cat: CATS.shuttle,
      label: t('ledger.label.shuttle', {
        type: (db.shuttleTypes.find((x) => x.id === p.typeId) || { name: '' }).name,
        tubes: p.tubes, qty: p.qty,
      }) + repayTag(db, p),
      amount: p.total, by: payerName(db, p.payerId, p.payer),
    })
  })

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

/**
 * HOÀN TÁC một dòng sổ quỹ: dòng này đến từ đâu, và gỡ bằng cách nào.
 *
 * Sổ quỹ là bảng SUY RA, không phải bảng lưu — `ledger()` dựng dòng từ `dues`, `sessionGuests`,
 * `courtBills`, `purchases`, `adjustments` và `manual`. Nên "hoàn tác" ở đây KHÔNG được xoá một
 * dòng sổ (không có dòng nào để xoá), mà phải lật đúng cái cờ ở NGUỒN — y hệt bấm "Thu" rồi
 * "Bỏ thu" ở màn Công nợ. Lật xong thì dòng tự biến khỏi sổ và số dư tự trừ lại.
 *
 * Trả `null` = không hoàn ở đây được. Ba nhóm rơi vào đó, cố ý:
 *   - `opening` số dư mang sang — sửa ở Cài đặt, không phải một giao dịch;
 *   - `ct`/`cs`/`ce` tiền sân, bán sân, sân thuê thêm — suy từ buổi ĐÃ CHỐT. Muốn đổi thì mở
 *     lại buổi, không thì sổ quỹ nói một đằng buổi nói một nẻo;
 *   - `cb`/`pu` mà QUỸ tự trả — dòng chi là chính khoản mua đó, gỡ nghĩa là xoá hoá đơn,
 *     phải đi qua nút xoá riêng chứ không phải nút hoàn tác.
 */
export function undoTarget(db, row) {
  if (!row) return null

  // Dòng ghi tay so bằng ID ĐẦY ĐỦ và phải xét TRƯỚC khi cắt tiền tố: id của nó là uuid trần,
  // mà uuid là chuỗi hex nên hoàn toàn có thể bắt đầu bằng "cb" hay "aj". Cắt hai ký tự đầu
  // trước là có ngày bấm hoàn một dòng chi tay lại đi gỡ nhầm một hoá đơn sân.
  if ((db.manual || []).some((m) => m.id === row.id)) return { kind: 'manual', id: row.id }

  const tag = row.id.slice(0, 2)
  const id = row.id.slice(2)

  if (tag === 'du') {
    const x = (db.dues || []).find((y) => y.id === id)
    return x && dueState(x).paid > 0 ? { kind: 'due', id } : null
  }
  if (tag === 'sg') {
    const x = (db.sessionGuests || []).find((y) => y.id === id)
    return x && x.paid ? { kind: 'guest', id } : null
  }
  if (tag === 'aj') {
    // settleAdjust() nhận `key`, không nhận id — khoá của một dòng đối chiếu là (tháng,nhóm,người,chiều).
    const x = (db.adjustments || []).find((y) => y.id === id)
    return x && x.paid && x.settle === 'cash' ? { kind: 'adjust', key: x.key } : null
  }
  if (tag === 'cb' || tag === 'pu') {
    const kind = tag === 'cb' ? 'court' : 'shuttle'
    const x = (tag === 'cb' ? db.courtBills : db.purchases || []).find((y) => y.id === id)
    // Chỉ hoàn được khoản THÀNH VIÊN ỨNG rồi CLB đã trả lại: gỡ `repaidAt` là tiền chưa rời két.
    return x && !isVault(db, x.payerId) && x.repaidAt ? { kind: 'advance', advKind: kind, id } : null
  }
  return null
}

/** Số dư luỹ kế toàn bộ, không theo tháng. */
export const fundBalance = (db) => ledger(db).reduce((t2, r) => t2 + (r.dir === 'in' ? r.amount : -r.amount), 0)

/**
 * Số dư SỔ và số dư KHẢ DỤNG (T2). Sổ là tiền đang nằm trong két; khả dụng là phần chưa có chủ.
 *
 * Trừ đúng hai thứ, đều là tiền CLB đã hứa trả và sẽ rời két:
 *  - quỹ nợ thành viên ứng tiền (P5) — khoản chi chưa vào sổ nên số dư đang cao hơn thực tế
 *  - back tiền đã chốt, trả bằng tiền mặt, chưa trả
 *
 * KHÔNG trừ khách nợ hay quỹ tháng chưa đóng: đó là phải THU, tiền chưa vào chứ không sắp ra.
 * KHÔNG trừ khoản back `offset_next_dues`: nó trừ thẳng vào quỹ tháng sau, không đồng nào rời két.
 */
export function availableBalance(db) {
  const balance = fundBalance(db)
  const advance = advanceRows(db).filter((r) => !r.repaidAt).reduce((s, r) => s + r.amount, 0)
  // amount ÂM = quỹ nợ người (xem money.js: adjustRows) → đảo dấu để ra số phải trả.
  const back = (db.adjustments || [])
    .filter((x) => !x.paid && x.settle === 'cash' && x.amount < 0)
    .reduce((s, x) => s - x.amount, 0)
  const owed = advance + back
  return { balance, advance, back, owed, available: balance - owed }
}

/* ---------- đối chiếu quỹ (TASKS Phase 9 · P7) ---------- */

/** Miền giá trị của họ key `fund.rec.*` — i18n test đọc từ đây để thêm nghi vấn là đòi key. */
export const REC_KEYS = ['noBill', 'dueUnticked', 'guestUnpaid', 'backUnpaid', 'advanceUnpaid', 'soldBlank', 'opening']

/**
 * Đối chiếu quỹ. Thủ quỹ gõ số tiền THẬT đang giữ; app so với sổ và liệt kê **nghi vấn cụ thể**,
 * không chỉ báo lệch — mười một lỗi nhóm B đều im lặng, không có gì để so nên không ai phát hiện.
 *
 * `dir` là chiều nghi vấn đó **giải thích được**, đọc theo hướng tiền thật so với sổ:
 *   'in'  tiền đã vào két mà sổ chưa ghi thu  → giải thích được **đếm NHIỀU hơn sổ**
 *   'out' tiền đã rời két mà sổ chưa ghi chi  → giải thích được **đếm ÍT hơn sổ**
 * Không có `dir` thì nghi vấn nào cũng bị đẩy lên đầu bảng bất kể chiều, và câu gợi ý đầu tiên
 * thường là câu vô nghĩa ("quên tick quỹ tháng" trong khi quỹ đang THIẾU tiền).
 *
 * `amount = null` = biết có chuyện nhưng không ước lượng được thành tiền (sân bán để trống ô tiền,
 * chưa từng có hoá đơn sân nào để lấy làm mốc) — xếp cuối, đừng giả vờ khớp.
 *
 * KHÔNG tính tồn kho quy tiền vào đây: số cầu trong tủ không phải tiền mặt, cộng vào là đối chiếu
 * với sao kê ngân hàng lệch đúng bằng giá trị kho. Ô đó đứng riêng ở đầu màn Sổ quỹ.
 * KHÔNG có bảng `fund_reconciliations` (cắt 2026-08-24): đối chiếu là một phép trừ, tính lại từ
 * đầu mỗi lần cũng tức thì — lưu lại chỉ để "lần sau đối chiếu phần phát sinh" là nuôi một bảng
 * cho một tối ưu không ai cần.
 */
export function reconcile(db, counted) {
  const av = availableBalance(db)
  const book = av.balance
  const has = Number.isFinite(counted)
  const diff = has ? counted - book : 0
  const gap = Math.abs(diff)
  const out = []
  const add = (key, dir, amount, n, ids) => { if (n > 0) out.push({ key, dir, amount, n, ids: ids || null }) }

  // B1 · Quên nhập hoá đơn sân tháng — tiền đã chuyển cho chủ sân, sổ chưa ghi chi.
  // Mốc ước lượng lấy hoá đơn gần nhất; chưa từng có hoá đơn nào thì để null chứ không đoán 0.
  if (courtPayMode(db) === 'month') {
    const closed = monthSessions(db, db.month).filter((s) => s.status === 'closed')
    if (closed.length && !billsOf(db, db.month).length) {
      const prev = (db.courtBills || []).slice().sort((a, b) => (a.month < b.month ? 1 : -1))[0]
      add('noBill', 'out', prev ? prev.amount : null, 1, null)
    }
  }

  // B3 · Đã cầm tiền quỹ tháng nhưng quên tick: tiền trong két, sổ chưa thấy.
  // Quét MỌI tháng như số dư — quỹ tháng 6 quên tick vẫn đang làm sổ sai hôm nay.
  const remain = (db.dues || []).reduce((s, d) => s + dueState(d).remain, 0)
  add('dueUnticked', 'in', remain, (db.dues || []).filter((d) => dueState(d).remain > 0).length, null)

  // B9 · Quên tick khách đã trả — hay xảy ra nhất vì quản trò thu hộ rồi mới đưa lại.
  const unpaidG = (db.sessionGuests || []).filter((g) => !g.paid)
  add('guestUnpaid', 'in', unpaidG.reduce((s, g) => s + g.price, 0), unpaidG.length, null)

  // B10 · Đã trả back tiền mặt nhưng quên tick → tiền đã rời két, sổ vẫn đang giữ.
  add('backUnpaid', 'out', av.back,
    (db.adjustments || []).filter((x) => !x.paid && x.settle === 'cash' && x.amount < 0).length, null)

  // P5 · Đã trả lại người ứng tiền nhưng quên đánh dấu — cùng cơ chế với B10.
  const owedRows = advanceRows(db).filter((r) => !r.repaidAt)
  add('advanceUnpaid', 'out', av.advance, owedRows.length, null)

  // B4 · Sân đánh dấu đã bán mà ô tiền để trống, ở buổi ĐÃ CHỐT: khoản thu đó không có trong sổ.
  // Số tiền chính là thứ đang thiếu nên không ước lượng được — để null.
  const blank = (db.sessions || []).filter((s) => s.status === 'closed'
    && (s.courts || []).some((c) => c.sold && !(c.soldAmount > 0)))
  add('soldBlank', 'in', null, blank.length, blank.map((s) => s.id))

  // B11 · Số dư mang sang nhập sai lúc onboard thì lệch VĨNH VIỄN và không nhánh nào khác lộ ra.
  // Luôn xếp cuối: nó là thứ kiểm khi mọi giải thích khác đã loại trừ.
  add('opening', null, db.club.opening || 0, 1, null)

  // Sắp theo MỨC KHỚP: cùng chiều trước, rồi tới gần số lệch nhất. Chưa gõ số đếm thì xếp theo
  // tiền giảm dần — lúc đó bảng này là một checklist, không phải một lời giải thích.
  const rank = (s) => [
    s.key === 'opening' ? 2 : s.dir && has && diff !== 0 && s.dir !== (diff > 0 ? 'in' : 'out') ? 1 : 0,
    s.amount == null ? Number.MAX_SAFE_INTEGER : has ? Math.abs(s.amount - gap) : -s.amount,
  ]
  const suspects = out
    .map((s) => ({ ...s, match: has && gap > 0 && s.amount === gap }))
    .sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] })

  return { book, counted: has ? counted : null, diff, gap, suspects }
}

/** Thu/chi trong một tháng, KHÔNG tính dòng Số dư mang sang. */
export function monthFlow(db, m) {
  const l = ledger(db).filter((r) => monthOf(r.date) === m && r.cat !== CATS.opening)
  return {
    in: l.filter((r) => r.dir === 'in').reduce((t2, r) => t2 + r.amount, 0),
    out: l.filter((r) => r.dir === 'out').reduce((t2, r) => t2 + r.amount, 0),
  }
}

/** Gộp các dòng trùng ngày + hạng mục + chiều thành một dòng cha bung ra được. */
export function ledgerGrouped(db, month, { includeAdvances = false } = {}) {
  const rowsIn = ledger(db).filter((r) => monthOf(r.date) === month).reverse()
  const advances = []
  if (includeAdvances) {
    if (courtPayMode(db) === 'month') {
      ;(db.courtBills || []).forEach((b) => {
        if (b.month === month && !isVault(db, b.payerId) && !b.repaidAt) {
          const payer = payerName(db, b.payerId, b.payer)
          advances.push({
            id: 'cb_adv_' + b.id,
            date: b.date,
            dir: 'advance',
            cat: CATS.court,
            label: b.venue + ' · trọn ' + monthTxt(b.month).toLowerCase() + (b.note ? ' · ' + b.note : ''),
            amount: b.amount,
            by: payer,
            isAdvance: true,
            tooltip: `Thành viên ${payer} chi hộ CLB (quỹ chưa hoàn trả)`,
          })
        }
      })
    }
    ;(db.purchases || []).forEach((p) => {
      if (monthOf(p.date) === month && !isVault(db, p.payerId) && !p.repaidAt) {
        const payer = payerName(db, p.payerId, p.payer)
        const typeName = (db.shuttleTypes.find((x) => x.id === p.typeId) || { name: '' }).name
        advances.push({
          id: 'pu_adv_' + p.id,
          date: p.date,
          dir: 'advance',
          cat: CATS.shuttle,
          label: t('ledger.label.shuttle', { type: typeName, tubes: p.tubes, qty: p.qty }),
          amount: p.total,
          by: payer,
          isAdvance: true,
          tooltip: `Thành viên ${payer} chi hộ CLB (quỹ chưa hoàn trả)`,
        })
      }
    })
  }

  const allRows = rowsIn.concat(advances).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const map = {}
  const order = []
  allRows.forEach((r) => {
    // Tiền sân (court) hoặc khoản ứng giữ từng dòng riêng để hiện rõ tên sân/nội dung
    const k = (r.cat === CATS.court || r.dir === 'advance') ? r.id : r.date + '|' + r.cat + '|' + r.dir
    if (!map[k]) {
      map[k] = { key: k, date: r.date, cat: r.cat, dir: r.dir, isAdvance: !!r.isAdvance, tooltip: r.tooltip, items: [] }
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
