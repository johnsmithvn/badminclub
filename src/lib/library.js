// Thư viện bài tập — logic thuần (không Supabase, không React). Test: src/__tests__/lib/library.test.js
//
// Bài lưu video dạng [{ url, start, end, notes: [{ t, text }] }], mọi mốc là GIÂY nguyên
// (`end` null = tới hết video). Form đang gõ thì giữ chuỗi "01:42", chỉ đổi sang giây lúc lưu.
// Lỗi trả về là key i18n `library.err.*` — màn hình dịch bằng t().

import { extractYouTubeId, formatPartsToTimestamp } from '#utils/videoUtils.js'
import { normalizeText } from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }

const DAY_MS = 86400000

/** "01:42" · "1:02:03" · "95" → giây. Để trống → null. Sai dạng (chữ, phút/giây > 59) → NaN. */
export function parseClock(str) {
  const s = String(str ?? '').trim()
  if (!s) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(s)) return NaN
  const parts = s.split(':').map(Number)
  if (parts.slice(1).some((p) => p > 59)) return NaN
  return parts.reduce((a, b) => a * 60 + b, 0)
}

/** Giây → "01:42" / "1:02:03". */
export const clock = (sec) => formatPartsToTimestamp(Math.max(0, Math.floor(Number(sec) || 0)))

/** Mốc bắt đầu ghi sẵn trong link (`?t=90`, `&t=1m30s`, `?start=90`) → giây, không có → null. */
export function startFromUrl(url) {
  const s = String(url || '').trim()
  if (!s) return null
  let u
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s) } catch { return null }
  const raw = u.searchParams.get('t') || u.searchParams.get('start')
  const m = raw && raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!m) return null
  const sec = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)
  return sec > 0 ? sec : null
}

export const thumbOf = (url) => {
  const id = extractYouTubeId(url)
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''
}

/* ---------------- Form đăng / sửa bài ---------------- */

const blankVideo = () => ({ url: '', start: '', end: '' })
const blankNote = (v = 0) => ({ v, t: '', text: '' })

export const blankForm = (shelf = '') => ({
  title: '', body: '', shelf, videos: [blankVideo()], notes: [blankNote()],
})

/** Bài đã lưu → form để sửa. Mốc ghi chú trải phẳng, mỗi dòng nhớ thuộc video thứ mấy (`v`). */
export function formOf(post) {
  const videos = (post?.videos || []).map((v) => ({
    url: v.url || '', start: v.start ? clock(v.start) : '', end: v.end != null ? clock(v.end) : '',
  }))
  const notes = (post?.videos || []).flatMap((v, i) => (v.notes || []).map((n) => ({ v: i, t: clock(n.t), text: n.text || '' })))
  return {
    title: post?.title || '', body: post?.body || '', shelf: post?.shelf || '',
    videos: videos.length ? videos : [blankVideo()],
    notes: notes.length ? notes : [blankNote()],
  }
}

/** Bỏ video thứ i khỏi form: mốc của video đó bỏ theo, mốc của các video phía sau lùi một số. */
export function dropVideo(form, i) {
  const notes = form.notes.filter((n) => (n.v || 0) !== i).map((n) => ((n.v || 0) > i ? { ...n, v: n.v - 1 } : n))
  return { ...form, videos: form.videos.filter((_, k) => k !== i), notes: notes.length ? notes : [blankNote()] }
}

const rowEmpty = (v) =>!String(v.url || '').trim() && !String(v.start || '').trim() && !String(v.end || '').trim()
const noteEmpty = (n) => !String(n.t || '').trim() && !String(n.text || '').trim()

/**
 * Kiểm form và dựng bài để lưu.
 * @returns {{ ok: boolean, error: string, errors: { title, shelf, videos: Array<{url, range}>, notes: string[] }, post }}
 *   `error` là lỗi chung (thiếu video) · `errors.*` gắn vào đúng ô · `post` chỉ dùng được khi ok.
 */
export function checkPost(form) {
  const title = String(form?.title || '').trim()
  const shelf = String(form?.shelf || '').trim()
  const errors = {
    title: !title ? 'library.err.title' : title.length > cfg.library.titleMax ? 'library.err.titleLong' : '',
    shelf: !shelf ? 'library.err.shelf' : shelf.length > cfg.library.shelfMax ? 'library.err.shelfLong' : '',
    videos: [],
    notes: [],
  }

  // Dòng video bỏ trống hẳn thì bỏ qua; `keep[i]` = vị trí của video i trong bài sẽ lưu (-1 = bỏ).
  const videos = []
  const keep = (form?.videos || []).map((v, i) => {
    const err = { url: '', range: '' }
    errors.videos[i] = err
    if (rowEmpty(v)) return -1
    const url = String(v.url || '').trim()
    if (!extractYouTubeId(url)) err.url = url ? 'library.err.url' : 'library.err.urlMissing'
    const typed = parseClock(v.start)
    const start = typed ?? startFromUrl(url) ?? 0
    const end = parseClock(v.end)
    if (Number.isNaN(start) || Number.isNaN(end)) err.range = 'library.err.clock'
    else if (end != null && end <= start) err.range = 'library.err.range'
    if (err.url || err.range) return -1
    videos.push({ url, start, end, notes: [] })
    return videos.length - 1
  })

  ;(form?.notes || []).forEach((n, i) => {
    errors.notes[i] = ''
    if (noteEmpty(n)) return
    const at = parseClock(n.t)
    const text = String(n.text || '').trim()
    const vi = keep[n.v ?? 0] ?? -1
    const v = videos[vi]
    let err = ''
    if (at == null) err = 'library.err.noteTime'
    else if (Number.isNaN(at)) err = 'library.err.clock'
    else if (!text) err = 'library.err.noteText'
    else if (!v) err = 'library.err.noteVideo'
    else if (at < v.start || (v.end != null && at > v.end)) err = 'library.err.noteRange'
    errors.notes[i] = err
    if (!err) v.notes.push({ t: at, text })
  })
  videos.forEach((v) => v.notes.sort((a, b) => a.t - b.t))

  const fieldBad = errors.title || errors.shelf ||
    errors.videos.some((e) => e.url || e.range) || errors.notes.some(Boolean)
  const error = !fieldBad && !videos.length ? 'library.err.noVideo' : ''
  return {
    ok: !fieldBad && !error,
    error,
    errors,
    post: { title, shelf, body: String(form?.body || '').trim(), videos },
  }
}

