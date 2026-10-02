/**
 * Bảng màu theo bậc — chung cho icon huy hiệu và nền hiệu ứng của modal chi tiết.
 * `rgb` dựng mọi lớp trong suốt (viền mờ, chip, quầng sáng); `light → acc → mid` là khung lục
 * giác, glyph và thanh tiến độ; `well` là lòng lục giác.
 * `effect` là nền của thẻ lớn (BadgeDetailModal): chùm sáng cho Hiếm / Tinh anh / Tự phong,
 * cực quang cho Sử thi / Huyền thoại, danh hiệu ẩn chỉ còn bụi sao.
 */
export const TIER_FX = {
  rare: {
    rgb: '95,219,211', acc: '#5FDBD3', mid: '#1E7F78', light: '#D9FFF9',
    well: 'linear-gradient(160deg,#0B2B29,#04100F)', effect: 'beam',
  },
  elite: {
    rgb: '58,160,255', acc: '#7CC0FF', mid: '#1F5FA8', light: '#DDF0FF',
    well: 'linear-gradient(160deg,#0A2038,#050E1A)', effect: 'beam',
  },
  epic: {
    rgb: '168,85,247', acc: '#D2A4FA', mid: '#6B2FB5', light: '#F3E4FF',
    well: 'linear-gradient(160deg,#241042,#10061E)', effect: 'aurora',
    curtains: [['150,90,255', '60,255,170'], ['190,100,255', '70,255,200'], ['120,110,255', '50,240,160'], ['170,90,255', '80,255,190']],
  },
  legend: {
    rgb: '255,122,61', acc: '#FFB38A', mid: '#B8421A', light: '#FFF0DC',
    well: 'linear-gradient(160deg,#3A1208,#1A0804)', effect: 'aurora',
    curtains: [['255,70,130', '60,255,170'], ['255,100,90', '70,255,200'], ['255,150,70', '50,240,160'], ['255,60,150', '80,255,190']],
    conic: '#FFF0DC,#B8421A,#FF7A3D,#FF3D77,#FFF0DC',
  },
  fun: {
    rgb: '246,201,69', acc: '#F6C945', mid: '#8A6A0E', light: '#FFF6D6',
    well: 'linear-gradient(160deg,#2E2306,#120D02)', effect: 'beam',
  },
  hidden: {
    rgb: '142,131,168', acc: '#9A90AD', mid: '#3B2F55', light: '#C9BFDC',
    well: 'linear-gradient(160deg,#1B1030,#0A0514)', effect: null,
  },
}
