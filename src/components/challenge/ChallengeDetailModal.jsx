import { useState, useMemo } from 'react'
import { Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { courtOf, myMember, playerName, playerOf } from '#lib/money.js'
import { expectedScore, getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { searchMatches } from '#lib/matchSearch.js'
import { getChallengeAcceptanceProgress, canMemberAcceptChallenge, canAdminForceAcceptChallenge, challengeCloserOf, validateStakePoints, getPredictionStats, getMemberPrediction, canMemberPredict, availableSeasonPoints, isChallengeExpired, challengeExpiryAt, isChallengeAccepted } from '#lib/challenge.js'
import { calculateSeasonLeaderboard, calcSeasonMatchDeltaFinal, challengeMultiplierOf } from '#lib/season.js'
import cfg from '#config/app.json'
import { t } from '#i18n'

export default function ChallengeDetailModal({ challenge, session, onClose, onScoreInput, onOpenMatch }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [predTeam, setPredTeam] = useState('A')
  const [predStake, setPredStake] = useState(1)
  const [stakeEditing, setStakeEditing] = useState(false)
  const [stakeDraft, setStakeDraft] = useState('')
  const [now] = useState(() => Date.now())

  const c = useMemo(() => {
    if (!challenge?.id) return challenge || {}
    return (db.challenges || []).find((x) => x.id === challenge.id) || challenge
  }, [db.challenges, challenge])
  const myMem = myMember(db)
  const myId = myMem?.id || null
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  const teamA = useMemo(() => c?.teamA || [], [c?.teamA])
  const teamB = useMemo(() => c?.teamB || [], [c?.teamB])
  const isOpen = !teamB.length || (teamB && teamB.length < (teamA.length > 1 ? 2 : 1))

  const isCreator = Boolean(myId && c.createdBy === myId)
  const isTeamA = Boolean(myId && teamA.includes(myId))
  const isTeamB = Boolean(myId && teamB.includes(myId))
  const isParticipant = Boolean(myId && [...teamA, ...teamB].includes(myId))
  const isPending = c.status === 'pending'
  // Dùng chung `isChallengeExpired`: bản viết tay cũ ở đây bỏ qua `status`, nên kèo đã NHẬN mà
  // quá hạn-nhận-kèo cũng bị coi là hết hạn và khoá luôn cổng cược — nhận kèo lúc 19h, 20h vào
  // đặt thì bị báo hết hạn dù trận còn chưa đánh.
  const isExpired = isChallengeExpired(c, now)
  const isAccepted = isChallengeAccepted(c)
  const isPlayed = c.status === 'played'

  const prog = useMemo(() => getChallengeAcceptanceProgress(c), [c])
  const canAccept = canMemberAcceptChallenge(c, myId, isAdmin)
  const canForceAccept = canAdminForceAcceptChallenge(c, isAdmin)

  // Match liên quan nếu đã tạo/nhập tỷ số
  const matchObj = useMemo(() => {
    return (db.matches || []).find((m) => m.id === c.matchId || m.challengeId === c.id)
  }, [db.matches, c.matchId, c.id])
  const matchCode = matchObj ? matchCodeOf(db, matchObj) : (c.matchId ? `M-${c.matchId.slice(0, 4)}` : null)

  const effectiveSession = useMemo(() => {
    if (session) return session
    if (c?.sessionId) {
      return (db.sessions || []).find((s) => s.id === c.sessionId) || null
    }
    return null
  }, [session, c?.sessionId, db.sessions])

  // Available partners for open challenge (only club members who checked in, excluding guests)
  const pickablePartners = useMemo(() => {
    if (!effectiveSession) return []
    const att = db.attendance?.[effectiveSession.id] || {}
    const busyIds = new Set([...teamA, ...(myId ? [myId] : [])])
    return (db.members || []).filter((m) => m.active !== false && att[m.id] === true && !busyIds.has(m.id))
  }, [db.attendance, db.members, effectiveSession, teamA, myId])

  const getRating = (id) => getPlayerRating(db.playerRatings, id, playerOf(db, id), db.levels).rating

  // Calculate ratings
  const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0

  const resolvedTeamB = useMemo(() => {
    if (isOpen && selectedPartner) {
      return teamA.length > 1 ? [myId, selectedPartner] : [myId]
    }
    return teamB
  }, [isOpen, selectedPartner, teamB, teamA.length, myId])

  const ratB = resolvedTeamB.length
    ? Math.round(resolvedTeamB.reduce((sum, id) => sum + getRating(id), 0) / resolvedTeamB.length)
    : 0

  // Điểm mùa dự kiến của kèo. Dùng CHUNG `calcSeasonMatchDeltaFinal` với màn ghi tỉ số và với
  // `calculateSeasonLeaderboard` — ba nơi một luật, không nơi nào tự nhân hệ số lấy.
  // Không gồm thưởng chuỗi/lật kèo: hai cái đó cần cả lịch sử mùa của từng người.
  const seasonPreview = useMemo(() => {
    if (isPlayed || c.ratingEnabled === false) return null
    if (!teamA.length || !resolvedTeamB.length || !ratB) return null
    const multiplier = challengeMultiplierOf(db)
    const win = calcSeasonMatchDeltaFinal(ratA, ratB, true, { isChallenge: true, multiplier })
    const lose = calcSeasonMatchDeltaFinal(ratA, ratB, false, { isChallenge: true, multiplier })
    return { multiplier, aWin: win.delta, aLose: lose.delta, baseWin: win.baseDelta }
  }, [isPlayed, c.ratingEnabled, teamA.length, resolvedTeamB.length, ratA, ratB, db])

  const gap = Math.abs(ratA - ratB)
  const expA = expectedScore(ratA, ratB || ratA)
  const pctA = Math.round(expA * 100)
  const pctB = 100 - pctA

  // H2H statistics between Team A and Team B
  const pA = teamA[0]
  const pB = teamB[0]
  const nameA = pA ? playerName(db, pA) : t('challenge.teamA')
  const nameB = pB ? playerName(db, pB) : t('challenge.teamB')

  const exactPairMatches = useMemo(() => {
    if (!teamA.length || !teamB.length) return []
    return (db.matches || []).filter((m) => {
      const mA = m.teamA || []
      const mB = m.teamB || []
      const aInA = teamA.length === mA.length && teamA.every((id) => mA.includes(id))
      const bInB = teamB.length === mB.length && teamB.every((id) => mB.includes(id))
      if (aInA && bInB) return true

      const aInB = teamA.length === mB.length && teamA.every((id) => mB.includes(id))
      const bInA = teamB.length === mA.length && teamB.every((id) => mA.includes(id))
      return aInB && bInA
    })
  }, [db.matches, teamA, teamB])

  const isExactPairH2H = exactPairMatches.length > 0

  const leaderMatches = useMemo(() => {
    if (isExactPairH2H || !pA || !pB) return []
    return (db.matches || []).filter((m) => {
      const mA = m.teamA || []
      const mB = m.teamB || []
      const inA = mA.includes(pA) && mB.includes(pB)
      const inB = mA.includes(pB) && mB.includes(pA)
      return inA || inB
    })
  }, [isExactPairH2H, db.matches, pA, pB])

  const h2hMatches = isExactPairH2H ? exactPairMatches : leaderMatches

  const h2hWinsA = useMemo(() => {
    return h2hMatches.filter((m) => {
      const wonA = m.winnerTeam === 'A'
      const aWasInSideA = isExactPairH2H
        ? teamA.every((id) => (m.teamA || []).includes(id))
        : (m.teamA || []).includes(pA)
      return (aWasInSideA && wonA) || (!aWasInSideA && !wonA)
    }).length
  }, [h2hMatches, isExactPairH2H, teamA, pA])

  const h2hWinsB = h2hMatches.length - h2hWinsA

  const recent5 = useMemo(() => {
    return h2hMatches.slice(0, 5).map((m) => {
      const wonA = m.winnerTeam === 'A'
      const aWasInSideA = isExactPairH2H
        ? teamA.every((id) => (m.teamA || []).includes(id))
        : (m.teamA || []).includes(pA)
      return (aWasInSideA && wonA) || (!aWasInSideA && !wonA) ? 'W' : 'L'
    })
  }, [h2hMatches, isExactPairH2H, teamA, pA])

  // Predictions
  const predictions = useMemo(() => db.challengePredictions || [], [db.challengePredictions])
  const predStats = useMemo(() => getPredictionStats(predictions, c.id), [predictions, c.id])
  const myPred = useMemo(() => getMemberPrediction(predictions, c.id, myId), [predictions, c.id, myId])
  // Quét lại toàn bộ lịch sử trận cả mùa chỉ để lấy một con số SP, nên bám vào đúng ba mảng
  // liên quan thay vì cả `db` — `db` đổi ở mọi thao tác, kể cả thao tác chẳng dính gì tới điểm.
  const seasonRes = useMemo(
    () => calculateSeasonLeaderboard(db),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.matches, db.members, db.challengePredictions, db.levels],
  )
  const myLbRow = useMemo(() => (seasonRes?.leaderboard || []).find((r) => r.id === myId), [seasonRes, myId])
  const totalSp = myLbRow?.totalSeasonPoints || 0
  // SP bị giam KHÔNG tính phiếu nằm trên kèo đã chết (huỷ / từ chối / quá hạn) — kèo quá hạn mà
  // không ai bấm vào thì `status` không bao giờ đổi, và điểm của người đặt bị giam vĩnh viễn.
  const availableSp = useMemo(
    () => availableSeasonPoints(totalSp, predictions, db.challenges, db.sessions, myId),
    [totalSp, predictions, db.challenges, db.sessions, myId],
  )
  // Trần tuyệt đối của một phiếu. Trùng số với CHECK trong migration 0047 — SQL không đọc được
  // JSON nên hai chỗ phải tự giữ khớp nhau.
  const maxStake = cfg.challenge?.maxStakePoints ?? 100
  // Ô nhập để rỗng được lúc đang gõ, nên `predStake` có thể là ''. Mọi so sánh phải qua số.
  // Luật hợp lệ đọc từ `validateStakePoints` — CHUNG với `a.placePrediction`, không chép lại.
  const stakeNum = Number(predStake) || 0
  const stakeCheck = validateStakePoints({ stake: predStake, maxStake, availableSp })
  const stakeInvalid = !stakeCheck.ok
  const overStake = stakeCheck.reason === 'over_max' || stakeCheck.reason === 'over_balance'
  // Luật cược đọc từ MỘT chỗ dùng chung với `a.placePrediction`, không chép lại điều kiện ở đây.
  const predGate = useMemo(
    () => canMemberPredict(c, myId, db, availableSp),
    [c, myId, db, availableSp],
  )
  const isPredLocked = Boolean(c.predictionsLocked || c.status === 'oncourt' || c.status === 'played' || c.status === 'cancelled' || isExpired)
  const noPointsLeft = predGate.reason === 'insufficient_points'

  // Handlers
  // `await`: hai hàm này giờ đi qua RPC nên là async. Không chờ thì nút nhả ngay lập tức và
  // người dùng bấm được lần hai trước khi server trả lời.
  const handlePlacePrediction = async () => {
    // Ô nhập tự do có thể đang rỗng hoặc vượt số dư — chặn ở đây chứ không đẩy lỗi xuống server.
    if (!predTeam || stakeInvalid) return
    setSubmitting(true)
    try {
      await a.placePrediction({ challengeId: c.id, team: predTeam, stakePoints: stakeNum })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelPrediction = async () => {
    if (!myPred) return
    setSubmitting(true)
    try {
      await a.cancelPrediction(myPred.id)
    } finally {
      setSubmitting(false)
    }
  }
  const handleAccept = () => {
    setSubmitting(true)
    try {
      a.respondChallenge(c.id, true)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // Admin duyệt hộ CẢ kèo. Tách khỏi `handleAccept` vì đây là hành động khác hẳn: nhận thay cho
  // mọi đấu thủ, kể cả người chưa có tài khoản nên không bao giờ tự bấm được.
  const handleForceAccept = () => {
    setSubmitting(true)
    try {
      a.respondChallenge(c.id, true, true)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = () => {
    setSubmitting(true)
    try {
      a.respondChallenge(c.id, false)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptOpen = () => {
    if (teamA.length > 1 && !selectedPartner) {
      a.toast(t('challenge.pickTwo'))
      return
    }
    setSubmitting(true)
    try {
      a.acceptOpenChallenge({ challengeId: c.id, partnerId: selectedPartner })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    a.confirm({
      title: t('challenge.cancelTitle'),
      message: t('challenge.cancelMsg'),
      tone: 'danger',
      confirmText: t('challenge.cancelOk'),
      onConfirm: () => {
        setSubmitting(true)
        try {
          a.cancelChallenge(c.id)
          onClose()
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const handleDelete = () => {
    a.confirm({
      title: t('challenge.confirmDeleteTitle'),
      message: t('challenge.confirmDeleteMsg'),
      tone: 'danger',
      confirmText: t('challenge.btnDelete'),
      onConfirm: () => {
        setSubmitting(true)
        try {
          a.deleteChallenge(c.id)
          onClose()
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  // Đổi thể thức BO1 ⇄ BO3, chỉ khi CHƯA ghi set nào. Điều kiện ở đây cố ý CHẶT HƠN hoặc bằng
  // `a.setChallengeFormat` — nút chỉ được phép ẩn đi, không bao giờ hiện ra rồi bấm vào ăn toast
  // từ chối. Dùng `isAdmin` cho khớp với nút Xoá ngay bên dưới trong cùng modal này.
  const bestOf = Number(c.bestOf) || 1
  const canEditFormat = Boolean(
    (isAdmin || isCreator)
    && !matchObj
    && c.status !== 'played' && c.status !== 'cancelled' && c.status !== 'expired'
    && !isExpired
  )
  const hasBets = (db.challengePredictions || []).some((x) => x.challengeId === c.id && x.status === 'pending')

  // GIAO KÈO — thoả thuận đời thật. Thuần trang trí: không dính điểm, không dính tiền, app không
  // thu hộ ai. Ai đứng trong kèo (hoặc admin) đều sửa được, kể cả sau khi đã đánh xong.
  const stakeText = c.stakeText || ''
  const canEditStake = Boolean(isAdmin || isCreator || isParticipant)
  const stakeMaxLen = cfg.challenge?.stakeMaxLen ?? 120
  // Liệt kê TƯỜNG MINH từng key thay vì ghép chuỗi `stakeTpl${i}` — `smoke/i18n.test.js` quét key
  // dùng thẳng trong code, ghép động là nó không thấy và báo key chết.
  const stakeTemplates = [
    t('challenge.stakeTpl1'),
    t('challenge.stakeTpl2'),
    t('challenge.stakeTpl3'),
    t('challenge.stakeTpl4'),
    t('challenge.stakeTpl5'),
  ]

  const openStakeEditor = () => {
    setStakeDraft(stakeText)
    setStakeEditing(true)
  }

  const handleSaveStake = (value) => {
    a.setChallengeStake(c.id, value)
    setStakeEditing(false)
  }

  const handleFormat = (b) => {
    if (b === bestOf || submitting) return
    setSubmitting(true)
    try {
      a.setChallengeFormat(c.id, b)
    } finally {
      setSubmitting(false)
    }
  }

  const creatorName = c.createdBy ? playerName(db, c.createdBy) : (teamA[0] ? playerName(db, teamA[0]) : '')
  // Bước 2 của timeline nói về BÊN NHẬN KÈO, nên tên ở đây luôn là đội B — KHÔNG phải `acceptedBy`.
  // `acceptedBy` là người bấm nhát cuối làm kèo đủ chữ ký; ở kèo đôi người đó có thể thuộc đội A
  // (hoặc là admin duyệt hộ, chẳng đánh trận nào). Lấy nó làm tên bước 2 thì thành "Nam nhận kèo"
  // với Nam là đồng đội của chính người tạo kèo.
  const acceptorName = teamB[0]
    ? playerName(db, teamB[0])
    : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB'))

  // Người chốt kèo chỉ đáng nhắc khi KHÔNG phải đội B — tức admin duyệt hộ hoặc người đội A bấm
  // cuối. Đội B tự nhận là chuyện đương nhiên, nói ra chỉ thừa.
  const closerId = challengeCloserOf(c)
  const closerName = closerId ? playerName(db, closerId) : ''

  const createdTimeStr = c.createdAt
    ? new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '20:14'
  const expireAtMs = challengeExpiryAt(c)
  const expireTimeStr = expireAtMs
    ? new Date(expireAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '21:14'
  const acceptedTimeStr = c.acceptedAt
    ? new Date(c.acceptedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : createdTimeStr
  const courtName = c.courtId
    ? (courtOf(db, c.courtId)?.name || `${t('units.court')} ${c.courtId}`)
    : (c.courtName ? `${t('units.court')} ${c.courtName}` : '')
  const matchTimeStr = matchObj?.createdAt
    ? new Date(matchObj.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''

  const headerSubText = effectiveSession?.date
    ? t('challenge.headerMeta', {
        creator: creatorName || t('challenge.teamA'),
        time: createdTimeStr,
        date: effectiveSession.date,
        court: courtName ? ` · ${courtName}` : '',
      })
    : t('challenge.headerMetaCasual', {
        creator: creatorName || t('challenge.teamA'),
        time: createdTimeStr,
        court: courtName ? ` · ${courtName}` : '',
      })

  if (!challenge) return null

  return (
    <Dialog
      open
      sheet={isMobile}
      width={480}
      title={`${t('challenge.challenge')} ${c.code}`}
      description={headerSubText}
      onClose={onClose}
      style={{
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
          {isPending && isExpired && (
            <div style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--red-500, #ef4444)',
              color: 'var(--red-500, #ef4444)',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
            }}>
              {t('challenge.status.expired')}
            </div>
          )}

          {/* Tự nhận cho MÌNH — chỉ đấu thủ trong kèo. Admin ngoài trận đi đường "Duyệt cả kèo". */}
          {isPending && !isExpired && isParticipant && canAccept && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleAccept}
              style={{
                flex: 1,
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '700 15px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {t('challenge.btnAccept')}
            </button>
          )}

          {/* Admin nhận hộ TẤT CẢ. Hiện cả khi admin đang đánh trong kèo và đã tự nhận rồi —
              đó là lối thoát duy nhất cho kèo có người chưa ghép tài khoản. Khi đứng cạnh nút
              "Nhận kèo" thì hạ xuống dạng viền để không tranh chỗ nút chính. */}
          {isPending && !isExpired && canForceAccept && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleForceAccept}
              title={t('challenge.btnAdminApproveAllHint')}
              style={{
                flex: 1,
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: (isParticipant && canAccept) ? 'transparent' : 'var(--status-delivered)',
                border: (isParticipant && canAccept) ? '1px solid var(--status-delivered)' : 'none',
                font: '700 15px/1 "IBM Plex Sans", sans-serif',
                color: (isParticipant && canAccept) ? 'var(--status-delivered-fg)' : 'var(--gray-0)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: (isParticipant && canAccept) ? 'none' : 'var(--shadow-xs)',
              }}
            >
              {t('challenge.btnAdminApproveAll')}
            </button>
          )}

          {isPending && !isExpired && (isParticipant || isAdmin) && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleDecline}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 14px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('challenge.btnDecline')}
            </button>
          )}

          {isPending && !isExpired && isOpen && !isTeamA && !isCreator && (
            <button
              type="button"
              disabled={submitting || (teamA.length > 1 && !selectedPartner)}
              onClick={handleAcceptOpen}
              style={{
                flex: 1,
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '700 15px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: submitting || (teamA.length > 1 && !selectedPartner) ? 'not-allowed' : 'pointer',
                opacity: teamA.length > 1 && !selectedPartner ? 0.45 : 1,
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {t('challenge.btnAccept')}
            </button>
          )}

          {isAccepted && (
            <>
              {/* Nút này ghi "Nhập kết quả" nhưng trước đây gọi `onDeployed` — tức là xếp 4
                  người vào sân rồi điều hướng, KHÔNG mở ô nhập điểm. Giờ gọi đúng
                  `onScoreInput`, đúng việc nhãn của nó hứa. */}
              {onScoreInput && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onScoreInput(c)
                  }}
                  style={{
                    flex: 1,
                    height: isMobile ? 56 : 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--status-delivered)',
                    border: 'none',
                    font: '700 15px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--gray-0)',
                    cursor: 'pointer',
                  }}
                >
                  {t('challenge.btnDeploy')}
                </button>
              )}
              {onScoreInput && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onScoreInput(c)
                  }}
                  style={{
                    flex: 1,
                    height: isMobile ? 56 : 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    font: '600 14px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--status-transit-fg)',
                    cursor: 'pointer',
                  }}
                >
                  {courtName ? t('challenge.btnEnterScoreCourt', { court: courtName }) : t('challenge.btnEnterScore')}
                </button>
              )}
            </>
          )}

          {isPending && (isCreator || isTeamA) && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleCancel}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 13px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('challenge.btnCancel')}
            </button>
          )}

          {/* DT3: Nút mở trực tiếp trận đấu nếu đã có match */}
          {matchObj && onOpenMatch && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenMatch(matchObj)
              }}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-delivered)',
                border: 'none',
                font: '600 14px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--gray-0)',
                cursor: 'pointer',
              }}
            >
              {t('challenge.btnOpenMatch', { code: matchCode })}
            </button>
          )}

          {/* Nút xoá vĩnh viễn kèo cho Admin */}
          {isAdmin && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleDelete}
              style={{
                height: isMobile ? 56 : 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                font: '600 13px/1 "IBM Plex Sans", sans-serif',
                color: 'var(--red-500, #ef4444)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <Icon name="trash-2" size={14} style={{ marginRight: 6 }} />
              <span>{t('challenge.btnDelete')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              height: isMobile ? 56 : 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              font: '600 14px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Đổi thể thức BO1 / BO3 khi chưa ghi tỷ số */}
        {canEditFormat && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('challenge.formatLabel')}:</span>
              {[1, 3].map((b) => (
                <button
                  key={b}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFormat(b)}
                  style={{
                    height: 30,
                    minWidth: 52,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    font: '600 12px/1 var(--font-mono)',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    background: bestOf === b ? 'var(--navy-500)' : 'var(--surface-card)',
                    borderColor: bestOf === b ? 'var(--navy-400)' : 'var(--border-default)',
                    color: bestOf === b ? 'var(--action-primary-fg)' : 'var(--text-secondary)',
                  }}
                >
                  BO{b}
                </button>
              ))}
            </div>
            {hasBets && (
              <span style={{ font: '400 11.5px/1.4 var(--font-sans)', color: 'var(--status-delayed-fg)' }}>
                {t('challenge.formatHasBets')}
              </span>
            )}
          </div>
        )}

        {/* GIAO KÈO — thoả thuận ngoài sân. Highlight riêng để đập vào mắt, nhưng KHÔNG dùng màu
            xanh/đỏ của trạng thái kèo: nó không phải một trạng thái, chỉ là ghi chú vui. */}
        {(stakeText || (canEditStake && stakeEditing)) && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-delayed-bg)',
            border: '1px solid var(--status-delayed)',
            display: 'grid',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Icon name="award" size={15} style={{ color: 'var(--status-delayed-fg)' }} />
              <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--status-delayed-fg)' }}>
                {t('challenge.stakeLabel')}
              </span>
              {!stakeEditing && canEditStake && (
                <button
                  type="button"
                  onClick={openStakeEditor}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    font: '600 12px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Icon name="pencil" size={12} />
                  <span>{t('common.edit')}</span>
                </button>
              )}
            </div>

            {!stakeEditing && (
              <>
                <span style={{ font: '600 14px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {stakeText}
                </span>
                <span style={{ font: '400 11px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  {t('challenge.stakeHint')}
                </span>
              </>
            )}

            {stakeEditing && (
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  type="text"
                  value={stakeDraft}
                  maxLength={stakeMaxLen}
                  autoFocus
                  placeholder={t('challenge.stakePlaceholder')}
                  onChange={(e) => setStakeDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStake(stakeDraft) }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    font: '500 13.5px/1.3 "IBM Plex Sans", sans-serif',
                  }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <span style={{ font: '500 11px/1.6 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {t('challenge.stakeTplTitle')}:
                  </span>
                  {stakeTemplates.map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setStakeDraft(tpl)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-subtle)',
                        font: '500 11.5px/1.4 "IBM Plex Sans", sans-serif',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {tpl}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleSaveStake(stakeDraft)}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--status-delivered)',
                      border: 'none',
                      font: '700 13px/1 "IBM Plex Sans", sans-serif',
                      color: 'var(--gray-0)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStakeEditing(false)}
                    style={{
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      font: '600 13px/1 "IBM Plex Sans", sans-serif',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  {stakeText && (
                    <button
                      type="button"
                      onClick={() => handleSaveStake('')}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        font: '600 13px/1 "IBM Plex Sans", sans-serif',
                        color: 'var(--red-500, #ef4444)',
                        cursor: 'pointer',
                      }}
                    >
                      {t('challenge.stakeClear')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chưa có giao kèo thì chỉ là một dòng mời, không chiếm chỗ */}
        {!stakeText && !stakeEditing && canEditStake && (
          <button
            type="button"
            onClick={openStakeEditor}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'start',
              padding: '5px 10px',
              borderRadius: 999,
              background: 'transparent',
              border: '1px dashed var(--border-default)',
              font: '600 12px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <Icon name="award" size={13} />
            <span>{t('challenge.stakeAdd')}</span>
          </button>
        )}

        {/* Matchup Card */}
        <div style={S.boxCard}>
          {isPending && !isExpired && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)', marginBottom: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {t('challenge.acceptedProgress', { count: prog.acceptedCount, total: prog.totalCount })}
              </span>
              {Boolean(myId && (c.acceptedPlayers || []).includes(myId)) && !prog.isFullyAccepted && (
                <span style={{ fontSize: 12, color: 'var(--status-delivered-fg)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={12} />
                  <span>{t('challenge.youAcceptedWaiting')}</span>
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {teamA.map((id) => {
                  const isAcc = (c.acceptedPlayers || []).includes(id)
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{playerName(db, id)}</span>
                      {isPending && isAcc && (
                        <Icon name="check" size={13} style={{ color: 'var(--status-delivered-fg)' }} title={t('challenge.statusAccepted')} />
                      )}
                    </span>
                  )
                })}
              </div>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
              </span>
            </div>
            <span style={{ font: '700 13px/1 Barlow, sans-serif', color: 'var(--text-disabled)' }}>VS</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 14.5px/1.3 "IBM Plex Sans", sans-serif', color: resolvedTeamB.length ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
                {resolvedTeamB.length ? resolvedTeamB.map((id) => {
                  const isAcc = (c.acceptedPlayers || []).includes(id)
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{playerName(db, id)}</span>
                      {isPending && isAcc && (
                        <Icon name="check" size={13} style={{ color: 'var(--status-delivered-fg)' }} title={t('challenge.statusAccepted')} />
                      )}
                    </span>
                  )
                }) : (isOpen ? t('challenge.teamEmptyHint') : t('challenge.teamB'))}
              </div>
              <span style={{ font: '500 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {ratB > 0 ? t('challenge.avgRating', { r: ratB.toLocaleString('vi-VN') }) : '—'}
              </span>
            </div>
          </div>

          {/* Win% Bar */}
          {!isPlayed && ratB > 0 && (
            <div style={{ display: 'grid', gap: 5, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--status-transit-fg)', fontWeight: 600 }}>{pctA}%</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('rating.gap', { gap })}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{pctB}%</span>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                <div style={{ width: `${pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%' }} />
                <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
              </div>
            </div>
          )}

          {/* Điểm mùa dự kiến — đọc cùng một hàm với lúc ghi tỉ số và với sổ điểm, nên ba nơi
              không thể nói ba con số khác nhau. Kèo tắt xếp hạng thì không có điểm nào để khoe. */}
          {seasonPreview && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 6,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ font: '600 11.5px/1.2 var(--font-sans)', color: 'var(--text-muted)' }}>
                  {t('challenge.seasonPreviewTitle')}
                </span>
                {seasonPreview.multiplier > 1 && (
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: 'rgba(249, 115, 22, 0.14)',
                    border: '1px solid rgba(249, 115, 22, 0.35)',
                    font: '700 10.5px/1.3 var(--font-sans)',
                    color: '#EA580C',
                  }}>
                    {t('challenge.seasonPreviewMultBadge', { mult: seasonPreview.multiplier })}
                  </span>
                )}
              </div>
              <span style={{ font: '700 12.5px/1.2 var(--font-mono)' }}>
                <span style={{ color: 'var(--status-delivered-fg)' }}>+{seasonPreview.aWin}</span>
                <span style={{ color: 'var(--text-disabled)' }}> / </span>
                <span style={{ color: 'var(--red-500, #ef4444)' }}>{seasonPreview.aLose}</span>
              </span>
            </div>
          )}
        </div>

        {/* K6: Dự đoán kết quả (Thưởng Season Points) */}
        {c.predictionsEnabled !== false && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="target" size={15} style={{ color: 'var(--status-transit-fg)' }} />
                <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {t('challenge.predictionTitle')}
                </span>
              </div>
              {isPredLocked ? (
                <span style={{
                  font: '600 11px/1 "IBM Plex Sans", sans-serif',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-chip)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {t('challenge.predictionLockedBadge')}
                </span>
              ) : (
                <span style={{ font: '400 11.5px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                  {t('challenge.predictionVotes', { count: predStats.totalCount, points: predStats.totalPoints })}
                </span>
              )}
            </div>

            {/* Thanh tỉ lệ dự đoán */}
            <div style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--action-accent-bg, var(--teal-500))', fontWeight: 600 }}>
                  {t('challenge.teamA')}: {predStats.pctA}% ({predStats.pointsA} SP)
                </span>
                <span style={{ color: 'var(--status-incident, var(--red-500))', fontWeight: 600 }}>
                  {t('challenge.teamB')}: {predStats.pctB}% ({predStats.pointsB} SP)
                </span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                <div style={{ width: `${predStats.pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%', transition: 'width 0.3s' }} />
                <div style={{ width: `${predStats.pctB}%`, background: 'var(--status-incident, var(--red-500))', height: '100%', transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Trường hợp đấu thủ trong trận: Cấm tham gia */}
            {isParticipant ? (
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-delayed-bg)',
                border: '1px solid var(--status-delayed)',
                fontSize: 12,
                color: 'var(--status-delayed-fg)',
                lineHeight: 1.4,
              }}>
                {t('challenge.predictionPlayerConflict')}
              </div>
            ) : myPred ? (
              /* Đã dự đoán */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                    {t('challenge.predictionMyVote', {
                      team: myPred.team === 'A' ? t('challenge.teamA') : t('challenge.teamB'),
                      points: myPred.stakePoints,
                    })}
                  </span>
                  <span style={{ font: '500 11.5px/1.2 "IBM Plex Sans", sans-serif', color: myPred.status === 'won' ? 'var(--status-delivered-fg)' : myPred.status === 'lost' ? 'var(--red-500, #ef4444)' : 'var(--text-muted)' }}>
                    {myPred.status === 'won'
                      ? t('challenge.predictionStatusWon', { net: myPred.stakePoints })
                      : myPred.status === 'lost'
                      ? t('challenge.predictionStatusLost', { stake: myPred.stakePoints })
                      : myPred.status === 'refunded'
                      ? t('challenge.predictionStatusRefunded', { points: myPred.payoutPoints })
                      : t('challenge.predictionStatusPending')}
                  </span>
                </div>
                {myPred.status === 'pending' && !isPredLocked && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCancelPrediction}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--red-500, #ef4444)',
                      font: '600 12px/1 "IBM Plex Sans", sans-serif',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {t('challenge.predictionCancelBtn')}
                  </button>
                )}
              </div>
            ) : isPredLocked || noPointsLeft ? (
              /* Chưa dự đoán nhưng kèo đã khoá, hoặc hết Điểm Mùa khả dụng */
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}>
                {noPointsLeft && !isPredLocked ? t('challenge.predictionNoPoints') : t('challenge.predictionLockedDesc')}
              </div>
            ) : (
              /* Form đặt dự đoán */
              <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                {/* Chọn đội A hoặc B */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPredTeam('A')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: predTeam === 'A' ? 'rgba(0,178,169,0.14)' : 'var(--surface-sunken)',
                      border: predTeam === 'A' ? '1.5px solid var(--action-accent-bg, var(--teal-500))' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ font: '700 13px/1.2 "IBM Plex Sans", sans-serif', color: predTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-primary)' }}>
                      {t('challenge.teamA')}
                    </span>
                    <span style={{ font: '400 11px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                      {teamA.map((id) => playerName(db, id)).join(' · ')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPredTeam('B')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: predTeam === 'B' ? 'rgba(239,68,68,0.12)' : 'var(--surface-sunken)',
                      border: predTeam === 'B' ? '1.5px solid var(--status-incident, var(--red-500))' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ font: '700 13px/1.2 "IBM Plex Sans", sans-serif', color: predTeam === 'B' ? 'var(--red-500, #ef4444)' : 'var(--text-primary)' }}>
                      {t('challenge.teamB')}
                    </span>
                    <span style={{ font: '400 11px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                      {resolvedTeamB.length ? resolvedTeamB.map((id) => playerName(db, id)).join(' · ') : t('challenge.teamB')}
                    </span>
                  </button>
                </div>

                {/* Mức SP: nhập tự do. Ba nút 1/2/3 cũ đã bỏ — trần thật nằm ở SP khả dụng của
                    chính người đặt, và ở `maxStakePoints` (server cũng chặn, xem 0047). */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ font: '500 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                    {t('challenge.predictionStakeLabel')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxStake}
                      value={predStake}
                      onChange={(e) => {
                        // Cho phép ô rỗng lúc đang gõ; nút Gửi tự khoá vì 0 > availableSp là false
                        // nhưng `!predTeam || !predStake` ở `handlePredict` chặn lại.
                        const raw = e.target.value
                        if (raw === '') { setPredStake(''); return }
                        const n = Math.floor(Number(raw))
                        if (!Number.isFinite(n)) return
                        setPredStake(Math.max(0, Math.min(maxStake, n)))
                      }}
                      style={{
                        width: 78,
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-sunken)',
                        color: 'var(--text-primary)',
                        border: overStake
                          ? '1px solid var(--red-500, #ef4444)'
                          : '1px solid var(--border-subtle)',
                        font: '700 13px/1 "IBM Plex Mono", monospace',
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>SP</span>
                  </div>
                </div>

                {/* Số SP khả dụng & Tỉ lệ thưởng */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <span>{t('challenge.predictionAvailableSp', { points: availableSp })}</span>
                  <span style={{ color: overStake ? 'var(--red-500, #ef4444)' : 'var(--status-delivered-fg)' }}>
                    {t('challenge.predictionWinReward', { payout: stakeNum * 2, stake: stakeNum })}
                  </span>
                </div>

                {/* Nút gửi dự đoán */}
                <button
                  type="button"
                  disabled={submitting || !myId || stakeInvalid}
                  onClick={handlePlacePrediction}
                  style={{
                    width: '100%',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--action-accent-bg, var(--teal-500))',
                    border: 'none',
                    font: '700 13.5px/1 "IBM Plex Sans", sans-serif',
                    color: 'var(--gray-0, #fff)',
                    cursor: (submitting || !myId || stakeInvalid) ? 'not-allowed' : 'pointer',
                    opacity: (submitting || !myId || stakeInvalid) ? 0.6 : 1,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <Icon name="target" size={14} />
                  <span>{t('challenge.predictionPlaceBtn')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* K5: Chọn đồng đội khi nhận kèo mở */}
        {isOpen && !isTeamA && !isCreator && teamA.length > 1 && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
              <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('challenge.pickTwo')}
              </span>
              <span style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('challenge.presentMembers', { n: pickablePartners.length })}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {pickablePartners.map((m) => {
                const isSelected = selectedPartner === m.id
                const r = getRating(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedPartner(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(0,178,169,0.12)' : 'var(--surface-sunken)',
                      border: isSelected ? '1.5px solid var(--status-transit-fg)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 999,
                      border: isSelected ? '5px solid var(--status-transit-fg)' : '1.5px solid var(--border-default)',
                    }} />
                    <span style={{ flex: 1, font: '600 13px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                      {m.name}
                    </span>
                    <span style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      {r} Elo
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* K4: Thống kê đối đầu H2H quá khứ */}
        {h2hMatches.length > 0 && (
          <div style={S.boxCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {isExactPairH2H ? t('challenge.h2hExactTitle') : t('challenge.h2hLeaderTitle', { nameA, nameB })}
                </span>
                <span style={{ font: '400 11px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 2 }}>
                  {isExactPairH2H ? t('challenge.h2hExactSub') : t('challenge.h2hLeaderSub')}
                </span>
              </div>
              <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {h2hMatches.length} {t('units.match')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 0' }}>
              <span style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--status-delivered-fg)' }}>{h2hWinsA}</span>
              <span style={{ color: 'var(--text-disabled)', fontSize: 16 }}>–</span>
              <span style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--text-secondary)' }}>{h2hWinsB}</span>
            </div>
            {recent5.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '400 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  {t('challenge.recentH2HForm', { n: recent5.length })}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {recent5.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        width: 20, height: 20, borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        font: '700 11px/1 Barlow, sans-serif',
                        background: r === 'W' ? 'rgba(18,168,103,0.18)' : 'rgba(239,68,68,0.18)',
                        color: r === 'W' ? 'var(--status-delivered-fg)' : 'var(--red-500, #ef4444)',
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DT3: Timeline 4 bước tới Match */}
        <div style={S.boxCard}>
          <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            {t('challenge.timelineTitle')}
          </div>

          <div style={{ display: 'grid', gap: 0, position: 'relative' }}>
            {[
              {
                title: t('challenge.step1Create', { name: creatorName || t('challenge.teamA') }),
                sub: t('challenge.step1Sub', { time: createdTimeStr, expire: expireTimeStr }),
                status: 'done',
              },
              {
                // Tiêu đề PHẢI đổi theo trạng thái. Bản cũ luôn ghi "X nhận kèo" kể cả lúc còn
                // pending, mà `acceptorName` thì fallback về teamB[0] — thành ra kèo vừa tạo đã
                // hiện "Hùng nhận kèo" dù Hùng chưa đụng vào, đọc y như đã nhận rồi.
                title: (isAccepted || isPlayed)
                  ? t('challenge.step2Accept', { name: acceptorName || t('challenge.teamB') })
                  : t('challenge.step2AcceptPending', { name: acceptorName || t('challenge.teamB') }),
                sub: (isAccepted || isPlayed)
                  ? (closerName
                    ? t('challenge.step2SubBy', { time: acceptedTimeStr, name: closerName })
                    : t('challenge.step2Sub', { time: acceptedTimeStr }))
                  : (c.status === 'declined'
                    ? t('challenge.toastDeclined', { code: c.code })
                    : (prog.totalCount > 0 ? t('challenge.acceptedProgress', { count: prog.acceptedCount, total: prog.totalCount }) : t('challenge.status.pending'))),
                status: (isAccepted || isPlayed) ? 'done' : (isPending ? 'current' : 'pending'),
              },
              {
                title: t('challenge.step3WaitCourt'),
                sub: (courtName || c.deployedAt || isPlayed)
                  ? t('challenge.step3Sub', { time: c.deployedAt ? new Date(c.deployedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : acceptedTimeStr, court: courtName || t('units.court') })
                  : t('challenge.step3SubPending'),
                status: (isPlayed || courtName || c.deployedAt) ? 'done' : (isAccepted ? 'current' : 'pending'),
              },
              {
                title: t('challenge.step4Score', { match: matchCode || 'M-xxxx' }),
                sub: (matchObj || isPlayed)
                  ? t('challenge.step4Sub', { time: matchTimeStr || '—' })
                  : t('challenge.step4SubPending'),
                status: (matchObj || isPlayed) ? 'done' : 'pending',
              },
            ].map((st, idx, arr) => {
              const isLast = idx === arr.length - 1
              return (
                <div key={idx} style={{ display: 'flex', gap: 12, position: 'relative', minHeight: isLast ? undefined : 46 }}>
                  {/* Cột vạch nối và dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      marginTop: 3,
                      // `current` CỐ Ý không dùng xanh `--status-delivered` nữa: trùng đúng màu
                      // của `done` nên bước đang chờ trông y hệt bước đã xong. Vàng `delayed` là
                      // màu "đang treo" dùng chung với badge Chờ nhận ở bảng kèo.
                      background: st.status === 'done' ? 'var(--status-delivered)' : st.status === 'current' ? 'var(--surface-card)' : 'var(--surface-sunken)',
                      border: st.status === 'done'
                        ? '2px solid var(--status-delivered)'
                        : st.status === 'current'
                        ? '2px solid var(--status-delayed)'
                        : '2px solid var(--border-default)',
                      boxShadow: st.status === 'current' ? '0 0 0 3px rgba(240, 183, 92, 0.22)' : 'none',
                      zIndex: 1,
                    }} />
                    {!isLast && (
                      <div style={{
                        flex: 1,
                        width: 2,
                        background: st.status === 'done' ? 'var(--status-delivered)' : 'var(--border-subtle)',
                        margin: '2px 0',
                      }} />
                    )}
                  </div>

                  {/* Cột thông tin bước */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                    <div style={{
                      font: '600 13px/1.3 "IBM Plex Sans", sans-serif',
                      color: st.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}>
                      {st.title}
                    </div>
                    <div style={{
                      font: '400 11.5px/1.3 "IBM Plex Mono", monospace',
                      color: st.status === 'pending' ? 'var(--text-disabled)' : 'var(--text-muted)',
                      marginTop: 2,
                    }}>
                      {st.sub}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* DT3: Bảng thông số kỹ thuật metadata */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{
            display: 'grid',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
            overflow: 'hidden',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaStatus')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{(c.status || 'pending').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaMatch')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: matchCode ? 'var(--status-delivered-fg)' : 'var(--text-disabled)' }}>
                {matchCode ? t('challenge.techMetaMatchCreated', { code: matchCode }) : t('challenge.techMetaMatchPending')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaRatingEnabled')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{c.ratingEnabled !== false ? 'true' : 'false'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t('challenge.techMetaRatingAlgorithm')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('challenge.techMetaAlgoValue')}</span>
            </div>
          </div>
          <div style={{ font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
            {t('challenge.techMetaDeclinedNote')}
          </div>
        </div>

        {/* Notice về Elo */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: c.ratingEnabled !== false ? 'rgba(0,178,169,0.08)' : 'rgba(255,255,255,0.05)',
          border: '1px solid ' + (c.ratingEnabled !== false ? 'rgba(0,178,169,0.2)' : 'var(--border-subtle)'),
          fontSize: 12,
          color: c.ratingEnabled !== false ? 'var(--status-transit-fg)' : 'var(--text-muted)',
          lineHeight: 1.4,
        }}>
          {c.ratingEnabled !== false ? t('challenge.ratedHintDesc') : t('challenge.casualHintDesc')}
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  boxCard: {
    padding: '12px 14px',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}
