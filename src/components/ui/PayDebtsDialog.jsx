// Popup "chuyển tiền cho CLB" của luồng thành viên tự khai đã trả (migration 0018).
// Dùng ở hai nơi: thẻ Công nợ của tôi ở Trang chủ, và hàng của chính mình ở màn Công nợ.

import { useState } from 'react'
import { QrModal } from '#components/ui/QrModal.jsx'
import { getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { fmt, normalizeText } from '#lib/money.js'
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
export function PayDebtsDialog({ items, memo, onClose }) {
  const { db, a } = useApp()
  const [sending, setSending] = useState(false)

  const list = items || []
  if (!list.length) return null

  const bank = (db.club && db.club.bank) || {}
  const total = list.reduce((n, x) => n + x.amount, 0)
  const memoTxt = normalizeText(memo).toUpperCase().slice(0, 25)

  const submit = async () => {
    setSending(true)
    try {
      await a.claimPayments(list)
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
