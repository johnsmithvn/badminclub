/**
 * Bộ phân tích cú pháp giọng nói ghi tỷ số trận đấu cầu lông (Voice Match Parser).
 * Hàm thuần (Pure function), không phụ thuộc React, không phụ thuộc Supabase.
 * Trả về structured data tường minh theo hợp đồng MVP:
 * - status: 'ok' | 'ambiguous' | 'not_found' | 'invalid_score'
 */

/** Chuẩn hóa chuỗi: lowercase, bỏ dấu tiếng Việt, bỏ ký tự đặc biệt, chuẩn hóa khoảng trắng */
export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/đ/g, 'd') // i18n-ok: chuẩn hóa bỏ dấu đ -> d
    .replace(/Đ/g, 'd') // i18n-ok: chuẩn hóa bỏ dấu Đ -> d
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Từ điển số chữ tiếng Việt (0 - 30) sắp xếp theo độ dài giảm dần */
const VIETNAMESE_NUMBERS = [
  // 20 - 30
  { word: 'hai muoi chin', val: 29 },
  { word: 'hai muoi tam', val: 28 },
  { word: 'hai muoi bay', val: 27 },
  { word: 'hai muoi sau', val: 26 },
  { word: 'hai muoi lam', val: 25 },
  { word: 'hai muoi nam', val: 25 },
  { word: 'hai muoi bon', val: 24 },
  { word: 'hai muoi tu', val: 24 },
  { word: 'hai muoi ba', val: 23 },
  { word: 'hai muoi hai', val: 22 },
  { word: 'hai muoi mot', val: 21 },
  { word: 'ba muoi', val: 30 },
  { word: 'ba chuc', val: 30 },
  { word: 'hai muoi', val: 20 },
  { word: 'hai chuc', val: 20 },
  { word: 'hai chin', val: 29 },
  { word: 'hai tam', val: 28 },
  { word: 'hai bay', val: 27 },
  { word: 'hai sau', val: 26 },
  { word: 'hai lam', val: 25 },
  { word: 'hai nam', val: 25 },
  { word: 'hai bon', val: 24 },
  { word: 'hai tu', val: 24 },
  { word: 'hai ba', val: 23 },
  { word: 'hai hai', val: 22 },
  { word: 'hai mot', val: 21 },

  // 10 - 19
  { word: 'muoi chin', val: 19 },
  { word: 'muoi tam', val: 18 },
  { word: 'muoi bay', val: 17 },
  { word: 'muoi sau', val: 16 },
  { word: 'muoi lam', val: 15 },
  { word: 'muoi nam', val: 15 },
  { word: 'muoi bon', val: 14 },
  { word: 'muoi tu', val: 14 },
  { word: 'muoi ba', val: 13 },
  { word: 'muoi hai', val: 12 },
  { word: 'muoi mot', val: 11 },
  { word: 'muoi', val: 10 },

  // 0 - 9
  { word: 'khong', val: 0 },
  { word: 'mot', val: 1 },
  { word: 'hai', val: 2 },
  { word: 'ba', val: 3 },
  { word: 'bon', val: 4 },
  { word: 'tu', val: 4 },
  { word: 'lam', val: 5 },
  { word: 'sau', val: 6 },
  { word: 'bay', val: 7 },
  { word: 'tam', val: 8 },
  { word: 'chin', val: 9 },
]

/** Thay thế các chữ số tiếng Việt bằng chữ số Ả Rập trong chuỗi đã chuẩn hóa */
export function convertNumberWordsToDigits(normText) {
  let res = ' ' + normText + ' '
  for (const { word, val } of VIETNAMESE_NUMBERS) {
    const regex = new RegExp(`(?<=\\s)${word}(?=\\s)`, 'g')
    res = res.replace(regex, String(val))
  }
  return res.trim().replace(/\s+/g, ' ')
}

/** Từ khóa phân định Thắng / Thua */
const WIN_WORDS = ['thang', 'an', 'ha', 'de', 'win', 'won', 'beat']
const LOSE_WORDS = ['thua', 'bai', 'duoi', 'lose', 'lost']

/** Từ xưng hô nữ rõ ràng */
const FEMALE_HONORIFICS = ['chi', 'co', 'ba', 'nu']
/** Từ xưng hô nam rõ ràng */
const MALE_HONORIFICS = ['anh', 'chu', 'bac', 'ong', 'nam']

/**
 * Trích xuất điểm số từ chuỗi.
 * Điểm cầu lông hợp lệ nằm trong khoảng 0 - 30.
 */
