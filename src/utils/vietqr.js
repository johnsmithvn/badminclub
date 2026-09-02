// Tiện ích sinh mã VietQR chuẩn, tra cứu thông tin ngân hàng và bóc tách dữ liệu từ ảnh QR.
import banks from '#config/banks.json' with { type: 'json' }

export { banks }

/**
 * Tìm ngân hàng theo mã, tên viết tắt, mã BIN hoặc tên đầy đủ.
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

/**
 * Bóc tách thông tin tài khoản ngân hàng từ chuỗi mã VietQR (chuẩn EMVCo / Napas 247).
 * @param {string} rawText Chuỗi payload đọc từ mã QR
 * @returns {object|null} { bankName, bankCode, bankBin, bankNo, bankHolder, amount, memo }
 */
export function parseVietQr(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const text = rawText.trim()

  // 1. Nếu là đường dẫn URL VietQR (ví dụ: https://img.vietqr.io/image/970422-0912345678-compact2.png?...)
  if (text.includes('vietqr.io/image/')) {
    try {
      const match = text.match(/image\/([A-Za-z0-9]+)-([A-Za-z0-9]+)/)
      if (match) {
        const binOrCode = match[1]
        const bankNo = match[2]
        const bank = findBank(binOrCode)
        const urlObj = new URL(text.startsWith('http') ? text : `https://${text}`)
        const accountHolder = urlObj.searchParams.get('accountName') || ''
        const memo = urlObj.searchParams.get('addInfo') || ''
        const amount = urlObj.searchParams.get('amount') || ''

        return {
          bankName: bank ? bank.shortName : binOrCode,
          bankCode: bank ? bank.code : '',
          bankBin: bank ? bank.bin : binOrCode,
          bankNo,
          bankHolder: decodeURIComponent(accountHolder).toUpperCase(),
          amount: amount ? Number(amount) : undefined,
          memo: decodeURIComponent(memo),
        }
      }
    } catch {
      // Bỏ qua nếu parse url lỗi
    }
  }

  // 2. Phân tích chuỗi chuẩn EMVCo (TLVs: Tag 2 ký tự, Length 2 ký tự, Value)
  // Tag 38: Merchant Account Information (VietQR Napas)
  // Tag 54: Amount
  // Tag 59: Merchant Name (Tên chủ TK)
  // Tag 62: Additional Data (Nội dung CK)
  let index = 0
  let bankBin = null
  let bankNo = null
  let bankHolder = null
  let amount = null
  let memo = null

  while (index < text.length) {
    const tag = text.slice(index, index + 2)
    const lenStr = text.slice(index + 2, index + 4)
    const len = parseInt(lenStr, 10)
    if (isNaN(len) || len <= 0) break

    const val = text.slice(index + 4, index + 4 + len)
    index += 4 + len

    if (tag === '38') {
      // Sub-TLVs bên trong Tag 38
      let sIdx = 0
      while (sIdx < val.length) {
        const sTag = val.slice(sIdx, sIdx + 2)
        const sLen = parseInt(val.slice(sIdx + 2, sIdx + 4), 10)
        if (isNaN(sLen) || sLen <= 0) break
        const sVal = val.slice(sIdx + 4, sIdx + 4 + sLen)
        sIdx += 4 + sLen

        if (sTag === '01') {
          // Beneficiary info: Sub-sub tag 00 = BIN, 01 = Số tài khoản
          let bIdx = 0
          while (bIdx < sVal.length) {
            const bTag = sVal.slice(bIdx, bIdx + 2)
            const bLen = parseInt(sVal.slice(bIdx + 2, bIdx + 4), 10)
            if (isNaN(bLen) || bLen <= 0) break
            const bVal = sVal.slice(bIdx + 4, bIdx + 4 + bLen)
            bIdx += 4 + bLen
            if (bTag === '00') bankBin = bVal
            if (bTag === '01') bankNo = bVal
          }
        }
      }
    } else if (tag === '54') {
      amount = Number(val) || null
    } else if (tag === '59') {
      bankHolder = val
    } else if (tag === '62') {
      // Additional Data: sub-tag 08 là nội dung CK
      let aIdx = 0
      while (aIdx < val.length) {
        const aTag = val.slice(aIdx, aIdx + 2)
        const aLen = parseInt(val.slice(aIdx + 2, aIdx + 4), 10)
        if (isNaN(aLen) || aLen <= 0) break
        const aVal = val.slice(aIdx + 4, aIdx + 4 + aLen)
        aIdx += 4 + aLen
        if (aTag === '08') memo = aVal
      }
    }
  }

  if (bankBin || bankNo) {
    const bank = findBank(bankBin)
    return {
      bankName: bank ? bank.shortName : (bankBin || ''),
      bankCode: bank ? bank.code : '',
      bankBin: bank ? bank.bin : (bankBin || ''),
      bankNo: bankNo || '',
      bankHolder: bankHolder ? bankHolder.trim().toUpperCase() : '',
      amount: amount || undefined,
      memo: memo || '',
    }
  }

  return null
}

/**
 * Quét và giải mã mã QR trực tiếp từ file ảnh trên trình duyệt.
 * Sử dụng BarcodeDetector API tích hợp sẵn của trình duyệt.
 *
 * @param {File|Blob} file
 * @returns {Promise<string|null>} Chuỗi raw payload đọc được từ QR
 */
export async function scanQrCodeFromImage(file) {
  if (!file) return null

  // 1. Kiểm tra BarcodeDetector API (Chrome, Edge, Safari 17+, Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      let imageSource = null

      if (typeof createImageBitmap === 'function') {
        try {
          imageSource = await createImageBitmap(file)
        } catch {
          // Bỏ qua
        }
      }

      if (!imageSource) {
        imageSource = await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = URL.createObjectURL(file)
        })
      }

      const barcodes = await detector.detect(imageSource)
      if (barcodes && barcodes.length > 0) {
        return barcodes[0].rawValue || null
      }
    } catch {
      // Bỏ qua nếu trình duyệt không hỗ trợ detector
    }
  }

  return null
}
