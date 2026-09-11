/**
 * Bộ phân tích cú pháp giọng nói ghi tỷ số trận đấu cầu lông (Voice Match Parser).
 * Hàm thuần (Pure function), không phụ thuộc React, không phụ thuộc Supabase.
 *
 * Triển khai Formal Grammar với 5 luật cứng:
 * <Tên A> [Tên B] THẮNG <Tên C> [Tên D] <Số 1> <Số 2>
 * (Kèm biến thể sân: "A THẮNG [Số 1] [Số 2]" hoặc "[Tên người thắng] THẮNG [Số 1] [Số 2]")
 *
 * 5 Luật cứng:
 * 1. Bắt buộc đúng 1 động từ "thắng" phân cách giữa vế Thắng và vế Thua.
 * 2. Cắt bỏ toàn bộ từ lóng (ăn, hạ, đè, bại, dưới, win, beat...).
 * 3. Chỉ nhận diện số ở 2 token cuối câu (Trailing Numeric Tokens).
 * 4. Loại bỏ các từ trùng tên người chơi ra khỏi từ điển số trước khi convert.
 * 5. Validate luật điểm số cầu lông (max 30, chạm 20 cách biệt 2 hoặc chạm trần 30).
 */

/** Chuẩn hóa chuỗi: lowercase, bỏ dấu tiếng Việt, bỏ ký tự đặc biệt, chuẩn hóa khoảng trắng */
export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/đ/g, 'd') // i18n-ok: chuẩn hóa đ -> d
    .replace(/Đ/g, 'd') // i18n-ok: chuẩn hóa Đ -> d
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Từ điển số chữ tiếng Việt (0 - 30) */
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

  // 0 - 9 (từ đơn)
  { word: 'khong', val: 0 },
  { word: 'mot', val: 1 },
  { word: 'hai', val: 2 },
  { word: 'ba', val: 3 },
  { word: 'bon', val: 4 },
  { word: 'tu', val: 4 },
  { word: 'lam', val: 5 },
  { word: 'nam', val: 5 },
  { word: 'sau', val: 6 },
  { word: 'bay', val: 7 },
  { word: 'tam', val: 8 },
  { word: 'chin', val: 9 },
]

/**
 * Luật 4: Thay thế các chữ số tiếng Việt sang số Ả Rập trong chuỗi,
 * đồng thời LOẠI BỎ các từ đơn trùng với tên của thành viên trong danh sách.
 */
export function convertNumberWordsToDigits(normText, excludeWords = new Set()) {
  let res = ' ' + normText + ' '
  for (const { word, val } of VIETNAMESE_NUMBERS) {
    // Nếu từ đơn này trùng với tên/biệt danh của người chơi (ví dụ 'ba', 'sau', 'nam') -> bỏ qua không convert
    if (!word.includes(' ') && excludeWords.has(word)) {
      continue
    }
    const regex = new RegExp(`(?<=\\s)${word}(?=\\s)`, 'g')
    res = res.replace(regex, String(val))
  }
  return res.trim().replace(/\s+/g, ' ')
}

/**
 * Luật 5: Validate luật điểm số cầu lông.
 * - Điểm từ 0 đến 30.
 * - Không hòa.
 * - Điểm thắng phải >= 21.
 * - Nếu chạm 21: điểm thua <= 19.
 * - Nếu > 21 và < 30: cách biệt đúng 2 điểm (22-20, 23-21... 29-27).
 * - Nếu chạm 30: điểm thua 28 hoặc 29 (30-28, 30-29).
 */
export function isValidBadmintonScore(s1, s2) {
  if (!Number.isInteger(s1) || !Number.isInteger(s2)) return false
  if (s1 < 0 || s1 > 30 || s2 < 0 || s2 > 30) return false
  if (s1 === s2) return false

  const w = Math.max(s1, s2)
  const l = Math.min(s1, s2)

  if (w < 21) return false
  if (w === 21) return l <= 19
  if (w > 21 && w < 30) return w - l === 2
  if (w === 30) return l === 28 || l === 29

  return false
}

