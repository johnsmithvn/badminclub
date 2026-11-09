// id game → màn chơi, tải lười: vào phòng Caro mới tải bàn Caro, vào sảnh chưa tải màn nào.
// Thêm game: thêm một dòng ở đây + một dòng ở lib/games/registry.js.

import { lazy } from 'react'

export const SCREENS = {
  caro: lazy(() => import('#components/games/CaroBoard.jsx')),
  oanquan: lazy(() => import('#components/games/OAnQuanBoard.jsx')),
  coganh: lazy(() => import('#components/games/CoGanhBoard.jsx')),
  colat: lazy(() => import('#components/games/CoLatBoard.jsx')),
  chamo: lazy(() => import('#components/games/ChamOBoard.jsx')),
  tienlen: lazy(() => import('#components/games/TienLenBoard.jsx')),
  covua: lazy(() => import('#components/games/CoVuaBoard.jsx')),
  cotuong: lazy(() => import('#components/games/CoTuongBoard.jsx')),
  cangua: lazy(() => import('#components/games/CaNguaBoard.jsx')),
  bantau: lazy(() => import('#components/games/BanTauBoard.jsx')),
  domino: lazy(() => import('#components/games/DominoBoard.jsx')),
  baibip: lazy(() => import('#components/games/BaiBipBoard.jsx')),
  noitu: lazy(() => import('#components/games/NoiTuBoard.jsx')),
  masoi: lazy(() => import('#components/games/MaSoiBoard.jsx')),
  covay: lazy(() => import('#components/games/CoVayBoard.jsx')),
  phom: lazy(() => import('#components/games/PhomBoard.jsx')),
}