/* ---------------- Danh sách ---------------- */

/** Bài đang ghim: bài có `pinnedAt` mới nhất (RPC library_pin luôn gỡ bài cũ, đây chỉ là lưới an toàn). */
export function pinnedOf(posts) {
  return (posts || []).filter((p) => p.pinnedAt).sort((a, b) => b.pinnedAt.localeCompare(a.pinnedAt))[0] || null
}

/** Tên kệ đang có bài, theo ABC tiếng Việt. */
export function shelvesOf(posts) {
  return [...new Set((posts || []).map((p) => p.shelf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
}

/** Gom bài theo kệ: [{ name, items }], bài mới đăng đứng trước. */
export function groupByShelf(posts) {
  const byNew = [...(posts || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return shelvesOf(posts).map((name) => ({ name, items: byNew.filter((p) => p.shelf === name) }))
}

/** Lọc theo chip: 'all' · 'saved' · tên một kệ. `marks` = { [postId]: { saved, viewedAt } }. */
export function filterPosts(posts, filter, marks) {
  if (filter === 'saved') return (posts || []).filter((p) => marks?.[p.id]?.saved)
  if (!filter || filter === 'all') return posts || []
  return (posts || []).filter((p) => p.shelf === filter)
}

/**
 * Tìm bài theo chữ gõ — không phân biệt dấu / hoa thường: MỌI từ phải có trong tiêu đề, nội dung, tên kệ hoặc ghi
 * chú mốc video. Bài có đủ các từ ngay trong tiêu đề đứng trước, rồi bài mới đăng trước. Ô trống → [].
 */
export function searchPosts(posts, q) {
  const words = normalizeText(q).split(' ').filter(Boolean)
  if (!words.length) return []
  const has = (s) => words.every((w) => s.includes(w))
  return (posts || [])
    .map((p) => {
      const notes = (p.videos || []).flatMap((v) => (v.notes || []).map((n) => n.text))
      return { p, all: normalizeText([p.title, p.body, p.shelf, ...notes].join(' ')), title: normalizeText(p.title) }
    })
    .filter((x) => has(x.all))
    .sort((a, b) => Number(has(b.title)) - Number(has(a.title)) || String(b.p.createdAt).localeCompare(String(a.p.createdAt)))
    .map((x) => x.p)
}

/** MỚI = người khác đăng, trong `cfg.library.newDays` ngày, mình chưa mở lần nào. */
export function isNewPost(post, mark, myId, nowMs) {
  if (!post || post.authorId === myId || mark?.viewedAt) return false
  const at = Date.parse(post.createdAt)
  return Number.isFinite(at) && nowMs - at <= cfg.library.newDays * DAY_MS
}

/**
 * Bài gợi ý ở dải "Gợi ý tập" trên Home (17b): ngẫu nhiên, ưu tiên bài người khác đăng mà mình chưa
 * mở (bài của mình không bao giờ có lượt xem — RPC library_view bỏ qua tác giả). Mở hết rồi thì chọn
 * trong mọi bài. Không có bài → null. `rnd` trả số trong [0, 1) như Math.random.
 */
export function pickTip(posts, marks, myId, rnd = Math.random) {
  const all = posts || []
  const fresh = all.filter((p) => p.authorId !== myId && !marks?.[p.id]?.viewedAt)
  const pool = fresh.length ? fresh : all
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))] : null
}

/** Tổng độ dài các đoạn cần xem (giây). Có video không ghi giờ kết thúc thì không biết → null. */
export function postLength(post) {
  const vs = post?.videos || []
  if (!vs.length || vs.some((v) => v.end == null)) return null
  return vs.reduce((s, v) => s + (v.end - (v.start || 0)), 0)
}

/* ---------------- Màn đọc bài ---------------- */

/** Mốc đang xem: mốc cuối cùng đã đi qua (`notes` xếp tăng theo t). Chưa tới mốc nào → -1. */
export function activeNoteIdx(notes, t) {
  let idx = -1
  ;(notes || []).forEach((n, i) => { if (t >= n.t - 0.25) idx = i })
  return idx
}

/**
 * Đoạn để "Lặp đoạn": từ mốc đang xem tới mốc kế (hoặc tới hết đoạn của video).
 * Chưa tới mốc nào thì lặp từ đầu đoạn tới mốc đầu. `duration` = độ dài video thật (player báo),
 * dùng khi video không ghi giờ kết thúc. Không ra đoạn dương → null.
 */
export function loopRange(video, t, duration) {
  if (!video) return null
  const notes = video.notes || []
  const stop = video.end ?? (duration > 0 ? duration : null)
  const i = activeNoteIdx(notes, t)
  const a = i < 0 ? (video.start || 0) : notes[i].t
  const b = i < 0 ? (notes[0]?.t ?? stop) : (notes[i + 1]?.t ?? stop)
  return b != null && b > a ? { a, b } : null
}