/**
 * Bóc tách 1 số từ đuôi chuỗi (chữ hoặc số Ả Rập 0-30).
 */
function extractOneTrailingScore(text) {
  const trimmed = text.trim()
  if (!trimmed) return null

  // 1. Kiểm tra nếu token cuối cùng là số Ả Rập (\d{1,2})
  const digitMatch = trimmed.match(/(?<=\s|^)(\d{1,2})$/)
  if (digitMatch) {
    const val = parseInt(digitMatch[1], 10)
    const remaining = trimmed.slice(0, digitMatch.index).trim()
    return { val, remaining }
  }

  // 2. Kiểm tra các mẫu số bằng chữ (từ cụm dài đến từ đơn)
  for (const { word, val } of VIETNAMESE_NUMBERS) {
    const regex = new RegExp(`(?<=\\s|^)${word}$`)
    const match = trimmed.match(regex)
    if (match) {
      const remaining = trimmed.slice(0, match.index).trim()
      return { val, remaining }
    }
  }

  return null
}

/**
 * Luật 3: Chỉ nhận diện số ở đuôi câu (Trailing Numeric Tokens).
 * Bóc tách 2 số ở cuối và trả về { scores: [s1, s2], textWithoutScores }.
 * Hỗ trợ cả số Ả Rập (21 19) và chữ số tiếng Việt (hai mốt mười chín, hai mốt năm...).
 */
export function extractTrailingScores(text) {
  if (!text || typeof text !== 'string') return null
  let working = text.trim()
  // Cho phép từ đệm nhẹ ở cuối câu nếu có (ví dụ "nhe", "a", "di", "roi")
  working = working.replace(/(?<=\s)(nhe|a|di|roi)$/, '').trim()

  // Bóc số thứ 2 (ở ngoài cùng bên phải)
  const res2 = extractOneTrailingScore(working)
  if (!res2) return null

  // Bóc số thứ 1 (ngay trước số thứ 2)
  const res1 = extractOneTrailingScore(res2.remaining)
  if (!res1) return null

  return {
    scores: [res1.val, res2.val],
    textWithoutScores: res1.remaining,
  }
}

/**
 * Xây dựng danh sách N-gram Aliases (Biệt danh & Cụm tên gọi con) cho từng người chơi.
 * Ưu tiên các cụm con dài nhất ("Minh Tùng" trong "Nguyễn Minh Tùng", "Thắng em").
 */
export function buildPlayerAliases(players = []) {
  const aliasList = []
  const singleNameTokens = new Set()

  for (const p of players) {
    const id = p.id || p.key
    const fullNameNorm = normalizeText(p.fullName || '')
    const nameNorm = normalizeText(p.name || '')
    const candidateTerms = new Set()

    if (fullNameNorm) candidateTerms.add(fullNameNorm)
    if (nameNorm) candidateTerms.add(nameNorm)

    // Bóc tách cụm con từ fullName (ví dụ: "nguyen minh tung" -> "minh tung", "tung")
    if (fullNameNorm) {
      const parts = fullNameNorm.split(' ').filter(Boolean)
      if (parts.length >= 2) {
        candidateTerms.add(parts.slice(-2).join(' ')) // Tên đệm + tên chính: "minh tung"
      }
      if (parts.length >= 3) {
        candidateTerms.add(parts.slice(-3).join(' ')) // 3 từ cuối
      }
      if (parts.length >= 1) {
        candidateTerms.add(parts[parts.length - 1])
      }
      for (const part of parts) {
        if (part) singleNameTokens.add(part)
      }
    }

    if (nameNorm) {
      const parts = nameNorm.split(' ').filter(Boolean)
      if (parts.length >= 2) {
        candidateTerms.add(parts.slice(-2).join(' '))
      }
      if (parts.length >= 1) {
        candidateTerms.add(parts[parts.length - 1])
      }
      for (const part of parts) {
        if (part) singleNameTokens.add(part)
      }
    }

    // Đặc cách phiên âm tiếng Nhật cho Kuro ("Kư rô", "cu ro", "curo")
    if (nameNorm === 'kuro' || fullNameNorm.includes('kuro')) {
      candidateTerms.add('ku ro')
      candidateTerms.add('cu ro')
      candidateTerms.add('curo')
    }

    for (const term of candidateTerms) {
      if (!term) continue
      aliasList.push({
        term,
        wordCount: term.split(' ').length,
        charLength: term.length,
        player: p,
        id,
      })
    }
  }

  // Sắp xếp: Ưu tiên cụm nhiều từ trước, chuỗi dài hơn trước
  aliasList.sort((a, b) => b.wordCount - a.wordCount || b.charLength - a.charLength)

  return {
    aliasList,
    singleNameTokens,
  }
}

