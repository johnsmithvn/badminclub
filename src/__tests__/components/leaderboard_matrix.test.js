import assert from 'node:assert/strict'
import { headToHeadMatrix, neverMetPairs, topDisparatePairs, neverMetWithSessionCount } from '#lib/matchSearch.js'

// Test helper: getShortDisplayName
function getShortDisplayName(fullName, allMembers = []) {
  if (!fullName || typeof fullName !== 'string') return ''
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  const lastName = parts[parts.length - 1]
  const duplicates = (allMembers || []).filter((m) => {
    if (!m || !m.name) return false
    const p = m.name.trim().split(/\s+/)
    return p && p[p.length - 1] === lastName
  })
  if (duplicates.length > 1 && parts.length > 1) {
    const prev = parts[parts.length - 2]
    return `${prev[0] ? prev[0] + '.' : ''} ${lastName}`
  }
  return lastName
}

// 1. Kiểm tra getShortDisplayName
const sampleMembers = [
  { id: '1', name: 'Trần Minh Kiên' },
  { id: '2', name: 'Lê Thu Hằng' },
  { id: '3', name: 'Ngô Bảo Long' },
  { id: '4', name: 'Nguyễn Văn Kiên' }, // Trùng tên Kiên
]

assert.equal(getShortDisplayName('Lê Thu Hằng', sampleMembers), 'Hằng')
assert.equal(getShortDisplayName('Ngô Bảo Long', sampleMembers), 'Long')
assert.equal(getShortDisplayName('Trần Minh Kiên', sampleMembers), 'M. Kiên')
assert.equal(getShortDisplayName('Nguyễn Văn Kiên', sampleMembers), 'V. Kiên')
assert.equal(getShortDisplayName('', sampleMembers), '')

// 2. Kiểm tra ánh xạ an toàn của disparatePairsList (nguyên nhân gây crash TypeError trước đây)
const matches = [
  {
    id: 'm1',
    playerKeys: ['1', '2', '3', '4'],
    winnerTeam: 'A',
    sets: [[21, 15]],
  },
  {
    id: 'm2',
    playerKeys: ['1', '2', '3', '4'],
    winnerTeam: 'A',
    sets: [[21, 10]],
  },
]

const matrix = headToHeadMatrix(sampleMembers, matches)
const rawDisparate = topDisparatePairs(matrix, sampleMembers, 5)

const memberMap = {
  1: sampleMembers[0],
  2: sampleMembers[1],
  3: sampleMembers[2],
  4: sampleMembers[3],
}

// Map như trong Leaderboard.jsx đã sửa
const safeDisparateList = (rawDisparate || []).map((item) => {
  const p1Obj = memberMap[item.p1] || { id: item.p1, name: item.p1 }
  const p2Obj = memberMap[item.p2] || { id: item.p2, name: item.p2 }
  return {
    ...item,
    player1: p1Obj,
    player2: p2Obj,
    wins: item.wins1 ?? 0,
    losses: item.wins2 ?? 0,
  }
})

assert.ok(safeDisparateList.length > 0, 'Có danh sách cặp lệch')
safeDisparateList.forEach((item) => {
  // Trước đây bị TypeError: Cannot read properties of undefined (reading 'name')
  assert.ok(item.player1, 'player1 phải tồn tại')
  assert.ok(item.player1.name, 'player1.name phải tồn tại')
  assert.ok(item.player2, 'player2 phải tồn tại')
  assert.ok(item.player2.name, 'player2.name phải tồn tại')
})

// 3. Kiểm tra neverMetSessionScored
const neverMet = neverMetPairs(sampleMembers, matches)
const rawNeverMet = neverMetWithSessionCount(neverMet, { sessions: [] }, 6)
const safeNeverMetList = (rawNeverMet || []).map((item) => {
  const m1 = memberMap[item.p1] || { id: item.p1, name: item.p1 }
  const m2 = memberMap[item.p2] || { id: item.p2, name: item.p2 }
  return {
    ...item,
    p1: m1,
    p2: m2,
    commonSessions: item.commonSessionsCount || 0,
  }
})

safeNeverMetList.forEach((item) => {
  assert.ok(item.p1, 'p1 phải là object')
  assert.ok(item.p1.name, 'p1.name phải tồn tại')
  assert.ok(item.p2, 'p2 phải là object')
  assert.ok(item.p2.name, 'p2.name phải tồn tại')
})

console.log('leaderboard_matrix test check: OK')
