import { useSyncExternalStore } from 'react'

// Skin bàn Cờ vua / Cờ tướng (bản thiết kế "Co Vua" / "Co Tuong") và vùng biển Bắn tàu (bản "Bắn tàu", 2026-11-12). Bàn cờ là một "vật" có màu riêng nên màu VIẾT CỨNG
// và giữ nguyên ở chế độ sáng / tối (DESIGN.md §2.4) — khác phần chữ / thẻ quanh bàn vẫn theo token.
// Skin chỉ là bảng màu: đổi skin không tải gì thêm, chỉ vẽ skin đang chọn. Lưu theo từng máy (localStorage).
//   acc / rgb — màu nhấn (nước đi, gợi ý, đồng hồ đang chạy); frame / border — khung; page — quầng sáng sau bàn.
// Cờ vua: L / D ô sáng / tối · wG / bG chuyển màu quân trắng / đen (tô lên chữ ký hiệu) · wF / bF bóng quân ·
//   wC / bC màu mảnh bung khi quân trắng / đen bị ăn · cL / cD màu chữ toạ độ trên ô sáng / tối.
// Cờ tướng: board mặt bàn · line đường kẻ · river chữ Sở hà Hán giới · label toạ độ · rD / bD mặt quân đỏ / đen ·
//   rI / bI chữ quân · rG / bG ánh chữ · dSh bóng quân · rC / bC mảnh bung · motes bụi sáng · blend kiểu hoà sáng.
// Bắn tàu: sea mặt biển · grid đường kẻ · wave sóng trôi · sweep tia radar quét · paper kiểu giấy (trúng vẽ dấu X thay
//   lửa, tàu chìm mờ đi thay vì cháy xám) · hull / deck / det / stroke thân / boong / chi tiết / viền tàu · miss / missBg
//   vòng trượt · lab chữ toạ độ · frame viền biển khi không tới lượt.
// Cờ cá ngựa: board mặt bàn · frame khung · cell ô đường · line viền ô · num chữ số / mũi tên · center ô giữa ·
//   col / dark màu 4 phe (đỏ, xanh lá, vàng, xanh dương) sáng / tối · panel / slot lòng chuồng / chỗ ngựa · glow vòng sáng
//   ngựa đi được · pawnHi nét sáng trên ngựa.

