import React from 'react'

/**
 * Component Mề đay xếp hạng chuẩn thiết kế 14a · CHỐT.
 * Dùng cho các dòng Top 1, Top 2, Top 3 của bảng Đua Top Mùa Giải & Bảng Đẳng Cấp Elo.
 */
export default function RankMedalIcon({ rank, size = 28 }) {
  if (rank === 1) {
    return (
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'inline-block',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'conic-gradient(from 210deg, #7A5620, #F0B75C, #FFF3C4, #F0D26A, #7A5620)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 2.5,
            borderRadius: 999,
            background: 'radial-gradient(130% 130% at 50% 6%, #4A3208, #160E01 74%)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            font: "700 13px/1 'Barlow', sans-serif",
            color: '#F7E3A1',
          }}
        >
          1
        </span>
      </span>
    )
  }

  if (rank === 2) {
    return (
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'inline-block',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'conic-gradient(from 210deg, #5B6B81, #C7D2E4, #FFFFFF, #8FA3BE, #5B6B81)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 2.5,
            borderRadius: 999,
            background: 'radial-gradient(130% 130% at 50% 6%, #162235, #090D14 74%)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            font: "700 13px/1 'Barlow', sans-serif",
            color: '#DCE6F5',
          }}
        >
          2
        </span>
      </span>
    )
  }

  if (rank === 3) {
    return (
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'inline-block',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'conic-gradient(from 210deg, #5C2C10, #C77C48, #F5C09A, #C77C48, #5C2C10)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 2.5,
            borderRadius: 999,
            background: 'radial-gradient(130% 130% at 50% 6%, #3D1A08, #120602 74%)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            font: "700 13px/1 'Barlow', sans-serif",
            color: '#F5C09A',
          }}
        >
          3
        </span>
      </span>
    )
  }

  return (
    <span
      style={{
        width: size,
        textAlign: 'center',
        font: "600 13px/1 'IBM Plex Mono', monospace",
        color: 'var(--text-muted)',
        display: 'inline-block',
      }}
    >
      {rank}
    </span>
  )
}
