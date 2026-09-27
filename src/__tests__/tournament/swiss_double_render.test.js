// Giao diện thể thức Thụy Sĩ + Nhánh thắng/nhánh thua render bằng component thật — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, load, fakeActions } from './_render.js'
import { db, tour } from './fixture.js'
import { buildSwissStart } from '#lib/tournament/swiss.js'
import { buildDoubleElim } from '#lib/tournament/doubleElim.js'
import { applyCommit } from '#lib/tournament/advance.js'
import { stageGroups } from '#lib/tournament/standings.js'

const { GroupBoard, DoubleBoard } = await load('#components/tournament/BracketBoard.jsx')
const { StageActions, BracketSetup } = await load('#pages/TournamentBracket.jsx')
const { default: BracketBoard } = await load('#components/tournament/BracketBoard.jsx')
const { buildKnockout } = await import('#lib/tournament/bracket.js')
const { koRounds } = await import('#lib/tournament/bracketView.js')
const { html } = await import('./_render.js')
const { default: OverviewTab } = await load('#components/tournament/OverviewTab.jsx')
const { default: FlowCanvas } = await load('#components/tournament/FlowCanvas.jsx')

const noop = () => {}
const R21 = { sets: 1, points: 21, winBy2: false, cap: 21 }
const TEAMS = ['tA', 'tB', 'tC', 'tD']
// Nội dung đơn 4 người (mỗi đội 1 người, đủ người) — tên lấy từ fixture: An, Bình, Cúc, Dung.
const base = (p) => {
  const t0 = tour()
  return tour({
    status: 'running',
    events: [{ ...t0.events[0], teamSize: 1, status: 'running' }],
    entries: ['r1', 'r2', 'r3', 'r4'].map((registrationId) => ({ eventId: 'e-md', registrationId })),
    teams: TEAMS.map((id) => ({ id, eventId: 'e-md' })),
    teamPlayers: TEAMS.map((id, i) => ({ teamId: id, eventId: 'e-md', registrationId: 'r' + (i + 1) })),
    ...p,
  })
}
// Đánh mọi trận sẵn sàng mà `pick` chọn được đội thắng (null = để đó).
const playAll = (ms, pick = () => 'A') => {
  const next = () => ms.find((x) => x.status === 'ready' && pick(x))
  for (let m = next(); m; m = next()) {
    const w = pick(m)
    const res = applyCommit(ms, { matchId: m.id, sets: [w === 'A' ? [21, 10] : [10, 21]], winner: w })
    assert.equal(res.error, null)
    ms = res.matches
  }
  return ms
}

function swissTour(played) {
  const stage = { id: 's1', eventId: 'e-md', seq: 1, type: 'swiss', status: 'running', config: { rounds: 3, seeding: 'seed' }, matchRule: R21, ruleOverrides: {} }
  let k = 0
  const { group, matches } = buildSwissStart({ stage, entrants: TEAMS.map((id, i) => ({ id, seed: i + 1 })), newId: () => 'w' + ++k })
  const ms = (played ? playAll(matches) : matches).map((m) => ({ ...m, eventId: 'e-md' }))
  return base({
    stages: [stage], groups: [{ id: group.id, stageId: 's1', label: 'A', seq: 1 }],
    groupTeams: group.teams.map((x) => ({ groupId: group.id, teamId: x.teamId, seedInGroup: x.seedInGroup, finalRank: null })),
    matches: ms,
  })
}

test('Thụy Sĩ: một bảng xếp hạng có cột ĐIỂM + BH, tab theo vòng; đánh xong vòng thì có nút "Tạo vòng 2"', () => {
  const tr = swissTour(false)
  const props = { groups: stageGroups(tr, 's1'), tour: tr, db, canEdit: true, locked: false, stage: tr.stages[0], manual: {}, onReorder: noop, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop }
  const s = text(GroupBoard, props)
  assert.match(s, /Bảng xếp hạng/)
  assert.match(s, /ĐIỂM/)
  assert.match(s, /BH/)
  assert.match(s, /Vòng 1/)
  assert.doesNotMatch(s, /Bảng A/, 'Thụy Sĩ không chia bảng')
  const act = (x) => text(StageActions, { tour: x, stage: x.stages[0], groups: stageGroups(x, 's1'), a: fakeActions(), canEdit: true, manual: {}, onClosed: noop })
  assert.match(act(tr), /Vòng 1\/3.*Đánh xong vòng 1 rồi tạo vòng sau/)
  const done = swissTour(true)
  assert.match(act(done), /Tạo vòng 2/)
  assert.doesNotMatch(act(done), /Chốt giai đoạn/, 'chưa đủ 3 vòng thì chưa chốt')
})

