import { Icon } from '#ds'

/**
 * Component hiển thị Tag/Badge cho từng người chơi trong đội,
 * giúp phân biệt rõ ràng từng thành viên độc lập, tránh nhầm lẫn 2 người thành 1 dòng text xuống dòng.
 */
export default function ArenaPlayerTag({
  name = '',
  team = 'A',
  isAccepted = false,
  isWinner = false,
  isFeatured = false,
  isMobile = false,
  align = 'left',
  maxLines = 1,
  style = {},
}) {
  const isTeamA = team === 'A'
  const isRight = align === 'right'

  // Màu sắc viền & nền theo phe A (Teal) hoặc B (Coral)
  const borderColor = isWinner
    ? 'rgba(95, 217, 162, 0.4)'
    : (isTeamA ? 'rgba(46, 196, 182, 0.28)' : 'rgba(255, 122, 89, 0.28)')

  const bgColor = isWinner
    ? 'rgba(95, 217, 162, 0.1)'
    : (isTeamA ? 'rgba(46, 196, 182, 0.08)' : 'rgba(255, 122, 89, 0.08)')

  const dotColor = isWinner
    ? '#5FD9A2'
    : (isTeamA ? '#2EC4B6' : '#FF7A59')

  const fontSize = isFeatured
    ? (isMobile ? 13.5 : 15.5)
    : (isMobile ? 12 : 13.5)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexDirection: isRight ? 'row-reverse' : 'row',
        gap: 5,
        padding: isFeatured ? '3px 8px' : '2.5px 7px',
        borderRadius: 6,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Bullet Dot phân biệt thành viên */}
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: `0 0 5px ${dotColor}`,
        }}
      />

      {/* Vương miện thắng */}
      {isWinner && (
        <span style={{ fontSize: 11, flexShrink: 0, lineHeight: 1 }}>👑</span>
      )}

      {/* Tên người chơi */}
      <span
        title={name}
        style={{
          font: `${isFeatured ? 700 : 600} ${fontSize}px/1.25 "IBM Plex Sans", sans-serif`,
          color: isWinner ? '#5FD9A2' : '#F4F7FB',
          textAlign: isRight ? 'right' : 'left',
          ...(maxLines > 1
            ? {
                display: '-webkit-box',
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }
            : {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }),
          minWidth: 0,
        }}
      >
        {name}
      </span>

      {/* Icon xác nhận kèo nếu đang pending */}
      {isAccepted && (
        <Icon
          name="check"
          size={12}
          style={{ color: '#2EC4B6', flexShrink: 0 }}
        />
      )}
    </div>
  )
}
