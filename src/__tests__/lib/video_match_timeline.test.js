// node src/__tests__/lib/video_match_timeline.test.js
import assert from 'node:assert/strict'
import {
  parseVideoProvider,
  formatVideoDisplayLabel,
  parseTimestampToSeconds,
  buildPlayableVideoUrl,
  formatGapMinutes,
  calcSessionTimeStats,
} from '#utils/videoUtils.js'

/* 1. parseVideoProvider: nhận diện đúng YouTube, Drive, iCloud, Direct, Unknown */
assert.equal(parseVideoProvider('https://www.youtube.com/watch?v=8kQz1Rw_29k'), 'youtube')
assert.equal(parseVideoProvider('https://youtu.be/8kQz1Rw_29k'), 'youtube')
assert.equal(parseVideoProvider('https://drive.google.com/file/d/1A2B3C4D/view'), 'drive')
assert.equal(parseVideoProvider('https://share.icloud.com/photos/0abc123xyz'), 'icloud')
assert.equal(parseVideoProvider('https://icloud.com/photos/abc'), 'icloud')
assert.equal(parseVideoProvider('https://cdn.example.com/match.mp4'), 'direct')
assert.equal(parseVideoProvider('https://example.com/live-stream.webm'), 'direct')
assert.equal(parseVideoProvider(''), 'unknown')
assert.equal(parseVideoProvider(null), 'unknown')

/* 2. parseTimestampToSeconds: chuyển đổi chuỗi thời gian mm:ss, hh:mm:ss, số giây */
assert.equal(parseTimestampToSeconds('42'), 42)
assert.equal(parseTimestampToSeconds(42), 42)
assert.equal(parseTimestampToSeconds('00:42'), 42)
assert.equal(parseTimestampToSeconds('01:15'), 75)
assert.equal(parseTimestampToSeconds('01:20:30'), 4830) // 1*3600 + 20*60 + 30
assert.equal(parseTimestampToSeconds(''), 0)
assert.equal(parseTimestampToSeconds(null), 0)

/* 3. buildPlayableVideoUrl: gắn timestamp cho YouTube chuẩn xác */
assert.equal(
  buildPlayableVideoUrl('https://youtu.be/8kQz1Rw_29k', '01:15'),
  'https://youtu.be/8kQz1Rw_29k?t=75'
)
assert.equal(
  buildPlayableVideoUrl('https://www.youtube.com/watch?v=8kQz1Rw_29k', '00:42'),
  'https://www.youtube.com/watch?v=8kQz1Rw_29k&t=42'
)
assert.equal(
  buildPlayableVideoUrl('https://youtu.be/8kQz1Rw_29k?t=100', '01:15'),
  'https://youtu.be/8kQz1Rw_29k?t=100',
  'không ghi đè nếu URL đã có sẵn t='
)
assert.equal(
  buildPlayableVideoUrl('https://drive.google.com/file/d/123/view', '01:15'),
  'https://drive.google.com/file/d/123/view',
  'drive giữ nguyên URL'
)
assert.equal(
  buildPlayableVideoUrl('youtu.be/8kQz1Rw_29k', '01:15'),
  'https://youtu.be/8kQz1Rw_29k?t=75',
  'tự động thêm https:// khi thiếu protocol'
)

/* 4. formatVideoDisplayLabel: rút gọn link hiển thị đẹp mắt */
assert.equal(
  formatVideoDisplayLabel('https://youtu.be/8kQz1Rw_29k', '01:15'),
  'youtu.be/8kQz1Rw_29k · từ 01:15'
)
assert.equal(
  formatVideoDisplayLabel('https://drive.google.com/file/d/abc'),
  'drive.google.com/file/d/abc'
)

/* 5. formatGapMinutes: tính khoảng cách giữa 2 trận */
assert.equal(formatGapMinutes(Date.parse('2026-09-12T19:20:00Z'), null), 'mở buổi')
assert.equal(
  formatGapMinutes(Date.parse('2026-09-12T19:35:00Z'), Date.parse('2026-09-12T19:15:00Z')),
  '+20′'
)
assert.equal(
  formatGapMinutes(Date.parse('2026-09-12T20:30:00Z'), Date.parse('2026-09-12T19:15:00Z')),
  '+1h15′'
)
assert.equal(
  formatGapMinutes(Date.parse('2026-09-12T21:15:00Z'), Date.parse('2026-09-12T19:15:00Z')),
  '+2h'
)

/* 6. calcSessionTimeStats: tính mốc giờ của buổi tập */
const mockMatches = [
  { id: 'm1', at: Date.parse('2026-09-12T19:14:00+07:00'), minutes: 16, videoUrl: 'https://youtu.be/1' },
  { id: 'm2', at: Date.parse('2026-09-12T19:35:00+07:00'), minutes: 18 },
  { id: 'm3', at: Date.parse('2026-09-12T20:10:00+07:00'), minutes: 20, videoUrl: 'https://youtu.be/2' },
  { id: 'm4', at: Date.parse('2026-09-12T21:40:00+07:00'), minutes: 18 },
]

const stats = calcSessionTimeStats(mockMatches)
assert.equal(stats.totalMatchesCount, 4)
assert.equal(stats.videoCount, 2)
assert.ok(stats.firstMatchTime.includes('19:14'))
assert.ok(stats.lastMatchTime.includes('21:40'))
assert.ok(stats.longestRestText.includes('M-03') || stats.longestRestText.includes('90′') || stats.longestRestText.includes('1h30′'))
assert.ok(stats.avgDurationText.length > 0)

// Trường hợp danh sách rỗng
const emptyStats = calcSessionTimeStats([])
assert.equal(emptyStats.firstMatchTime, '—')
assert.equal(emptyStats.totalMatchesCount, 0)

console.log('video_match_timeline check: OK')