export function extractScores(text) {
  const matches = text.match(/\b([0-9]{1,2})\b/g)
  if (!matches || matches.length < 2) return null

  const validScores = []
  for (const m of matches) {
    const num = parseInt(m, 10)
    if (num >= 0 && num <= 30) {
      validScores.push(num)
      if (validScores.length === 2) break
    }
  }

  if (validScores.length < 2) return null
  return [validScores[0], validScores[1]]
}

/**
 * Tách biệt động từ kết quả (Action Word) ra khỏi chuỗi để tránh bị ăn nhầm vào tên người.
 * Đặc biệt giải quyết edge case từ đồng âm "Thắng" (tên người vs động từ thắng).
 */
export function isolateActionWord(textWithDigits) {
  const words = textWithDigits.split(/\s+/)
  let actionType = null // 'win' | 'lose' | null
  let actionWordIndex = -1

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (WIN_WORDS.includes(w)) {
      if (w === 'thang' && i + 1 < words.length && WIN_WORDS.includes(words[i + 1])) {
        // Trường hợp 'thang thang': từ thứ 1 là tên người, từ thứ 2 là động từ
        actionType = 'win'
        actionWordIndex = i + 1
        break
      } else {
        actionType = 'win'
        actionWordIndex = i
        break
      }
    } else if (LOSE_WORDS.includes(w)) {
      actionType = 'lose'
      actionWordIndex = i
      break
    }
  }

  if (actionWordIndex !== -1) {
    const placeholder = actionType === 'win' ? '__ACTION_WIN__' : '__ACTION_LOSE__'
    words[actionWordIndex] = placeholder
  }

  return {
    actionType,
    processedText: words.join(' '),
  }
}

/**
 * Phân tích người chơi trong câu.
 * Thứ tự ưu tiên nghiêm ngặt theo hợp đồng MVP:
 * 1. fullName exact (dài nhất) / name exact (nếu name đó duy nhất trong danh sách)
 * 2. Tên + honorific / gender (khi tên bị trùng nhiều người)
 * 3. Tên riêng unique
 * 4. Trùng lặp không phân biệt được ➔ ambiguous
 */