function deTour(pick) {
  const stage = { id: 's1', eventId: 'e-md', seq: 1, type: 'knockout', status: 'running', config: { bracket: 'double', seeding: 'seed' }, matchRule: R21, ruleOverrides: { final: R21 } }
  let k = 0
  let ms = buildDoubleElim({ stage, entrants: TEAMS.map((id, i) => ({ id, seed: i + 1 })), newId: () => 'd' + ++k }).map((m) => ({ ...m, eventId: 'e-md' }))
  if (pick) ms = playAll(ms, pick)
  return base({ stages: [stage], matches: ms })
}
const dboard = (tr) => text(DoubleBoard, { stage: tr.stages[0], tour: tr, db, canEdit: true, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop, onSwap: null })

test('Nhánh thắng/thua: tab nhánh thắng trước; nhánh thắng xong thì mở tab nhánh thua + chung kết tổng', () => {
  const s = dboard(deTour())
  assert.match(s, /Nhánh thắng.*Nhánh thua & Chung kết/)
  assert.match(s, /Bán kết/)
  assert.match(s, /CK nhánh thắng/)
  assert.doesNotMatch(s, /Vô địch/, 'tab nhánh thắng không có cột vô địch')

  // Chỉ đánh nhánh thắng (bán kết + chung kết nhánh thắng) → mặc định mở tab nhánh thua.
  const wbOnly = deTour((m) => (['sf', 'wf'].includes(m.roundKind) ? 'A' : null))
  const t2 = dboard({ ...wbOnly, matches: wbOnly.matches })
  assert.match(t2, /Nhánh thua · Vòng 1/)
  assert.match(t2, /Chung kết nhánh thua/)
  assert.match(t2, /Chung kết tổng/)
  assert.match(t2, /Đội nhánh thua thắng → đá thêm trận 2/)
  assert.match(t2, /Thắng trận NT1\.1/, 'ô chờ nói rõ đội từ trận nào tới')
  assert.match(t2, /Chờ chung kết tổng/)

  const all = deTour(() => 'A')
  assert.match(dboard(all), /Nhà vô địch Nguyễn Văn An/)
})

test('Tổng quan: nhánh thắng/thua chưa có lịch hiện xem trước 2 phần; Thụy Sĩ hiện bảng xếp hạng + tiến độ vòng', () => {
  const pending = deTour()
  const pv = { ...pending, stages: [{ ...pending.stages[0], status: 'pending' }], matches: [] }
  const s = text(OverviewTab, { tour: pv, db, a: fakeActions(), event: pv.events[0], onGo: noop, canEdit: true, isMobile: false, onOpenBracket: noop })
  assert.match(s, /Nhánh thắng/)
  assert.match(s, /Nhánh thua/)
  assert.match(s, /Chung kết tổng/)
  assert.doesNotMatch(s, /Điền tự động khi vòng bảng xong/, 'không có vòng bảng nào để chờ')

  const sw = swissTour(true)
  const s2 = text(OverviewTab, { tour: sw, db, a: fakeActions(), event: sw.events[0], onGo: noop, canEdit: true, isMobile: false, onOpenBracket: noop })
  assert.match(s2, /Bảng xếp hạng/)
  assert.match(s2, /Vòng 1\/3/)
})

