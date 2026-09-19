import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPushUrl } from '../../routes/index.js'

test('Web Push URL Generation (buildPushUrl)', async (t) => {
  const clubId = 'club-uuid-123'

  await t.test('Challenge refType maps to /tran-dau?tab=challenges&challengeId=...&club=...', () => {
    const url = buildPushUrl({
      type: 'challenge_created',
      refType: 'challenge',
      refId: 'chal-456',
      clubId,
    })
    assert.equal(url, '/tran-dau?tab=challenges&challengeId=chal-456&club=club-uuid-123')
  })

  await t.test('Session refType maps to /buoi-tap/:id?club=...', () => {
    const url = buildPushUrl({
      type: 'session_rsvp_invite',
      refType: 'session',
      refId: 'sess-789',
      clubId,
    })
    assert.equal(url, '/buoi-tap/sess-789?club=club-uuid-123')
  })

  await t.test('Match refType maps to /tran-dau?tab=search&matchId=...&club=...', () => {
    const url = buildPushUrl({
      type: 'bounty_broken',
      refType: 'match',
      refId: 'match-101',
      clubId,
    })
    assert.equal(url, '/tran-dau?tab=search&matchId=match-101&club=club-uuid-123')
  })

  await t.test('Claim refType maps to /so-quy?club=...', () => {
    const url = buildPushUrl({
      type: 'claim_approved',
      refType: 'claim',
      refId: 'claim-1',
      clubId,
    })
    assert.equal(url, '/so-quy?club=club-uuid-123')
  })

  await t.test('Debts refType (claim_submitted, refund) maps to /cong-no?club=...', () => {
    const url = buildPushUrl({
      type: 'claim_submitted',
      refType: 'debts',
      refId: null,
      clubId,
    })
    assert.equal(url, '/cong-no?club=club-uuid-123')
  })

  await t.test('Member change requested maps to /thanh-vien?club=...', () => {
    const url = buildPushUrl({
      type: 'member_change_requested',
      refType: 'member',
      refId: 'mem-1',
      clubId,
    })
    assert.equal(url, '/thanh-vien?club=club-uuid-123')
  })

  await t.test('Member approval / rejection maps to /ca-nhan?club=...', () => {
    const urlApproved = buildPushUrl({
      type: 'join_approved',
      refType: 'member',
      refId: 'mem-1',
      clubId,
    })
    assert.equal(urlApproved, '/ca-nhan?club=club-uuid-123')

    const urlChangeApproved = buildPushUrl({
      type: 'member_change_approved',
      refType: 'member',
      refId: 'mem-1',
      clubId,
    })
    assert.equal(urlChangeApproved, '/ca-nhan?club=club-uuid-123')
  })

  await t.test('Without clubId returns bare path without &club=', () => {
    const url = buildPushUrl({
      type: 'claim_submitted',
      refType: 'debts',
      refId: null,
    })
    assert.equal(url, '/cong-no')
  })
})