export function matchPlayersInText(text, players = []) {
  if (!players.length) return { matched: [], ambiguous: null }

  // Chuẩn bị metadata cho từng player
  const playerTokens = players.map((p) => {
    const id = p.id || p.key
    const fullNameNorm = normalizeText(p.fullName || '')
    const nameNorm = normalizeText(p.name || '')
    const parts = (fullNameNorm || nameNorm).split(' ').filter(Boolean)
    const firstName = parts[parts.length - 1] || ''

    return {
      player: p,
      id,
      fullNameNorm,
      nameNorm,
      firstName,
      gender: p.gender,
    }
  })

  // Đếm tần suất xuất hiện của các chuỗi tên để nhận diện trùng lặp
  const fullNameCounts = {}
  const nameCounts = {}
  const firstNameCounts = {}

  for (const pt of playerTokens) {
    if (pt.fullNameNorm) fullNameCounts[pt.fullNameNorm] = (fullNameCounts[pt.fullNameNorm] || 0) + 1
    if (pt.nameNorm) nameCounts[pt.nameNorm] = (nameCounts[pt.nameNorm] || 0) + 1
    if (pt.firstName) firstNameCounts[pt.firstName] = (firstNameCounts[pt.firstName] || 0) + 1
  }

  // Danh sách các ứng viên exact duy nhất
  const exactCandidates = []
  for (const pt of playerTokens) {
    if (pt.fullNameNorm && fullNameCounts[pt.fullNameNorm] === 1) {
      exactCandidates.push({ norm: pt.fullNameNorm, pt, type: 'fullName' })
    }
    // Chỉ đưa nameNorm vào exact nếu nameNorm đó không bị trùng giữa nhiều người
    if (pt.nameNorm && pt.nameNorm !== pt.fullNameNorm && nameCounts[pt.nameNorm] === 1) {
      exactCandidates.push({ norm: pt.nameNorm, pt, type: 'name' })
    }
  }
  // Sắp xếp chuỗi dài nhất khớp trước
  exactCandidates.sort((a, b) => b.norm.length - a.norm.length)

  const foundPlayers = []
  const foundIds = new Set()
  let trackingText = text

  // 1. Khớp cụm fullName / name exact DUY NHẤT dài nhất trước
  for (const cand of exactCandidates) {
    const regex = new RegExp(`(?<=^|\\s)${cand.norm}(?=\\s|$)`, 'g')
    const match = regex.exec(trackingText)
    if (match) {
      if (!foundIds.has(cand.pt.id)) {
        foundPlayers.push({
          player: cand.pt.player,
          matchType: cand.type,
          matchedTerm: cand.norm,
          startIndex: match.index,
        })
        foundIds.add(cand.pt.id)
      }
      trackingText = trackingText.replace(regex, ' '.repeat(cand.norm.length))
    }
  }

  // 2. Tìm các từ còn lại trong câu (bao gồm tên riêng, hoặc name bị trùng cần lọc gender)
  const words = text.split(/\s+/).filter(Boolean)
  const wordOffsets = []
  let searchIdx = 0
  for (const w of words) {
    const idx = text.indexOf(w, searchIdx)
    wordOffsets.push(idx)
    searchIdx = idx + w.length
  }
  const trackingWords = trackingText.trim().split(/\s+/).filter(Boolean)

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (
      word.startsWith('__ACTION_') ||
      /^\d+$/.test(word) ||
      FEMALE_HONORIFICS.includes(word) ||
      MALE_HONORIFICS.includes(word)
    ) {
      continue
    }

    // Chỉ xét các từ còn tồn tại trong trackingWords (chưa bị ăn bởi exact)
    if (!trackingWords.includes(word)) {
      continue
    }

    // Tìm các player khớp với từ này qua nameNorm hoặc firstName
    const matchingPts = playerTokens.filter(
      (pt) => !foundIds.has(pt.id) && (pt.firstName === word || pt.nameNorm === word)
    )

    if (matchingPts.length === 1) {
      // Tên riêng duy nhất
      foundPlayers.push({
        player: matchingPts[0].player,
        matchType: 'unique_firstname',
        matchedTerm: word,
        startIndex: wordOffsets[i] >= 0 ? wordOffsets[i] : 0,
      })
      foundIds.add(matchingPts[0].id)
    } else if (matchingPts.length > 1) {
      // Trùng tên (≥ 2 người): Kiểm tra từ xưng hô đứng liền trước
      const prevWord = i > 0 ? words[i - 1] : ''
      let filteredByGender = null

      if (FEMALE_HONORIFICS.includes(prevWord)) {
        filteredByGender = matchingPts.filter((pt) => pt.gender === 'nu')
      } else if (MALE_HONORIFICS.includes(prevWord)) {
        filteredByGender = matchingPts.filter((pt) => pt.gender === 'nam')
      }

      if (filteredByGender && filteredByGender.length === 1) {
        foundPlayers.push({
          player: filteredByGender[0].player,
          matchType: 'honorific_filtered',
          matchedTerm: `${prevWord} ${word}`,
          startIndex: i > 0 ? wordOffsets[i - 1] : wordOffsets[i],
        })
        foundIds.add(filteredByGender[0].id)
      } else {
        return {
          matched: foundPlayers,
          ambiguous: {
            reason: 'duplicate_name',
            queryName: word,
            candidates: matchingPts.map((pt) => pt.player),
          },
        }
      }
    }
  }

  // Sắp xếp người chơi theo đúng thứ tự xuất hiện từ trái qua phải trong câu nói
  foundPlayers.sort((a, b) => a.startIndex - b.startIndex)

  return { matched: foundPlayers, ambiguous: null }
}

/**
 * Hàm phân tích chính (Main Entrypoint).
 *
 * @param {Object} params
 * @param {string} params.transcript Câu nói thô từ Micro
 * @param {Array} params.players Danh sách người chơi trong buổi tập
 * @param {Object} [params.currentCourt] Thông tin sân hiện tại (nếu có teamA, teamB)
 * @returns {Object} Structured output theo hợp đồng
 */