export const SKINS = {
  covua: {
    arcane: {
      L: 'linear-gradient(135deg,#ddd3f7,#c6b8ec)', D: 'linear-gradient(135deg,#6b59b2,#4e3e91)', frame: 'linear-gradient(160deg,#2e2058,#140c2b)',
      border: '#d9b45a', acc: '#ffd77a', rgb: '255,215,122', page: 'rgba(98,60,190,.22)', sw: 'linear-gradient(135deg,#6b59b2,#4e3e91)',
      wG: 'linear-gradient(180deg,#fffaf0 15%,#f1d58a 58%,#b0802a)', wF: 'drop-shadow(0 2px 1px rgba(40,20,0,.6)) drop-shadow(0 0 6px rgba(255,215,122,.55))',
      bG: 'linear-gradient(180deg,#b79bff 0%,#5530a8 55%,#1d0f45)', bF: 'drop-shadow(0 2px 1px rgba(0,0,0,.65)) drop-shadow(0 0 8px rgba(180,140,255,.8))',
      wC: ['#fff6d8', '#f1d58a', '#ffe9a8'], bC: ['#b79bff', '#7b4fd6', '#d9c8ff'], cL: '#4e3e91', cD: '#ddd3f7', wS: '#e9dcb4', bS: '#9c86d8',
    },
    frost: {
      L: 'linear-gradient(135deg,#f0f8fd,#d4e8f4)', D: 'linear-gradient(135deg,#7fa7c8,#56809f)', frame: 'linear-gradient(160deg,#18375a,#081426)',
      border: '#cfe6f5', acc: '#9fe3ff', rgb: '159,227,255', page: 'rgba(40,120,200,.2)', sw: 'linear-gradient(135deg,#7fa7c8,#56809f)',
      wG: 'linear-gradient(180deg,#ffffff 20%,#d3efff 60%,#7cb2d8)', wF: 'drop-shadow(0 2px 1px rgba(0,20,40,.6)) drop-shadow(0 0 7px rgba(159,227,255,.7))',
      bG: 'linear-gradient(180deg,#6f9fcf,#1f4672 55%,#0a1a30)', bF: 'drop-shadow(0 2px 1px rgba(0,0,0,.6)) drop-shadow(0 0 8px rgba(127,212,255,.8))',
      wC: ['#ffffff', '#d3efff', '#9fe3ff'], bC: ['#6f9fcf', '#3a73a8', '#bfe6ff'], cL: '#56809f', cD: '#f0f8fd', wS: '#cfe6f5', bS: '#3a73a8',
    },
    grove: {
      L: 'linear-gradient(135deg,#f0e6c9,#dccfa9)', D: 'linear-gradient(135deg,#6f8c55,#4c6838)', frame: 'linear-gradient(160deg,#2e2614,#141008)',
      border: '#c9a45c', acc: '#c8f08a', rgb: '200,240,138', page: 'rgba(80,140,50,.2)', sw: 'linear-gradient(135deg,#6f8c55,#4c6838)',
      wG: 'linear-gradient(180deg,#fffdf0 20%,#ecd99a 60%,#a5873a)', wF: 'drop-shadow(0 2px 1px rgba(30,20,0,.6)) drop-shadow(0 0 6px rgba(236,217,154,.6))',
      bG: 'linear-gradient(180deg,#a6d176,#3f5c24 55%,#17240c)', bF: 'drop-shadow(0 2px 1px rgba(0,0,0,.6)) drop-shadow(0 0 8px rgba(168,224,122,.8))',
      wC: ['#fffdf0', '#ecd99a', '#fff3b8'], bC: ['#a6d176', '#5f8a36', '#d6f5a8'], cL: '#4c6838', cD: '#f0e6c9', wS: '#c9b37a', bS: '#5f8a36',
    },
  },
  cotuong: {
    jade: {
      board: 'radial-gradient(ellipse at 50% 50%,#e6f5ec,#bfe0cd 70%,#9fcab4)', size: '100% 100%', frame: 'linear-gradient(160deg,#173b2d,#08170f)',
      border: '#c9a45c', line: '#2f5f49', river: '#2f5f49', label: '#2f5f49', acc: '#7fffd4', rgb: '127,255,212', page: 'rgba(40,160,120,.18)', sw: '#5fae8a',
      rD: 'radial-gradient(circle at 35% 30%,#fffaf0,#f0dcb8 58%,#c49a66)', rI: '#c21f2b', rG: '0 0 8px rgba(255,90,90,.45)',
      bD: 'radial-gradient(circle at 35% 30%,#effff7,#a7dcc3 55%,#3f8a69)', bI: '#0d3627', bG: '0 0 6px rgba(127,255,212,.5)',
      dSh: '0 3px 0 rgba(60,40,10,.55),0 8px 14px rgba(0,0,0,.35)', rC: ['#ff7a7a', '#ffd0a0', '#ffffff'], bC: ['#7fffd4', '#c8ffe9', '#4fd1a5'], motes: true, blend: 'screen',
    },
    lacquer: {
      board: 'radial-gradient(1.5px 1.5px at 40px 60px,rgba(232,195,106,.75),transparent),radial-gradient(1px 1px at 150px 20px,rgba(255,220,140,.6),transparent),radial-gradient(2px 2px at 90px 130px,rgba(232,195,106,.5),transparent),linear-gradient(135deg,#561310,#2a0705 55%,#420c09)',
      size: '200px 160px,200px 160px,200px 160px,100% 100%', frame: 'linear-gradient(160deg,#2a0806,#0d0202)',
      border: '#d4a44a', line: '#d4a44a', river: '#e8c36a', label: '#e8c36a', acc: '#ffd77a', rgb: '255,215,122', page: 'rgba(170,30,20,.2)', sw: '#9a1d16',
      rD: 'radial-gradient(circle at 35% 30%,#fff3c8,#e8c36a 55%,#9a6b1e)', rI: '#8a0f0f', rG: '0 0 4px rgba(255,240,200,.6)',
      bD: 'radial-gradient(circle at 35% 30%,#5a5a5a,#1a1a1a 55%,#000)', bI: '#ecc670', bG: '0 0 8px rgba(232,195,106,.7)',
      dSh: '0 3px 0 rgba(0,0,0,.65),0 8px 16px rgba(0,0,0,.55)', rC: ['#ffd77a', '#fff1c2', '#ff9a6a'], bC: ['#e8c36a', '#fff1c2', '#b8893a'], motes: true, blend: 'screen',
    },
    ink: {
      board: 'radial-gradient(ellipse at 25% 15%,rgba(60,40,20,.08),transparent 45%),radial-gradient(ellipse at 80% 85%,rgba(60,40,20,.08),transparent 45%),linear-gradient(160deg,#f6eedc,#e7dabd)',
      size: '100% 100%', frame: 'linear-gradient(160deg,#3a2e22,#17110b)',
      border: '#8a6a44', line: '#2a2420', river: '#2a2420', label: '#5a4a38', acc: '#ff5a5f', rgb: '255,90,95', page: 'rgba(200,170,120,.14)', sw: '#d9c9a8',
      rD: 'radial-gradient(circle at 35% 30%,#fbecd0,#deb985 58%,#a2733f)', rI: '#b3202a', rG: 'none',
      bD: 'radial-gradient(circle at 35% 30%,#fbecd0,#deb985 58%,#a2733f)', bI: '#1c1714', bG: 'none',
      dSh: '0 3px 0 #6b4a25,0 8px 14px rgba(0,0,0,.35)', rC: ['#b3202a', '#e0484e', '#7a1218'], bC: ['#1c1714', '#3a322b', '#000000'], motes: false, blend: 'multiply',
    },
  },
  bantau: {
    ocean: {
      sea: 'radial-gradient(120% 90% at 50% 0%,#1d6fa8 0%,#0f4a7d 45%,#0a2f55 100%)', grid: 'rgba(255,255,255,.13)', wave: true, sweep: false, paper: false,
      hull: '#8d9aa8', deck: '#c3ccd6', det: '#4b5866', stroke: '#2a333d', miss: 'rgba(255,255,255,.9)', missBg: 'rgba(255,255,255,.18)', lab: '#A8B7CB',
      frame: '#22304A', sw: 'linear-gradient(135deg,#0f4a7d 50%,#c3ccd6 50%)',
    },
    radar: {
      sea: 'radial-gradient(circle at 50% 50%,#0a2c22 0%,#05170f 70%,#030d09 100%)', grid: 'rgba(80,255,170,.2)', wave: false, sweep: true, paper: false,
      hull: 'rgba(60,255,160,.18)', deck: 'rgba(60,255,160,.32)', det: '#5dffb0', stroke: '#5dffb0', miss: '#5dffb0', missBg: 'rgba(93,255,176,.15)', lab: '#5dffb0',
      frame: '#1c4b38', sw: 'linear-gradient(135deg,#05170f 50%,#5dffb0 50%)',
    },
    paper: {
      sea: 'linear-gradient(#fbf8ef,#f6f1e2)', grid: 'rgba(70,120,200,.32)', wave: false, sweep: false, paper: true,
      hull: 'rgba(60,70,90,.10)', deck: 'rgba(60,70,90,.06)', det: '#3c465a', stroke: '#3c465a', miss: '#2a3550', missBg: 'transparent', lab: '#8494AA',
      frame: '#d9cfbb', sw: 'linear-gradient(135deg,#fbf8ef 50%,#3c465a 50%)',
    },
  },
  cangua: {
    classic: {
      board: '#fbf7ee', frame: '#1b2540', cell: '#fffdf8', line: '#d9cfbb', num: '#5b4a33', center: '#fffdf8',
      col: ['#e53935', '#2e9e57', '#f2b705', '#1e6fd9'], dark: ['#9c1f1c', '#1d6b3a', '#a77c00', '#134a94'], panel: '#fffdf8', slot: '#efe7d6',
      glow: 'rgba(255,255,255,.9)', pawnHi: 'rgba(255,255,255,.75)', sw: 'linear-gradient(135deg,#fbf7ee 50%,#e53935 50%)',
    },
    night: {
      board: '#0c1426', frame: '#22304A', cell: '#14203a', line: 'rgba(148,163,184,.22)', num: '#c9d6ea', center: '#0c1426',
      col: ['#ff5d73', '#3ee08f', '#ffd25a', '#4da3ff'], dark: ['#b02a3e', '#1f9a5c', '#c79a1c', '#2367c4'], panel: '#0f192e', slot: '#1a2742',
      glow: 'rgba(160,240,225,.9)', pawnHi: 'rgba(255,255,255,.6)', sw: 'linear-gradient(135deg,#0c1426 50%,#ff5d73 50%)',
    },
    lacquer: {
      board: '#2a0f0b', frame: '#c9973f', cell: '#3b1611', line: 'rgba(201,151,63,.45)', num: '#f2d79a', center: '#2a0f0b',
      col: ['#d23a2b', '#2f9e7a', '#e2b04a', '#3b6fd1'], dark: ['#8a1f15', '#1b6b50', '#9c7420', '#244a96'], panel: '#1d0a07', slot: '#3b1611',
      glow: 'rgba(248,231,168,.95)', pawnHi: 'rgba(255,240,210,.7)', sw: 'linear-gradient(135deg,#2a0f0b 50%,#d23a2b 50%)',
    },
  },
}
const DEFAULT = { covua: 'arcane', cotuong: 'lacquer', bantau: 'ocean', cangua: 'classic' }

// Kho skin nhỏ: đọc / ghi localStorage, báo mọi chỗ đang dùng (nút chọn ở đầu trang + bàn cờ) cùng đổi.
const KEY = 'gameskin:'
const subs = new Set()
const read = (kind) => {
  try {
    const v = localStorage.getItem(KEY + kind)
    return SKINS[kind]?.[v] ? v : DEFAULT[kind]
  } catch { return DEFAULT[kind] }
}
export function setSkin(kind, id) {
  try { localStorage.setItem(KEY + kind, id) } catch { /* trình duyệt chặn lưu — chỉ đổi trong phiên */ }
  mem[kind] = id
  subs.forEach((f) => f())
}
const mem = {}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }

/** Skin đang chọn của `kind` ('covua' | 'cotuong' | 'bantau' | 'cangua') → [id, palette]. */
export function useSkin(kind) {
  const id = useSyncExternalStore(subscribe, () => mem[kind] || read(kind), () => DEFAULT[kind])
  return [id, SKINS[kind][id]]
}
