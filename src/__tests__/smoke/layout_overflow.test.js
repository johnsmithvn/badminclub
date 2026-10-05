// 🚨 TEST NÀY ĐỎ THÌ SỬA CODE, KHÔNG SỬA TEST CHO XANH. Đọc DESIGN.md §8.4 trước.
//
// Lỗi "tên dài đẩy lệch màn hình mobile" đã bị "sửa" 4 lần (20/9 → 24/9) mà lần nào cũng quay
// lại, vì gốc nằm ở lưới bọc ngoài chứ không ở dòng tên: cột `1fr` trần = minmax(auto, 1fr), phần
// `auto` bắt cột không được hẹp hơn độ rộng tối thiểu của nội dung — với tên `nowrap` là cả cái
// tên. Cột phình ra, thẻ trượt khỏi mép màn hình, ellipsis không kịp cắt.
//
// Test quét mọi giá trị cột viết dạng chuỗi trong src/ và cấm `fr` trần. Viết `minmax(0, 1fr)`.
// Ô chắc chắn không chứa chữ dài (icon, số cố định) được giữ `fr` trần nếu ghi `// layout-ok: <lý do>`
// cuối dòng — giống `// i18n-ok`, đừng rải bừa.
//
// Giới hạn: không thấy lưới không khai cột (`display: grid` + `gap` cũng là cột auto), không thấy
// giá trị ghép động từ biến số, không đo layout thật. Xanh không thay được việc thử một tên dài
// trên điện thoại.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SRC = path.resolve('src')
// components/ds là file sinh từ handoff, cấm sửa tay (DESIGN.md §1) — không tính.
const SKIP_DIRS = ['__tests__', path.join('components', 'ds')]

// Nợ cũ tại 2026-10-03: số chỗ `fr` trần còn lại theo từng file. CHỈ ĐƯỢC GIẢM.
// Sửa bớt ở file nào thì hạ số của file đó (về 0 thì xoá dòng) — test đỏ để nhắc việc này,
// nếu không thì chỗ trống sẽ bị code mới lấp vào mà không ai biết.
const KNOWN_DEBT = {
  'components/badges/BadgeDetailModal.jsx': 1,
  'components/challenge/AttachVideoModal.jsx': 2,
  'components/challenge/ChallengeDetailModal.jsx': 1,
  'components/challenge/EditScoreModal.jsx': 3,
  'components/challenge/MatchDetailModal.jsx': 1,
  // Chuyển nguyên từ ScoreModal (2) + CourtAssignmentTab (2) khi gom khối nhập tỉ số (2026-10-04) — không phải
  // nợ mới: tổng 4 → 2. Giữ nguyên giao diện theo quyết định của chủ dự án (đang không tràn).
  'components/challenge/ScorePicker.jsx': 2,
  'components/home/HomeMatchTab.jsx': 2,
  'components/home/personal/UpcomingSessionCard.jsx': 1,
  'components/layout/MobileFooterNav.jsx': 1,
  'components/leaderboard/PairH2HTab.jsx': 5,
  'components/profile/MemberProfileTab.jsx': 7,
  'components/session/CourtAssignmentTab.jsx': 3,
  'components/session/SessionMatchesTab.jsx': 2,
  'components/settings/tabs/AccessTab.jsx': 2,
  'components/settings/tabs/CourtsTab.jsx': 2,
  'components/settings/tabs/GeneralTab.jsx': 1,
  'components/settings/tabs/MoneyTab.jsx': 2,
  'components/settings/tabs/SchedulesTab.jsx': 2,
  'components/tournament/BracketBoard.jsx': 5,
  'components/tournament/FlowCanvas.jsx': 1,
  'components/tournament/InfoTab.jsx': 1,
  'components/tournament/MatchDialogs.jsx': 4,
  'components/tournament/OverviewTab.jsx': 5,
  'components/tournament/PairingTab.jsx': 3,
  'components/tournament/TourBits.jsx': 1,
  'components/tournament/TourHero.jsx': 1,
  'components/ui/index.jsx': 1,
  'pages/Clubs.jsx': 7,
  'pages/Dialogs.jsx': 9,
  'pages/Fund.jsx': 1,
  'pages/Home.jsx': 1,
  'pages/Matches.jsx': 4,
  'pages/Register.jsx': 2,
  'pages/SessionDetail.jsx': 14,
  'pages/Sessions.jsx': 2,
  // Lớp tiện ích `.mobile-grid-1col` — tại 2026-10-03 không component nào dùng, chỉ còn định nghĩa.
  'styles/tokens/base.css': 1,
}

