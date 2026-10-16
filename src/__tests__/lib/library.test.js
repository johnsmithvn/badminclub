// node src/__tests__/lib/library.test.js
// Thư viện bài tập: đọc giờ "mm:ss", kiểm form đăng bài, nhãn MỚI, lặp đoạn theo mốc.

import assert from 'node:assert/strict'
import { activeNoteIdx, blankForm, checkPost, dropVideo, filterPosts, formOf, groupByShelf, isNewPost, loopRange, parseClock, pinnedOf, postLength, startFromUrl } from '#lib/library.js'

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

/* ---------- giờ ---------- */
assert.equal(parseClock('01:42'), 102, 'mm:ss sai là bấm mốc tua tới chỗ khác hẳn')
assert.equal(parseClock('1:02:03'), 3723, 'video dài hơn 1 giờ phải đọc được h:mm:ss')
assert.equal(parseClock('95'), 95, 'gõ số giây trần vẫn hiểu')
assert.equal(parseClock('  '), null, 'để trống = không có mốc, không phải 0 giây')
assert.ok(Number.isNaN(parseClock('1:75')), 'giây > 59 là gõ nhầm — nhận im lặng thì mốc lệch đi một phút')
assert.ok(Number.isNaN(parseClock('abc')), 'chữ không phải giờ')

assert.equal(startFromUrl('https://youtu.be/dQw4w9WgXcQ?t=90'), 90, 'link chia sẻ có ?t= thì lấy làm giờ bắt đầu')
assert.equal(startFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), 90, 'dạng 1m30s của YouTube')
assert.equal(startFromUrl(YT), null, 'không có t= thì không bịa giờ bắt đầu')

/* ---------- form ---------- */
const form = (patch = {}) => ({ ...blankForm('Tấn công'), title: 'Đập cầu', ...patch })

let r = checkPost(form({ videos: [{ url: YT, start: '01:20', end: '02:45' }], notes: [{ v: 0, t: '01:42', text: 'Khuỷu tay cao' }] }))
assert.ok(r.ok, 'bài đủ tiêu đề + kệ + 1 video hợp lệ phải đăng được')
assert.deepEqual(r.post.videos, [{ url: YT, start: 80, end: 165, notes: [{ t: 102, text: 'Khuỷu tay cao' }] }],
  'video lưu theo giây, mốc gắn vào đúng video')

r = checkPost(form({ title: '  ' , videos: [{ url: YT, start: '', end: '' }] }))
assert.equal(r.errors.title, 'library.err.title', 'thiếu tiêu đề thì thẻ trong thư viện trống chữ')
assert.equal(r.ok, false)

r = checkPost(form())
assert.equal(r.error, 'library.err.noVideo', 'bài không có video nào thì không phải bài tập — chặn')

r = checkPost(form({ videos: [{ url: 'https://vimeo.com/123', start: '', end: '' }] }))
assert.equal(r.errors.videos[0].url, 'library.err.url', 'chỉ nhận YouTube — link khác nhúng không chạy')

r = checkPost(form({ videos: [{ url: YT, start: '02:00', end: '01:00' }] }))
assert.equal(r.errors.videos[0].range, 'library.err.range', 'kết thúc trước bắt đầu thì đoạn cần xem âm')

r = checkPost(form({ videos: [{ url: YT + '&t=45', start: '', end: '' }] }))
assert.equal(r.post.videos[0].start, 45, 'không gõ giờ bắt đầu thì lấy từ ?t= trong link')

r = checkPost(form({ videos: [{ url: YT, start: '01:00', end: '02:00' }], notes: [{ v: 0, t: '03:00', text: 'x' }] }))
assert.equal(r.errors.notes[0], 'library.err.noteRange', 'mốc nằm ngoài đoạn cần xem: bấm vào thì player dừng ngay')

r = checkPost(form({ videos: [{ url: YT, start: '', end: '' }], notes: [{ v: 0, t: '00:30', text: '' }] }))
assert.equal(r.errors.notes[0], 'library.err.noteText', 'mốc không có lời dặn thì bấm vào không biết xem gì')

// Hai video, xoá trống video 1: mốc của video 2 vẫn phải đi theo video 2 (giờ là video đầu tiên của bài).
r = checkPost(form({
  videos: [{ url: '', start: '', end: '' }, { url: YT, start: '', end: '' }],
  notes: [{ v: 1, t: '00:10', text: 'b' }, { v: 1, t: '00:05', text: 'a' }],
}))
assert.ok(r.ok)
assert.deepEqual(r.post.videos[0].notes.map((n) => n.text), ['a', 'b'], 'mốc xếp theo giờ và không lạc sang video khác')

// Sửa bài: form dựng lại từ bài đã lưu phải kiểm ra đúng bài đó.
const saved = { title: 'X', shelf: 'Lưới', body: '', videos: [{ url: YT, start: 80, end: null, notes: [{ t: 90, text: 'n' }] }] }
assert.deepEqual(checkPost(formOf(saved)).post.videos, saved.videos, 'mở Sửa rồi Lưu không đổi gì thì bài không được lệch')

