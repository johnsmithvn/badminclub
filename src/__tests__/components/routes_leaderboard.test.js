import test from 'node:test'
import assert from 'node:assert/strict'
import { ROUTE_KEYS, pathOf, keyOfPath, pageOf } from '../../routes/index.js'

test('Phase 4 Routes & Navigation Verification', async (t) => {
  await t.test('ROUTE_KEYS contains leaderboard', () => {
    assert.ok(ROUTE_KEYS.includes('leaderboard'))
  })

  await t.test('pathOf resolves leaderboard URL', () => {
    assert.equal(pathOf('leaderboard'), '/bang-xep-hang')
  })

  await t.test('keyOfPath maps /bang-xep-hang to leaderboard', () => {
    assert.equal(keyOfPath('/bang-xep-hang'), 'leaderboard')
  })

  await t.test('pageOf resolves leaderboard metadata', () => {
    const page = pageOf('leaderboard')
    assert.equal(page.key, 'leaderboard')
    assert.equal(page.path, '/bang-xep-hang')
    assert.ok(page.title)
  })
})
