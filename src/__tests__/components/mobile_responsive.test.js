// Hai ca đã bỏ khỏi file này, cố ý — đừng thêm lại:
//   1. `useMobile` chạy trong Node: phải mock dispatcher qua
//      `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`, vỡ mỗi lần nâng
//      React, mà chỉ khẳng định được `typeof === 'boolean'`. RULES §4: code gọi hook/Supabase
//      không nằm trong bộ test này.
//   2. "Mobile layout constraints": khai hai hằng `680`/`540` NGAY TRONG test rồi assert
//      `680 > 390`. Hai số đó không tồn tại ở bất kỳ card nào, nên ca đó không bao giờ đỏ —
//      sửa minWidth thật vẫn xanh. Muốn gác thật thì export hằng từ component rồi assert hằng đó.

import test from 'node:test'
import assert from 'node:assert/strict'
import { confidenceProgress } from '../../lib/rating.js'

test('Mobile Responsiveness & Confidence Progression Tests', async (t) => {
  await t.test('confidenceProgress calculates R1 through R5 correctly', () => {
    // R1: 0 - 4 games (<5)
    const r1 = confidenceProgress(2)
    assert.equal(r1.level, 'R1')
    assert.equal(r1.levelNum, 1)
    assert.equal(r1.nextLevel, 'R2')
    assert.equal(r1.target, 5)
    assert.equal(r1.needed, 3)
    assert.equal(r1.pct, 40)
    assert.equal(r1.isMax, false)

    // R2: 5 - 14 games (<15)
    const r2 = confidenceProgress(10)
    assert.equal(r2.level, 'R2')
    assert.equal(r2.levelNum, 2)
    assert.equal(r2.nextLevel, 'R3')
    assert.equal(r2.target, 15)
    assert.equal(r2.needed, 5)
    assert.equal(r2.pct, 50)
    assert.equal(r2.isMax, false)

    // R3: 15 - 29 games (<30)
    const r3 = confidenceProgress(20)
    assert.equal(r3.level, 'R3')
    assert.equal(r3.levelNum, 3)
    assert.equal(r3.nextLevel, 'R4')
    assert.equal(r3.target, 30)
    assert.equal(r3.needed, 10)
    assert.equal(r3.pct, 33)
    assert.equal(r3.isMax, false)

    // R4: 30 - 49 games (<50)
    const r4 = confidenceProgress(40)
    assert.equal(r4.level, 'R4')
    assert.equal(r4.levelNum, 4)
    assert.equal(r4.nextLevel, 'R5')
    assert.equal(r4.target, 50)
    assert.equal(r4.needed, 10)
    assert.equal(r4.pct, 50)
    assert.equal(r4.isMax, false)

    // R5: 50+ games (Max level)
    const r5 = confidenceProgress(65)
    assert.equal(r5.level, 'R5')
    assert.equal(r5.levelNum, 5)
    assert.equal(r5.nextLevel, null)
    assert.equal(r5.needed, 0)
    assert.equal(r5.pct, 100)
    assert.equal(r5.isMax, true)
  })

  await t.test('Mobile Home page renders all 10 personal dashboard cards without omissions', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const myStatsPath = path.resolve('src/pages/MyStats.jsx')
    const code = await fs.readFile(myStatsPath, 'utf8')

    // Find the mobile block
    const mobileBlockMatch = code.match(/if\s*\(isMobile\)\s*\{([\s\S]*?)return\s*\(\s*<div style=\{S\.mobileContainer\}>([\s\S]*?)<\/div>\s*\)\s*\}/)
    assert.ok(mobileBlockMatch, 'MyStats should have an explicit mobile container block')

    const mobileContent = mobileBlockMatch[2]
    const requiredCards = [
      'HeroRankCard',
      'RecentFormCard',
      'RivalGoalCard',
      'SeasonRaceCard',
      'RecentMatchesCard',
      'NearbyStandingsCard',
      'SynergyBadgesCard',
      'MyOpponentsCard',
      'UpcomingSessionCard',
      'ClubFeedCard',
    ]

    for (const card of requiredCards) {
      assert.ok(
        mobileContent.includes(`<${card}`),
        `Mobile home container must include ${card}`,
      )
    }
  })

  await t.test('Recent matches query retrieves up to 3 matches for mobile and desktop feeds', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const myStatsPath = path.resolve('src/pages/MyStats.jsx')
    const code = await fs.readFile(myStatsPath, 'utf8')

    // Ensure recentMatches is not capped to 1 on mobile
    assert.ok(!code.includes('isMobile ? 1 : 3'), 'recentMatches must not cap mobile to 1 match')
    assert.ok(code.includes('getRecentPlayerMatches(db, memberId, 3)'), 'recentMatches must query 3 matches')
  })
})
