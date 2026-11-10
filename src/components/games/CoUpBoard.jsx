import CoTuongBoard from '#components/games/CoTuongBoard.jsx'
import { movesFrom } from '#lib/games/coup.js'

// Bàn Cờ úp = bàn Cờ tướng + luật đi của coup.js (quân úp đi theo quân gốc ở ô đó, vẽ mặt lưng).
export default function CoUpBoard(props) {
  return <CoTuongBoard {...props} movesFrom={movesFrom} reasons="games.coup.reason." />
}
