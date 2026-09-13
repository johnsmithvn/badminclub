import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Dialog, Icon, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, SearchSelect, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import { playerName, courtOf, myMember, playerOf } from '#lib/money.js'
import { dd } from '#utils/dates.js'
import {
  getPlayerRating, expectedScore, calcEloDelta, confidenceProgress,
  BALANCE_THRESHOLD, IMBALANCE_THRESHOLD,
} from '#lib/rating.js'
import {
  searchMatches, headToHeadMatrix, neverMetPairs, topDisparatePairs, neverMetWithSessionCount,
} from '#lib/matchSearch.js'
import { buildPlayableVideoUrl, formatGapMinutes, parseVideoProvider } from '#utils/videoUtils.js'
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import MatchDetailModal from '#components/challenge/MatchDetailModal.jsx'
import AttachVideoModal, { MatchVideoInlineExpander } from '#components/challenge/AttachVideoModal.jsx'
import { VideoPlayerModal } from '#components/challenge/VideoPlayerModal.jsx'

/** Lấy tên rút gọn cho header ma trận trên mobile */
function getShortDisplayName(fullName, allMembers = []) {
  if (!fullName || typeof fullName !== 'string') return ''
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  const lastName = parts[parts.length - 1]
  const duplicates = (allMembers || []).filter((m) => {
    if (!m || !m.name) return false
    const p = m.name.trim().split(/\s+/)
    return p && p[p.length - 1] === lastName
  })
  if (duplicates.length > 1 && parts.length > 1) {
    return `${parts[parts.length - 2]} ${lastName}`
  }
  return lastName
}

