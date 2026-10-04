// Khối 2 dòng đội thắng / đội thua + điểm trên thẻ trận mobile (tab Trận của buổi + trang Trận đấu).
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load } from '../tournament/_render.js'
import { matchSides } from '#lib/matchSearch.js'

const { default: MatchScoreLines } = await load('#components/challenge/MatchScoreLines.jsx')
const id = (x) => x
const sides = (m) => matchSides(m, id, (x) => 'Tên đầy đủ ' + x)

test('1 set: vương miện + tên đội thắng trước, điểm thắng rồi điểm thua', () => {
  const s = text(MatchScoreLines, { sides: sides({ teamA: ['An', 'Bình'], teamB: ['Cường', 'Dũng'], winnerTeam: 'B', sets: [[17, 21]] }) })
  assert.equal(s, '👑 Cường · Dũng 21 An · Bình 17')
})

test('nhiều set: số set thắng/thua kèm điểm từng set', () => {
  const s = text(MatchScoreLines, { sides: sides({ teamA: ['An'], teamB: ['Cường'], winnerTeam: 'A', sets: [[21, 19], [18, 21], [21, 15]] }) })
  assert.equal(s, '👑 An 2 (21-18-21) Cường 1 (19-21-15)')
})

test('tên đầy đủ nằm ở title để hover', () => {
  const m = html(MatchScoreLines, { sides: sides({ teamA: ['An'], teamB: ['Cường'], winnerTeam: 'A', sets: [[21, 5]] }) })
  assert.match(m, /title="Tên đầy đủ An"/)
  assert.match(m, /title="Tên đầy đủ Cường"/)
})

test('chưa có set: không in điểm', () => {
  assert.equal(text(MatchScoreLines, { sides: sides({ teamA: ['An'], teamB: ['Cường'], winnerTeam: 'A', sets: [] }) }), '👑 An Cường')
})
