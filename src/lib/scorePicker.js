// Bộ chọn tỉ số 1 set — trạng thái thuần cho modal Ghi kết quả (ScoreModal) và khối ghi kết quả ở Chia sân.
// state = { winnerTeam: 'A' | 'B', presetScore: '21-19' | '21-15' | '21-11' | 'custom', scoreA, scoreB }
// Mỗi hàm nhận state cũ, trả state mới — component chỉ việc setState(fn(state, ...)).

export const SCORE_PRESETS = ['21-19', '21-15', '21-11']
/** Tỷ số nhanh trong ô "Khác" (bên thắng trước). */
export const SUB_PRESETS = [[21, 18], [21, 16], [21, 14], [21, 12], [21, 0], [30, 29]]

const LOSER_PTS = { '21-19': 19, '21-15': 15, '21-11': 11 }
const clamp = (n) => Math.max(0, Math.min(30, n))
/** Điểm theo preset cho đội thắng `team` (đội kia nhận điểm thua của preset). */
const presetScores = (preset, team) => ({
  scoreA: team === 'A' ? 21 : LOSER_PTS[preset],
  scoreB: team === 'B' ? 21 : LOSER_PTS[preset],
})
/** Đội cao điểm hơn thắng; bằng điểm thì giữ đội thắng cũ. */
const leaderOr = (scoreA, scoreB, fallback) => (scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : fallback)

/** Trạng thái đầu: có tỉ số sẵn (`initialSets[0]`) thì suy đội thắng + preset, không thì A thắng 21-19. */
export function scoreStateFrom(initialSets) {
  const first = initialSets?.[0]
  if (!first) return { winnerTeam: 'A', presetScore: '21-19', scoreA: 21, scoreB: 19 }
  const [sa, sb] = first
  const pair = `${Math.max(sa, sb)}-${Math.min(sa, sb)}`
  return {
    winnerTeam: leaderOr(sa, sb, 'A'),
    presetScore: SCORE_PRESETS.includes(pair) ? pair : 'custom',
    scoreA: sa ?? 21,
    scoreB: sb ?? 19,
  }
}

/** Chạm thẻ đội thắng. Đang ở preset → điểm theo preset; ở "Khác" → đảo điểm nếu đội đó đang thấp hơn. */
export function pickWinner(s, team) {
  if (LOSER_PTS[s.presetScore]) return { ...s, winnerTeam: team, ...presetScores(s.presetScore, team) }
  const behind = s.presetScore === 'custom' && ((team === 'A' && s.scoreA < s.scoreB) || (team === 'B' && s.scoreB < s.scoreA))
  return behind ? { ...s, winnerTeam: team, scoreA: s.scoreB, scoreB: s.scoreA } : { ...s, winnerTeam: team }
}

/** Chọn preset (21-19 / 21-15 / 21-11 / 'custom'). Preset có điểm → đặt điểm theo đội đang thắng. */
export function pickPreset(s, preset) {
  return LOSER_PTS[preset] ? { ...s, presetScore: preset, ...presetScores(preset, s.winnerTeam) } : { ...s, presetScore: preset }
}

/** Đặt điểm một bên (đã kẹp 0..30), chuyển sang "Khác", đội cao điểm hơn thành đội thắng. */
function setSide(s, team, val) {
  return team === 'A'
    ? { ...s, presetScore: 'custom', scoreA: val, winnerTeam: leaderOr(val, s.scoreB, s.winnerTeam) }
    : { ...s, presetScore: 'custom', scoreB: val, winnerTeam: leaderOr(s.scoreA, val, s.winnerTeam) }
}

/** Nút −/+ ở ô "Khác". */
export const stepScore = (s, team, delta) => setSide(s, team, clamp(Number((team === 'A' ? s.scoreA : s.scoreB) || 0) + delta))

/** Gõ điểm vào ô số — không phải số thì 0. */
export function typeScore(s, team, valStr) {
  const val = parseInt(valStr, 10)
  return setSide(s, team, isNaN(val) ? 0 : clamp(val))
}

/** Nút ⇄: đổi điểm hai bên, đội thắng đi theo điểm. */
export const swapScores = (s) => ({ ...s, presetScore: 'custom', scoreA: s.scoreB, scoreB: s.scoreA, winnerTeam: leaderOr(s.scoreB, s.scoreA, s.winnerTeam) })

/** Tỷ số nhanh trong ô "Khác": đặt theo phía đội đang thắng, không đổi đội thắng / preset. */
export const pickSubPreset = (s, [win, lose]) => (s.winnerTeam === 'B' ? { ...s, scoreA: lose, scoreB: win } : { ...s, scoreA: win, scoreB: lose })

/** Bấm vào số điểm lớn trên thẻ đội → mở ô "Khác", giữ điểm. */
export const editCustom = (s) => ({ ...s, presetScore: 'custom' })
