/**
 * Tiện ích xử lý URL Video, Timestamp và Mốc thời gian trận đấu
 */

/**
 * Phân loại nền tảng video từ URL
 * @param {string} url
 * @returns {'youtube' | 'drive' | 'icloud' | 'direct' | 'unknown'}
 */
export function parseVideoProvider(url) {
  if (!url || typeof url !== 'string') return 'unknown'
  const trimmed = url.trim().toLowerCase()
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) return 'youtube'
  if (trimmed.includes('drive.google.com')) return 'drive'
  if (trimmed.includes('icloud.com') || trimmed.includes('share.icloud.com')) return 'icloud'
  if (trimmed.endsWith('.mp4') || trimmed.endsWith('.webm') || trimmed.endsWith('.mov')) return 'direct'
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'direct'
  return 'unknown'
}

/**
 * Trích xuất nhãn ngắn của video URL để hiển thị (ví dụ: youtu.be/8kQz1Rw)
 * @param {string} url
 * @param {string} [timestamp]
 * @returns {string}
 */
export function formatVideoDisplayLabel(url, timestamp = '') {
  if (!url) return ''
  let label = url.trim()
  try {
    const u = new URL(url)
    label = `${u.hostname.replace('www.', '')}${u.pathname.length > 1 ? u.pathname : ''}`
  } catch {
    label = url.replace(/^https?:\/\/(www\.)?/, '')
  }
  if (timestamp && timestamp.trim()) {
    return `${label} · từ ${timestamp.trim()}` // i18n-ok: video label format
  }
  return label
}

/**
 * Chuyển đổi chuỗi timestamp (vd "00:42", "1:15", "01:20:30", "42s") thành số giây
 * @param {string|number} ts
 * @returns {number}
 */
export function parseTimestampToSeconds(ts) {
  if (ts == null) return 0
  if (typeof ts === 'number') return Math.max(0, Math.floor(ts))
  const s = String(ts).trim()
  if (!s) return 0

  // Trường hợp số nguyên
  if (/^\d+$/.test(s)) return parseInt(s, 10)

  // Trường hợp mm:ss hoặc hh:mm:ss
  const parts = s.split(':').map((p) => parseInt(p, 10) || 0)
  if (parts.length === 2) {
    const [min, sec] = parts
    return min * 60 + sec
  }
  if (parts.length === 3) {
    const [hr, min, sec] = parts
    return hr * 3600 + min * 60 + sec
  }
  return 0
}

/**
 * Tạo URL có thể phát trực tiếp kèm mốc thời gian bắt đầu
 * @param {string} url
 * @param {string|number} [timestamp]
 * @returns {string}
 */
export function buildPlayableVideoUrl(url, timestamp = '') {
  if (!url || typeof url !== 'string') return ''
  let trimmed = url.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }
  const provider = parseVideoProvider(trimmed)
  const seconds = parseTimestampToSeconds(timestamp)

  if (provider === 'youtube') {
    // Nếu có timestamp và URL chưa có tham số t=
    if (seconds > 0 && !trimmed.includes('t=') && !trimmed.includes('&t=') && !trimmed.includes('?t=')) {
      const separator = trimmed.includes('?') ? '&' : '?'
      return `${trimmed}${separator}t=${seconds}`
    }
    return trimmed
  }

  return trimmed
}

/**
 * Tính khoảng cách thời gian giữa 2 trận đấu trong cùng một buổi
 * @param {number} currentMatchAt - timestamp ms của trận hiện tại
 * @param {number|null} prevMatchAt - timestamp ms của trận liền trước trong cùng buổi (null nếu là trận đầu)
 * @returns {string} ví dụ: "mở buổi", "+20′", "+4h25′"
 */
export function formatGapMinutes(currentMatchAt, prevMatchAt) {
  if (!prevMatchAt || !currentMatchAt || currentMatchAt <= prevMatchAt) {
    return 'mở buổi' // i18n-ok: fallback gap text
  }

  const diffMs = currentMatchAt - prevMatchAt
  const totalMinutes = Math.round(diffMs / 60000)

  if (totalMinutes <= 0) {
    return '+0′'
  }
  if (totalMinutes < 60) {
    return `+${totalMinutes}′`
  }

  const hours = Math.floor(totalMinutes / 60)
  const remainingMins = totalMinutes % 60
  if (remainingMins === 0) {
    return `+${hours}h`
  }
  return `+${hours}h${remainingMins}′`
}

/**
 * Tính toán thống kê nhịp độ buổi tập (Trận đầu, Trận cuối, Nghỉ dài nhất, Trung bình mỗi trận)
 * @param {Array} sessionMatches - Danh sách trận đấu trong buổi
 * @returns {{
 *   firstMatchTime: string,
 *   lastMatchTime: string,
 *   longestRestText: string,
 *   avgDurationText: string,
 *   totalMatchesCount: number,
 *   videoCount: number
 * }}
 */
export function calcSessionTimeStats(sessionMatches = []) {
  if (!sessionMatches || !sessionMatches.length) {
    return {
      firstMatchTime: '—',
      lastMatchTime: '—',
      longestRestText: '—',
      avgDurationText: '—',
      totalMatchesCount: 0,
      videoCount: 0,
    }
  }

  // Sắp xếp theo thứ tự thời gian tăng dần
  const sorted = [...sessionMatches].sort((a, b) => (a.at || 0) - (b.at || 0))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const firstDate = first.at ? new Date(first.at) : null
  const lastDate = last.at ? new Date(last.at) : null

  const firstMatchTime = firstDate ? firstDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '19:00'
  const lastMatchTime = lastDate ? lastDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '21:20'

  let maxGapMs = 0
  let maxGapAfterMatchCode = ''
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.at && prev.at && cur.at > prev.at) {
      const gap = cur.at - prev.at
      if (gap > maxGapMs) {
        maxGapMs = gap
        maxGapAfterMatchCode = `M-${String(i).padStart(2, '0')}`
      }
    }
  }

  const longestGapMins = maxGapMs > 0 ? Math.round(maxGapMs / 60000) : 0
  const longestRestText = longestGapMins > 0
    ? `${longestGapMins}′${maxGapAfterMatchCode ? ' · sau ' + maxGapAfterMatchCode : ''}`
    : '—'

  // Trung bình mỗi trận
  const totalMins = sorted.reduce((acc, m) => acc + (m.minutes || 20), 0)
  const avgDuration = Math.round(totalMins / sorted.length)
  const avgDurationText = `${avgDuration}′`

  const videoCount = sorted.filter((m) => Boolean(m.videoUrl)).length

  return {
    firstMatchTime,
    lastMatchTime,
    longestRestText,
    avgDurationText,
    totalMatchesCount: sorted.length,
    videoCount,
  }
}
