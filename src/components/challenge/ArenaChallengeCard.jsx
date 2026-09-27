import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '#ds'
import { t } from '#i18n'
import { dd } from '#utils/dates.js'
import {
  BALANCE_THRESHOLD, IMBALANCE_THRESHOLD, expectedScore,
} from '#lib/rating.js'
import {
  getChallengeAcceptanceProgress, canMemberAcceptChallenge, getChallengeSeriesProgress,
  getPredictionStats, challengeExpiryAt, challengeCountdown, isChallengeExpired, isChallengeAccepted,
  getChallengeMatchTags,
} from '#lib/challenge.js'
import { sessionMembers, sGuests, isPresent } from '#lib/money.js'
import { sessionPlayers } from '#lib/assign.js'

/**
 * Lấy chữ cái viết tắt của người chơi (2 chữ cái hoa nếu có họ tên)
 */
function getInitials(name = '') {
  if (!name || typeof name !== 'string') return '?'
  const words = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
  if (!words.length || !words[0]) return '?'
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0]).toUpperCase()
}

/**
 * Màu nền avatar sinh từ tên người chơi
 */
function getAvatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360
  }
  return `hsl(${h}, 55%, 32%)`
}

/**
 * Component hiển thị Avatar người chơi theo phong cách Đấu trường 1a
 */
function ArenaAvatar({ memberId, member, team, size = 44 }) {
  const name = member?.name || memberId || ''
  const avatarUrl = member?.avatarUrl || member?.avatar || null
  const initials = getInitials(name)
  const isTeamA = team === 'A'

  const borderRing = isTeamA ? '#2EC4B6' : '#FF7A59'
  const borderWidth = size > 60 ? 4 : 3

  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: avatarUrl ? 'transparent' : getAvatarColor(name),
        border: `${borderWidth}px solid #0D1526`,
        boxShadow: `0 0 0 2px ${borderRing}`,
        color: '#FFFFFF',
        font: `800 ${Math.round(size * 0.4)}px/1 "Barlow Condensed", system-ui, sans-serif`,
        letterSpacing: '0.02em',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

/**
 * Trích xuất danh sách các séc đấu của kèo đã kết thúc (cho phong cách 4e)
 */
function getChallengeSetsList(c, matches = []) {
  if (!c) return []
  const isBoSeries = (c.bestOf || 1) > 1
  const chalProg = getChallengeSeriesProgress(c, matches)
  const playedMts = chalProg?.playedMatches || []

  if (isBoSeries && playedMts.length > 0) {
    const list = []
    playedMts.forEach((m) => {
      if (Array.isArray(m?.sets) && m.sets.length > 0) {
        m.sets.forEach((pair) => {
          if (Array.isArray(pair) && pair.length >= 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))) {
            list.push({ a: Number(pair[0]), b: Number(pair[1]) })
          }
        })
      } else if (typeof m?.scoreText === 'string') {
        m.scoreText.split(',').forEach((p) => {
          const parts = p.trim().split('-')
          if (parts.length === 2) {
            const sa = Number(parts[0].trim())
            const sb = Number(parts[1].trim())
            if (Number.isFinite(sa) && Number.isFinite(sb)) {
              list.push({ a: sa, b: sb })
            }
          }
        })
      }
    })
    if (list.length > 0) return list
  }

  const matchId = c.matchId || playedMts[0]?.id
  const match = matchId ? matches.find((m) => m.id === matchId) : playedMts[0]
  if (match) {
    if (Array.isArray(match.sets) && match.sets.length > 0) {
      const list = []
      match.sets.forEach((pair) => {
        if (Array.isArray(pair) && pair.length >= 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))) {
          list.push({ a: Number(pair[0]), b: Number(pair[1]) })
        }
      })
      if (list.length > 0) return list
    }
    if (typeof match.scoreText === 'string') {
      const list = []
      match.scoreText.split(',').forEach((p) => {
        const parts = p.trim().split('-')
        if (parts.length === 2) {
          const sa = Number(parts[0].trim())
          const sb = Number(parts[1].trim())
          if (Number.isFinite(sa) && Number.isFinite(sb)) {
            list.push({ a: sa, b: sb })
          }
        }
      })
      if (list.length > 0) return list
    }
  }

  return []
}

/**
 * Menu 3 chấm các thao tác mở rộng của card
 */
