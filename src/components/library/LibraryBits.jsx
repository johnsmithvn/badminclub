// Mảnh giao diện dùng chung của Thư viện: chip lọc / chọn kệ, ảnh bìa video, nút lưu.

import { Icon } from '#ds'
import { thumbOf } from '#lib/library.js'

/** Chip tròn: lọc kệ ở thư viện, chọn kệ ở màn đăng bài. `dashed` = nút thêm mới. */
export function Chip({ on, dashed, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={dashed ? undefined : !!on}
      style={{
        flex: '0 0 auto', minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
        font: '600 13px/1 var(--font-sans)',
        background: on ? 'var(--action-primary-bg)' : 'var(--surface-card)',
        color: on ? 'var(--action-primary-fg)' : 'var(--text-secondary)',
        border: `1px ${dashed ? 'dashed' : 'solid'} ${on ? 'var(--action-primary-bg)' : 'var(--border-default)'}`,
      }}
    >
      {children}
    </button>
  )
}

/** Nhãn nhỏ đè lên góc ảnh bìa (thời lượng, Đã xem…). `pos` = vị trí tuyệt đối. */
export function Corner({ pos, sans, children }) {
  return (
    <span style={{
      position: 'absolute', ...pos, padding: '3px 6px', borderRadius: 4, whiteSpace: 'nowrap',
      background: 'var(--surface-scrim)', color: 'var(--gray-0)',
      font: sans ? '600 10.5px/1 var(--font-sans)' : '500 10.5px/1 var(--font-mono)',
    }}>
      {children}
    </span>
  )
}

/** Ảnh bìa = thumbnail YouTube của video đầu. Không có ảnh thì để nền lõm, không vẽ minh hoạ. */
export function Thumb({ url, ratio = '16 / 10', radius = 10, children }) {
  const src = thumbOf(url)
  return (
    <div style={{
      position: 'relative', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden',
      background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
    }}>
      {src && <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      {children}
    </div>
  )
}

/** Nút dấu trang ở góc ảnh. Vùng bấm 44px, vòng tròn nhìn thấy 28px. */
export function SaveButton({ saved, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!!saved}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        position: 'absolute', top: 0, right: 0, width: 44, height: 44, padding: 0,
        background: 'transparent', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--surface-scrim)', display: 'grid', placeItems: 'center' }}>
        <Icon name="bookmark" size={14} style={{
          color: saved ? 'var(--action-accent-bg)' : 'var(--gray-0)', fill: saved ? 'currentColor' : 'none',
        }} />
      </span>
    </button>
  )
}
