import test from 'node:test'
import assert from 'node:assert/strict'
import { ROUTE_KEYS, pathOf, keyOfPath, pageOf } from '../../routes/index.js'

test('Matches & Challenges Routes & Navigation Verification', async (t) => {
  await t.test('ROUTE_KEYS contains matches', () => {
    assert.ok(ROUTE_KEYS.includes('matches'))
  })

  await t.test('pathOf resolves matches URL', () => {
    assert.equal(pathOf('matches'), '/tran-dau')
  })

  await t.test('keyOfPath maps /tran-dau to matches', () => {
    assert.equal(keyOfPath('/tran-dau'), 'matches')
  })

  await t.test('pageOf resolves matches metadata', () => {
    const page = pageOf('matches')
    assert.equal(page.key, 'matches')
    assert.equal(page.path, '/tran-dau')
    assert.ok(page.title)
    assert.ok(page.desc)
  })

  await t.test('leaderboard and matches routes are distinct and valid', () => {
    assert.equal(pathOf('leaderboard'), '/bang-xep-hang')
    assert.equal(pathOf('matches'), '/tran-dau')
    assert.notEqual(pathOf('leaderboard'), pathOf('matches'))
  })
})