export default function Matches() {
  const { db, a } = useApp()
  const { profile } = useAuth()
  const { isDark } = useTheme()
  const isMobile = useMobile(900)
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'history' || tabParam === 'matrix' || tabParam === 'challenges')
    ? tabParam
    : (tabParam === 'search' ? 'history' : 'challenges')

  const [activeTab, setActiveTab] = useState(initialTab) // 'challenges' | 'history' | 'matrix'
  const [challengeSubTab, setChallengeSubTab] = useState('my') // 'my' | 'open' | 'pending' | 'played' | 'all'

  // Đồng bộ URL khi đổi tab
  const handleSelectTab = (newTab) => {
    setActiveTab(newTab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', newTab)
    setSearchParams(nextParams, { replace: true })
  }

  // State Kèo & Thách đấu
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Tự động mở modal tạo kèo khi có targetId hoặc challenge=new từ trang Danh hiệu / BXH
  useEffect(() => {
    const target = searchParams.get('targetId')
    const challengeParam = searchParams.get('challenge')
    if (target) {
      if (myId) setInitialTeamA([myId])
      setInitialTeamB([target])
      setChallengeModalOpen(true)
      setActiveTab('challenges')
    } else if (challengeParam === 'new') {
      if (myId) setInitialTeamA([myId])
      setChallengeModalOpen(true)
      setActiveTab('challenges')
    }
  }, [searchParams, myId])

  // State Tìm trận & Lịch sử
  const [playerA, setPlayerA] = useState(() => searchParams.get('playerA') || '')
  const [playerB, setPlayerB] = useState(() => searchParams.get('playerB') || '')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'upset'
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [onlyVideoFilter, setOnlyVideoFilter] = useState(() => searchParams.get('video') === 'true')
  const [viewerFilter, setViewerFilter] = useState('all')
  const [sortOption, setSortOption] = useState('latest') // 'latest' | 'dramatic' | 'elo_swing'
  const [searchCardLimit, setSearchCardLimit] = useState(10)

  // Modals
  const [editingMatch, setEditingMatch] = useState(null)
  const [viewingMatch, setViewingMatch] = useState(null)
  const [playingVideoMatch, setPlayingVideoMatch] = useState(null)
  const [expandedVideoMatchId, setExpandedVideoMatchId] = useState(null)
  const [attachVideoMatch, setAttachVideoMatch] = useState(null)

  // Ma trận H2H
  const [matrixMemberLimit, setMatrixMemberLimit] = useState(() => (isMobile ? 5 : 8))

  const myMem = myMember(db)
  const myId = myMem?.id || null
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const memberMap = useMemo(() => {
    const map = {}
    ;(db.members || []).forEach((m) => { map[m.id] = m })
    return map
  }, [db.members])

  const memberNameOf = (id) => playerName(db, id)
  const getRating = (mid) => getPlayerRating(db.playerRatings, mid, playerOf(db, mid), db.levels).rating

  // =========================================================================
  // TAB 1: SÀN KÈO / THÁCH ĐẤU (CHALLENGES)
  // =========================================================================
  const allChallenges = useMemo(() => {
    return (db.challenges || []).slice().sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tB - tA
    })
  }, [db.challenges])

  const myChallenges = useMemo(() => {
    if (!myId) return []
    return allChallenges.filter((c) => {
      return c.createdBy === myId || (c.teamA || []).includes(myId) || (c.teamB || []).includes(myId)
    })
  }, [allChallenges, myId])

  const openChallenges = useMemo(() => {
    return allChallenges.filter((c) => {
      if (c.status !== 'pending') return false
      const teamB = c.teamB || []
      const reqB = (c.teamA || []).length > 1 ? 2 : 1
      return teamB.length < reqB
    })
  }, [allChallenges])

  const pendingChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'pending')
  }, [allChallenges])

  const playedChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'played')
  }, [allChallenges])

  const displayedChallenges = useMemo(() => {
    if (challengeSubTab === 'my') return myChallenges
    if (challengeSubTab === 'open') return openChallenges
    if (challengeSubTab === 'pending') return pendingChallenges
    if (challengeSubTab === 'played') return playedChallenges
    return allChallenges
  }, [challengeSubTab, myChallenges, openChallenges, pendingChallenges, playedChallenges, allChallenges])

  // =========================================================================
  // TAB 2: LỊCH SỬ TRẬN & VIDEO (HISTORY / SEARCH)
  // =========================================================================
  const memberSearchOptions = useMemo(() => {
    return (activeMembers || []).map((m) => ({
      value: m.id,
      label: m.name,
      level: m.level,
    }))
  }, [activeMembers])

  const rawFilteredMatches = useMemo(() => {
    let list = (db.matches || []).slice()
    if (playerA || playerB) {
      list = searchMatches(list, {
        playerAId: playerA || null,
        playerBId: playerB || null,
        mode: searchMode,
      })
    }
    if (onlyVideoFilter) {
      list = list.filter((m) => Boolean(m.videoUrl))
    }
    if (courtFilter !== 'all') {
      list = list.filter((m) => m.courtLabel === courtFilter || (m.courtId && m.courtId.toString() === courtFilter))
    }
    if (sourceFilter === 'challenge') {
      list = list.filter((m) => Boolean(m.challengeId || m.sourceType === 'challenge'))
    } else if (sourceFilter === 'session') {
      list = list.filter((m) => !m.challengeId && m.sourceType !== 'challenge')
    }
    if (viewerFilter === 'has_views') {
      list = list.filter((m) => (m.videoViewsCount || 0) > 0)
    } else if (viewerFilter === 'no_views') {
      list = list.filter((m) => !m.videoViewsCount || m.videoViewsCount === 0)
    }
    if (qualityFilter === 'close') {
      list = list.filter((m) => (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3))
    } else if (qualityFilter === 'upset') {
      list = list.filter((m) => {
        const ra = m.initialRatingA || 0
        const rb = m.initialRatingB || 0
        const aWon = m.winnerTeam === 'A'
        return Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
      })
    }
    return list
  }, [db.matches, playerA, playerB, searchMode, onlyVideoFilter, courtFilter, sourceFilter, viewerFilter, qualityFilter])

  const searchResults = useMemo(() => {
    const list = rawFilteredMatches.slice()
    if (sortOption === 'dramatic') {
      list.sort((m1, m2) => {
        const diff1 = Math.min(...(m1.sets || []).map((s) => Math.abs((s[0] || 0) - (s[1] || 0))))
        const diff2 = Math.min(...(m2.sets || []).map((s) => Math.abs((s[0] || 0) - (s[1] || 0))))
        return diff1 - diff2
      })
    } else if (sortOption === 'elo_swing') {
      list.sort((m1, m2) => Math.abs(m2.ratingDelta || 0) - Math.abs(m1.ratingDelta || 0))
    } else {
      list.sort((m1, m2) => {
        const t1 = m1.playedAt || m1.date || ''
        const t2 = m2.playedAt || m2.date || ''
        return t2.localeCompare(t1)
      })
    }
    return list
  }, [rawFilteredMatches, sortOption])

  // Counters
  const challengeMatchesCount = useMemo(() => {
    return (db.matches || []).filter((m) => Boolean(m.challengeId || m.sourceType === 'challenge')).length
  }, [db.matches])

  const closeMatchesCount = useMemo(() => {
    return (db.matches || []).filter((m) => (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)).length
  }, [db.matches])

  const upsetMatchesCount = useMemo(() => {
    return (db.matches || []).filter((m) => {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const aWon = m.winnerTeam === 'A'
      return Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
    }).length
  }, [db.matches])

  // Head-to-Head 2 người
  const h2hSummary = useMemo(() => {
    if (!playerA || !playerB || playerA === playerB) return null
    const h2hMatches = searchMatches(db.matches || [], { playerA, playerB, mode: 'vs' })
    const total = h2hMatches.length
    if (total === 0) return { total: 0, aWins: 0, bWins: 0, aWinRate: 0, bWinRate: 0 }
    let aWins = 0
    h2hMatches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const inTeamA = teamA.includes(playerA)
      const won = m.winnerTeam === 'A'
      if ((inTeamA && won) || (!inTeamA && !won)) aWins++
    })
    const bWins = total - aWins
    return {
      total,
      aWins,
      bWins,
      aWinRate: Math.round((aWins / total) * 100),
      bWinRate: Math.round((bWins / total) * 100),
    }
  }, [db.matches, playerA, playerB])

  // =========================================================================
  // TAB 3: MA TRẬN ĐỐI ĐẦU (H2H MATRIX)
  // =========================================================================
  const memberH2HCounts = useMemo(() => {
    const counts = {}
    const activeIds = new Set((activeMembers || []).map((m) => m.id))
    activeIds.forEach((id) => { counts[id] = 0 })
    ;(db.matches || []).forEach((m) => {
      const teamA = (m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])).filter((id) => activeIds.has(id))
      const teamB = (m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])).filter((id) => activeIds.has(id))
      if (teamA.length && teamB.length && m.winnerTeam) {
        teamA.forEach((idA) => {
          teamB.forEach((idB) => {
            counts[idA] = (counts[idA] || 0) + 1
            counts[idB] = (counts[idB] || 0) + 1
          })
        })
      }
    })
    return counts
  }, [activeMembers, db.matches])

  const topMembersForMatrix = useMemo(() => {
    const sorted = [...activeMembers].filter(Boolean).sort((a, b) => {
      const countA = memberH2HCounts[a.id] || 0
      const countB = memberH2HCounts[b.id] || 0
      if (countB !== countA) return countB - countA
      return (b.gamesCount || 0) - (a.gamesCount || 0)
    })
    return sorted.slice(0, matrixMemberLimit)
  }, [activeMembers, memberH2HCounts, matrixMemberLimit])

  const matrixData = useMemo(() => {
    return headToHeadMatrix(topMembersForMatrix, db.matches || [])
  }, [topMembersForMatrix, db.matches])

  const fullClubMatrix = useMemo(() => {
    return headToHeadMatrix(activeMembers, db.matches || []) || {}
  }, [activeMembers, db.matches])

  const neverMetList = useMemo(() => {
    return neverMetPairs(activeMembers, db.matches || [])
  }, [activeMembers, db.matches])

  const neverMetSuggestions = useMemo(() => {
    const raw = neverMetWithSessionCount(neverMetList, {
      sessions: db.sessions || [],
      attendance: db.attendance || {},
      matches: db.matches || [],
    }, 6)
    return (raw || []).map((item) => {
      const m1 = memberMap[item.p1] || (db.members || []).find((m) => m.id === item.p1) || { id: item.p1, name: item.p1 }
      const m2 = memberMap[item.p2] || (db.members || []).find((m) => m.id === item.p2) || { id: item.p2, name: item.p2 }
      return {
        ...item,
        p1: m1,
        p2: m2,
        commonSessions: item.commonSessionsCount || 0,
      }
    })
  }, [neverMetList, db.sessions, db.attendance, db.matches, memberMap, db.members])

  const disparatePairsList = useMemo(() => {
    const raw = topDisparatePairs(fullClubMatrix, activeMembers, 5)
    return (raw || []).map((item) => {
      const p1Obj = memberMap[item.p1] || (db.members || []).find((m) => m.id === item.p1) || { id: item.p1, name: item.p1 }
      const p2Obj = memberMap[item.p2] || (db.members || []).find((m) => m.id === item.p2) || { id: item.p2, name: item.p2 }
      return {
        ...item,
        player1: p1Obj,
        player2: p2Obj,
        wins: item.wins1 ?? 0,
        losses: item.wins2 ?? 0,
      }
    })
  }, [fullClubMatrix, activeMembers, memberMap, db.members])

  return (
    <div style={S.page}>
      {/* 1. Header Trang */}
      <div style={S.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={S.h1}>{t('pages.matches.title')}</h1>
          <div style={S.hint}>{t('pages.matches.desc')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setInitialTeamA(myId ? [myId] : [])
              setInitialTeamB([])
              setChallengeModalOpen(true)
            }}
          >
            {t('matchesPage.createBtn')}
          </Button>
        </div>
      </div>

      {/* 2. Thanh Tabs Chính */}
      <TabTrack style={{ marginBottom: 12 }}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => handleSelectTab('challenges')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'challenges' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="history" size={15} />
            <span>{t('matchesPage.tabChallenges')}</span>
            {pendingChallenges.length > 0 && (
              <span style={S.tabBadgeMono}>{pendingChallenges.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('history')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'history' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="search" size={15} />
            <span>{t('matchesPage.tabHistory')}</span>
            <span style={S.tabBadgeMono}>{(db.matches || []).length}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('matrix')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'matrix' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="grid" size={15} />
            <span>{t('matchesPage.tabMatrix')}</span>
          </button>
        </div>
      </TabTrack>

      {/* ========================================================================= */}
      {/* TAB 1: SÀN KÈO / THÁCH ĐẤU */}
      {/* ========================================================================= */}
      {activeTab === 'challenges' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Subtabs lọc kèo */}
          <div style={S.subTabWrap}>
            {[
              { id: 'my', label: t('challenge.tabMy'), count: myChallenges.length },
              { id: 'open', label: t('challenge.tabOpen'), count: openChallenges.length, color: 'var(--status-transit-fg)' },
              { id: 'pending', label: t('challenge.tabPending'), count: pendingChallenges.length, color: 'var(--status-delayed-fg)' },
              { id: 'played', label: t('challenge.tabPlayed'), count: playedChallenges.length },
              { id: 'all', label: t('challenge.tabAll'), count: allChallenges.length },
            ].map((st) => {
              const active = challengeSubTab === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setChallengeSubTab(st.id)}
                  style={{
                    ...S.subTabBtn,
                    background: active ? 'var(--surface-card)' : 'transparent',
                    border: active ? '1px solid var(--border-default)' : '1px solid transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontWeight: active ? 600 : 500 }}>{st.label}</span>
                  <span style={{ ...S.subTabCount, color: st.color || (active ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                    {st.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Danh sách thẻ Kèo */}
          <div style={{ display: 'grid', gap: 10 }}>
            {displayedChallenges.map((c) => {
              const teamA = c.teamA || []
              const teamB = c.teamB || []
              const namesA = teamA.map(memberNameOf).join(' · ')
              const namesB = teamB.length ? teamB.map(memberNameOf).join(' · ') : t('challenge.teamEmptyHint')
              const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0
              const ratB = teamB.length ? Math.round(teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length) : 0
              const gap = Math.abs(ratA - ratB)
              const pA = expectedScore(ratA, ratB || ratA)
              const pctA = Math.round(pA * 100)
              const pctB = 100 - pctA

              const isPlayed = c.status === 'played'
              const isPending = c.status === 'pending'
              const isAccepted = c.status === 'accepted'
              const isCreator = myId && c.createdBy === myId
              const isTeamB = myId && teamB.includes(myId)
              const isOpen = !teamB.length || teamB.length < (teamA.length > 1 ? 2 : 1)

              // Countdown hết hạn
              const expTime = c.expiresAt ? new Date(c.expiresAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() + 60 * 60 * 1000 : null)
              let expStr = ''
              if (expTime && isPending) {
                const diff = expTime - now
                if (diff <= 0) {
                  expStr = '00:00'
                } else {
                  const mins = Math.floor(diff / 60000)
                  const secs = Math.floor((diff % 60000) / 1000)
                  expStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`
                }
              }

              const statusBadgeText = isPending
                ? `${t('challenge.status.pending')}${expStr ? ` · ${expStr}` : ''}`
                : (t('challenge.status.' + c.status) || c.status)

              const sessionObj = c.sessionId ? (db.sessions || []).find((s) => s.id === c.sessionId) : null

              return (
                <div key={c.id} style={S.challengeCard}>
                  {/* Hàng 1: Mã kèo & Trạng thái & Buổi */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={S.monoCode}>{c.code}</span>
                      {sessionObj ? (
                        <span style={S.sessionBadge}>
                          {t('matchesPage.sessionLinked', { date: dd(sessionObj.date) })}
                        </span>
                      ) : (
                        <span style={S.casualBadge}>{t('matchesPage.noSessionLinked')}</span>
                      )}
                      {c.ratingEnabled === false && (
                        <span style={S.casualBadge}>{t('challenge.casual')}</span>
                      )}
                    </div>
                    <span style={{
                      ...S.statusBadge,
                      background: isPlayed ? 'var(--surface-brand-soft)' : isAccepted ? 'var(--surface-nav-active)' : 'rgba(240,183,92,0.14)',
                      borderColor: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--teal-700)' : 'var(--border-subtle)',
                      color: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--status-transit-fg)' : 'var(--status-delayed-fg)',
                    }}>
                      {statusBadgeText}
                    </span>
                  </div>

                  {/* Hàng 2: Đối đầu Team A vs Team B */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.teamName}>{namesA}</div>
                      <div style={S.teamRatingMono}>
                        {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                    <span style={S.vsText}>VS</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ ...S.teamName, color: teamB.length ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {namesB}
                      </div>
                      <div style={S.teamRatingMono}>
                        {ratB > 0 ? t('challenge.avgRating', { r: ratB.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Cảnh báo lệch trình */}
                  {gap > IMBALANCE_THRESHOLD && ratA > 0 && ratB > 0 && (
                    <div style={S.warnBox}>
                      {t('challenge.gapWarningNotBlocked', { gap: gap.toLocaleString('vi-VN') })}
                    </div>
                  )}

                  {/* Thanh win% preview */}
                  {!isPlayed && ratB > 0 && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--status-transit-fg)' }}>{pctA}%</span>
                        <span style={{ color: 'var(--text-muted)' }}>{t('rating.gap', { gap })}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{pctB}%</span>
                      </div>
                      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                        <div style={{ width: `${pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%' }} />
                        <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Hàng nút bấm thao tác */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {/* Nhận / Từ chối nếu tôi là Team B hoặc Admin */}
                    {isPending && (isTeamB || isAdmin) && (
                      <>
                        <button
                          type="button"
                          onClick={() => a.respondChallenge(c.id, true)}
                          style={S.smallPrimaryBtn}
                        >
                          <Icon name="check" size={14} />
                          <span>{t('challenge.btnAccept')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => a.respondChallenge(c.id, false)}
                          style={S.smallGhostBtn}
                        >
                          <Icon name="circle-x" size={14} />
                          <span>{t('challenge.btnDecline')}</span>
                        </button>
                      </>
                    )}

                    {/* Nhận kèo mở nếu tôi chưa thuộc Team A */}
                    {isPending && isOpen && !teamA.includes(myId) && (
                      <button
                        type="button"
                        onClick={() => a.acceptOpenChallenge({ challengeId: c.id })}
                        style={S.smallPrimaryBtn}
                      >
                        <Icon name="check" size={14} />
                        <span>{t('matchesPage.acceptOpenChallenge')}</span>
                      </button>
                    )}

                    {/* Hủy kèo nếu là người tạo hoặc admin */}
                    {isPending && (isCreator || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => a.cancelChallenge(c.id)}
                        style={S.smallDangerBtn}
                      >
                        <Icon name="circle-x" size={14} />
                        <span>{t('challenge.btnCancel')}</span>
                      </button>
                    )}

                    {/* Xem trận đấu nếu đã đấu xong */}
                    {isPlayed && c.matchId && (
                      <button
                        type="button"
                        onClick={() => {
                          const m = (db.matches || []).find((x) => x.id === c.matchId)
                          if (m) setViewingMatch(m)
                        }}
                        style={S.smallSecondaryBtn}
                      >
                        <Icon name="eye" size={14} />
                        <span>{t('challenge.details')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {displayedChallenges.length === 0 && (
              <div style={S.emptyBox}>
                <Icon name="history" size={32} style={{ color: 'var(--text-muted)' }} />
                <div style={S.emptyTitle}>{t('matchesPage.emptyChallenges')}</div>
                <div style={S.emptySub}>{t('matchesPage.createChallengePrompt')}</div>
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() => {
                    setInitialTeamA(myId ? [myId] : [])
                    setInitialTeamB([])
                    setChallengeModalOpen(true)
                  }}
                  style={{ marginTop: 8 }}
                >
                  {t('matchesPage.createBtn')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LỊCH SỬ TRẬN & VIDEO (HISTORY) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Thanh bộ lọc thu gọn */}
          <div style={S.card}>
            <div style={S.searchHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <div style={{ width: isMobile ? '100%' : 190 }}>
                  <SearchSelect
                    options={[{ value: '', label: t('matchSearch.filterAllMembers') }, ...memberSearchOptions]}
                    value={playerA}
                    onChange={(val) => setPlayerA(val)}
                    placeholder={`A · ${t('matchSearch.playerA')}`}
                  />
                </div>
                <div style={{ width: isMobile ? '100%' : 190 }}>
                  <SearchSelect
                    options={[{ value: '', label: t('matchSearch.filterAllMembers') }, ...memberSearchOptions]}
                    value={playerB}
                    onChange={(val) => setPlayerB(val)}
                    placeholder={`B · ${t('matchSearch.playerB')}`}
                  />
                </div>
                {playerA && playerB && (
                  <button
                    type="button"
                    onClick={() => setSearchMode((m) => (m === 'vs' ? 'team' : 'vs'))}
                    style={S.searchModeBtn}
                  >
                    <Icon name="repeat" size={13} />
                    <span>{searchMode === 'vs' ? t('matchSearch.modeH2H') : t('matchSearch.modeTeammate')}</span>
                  </button>
                )}
                <label style={S.videoCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={onlyVideoFilter}
                    onChange={(e) => setOnlyVideoFilter(e.target.checked)}
                    style={{ accentColor: 'var(--action-accent-bg)' }}
                  />
                  <span>🎥 {t('matchVideo.onlyHasVideo')}</span>
                </label>
              </div>

              {(playerA || playerB || onlyVideoFilter || sourceFilter !== 'all' || qualityFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPlayerA('')
                    setPlayerB('')
                    setOnlyVideoFilter(false)
                    setSourceFilter('all')
                    setQualityFilter('all')
                  }}
                  style={S.clearBtn}
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            {/* H2H so sánh nếu chọn 2 người */}
            {h2hSummary && (
              <div style={S.h2hCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={memberNameOf(playerA)} size={32} />
                    <div>
                      <div style={S.h2hName}>{memberNameOf(playerA)}</div>
                      <div style={{ font: '600 13px/1 var(--font-mono)', color: 'var(--teal-500)' }}>
                        {h2hSummary.aWins} {t('units.win')} ({h2hSummary.aWinRate}%)
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={S.h2hTotalMono}>{h2hSummary.total} {t('units.match')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'right' }}>
                    <div>
                      <div style={S.h2hName}>{memberNameOf(playerB)}</div>
                      <div style={{ font: '600 13px/1 var(--font-mono)', color: 'var(--status-incident-fg, #E14434)' }}>
                        {h2hSummary.bWins} {t('units.win')} ({h2hSummary.bWinRate}%)
                      </div>
                    </div>
                    <Avatar name={memberNameOf(playerB)} size={32} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4 Thẻ thống kê */}
          <div style={S.statsRow}>
            <div style={S.statCard}>
              <div style={S.statLabel}>{t('pages.sessions.statTotalMatches')}</div>
              <div style={S.statValue}>{searchResults.length}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>{t('pages.sessions.statChallengeMatches')}</div>
              <div style={{ ...S.statValue, color: '#D8B4FE' }}>{challengeMatchesCount}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>{t('pages.sessions.statBalancedMatches')}</div>
              <div style={{ ...S.statValue, color: 'var(--status-delivered-fg)' }}>{closeMatchesCount}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>{t('matchVideo.tagUpset')}</div>
              <div style={{ ...S.statValue, color: 'var(--status-delayed-fg)' }}>{upsetMatchesCount}</div>
            </div>
          </div>

          {/* Danh sách trận đấu */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={S.cardTitle}>
                {t('pages.sessions.matchesCount', { n: searchResults.length })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  style={S.filterSelect}
                >
                  <option value="latest">{t('matchVideo.sortLatest')}</option>
                  <option value="dramatic">{t('matchVideo.sortDramatic')}</option>
                  <option value="elo_swing">{t('matchVideo.sortEloSwing')}</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '8px 14px', display: 'grid', gap: 8 }}>
              {searchResults.slice(0, searchCardLimit).map((m) => {
                const teamA = m.teamA || []
                const teamB = m.teamB || []
                const namesA = teamA.map(memberNameOf).join(' · ')
                const namesB = teamB.map(memberNameOf).join(' · ')
                const wonA = m.winnerTeam === 'A'
                const hasVideo = Boolean(m.videoUrl)
                const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')

                return (
                  <div
                    key={m.id}
                    onClick={() => setViewingMatch(m)}
                    style={S.matchRow}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.monoCode}>#{m.code || m.id.slice(0, 6)}</span>
                        <span style={S.metaText}>{m.playedAt ? dd(m.playedAt) : (m.date ? dd(m.date) : '')}</span>
                        {isChallenge ? (
                          <span style={S.challengeBadge}>⚔️ {t('challenge.challenge')}</span>
                        ) : (
                          <span style={S.sessionBadge}>{t('challenge.fromCourt')}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasVideo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPlayingVideoMatch(m)
                            }}
                            style={S.videoPlayBtn}
                          >
                            <Icon name="play" size={12} />
                            <span>Video</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMatch(m)
                            }}
                            style={S.editBtn}
                          >
                            {t('common.edit')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scores Team A vs Team B */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: wonA ? 700 : 400, color: wonA ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {namesA}
                      </div>
                      <div style={S.scoreMono}>
                        {(m.sets || []).map((s) => `${s[0]}-${s[1]}`).join(' · ') || '—'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontWeight: !wonA ? 700 : 400, color: !wonA ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {namesB}
                      </div>
                    </div>
                  </div>
                )
              })}

              {searchResults.length > searchCardLimit && (
                <button
                  type="button"
                  onClick={() => setSearchCardLimit((l) => l + 15)}
                  style={S.loadMoreBtn}
                >
                  {t('common.more')} ({searchResults.length - searchCardLimit})
                </button>
              )}

              {searchResults.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {t('common.noData')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MA TRẬN ĐỐI ĐẦU (H2H MATRIX) */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 16 }}>
          {/* Cột Trái: Bảng Ma trận */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>{t('matchSearch.matrixTitle')}</div>
                <div style={S.cardSub}>{t('matchSearch.matrixHeaderSub', { count: topMembersForMatrix.length })}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[5, 8, 12, 999].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => setMatrixMemberLimit(limit)}
                    style={{
                      ...S.matrixLimitBtn,
                      background: matrixMemberLimit === limit ? 'var(--action-accent-bg)' : 'transparent',
                      color: matrixMemberLimit === limit ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
                    }}
                  >
                    {limit === 999 ? t('matchSearch.filterAllMembers') : `Top ${limit}`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto', padding: '10px 14px' }}>
              <table style={S.matrixTable}>
                <thead>
                  <tr>
                    <th style={S.matrixCornerTh}>VS</th>
                    {topMembersForMatrix.map((p) => (
                      <th key={p.id} style={S.matrixTh}>
                        {getShortDisplayName(p.name, topMembersForMatrix)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topMembersForMatrix.map((p1) => (
                    <tr key={p1.id}>
                      <td style={S.matrixRowHeaderTd}>
                        {getShortDisplayName(p1.name, topMembersForMatrix)}
                      </td>
                      {topMembersForMatrix.map((p2) => {
                        if (p1.id === p2.id) {
                          return <td key={p2.id} style={S.matrixSelfTd}>-</td>
                        }
                        const cell = matrixData[p1.id]?.[p2.id] || { wins: 0, losses: 0 }
                        const total = cell.wins + cell.losses
                        const net = cell.wins - cell.losses

                        return (
                          <td
                            key={p2.id}
                            onClick={() => {
                              if (total > 0) {
                                setPlayerA(p1.id)
                                setPlayerB(p2.id)
                                setSearchMode('vs')
                                handleSelectTab('history')
                              } else {
                                setInitialTeamA([p1.id])
                                setInitialTeamB([p2.id])
                                setChallengeModalOpen(true)
                              }
                            }}
                            style={{
                              ...S.matrixCellTd,
                              color: net > 0 ? 'var(--teal-500)' : net < 0 ? 'var(--status-incident-fg, #E14434)' : 'var(--text-secondary)',
                              background: total > 0 ? (net > 0 ? 'rgba(0,178,169,.08)' : net < 0 ? 'rgba(225,68,52,.08)' : 'var(--surface-sunken)') : 'transparent',
                            }}
                            title={`${p1.name} vs ${p2.name}: ${cell.wins}-${cell.losses}`}
                          >
                            {total > 0 ? `${cell.wins}-${cell.losses}` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cột Phải: Các cặp chưa từng gặp & Lệch nhiều nhất */}
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Chưa từng gặp nhau */}
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>{t('matchSearch.neverMet')}</div>
              </div>
              <div style={{ padding: '8px 12px', display: 'grid', gap: 8 }}>
                {neverMetSuggestions.slice(0, 5).map((item) => (
                  <div key={`${item.p1.id}:${item.p2.id}`} style={S.suggestionRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.suggestionNames}>{item.p1.name} · {item.p2.name}</div>
                      <div style={S.metaText}>{t('matchSearch.commonSessions', { count: item.commonSessions })}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInitialTeamA([item.p1.id])
                        setInitialTeamB([item.p2.id])
                        setChallengeModalOpen(true)
                      }}
                      style={S.smallPrimaryBtn}
                    >
                      {t('challenge.challengeAction')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cặp đấu chênh lệch kết quả nhất */}
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>{t('matchSearch.disparateTitle')}</div>
              </div>
              <div style={{ padding: '8px 12px', display: 'grid', gap: 8 }}>
                {disparatePairsList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setPlayerA(item.player1.id)
                      setPlayerB(item.player2.id)
                      setSearchMode('vs')
                      handleSelectTab('history')
                    }}
                    style={{ ...S.suggestionRow, cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.suggestionNames}>
                        {t('matchSearch.cardH2HTitle', { nameA: item.player1.name, nameB: item.player2.name })}
                      </div>
                      <div style={S.metaText}>{item.total} {t('units.match')}</div>
                    </div>
                    <span style={{ font: '700 13px/1 var(--font-mono)', color: 'var(--status-incident-fg, #E14434)' }}>
                      {item.wins}-{item.losses}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HOST MODALS */}
      {/* ========================================================================= */}
      {challengeModalOpen && (
        <CreateChallengeModal
          onClose={() => setChallengeModalOpen(false)}
          onCreated={() => setChallengeModalOpen(false)}
          initialTeamA={initialTeamA}
          initialTeamB={initialTeamB}
        />
      )}

      {viewingMatch && (
        <MatchDetailModal
          match={viewingMatch}
          onClose={() => setViewingMatch(null)}
          onEdit={(m) => {
            setViewingMatch(null)
            setEditingMatch(m)
          }}
        />
      )}

      {editingMatch && (
        <EditScoreModal
          match={editingMatch}
          allMatches={searchResults}
          onNavigateMatch={(nextM) => setEditingMatch(nextM)}
          onClose={() => setEditingMatch(null)}
          onSaved={() => setEditingMatch(null)}
        />
      )}

      {attachVideoMatch && (
        <AttachVideoModal
          match={attachVideoMatch}
          onClose={() => setAttachVideoMatch(null)}
          onSaved={() => setAttachVideoMatch(null)}
        />
      )}

      {playingVideoMatch && (
        <VideoPlayerModal
          match={playingVideoMatch}
          onClose={() => setPlayingVideoMatch(null)}
        />
      )}
    </div>
  )
}

const S = {
  page: {
    display: 'grid',
    gap: 14,
    maxWidth: cfg.ui.contentMaxWidth,
    margin: '0 auto',
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  h1: {
    font: '700 22px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    margin: 0,
  },
  hint: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  tabTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
  },
  tabBtn: {
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 14px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    font: '600 13px/1 var(--font-sans)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--action-accent-bg, var(--teal-500))',
    color: 'var(--action-accent-fg, #04302C)',
    borderColor: 'var(--action-accent-bg, var(--teal-500))',
  },
  tabBadgeMono: {
    font: '600 11px/1 var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.15)',
  },
  subTabWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
    background: 'var(--surface-sunken)',
    borderRadius: 8,
    overflowX: 'auto',
  },
  subTabBtn: {
    flex: '0 0 auto',
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    borderRadius: 6,
    font: '500 12.5px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  subTabCount: {
    font: '600 11px/1 var(--font-mono)',
  },
  challengeCard: {
    display: 'grid',
    gap: 8,
    padding: '12px 14px',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-xs)',
  },
  monoCode: {
    font: '700 12.5px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  sessionBadge: {
    font: '500 11px/1 var(--font-sans)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-nav-active)',
    color: 'var(--status-transit-fg)',
    border: '1px solid var(--border-subtle)',
  },
  casualBadge: {
    font: '500 11px/1 var(--font-sans)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
  },
  challengeBadge: {
    font: '600 11px/1 var(--font-sans)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(168,85,247,.14)',
    color: '#D8B4FE',
    border: '1px solid rgba(168,85,247,.3)',
  },
  statusBadge: {
    font: '600 11.5px/1 var(--font-mono)',
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid',
  },
  teamName: {
    font: '600 13.5px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  teamRatingMono: {
    font: '400 11.5px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  vsText: {
    font: '700 12px/1 var(--font-sans)',
    color: 'var(--text-disabled)',
    padding: '0 4px',
  },
  warnBox: {
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(240,183,92,.1)',
    border: '1px solid rgba(240,183,92,.3)',
    color: 'var(--status-delayed-fg)',
    font: '500 12px/1.3 var(--font-sans)',
  },
  smallPrimaryBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'var(--action-accent-bg, var(--teal-500))',
    color: 'var(--action-accent-fg, #04302C)',
    font: '600 12px/1 var(--font-sans)',
    border: 'none',
    cursor: 'pointer',
  },
  smallSecondaryBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    color: 'var(--text-primary)',
    font: '600 12px/1 var(--font-sans)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  smallGhostBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-secondary)',
    font: '500 12px/1 var(--font-sans)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  smallDangerBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'rgba(225,68,52,.12)',
    color: 'var(--status-incident-fg, #E14434)',
    font: '600 12px/1 var(--font-sans)',
    border: '1px solid rgba(225,68,52,.3)',
    cursor: 'pointer',
  },
  emptyBox: {
    padding: '36px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
  },
  emptyTitle: {
    font: '600 15px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  emptySub: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    maxWidth: 360,
  },
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardHead: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 14px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  cardSub: {
    font: '400 12px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  searchHeader: {
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  searchModeBtn: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    font: '500 12px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  videoCheckboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    font: '500 12.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  clearBtn: {
    font: '500 12px/1 var(--font-sans)',
    color: 'var(--status-incident-fg, #E14434)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  h2hCard: {
    padding: '12px 14px',
    borderTop: '1px solid var(--border-subtle)',
    background: 'var(--surface-sunken)',
  },
  h2hName: {
    font: '600 13px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  h2hTotalMono: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
  },
  statCard: {
    padding: '10px 12px',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    display: 'grid',
    gap: 3,
  },
  statLabel: {
    font: '500 11.5px/1 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  statValue: {
    font: '700 18px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  filterSelect: {
    height: 30,
    padding: '0 8px',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    font: '500 12px/1 var(--font-sans)',
    outline: 'none',
  },
  matchRow: {
    display: 'grid',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  metaText: {
    font: '400 11.5px/1 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  videoPlayBtn: {
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    borderRadius: 4,
    background: 'rgba(225,68,52,.14)',
    border: '1px solid rgba(225,68,52,.45)',
    color: '#FF9A8F',
    font: '600 11px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  editBtn: {
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 8px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    font: '500 11px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  scoreMono: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--text-primary)',
    letterSpacing: '0.05em',
  },
  loadMoreBtn: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    font: '600 12.5px/1 var(--font-sans)',
    cursor: 'pointer',
    marginTop: 4,
  },
  matrixLimitBtn: {
    height: 26,
    padding: '0 8px',
    borderRadius: 4,
    border: '1px solid var(--border-subtle)',
    font: '600 11px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  matrixTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'center',
  },
  matrixCornerTh: {
    padding: '8px',
    font: '600 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-subtle)',
    borderRight: '1px solid var(--border-subtle)',
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: 'var(--surface-card)',
  },
  matrixTh: {
    padding: '8px 6px',
    font: '600 11.5px/1 var(--font-sans)',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
    minWidth: 44,
  },
  matrixRowHeaderTd: {
    padding: '6px 8px',
    font: '600 11.5px/1 var(--font-sans)',
    color: 'var(--text-secondary)',
    borderRight: '1px solid var(--border-subtle)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    position: 'sticky',
    left: 0,
    zIndex: 1,
    background: 'var(--surface-card)',
  },
  matrixSelfTd: {
    padding: '6px',
    font: '400 12px/1 var(--font-mono)',
    color: 'var(--text-disabled)',
    background: 'var(--surface-sunken)',
  },
  matrixCellTd: {
    padding: '6px 4px',
    font: '600 12px/1 var(--font-mono)',
    cursor: 'pointer',
    border: '1px solid var(--border-subtle)',
  },
  suggestionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  suggestionNames: {
    font: '600 12.5px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
}
