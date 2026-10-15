// node src/__tests__/lib/sakura.test.js
import assert from 'node:assert/strict'
import { greetingSegs, parseGreeting } from '#lib/sakura.js'
import cfg from '#config/womensDay.json' with { type: 'json' }

const text = (segs) => segs.map((s) => s.t).join('')

// Câu đầu / giữa / cuối — cắt sai là lời chúc dồn hết vào khung cuối, thiệp mất bố cục.
const p = parseGreeting('Chúc A 20/10 vui. Câu hai. Câu ba! Câu cuối nhé.', 'A')
assert.equal(text(p.lead), 'Chúc A 20/10 vui.', '"20/10" không được cắt câu')
assert.deepEqual(p.body.map(text), ['Câu hai.', 'Câu ba!'])
assert.equal(text(p.close), 'Câu cuối nhé.')

// Mặt cười ":)))" là hết câu — lời chúc Canh lá đắng dùng nó, không cắt thì cả thân bài chui vào khung cuối.
const smile = parseGreeting('Mở đầu. Cười đi :))) Cặp đôi đặc sản nhé.')
assert.deepEqual(smile.body.map(text), ['Cười đi :)))'])
assert.equal(text(smile.close), 'Cặp đôi đặc sản nhé.')

// Số có dấu chấm và chữ không có dấu câu cuối.
assert.equal(parseGreeting('Elo 1.342 cao lắm').lead.length, 1, '"1.342" không được cắt câu')
assert.equal(parseGreeting('Thôi lỡ bấm rồi 💅').close, null, 'một câu thì không có khung cuối')

// Quá 3 câu giữa thì gộp 2 câu một đoạn.
const long = parseGreeting('A. b1. b2. b3. b4. b5. Z.')
assert.deepEqual(long.body.map(text), ['b1. b2.', 'b3. b4.', 'b5.'])

// ** tô nền, tên in đậm, phần còn lại giữ nguyên.
assert.deepEqual(greetingSegs('Chúc Hoa **rực rỡ** nhé Hoa', 'Hoa'), [
  { t: 'Chúc ', kind: 'plain' }, { t: 'Hoa', kind: 'name' }, { t: ' ', kind: 'plain' },
  { t: 'rực rỡ', kind: 'hl' }, { t: ' nhé ', kind: 'plain' }, { t: 'Hoa', kind: 'name' },
])

// !! gạch sóng — chữ cài cắm cho người tinh ý; dấu ! lẻ cuối câu thì không được nuốt.
assert.deepEqual(greetingSegs('Tin nhắn !!KHÓ TRÁNH!! thật!', null), [
  { t: 'Tin nhắn ', kind: 'plain' }, { t: 'KHÓ TRÁNH', kind: 'odd' }, { t: ' thật!', kind: 'plain' },
])

// Mọi lời chúc thật: câu dẫn có chữ, không còn ** lẻ lọt ra màn hình.
Object.entries(cfg.greetings).forEach(([id, g]) => {
  const m = parseGreeting(g.msg, g.name)
  assert.ok(text(m.lead), id + ': lời chúc rỗng')
  const all = [m.lead, ...m.body, m.close || []].flat().map((s) => s.t).join('')
  assert.ok(!all.includes('**'), id + ': dấu ** chưa đóng cặp — thiệp hiện nguyên dấu sao')
  assert.ok(!all.includes('!!'), id + ': dấu !! chưa đóng cặp — thiệp hiện nguyên hai dấu chấm than')
})

console.log('sakura check: OK')
