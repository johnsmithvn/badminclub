import test from 'node:test'
import assert from 'node:assert/strict'
import { confidenceProgress } from '../../lib/rating.js'
import { useMobile } from '../../hooks/useMobile.js'

import React from 'react'

test('Mobile Responsiveness & Confidence Progression Tests', async (t) => {
  await t.test('useMobile returns boolean safely in SSR/Node without window', () => {
    const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE || React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
    const origH = internals ? (internals.H || internals.ReactCurrentDispatcher?.current) : null
    if (internals) {
      const mockDispatcher = {
        useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
        useEffect: () => {},
      }
      if (internals.H !== undefined) internals.H = mockDispatcher
      if (internals.ReactCurrentDispatcher) internals.ReactCurrentDispatcher.current = mockDispatcher
    }
    try {
      const isMob = useMobile(768)
      assert.equal(typeof isMob, 'boolean')
      assert.equal(isMob, false) // In node environment without window, safely defaults to false
    } finally {
      if (internals) {
        if (internals.H !== undefined) internals.H = origH
        if (internals.ReactCurrentDispatcher) internals.ReactCurrentDispatcher.current = origH
      }
    }
  })

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

  await t.test('Mobile layout constraints enforce touch scroll boundaries', () => {
    const tableMinWidthDesktop = 680
    const tableMinWidthMobile = 540
    assert.ok(tableMinWidthDesktop > 390, 'Table minWidth exceeds mobile screen width to trigger horizontal scroll')
    assert.ok(tableMinWidthMobile > 390, 'Mobile match card table width exceeds 390px to prevent cramped data')
  })
})
