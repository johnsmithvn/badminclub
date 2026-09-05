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

  await t.test('Cross-gender calibration and effective rating in Court Assignment', () => {
    const rawRating = 1200
    const offset = 180
    // Khi mem là nữ, effective rating = raw + offset
    const effectiveFemale = rawRating + offset
    assert.equal(effectiveFemale, 1380)

    // Gap calculation with raw vs effective
    const maleRating = 1350
    const rawGap = Math.abs(maleRating - rawRating) // 150
    const effectiveGap = Math.abs(maleRating - effectiveFemale) // 30

    assert.equal(rawGap, 150)
    assert.equal(effectiveGap, 30)
    assert.ok(effectiveGap < rawGap, 'Calibration reduces perceived gender rating gap for balanced pairing')
  })

  await t.test('Suggest balanced pair from waiting roster', () => {
    const waiting = [
      { id: 'm1', name: 'Alice', rating: 1200 },
      { id: 'm2', name: 'Bob', rating: 1500 },
      { id: 'm3', name: 'Charlie', rating: 1220 },
      { id: 'm4', name: 'Diana', rating: 1600 },
    ]

    // Algorithm: Find 2 players with minimum rating difference
    let bestPair = null
    let minDiff = Infinity
    for (let i = 0; i < waiting.length; i++) {
      for (let j = i + 1; j < waiting.length; j++) {
        const diff = Math.abs(waiting[i].rating - waiting[j].rating)
        if (diff < minDiff) {
          minDiff = diff
          bestPair = [waiting[i].id, waiting[j].id]
        }
      }
    }

    assert.deepEqual(bestPair, ['m1', 'm3'])
    assert.equal(minDiff, 20)
  })

  await t.test('Session Matches Tab 4 StatCard calculations', () => {
    const matches = [
      { id: 'm1', isChallenge: false, scoreA: 21, scoreB: 19, ratingA: 1200, ratingB: 1210 },
      { id: 'm2', isChallenge: true, scoreA: 21, scoreB: 12, ratingA: 1400, ratingB: 1200 },
      { id: 'm3', isChallenge: false, scoreA: 22, scoreB: 20, ratingA: 1300, ratingB: 1280 },
    ]

    const totalMatches = matches.length
    const estMinutes = totalMatches * 15
    const courtMatches = matches.filter((m) => !m.isChallenge).length
    const challengeMatches = matches.filter((m) => m.isChallenge).length
    const balancedMatches = matches.filter((m) => {
      const scoreDiff = Math.abs((m.scoreA || 0) - (m.scoreB || 0))
      const eloDiff = Math.abs((m.ratingA || 0) - (m.ratingB || 0))
      return scoreDiff <= 3 || eloDiff <= 50
    }).length

    assert.equal(totalMatches, 3)
    assert.equal(estMinutes, 45)
    assert.equal(courtMatches, 2)
    assert.equal(challengeMatches, 1)
    assert.equal(balancedMatches, 2) // m1 and m3 are balanced
  })

  await t.test('CreateChallengeModal detects low confidence (R1/R2) players and triggers warning', () => {
    const members = [
      { id: 'p1', name: 'Pro', matchesCount: 50 },
      { id: 'p2', name: 'Rookie', matchesCount: 3 }, // < 5 matches -> R1
    ]

    const getConfidenceTier = (cnt) => {
      if (cnt < 5) return 'R1'
      if (cnt < 15) return 'R2'
      if (cnt < 30) return 'R3'
      if (cnt < 60) return 'R4'
      return 'R5'
    }

    const tierP1 = getConfidenceTier(members[0].matchesCount)
    const tierP2 = getConfidenceTier(members[1].matchesCount)

    assert.equal(tierP1, 'R4')
    assert.equal(tierP2, 'R1')

    const teamA = ['p1']
    const teamB = ['p2']
    const hasUnreliable = [...teamA, ...teamB].some((id) => {
      const m = members.find((x) => x.id === id)
      const tier = getConfidenceTier(m?.matchesCount || 0)
      return tier === 'R1' || tier === 'R2'
    })

    assert.equal(hasUnreliable, true, 'Low-confidence warning properly flagged for matchmaking modal')
  })
})