// Chuỗi trông như danh sách cột: chỉ gồm 120px · 1fr · 20% · auto · minmax(..) · repeat(..) · ${..}
const TRACK_LIST = /^\s*(?:(?:\d*\.?\d+(?:px|fr|%|rem|em|ch|vw)|auto|min-content|max-content|(?:minmax|repeat|fit-content)\((?:[^()]|\([^()]*\))*\)|\$\{[^}]*\})\s*)+$/
// minmax có cận dưới cố định (0, 120px…) không nở theo nội dung — an toàn. Cận dưới auto thì không.
const SAFE_MINMAX = /minmax\(\s*(?!auto\b|min-content|max-content)[^,()]+,\s*\d*\.?\d+fr\s*\)/g
const BARE_FR = /(^|[\s(,])\d*\.?\d+fr\b/
const STRING = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g
const ROWS_ONLY = /grid-?[tT]emplate-?[rR]ows|grid-?[aA]uto-?[rR]ows/
const COLUMNS = /grid-?[tT]emplate-?[cC]olumns/

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.some((s) => p.endsWith(path.sep + s))) listFiles(p, out)
    } else if (/\.(jsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}

/** Mọi chỗ `fr` trần trong một file: [{ line, value }]. */
function bareFrIn(file) {
  const isCss = file.endsWith('.css')
  const hits = []
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\/\*.*?\*\//g, '')
    const head = line.trim()
    if (['//', '*', '/*', '{/*'].some((c) => head.startsWith(c))) return
    if (raw.includes('layout-ok')) return
    if (ROWS_ONLY.test(line) && !COLUMNS.test(line)) return
    const values = isCss
      ? [line.match(/grid-template-columns\s*:\s*([^;!]+)/)?.[1]].filter(Boolean)
      : [...line.matchAll(STRING)].map((m) => m[1] ?? m[2] ?? m[3])
    for (const value of values) {
      if (TRACK_LIST.test(value) && BARE_FR.test(value.replace(SAFE_MINMAX, ''))) {
        hits.push({ line: i + 1, value: value.trim() })
      }
    }
  })
  return hits
}

function scan() {
  const found = {}
  for (const file of listFiles(SRC)) {
    const hits = bareFrIn(file)
    if (hits.length) found[path.relative(SRC, file).split(path.sep).join('/')] = hits
  }
  return found
}

test('Bộ quét nhận đúng cột nguy hiểm và bỏ qua cột an toàn', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'))
  try {
    const f = path.join(tmp, 'x.jsx')
    fs.writeFileSync(f, [
      "a = { gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 356px' }", // 1: '1fr'
      "b = { gridTemplateColumns: 'repeat(2, 1fr)' }", // 2
      "c = { gridTemplateColumns: '40px 1.2fr auto' }", // 3
      "d = { gridTemplateColumns: 'minmax(auto, 1fr) 80px' }", // 4: cận dưới auto vẫn nở
      "e = { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }", // an toàn
      "f = { gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }", // an toàn
      "g = { gridTemplateColumns: 'repeat(5, 1fr)' } // layout-ok: chỉ có icon", // được miễn
      "h = { gridTemplateRows: '1fr auto' }", // hàng, không phải cột
      "{/* đừng dùng '1fr' ở đây */}", // comment một dòng
      "{/* comment nhiều dòng: cột '1fr' nở theo", // dòng mở của comment JSX nhiều dòng
      "i = { background: 'conic-gradient(from 210deg, #000, #fff)' }", // không phải danh sách cột
    ].join('\n'))
    assert.deepEqual(
      bareFrIn(f).map((h) => h.line),
      [1, 2, 3, 4],
      'Bộ quét sai thì cả test gác bên dưới thành vô nghĩa — nó phải bắt đủ 4 kiểu cột nở theo tên và tha các cột an toàn'
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("Không thêm cột `fr` trần mới — tên dài sẽ đẩy lệch màn hình mobile (DESIGN.md §8.4)", () => {
  const found = scan()
  const problems = []
  for (const [file, hits] of Object.entries(found)) {
    const allowed = KNOWN_DEBT[file] || 0
    if (hits.length > allowed) {
      problems.push(
        `${file}: ${hits.length} chỗ, nợ cũ cho phép ${allowed}\n` +
        hits.map((h) => `    dòng ${h.line}: '${h.value}' → viết minmax(0, …)`).join('\n')
      )
    }
  }
  assert.equal(
    problems.length, 0,
    'Có cột `fr` trần mới. `1fr` = minmax(auto, 1fr): cột nở theo tên dài nowrap và đẩy cả thẻ ra ' +
    'ngoài màn hình điện thoại — lỗi đã quay lại 4 lần vì kiểu cột này. Đổi sang minmax(0, 1fr); ' +
    'ô chắc chắn không có chữ dài thì ghi `// layout-ok: <lý do>`.\n' + problems.join('\n')
  )
})

test('Nợ cũ chỉ được giảm — sửa bớt thì hạ số trong KNOWN_DEBT', () => {
  const found = scan()
  const stale = Object.entries(KNOWN_DEBT)
    .filter(([file, n]) => (found[file]?.length || 0) < n)
    .map(([file, n]) => `${file}: còn ${found[file]?.length || 0}, KNOWN_DEBT ghi ${n}`)
  assert.equal(
    stale.length, 0,
    'Đã sửa bớt cột `fr` trần nhưng KNOWN_DEBT chưa hạ. Để nguyên thì chỗ trống đó sẽ bị code mới ' +
    'lấp vào mà test vẫn xanh. Hạ số (về 0 thì xoá dòng):\n' + stale.join('\n')
  )
})
