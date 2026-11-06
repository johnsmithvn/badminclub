// id game → màn chơi, tải lười: vào phòng Caro mới tải bàn Caro, vào sảnh chưa tải màn nào.
// Thêm game: thêm một dòng ở đây + một dòng ở lib/games/registry.js.

import { lazy } from 'react'

export const SCREENS = {
  caro: lazy(() => import('#components/games/CaroBoard.jsx')),
  oanquan: lazy(() => import('#components/games/OAnQuanBoard.jsx')),
  coganh: lazy(() => import('#components/games/CoGanhBoard.jsx')),
  colat: lazy(() => import('#components/games/CoLatBoard.jsx')),
  chamo: lazy(() => import('#components/games/ChamOBoard.jsx')),
}