// Bấm "Bỏ" một video trong form: mốc của video đó phải đi theo nó. Trước đây mốc bị dời sang
// video khác mà form vẫn hợp lệ → bài lưu ra bấm mốc là tua tới đoạn chẳng liên quan.
const YT2 = 'https://youtu.be/bbbbbbbbbbb'
const two = form({
  videos: [{ url: YT, start: '', end: '' }, { url: YT2, start: '', end: '' }, { url: YT, start: '', end: '' }],
  notes: [{ v: 0, t: '00:10', text: 'A' }, { v: 1, t: '00:20', text: 'B' }, { v: 2, t: '00:30', text: 'C' }],
})
assert.deepEqual(dropVideo(two, 0).notes.map((n) => [n.v, n.text]), [[0, 'B'], [1, 'C']], 'bỏ video đầu: mốc của nó bỏ theo, các mốc sau lùi một số')
assert.deepEqual(dropVideo(two, 1).notes.map((n) => [n.v, n.text]), [[0, 'A'], [1, 'C']], 'bỏ video giữa: mốc video trước giữ nguyên, mốc video sau lùi một số')
assert.deepEqual(dropVideo(two, 2).notes.map((n) => [n.v, n.text]), [[0, 'A'], [1, 'B']], 'bỏ video cuối: các mốc khác không đổi')
assert.deepEqual(dropVideo(two, 1).videos.map((v) => v.url), [YT, YT], 'bỏ đúng video được bấm')
r = checkPost(dropVideo(form({ videos: [{ url: YT, start: '', end: '' }, { url: YT2, start: '', end: '' }], notes: [{ v: 0, t: '00:30', text: 'A' }] }), 0))
assert.deepEqual(r.post.videos[0].notes, [], 'mốc của video đã bỏ không được lưu vào video còn lại')
assert.equal(dropVideo(form({ videos: two.videos.slice(0, 2), notes: [{ v: 1, t: '00:20', text: 'B' }] }), 1).notes.length, 1,
  'bỏ hết mốc thì form vẫn còn một dòng mốc trống để gõ tiếp')

/* ---------- danh sách ---------- */
const posts = [
  { id: 'a', shelf: 'Tấn công', createdAt: '2026-10-10T00:00:00Z', authorId: 'm1', pinnedAt: null, videos: [] },
  { id: 'b', shelf: 'Di chuyển', createdAt: '2026-10-12T00:00:00Z', authorId: 'm2', pinnedAt: '2026-10-13T00:00:00Z', videos: [] },
  { id: 'c', shelf: 'Tấn công', createdAt: '2026-10-14T00:00:00Z', authorId: 'm2', pinnedAt: '2026-10-11T00:00:00Z', videos: [] },
]
assert.deepEqual(groupByShelf(posts).map((g) => [g.name, g.items.map((p) => p.id)]),
  [['Di chuyển', ['b']], ['Tấn công', ['c', 'a']]], 'kệ theo ABC, bài mới đăng đứng đầu kệ')
assert.equal(pinnedOf(posts).id, 'b', 'hai bài cùng còn dấu ghim thì bài ghim sau thắng — mỗi lúc chỉ một bài')
assert.deepEqual(filterPosts(posts, 'saved', { a: { saved: true } }).map((p) => p.id), ['a'])

const now = Date.parse('2026-10-16T00:00:00Z')
assert.equal(isNewPost(posts[2], null, 'm1', now), true, 'người khác đăng 2 ngày trước, mình chưa mở → MỚI')
assert.equal(isNewPost(posts[2], { viewedAt: '2026-10-15' }, 'm1', now), false, 'đã mở rồi thì thôi báo mới')
assert.equal(isNewPost(posts[0], null, 'm1', now), false, 'bài của chính mình không phải bài mới với mình')
assert.equal(isNewPost({ ...posts[2], createdAt: '2026-08-01T00:00:00Z' }, null, 'm1', now), false, 'quá newDays thì hết mới')

assert.equal(postLength({ videos: [{ start: 80, end: 165 }, { start: 0, end: 60 }] }), 145)
assert.equal(postLength({ videos: [{ start: 80, end: null }] }), null, 'không biết giờ kết thúc thì không bịa độ dài')

/* ---------- đọc bài: mốc & lặp đoạn ---------- */
const v = { start: 80, end: 165, notes: [{ t: 102 }, { t: 125 }, { t: 151 }] }
assert.equal(activeNoteIdx(v.notes, 90), -1, 'chưa tới mốc đầu')
assert.equal(activeNoteIdx(v.notes, 130), 1)
assert.deepEqual(loopRange(v, 130), { a: 125, b: 151 }, 'đang ở mốc 2 thì lặp từ mốc 2 tới mốc 3')
assert.deepEqual(loopRange(v, 160), { a: 151, b: 165 }, 'mốc cuối lặp tới hết đoạn')
assert.deepEqual(loopRange(v, 85), { a: 80, b: 102 }, 'trước mốc đầu thì lặp phần mở đầu')
assert.deepEqual(loopRange({ start: 0, end: null, notes: [] }, 5, 300), { a: 0, b: 300 }, 'không ghi giờ kết thúc thì lấy độ dài thật của video')
assert.equal(loopRange({ start: 0, end: null, notes: [] }, 5, 0), null, 'player chưa báo độ dài thì chưa lặp được')

console.log('library check: OK')
