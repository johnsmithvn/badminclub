// Bảng màu "fantasy" của bàn Cờ vua và Cờ tướng (chủ dự án yêu cầu 2026-11-10): khung tím đêm viền vàng, ngọc ở
// góc, ánh sáng ngọc lam cho nước đi. Màu VIẾT CỨNG và giữ nguyên ở cả hai chế độ sáng / tối — bàn cờ là một "vật"
// có màu riêng, như màn Danh hiệu (DESIGN.md §2.3, §2.4). Chỉ hai bàn này dùng; phần chữ / nút quanh bàn vẫn theo token.

export const F = {
  // Khung
  frame0: '#2a1f52',
  frame1: '#0e0920',
  // Vàng (viền, đường kẻ, chữ) — sáng → đậm → tối
  gold0: '#f8e6a8',
  gold1: '#d2a544',
  gold2: '#7d5718',
  // Bạc (quân đen Cờ tướng)
  silver0: '#f1f4fb',
  silver1: '#9aa6bf',
  // Ánh sáng tương tác
  gem: '#62e6d2', // ngọc ở góc khung
  glow: '#7ff5e4', // nước vừa đi, điểm đi được
  pick: '#ffd76a', // quân đang chọn
  danger: '#ff5a6e', // bị chiếu
  shade: '#05030c', // bóng đổ dưới quân

  // Cờ vua: ô đá mặt trăng / thạch anh tím; quân ngà-vàng và quân hắc diện thạch
  sqLight: '#c9c0ea',
  sqDark: '#5b4a96',
  white0: '#fffdf3',
  white1: '#ecc878',
  whiteEdge: '#2d1c52',
  black0: '#43347a',
  black1: '#0c071c',
  blackEdge: '#dccdff',

  // Cờ tướng: mặt bàn ngọc bích sẫm; quân đỏ chữ vàng, quân đen chữ bạc
  jade0: '#1b4a43',
  jade1: '#0a2320',
  red0: '#c22a39',
  red1: '#5a0c16',
  ink0: '#454a61',
  ink1: '#11131c',
}