export function parseVoiceMatch({ transcript, players = [], currentCourt: _currentCourt = null }) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return { status: 'not_found', reason: 'empty_transcript' }
  }

  // 1. Chuẩn hóa chuỗi
  const rawNorm = normalizeText(transcript)
  // Chuyển các từ số tiếng Việt sang số Ả Rập
  const textWithDigits = convertNumberWordsToDigits(rawNorm)

  // 2. Bóc tách điểm số
  const scores = extractScores(textWithDigits)

  // 3. Cô lập động từ kết quả (Thắng/Thua/Win/Lose) để bảo vệ từ đồng âm (chỉ áp dụng khi có tỷ số)
  let actionType = null
  let processedText = textWithDigits

  if (scores) {
    const isolated = isolateActionWord(textWithDigits)
    actionType = isolated.actionType
    processedText = isolated.processedText
  }

  // 4. Tìm kiếm người chơi trên chuỗi đã qua xử lý
  const { matched, ambiguous } = matchPlayersInText(processedText, players)

  if (ambiguous) {
    return {
      status: 'ambiguous',
      ...ambiguous,
    }
  }

  // 5. Kiểm tra trường hợp chỉ đọc tỷ số trên sân đang có người (Case: "21 19" hoặc "A thắng 21 19")
  const words = textWithDigits.split(/\s+/)
  const teamAWord = words.includes('a') || textWithDigits.includes('doi a') || textWithDigits.includes('phe a')
  const teamBWord = words.includes('b') || textWithDigits.includes('doi b') || textWithDigits.includes('phe b')

  if (!scores) {
    // Không có tỷ số: Nếu có tìm thấy người chơi ➔ Intent xếp sân
    if (matched.length >= 2) {
      return {
        status: 'ok',
        intent: 'assign_court',
        matchedPlayers: matched.map((m) => m.player),
        raw: { transcript, textWithDigits },
      }
    }
    return {
      status: 'invalid_score',
      reason: 'no_score_detected',
      raw: { transcript, textWithDigits },
    }
  }

  const [s1, s2] = scores
  if (s1 === s2) {
    return {
      status: 'invalid_score',
      reason: 'tie_score',
      scoreA: s1,
      scoreB: s2,
    }
  }

  const winnerScore = Math.max(s1, s2)
  const loserScore = Math.min(s1, s2)

  // Xử lý xác định người thắng / kẻ thua
  let winnerPlayer = null
  let loserPlayer = null
  const isWinnerInverted = actionType === 'lose'

  if (matched.length >= 2) {
    const p1 = matched[0].player
    const p2 = matched[1].player

    if (actionType === 'lose') {
      winnerPlayer = p2
      loserPlayer = p1
    } else {
      winnerPlayer = p1
      loserPlayer = p2
    }
  } else if (matched.length === 1) {
    const p = matched[0].player
    if (actionType === 'lose') {
      loserPlayer = p
    } else {
      winnerPlayer = p
    }
  }

  // Trường hợp nói tên Đội A / Đội B: "A thắng 21 19" hoặc "B thua 21 19"
  let declaredTeam = null
  if (teamAWord) declaredTeam = 'A'
  else if (teamBWord) declaredTeam = 'B'

  let winnerTeam = declaredTeam
  if (declaredTeam && actionType === 'lose') {
    winnerTeam = declaredTeam === 'A' ? 'B' : 'A'
  }

  return {
    status: 'ok',
    intent: 'record_score',
    winnerPlayerId: winnerPlayer ? (winnerPlayer.id || winnerPlayer.key) : null,
    loserPlayerId: loserPlayer ? (loserPlayer.id || loserPlayer.key) : null,
    winnerTeam,
    winnerScore,
    loserScore,
    confidence: matched.length > 0 ? matched[0].matchType : 'team_label',
    raw: {
      transcript,
      actionWord: actionType,
      isWinnerInverted,
      matchedCount: matched.length,
    },
  }
}

/**
 * Ánh xạ kết quả parse giọng nói vào sân hiện tại.
 *
 * @param {Object} params
 * @param {Object} params.parsedResult Kết quả từ parseVoiceMatch
 * @param {number} [params.courtIdx=0] Index sân đang chọn
 * @param {Array<string>} [params.currentTeamA=[]] Danh sách key người chơi đội A trên sân
 * @param {Array<string>} [params.currentTeamB=[]] Danh sách key người chơi đội B trên sân
 * @param {Array<Object>} [params.players=[]] Danh sách tất cả người chơi trong buổi
 * @returns {Object} Kết quả ánh xạ gồm winnerTeam, scoreA, scoreB, partner, warning
 */
