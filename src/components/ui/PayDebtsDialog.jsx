// Popup "chuyển tiền cho CLB" của luồng thành viên tự khai đã trả (migration 0018).
// Dùng ở hai nơi: thẻ Công nợ của tôi ở Trang chủ, và hàng của chính mình ở màn Công nợ.

import { useState } from 'react'
import { QrModal } from '#components/ui/QrModal.jsx'
import { getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { fmt, myDebts, normalizeText } from '#lib/money.js'
import { t } from '#i18n'

/**
 * `items` là các khoản lấy từ `money.js: myDebts()` — mỗi khoản có `{ kind, id, amount }`.
 * Bấm xác nhận KHÔNG trừ nợ: nó gọi `claimPayments` để chuyển khoản sang trạng thái chờ duyệt.
 * Người giữ quỹ mới là người bật cờ `paid`, bằng đúng nút tick đang có.
 *
 * `memo` là nội dung chuyển khoản điền sẵn vào app ngân hàng — thủ quỹ đối chiếu sao kê bằng
 * cái đó. App KHÔNG lưu và không đọc lại nó.
 *
 * Bỏ dấu + viết hoa + cắt 25 ký tự trước khi nhét vào QR: `addInfo` của VietQR là tag 62-08 của
 * EMVCo, trần 25 ký tự, và nhiều app ngân hàng nuốt hoặc làm hỏng chữ có dấu. Hiện ĐÚNG chuỗi
 * sắp đi vào QR chứ không hiện tên gốc — người ta so cái nhìn thấy với cái app ngân hàng hiện.
 */
const dm = (iso) => String(iso || '').slice(8, 10) + '/' + String(iso || '').slice(5, 7)

/**
 * Nội dung chuyển khoản — nói ĐÚNG cái đang trả.
 *
 * Sao kê ngân hàng vốn đã có sẵn tên người gửi, số tiền và giờ; thứ thủ quỹ thiếu là "khoản
 * nào". Nên memo mô tả khoản, không lặp lại tên người.
 *
 * Trần 25 ký tự (tag 62-08 của EMVCo) và bỏ dấu: nhiều app ngân hàng nuốt hoặc làm hỏng chữ
 * có dấu, sao kê ra chuỗi vỡ thì đối chiếu bằng gì.
 */
function memoOf(picked, open, db) {
  const d = dm(db.today)
  if (picked.length > 1) {
    // Trả hết những gì đang treo thì nói hẳn là tất toán — thủ quỹ khỏi cộng tay từng khoản.
    return picked.length >= open.length
      ? t('bank.claimMemo.all', { d })
      : t('bank.claimMemo.some', { n: picked.length, d })
  }
  const x = picked[0]
  if (!x) return ''
  if (x.kind === 'dues') return t('bank.claimMemo.dues', { m: String(x.date).slice(5, 7), d })
  // Buổi lẻ lấy NGÀY BUỔI chứ không phải ngày chuyển: đó mới là thứ đối chiếu được với lịch.
  if (x.kind === 'guest') return t('bank.claimMemo.guest', { d: dm(x.date) })
  return t('bank.claimMemo.adjust', { d })
}

export function PayDebtsDialog({ items, onClose }) {
  const { db, a } = useApp()
  const [sending, setSending] = useState(false)

  const list = items || []
  if (!list.length) return null

  const bank = (db.club && db.club.bank) || {}
  // Dựng lại từ nguồn thay vì tin dữ liệu chỗ gọi truyền vào: hai màn gọi component này bằng
  // hai hình khác nhau, và chỉ ở đây mới biết người đó CÒN treo bao nhiêu khoản để nói
  // "tất toán hết" hay "trả 2 khoản".
  const open = myDebts(db, db.month).filter((x) => !x.claimedAt)
  const picked = open.filter((r) => list.some((x) => x.kind === r.kind && x.id === r.id))
  const rows = picked.length ? picked : list
  const total = rows.reduce((n, x) => n + x.amount, 0)
  const memoTxt = normalizeText(memoOf(rows, open, db)).toUpperCase().slice(0, 25)

  const submit = async () => {
    setSending(true)
    try {
      await a.claimPayments(rows)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <QrModal
      title={t('home.myDebt.qrTitle')}
      qrUrl={getVietQrUrl({
        bankCode: bank.bank,
        accountNo: bank.no,
        accountHolder: bank.holder,
        amount: total,
        memo: memoTxt,
      })}
      bankName={bank.bank}
      accountNo={bank.no}
      accountHolder={bank.holder}
      amount={fmt(total)}
      memo={memoTxt}
      confirming={sending}
      confirmLabel={t('home.myDebt.confirmSent')}
      onConfirm={submit}
      onClose={onClose}
    />
  )
}
