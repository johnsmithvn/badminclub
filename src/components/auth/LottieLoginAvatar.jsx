// Component avatar Lottie tương tác cho trang đăng nhập.
// Nhận ref từ ngoài để Login.jsx có thể điều khiển state animation.
// Dùng @lottielab/lottie-player/react — player duy nhất hỗ trợ interactivity API.

import Lottie from '@lottielab/lottie-player/react'

export default function LottieLoginAvatar({ lottieRef }) {
  return (
    <div style={S.wrap}>
      <Lottie
        ref={lottieRef}
        src="/lottie-avatar.json"
        style={S.player}
        autoplay
      />
    </div>
  )
}

const S = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  player: {
    width: 200,
    height: 200,
  },
}