export function mapVoiceResultToCourt({
  parsedResult,
  courtIdx = 0,
  currentTeamA = [],
  currentTeamB = [],
  players = [],
}) {
  if (!parsedResult || parsedResult.status !== 'ok') {
    return {
      status: parsedResult?.status || 'not_found',
      reason: parsedResult?.reason,
      ...parsedResult,
    }
  }

  const {
    intent,
    winnerPlayerId,
    loserPlayerId,
    winnerTeam: declaredWinnerTeam,
    winnerScore,
    loserScore,
  } = parsedResult

  if (intent === 'assign_court') {
    const matched = parsedResult.matchedPlayers || []
    let proposedTeamA = [...currentTeamA]
    let proposedTeamB = [...currentTeamB]

    if (matched.length >= 4) {
      // 4 người: chia đều 2 người đội A, 2 người đội B
      proposedTeamA = [matched[0].id || matched[0].key, matched[1].id || matched[1].key]
      proposedTeamB = [matched[2].id || matched[2].key, matched[3].id || matched[3].key]
    } else if (matched.length === 2) {
      if (proposedTeamA.length === 0 && proposedTeamB.length === 0) {
        proposedTeamA = [matched[0].id || matched[0].key]
        proposedTeamB = [matched[1].id || matched[1].key]
      } else {
        const toAdd = matched.map((p) => p.id || p.key)
        let idx = 0
        while (proposedTeamA.length < 2 && idx < toAdd.length) {
          proposedTeamA.push(toAdd[idx++])
        }
        while (proposedTeamB.length < 2 && idx < toAdd.length) {
          proposedTeamB.push(toAdd[idx++])
        }
      }
    } else if (matched.length === 3) {
      proposedTeamA = [matched[0].id || matched[0].key, matched[1].id || matched[1].key]
      proposedTeamB = [matched[2].id || matched[2].key]
    }

    return {
      status: 'ok',
      intent: 'assign_court',
      courtIdx,
      matchedPlayers: matched,
      proposedTeamA,
      proposedTeamB,
    }
  }

  // Trường hợp: intent === 'record_score'
  let targetWinnerTeam = declaredWinnerTeam || null
  let partner = null
  let isOnCurrentCourt = true
  let warning = null

  // 1. Kiểm tra winnerPlayerId trên sân hiện tại
  if (winnerPlayerId) {
    const inTeamA = currentTeamA.includes(winnerPlayerId)
    const inTeamB = currentTeamB.includes(winnerPlayerId)

    if (inTeamA) {
      targetWinnerTeam = 'A'
      // Tìm đồng đội trong Team A
      const partnerKey = currentTeamA.find((k) => k !== winnerPlayerId)
      partner = partnerKey ? players.find((p) => (p.id || p.key) === partnerKey) || null : null
    } else if (inTeamB) {
      targetWinnerTeam = 'B'
      // Tìm đồng đội trong Team B
      const partnerKey = currentTeamB.find((k) => k !== winnerPlayerId)
      partner = partnerKey ? players.find((p) => (p.id || p.key) === partnerKey) || null : null
    } else {
      // Người thắng không có trên sân hiện tại
      isOnCurrentCourt = false
      warning = 'player_not_on_court'
    }
  }

  // 2. Nếu winnerPlayerId không trên sân nhưng loserPlayerId lại trên sân
  if (!targetWinnerTeam && loserPlayerId) {
    if (currentTeamA.includes(loserPlayerId)) {
      targetWinnerTeam = 'B'
      isOnCurrentCourt = true
      warning = null
    } else if (currentTeamB.includes(loserPlayerId)) {
      targetWinnerTeam = 'A'
      isOnCurrentCourt = true
      warning = null
    }
  }

  // 3. Nếu trên sân chưa có người, nhưng câu nói có đủ người (ví dụ: "Tuấn thắng Hùng 21 15")
  let proposedTeamA = [...currentTeamA]
  let proposedTeamB = [...currentTeamB]

  if (currentTeamA.length === 0 && currentTeamB.length === 0 && winnerPlayerId) {
    proposedTeamA = [winnerPlayerId]
    if (loserPlayerId) {
      proposedTeamB = [loserPlayerId]
    }
    targetWinnerTeam = 'A'
    isOnCurrentCourt = true
    warning = null
  }

  // 4. Tính scoreA và scoreB
  let scoreA = null
  let scoreB = null

  if (targetWinnerTeam === 'A') {
    scoreA = winnerScore
    scoreB = loserScore
  } else if (targetWinnerTeam === 'B') {
    scoreA = loserScore
    scoreB = winnerScore
  } else {
    // Mặc định team A nếu không xác định được bên nào
    scoreA = winnerScore
    scoreB = loserScore
    targetWinnerTeam = 'A'
  }

  return {
    status: 'ok',
    intent: 'record_score',
    courtIdx,
    winnerTeam: targetWinnerTeam,
    scoreA,
    scoreB,
    winnerPlayerId,
    loserPlayerId,
    partner,
    isOnCurrentCourt,
    warning,
    proposedTeamA,
    proposedTeamB,
    raw: parsedResult.raw,
  }
}
