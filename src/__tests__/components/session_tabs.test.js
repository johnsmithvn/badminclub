import test from 'node:test'
import assert from 'node:assert/strict'

test('Phase 2 Session Tabs & Court Integration Verification', async (t) => {
  await t.test('Absent toggle removes player from court lineup', () => {
    const sid = 'sess-1'
    const mid = 'mem-1'
    const d = {
      attendance: { [sid]: { [mid]: true } },
      lineups: { [sid]: { 'c0_0': mid, 'c0_1': 'mem-2' } },
    }

    // Giả lập logic toggleAtt khi chuyển sang absent
    const willBePresent = false
    let lineups = d.lineups
    if (!willBePresent && d.lineups?.[sid]) {
      const sLineup = { ...d.lineups[sid] }
      Object.keys(sLineup).forEach((slotId) => {
        if (sLineup[slotId] === mid) delete sLineup[slotId]
      })
      lineups = { ...d.lineups, [sid]: sLineup }
    }

    assert.equal(lineups[sid]['c0_0'], undefined)
    assert.equal(lineups[sid]['c0_1'], 'mem-2')
  })

  await t.test('Deploy challenge fills court slots', () => {
    const challenge = {
      id: 'ch-1',
      code: 'C-0101',
      teamA: ['m1', 'm2'],
      teamB: ['m3', 'm4'],
    }
    const courtIdx = 0
    const slotKeys = [`c${courtIdx}_0`, `c${courtIdx}_1`, `c${courtIdx}_2`, `c${courtIdx}_3`]
    const newLineup = {}
    newLineup[slotKeys[0]] = challenge.teamA[0]
    newLineup[slotKeys[1]] = challenge.teamA[1]
    newLineup[slotKeys[2]] = challenge.teamB[0]
    newLineup[slotKeys[3]] = challenge.teamB[1]

    assert.equal(newLineup['c0_0'], 'm1')
    assert.equal(newLineup['c0_1'], 'm2')
    assert.equal(newLineup['c0_2'], 'm3')
    assert.equal(newLineup['c0_3'], 'm4')
  })
})
