// Xử lý đọc và sinh dữ liệu CSV cho danh sách thành viên.
// Hỗ trợ RFC 4180, dấu phẩy/chấm phẩy/tab, UTF-8 BOM, nhận diện cột linh hoạt.

/**
 * Phân tích chuỗi CSV thô thành mảng các mảng chuỗi string[][].
 * Tự động loại bỏ BOM UTF-8 và nhận diện dấu phân cách (phẩy, chấm phẩy, tab).
 */
export function parseCsvRows(text) {
  if (!text || typeof text !== 'string') return []

  // Bỏ UTF-8 BOM nếu có
  let s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  // Đoán dấu phân cách từ dòng đầu tiên
  const firstLine = s.split(/\r?\n/)[0] || ''
  let delimiter = ','
  const commas = (firstLine.match(/,/g) || []).length
  const semis = (firstLine.match(/;/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  if (semis > commas && semis >= tabs) delimiter = ';'
  else if (tabs > commas && tabs > semis) delimiter = '\t'

  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false
  let i = 0
  const len = s.length

  while (i < len) {
    const char = s[i]

    if (inQuotes) {
      if (char === '"') {
        // Thoát ngoặc kép: ""
        if (i + 1 < len && s[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      }
      if (char === delimiter) {
        currentRow.push(currentField.trim())
        currentField = ''
        i++
        continue
      }
      if (char === '\r') {
        if (i + 1 < len && s[i + 1] === '\n') i++
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      }
      if (char === '\n') {
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      }
      currentField += char
      i++
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) rows.push(currentRow)
  }

  return rows
}

/** Chuẩn hóa tiêu đề cột để nhận diện linh hoạt. */
export function normHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export const TEMPLATE_HEADERS = [
  'Họ và tên',
  'Số điện thoại',
  'Giới tính',
  'Trình độ',
  'Nhóm cố định',
]

/**
 * Hai cột THÊM, không bắt buộc, chỉ được đứng SAU 5 cột chuẩn.
 *
 * Cố ý không chèn vào giữa: mọi file CSV người dùng đang có đều theo đúng thứ tự 5 cột trên, đổi
 * thứ tự là những file đó bị từ chối hàng loạt mà không ai hiểu vì sao. Thêm ở cuối thì file cũ
 * chạy y như trước, file mới mang thêm được hai trường.
 *
 * "Họ và tên" ở cột 1 là TÊN HIỂN THỊ (`club_members.name`) — giữ nguyên nghĩa cũ, đừng đổi.
 */
export const OPTIONAL_HEADERS = [
  'Tên đầy đủ',
  'Email',
]

/**
 * Kiểm tra header có khớp chuẩn template hay không.
 * Trả về { ok: true } hoặc { ok: false, error: '...' }
 */
export function validateHeaders(headerRow) {
  if (!headerRow || headerRow.length === 0) {
    return { ok: false, error: 'File CSV rỗng hoặc không có dòng tiêu đề.' }
  }

  const expectedNorms = TEMPLATE_HEADERS.map(normHeader)
  const actualNorms = headerRow.map(normHeader)
  const optionalNorms = OPTIONAL_HEADERS.map(normHeader)

  // 5 cột đầu phải khớp đúng thứ tự; thiếu cột thì `actualNorms[i]` là undefined → không khớp.
  const baseOk = expectedNorms.every((exp, i) => exp === actualNorms[i])
  // Cột dư chỉ được là cột tuỳ chọn, mỗi loại một lần.
  const extra = actualNorms.slice(expectedNorms.length)
  const extraOk = extra.every((h, i) => optionalNorms.includes(h) && extra.indexOf(h) === i)

  if (!baseOk || !extraOk) {
    return {
      ok: false,
      error: `Tên cột không đúng mẫu template. Yêu cầu chuẩn ${TEMPLATE_HEADERS.length} cột: ${TEMPLATE_HEADERS.join(' · ')}`
        + `. Có thể thêm ở CUỐI 2 cột không bắt buộc: ${OPTIONAL_HEADERS.join(' · ')}`,
    }
  }

  return { ok: true }
}

/** Nhận diện vai trò của từng cột dựa trên tên header. */
export function detectColumns(headerRow) {
  const mapping = {
    nameIdx: -1,
    phoneIdx: -1,
    genderIdx: -1,
    levelIdx: -1,
    groupIdx: -1,
  }

  headerRow.forEach((h, idx) => {
    const n = normHeader(h)
    if (mapping.nameIdx < 0 && (n.includes('ten') || n.includes('name') || n.includes('hoten'))) {
      mapping.nameIdx = idx
    } else if (mapping.phoneIdx < 0 && (n.includes('sdt') || n.includes('phone') || n.includes('dienthoai') || n.includes('tel') || n.includes('mobile'))) {
      mapping.phoneIdx = idx
    } else if (mapping.genderIdx < 0 && (n.includes('gioitinh') || n.includes('gender') || n.includes('sex') || n.includes('phai'))) {
      mapping.genderIdx = idx
    } else if (mapping.levelIdx < 0 && (n.includes('trinhdo') || n.includes('level') || n.includes('rank') || n.includes('trinh'))) {
      mapping.levelIdx = idx
    } else if (mapping.groupIdx < 0 && (n.includes('nhom') || n.includes('group') || n.includes('ca'))) {
      mapping.groupIdx = idx
    }
  })

  // Nếu không nhận diện được cột tên nhưng có cột đầu tiên, mặc định cột đầu là Tên
  if (mapping.nameIdx < 0 && headerRow.length > 0) {
    mapping.nameIdx = 0
  }

  return mapping
}

/** Chuẩn hóa giới tính về 'nam' | 'nu'. */
export function normalizeGender(val) {
  const s = normHeader(val)
  if (['nu', 'female', 'f', 'gai', 'girl'].includes(s)) return 'nu'
  return 'nam'
}

/** Khớp trình độ với danh sách level của CLB. */
export function normalizeLevel(val, levels = []) {
  if (!val) return levels[0] || 'TB-'
  const clean = String(val).trim().toUpperCase()
  const found = levels.find((l) => l.toUpperCase() === clean)
  if (found) return found

  // Khớp theo dạng không dấu (ví dụ "kha" -> "Khá")
  const normVal = normHeader(val)
  const foundNorm = levels.find((l) => normHeader(l) === normVal)
  if (foundNorm) return foundNorm

  // Khớp gần đúng (loại bỏ dấu cách/gạch)
  const normApprox = clean.replace(/[^A-Z0-9]/g, '')
  const approx = levels.find((l) => l.toUpperCase().replace(/[^A-Z0-9]/g, '') === normApprox)
  if (approx) return approx

  return levels[0] || 'TB-'
}

/** Khớp nhóm cố định với danh sách groups của CLB (hỗ trợ 1 nhóm, nhiều nhóm hoặc không cố định). */
export function normalizeGroup(val, groups = []) {
  if (!val) return { groupId: null, groupIds: [], groupName: '' }
  const clean = String(val).trim()
  const normClean = normHeader(clean)

  if (['khong', 'dile', 'le', 'none', 'khongcodinh', 'vanglai'].includes(normClean)) {
    return { groupId: null, groupIds: [], groupName: '' }
  }

  // Tách các nhóm bằng dấu phẩy, chấm phẩy, dấu cộng
  const parts = clean.split(/[,;+/]+/).map((s) => s.trim()).filter(Boolean)
  const matched = []

  parts.forEach((p) => {
    const normP = normHeader(p)
    const g = groups.find((x) =>
      x.id === p ||
      normHeader(x.name) === normP ||
      (x.short && normHeader(x.short) === normP) ||
      normHeader(x.name).includes(normP)
    )
    if (g && !matched.some((m) => m.id === g.id)) {
      matched.push(g)
    }
  })

  if (matched.length > 0) {
    return {
      groupId: matched[0].id,
      groupIds: matched.map((m) => m.id),
      groupName: matched.map((m) => m.short || m.name).join(' + '),
    }
  }

  const found = groups.find((g) =>
    g.id === clean ||
    normHeader(g.name) === normClean ||
    (g.short && normHeader(g.short) === normClean)
  )

  if (found) {
    return { groupId: found.id, groupIds: [found.id], groupName: found.short || found.name }
  }
  return { groupId: null, groupIds: [], groupName: clean }
}

/**
 * Kiểm tra tính hợp lệ của 1 dòng thành viên (dùng cho cả lúc parse và lúc user chỉnh sửa trực tiếp).
 */
export function validateMemberRow(r, _clubLevels = [], phoneMap = new Map()) {
  const name = (r.name || '').trim()
  const cleanPhone = (r.phone || '').replace(/\s+/g, '')
  const phoneDigits = cleanPhone.replace(/\D/g, '')

  let status = 'valid'
  let message = ''

  if (!name || name.length < 2) {
    status = 'error'
    message = 'Bắt buộc điền họ tên'
  } else if (phoneDigits && phoneMap.has(phoneDigits) && phoneMap.get(phoneDigits) !== r.id) {
    status = 'warn'
    message = `Trùng SĐT với ${phoneMap.get(phoneDigits)}`
  }

  return {
    ...r,
    name,
    phone: cleanPhone,
    status,
    message,
  }
}

/**
 * Xử lý toàn bộ CSV văn bản thành danh sách thành viên sẵn sàng import.
 */
export function parseAndValidateMembers(csvText, clubLevels = [], clubGroups = [], existingMembers = []) {
  const rows = parseCsvRows(csvText)
  if (!rows.length) {
    return { rows: [], headerError: null, summary: { total: 0, validCount: 0, warnCount: 0, errorCount: 0 } }
  }

  const header = rows[0]
  const headerCheck = validateHeaders(header)
  if (!headerCheck.ok) {
    return {
      rows: [],
      headerError: headerCheck.error,
      summary: { total: 0, validCount: 0, warnCount: 0, errorCount: 0 },
    }
  }

  // Header đã khớp chuẩn template: 0: Tên, 1: SĐT, 2: Giới tính, 3: Trình độ, 4: Nhóm
  const dataRows = rows.slice(1)

  const phoneMap = new Map()
  existingMembers.forEach((m) => {
    if (m.phone) phoneMap.set(m.phone.replace(/\D/g, ''), m.name)
  })

  let validCount = 0
  let warnCount = 0
  let errorCount = 0

  // Hai cột tuỳ chọn tra theo TÊN chứ không theo vị trí: người dùng có thể đưa vào một cột, hai
  // cột, hoặc đảo thứ tự giữa chúng — `validateHeaders` đã chặn mọi tên lạ trước khi tới đây.
  const optIdx = (label) => header.findIndex((h) => normHeader(h) === normHeader(label))
  const fullIdx = optIdx(OPTIONAL_HEADERS[0])
  const emailIdx = optIdx(OPTIONAL_HEADERS[1])

  const parsed = dataRows.map((row, idx) => {
    const rawName = row[0] || ''
    const rawPhone = row[1] || ''
    const rawGender = row[2] || ''
    const rawLevel = row[3] || ''
    const rawGroup = row[4] || ''

    const { groupId, groupIds, groupName } = normalizeGroup(rawGroup, clubGroups)

    const baseRow = {
      id: 'row_' + idx,
      name: rawName,
      fullName: fullIdx >= 0 ? String(row[fullIdx] || '').trim() : '',
      email: emailIdx >= 0 ? String(row[emailIdx] || '').trim() : '',
      phone: rawPhone,
      gender: normalizeGender(rawGender),
      level: normalizeLevel(rawLevel, clubLevels),
      groupId: groupId || '',
      groupIds: groupIds || (groupId ? [groupId] : []),
      groupName: groupName || '',
    }

    const validated = validateMemberRow(baseRow, clubLevels, phoneMap)
    if (validated.status === 'error') errorCount++
    else if (validated.status === 'warn') warnCount++
    else validCount++

    return validated
  })

  return {
    rows: parsed,
    headerError: null,
    summary: {
      total: parsed.length,
      validCount,
      warnCount,
      errorCount,
    },
  }
}

/** Sinh chuỗi CSV mẫu đính kèm UTF-8 BOM. */
export function generateSampleCsv(levels = [], groups = []) {
  const g1 = groups[0] ? (groups[0].short || groups[0].name) : 'T3-T5'
  const g2 = groups[1] ? (groups[1].short || groups[1].name) : 'Chủ nhật'
  const l1 = levels[0] || 'Newbie'
  const l2 = levels[1] || 'TB-'
  const l3 = levels[2] || 'TB'

  // File mẫu in cả hai cột tuỳ chọn để người dùng biết là có — bỏ hai cột đó đi vẫn nhập được.
  const lines = [
    TEMPLATE_HEADERS.join(',') + ',' + OPTIONAL_HEADERS.join(','),
    `Nguyễn Văn An,0912345678,Nam,${l2},${g1},Nguyễn Văn An,an@example.com`,
    `Trần Thị Bích,0987654321,Nữ,${l1},${g2},Trần Thị Bích,`,
    `Lê Hoàng Minh,0903112233,Nam,${l3},,,`,
  ]

  return '\uFEFF' + lines.join('\r\n')
}