test('Sơ đồ thi đấu: khối Thụy Sĩ (ô từng vòng + luật ghép) và khối 2 nhánh không vỡ', () => {
  const st = (p) => ({ id: 's1', eventId: 'e-md', seq: 1, status: 'pending', title: '', matchRule: R21, ruleOverrides: { final: R21 }, ...p })
  const sw = base({ status: 'registration', stages: [st({ type: 'swiss', config: { rounds: null, seeding: 'seed' } })] })
  const s = text(FlowCanvas, { tour: sw, event: sw.events[0], db, a: fakeActions(), canEdit: true, onBack: noop, onOpenBracket: noop })
  assert.match(s, /THỤY SĨ/)
  assert.match(s, /3 vòng · 4 đội/)
  assert.match(s, /V1 2 trận V2 2 trận V3 2 trận/, '4 đội → mỗi vòng 2 trận')
  assert.match(s, /không gặp lại đối cũ/)

  const de = base({ status: 'registration', stages: [st({ type: 'knockout', config: { bracket: 'double', thirdPlace: false, seeding: 'seed' } })] })
  const s2 = text(FlowCanvas, { tour: de, event: de.events[0], db, a: fakeActions(), canEdit: true, onBack: noop, onOpenBracket: noop })
  assert.match(s2, /2 NHÁNH/)
  assert.match(s2, /Nhánh thắng/)
  assert.match(s2, /Chung kết tổng/)
  assert.doesNotMatch(s2, /có tranh 3/)
})

// Nhánh 8 đội chưa đấu (TK · BK · CK · 3-4): thanh Thiết lập nhánh chia luật rõ 2 thẻ + luật riêng theo vòng.
function koSetup(ruleOverrides = { final: { sets: 3, points: 15, winBy2: false, cap: 15 }, third: { sets: 3, points: 15, winBy2: false, cap: 15 } }) {
  const ids = Array.from({ length: 8 }, (_, i) => 'k' + i)
  const stage = { id: 's1', eventId: 'e-md', seq: 1, type: 'knockout', status: 'running', config: { thirdPlace: true, seeding: 'seed' },
    matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 }, ruleOverrides }
  let k = 0
  const matches = buildKnockout({ stage, entrants: ids.map((id, i) => ({ id, seed: i + 1 })), newId: () => 'q' + ++k }).map((m) => ({ ...m, eventId: 'e-md' }))
  const tr = base({ stages: [stage], teams: ids.map((id) => ({ id, eventId: 'e-md' })), teamPlayers: [], matches })
  return { tr, stage, own: matches }
}
const setup = (x, p = {}) => text(BracketSetup, { tour: x.tr, db, stage: x.stage, own: x.own, a: fakeActions(), canEdit: true, editable: true, ...p })

test('Thiết lập nhánh: 2 thẻ luật rõ ràng (áp dụng cho vòng nào) — số sec, điểm chạm, cách 2 + trần, câu tóm tắt', () => {
  const s = setup(koSetup())
  assert.match(s, /Vòng loại Áp dụng: Tứ kết, Bán kết Số sec 1 3 5 Điểm chạm − 21 \+ Cách 2 trần − 30 \+ 1 sec 21 điểm · cách 2, 29–29 bên chạm 30 thắng/)
  assert.match(s, /Vòng tranh hạng Áp dụng: Chung kết, Tranh hạng 3 .*3 sec 15 điểm · chạm 15 thắng/)
  assert.match(s, /Bấm tên một vòng trên nhánh để đặt luật riêng/)
  assert.doesNotMatch(s, /Dùng luật này/, 'đổi là áp vào bản nháp ngay, không cần nút xác nhận')
})