/**
 * Nhận diện người chơi trong một cụm câu nói (vế thắng hoặc vế thua).
 * Ưu tiên khớp cụm dài trước ("Minh Tùng", "Thắng em"), sau đó mới đến từ đơn.
 */
export function matchPlayersInPhrase(phrase, aliasList = [], allowedPlayerIds = null) {
  if (!phrase || !phrase.trim()) return { matched: [], ambiguous: null }

  let trackingText = phrase.trim()
  const foundPlayers = []
  const foundIds = new Set()

  // 1. Quét các alias đa từ (wordCount >= 2) trước
  for (const item of aliasList) {
    if (item.wordCount < 2) continue
    if (allowedPlayerIds && !allowedPlayerIds.has(item.id)) continue
    if (foundIds.has(item.id)) continue

    const regex = new RegExp(`(?<=^|\\s)${item.term}(?=\\s|$)`, 'g')
    const match = regex.exec(trackingText)
    if (match) {
      foundPlayers.push({
        player: item.player,
        matchedTerm: item.term,
        startIndex: match.index,
      })
      foundIds.add(item.id)
      trackingText = trackingText.replace(regex, ' '.repeat(item.term.length))
    }
  }

  // 2. Quét các từ đơn còn lại trong câu
  const remainingWords = trackingText.split(/\s+/).filter(Boolean)

  for (const word of remainingWords) {
    // Bỏ qua các từ phụ trợ, đại từ xưng hô thông thường nếu không phải là alias hợp lệ
    const singleMatches = aliasList.filter(
      (item) =>
        item.wordCount === 1 &&
        item.term === word &&
        (!allowedPlayerIds || allowedPlayerIds.has(item.id)) &&
        !foundIds.has(item.id)
    )

    // Loại bỏ các bản ghi trùng lặp cùng 1 player id
    const uniquePlayers = []
    const seenPid = new Set()
    for (const m of singleMatches) {
      if (!seenPid.has(m.id)) {
        seenPid.add(m.id)
        uniquePlayers.push(m)
      }
    }

    if (uniquePlayers.length === 1) {
      foundPlayers.push({
        player: uniquePlayers[0].player,
        matchedTerm: word,
        startIndex: phrase.indexOf(word),
      })
      foundIds.add(uniquePlayers[0].id)
    } else if (uniquePlayers.length > 1) {
      // Trùng tên trong phạm vi cho phép mà không phân biệt được
      return {
        matched: foundPlayers,
        ambiguous: {
          reason: 'duplicate_name',
          queryName: word,
          candidates: uniquePlayers.map((u) => u.player),
        },
      }
    }
  }

  // Sắp xếp theo thứ tự xuất hiện từ trái qua phải
  foundPlayers.sort((a, b) => a.startIndex - b.startIndex)

  return { matched: foundPlayers, ambiguous: null }
}

/**
 * Hàm phân tích chính theo Formal Grammar:
 * <Vế Thắng> THẮNG <Vế Thua> <Số 1> <Số 2>
 *
 * @param {Object} params
 * @param {string} params.transcript Chuỗi giọng nói từ Micro
 * @param {Array} [params.players=[]] Danh sách toàn bộ người chơi trong buổi (thành viên + khách)
 * @param {Array} [params.courtPlayers=[]] Danh sách 4 người đang có mặt trên sân
 * @param {Object} [params.currentCourt=null] Thông tin sân hiện tại
 */
