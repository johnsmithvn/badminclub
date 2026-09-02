// Tiện ích sinh mã VietQR chuẩn và tra cứu thông tin ngân hàng.
import banks from '#config/banks.json' with { type: 'json' }

export { banks }

/**
 * Tìm ngân hàng theo mã hoặc tên viết tắt.
 */
export function findBank(query) {
  if (!query) return null
  const q = String(query).trim().toLowerCase()
  return banks.find((b) =>
    b.code.toLowerCase() === q ||
    b.shortName.toLowerCase() === q ||
    b.bin === q ||
    b.name.toLowerCase().includes(q)
  ) || null
}

/**
 * Sinh URL mã QR VietQR chuẩn.
 * @param {object} params
 * @param {string} params.bankCode Mã ngân hàng hoặc BIN (ví dụ: 'MB', 'VCB', '970422')
 * @param {string} params.accountNo Số tài khoản
 * @param {string} [params.accountHolder] Tên chủ tài khoản
 * @param {number} [params.amount] Số tiền (tuỳ chọn)
 * @param {string} [params.memo] Nội dung chuyển khoản (tuỳ chọn)
 * @param {string} [params.template] Template VietQR: 'compact2' | 'compact' | 'qr_only' | 'print'
 * @returns {string|null} URL ảnh QR
 */
export function getVietQrUrl({ bankCode, accountNo, accountHolder = '', amount, memo = '', template = 'compact2' } = {}) {
  if (!bankCode || !accountNo) return null
  const bank = findBank(bankCode)
  const binOrCode = bank ? bank.bin : bankCode

  const cleanNo = String(accountNo).replace(/\s+/g, '')
  if (!cleanNo) return null

  let url = `https://img.vietqr.io/image/${binOrCode}-${cleanNo}-${template}.png`
  const params = []

  if (amount && amount > 0) {
    params.push(`amount=${encodeURIComponent(amount)}`)
  }
  if (memo) {
    params.push(`addInfo=${encodeURIComponent(memo)}`)
  }
  if (accountHolder) {
    params.push(`accountName=${encodeURIComponent(accountHolder.toUpperCase())}`)
  }

  if (params.length > 0) {
    url += '?' + params.join('&')
  }

  return url
}
