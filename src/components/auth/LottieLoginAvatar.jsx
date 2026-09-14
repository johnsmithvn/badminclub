// Component avatar Lottie tương tác cho trang đăng nhập.
// Nhận ref từ ngoài để Login.jsx có thể điều khiển state animation.
// Props animation:
//   isPanic  → rung lắc khi login sai
//   isSuccess → bật lên + nảy khi login thành công
//   isBusy   → pulse nhẹ (thở) trong lúc đang submit
// Dùng @lottielab/lottie-player/react — player duy nhất hỗ trợ interactivity API.

import Lottie from '@lottielab/lottie-player/react'

const KEYFRAMES = `
@keyframes avatar-shake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  10%      { transform: translateX(-10px) rotate(-4deg); }
  20%      { transform: translateX(10px)  rotate(4deg); }
  30%      { transform: translateX(-10px) rotate(-4deg); }
  40%      { transform: translateX(10px)  rotate(4deg); }
  55%      { transform: translateX(-6px)  rotate(-2deg); }
  65%      { transform: translateX(6px)   rotate(2deg); }
  80%      { transform: translateX(-3px)  rotate(-1deg); }
  90%      { transform: translateX(3px)   rotate(1deg); }
}

@keyframes avatar-success {
  0%   { transform: scale(1)    translateY(0); filter: brightness(1); }
  30%  { transform: scale(1.22) translateY(-12px); filter: brightness(1.2) drop-shadow(0 0 12px #06d6a0aa); }
  55%  { transform: scale(1.16) translateY(-6px); filter: brightness(1.15); }
  75%  { transform: scale(1.20) translateY(-9px); filter: brightness(1.18) drop-shadow(0 0 8px #06d6a0aa); }
  100% { transform: scale(1.18) translateY(-8px); filter: brightness(1.15); }
}

@keyframes avatar-pulse {
  0%,100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(0.96); opacity: 0.82; }
}
`

export default function LottieLoginAvatar({ lottieRef, isPanic, isSuccess, isBusy }) {
  // Ưu tiên: panic > success > busy
  const animation = isPanic
    ? 'avatar-shake 0.82s ease'
    : isSuccess
      ? 'avatar-success 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
      : isBusy
        ? 'avatar-pulse 1.2s ease-in-out infinite'
        : 'none'

  return (
    <div style={S.wrap}>
      <style>{KEYFRAMES}</style>
      <div style={{ ...S.avatarBox, animation }}>
        <Lottie
          ref={lottieRef}
          src="/lottie-avatar.json"
          style={S.player}
          autoplay
        />
      </div>
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
  avatarBox: {
    transformOrigin: 'bottom center',
    willChange: 'transform, filter',
  },
  player: {
    width: 200,
    height: 200,
    display: 'block',
  },
}
