import test from 'node:test'
import assert from 'node:assert/strict'
import { urlBase64ToUint8Array } from '../../lib/pushSubscription.js'

test('Push Subscription Helpers (urlBase64ToUint8Array)', async (t) => {
  // Test with standard VAPID public key sample
  const base64Key = 'BHjH_aWQ5fClqpOa2AuRlrXr4IlC7AkkJe7rGrF2NcrqejXZlkm9xy5Pn6CEqLILE0PtoXGyVon-mg2Vp12yjwA'

  await t.test('converts base64 URL-safe string to Uint8Array', () => {
    // Mock window.atob for Node environment if not present
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
      }
    }

    const uint8Array = urlBase64ToUint8Array(base64Key)
    assert.ok(uint8Array instanceof Uint8Array)
    assert.equal(uint8Array.length, 65) // P-256 public key uncompressed length is 65 bytes
  })
})