export function parseVoiceMatch({
  transcript,
  players = [],
  courtPlayers = [],
  _currentCourt = null,
}) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return { status: 'not_found', reason: 'empty_transcript' }
  }

  // 1. Chuẩn hóa chuỗi thô
  const rawNorm = normalizeText(transcript)

  // 2. Xây dựng danh sách Alias và tập hợp tên đơn để bảo vệ từ điển số (Luật 4)
  const allPlayersPool = players.length > 0 ? players : courtPlayers
  const { aliasList, singleNameTokens } = buildPlayerAliases(allPlayersPool)

  // 3. Luật 3: Bóc tách 2 số điểm ở đuôi câu (Trailing Scores) trực tiếp từ rawNorm
  // Hỗ trợ cả số Ả Rập lẫn chữ số tiếng Việt từ đuôi chuỗi mà không làm méo mó chuỗi tên phía trước
  let textWithDigits = rawNorm
  let scoreResult = extractTrailingScores(rawNorm)
  if (!scoreResult) {
    textWithDigits = convertNumberWordsToDigits(rawNorm, singleNameTokens)
    scoreResult = extractTrailingScores(textWithDigits)
  }

  if (!scoreResult) {
    // Không có 2 số ở cuối: Kiểm tra intent gán người vào sân (nếu người dùng đọc tên)
    const { matched } = matchPlayersInPhrase(rawNorm, aliasList)
    if (matched.length >= 2) {
      return {
        status: 'ok',
        intent: 'assign_court',
        matchedPlayers: matched.map((m) => m.player),
        raw: { transcript, textWithDigits: rawNorm },
      }
    }
    return {
      status: 'invalid_score',
      reason: 'no_trailing_scores',
      raw: { transcript, textWithDigits: rawNorm },
    }
  }

  const [s1, s2] = scoreResult.scores

  // 5. Luật 5: Validate luật điểm số cầu lông
  if (!isValidBadmintonScore(s1, s2)) {
    return {
      status: 'invalid_score',
      reason: 'badminton_rules_violation',
      scoreA: s1,
      scoreB: s2,
      raw: { transcript, textWithDigits, scores: [s1, s2] },
    }
  }

  const winnerScore = Math.max(s1, s2)
  const loserScore = Math.min(s1, s2)

  // 6. Trường hợp chỉ đọc số điểm (dành cho sân đã có sẵn người: "21 19" hoặc "18 21")
  const textWithoutScores = scoreResult.textWithoutScores.trim()
  const cleanedPrefix = textWithoutScores.replace(/^(ty so|ket qua|diem|san|tran)\s*/g, '').trim()
  if (!cleanedPrefix) {
    return {
      status: 'ok',
      intent: 'record_score',
      scoreOnly: true,
      scoreA: s1,
      scoreB: s2,
      winnerScore,
      loserScore,
      raw: { transcript, textWithDigits },
    }
  }

  // Bảo vệ các cụm tên riêng có chứa chữ "thang" (như "thang em", "le minh thang", "quyet thang")
  // bằng cách thay thế tạm thời bằng placeholder __PLAYER_THANG_i__
  const thangAliases = aliasList.filter(
    (item) => item.wordCount >= 2 && item.term.includes('thang')
  )
  let protectedText = textWithoutScores
  const protectedMap = new Map()
  let pIdx = 0

  for (const ta of thangAliases) {
    const regex = new RegExp(`(?<=^|\\s)${ta.term}(?=\\s|$)`, 'g')
    if (regex.test(protectedText)) {
      const ph = `__PROTECTED_NAME_${pIdx++}__`
      protectedText = protectedText.replace(regex, ph)
      protectedMap.set(ph, ta.term)
    }
  }

  // Tìm từ khóa hành động: Thắng (win, uyn, thang) hoặc Thua (thua, lose)
  let actionMatch = protectedText.match(/(?<=^|\s)(win|uyn|thang|thua|lose)(?=\s|$)/)
  if (!actionMatch) {
    return {
      status: 'invalid_syntax',
      reason: 'missing_win_keyword',
      raw: { transcript, textWithDigits },
    }
  }

  // Nếu match đầu tiên rơi vào index 0 (clause1 sẽ rỗng), kiểm tra xem đằng sau có từ khóa hành động nào khác không
  // (ví dụ: "Thắng thắng Thành" -> từ "thang" đầu là tên người chơi, từ "thang" thứ hai là động từ)
  if (actionMatch.index === 0) {
    const afterFirst = protectedText.slice(actionMatch[0].length)
    const secondMatch = afterFirst.match(/(?<=\s)(win|uyn|thang|thua|lose)(?=\s|$)/)
    if (secondMatch) {
      actionMatch = {
        0: secondMatch[0],
        1: secondMatch[1],
        index: actionMatch[0].length + secondMatch.index,
      }
    }
  }

  const actionWord = actionMatch[1]
  const isLoseAction = actionWord === 'thua' || actionWord === 'lose'

  const splitIdx = actionMatch.index
  let clause1 = protectedText.slice(0, splitIdx).trim()
  let clause2 = protectedText.slice(splitIdx + actionMatch[0].length).trim()

  // Khôi phục lại các placeholder tên riêng trong vế
  for (const [ph, orig] of protectedMap.entries()) {
    clause1 = clause1.replace(ph, orig)
    clause2 = clause2.replace(ph, orig)
  }

  // Phân định vế Thắng và vế Thua dựa theo hành động
  let winnerRaw = isLoseAction ? clause2 : clause1
  let loserRaw = isLoseAction ? clause1 : clause2

  // 7. Nhận diện Đội A / Đội B trên sân hiện tại
  const isTeamAWinner =
    winnerRaw === 'a' || winnerRaw === 'doi a' || winnerRaw === 'phe a' || winnerRaw === 'ben a'
  const isTeamBWinner =
    winnerRaw === 'b' || winnerRaw === 'doi b' || winnerRaw === 'phe b' || winnerRaw === 'ben b'

  const isTeamALoser =
    loserRaw === 'a' || loserRaw === 'doi a' || loserRaw === 'phe a' || loserRaw === 'ben a'
  const isTeamBLoser =
    loserRaw === 'b' || loserRaw === 'doi b' || loserRaw === 'phe b' || loserRaw === 'ben b'

  if (isTeamAWinner || isTeamBLoser) {
    return {
      status: 'ok',
      intent: 'record_score',
      winnerTeam: 'A',
      winnerScore,
      loserScore,
      confidence: 'team_label',
      raw: { transcript, textWithDigits, winnerScore, loserScore },
    }
  }

  if (isTeamBWinner || isTeamALoser) {
    return {
      status: 'ok',
      intent: 'record_score',
      winnerTeam: 'B',
      winnerScore,
      loserScore,
      confidence: 'team_label',
      raw: { transcript, textWithDigits, winnerScore, loserScore },
    }
  }

  // 8. Nhận diện người chơi trong vế Thắng và vế Thua
  // Ưu tiên phạm vi người trên sân (courtPlayers) nếu có
  const courtIds =
    courtPlayers.length > 0
      ? new Set(courtPlayers.map((p) => p.id || p.key))
      : null

  // Tìm ở vế Thắng
  let winMatchRes = matchPlayersInPhrase(winnerRaw, aliasList, courtIds)
  if (winMatchRes.ambiguous) {
    return { status: 'ambiguous', ...winMatchRes.ambiguous }
  }

  // Nếu không tìm thấy trong courtPlayers, mở rộng ra allPlayersPool
  if (!winMatchRes.matched.length && courtIds) {
    winMatchRes = matchPlayersInPhrase(winnerRaw, aliasList, null)
    if (winMatchRes.ambiguous) {
      return { status: 'ambiguous', ...winMatchRes.ambiguous }
    }
  }

  // Tìm ở vế Thua
  let loseMatchRes = matchPlayersInPhrase(loserRaw, aliasList, courtIds)
  if (loseMatchRes.ambiguous) {
    return { status: 'ambiguous', ...loseMatchRes.ambiguous }
  }
  if (!loseMatchRes.matched.length && courtIds && loserRaw) {
    loseMatchRes = matchPlayersInPhrase(loserRaw, aliasList, null)
    if (loseMatchRes.ambiguous) {
      return { status: 'ambiguous', ...loseMatchRes.ambiguous }
    }
  }

  const winnerMatched = winMatchRes.matched
  const loserMatched = loseMatchRes.matched

  if (!winnerMatched.length && !loserMatched.length) {
    return {
      status: 'not_found',
      reason: 'no_players_matched',
      raw: { transcript, textWithDigits },
    }
  }

  // Nếu không nhận diện được người thắng nào mà vế thua lại có >= 2 người
  // (dấu hiệu câu bị cắt sai vế hoặc thiếu người thắng) -> báo lỗi cú pháp thay vì đoán mò đảo ngược
  if (!winnerMatched.length && loserMatched.length > 1) {
    return {
      status: 'invalid_syntax',
      reason: 'missing_winner',
      raw: { transcript, textWithDigits },
    }
  }

  return {
    status: 'ok',
    intent: 'record_score',
    winnerPlayers: winnerMatched.map((m) => m.player),
    loserPlayers: loserMatched.map((m) => m.player),
    winnerScore,
    loserScore,
    raw: {
      transcript,
      textWithDigits,
      winnerClause: winnerRaw,
      loserClause: loserRaw,
    },
  }
}

