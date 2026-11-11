import CoTuongBoard from '#components/games/CoTuongBoard.jsx'
import { movesFrom } from '#lib/games/coup.js'

// Bàn Cờ úp = bàn Cờ tướng + luật đi của coup.js (quân úp đi theo quân gốc ở ô đó, vẽ mặt lưng).
// `plain`: không hiện quân đã ăn / cán cân — quân còn úp thì chưa biết giá trị.
export default function CoUpBoard(props) {
  return <CoTuongBoard {...props} movesFrom={movesFrom} reasons="games.coup.reason." marks="games.coup.mark" plain />
}