test('Luật riêng theo vòng: bấm "Tứ kết" → thẻ riêng; đã đặt riêng thì rút khỏi "Áp dụng" và hiện ở "Vòng có luật riêng"', () => {
  const x = koSetup()
  const picked = setup(x, { pickedKind: 'qf' })
  assert.match(picked, /Luật riêng · Tứ kết/)
  assert.match(picked, /← Luật chung các vòng/)
  assert.doesNotMatch(picked, /Vòng tranh hạng/)

  const withQf = koSetup({ ...x.stage.ruleOverrides, qf: { sets: 3, points: 11, winBy2: false, cap: 11 } })
  const s = setup(withQf)
  assert.match(s, /Áp dụng: Bán kết/)
  assert.match(s, /Vòng có luật riêng Tứ kết · 3 sec 11/)
  assert.match(setup(withQf, { pickedKind: 'qf' }), /Về luật chung/)

  // Bấm "Chung kết" (vòng tranh hạng chính) → không mở thẻ riêng, chỉ tô sáng thẻ "Vòng tranh hạng".
  assert.match(setup(x, { pickedKind: 'final' }), /Vòng loại.*Vòng tranh hạng/)
})

test('Nhánh: tên cột vòng bấm được khi có onPickRound (BTC, nhánh chưa đấu)', () => {
  const x = koSetup()
  const props = { view: koRounds(x.tr.matches, 's1'), tour: x.tr, db, canEdit: true, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop }
  assert.equal((html(BracketBoard, props).match(/role="button"/g) || []).length, 0)
  assert.equal((html(BracketBoard, { ...props, onPickRound: noop }).match(/role="button"[^>]*title="Bấm tên một vòng/g) || []).length, 4, 'TK · BK · CK · 3-4')
})

const { default: SpinDraw } = await load('#components/tournament/SpinDraw.jsx')
const { default: PairingTab } = await load('#components/tournament/PairingTab.jsx')

test('Quay bốc thăm: màn quay + các ô trống theo thứ tự, chưa bốc xong thì chưa lưu được', () => {
  const items = [{ id: 'a', label: 'An' }, { id: 'b', label: 'Bình' }]
  const h = html(SpinDraw, { title: 'Quay bốc thăm', items, slots: [{ label: 'Đ1' }, { label: 'Đ2' }], onDone: noop, onClose: noop })
  const s = h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  assert.match(s, /Đang bốc · Đ1 Bấm Quay để bốc Quay Quay hết/)
  assert.match(s, /Đ1 Quay vào ô này Đ2 —/, 'ô đang chọn (mặc định ô trống đầu) ghi rõ sẽ quay vào đây')
  assert.match(h, /<button[^>]*disabled[^>]*>(?:(?!<\/button>)[\s\S])*Lưu kết quả/, 'chưa bốc đủ thì nút Lưu khoá')
})

test('Quay: chip lọc chỉ hiện loại nhãn chia được danh sách; đếm còn lại', () => {
  const items = [
    { id: 'a', label: 'An', tags: { gender: 'Nam', guest: null, club: 'X' } },
    { id: 'b', label: 'Bình', tags: { gender: 'Nữ', guest: 'KHÁCH', club: 'X' } },
  ]
  const s = text(SpinDraw, { title: 'Quay', items, slots: [{ label: '1' }, { label: '2' }], onDone: noop, onClose: noop })
  assert.match(s, /Còn 2\/2 để quay/)
  assert.match(s, /Nam Nữ KHÁCH/)
  assert.doesNotMatch(s, / X /, 'ai cũng cùng "X" thì không có chip lọc')
})

test('Ghép cặp: có nút "Quay ghép cặp" cạnh "Tự ghép"', () => {
  const t0 = tour()
  const tr = tour({ entries: ['r1', 'r2', 'r3', 'r4'].map((registrationId) => ({ eventId: 'e-md', registrationId })) })
  const s = text(PairingTab, { tour: tr, event: { ...t0.events[0], genderRule: 'any' }, db, a: fakeActions(), canEdit: true, isMobile: false })
  assert.match(s, /Quay ghép cặp Tự ghép/)
})

test('Sơ đồ: thanh đáy có nút Phóng to, gợi ý nằm cùng hàng (không đè nút)', () => {
  const x = koSetup()
  const s = text(FlowCanvas, { tour: { ...x.tr, stages: [{ ...x.stage, status: 'pending' }], matches: [] }, event: x.tr.events[0], db, a: fakeActions(), canEdit: true, onBack: noop, onOpenBracket: noop })
  assert.match(s, /Căn lại khung nhìn Phóng to Kéo khối từ trái vào/)
})