function ArenaCardMenu({ items }) {
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        type="button"
        aria-label={t('common.more')}
        title={t('common.more')}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color: '#8494AA',
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="ellipsis" size={14} />
      </button>
      {open && (
        <>
          <div
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: 0,
              zIndex: 50,
              background: '#0D1526',
              border: '1px solid #243353',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
              padding: 4,
              minWidth: 160,
              display: 'grid',
              gap: 2,
            }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  it.onClick()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'none',
                  color: it.danger ? '#FF9C9C' : '#E9EFF7',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon name={it.icon} size={14} />
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function ArenaChallengeCard({
  challenge: c,
  isFeatured = false,
  db,
  a,
  myId,
  isAdmin,
  isMobile = false,
  highlightedChallengeId,
  now = 0,
  getRating,
  memberNameOf,
  shortNameOf,
  onViewChallenge,
  onSelectSession,
  onViewMatch,
  onRevenge,
}) {
  const navigate = useNavigate()

  const teamA = c.teamA || []
  const teamB = c.teamB || []
  const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0
  const ratB = teamB.length ? Math.round(teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length) : 0
  const gap = Math.abs(ratA - ratB)
  const pA = expectedScore(ratA, ratB || ratA)
  const pctA = Math.round(pA * 100)
  const pctB = 100 - pctA

  const isPlayed = c.status === 'played'
  const isPending = c.status === 'pending'
  const isAccepted = isChallengeAccepted(c)
  const isParticipant = myId && [...teamA, ...teamB].includes(myId)
  const isOpen = !teamB.length || teamB.length < (teamA.length > 1 ? 2 : 1)

  // Tiến độ nhận kèo
  const prog = getChallengeAcceptanceProgress(c)
  const canAccept = canMemberAcceptChallenge(c, myId, isAdmin)
  const hasAccepted = myId && (c.acceptedPlayers || []).includes(myId)

  // Countdown hết hạn
  const expTime = challengeExpiryAt(c)
  const isExpired = isChallengeExpired(c, now)
  let expStr = ''
  if (expTime && isPending && !isExpired) {
    const cd = challengeCountdown(expTime - now)
    expStr = !cd || cd.kind === 'over' ? ''
      : cd.kind === 'day' ? `${cd.n} ${t('units.day')}`
        : cd.kind === 'hour' ? `${cd.n} ${t('units.hour')}`
          : cd.text
  }

  const isBoSeries = (c.bestOf || 1) > 1
  const seriesProg = isBoSeries ? getChallengeSeriesProgress(c, db.matches || []) : null
  const hasPlayedSets = seriesProg && seriesProg.totalSetsPlayed > 0

  const chalProg = seriesProg || getChallengeSeriesProgress(c, db.matches || [])
  const winnerTeam = chalProg.winnerTeam || c.winnerTeam
  const playedMts = chalProg.playedMatches || []
  const firstMatch = playedMts[0] || (c.matchId ? (db.matches || []).find((m) => m.id === c.matchId) : null)
  let singleScoreA = null
  let singleScoreB = null
  if (firstMatch) {
    if (firstMatch.sets && firstMatch.sets.length > 0) {
      singleScoreA = firstMatch.sets[0][0]
      singleScoreB = firstMatch.sets[0][1]
    } else if (firstMatch.scoreText && firstMatch.scoreText.includes('-')) {
      const [sa, sb] = firstMatch.scoreText.split('-').map((v) => Number(v.trim()))
      singleScoreA = sa
      singleScoreB = sb
    }
  }

  // Danh sách séc đấu và tỉ số theo phong cách 4e
  const setsList = getChallengeSetsList(c, db.matches || [])
  let aw = 0
  let bw = 0
  setsList.forEach((s) => {
    if (s.a > s.b) aw++
    else if (s.b > s.a) bw++
  })

  const setScore = isBoSeries
    ? `${chalProg.winsA} - ${chalProg.winsB}`
    : setsList.length > 1
      ? `${aw} - ${bw}`
      : setsList.length === 1
        ? `${setsList[0].a} - ${setsList[0].b}`
        : (singleScoreA !== null && singleScoreB !== null)
          ? `${singleScoreA} - ${singleScoreB}`
          : (winnerTeam === 'A' ? '1 - 0' : winnerTeam === 'B' ? '0 - 1' : '0 - 0')

  // Nút Phục thù chỉ hiện với người ở đội thua
  const isLoser = isPlayed && Boolean(myId) && (
    (winnerTeam === 'A' && teamB.includes(myId)) ||
    (winnerTeam === 'B' && teamA.includes(myId))
  )

  const statusBadgeText = (isPending && isExpired) || c.status === 'expired'
    ? t('challenge.status.expired')
    : isPending
      ? `${t('challenge.status.pending')}${expStr ? ` · ${expStr}` : ''}`
      : isAccepted && hasPlayedSets
        ? `${t('challenge.seriesPlaying', { score: seriesProg.seriesScoreText })} · ${t('challenge.seriesSetShort', { set: seriesProg.nextSetNumber })}`
        : isPlayed && isBoSeries && seriesProg
          ? `${t('challenge.status.played')} (${seriesProg.seriesScoreText})`
          : (t('challenge.status.' + c.status) || c.status)

  const sessionObj = c.sessionId ? (db.sessions || []).find((s) => s.id === c.sessionId) : null
  const allPlayers = [...teamA, ...teamB]
  const att = sessionObj ? (db.attendance?.[sessionObj.id] || {}) : {}
  const mems = sessionObj ? sessionMembers(db, sessionObj) : []
  const guests = sessionObj ? sGuests(db, sessionObj.id) : []
  const eligibleKeys = new Set([
    ...mems.map((m) => m.id),
    ...guests.map((g) => g.guestId || g.memberId || g.id),
  ])
  const hasStartedAttendance = Object.values(att).some((v) => isPresent(v))
  const sessPlayers = (sessionObj && hasStartedAttendance) ? sessionPlayers(db, sessionObj) : []
  const presentKeys = new Set(sessPlayers.map((p) => p.key))

  const absentPlayerKeys = sessionObj && !isPlayed
    ? allPlayers.filter((id) => {
        if (att[id] === false || att[id] === 'noshow') return true
        if (!eligibleKeys.has(id)) return true
        if (hasStartedAttendance && !presentKeys.has(id)) return true
        return false
      })
    : []
  const hasAbsentInSession = absentPlayerKeys.length > 0
  const absentInSessionNames = absentPlayerKeys.map((id) => memberNameOf(id) || id)

  const predStats = getPredictionStats(db.challengePredictions || [], c.id)

  const isHighlighted = highlightedChallengeId === c.id
  const matchTags = getChallengeMatchTags(c, db?.matches || [], ratA, ratB)

  // Thành viên cho avatar
  const getMemberData = (id) => (db.members || []).find((m) => m.id === id) || null

  const avatarSize = isFeatured ? (isMobile ? 54 : 76) : (isMobile ? 40 : 44)
  const avatarOverlap = isFeatured ? (isMobile ? -14 : -18) : (isMobile ? -10 : -12)

  // Style cho Card Kèo Tâm Điểm hoặc Card Lưới
  return (
    <div
      id={`challenge-card-${c.id}`}
      onClick={() => onViewChallenge?.(c)}
      style={{
        position: 'relative',
        borderRadius: isFeatured ? 20 : 16,
        background: '#0D1526',
        border: isHighlighted
          ? '2px solid #00F5D4'
          : isFeatured
            ? '1px solid #243353'
            : '1px solid #1E2A40',
        boxShadow: isHighlighted
          ? '0 0 24px rgba(0, 245, 212, 0.35)'
          : isFeatured
            ? '0 12px 32px rgba(0, 0, 0, 0.3)'
            : '0 4px 16px rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Glow Layer 2 phe theo phong cách Đấu trường 1a */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: isFeatured ? 19 : 15,
          background: isFeatured
            ? 'linear-gradient(90deg, rgba(46,196,182,0.18), rgba(46,196,182,0) 42%, rgba(255,122,89,0) 58%, rgba(255,122,89,0.18))'
            : 'linear-gradient(90deg, rgba(46,196,182,0.11), rgba(46,196,182,0) 40%, rgba(255,122,89,0) 60%, rgba(255,122,89,0.11))',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          padding: isFeatured ? (isMobile ? '18px 16px' : '26px 30px') : '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: isFeatured ? 20 : 16,
        }}
      >
        {/* HÀNG 1: BADGES, MÃ KÈO & TRẠNG THÁI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isFeatured && (
            <span
              style={{
                font: '800 13px/1 "Barlow Condensed", system-ui, sans-serif',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#1A1204',
                background: '#F5C451',
                padding: '6px 10px',
                borderRadius: 6,
              }}
            >
              {t('challenge.featuredBadgeTitle')}
            </span>
          )}

          <span
            style={{
              font: '600 12.5px/1 "IBM Plex Mono", monospace',
              color: '#8FE3DA',
              letterSpacing: '0.02em',
            }}
          >
            {c.code}
          </span>

          {sessionObj ? (
            <span
              style={{
                fontSize: 11.5,
                color: '#A9B6C9',
                background: 'rgba(255,255,255,0.06)',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              {t('matchesPage.sessionLinked', { date: dd(sessionObj.date) })}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11.5,
                color: '#A9B6C9',
                background: 'rgba(255,255,255,0.06)',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              {t('matchesPage.noSessionLinked')}
            </span>
          )}

          {matchTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: tag.color,
                border: `1px solid ${tag.border}`,
                background: tag.bg,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {t(tag.labelKey)}
            </span>
          ))}

          {isBoSeries && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#D8B4FE',
                border: '1px solid #D8B4FE',
                background: 'rgba(216,180,254,0.1)',
                padding: '2px 8px',
                borderRadius: 999,
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              Bo{c.bestOf}
            </span>
          )}

          {predStats.totalCount > 0 && (
            <span
              style={{
                fontSize: 11,
                color: '#A9B6C9',
                background: 'rgba(255,255,255,0.06)',
                padding: '3px 8px',
                borderRadius: 999,
                fontFamily: '"IBM Plex Mono", monospace',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="target" size={12} style={{ color: '#2EC4B6' }} />
              <span>{predStats.pctA}% : {predStats.pctB}%</span>
            </span>
          )}

          <span style={{ flex: 1 }} />

          {/* Badge trạng thái */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              border: isPlayed
                ? '1px solid rgba(95,217,162,0.4)'
                : isAccepted
                  ? '1px solid rgba(46,196,182,0.4)'
                  : isExpired
                    ? '1px solid rgba(255,120,120,0.4)'
                    : '1px solid rgba(240,183,92,0.4)',
              background: isPlayed
                ? 'rgba(95,217,162,0.12)'
                : isAccepted
                  ? 'rgba(46,196,182,0.12)'
                  : isExpired
                    ? 'rgba(255,120,120,0.12)'
                    : 'rgba(240,183,92,0.12)',
              color: isPlayed
                ? '#5FD9A2'
                : isAccepted
                  ? '#2EC4B6'
                  : isExpired
                    ? '#FF9C9C'
                    : '#F0B75C',
              whiteSpace: 'nowrap',
            }}
          >
            {statusBadgeText}
          </span>
        </div>

        {/* HÀNG 2: ĐỐI ĐẦU ĐỐI XỨNG 3 CỘT (PHE A | VS | PHE B) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isFeatured
              ? (isMobile ? 'minmax(0,1fr) 110px minmax(0,1fr)' : 'minmax(0,1fr) 180px minmax(0,1fr)')
              : 'minmax(0,1fr) auto minmax(0,1fr)',
            alignItems: 'center',
            gap: isFeatured ? (isMobile ? 8 : 20) : 12,
          }}
        >
          {/* CỘT PHE A */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: isFeatured ? 10 : 6, minWidth: 0 }}>
            {/* Avatars Phe A chồng nhau */}
            <div style={{ display: 'flex' }}>
              {teamA.map((id, idx) => (
                <div key={id} style={{ marginRight: idx < teamA.length - 1 ? avatarOverlap : 0 }}>
                  <ArenaAvatar
                    memberId={id}
                    member={getMemberData(id)}
                    team="A"
                    size={avatarSize}
                    isMobile={isMobile}
                  />
                </div>
              ))}
            </div>

            {/* Tên đấu thủ Phe A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '100%' }}>
              {teamA.map((id) => {
                const isAcc = (c.acceptedPlayers || []).includes(id)
                return (
                  <div
                    key={id}
                    style={{
                      font: isFeatured
                        ? (isMobile ? '700 15px/1.2 "IBM Plex Sans", sans-serif' : '700 20px/1.2 "IBM Plex Sans", sans-serif')
                        : '600 14px/1.3 "IBM Plex Sans", sans-serif',
                      color: isPlayed && winnerTeam === 'A' ? '#5FD9A2' : '#F4F7FB',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isPlayed && winnerTeam === 'A' && <span>👑</span>}
                    <span title={memberNameOf(id)}>{shortNameOf(id)}</span>
                    {isPending && isAcc && (
                      <Icon name="check" size={13} style={{ color: '#2EC4B6' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Rating & Badge Thắng Phe A */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  font: '600 12.5px/1 "IBM Plex Mono", monospace',
                  color: '#8FE3DA',
                }}
              >
                {ratA > 0 ? t('challenge.avgPoint', { score: ratA.toLocaleString('vi-VN') }) : '—'}
              </span>
              {isPlayed && winnerTeam === 'A' && (
                <span
                  style={{
                    font: '800 11px/1 "Barlow Condensed", system-ui, sans-serif',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#04201D',
                    background: '#2EC4B6',
                    padding: '2px 7px',
                    borderRadius: 5,
                  }}
                >
                  {t('challenge.wonBadgeShort')}
                </span>
              )}
            </div>
          </div>

          {/* CỘT GIỮA: VS & TỈ SỐ / KHOẢNG CÁCH (4E CHO KÈO ĐÃ ĐẤU) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center' }}>
            {isPlayed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span
                  style={{
                    font: isFeatured
                      ? (isMobile ? '800 38px/1 "Barlow Condensed", system-ui, sans-serif' : '800 48px/1 "Barlow Condensed", system-ui, sans-serif')
                      : '800 32px/1 "Barlow Condensed", system-ui, sans-serif',
                    color: '#F4F7FB',
                    letterSpacing: '0.02em',
                  }}
                >
                  {setScore}
                </span>
                <span
                  style={{
                    font: '500 11px/1 "IBM Plex Mono", monospace',
                    color: '#8494AA',
                    whiteSpace: 'nowrap',
                    textTransform: 'lowercase',
                  }}
                >
                  {t('challenge.setScoreLabel')}
                </span>
              </div>
            ) : (
              <>
                <span
                  style={{
                    font: isFeatured
                      ? (isMobile ? 'italic 800 48px/0.95 "Barlow Condensed", system-ui, sans-serif' : 'italic 800 80px/0.9 "Barlow Condensed", system-ui, sans-serif')
                      : 'italic 800 28px/1 "Barlow Condensed", system-ui, sans-serif',
                    color: isFeatured ? '#F4F7FB' : '#5B6A82',
                    letterSpacing: '-0.02em',
                    textShadow: isFeatured ? '0 0 35px rgba(245,196,81,0.35)' : 'none',
                  }}
                >
                  VS
                </span>
                {hasPlayedSets ? (
                  <span style={{ font: '700 15px/1 "Barlow Condensed", monospace', color: '#D8B4FE' }}>
                    {seriesProg.seriesScoreText}
                  </span>
                ) : ratA > 0 && ratB > 0 ? (
                  <span
                    style={{
                      font: '500 11.5px/1 "IBM Plex Mono", monospace',
                      color: '#8494AA',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('challenge.pointGapAvg', { gap: gap.toLocaleString('vi-VN') })}
                  </span>
                ) : null}
              </>
            )}
          </div>

          {/* CỘT PHE B */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: isFeatured ? 10 : 6, minWidth: 0, textAlign: 'right' }}>
            {/* Avatars Phe B chồng nhau ngược */}
            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
              {teamB.map((id, idx) => (
                <div key={id} style={{ marginLeft: idx < teamB.length - 1 ? avatarOverlap : 0 }}>
                  <ArenaAvatar
                    memberId={id}
                    member={getMemberData(id)}
                    team="B"
                    size={avatarSize}
                    isMobile={isMobile}
                  />
                </div>
              ))}
            </div>

            {/* Tên đấu thủ Phe B */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 0, maxWidth: '100%' }}>
              {teamB.length > 0 ? (
                teamB.map((id) => {
                  const isAcc = (c.acceptedPlayers || []).includes(id)
                  return (
                    <div
                      key={id}
                      style={{
                        font: isFeatured
                          ? (isMobile ? '700 15px/1.2 "IBM Plex Sans", sans-serif' : '700 20px/1.2 "IBM Plex Sans", sans-serif')
                          : '600 14px/1.3 "IBM Plex Sans", sans-serif',
                        color: isPlayed && winnerTeam === 'B' ? '#5FD9A2' : '#F4F7FB',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isPending && isAcc && (
                        <Icon name="check" size={13} style={{ color: '#2EC4B6' }} />
                      )}
                      <span title={memberNameOf(id)}>{shortNameOf(id)}</span>
                      {isPlayed && winnerTeam === 'B' && <span>👑</span>}
                    </div>
                  )
                })
              ) : (
                <span style={{ fontSize: 13, color: '#8494AA', fontStyle: 'italic' }}>
                  {t('challenge.teamEmptyHint')}
                </span>
              )}
            </div>

            {/* Rating & Badge Thắng Phe B */}
            <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  font: '600 12.5px/1 "IBM Plex Mono", monospace',
                  color: '#FFB39F',
                }}
              >
                {ratB > 0 ? t('challenge.avgPoint', { score: ratB.toLocaleString('vi-VN') }) : '—'}
              </span>
              {isPlayed && winnerTeam === 'B' && (
                <span
                  style={{
                    font: '800 11px/1 "Barlow Condensed", system-ui, sans-serif',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#2A0E05',
                    background: '#FF7A59',
                    padding: '2px 7px',
                    borderRadius: 5,
                  }}
                >
                  {t('challenge.wonBadgeShort')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* HÀNG 3: DIỄN BIẾN SÉC ĐẤU (4E) CHO KÈO ĐÃ ĐẤU, HOẶC THANH KHẢ NĂNG THẮNG CHO KÈO CHƯA ĐẤU */}
        {isPlayed ? (
          setsList.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {setsList.map((s, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: isFeatured ? '7px 14px' : '5px 10px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #243353',
                    font: isFeatured ? '700 20px/1 "Barlow Condensed", monospace' : '700 17px/1 "Barlow Condensed", monospace',
                  }}
                >
                  <span style={{ color: s.a > s.b ? '#2EC4B6' : '#6F7E95' }}>{s.a}</span>
                  <span style={{ color: '#4A5A74' }}>-</span>
                  <span style={{ color: s.b > s.a ? '#FF7A59' : '#6F7E95' }}>{s.b}</span>
                </span>
              ))}
            </div>
          )
        ) : ratB > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isFeatured ? 8 : 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span
                style={{
                  font: isFeatured ? '800 36px/1 "Barlow Condensed", system-ui, sans-serif' : '800 22px/1 "Barlow Condensed", system-ui, sans-serif',
                  color: '#2EC4B6',
                }}
              >
                {pctA}%
              </span>

              {isFeatured ? (
                <span
                  style={{
                    fontSize: 11.5,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#8494AA',
                    fontWeight: 600,
                  }}
                >
                  {t('challenge.winChance')}
                </span>
              ) : (
                <span
                  style={{
                    font: '500 11px/1 "IBM Plex Mono", monospace',
                    color: '#6F7E95',
                  }}
                >
                  {t('challenge.avgPoint', { score: ratA })} · {t('challenge.pointGapAvg', { gap })} · {t('challenge.avgPoint', { score: ratB })}
                </span>
              )}

              <span
                style={{
                  font: isFeatured ? '800 36px/1 "Barlow Condensed", system-ui, sans-serif' : '800 22px/1 "Barlow Condensed", system-ui, sans-serif',
                  color: '#FF7A59',
                }}
              >
                {pctB}%
              </span>
            </div>

            {/* Progress bar đôi */}
            <div
              style={{
                display: 'flex',
                height: isFeatured ? 10 : 6,
                borderRadius: 999,
                overflow: 'hidden',
                gap: 3,
                background: '#182236',
              }}
            >
              <div
                style={{
                  width: `${pctA}%`,
                  background: isFeatured
                    ? 'linear-gradient(90deg, #1E8F85, #2EC4B6)'
                    : '#2EC4B6',
                  borderRadius: '999px 0 0 999px',
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: isFeatured
                    ? 'linear-gradient(90deg, #FF7A59, #C9533A)'
                    : '#FF7A59',
                  borderRadius: '0 999px 999px 0',
                }}
              />
            </div>
          </div>
        ) : null}

        {/* CẢNH BÁO BÁO VẮNG TRONG BUỔI */}
        {hasAbsentInSession && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FF9C9C',
              fontSize: 12,
              lineHeight: 1.4,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 180 }}>
              <Icon name="triangle-alert" size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
              <span>
                {t('challenge.absentInSessionAlert', { names: absentInSessionNames.join(', '), date: dd(sessionObj.date) })}
              </span>
            </div>
            {(isParticipant || isAdmin) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectSession?.(c)
                }}
                style={{
                  background: '#1B2842',
                  border: '1px solid #FF9C9C',
                  color: '#FF9C9C',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginLeft: 'auto',
                }}
              >
                {t('challenge.changeSession')}
              </button>
            )}
          </div>
        )}

        {/* Cảnh báo lệch trình */}
        {gap > IMBALANCE_THRESHOLD && ratA > 0 && ratB > 0 && (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(240, 183, 92, 0.1)',
              color: '#F0B75C',
              fontSize: 12,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="triangle-alert" size={14} style={{ color: '#F0B75C', flexShrink: 0 }} />
            <span>{t('challenge.gapWarningNotBlocked', { gap: gap.toLocaleString('vi-VN') })}</span>
          </div>
        )}

        {/* KHỐI CƯỢC PHONG CÁCH 3D (KHÁN ĐÀI · THẤY RÕ AI CƯỢC AI) */}
        <div
          style={{
            position: 'relative',
            margin: isFeatured
              ? (isMobile ? '6px -16px 0' : '8px -30px 0')
              : '4px -20px 0',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 10,
            padding: isMobile ? '10px 14px' : '12px 20px',
            background: '#0A1120',
            borderTop: '1px solid #1E2A40',
            borderBottom: '1px solid #1E2A40',
          }}
        >
          {/* PHE XANH (BÊN TRÁI) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {predStats.countA > 0 ? (
              <>
                <div style={{ display: 'flex', flexShrink: 0 }}>
                  {predStats.predictorsA.slice(0, 3).map((p, idx) => {
                    const name = memberNameOf(p.memberId) || ''
                    const mem = getMemberData(p.memberId)
                    return (
                      <div
                        key={p.id || p.memberId || idx}
                        title={name}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          marginRight: -8,
                          display: 'grid',
                          placeItems: 'center',
                          background: mem?.avatarUrl ? 'transparent' : getAvatarColor(name),
                          border: '2px solid #0A1120',
                          color: '#fff',
                          font: '800 11px/1 "Barlow Condensed", sans-serif',
                          overflow: 'hidden',
                        }}
                      >
                        {mem?.avatarUrl ? (
                          <img src={mem.avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>{getInitials(name)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: 6 }}>
                  <span style={{ fontSize: isMobile ? 12 : 13, color: '#8FE3DA', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t('challenge.betBelieversA', { count: predStats.countA })}
                  </span>
                  <span
                    style={{
                      font: '500 11px/1.3 "IBM Plex Mono", monospace',
                      color: '#8494AA',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={predStats.predictorsA.map((p) => shortNameOf(p.memberId)).join(', ')}
                  >
                    {predStats.predictorsA.map((p) => shortNameOf(p.memberId)).join(', ')}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1.5px dashed rgba(46,196,182,0.5)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    color: '#8FE3DA',
                    flexShrink: 0,
                    fontSize: 14,
                  }}
                >
                  +
                </span>
                <span style={{ fontSize: isMobile ? 12 : 13, color: '#8FE3DA', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {t('challenge.betCheerA')}
                </span>
              </div>
            )}
          </div>

          {/* TỔNG HŨ CƯỢC Ở GIỮA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center', padding: '0 4px' }}>
            <span
              style={{
                font: '800 22px/1 "Barlow Condensed", system-ui, sans-serif',
                color: '#F5C451',
                letterSpacing: '0.02em',
              }}
            >
              {t('challenge.betPotPoints', { points: predStats.totalPoints })}
            </span>
            <span
              style={{
                font: '600 10px/1 "IBM Plex Sans", sans-serif',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#8494AA',
                whiteSpace: 'nowrap',
              }}
            >
              {isPlayed
                ? t('challenge.potDistributed')
                : (c.status === 'oncourt' || (c.status === 'accepted' && hasPlayedSets))
                  ? t('challenge.betLocked')
                  : t('challenge.bettingNow')}
            </span>
          </div>

          {/* PHE CAM (BÊN PHẢI - ROW REVERSE) */}
          <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minWidth: 0, textAlign: 'right' }}>
            {predStats.countB > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'row-reverse', flexShrink: 0 }}>
                  {predStats.predictorsB.slice(0, 3).map((p, idx) => {
                    const name = memberNameOf(p.memberId) || ''
                    const mem = getMemberData(p.memberId)
                    return (
                      <div
                        key={p.id || p.memberId || idx}
                        title={name}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          marginLeft: -8,
                          display: 'grid',
                          placeItems: 'center',
                          background: mem?.avatarUrl ? 'transparent' : getAvatarColor(name),
                          border: '2px solid #0A1120',
                          color: '#fff',
                          font: '800 11px/1 "Barlow Condensed", sans-serif',
                          overflow: 'hidden',
                        }}
                      >
                        {mem?.avatarUrl ? (
                          <img src={mem.avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>{getInitials(name)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0, paddingRight: 6 }}>
                  <span style={{ fontSize: isMobile ? 12 : 13, color: '#FFB39F', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t('challenge.betBelieversB', { count: predStats.countB })}
                  </span>
                  <span
                    style={{
                      font: '500 11px/1.3 "IBM Plex Mono", monospace',
                      color: '#8494AA',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                    title={predStats.predictorsB.map((p) => shortNameOf(p.memberId)).join(', ')}
                  >
                    {predStats.predictorsB.map((p) => shortNameOf(p.memberId)).join(', ')}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1.5px dashed rgba(255,122,89,0.5)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    color: '#FFB39F',
                    flexShrink: 0,
                    fontSize: 14,
                  }}
                >
                  +
                </span>
                <span style={{ fontSize: isMobile ? 12 : 13, color: '#FFB39F', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {t('challenge.betCheerB')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* HÀNG FOOTER: CƯỢC & NÚT THAO TÁC */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {/* Badge cược */}
          {c.stakeText && (
            <span
              style={{
                fontSize: isFeatured ? 13 : 12,
                fontWeight: 600,
                color: '#F5C451',
                background: 'rgba(245,196,81,0.08)',
                border: '1px dashed rgba(245,196,81,0.5)',
                padding: isFeatured ? '7px 12px' : '5px 9px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Icon name="award" size={13} style={{ color: '#F5C451' }} />
              <span>{t('challenge.stakeLabelPrefix', { stake: c.stakeText })}</span>
            </span>
          )}

          {/* Badge Chờ đối thủ nếu tôi đã nhận */}
          {isPending && !isExpired && hasAccepted && !prog.isFullyAccepted && (
            <span
              style={{
                fontSize: 12,
                color: '#5FD9A2',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              <Icon name="check" size={13} />
              <span>{t('challenge.youAcceptedWaiting')}</span>
            </span>
          )}

          <span style={{ flex: 1 }} />

          {/* Nút Hủy kèo */}
          {(isPending || isAccepted) && !isPlayed && (isParticipant || isAdmin) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                a.confirm({
                  title: t('challenge.confirmCancelTitle'),
                  message: t('challenge.confirmCancelMsg', { code: c.code }),
                  tone: 'danger',
                  confirmText: t('challenge.btnCancelChallenge'),
                  onConfirm: () => a.cancelChallenge(c.id),
                })
              }}
              style={{
                fontWeight: 600,
                fontSize: isFeatured ? 13.5 : 12.5,
                color: '#FF9C9C',
                padding: isFeatured ? '8px 14px' : '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,120,120,0.3)',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {t('challenge.btnCancelChallenge')}
            </button>
          )}

          {/* Nút Nhận / Duyệt kèo */}
          {isPending && !isExpired && canAccept && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                a.respondChallenge(c.id, true)
              }}
              style={{
                fontWeight: 700,
                fontSize: isFeatured ? 14 : 13,
                color: '#04201D',
                background: '#2EC4B6',
                padding: isFeatured ? '9px 18px' : '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="check" size={14} />
              <span>{isAdmin && !isParticipant ? t('challenge.btnAdminApprove') : t('challenge.btnAccept')}</span>
            </button>
          )}

          {/* Nút Từ chối nếu tôi là đấu thủ tham gia hoặc Admin */}
          {isPending && !isExpired && (isParticipant || isAdmin) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                a.respondChallenge(c.id, false)
              }}
              style={{
                fontWeight: 600,
                fontSize: isFeatured ? 13.5 : 12.5,
                color: '#FF9C9C',
                padding: isFeatured ? '8px 14px' : '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,120,120,0.3)',
                background: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="circle-x" size={14} />
              <span>{t('challenge.btnDecline')}</span>
            </button>
          )}

          {/* Nút Nhận kèo mở */}
          {isPending && !isExpired && isOpen && myId && !teamA.includes(myId) && !teamB.includes(myId) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                a.acceptOpenChallenge({ challengeId: c.id })
              }}
              style={{
                fontWeight: 700,
                fontSize: isFeatured ? 14 : 13,
                color: '#04201D',
                background: '#2EC4B6',
                padding: isFeatured ? '9px 18px' : '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="check" size={14} />
              <span>{t('matchesPage.acceptOpenChallenge')}</span>
            </button>
          )}

          {/* Nút Vào buổi tập */}
          {isAccepted && sessionObj && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/buoi-tap/${sessionObj.id}`)
              }}
              style={{
                fontWeight: 600,
                fontSize: isFeatured ? 13.5 : 12.5,
                color: '#E9EFF7',
                background: '#1B2842',
                padding: isFeatured ? '8px 14px' : '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{t('matchesPage.viewInSession')}</span>
              <Icon name="arrow-right" size={13} />
            </button>
          )}

          {/* Nút Đưa vào buổi nếu kèo chưa gắn */}
          {isAccepted && !sessionObj && (isParticipant || isAdmin) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectSession?.(c)
              }}
              style={{
                fontWeight: 700,
                fontSize: isFeatured ? 14 : 13,
                color: '#04201D',
                background: '#2EC4B6',
                padding: isFeatured ? '8px 16px' : '6px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="plus" size={14} />
              <span>{t('challenge.chooseSession')}</span>
            </button>
          )}

          {/* Nút Phục thù (chỉ hiện với người ở đội thua) */}
          {isLoser && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRevenge?.(c)
              }}
              style={{
                fontWeight: 700,
                fontSize: isFeatured ? 14 : 13,
                color: '#1A1204',
                background: '#F5C451',
                padding: isFeatured ? '9px 18px' : '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="swords" size={14} />
              <span>{t('challenge.btnRevenge')}</span>
            </button>
          )}

          {/* Nút Xem chi tiết nếu đã đấu xong */}
          {isPlayed && c.matchId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const m = (db.matches || []).find((x) => x.id === c.matchId)
                if (m) onViewMatch?.(m)
              }}
              style={{
                fontWeight: 600,
                fontSize: isFeatured ? 13.5 : 12.5,
                color: '#E9EFF7',
                background: '#1B2842',
                padding: isFeatured ? '8px 14px' : '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="eye" size={13} />
              <span>{t('challenge.details')}</span>
            </button>
          )}

          {/* Menu 3 chấm */}
          <ArenaCardMenu
            items={[
              ...(isAccepted && sessionObj && (isParticipant || isAdmin) ? [
                {
                  key: 'change',
                  icon: 'calendar-days',
                  label: t('challenge.changeSession'),
                  onClick: () => onSelectSession?.(c),
                },
                {
                  key: 'unlink',
                  icon: 'unlink',
                  label: t('challenge.btnUnlinkSession'),
                  onClick: () => a.linkChallengeToSession(c.id, null),
                },
              ] : []),
              ...(isAdmin ? [{
                key: 'delete',
                icon: 'trash-2',
                label: t('challenge.btnDelete'),
                danger: true,
                onClick: () => a.confirm({
                  title: t('challenge.confirmDeleteTitle'),
                  message: t('challenge.confirmDeleteMsg'),
                  tone: 'danger',
                  confirmText: t('challenge.btnDelete'),
                  onConfirm: () => a.deleteChallenge(c.id),
                }),
              }] : []),
            ]}
          />
        </div>
      </div>
    </div>
  )
}