/**
 * Ánh xạ kết quả parse giọng nói vào sân hiện tại.
 * Luôn trả về cấu trúc tường minh để UI hiển thị "Nghe được" vs "Hiểu là" trước khi người dùng xác nhận lưu.
 */
export function mapVoiceResultToCourt({
  parsedResult,
  courtIdx = 0,
  currentTeamA = [],
  currentTeamB = [],
  _players = [],
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
    winnerTeam: declaredWinnerTeam,
    winnerPlayers = [],
    loserPlayers = [],
    winnerScore,
    loserScore,
  } = parsedResult

  // Trường hợp Intent: Xếp sân
  if (intent === 'assign_court') {
    const matched = parsedResult.matchedPlayers || []
    let proposedTeamA = [...currentTeamA]
    let proposedTeamB = [...currentTeamB]

    if (matched.length >= 4) {
      proposedTeamA = [matched[0].id || matched[0].key, matched[1].id || matched[1].key]
      proposedTeamB = [matched[2].id || matched[2].key, matched[3].id || matched[3].key]
    } else if (matched.length === 2) {
      if (!proposedTeamA.length && !proposedTeamB.length) {
        proposedTeamA = [matched[0].id || matched[0].key]
        proposedTeamB = [matched[1].id || matched[1].key]
      }
    }

    return {
      status: 'ok',
      intent: 'assign_court',
      courtIdx,
      proposedTeamA,
      proposedTeamB,
      matchedPlayers: matched,
    }
  }

  // Trường hợp Intent: Ghi kết quả trận đấu (Record score)
  const teamASet = new Set(currentTeamA)
  const teamBSet = new Set(currentTeamB)

  // 1. Trường hợp chỉ đọc điểm số (scoreOnly) trên sân đã có người
  if (parsedResult.scoreOnly) {
    const hasCourtPlayers = currentTeamA.length > 0 || currentTeamB.length > 0
    if (!hasCourtPlayers) {
      return {
        status: 'invalid_syntax',
        reason: 'empty_court_score_only',
        raw: parsedResult.raw,
      }
    }
    const scoreA = parsedResult.scoreA
    const scoreB = parsedResult.scoreB
    const finalWinnerTeam = scoreA > scoreB ? 'A' : 'B'
    return {
      status: 'ok',
      intent: 'record_score',
      courtIdx,
      winnerTeam: finalWinnerTeam,
      scoreA,
      scoreB,
      winnerScore: Math.max(scoreA, scoreB),
      loserScore: Math.min(scoreA, scoreB),
      winnerNames: finalWinnerTeam === 'A' ? 'A' : 'B', // i18n-ok: team code fallback
      loserNames: finalWinnerTeam === 'A' ? 'B' : 'A', // i18n-ok: team code fallback
      proposedTeamA: currentTeamA,
      proposedTeamB: currentTeamB,
      raw: parsedResult.raw,
    }
  }

  let finalWinnerTeam = declaredWinnerTeam || null
  let proposedTeamA = [...currentTeamA]
  let proposedTeamB = [...currentTeamB]

  // Nếu người dùng gọi tên người thắng
  if (!finalWinnerTeam && winnerPlayers.length > 0) {
    const p0Id = winnerPlayers[0].id || winnerPlayers[0].key
    if (teamASet.has(p0Id)) {
      finalWinnerTeam = 'A'
    } else if (teamBSet.has(p0Id)) {
      finalWinnerTeam = 'B'
    }
  }

  // Nếu người dùng gọi tên người thua
  if (!finalWinnerTeam && loserPlayers.length > 0) {
    const p0Id = loserPlayers[0].id || loserPlayers[0].key
    if (teamASet.has(p0Id)) {
      finalWinnerTeam = 'B'
    } else if (teamBSet.has(p0Id)) {
      finalWinnerTeam = 'A'
    }
  }

  // Nếu trên sân chưa có người (sân trống), nhưng câu nói có người thắng (và người thua)
  // Tự động đề xuất người vào sân và gán người thắng vào Đội A
  if (!finalWinnerTeam && currentTeamA.length === 0 && currentTeamB.length === 0 && winnerPlayers.length > 0) {
    proposedTeamA = winnerPlayers.map((p) => p.id || p.key)
    if (loserPlayers.length > 0) {
      proposedTeamB = loserPlayers.map((p) => p.id || p.key)
    }
    finalWinnerTeam = 'A'
  }

  // Nếu vẫn không xác định được đội thắng (người được gọi tên không có trên sân hiện tại)
  if (!finalWinnerTeam) {
    return {
      status: 'warning',
      warning: 'player_not_on_court',
      intent: 'record_score',
      courtIdx,
      winnerTeam: null,
      scoreA: null,
      scoreB: null,
      winnerScore,
      loserScore,
      winnerNames: winnerPlayers.map((p) => p.name).join(' & '),
      loserNames: loserPlayers.map((p) => p.name).join(' & '),
      proposedTeamA: currentTeamA,
      proposedTeamB: currentTeamB,
      raw: parsedResult.raw,
    }
  }

  // Xác định điểm số gán cho Đội A và Đội B
  let scoreA = 0
  let scoreB = 0

  if (finalWinnerTeam === 'A') {
    scoreA = winnerScore
    scoreB = loserScore
  } else if (finalWinnerTeam === 'B') {
    scoreA = loserScore
    scoreB = winnerScore
  }

  // Tên hiển thị người chiến thắng & kẻ thua cuộc
  const winnerNames =
    winnerPlayers.map((p) => p.name).join(' & ') ||
    (finalWinnerTeam === 'A' ? 'A' : finalWinnerTeam === 'B' ? 'B' : '') // i18n-ok: team code fallback
  const loserNames =
    loserPlayers.map((p) => p.name).join(' & ') ||
    (finalWinnerTeam === 'A' ? 'B' : finalWinnerTeam === 'B' ? 'A' : '') // i18n-ok: team code fallback

  return {
    status: 'ok',
    intent: 'record_score',
    courtIdx,
    winnerTeam: finalWinnerTeam,
    scoreA,
    scoreB,
    winnerScore,
    loserScore,
    winnerNames,
    loserNames,
    proposedTeamA,
    proposedTeamB,
    raw: parsedResult.raw,
  }
}
