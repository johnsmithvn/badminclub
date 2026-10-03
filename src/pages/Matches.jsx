import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Dialog, Icon, IconButton, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, PageHeader, SearchSelect, TabBar, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import NotificationBell from '#components/notification/NotificationBell.jsx'
import { playerName, courtOf, myMember, playerOf, timeTxt, courtTxt, presentCount, shortName } from '#lib/money.js'
import { dd, isoOf, todayISO, weekdayOf, wd } from '#utils/dates.js'
import {
  getPlayerRating,
  BALANCE_THRESHOLD, IMBALANCE_THRESHOLD, matchCodeOf, DEFAULT_RATING,
} from '#lib/rating.js'
import {
  searchMatches, headToHeadMatrix, neverMetPairs, topDisparatePairs, neverMetWithSessionCount,
  isCloseMatch, isThreeSetMatch, isUpsetMatch,
} from '#lib/matchSearch.js'
import { formatGapMinutes, videoTagLabelOf, matchVideosOf } from '#utils/videoUtils.js'
import { isChallengeAccepted } from '#lib/challenge.js'
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import MatchDetailModal from '#components/challenge/MatchDetailModal.jsx'
import ChallengeDetailModal from '#components/challenge/ChallengeDetailModal.jsx'
import ScoreModal from '#components/challenge/ScoreModal.jsx'
import AttachVideoModal, { MatchVideoInlineExpander } from '#components/challenge/AttachVideoModal.jsx'
import { VideoPlayerModal } from '#components/challenge/VideoPlayerModal.jsx'
import ArenaChallengeCard from '#components/challenge/ArenaChallengeCard.jsx'

/**
 * Lấy tên gọi ngắn gọn của thành viên (ưu tiên tên chính, kèm chữ lót nếu trùng)
 * phục vụ hiển thị header ma trận đối đầu trên mobile.
 */
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
    const prev = parts[parts.length - 2]
    return `${prev[0] ? prev[0] + '.' : ''} ${lastName}`
  }
  return lastName
}

/** Ngày (ISO) của một trận — cùng quy tắc với nhóm theo ngày ở tab Lịch sử: ngày buổi, không có buổi thì ngày đánh. */
function matchDayOf(m, sessionDateById) {
  return sessionDateById[m.sessionId] || (m.at ? isoOf(new Date(m.at)) : '')
}

export default function Matches() {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile(900)
  const [searchParams, setSearchParams] = useSearchParams()

  const myMem = myMember(db)
  const myId = myMem?.id || null
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  // Tab: 'challenges' (Sàn kèo) | 'search' (Lịch sử & Video) | 'matrix' (Ma trận đối đầu)
  // Tương thích ngược: nếu URL có tab=history thì map về 'search'
  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'search' || tabParam === 'history')
    ? 'search'
    : (tabParam === 'matrix' ? 'matrix' : 'challenges')

  const [activeTab, setActiveTab] = useState(initialTab)
  const [challengeSubTab, setChallengeSubTab] = useState('my') // 'my' | 'pending' | 'accepted' | 'played' | 'bet'
  const [challengeSearch, setChallengeSearch] = useState('')
  const [myEndedCollapsed, setMyEndedCollapsed] = useState(true)

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
  const [selectingSessionChallenge, setSelectingSessionChallenge] = useState(null)
  const [viewingChallenge, setViewingChallenge] = useState(null)
  const [scoringChallenge, setScoringChallenge] = useState(null)

  // Modals — khai báo trước các effect đọc URL bên dưới (effect matchId mở viewingMatch).
  const [editingMatch, setEditingMatch] = useState(null)
  const [viewingMatch, setViewingMatch] = useState(null)
  const [playingVideoMatch, setPlayingVideoMatch] = useState(null)
  const [attachVideoMatch, setAttachVideoMatch] = useState(null)

  /**
   * Buổi có thể gắn kèo vào.
   *
   * Trước đây là: buổi đang mở lên đầu, rồi NỐI TOÀN BỘ buổi còn lại của CLB vào sau, giữ
   * nguyên thứ tự thô của `db.sessions`. Nên danh sách hiện cả buổi đã chốt sổ từ đầu tháng,
   * lộn xộn ngày, và người dùng chọn phải một buổi đã qua thì kèo coi như mất tích.
   *
   * Giờ chỉ giữ buổi CHƯA kết thúc (nháp hoặc đang mở, và chưa qua ngày), sắp theo ngày tăng
   * dần. Buổi đang gắn thì luôn giữ lại dù nó đã qua — không thì người dùng mở modal ra không
   * thấy kèo của mình đang nằm ở đâu để mà gỡ.
   */
  const availableSessions = useMemo(() => {
    const today = db.today
    const linkedId = selectingSessionChallenge?.sessionId || null
    return (db.sessions || [])
      .filter((s) => (
        s.id === linkedId
        || (s.status !== 'cancelled' && s.date >= today)
      ))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [db.sessions, db.today, selectingSessionChallenge])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Tự động mở modal tạo kèo khi có targetId hoặc challenge=new từ trang Danh hiệu / BXH
  useEffect(() => {
    const target = searchParams.get('targetId')
    const challengeParam = searchParams.get('challenge')
    if (!target && challengeParam !== 'new') return

    // Đồng bộ từ URL (router — hệ ngoài React): đọc param, mở modal, rồi xoá param. Viết lại thành
    // tính lúc render là đụng cả luồng điều hướng kèo; luật này chỉ về hiệu năng (thêm một lượt render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialTeamA(myId ? [myId] : [])
    setInitialTeamB(target ? [target] : [])
    setChallengeModalOpen(true)
    setActiveTab('challenges')

    // Dọn param ngay sau khi dùng. Để lại thì mọi setSearchParams sau đó (đổi tab…) tạo ra
    // searchParams mới -> effect chạy lại -> modal bật lại và văng về tab Sàn kèo.
    const next = new URLSearchParams(searchParams)
    next.delete('targetId')
    next.delete('challenge')
    setSearchParams(next, { replace: true })
  }, [searchParams, myId, setSearchParams])

  const cidParam = searchParams.get('challengeId')
  const matchIdParam = searchParams.get('matchId')
  const [highlightedChallengeId, setHighlightedChallengeId] = useState(() => cidParam || null)
  const focusedCidRef = useRef(null) // cid đã chuyển sang Sàn kèo + làm nổi bật
  const subTabCidRef = useRef(null) // cid đã chọn xong tab con

  // Đồng bộ tab và challengeId / matchId từ URL searchParams khi được điều hướng từ ngoài vào
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'search' || tab === 'history') {
      // Đồng bộ từ URL như effect trên — xem lý do ở đó.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('search')
    } else if (tab === 'matrix') {
      setActiveTab('matrix')
    } else if (tab === 'challenges') {
      setActiveTab('challenges')
    }

    if (matchIdParam && db.matches) {
      const targetMatch = (db.matches || []).find((m) => m.id === matchIdParam || m.code === matchIdParam)
      if (targetMatch) {
        setActiveTab('search')
        setViewingMatch(targetMatch)
      }
    }

    // Mỗi `challengeId` chỉ được TRỎ TỚI MỘT LẦN. Param vẫn nằm lại trên URL, mà effect này chạy
    // lại mỗi khi URL đổi (bấm sang tab Lịch sử) hay `db.challenges` nạp lại — trước đây lần nào
    // cũng setActiveTab('challenges') + đặt lại tab con, giật người dùng về Sàn kèo.
    if (!cidParam) {
      focusedCidRef.current = null
      subTabCidRef.current = null
      return
    }
    if (focusedCidRef.current !== cidParam) {
      focusedCidRef.current = cidParam
      setHighlightedChallengeId(cidParam)
      setActiveTab('challenges')
    }
    if (subTabCidRef.current === cidParam) return

    const targetChal = (db.challenges || []).find((c) => c.id === cidParam)
    if (!targetChal) {
      // Chưa nạp xong kèo thì chờ lượt sau — chốt luôn là chọn nhầm tab con mà không sửa lại được.
      // Đã có danh sách mà không thấy thì kèo không còn: chốt 'pending' như cũ.
      if ((db.challenges || []).length) {
        subTabCidRef.current = cidParam
        setChallengeSubTab('pending')
      }
      return
    }
    subTabCidRef.current = cidParam
    const isMine = myId && (
      (targetChal.teamA || []).includes(myId) ||
      (targetChal.teamB || []).includes(myId) ||
      targetChal.createdBy === myId
    )
    if (isMine) {
      setChallengeSubTab('my')
    } else if (targetChal.status === 'pending') {
      setChallengeSubTab('pending')
    } else if (targetChal.status === 'played') {
      setChallengeSubTab('played')
    } else if (isChallengeAccepted(targetChal)) {
      setChallengeSubTab('accepted')
    } else {
      setChallengeSubTab('pending')
    }
  }, [searchParams, cidParam, matchIdParam, db.challenges, db.matches, myId])

  // Tự động cuộn đến thẻ kèo khi có highlightedChallengeId
  useEffect(() => {
    if (!highlightedChallengeId || activeTab !== 'challenges') return

    let attempts = 0
    const maxAttempts = 20
    const interval = setInterval(() => {
      attempts++
      const el = document.getElementById(`challenge-card-${highlightedChallengeId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        clearInterval(interval)
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [highlightedChallengeId, activeTab, challengeSubTab])

  // State Tìm trận & Lịch sử
  const [playerA, setPlayerA] = useState(() => searchParams.get('playerA') || '')
  const [playerB, setPlayerB] = useState(() => searchParams.get('playerB') || '')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  // Bấm một dòng trận trên Bảng tin: lọc ĐÚNG hai cặp của trận đó (`pairA`/`pairB` = "id,id").
  // Không có ô riêng trên giao diện — hai ô Người A/B hiện người đứng đầu mỗi cặp, và ràng buộc
  // cặp chỉ còn hiệu lực khi hai ô đó vẫn đúng hai người ấy. Đổi người / đổi chế độ / xoá lọc là
  // nó tự rơi, không cần nút gỡ.
  const [pairFilter] = useState(() => {
    const a = (searchParams.get('pairA') || '').split(',').filter(Boolean)
    const b = (searchParams.get('pairB') || '').split(',').filter(Boolean)
    return a.length && b.length ? [a, b] : null
  })
  const activePairs = pairFilter && searchMode === 'vs'
    && playerA === pairFilter[0][0] && playerB === pairFilter[1][0]
    ? pairFilter
    : null
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'threeSets' | 'upset'
  // Popover Bộ lọc: null = đóng, mở thì giữ toạ độ màn hình của nút (popover vẽ position:fixed).
  const [filterPos, setFilterPos] = useState(null)
  const filterBtnRef = useRef(null)
  const filterPopRef = useRef(null)
  const [courtFilter, setCourtFilter] = useState('all')
  // Lọc ngày: ISO 'YYYY-MM-DD', rỗng = không chặn đầu đó.
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [onlyVideoFilter, setOnlyVideoFilter] = useState(() => searchParams.get('video') === 'true')
  const [sortOption, setSortOption] = useState('latest') // 'latest' | 'dramatic' | 'elo_swing'
  const [searchCardLimit, setSearchCardLimit] = useState(10)
  const [expandedVideoMatchId, setExpandedVideoMatchId] = useState(null)

  // State Ma trận đối đầu H2H
  const [matrixMemberLimit, setMatrixMemberLimit] = useState(() => (isMobile ? 5 : 8))

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const memberSearchOptions = useMemo(() => {
    return (activeMembers || []).map((m) => ({
      value: m.id,
      label: m.name,
      level: m.level,
    }))
  }, [activeMembers])

  const memberMap = useMemo(() => {
    const map = {}
    ;(db?.members || []).forEach((m) => { if (m?.id) map[m.id] = m })
    ;(db?.guests || []).forEach((g) => { if (g?.id) map[g.id] = g })
    ;(db?.sessionGuests || []).forEach((sg) => {
      if (sg.guestId) {
        const g = (db?.guests || []).find((x) => x.id === sg.guestId)
        if (g) map[sg.id] = { ...g, ...sg, gender: g.gender || sg.gender }
      }
      if (sg.memberId) {
        const m = (db?.members || []).find((x) => x.id === sg.memberId)
        if (m) map[sg.id] = { ...m, ...sg, gender: m.gender || sg.gender }
      }
      if (!map[sg.id] && sg.id) {
        map[sg.id] = { id: sg.id, name: sg.name || playerName(db, sg.id) || sg.id, gender: sg.gender }
      }
    })
    return map
  }, [db])

  const memberNameOf = useCallback((id) => playerName(db, id), [db])
  /** Tên rút gọn để vẽ trong hàng trận — tên đầy đủ đi vào `title` để hover ra. */
  const shortNameOf = useCallback((id) => shortName(playerName(db, id)), [db])
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

  const ACTIVE_STATUS = new Set(['pending', 'accepted', 'oncourt'])
  const STATUS_ORDER = { pending: 0, accepted: 1, oncourt: 2 }

  const myActiveChallenges = useMemo(() => {
    return myChallenges
      .filter((c) => ACTIVE_STATUS.has(c.status))
      .slice()
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
  }, [myChallenges])

  const myEndedChallenges = useMemo(() => {
    return myChallenges.filter((c) => !ACTIVE_STATUS.has(c.status))
  }, [myChallenges])

  // Kèo được trỏ tới (từ thông báo / Bảng tin) nằm trong mục "Đã kết thúc" — mục này mặc định
  // THU GỌN — thì phải mở ra. Không thì banner "Đang làm nổi bật kèo…" hiện mà thẻ kèo không có
  // trên màn hình: dính mọi thông báo huỷ kèo / kèo ngã ngũ gửi cho chính người trong kèo.
  // Mở MỘT lần cho mỗi kèo được trỏ tới, chỉnh ngay lúc render (mẫu "điều chỉnh state khi đầu vào
  // đổi" của React) thay vì setState trong effect. Bản effect cũ còn mở lại mỗi lần db nạp lại, kể cả
  // khi người dùng vừa tự thu gọn.
  const [endedOpenedFor, setEndedOpenedFor] = useState(null)
  const highlightIsEnded = Boolean(highlightedChallengeId)
    && myEndedChallenges.some((c) => c.id === highlightedChallengeId)
  if (highlightIsEnded && endedOpenedFor !== highlightedChallengeId) {
    setEndedOpenedFor(highlightedChallengeId)
    setMyEndedCollapsed(false)
  }

  const pendingChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'pending')
  }, [allChallenges])

  const acceptedChallenges = useMemo(() => {
    return allChallenges.filter((c) => isChallengeAccepted(c))
  }, [allChallenges])

  const playedChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'played')
  }, [allChallenges])

  // Kèo mình đã đặt phiếu dự đoán (phiếu tự huỷ thì thôi) — chỗ tìm lại "tôi đã cược những gì".
  const betChallenges = useMemo(() => {
    if (!myId) return []
    const mine = new Set((db.challengePredictions || [])
      .filter((p) => p.memberId === myId && p.status !== 'cancelled')
      .map((p) => p.challengeId))
    return allChallenges.filter((c) => mine.has(c.id))
  }, [allChallenges, db.challengePredictions, myId])

  const displayedChallenges = useMemo(() => {
    let list
    switch (challengeSubTab) {
      case 'my': list = myChallenges; break
      case 'pending': list = pendingChallenges; break
      case 'accepted': list = acceptedChallenges; break
      case 'played': list = playedChallenges; break
      case 'bet': list = betChallenges; break
      default: list = myChallenges
    }

    if (challengeSearch.trim()) {
      const q = challengeSearch.trim().toLowerCase()
      list = list.filter((c) => {
        const matchCode = (c.code || '').toLowerCase().includes(q)
        const matchStake = (c.stakeText || '').toLowerCase().includes(q)
        const matchPlayer = [...(c.teamA || []), ...(c.teamB || [])].some((pid) => {
          const name = memberNameOf(pid) || ''
          return name.toLowerCase().includes(q)
        })
        return matchCode || matchStake || matchPlayer
      })
    }

    if (highlightedChallengeId) {
      const target = allChallenges.find((c) => c.id === highlightedChallengeId)
      if (target) {
        // Đưa kèo được highlight lên đầu danh sách để đập ngay vào mắt người dùng
        const others = list.filter((c) => c.id !== highlightedChallengeId)
        return [target, ...others]
      }
    }
    return list
  }, [challengeSubTab, myChallenges, pendingChallenges, acceptedChallenges, playedChallenges, betChallenges, challengeSearch, memberNameOf, allChallenges, highlightedChallengeId])

  // =========================================================================
  // TAB 2: LỊCH SỬ ĐẤU & VIDEO (SEARCH) - BÊ NGUYÊN TỪ LEADERBOARD CŨ
  // =========================================================================
  const sessionDateById = useMemo(
    () => Object.fromEntries((db.sessions || []).map((s) => [s.id, s.date])),
    [db.sessions],
  )

  const searchResults = useMemo(() => {
    const ratingsMap = {}
    activeMembers.forEach((m) => {
      ratingsMap[m.id] = getPlayerRating(db.playerRatings, m.id, m, db.levels).rating
    })

    let list = searchMatches(db.matches || [], {
      playerA: playerA || null,
      playerB: playerB || null,
      mode: searchMode,
      quality: qualityFilter,
      ratingsMap,
      pairs: activePairs,
    })

    if (onlyVideoFilter) {
      list = list.filter((m) => Boolean(m.videoUrl))
    }
    if (courtFilter !== 'all') {
      list = list.filter((m) => {
        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
        const courtObj = s?.courts?.[m.courtIdx]
        return courtObj?.courtId === courtFilter || String(m.courtIdx) === courtFilter
      })
    }
    if (dateFrom || dateTo) {
      list = list.filter((m) => {
        const d = matchDayOf(m, sessionDateById)
        return Boolean(d) && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      })
    }
    if (sourceFilter !== 'all') {
      list = list.filter((m) => {
        const isFromChal = Boolean(m.challengeId || m.sourceType === 'challenge')
        return sourceFilter === 'challenge' ? isFromChal : !isFromChal
      })
    }

    // Sắp xếp
    if (sortOption === 'dramatic') {
      list.sort((a, b) => {
        const aSets = a.sets || []
        const bSets = b.sets || []
        const aDiff = aSets.length ? Math.min(...aSets.map(([s1, s2]) => Math.abs(s1 - s2))) : 99
        const bDiff = bSets.length ? Math.min(...bSets.map(([s1, s2]) => Math.abs(s1 - s2))) : 99
        return aDiff - bDiff
      })
    } else if (sortOption === 'elo_swing') {
      list.sort((a, b) => Math.abs(b.eloDelta || 0) - Math.abs(a.eloDelta || 0))
    } else {
      list.sort((a, b) => (b.at || 0) - (a.at || 0))
    }

    return list
  }, [db.matches, playerA, playerB, searchMode, activePairs, qualityFilter, onlyVideoFilter, courtFilter, dateFrom, dateTo, sessionDateById, sourceFilter, sortOption, db.playerRatings, activeMembers, db.levels, db.sessions])

  const dayGroups = useMemo(() => {
    const groups = []
    const dayMap = new Map()

    searchResults.slice(0, searchCardLimit).forEach((m) => {
      const s = (db.sessions || []).find((x) => x.id === m.sessionId)
      const dateKey = s?.date ? s.date : (m.at ? isoOf(new Date(m.at)) : 'unknown')
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, [])
      }
      dayMap.get(dateKey).push(m)
    })

    // Giờ địa phương, KHÔNG toISOString (UTC) — trước 07:00 giờ VN nó trả về ngày hôm qua
    // nên nhãn 'Hôm nay' / 'Hôm qua' gắn lệch một ngày.
    const todayStr = todayISO()
    // Hôm qua tính từ chính todayStr (giờ địa phương) — không đọc đồng hồ lần thứ hai giữa lúc render.
    const yesterday = new Date(todayStr + 'T00:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = isoOf(yesterday)

    for (const [dateKey, matchesInDay] of dayMap.entries()) {
      matchesInDay.sort((a, b) => (b.at || 0) - (a.at || 0))

      const earliestAt = Math.min(...matchesInDay.map((m) => m.at || 0).filter(Boolean))
      const latestAt = Math.max(...matchesInDay.map((m) => m.at || 0).filter(Boolean))

      const startTimeStr = earliestAt ? new Date(earliestAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '19:00'
      const endTimeStr = latestAt ? new Date(latestAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '21:40'
      const timeRange = `${startTimeStr} → ${endTimeStr}`

      let durationText = ''
      if (earliestAt && latestAt && latestAt > earliestAt) {
        const totalMins = Math.round((latestAt - earliestAt) / 60000)
        const hrs = Math.floor(totalMins / 60)
        const mins = totalMins % 60
        durationText = hrs > 0 ? `${hrs}h${mins > 0 ? mins + '′' : ''}` : `${mins}′`
      }

      let dateLabel = dateKey
      if (dateKey !== 'unknown') {
        const dStr = dd(dateKey)
        if (dateKey === todayStr) {
          dateLabel = `${t('matchVideo.today')} · ${dStr}`
        } else if (dateKey === yesterdayStr) {
          dateLabel = `${t('matchVideo.yesterday')} · ${dStr}`
        } else {
          const daysOfWeek = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] // i18n-ok: day names array
          const dayName = daysOfWeek[weekdayOf(dateKey)] || ''
          dateLabel = `${dayName} · ${dStr}`
        }
      }

      const videoCount = matchesInDay.filter((m) => Boolean(m.videoUrl)).length

      const matchesWithMeta = matchesInDay.map((m, idx) => {
        const prevMatch = matchesInDay.slice(idx + 1).find((other) => other.at && m.at && other.at < m.at)
        const gapText = formatGapMinutes(m.at, prevMatch?.at)
        return {
          ...m,
          gapText: prevMatch ? gapText : (idx === matchesInDay.length - 1 ? t('matchVideo.sessionOpen') : gapText),
        }
      })

      groups.push({
        dateKey,
        dateLabel,
        timeRange,
        durationText,
        videoCount,
        totalMatches: matchesInDay.length,
        matches: matchesWithMeta,
      })
    }

    return groups
  }, [searchResults, searchCardLimit, db.sessions])

  // Dữ liệu đếm số lượng cho các tag lọc nhanh
  const allMatchesForCounters = useMemo(() => {
    let list = searchMatches(db.matches || [], {
      playerA: playerA || null,
      playerB: playerB || null,
      mode: searchMode,
      quality: 'all',
      ratingsMap: {},
    })
    if (onlyVideoFilter) list = list.filter((m) => Boolean(m.videoUrl))
    if (courtFilter !== 'all') {
      list = list.filter((m) => {
        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
        const courtObj = s?.courts?.[m.courtIdx]
        return courtObj?.courtId === courtFilter || String(m.courtIdx) === courtFilter
      })
    }
    if (dateFrom || dateTo) {
      list = list.filter((m) => {
        const d = matchDayOf(m, sessionDateById)
        return Boolean(d) && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      })
    }
    return list
  }, [db.matches, playerA, playerB, searchMode, onlyVideoFilter, courtFilter, dateFrom, dateTo, sessionDateById, db.sessions])

  const challengeMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter((m) => Boolean(m.challengeId || m.sourceType === 'challenge')).length
  }, [allMatchesForCounters])

  const closeMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter(isCloseMatch).length
  }, [allMatchesForCounters])

  const threeSetMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter(isThreeSetMatch).length
  }, [allMatchesForCounters])

  const upsetMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter(isUpsetMatch).length
  }, [allMatchesForCounters])

  // Mẫu số "11 / 130": mọi trận của người đang chọn, chưa qua lọc nào khác.
  const baseMatchCount = useMemo(() => searchMatches(db.matches || [], {
    playerA: playerA || null,
    playerB: playerB || null,
    mode: searchMode,
    quality: 'all',
    ratingsMap: {},
  }).length, [db.matches, playerA, playerB, searchMode])

  // Số trên nút Bộ lọc = số nhóm trong popover đang khác mặc định. Kèo tính cả khi bật từ chip ngoài
  // vì hai chỗ là một trạng thái.
  const activeFilterCount = (searchMode !== 'vs') + (sourceFilter !== 'all') + (courtFilter !== 'all')
    + Boolean(dateFrom || dateTo)
  const resetPopoverFilters = () => {
    setSearchMode('vs')
    setSourceFilter('all')
    setCourtFilter('all')
    setDateFrom('')
    setDateTo('')
  }
  // Nút nhanh "N ngày gần nhất" (tính cả hôm nay) = khoảng [hôm nay − (N−1), hôm nay], giờ địa phương.
  const daysAgoISO = (today, n) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - n)
    return isoOf(d)
  }
  const filterToday = todayISO()
  const datePreset = !dateFrom && !dateTo
    ? 'all'
    : (['1', '7', '30'].find((n) => dateTo === filterToday && dateFrom === daysAgoISO(filterToday, Number(n) - 1)) || 'custom')
  const applyDatePreset = (key) => {
    if (key === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }
    const today = todayISO()
    setDateFrom(daysAgoISO(today, Number(key) - 1))
    setDateTo(today)
  }
  const openFilter = () => {
    const r = filterBtnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(380, window.innerWidth - 32)
    // Nút nằm ngoài cùng bên phải → popover canh mép phải theo nút, không tràn khỏi màn.
    setFilterPos({ top: r.bottom + 6, left: Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16)), width })
  }
  // Toạ độ chốt lúc mở — trang cuộn / đổi cỡ thì đóng, không để popover trôi khỏi nút.
  // Cuộn bên trong chính popover (nhiều sân, màn thấp) thì giữ nguyên.
  useEffect(() => {
    if (!filterPos) return
    const close = (e) => {
      if (filterPopRef.current && filterPopRef.current.contains(e.target)) return
      setFilterPos(null)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [filterPos])

  const editedMatchesCount = useMemo(() => {
    const matchEdits = db.matchEdits || []
    const editedIds = new Set(matchEdits.map((e) => e.matchId))
    return searchResults.filter((m) => editedIds.has(m.id)).length
  }, [db.matchEdits, searchResults])

  // Thống kê Đối đầu H2H chi tiết giữa Player A và Player B cho Tab Search
  const h2hSummary = useMemo(() => {
    if (!playerA || !playerB || playerA === playerB) return null
    const all = db.matches || []
    // Bỏ trận chưa có kết quả (winnerTeam = null khi hoà set hoặc chưa nhập đủ): nhánh else bên dưới
    // sẽ cộng nhầm hết cho B. buildH2HMatrix cũng bỏ qua các trận này — không bỏ thì tab Ma trận
    // và panel Đối đầu hiện hai con số khác nhau cho cùng một cặp.
    const vsMatches = all.filter((m) => {
      if (!m.winnerTeam) return false
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const aIn1 = teamA.includes(playerA) && teamB.includes(playerB)
      const aIn2 = teamB.includes(playerA) && teamA.includes(playerB)
      return aIn1 || aIn2
    })
    const teamMatches = all.filter((m) => {
      if (!m.winnerTeam) return false
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const same1 = teamA.includes(playerA) && teamA.includes(playerB)
      const same2 = teamB.includes(playerA) && teamB.includes(playerB)
      return same1 || same2
    })

    let aWins = 0
    let bWins = 0
    let closeCount = 0
    let upsetCount = 0
    let challengeCount = 0
    let netDelta = 0

    vsMatches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const inA = teamA.includes(playerA)
      const aWon = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
      if (aWon) aWins++
      else bWins++

      const delta = Math.abs(m.eloDelta || 0)
      netDelta += (aWon ? delta : -delta)

      if (m.challengeId || m.sourceType === 'challenge') challengeCount++

      if (isCloseMatch(m)) closeCount++
      if (isUpsetMatch(m)) upsetCount++
    })

    let tmWins = 0
    let tmLoss = 0
    let lastDate = null
    let lastWon = false
    const sortedTm = [...teamMatches].sort((x, y) => (y.at || 0) - (x.at || 0))
    sortedTm.forEach((m, idx) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const inA = teamA.includes(playerA)
      const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
      if (won) tmWins++
      else tmLoss++
      if (idx === 0) {
        lastDate = m.at ? dd(isoOf(new Date(m.at))) : (m.createdAt ? dd(m.createdAt.slice(0, 10)) : null)
        lastWon = won
      }
    })

    const totalVs = aWins + bWins
    const aWinRate = totalVs > 0 ? ((aWins / totalVs) * 100).toFixed(1) : '0.0'
    const bWinRate = totalVs > 0 ? ((bWins / totalVs) * 100).toFixed(1) : '0.0'
    const tmTotal = tmWins + tmLoss
    const tmWinRate = tmTotal > 0 ? ((tmWins / tmTotal) * 100).toFixed(1) : '0.0'

    return {
      totalVs,
      aWins,
      bWins,
      aWinRate,
      bWinRate,
      closeCount,
      upsetCount,
      challengeCount,
      netDelta,
      relationshipTone: aWins > bWins ? 'easy' : bWins > aWins ? 'tough' : 'balanced',
      tmTotal,
      tmWins,
      tmLoss,
      tmWinRate,
      lastDate,
      lastWon,
    }
  }, [playerA, playerB, db.matches])

  // =========================================================================
  // TAB 3: MA TRẬN ĐỐI ĐẦU H2H (MATRIX) - BÊ NGUYÊN TỪ LEADERBOARD CŨ
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
      const ra = getPlayerRating(db.playerRatings, a.id, a, db.levels).rating
      const rb = getPlayerRating(db.playerRatings, b.id, b, db.levels).rating
      return rb - ra
    })
    const limit = matrixMemberLimit === 999 ? sorted.length : matrixMemberLimit
    return sorted.slice(0, limit)
  }, [activeMembers, memberH2HCounts, db.playerRatings, db.levels, matrixMemberLimit])

  const matrixData = useMemo(() => {
    return headToHeadMatrix(topMembersForMatrix, db.matches || []) || {}
  }, [topMembersForMatrix, db.matches])

  const fullClubMatrix = useMemo(() => {
    return headToHeadMatrix(activeMembers, db.matches || []) || {}
  }, [activeMembers, db.matches])

  const neverMetList = useMemo(() => {
    return neverMetPairs(activeMembers, db.matches || [])
  }, [activeMembers, db.matches])

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

  const neverMetSessionScored = useMemo(() => {
    const raw = neverMetWithSessionCount(neverMetList, {
      sessions: db.sessions || [],
      attendance: db.attendance || {},
      matches: db.matches || [],
    }, 5)
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




  return (
    <div style={{ ...S.page, gap: isMobile ? 10 : 16 }}>
      <PageHeader
        title={t('pages.matches.title')}
        subtitle={t('pages.matches.desc')}
        isMobile={isMobile}
        actions={
          <>
            {/* AppHeader bị ẩn ở route 'matches' nên trên mobile không còn chỗ nào đổi
                sáng/tối — và cũng không còn chuông, đúng cái màn hay nhận thông báo kèo nhất */}
            <NotificationBell />
            <IconButton
              icon={isDark ? 'sun' : 'moon'}
              size="sm"
              variant="ghost"
              label={isDark ? t('common.themeLight') : t('common.themeDark')}
              onClick={toggleTheme}
            />
            <IconButton
              icon="download"
              size="sm"
              variant="ghost"
              label={t('matchIo.exportBtn')}
              onClick={() => a.openDialog('exportMatches', {})}
            />
            <IconButton
              icon="upload"
              size="sm"
              variant="ghost"
              label={t('matchIo.importBtn')}
              onClick={() => a.openDialog('importMatches', {})}
            />
            <Button
              size="sm"
              icon="plus"
              onClick={() => {
                setInitialTeamA(myId ? [myId] : [])
                setInitialTeamB([])
                setChallengeModalOpen(true)
              }}
              style={{
                background: '#F5C451',
                color: '#1A1204',
                border: 'none',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(245,196,81,0.25)',
              }}
            >
              {isMobile ? t('challenge.challenge') : t('matchesPage.createBtn')}
            </Button>
          </>
        }
      />

      <TabBar
        isMobile={isMobile}
        value={activeTab}
        onChange={handleSelectTab}
        style={{ marginBottom: 4 }}
        items={[
          { key: 'challenges', label: t('matchesPage.tabChallenges'), tone: 'primary', badge: pendingChallenges.length || null },
          { key: 'search', label: 'History', tone: 'primary', badge: (db.matches || []).length },
          { key: 'matrix', label: t('matchesPage.tabMatrix'), tone: 'violet' },
        ]}
      />

      {/* ========================================================================= */}
      {/* TAB 1: SÀN KÈO / THÁCH ĐẤU */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 1: SÀN KÈO / THÁCH ĐẤU — PHONG CÁCH 1a ĐẤU TRƯỜNG */}
      {/* ========================================================================= */}
      {activeTab === 'challenges' && (() => {
        const subTabs = [
          { id: 'my', label: t('challenge.tabMy'), count: myChallenges.length },
          { id: 'pending', label: t('challenge.tabPending'), count: pendingChallenges.length, color: '#F0B75C' },
          { id: 'accepted', label: t('challenge.tabAccepted'), count: acceptedChallenges.length, color: '#2EC4B6' },
          { id: 'played', label: t('challenge.tabPlayed'), count: playedChallenges.length },
          { id: 'bet', label: t('challenge.tabBet'), count: betChallenges.length, color: '#A78BFA' },
        ]
        const currentTabObj = subTabs.find((st) => st.id === challengeSubTab) || subTabs[0]
        const arenaSubtitleText = t('challenge.arenaSubtitle', {
          tab: currentTabObj.label,
          count: currentTabObj.count,
        })

        const arenaGridStyle = {
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 16,
          width: '100%',
          alignItems: 'start',
        }

        const cardCommonProps = {
          db,
          a,
          myId,
          isAdmin,
          isMobile,
          highlightedChallengeId,
          now,
          getRating,
          memberNameOf,
          shortNameOf,
          onViewChallenge: setViewingChallenge,
          onSelectSession: setSelectingSessionChallenge,
          onViewMatch: setViewingMatch,
          onRevenge: (c) => {
            const isLoserA = c.winnerTeam === 'B'
            const loserTeam = isLoserA ? (c.teamA || []) : (c.teamB || [])
            const winTeam = isLoserA ? (c.teamB || []) : (c.teamA || [])
            setInitialTeamA(loserTeam)
            setInitialTeamB(winTeam)
            setChallengeModalOpen(true)
          },
        }

        return (
          <div
            style={{
              background: '#080D18',
              border: '1px solid #182236',
              borderRadius: isMobile ? 16 : 22,
              padding: isMobile ? '18px 14px' : '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              width: '100%',
              minWidth: 0,
            }}
          >
            {/* ARENA HEADER: SUBTITLE, HERO TITLE, SUBTABS, SEARCH & TẠO KÈO */}
            <div
              style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {/* Tiêu đề Đấu trường */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    font: '700 12px/1 "IBM Plex Sans", sans-serif',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#2EC4B6',
                  }}
                >
                  {arenaSubtitleText}
                </span>
                <span
                  style={{
                    font: isMobile
                      ? '800 22px/1.1 "Barlow Condensed", system-ui, sans-serif'
                      : '800 32px/1.1 "Barlow Condensed", system-ui, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.01em',
                    color: '#F4F7FB',
                  }}
                >
                  {t('challenge.arenaHeroTitle')}
                </span>
              </div>

              {/* Bộ lọc Subtabs & Search */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                {/* Pill Subtabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    background: '#0F1728',
                    border: '1px solid #1E2A40',
                    borderRadius: 12,
                    padding: 4,
                    overflowX: 'auto',
                    maxWidth: '100%',
                  }}
                >
                  {subTabs.map((st) => {
                    const active = challengeSubTab === st.id
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setChallengeSubTab(st.id)}
                        style={{
                          padding: isMobile ? '6px 10px' : '8px 12px',
                          borderRadius: 9,
                          background: active ? '#1B2842' : 'transparent',
                          color: active ? '#F4F7FB' : '#8494AA',
                          fontWeight: active ? 700 : 500,
                          fontSize: 13,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                      >
                        <span>{st.label}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: '"IBM Plex Mono", monospace',
                            color: st.color || (active ? '#F4F7FB' : '#8494AA'),
                            background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                            padding: '1px 5px',
                            borderRadius: 999,
                          }}
                        >
                          {st.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Input Tìm kiếm */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: isMobile ? '100%' : 220,
                    flex: isMobile ? '1 1 100%' : '0 0 auto',
                  }}
                >
                  <Icon
                    name="search"
                    size={14}
                    style={{ position: 'absolute', left: 10, color: '#8494AA', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder={t('challenge.searchPlaceholder')}
                    value={challengeSearch}
                    onChange={(e) => setChallengeSearch(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      borderRadius: 10,
                      border: '1px solid #1E2A40',
                      background: '#0F1728',
                      color: '#F4F7FB',
                      padding: '0 28px 0 32px',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  />
                  {challengeSearch && (
                    <button
                      type="button"
                      onClick={() => setChallengeSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        background: 'none',
                        border: 'none',
                        color: '#8494AA',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* BANNER KÈO ĐƯỢC HIGHLIGHT / CHỌN — kèo không còn trong db thì không có gì để
                làm nổi bật; hiện banner là treo mã ID thô trên một danh sách không có nó. */}
            {highlightedChallengeId && allChallenges.some((c) => c.id === highlightedChallengeId) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(0, 245, 212, 0.08)',
                  border: '1px solid rgba(0, 245, 212, 0.35)',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#F4F7FB' }}>
                  <span style={{ fontSize: 16 }}>🎯</span>
                  <span style={{ fontWeight: 600 }}>
                    {t('challenge.focusedNotice', {
                      code: (allChallenges.find((c) => c.id === highlightedChallengeId)?.code) || highlightedChallengeId,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHighlightedChallengeId(null)
                    const next = new URLSearchParams(searchParams)
                    next.delete('challengeId')
                    setSearchParams(next, { replace: true })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00F5D4',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  {t('challenge.viewAll')}
                </button>
              </div>
            )}

            {/* DANH SÁCH THẺ KÈO: KÈO TÂM ĐIỂM + LƯỚI KÈO */}
            {challengeSubTab === 'my' ? (
              <div style={{ display: 'grid', gap: 20, width: '100%' }}>
                {/* SECTION 1: ĐANG DIỄN RA */}
                {myActiveChallenges.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* KÈO TÂM ĐIỂM PHÓNG TO (KÈO ĐẦU TIÊN) */}
                    <ArenaChallengeCard
                      challenge={myActiveChallenges[0]}
                      isFeatured={true}
                      {...cardCommonProps}
                    />

                    {/* CÁC KÈO CÒN LẠI HIỂN THỊ DẠNG LƯỚI 2 CỘT */}
                    {myActiveChallenges.length > 1 && (
                      <div style={arenaGridStyle}>
                        {myActiveChallenges.slice(1).map((c) => (
                          <ArenaChallengeCard
                            key={c.id}
                            challenge={c}
                            isFeatured={false}
                            {...cardCommonProps}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#0D1526',
                      border: '1px dashed #1E2A40',
                      borderRadius: 16,
                      padding: '32px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'center',
                    }}
                  >
                    <Icon name="circle-check" size={28} style={{ color: '#2EC4B6' }} />
                    <span style={{ fontSize: 14, color: '#8494AA' }}>{t('matchesPage.emptyChallenges')}</span>
                  </div>
                )}

                {/* SECTION 2: ĐÃ KẾT THÚC (COLLAPSIBLE) */}
                {myEndedChallenges.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setMyEndedCollapsed(!myEndedCollapsed)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        padding: 0,
                        color: '#8494AA',
                      }}
                    >
                      <Icon
                        name={myEndedCollapsed ? 'chevron-right' : 'chevron-down'}
                        size={16}
                        style={{ color: '#8494AA' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#E9EFF7' }}>
                        {t('challenge.sectionEnded')}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: '"IBM Plex Mono", monospace',
                          color: '#8494AA',
                          background: '#1B2842',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {myEndedChallenges.length}
                      </span>
                    </button>

                    {!myEndedCollapsed && (
                      <div style={arenaGridStyle}>
                        {myEndedChallenges.map((c) => (
                          <ArenaChallengeCard
                            key={c.id}
                            challenge={c}
                            isFeatured={false}
                            {...cardCommonProps}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {myChallenges.length === 0 && (
                  <div
                    style={{
                      background: '#0D1526',
                      border: '1px dashed #1E2A40',
                      borderRadius: 16,
                      padding: '48px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'center',
                    }}
                  >
                    <Icon name="history" size={36} style={{ color: '#5B6A82' }} />
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#F4F7FB' }}>
                      {t('matchesPage.emptyChallenges')}
                    </div>
                    <div style={{ fontSize: 13, color: '#8494AA' }}>
                      {t('matchesPage.createChallengePrompt')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInitialTeamA(myId ? [myId] : [])
                        setInitialTeamB([])
                        setChallengeModalOpen(true)
                      }}
                      style={{
                        marginTop: 4,
                        font: '700 13px/1 "IBM Plex Sans", sans-serif',
                        color: '#1A1204',
                        background: '#F5C451',
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Icon name="plus" size={14} />
                      <span>{t('matchesPage.createBtn')}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* CÁC TAB KHÁC: PENDING, ACCEPTED, PLAYED */
              displayedChallenges.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* KÈO TÂM ĐIỂM (KÈO ĐẦU TIÊN) */}
                  <ArenaChallengeCard
                    challenge={displayedChallenges[0]}
                    isFeatured={true}
                    {...cardCommonProps}
                  />

                  {/* CÁC KÈO CÒN LẠI TRONG LƯỚI 2 CỘT */}
                  {displayedChallenges.length > 1 && (
                    <div style={arenaGridStyle}>
                      {displayedChallenges.slice(1).map((c) => (
                        <ArenaChallengeCard
                          key={c.id}
                          challenge={c}
                          isFeatured={false}
                          {...cardCommonProps}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: '#0D1526',
                    border: '1px dashed #1E2A40',
                    borderRadius: 16,
                    padding: '48px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'center',
                  }}
                >
                  <Icon name="history" size={36} style={{ color: '#5B6A82' }} />
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#F4F7FB' }}>
                    {t('matchesPage.emptyChallenges')}
                  </div>
                  <div style={{ fontSize: 13, color: '#8494AA' }}>
                    {t('matchesPage.createChallengePrompt')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInitialTeamA(myId ? [myId] : [])
                      setInitialTeamB([])
                      setChallengeModalOpen(true)
                    }}
                    style={{
                      marginTop: 4,
                      font: '700 13px/1 "IBM Plex Sans", sans-serif',
                      color: '#1A1204',
                      background: '#F5C451',
                      padding: '10px 18px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Icon name="plus" size={14} />
                    <span>{t('matchesPage.createBtn')}</span>
                  </button>
                </div>
              )
            )}
          </div>
        )
      })()}

      {/* ========================================================================= */}
      {/* TAB 2: LỊCH SỬ ĐẤU & VIDEO (SEARCH) - 100% NGUYÊN BẢN LEADERBOARD CŨ */}
      {/* ========================================================================= */}
      {activeTab === 'search' && (
        <div style={{ display: 'grid', gap: 16, width: '100%', minWidth: 0 }}>
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {/* 1. Thanh tìm trận: Người chơi A ⇄ B · Bộ lọc · Sắp xếp */}
            <div
              style={{
                padding: isMobile ? '8px 10px' : '11px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                background: 'var(--surface-inset)',
              }}
            >
              {/* Cụm chọn Người chơi A ⇄ Người chơi B */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: isMobile ? '1 1 100%' : '1 1 auto', minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SearchSelect
                    size="sm"
                    placeholder={`A · ${t('matchSearch.playerA')}`}
                    options={memberSearchOptions}
                    value={playerA}
                    onChange={(val) => setPlayerA(val || '')}
                    clearable
                    hideSelectedLevel
                    menuWidth={220}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const temp = playerA
                    setPlayerA(playerB)
                    setPlayerB(temp)
                  }}
                  style={{
                    width: isMobile ? 28 : 32,
                    height: isMobile ? 28 : 32,
                    border: '1px solid var(--field-border)',
                    borderRadius: 'var(--radius-control)',
                    background: 'var(--field-bg)',
                    color: 'var(--teal-500)',
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={t('common.swap')}
                >
                  ⇄
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <SearchSelect
                    size="sm"
                    placeholder={`B · ${t('matchSearch.playerB')}`}
                    options={memberSearchOptions}
                    value={playerB}
                    onChange={(val) => setPlayerB(val || '')}
                    clearable
                    hideSelectedLevel
                    menuWidth={220}
                  />
                </div>
              </div>

              {/* Sắp xếp: dropdown, đứng trước nút Bộ lọc */}
              <div style={{ position: 'relative', flex: isMobile ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
                <Icon
                  name="chevrons-up-down"
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }}
                />
                <Select
                  size="sm"
                  aria-label={t('common.sort')}
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  options={[
                    { value: 'latest', label: t('matchVideo.sortLatest') },
                    { value: 'dramatic', label: t('matchVideo.sortDramatic') },
                    { value: 'elo_swing', label: t('matchVideo.sortEloSwing') },
                  ]}
                  style={{ paddingLeft: 30, fontWeight: 600 }}
                />
              </div>

              {/* Bộ lọc ngoài cùng bên phải: Góc nhìn · Kèo · Sân (· Người xem) gom vào một popover; nút hiện số lọc đang bật */}
              <button
                ref={filterBtnRef}
                type="button"
                aria-expanded={Boolean(filterPos)}
                aria-label={t('common.filterTitle')}
                title={t('common.filterTitle')}
                onClick={() => (filterPos ? setFilterPos(null) : openFilter())}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid',
                  borderColor: filterPos || activeFilterCount ? 'var(--teal-500)' : 'var(--field-border)',
                  background: activeFilterCount ? 'var(--surface-accent-soft)' : 'var(--field-bg)',
                  color: filterPos || activeFilterCount ? (isDark ? '#5FDBD3' : 'var(--teal-700)') : 'var(--text-secondary)',
                  font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon name="filter" size={14} />
                {!isMobile && <span>{t('common.filterTitle')}</span>}
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      boxSizing: 'border-box',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--action-accent-bg)',
                      color: 'var(--action-accent-fg)',
                      font: "700 11px/1 'IBM Plex Mono', monospace",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
                <Icon name={filterPos ? 'chevron-up' : 'chevron-down'} size={14} />
              </button>
            </div>

            {/* Popover Bộ lọc: đưa ra document.body vì thẻ này overflow:hidden — lọc ra ít trận thì
                thẻ thấp và popover bị cắt đúng lúc cần bấm Đặt lại. Lọc áp ngay khi chọn. */}
            {filterPos && createPortal(
              <>
                <div onClick={() => setFilterPos(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
                <div
                  ref={filterPopRef}
                  style={{
                    position: 'fixed',
                    top: filterPos.top,
                    left: filterPos.left,
                    width: filterPos.width,
                    maxHeight: `calc(100vh - ${filterPos.top + 16}px)`,
                    overflowY: 'auto',
                    zIndex: 1001,
                    display: 'grid',
                    gap: 12,
                    padding: 14,
                    boxSizing: 'border-box',
                    borderRadius: 10,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.18))',
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Overline>{t('matchVideo.filterView')}</Overline>
                    <FilterSeg
                      value={searchMode}
                      onChange={setSearchMode}
                      options={[
                        { value: 'vs', label: t('matchSearch.modeH2H') },
                        { value: 'team', label: t('matchSearch.modeTeammate') },
                      ]}
                    />
                  </div>

                  {/* Cùng trạng thái với chip Kèo ngoài bảng */}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Overline>{t('challenge.challenge')}</Overline>
                    <FilterSeg
                      value={sourceFilter}
                      onChange={setSourceFilter}
                      options={[
                        { value: 'all', label: t('common.all') },
                        { value: 'challenge', label: t('matchVideo.filterSourceChallenge') },
                        { value: 'session', label: t('matchVideo.filterSourceSession') },
                      ]}
                    />
                  </div>

                  {/* Ngày: nút nhanh hoặc tự chọn khoảng; chọn tay thì không nút nhanh nào sáng */}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Overline>{t('matchVideo.filterDate')}</Overline>
                    <FilterSeg
                      value={datePreset}
                      onChange={applyDatePreset}
                      options={[
                        { value: 'all', label: t('matchVideo.filterDateAll') },
                        { value: '1', label: t('matchVideo.today') },
                        { value: '7', label: t('matchVideo.filterDate7') },
                        { value: '30', label: t('matchVideo.filterDate30') },
                      ]}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <Input
                        type="date"
                        size="sm"
                        mono
                        label={t('matchVideo.filterDateFrom')}
                        value={dateFrom}
                        max={dateTo || undefined}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                      <Input
                        type="date"
                        size="sm"
                        mono
                        label={t('matchVideo.filterDateTo')}
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>

                  {(db.courts || []).length > 0 && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Overline>{t('matchVideo.colCourt')}</Overline>
                      <FilterSeg
                        value={courtFilter}
                        onChange={setCourtFilter}
                        options={[
                          { value: 'all', label: t('matchVideo.filterAllCourts') },
                          ...(db.courts || []).map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <Button variant="secondary" size="sm" block disabled={activeFilterCount === 0} onClick={resetPopoverFilters}>
                      {t('matchVideo.filterReset')}
                    </Button>
                    <Button variant="accent" size="sm" block onClick={() => setFilterPos(null)}>
                      {t('matchVideo.filterApply', { n: searchResults.length })}
                    </Button>
                  </div>
                </div>
              </>,
              document.body,
            )}

            {/* Thanh đối đầu H2H trực quan khi chọn đủ 2 người */}
            {h2hSummary && playerA && playerB && (
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  background: 'var(--surface-card)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 200 }}>
                  <div style={{ font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {t('matchVideo.h2hMeetingTitle', { nameA: memberNameOf(playerA), nameB: memberNameOf(playerB), matches: h2hSummary.totalVs })}
                  </div>
                  <div style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {t('matchVideo.h2hWinsLosses', { wins: h2hSummary.aWins, losses: h2hSummary.bWins, videos: searchResults.filter((m) => Boolean(m.videoUrl)).length })}
                    {h2hSummary.lastDate ? t('matchVideo.h2hLastMet', { date: h2hSummary.lastDate }) : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 120,
                        height: 7,
                        borderRadius: 999,
                        background: 'var(--surface-sunken)',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div style={{ width: `${Math.max(5, Math.min(95, Number(h2hSummary.aWinRate) || 50))}%`, background: 'var(--teal-500)' }} />
                      <div style={{ flex: 1, background: 'var(--navy-700, #3B4C6B)' }} />
                    </div>
                    <div style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                      {h2hSummary.aWinRate}%
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setInitialTeamA([playerA])
                      setInitialTeamB([playerB])
                      setChallengeModalOpen(true)
                    }}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '0 10px',
                      borderRadius: 6,
                      background: 'var(--surface-brand-soft, rgba(0,178,169,.14))',
                      border: '1px solid var(--teal-500)',
                      color: 'var(--teal-500)',
                      font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    <span>🎯</span>
                    <span>{t('matchSearch.challengeBetween')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Thanh tiêu đề thống kê & pills */}
            <div
              style={{
                padding: isMobile ? '8px 10px' : '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                gap: isMobile ? 6 : 9,
                background: 'var(--surface-card)',
              }}
            >
              {/* Chỉ để số: số trận đang hiện nổi lên, tổng mờ phía sau. Câu đầy đủ nằm ở title. */}
              <div
                title={t('matchVideo.recentMatchesHeader', { n: searchResults.length })}
                style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, whiteSpace: 'nowrap' }}
              >
                <span style={{ font: `700 ${isMobile ? 20 : 22}px/1 'IBM Plex Mono', monospace`, color: isDark ? '#5FDBD3' : 'var(--teal-700)' }}>
                  {searchResults.length}
                </span>
                <span style={{ font: "500 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                  {t('matchVideo.recentMatchesTotal', { total: baseMatchCount })}
                </span>
              </div>

              {/* Dòng cuộn ngang các pills duy nhất */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: isMobile ? 2 : 0,
                  flexWrap: isMobile ? 'nowrap' : 'wrap',
                }}
              >
                {/* Chip Có video: bấm là bật/tắt lọc "chỉ trận có video" */}
                <button
                  type="button"
                  aria-pressed={onlyVideoFilter}
                  onClick={() => setOnlyVideoFilter((prev) => !prev)}
                  style={{
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: 999,
                    background: onlyVideoFilter ? 'var(--action-accent-bg)' : (isDark ? 'rgba(0,178,169,.14)' : 'var(--status-transit-bg)'),
                    border: '1px solid',
                    borderColor: onlyVideoFilter ? 'var(--teal-500)' : (isDark ? 'rgba(0,178,169,.42)' : 'var(--teal-300)'),
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: onlyVideoFilter ? 'var(--action-accent-fg)' : (isDark ? '#5FDBD3' : 'var(--status-transit-fg)'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={t('matchVideo.onlyHasVideo')}
                >
                  {t('matchVideo.hasVideoCount', { n: searchResults.filter((m) => Boolean(m.videoUrl)).length })}
                </button>

                {/* Nút lọc nhanh: Kèo */}
                <button
                  type="button"
                  onClick={() => setSourceFilter((prev) => (prev === 'challenge' ? 'all' : 'challenge'))}
                  style={{
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: sourceFilter === 'challenge' ? (isDark ? 'rgba(168,85,247,.22)' : 'var(--violet-100)') : 'var(--surface-inset)',
                    border: '1px solid',
                    borderColor: sourceFilter === 'challenge' ? (isDark ? '#A855F7' : 'var(--violet-500)') : 'var(--border-subtle)',
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: sourceFilter === 'challenge' ? (isDark ? '#D8B4FE' : 'var(--violet-700)') : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={t('challenge.challenge')}
                >
                  <span>⚔️ {t('challenge.challenge')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{challengeMatchesCount}</span>
                </button>

                {/* Nút lọc nhanh: Sát điểm */}
                <button
                  type="button"
                  onClick={() => setQualityFilter((prev) => (prev === 'close' ? 'all' : 'close'))}
                  style={{
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: qualityFilter === 'close' ? (isDark ? 'rgba(224,138,0,.22)' : 'var(--status-delayed-bg)') : 'var(--surface-inset)',
                    border: '1px solid',
                    borderColor: qualityFilter === 'close' ? (isDark ? '#E08A00' : 'var(--amber-500)') : 'var(--border-subtle)',
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: qualityFilter === 'close' ? (isDark ? '#FFCB77' : 'var(--status-delayed-fg)') : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={t('matchVideo.tagClose')}
                >
                  <span>{t('matchVideo.tagClose')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{closeMatchesCount}</span>
                </button>

                {/* Nút lọc nhanh: Đi đủ 3 set — tách khỏi 'sát điểm', trận dài chưa chắc đã sát điểm */}
                <button
                  type="button"
                  onClick={() => setQualityFilter((prev) => (prev === 'threeSets' ? 'all' : 'threeSets'))}
                  style={{
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: qualityFilter === 'threeSets' ? (isDark ? 'rgba(124,58,237,.22)' : 'var(--violet-100)') : 'var(--surface-inset)',
                    border: '1px solid',
                    borderColor: qualityFilter === 'threeSets' ? (isDark ? '#7C3AED' : 'var(--violet-500)') : 'var(--border-subtle)',
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: qualityFilter === 'threeSets' ? (isDark ? '#C4B5FD' : 'var(--violet-700)') : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={t('matchSearch.qualityThreeSets')}
                >
                  <span>{t('matchVideo.tagThreeSets')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{threeSetMatchesCount}</span>
                </button>

                {/* Nút lọc nhanh: Bất ngờ */}
                <button
                  type="button"
                  onClick={() => setQualityFilter((prev) => (prev === 'upset' ? 'all' : 'upset'))}
                  style={{
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: qualityFilter === 'upset' ? (isDark ? 'rgba(225,68,52,.24)' : 'var(--status-incident-bg)') : 'var(--surface-inset)',
                    border: '1px solid',
                    borderColor: qualityFilter === 'upset' ? (isDark ? 'rgba(225,68,52,.7)' : 'var(--red-500)') : 'var(--border-subtle)',
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: qualityFilter === 'upset' ? (isDark ? '#FFB0A5' : 'var(--status-incident-fg)') : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={t('matchVideo.tagUpset')}
                >
                  <span>{t('matchVideo.tagUpset')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{upsetMatchesCount}</span>
                </button>

                {editedMatchesCount > 0 && (
                  <div
                    style={{
                      height: 24,
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      borderRadius: 999,
                      background: 'rgba(240,183,92,.16)',
                      border: '1px solid rgba(240,183,92,.4)',
                      font: "600 11px/1 'IBM Plex Sans', sans-serif",
                      color: 'var(--status-delayed-fg)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {t('matchSearch.editedMatchesCount', { count: editedMatchesCount })}
                  </div>
                )}
              </div>
            </div>

            {/* DANH SÁCH LỊCH SỬ TRẬN ĐẤU: MOBILE MATCH CARDS HOẶC BẢNG 10 CỘT DESKTOP */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 4px' }}>
                {dayGroups.map((group) => (
                  <div key={group.dateKey} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Dòng Header Ngày trên Mobile */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: isDark ? 'rgba(0,178,169,.08)' : 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--text-accent)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ font: "600 12.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-accent)' }}>
                        {group.dateLabel}
                      </div>
                      <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {t('matchVideo.subDaySummary', { range: group.timeRange, matches: group.totalMatches, videos: group.videoCount })}
                      </div>
                    </div>

                    {/* Danh sách các card trận trong ngày */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {group.matches.map((m) => {
                        const teamA = m.teamA || []
                        const teamB = m.teamB || []
                        const aWon = m.winnerTeam === 'A'
                        const winnerTeam = aWon ? teamA : teamB
                        const loserTeam = aWon ? teamB : teamA
                        const winnerNames = winnerTeam.map(shortNameOf).join(' · ')
                        const loserNames = loserTeam.map(shortNameOf).join(' · ')
                        const winnerFull = winnerTeam.map(memberNameOf).join(' · ')
                        const loserFull = loserTeam.map(memberNameOf).join(' · ')

                        const scoreSets = (m.sets || []).map(([a, b]) => ({
                          winPts: aWon ? a : b,
                          losePts: aWon ? b : a,
                        }))
                        const isMultiSet = scoreSets.length > 1
                        const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
                        const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0

                        const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                        const isRated = m.ratingEnabled !== false

                        const ra = m.initialRatingA || 0
                        const rb = m.initialRatingB || 0
                        const isUpset = isUpsetMatch(m)
                        const isClose = isCloseMatch(m)
                        const isThreeSets = isThreeSetMatch(m)
                        const isStreak = (m.brokenStreak || 0) >= 3

                        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
                        const courtObj = s?.courts?.[m.courtIdx]
                        const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                        const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                        const matchTime = m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (courtObj?.from || '19:00')
                        const matchCode = matchCodeOf(db, m)

                        const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                        const predPct = isUpset ? '34%' : isClose ? '52%' : '50%'
                        const isCorrect = !isUpset
                        const hasVideo = Boolean(m.videoUrl)
                        const videoTagLabel = videoTagLabelOf(m)

                        let leftAccentColor = '#00B2A9'
                        let cardBg = 'var(--surface-raised, #161F30)'
                        let cardBorder = '1px solid var(--border-subtle, rgba(255,255,255,0.08))'
                        let cardGradient = 'none'

                        if (isChallenge) {
                          leftAccentColor = '#F97316'
                          cardBg = 'rgba(249, 115, 22, 0.08)'
                          cardBorder = '1px solid rgba(249, 115, 22, 0.3)'
                          cardGradient = 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(18, 26, 43, 0.95) 55%)'
                        } else if (isUpset) {
                          leftAccentColor = '#E14434'
                          cardBg = 'rgba(225, 68, 52, 0.08)'
                          cardBorder = '1px solid rgba(225, 68, 52, 0.3)'
                          cardGradient = 'linear-gradient(135deg, rgba(225, 68, 52, 0.12) 0%, rgba(18, 26, 43, 0.95) 55%)'
                        } else if (isClose) {
                          leftAccentColor = '#E08A00'
                          cardBg = 'rgba(224, 138, 0, 0.08)'
                          cardBorder = '1px solid rgba(224, 138, 0, 0.3)'
                          cardGradient = 'linear-gradient(135deg, rgba(224, 138, 0, 0.12) 0%, rgba(18, 26, 43, 0.95) 55%)'
                        } else if (isThreeSets) {
                          leftAccentColor = '#7C3AED'
                          cardBg = 'rgba(124, 58, 237, 0.08)'
                          cardBorder = '1px solid rgba(124, 58, 237, 0.3)'
                          cardGradient = 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(18, 26, 43, 0.95) 55%)'
                        } else if (isStreak) {
                          leftAccentColor = '#00B2A9'
                          cardBg = 'rgba(0, 178, 169, 0.08)'
                          cardBorder = '1px solid rgba(0, 178, 169, 0.3)'
                          cardGradient = 'linear-gradient(135deg, rgba(0, 178, 169, 0.12) 0%, rgba(18, 26, 43, 0.95) 55%)'
                        }

                        return (
                          <div
                            key={m.id}
                            onClick={() => setViewingMatch(m)}
                            style={{
                              position: 'relative',
                              overflow: 'hidden',
                              background: cardBg,
                              backgroundImage: cardGradient,
                              border: cardBorder,
                              borderRadius: 12,
                              padding: '10px 12px 10px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              boxShadow: '0 0 0 1px rgba(0,178,169,.08), 0 6px 18px rgba(0,0,0,.25)',
                              transition: 'all 0.25s ease',
                              cursor: 'pointer',
                            }}
                          >
                            {/* Vạch màu kịch bản bên trái 3px */}
                            <span
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 3,
                                background: leftAccentColor,
                              }}
                            />

                            {/* Hàng 1: Mã trận + Kèo + Giờ + Sân + Cụm nút góc phải */}
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setViewingMatch(m)
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    font: "600 12px/1 'IBM Plex Mono', monospace",
                                    color: '#5FDBD3',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  title={t('matchDetail.title')}
                                >
                                  {matchCode}
                                </button>
                                {isChallenge && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '2px 7px',
                                      borderRadius: 999,
                                      background: 'rgba(249, 115, 22, 0.22)',
                                      border: '1px solid rgba(249, 115, 22, 0.55)',
                                      font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                      color: '#FB923C',
                                    }}
                                  >
                                    <span>⚔️</span>
                                    <span>{t('matchVideo.tagChallenge')}</span>
                                  </span>
                                )}
                                {matchTime && (
                                  <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                                    {matchTime}
                                  </span>
                                )}
                                {m.gapText && (
                                  <span style={{ font: "500 11px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                                    {m.gapText.startsWith('+') ? m.gapText : `(${m.gapText})`}
                                  </span>
                                )}
                                {courtLabel && (
                                  s?.id ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/buoi-tap/${s.id}?tab=matches&matchId=${m.id}`)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        padding: 0,
                                        font: "400 11px/1.3 'IBM Plex Mono', monospace",
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        textDecoration: 'underline',
                                        textDecorationColor: 'rgba(255,255,255,0.2)',
                                      }}
                                      title={`${venue?.name || ''} · ${t('pages.sessions.title')}`}
                                    >
                                      {courtLabel}
                                    </button>
                                  ) : (
                                    <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                                      {courtLabel}
                                    </span>
                                  )
                                )}
                              </div>

                              {/* Cụm nút góc phải: Xem video hoặc Gắn video + Nút Sửa điểm */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                {hasVideo ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setPlayingVideoMatch(m)
                                    }}
                                    style={{
                                      height: 24,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      background: 'rgba(225,68,52,.16)',
                                      border: '1px solid rgba(225,68,52,.45)',
                                      font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                      color: '#FF9A8F',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={m.videoUrl}
                                  >
                                    <span>▶</span>
                                    <span>{videoTagLabel}</span>
                                    {Number(m.videoViews) > 0 && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: 0.85, fontSize: 10, marginLeft: 2 }}>
                                        <Icon name="eye" size={10} />
                                        <span>{m.videoViews}</span>
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAttachVideoMatch(m)
                                    }}
                                    style={{
                                      height: 24,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      border: '1px dashed var(--border-default, #3A4D72)',
                                      background: 'transparent',
                                      font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                      color: 'var(--text-muted, #9BAABF)',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span>+</span>
                                    <span>Link</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingMatch(m)
                                  }}
                                  title={t('matchSearch.btnEdit')}
                                  aria-label={t('matchSearch.btnEdit')}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                    background: 'var(--surface-raised, #1A2437)',
                                    border: '1px solid var(--border-default, #2E3E5C)',
                                    color: 'var(--text-secondary, #C3D0E0)',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <Icon name="pencil" size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Tag kịch bản Upset / Sát điểm */}
                            {isUpset && !isChallenge && (
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: -2 }}>
                                <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(225,68,52,.24)', font: "600 10.5px/1 'IBM Plex Sans', sans-serif", color: '#FFB0A5' }}>
                                  {t('matchVideo.tagUpsetSession')}
                                </span>
                                <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
                                  {t('matchVideo.underdogWonDiff', { n: Math.abs(Math.round(ra - rb)) })}
                                </span>
                              </div>
                            )}
                            {isClose && !isChallenge && !isUpset && (
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: -2 }}>
                                <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(224,138,0,.22)', font: "600 10.5px/1 'IBM Plex Sans', sans-serif", color: '#FFCB77' }}>
                                  {t('matchVideo.tagCloseSession')}
                                </span>
                                <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
                                  {t('matchVideo.diffPoints', { n: 2 })}
                                </span>
                              </div>
                            )}
                            {isThreeSets && !isChallenge && !isUpset && !isClose && (
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: -2 }}>
                                <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(124,58,237,.22)', font: "600 10.5px/1 'IBM Plex Sans', sans-serif", color: '#C4B5FD' }}>
                                  {t('matchVideo.tagThreeSetsSession')}
                                </span>
                              </div>
                            )}

                            {/* Hàng 2: Người chơi & Điểm số (trên dưới) */}
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 5, margin: '2px 0' }}>
                              {/* Đội thắng */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                  <span
                                    style={{
                                      width: 18,
                                      height: 18,
                                      flex: '0 0 auto',
                                      borderRadius: 5,
                                      background: 'rgba(0,178,169,.16)',
                                      border: '1px solid rgba(0,178,169,.42)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10,
                                    }}
                                  >
                                    👑
                                  </span>
                                  <span
                                    style={{
                                      font: "600 14px/1.25 'IBM Plex Sans', sans-serif",
                                      color: '#5FDBD3',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span title={winnerFull}>{winnerNames}</span>
                                  </span>
                                </div>
                                <div style={{ flex: '0 0 auto' }}>
                                  {isMultiSet ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                      <span style={{ font: "700 16px/1 'IBM Plex Mono', monospace", color: '#8BEDE6' }}>{winSetsCount}</span>
                                      <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: '#5FDBD3', opacity: 0.85 }}>
                                        ({scoreSets.map((s) => s.winPts).join('-')})
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        minWidth: 28,
                                        textAlign: 'right',
                                        font: "700 18px/1 'IBM Plex Mono', monospace",
                                        color: '#8BEDE6',
                                      }}
                                    >
                                      {scoreSets[0]?.winPts ?? ''}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Đội thua */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, paddingLeft: 26 }}>
                                  <span
                                    style={{
                                      font: "500 13.5px/1.25 'IBM Plex Sans', sans-serif",
                                      color: '#BFCDDE',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span title={loserFull}>{loserNames}</span>
                                  </span>
                                </div>
                                <div style={{ flex: '0 0 auto' }}>
                                  {isMultiSet ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                      <span style={{ font: "700 16px/1 'IBM Plex Mono', monospace", color: '#B3C2D6' }}>{loseSetsCount}</span>
                                      <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                                        ({scoreSets.map((s) => s.losePts).join('-')})
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        minWidth: 28,
                                        textAlign: 'right',
                                        font: "700 18px/1 'IBM Plex Mono', monospace",
                                        color: '#B3C2D6',
                                      }}
                                    >
                                      {scoreSets[0]?.losePts ?? ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Hàng 3 (Footer): Trái = Elo + Điểm mùa, Phải = Dự đoán */}
                            <div
                              style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                paddingTop: 7,
                                borderTop: '1px solid rgba(34,48,74,.8)',
                                flexWrap: 'wrap',
                              }}
                            >
                              {/* Trái: Elo & pts */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                                  Elo{' '}
                                  {isRated ? (
                                    <>
                                      <span style={{ color: '#5FDBD3', fontWeight: 600 }}>+{absDelta}</span> /{' '}
                                      <span style={{ color: '#D99289', fontWeight: 600 }}>−{absDelta}</span>
                                    </>
                                  ) : (
                                    <span style={{ color: 'var(--text-disabled)' }}>{t('challenge.casual')}</span>
                                  )}
                                </span>
                                {m.seasonPointsDelta != null && (
                                  <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                                    pts <span style={{ color: '#5FDBD3', fontWeight: 600 }}>+{m.seasonPointsDelta}</span>
                                  </span>
                                )}
                              </div>

                              {/* Phải: Dự đoán */}
                              <div
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                  background: isCorrect ? 'rgba(0,178,169,.12)' : 'rgba(225,68,52,.12)',
                                  border: `1px solid ${isCorrect ? 'rgba(0,178,169,.3)' : 'rgba(225,68,52,.3)'}`,
                                  font: "500 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: isCorrect ? '#8BEDE6' : '#FFB0A5',
                                }}
                              >
                                {t('matchVideo.predFormat', {
                                  pct: predPct,
                                  status: isCorrect ? t('matchVideo.predCorrect') : t('matchVideo.predWrong'),
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {searchResults.length === 0 && (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('matchSearch.emptySearch')}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 960 }}>
                {/* Header Cột */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 44px 62px 68px minmax(0,1fr) 88px minmax(0,1fr) 100px 98px 68px',
                    background: 'var(--surface-inset)',
                    borderBottom: '1px solid var(--border-subtle)',
                    font: "600 10px/1.2 'IBM Plex Sans', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ padding: '9px 0 9px 14px' }}>{t('matchVideo.colCode')}</div>
                  <div style={{ padding: '9px 2px' }} />
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colTime')}</div>
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colCourt')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colWinner')}</div>
                  <div style={{ padding: '9px 8px', textAlign: 'center' }}>{t('matchVideo.colScore')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colLoser')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('matchVideo.colPrediction')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('matchVideo.colVideo')}</div>
                  <div style={{ padding: '9px 14px 9px 6px', textAlign: 'right' }}>{t('matchVideo.colSource')}</div>
                </div>

                {/* Danh sách nhóm theo ngày */}
                {dayGroups.map((group) => (
                  <div key={group.dateKey}>
                    {/* Dòng Header Ngày */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minHeight: 36,
                        padding: '0 14px',
                        background: isDark ? 'rgba(0,178,169,.06)' : 'var(--surface-inset)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--text-accent)',
                        }}
                      />
                      <div style={{ font: "600 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-accent)' }}>
                        {group.dateLabel}
                      </div>
                      <div style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                        {t('matchVideo.subDaySummary', { range: group.timeRange, matches: group.totalMatches, videos: group.videoCount })}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,178,169,.25), rgba(0,178,169,0))' }} />
                      {group.durationText && (
                        <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                          {group.durationText}
                        </div>
                      )}
                    </div>

                    {/* Các dòng trận trong ngày */}
                    {group.matches.map((m) => {
                      const teamA = m.teamA || []
                      const teamB = m.teamB || []
                      const aWon = m.winnerTeam === 'A'
                      const winnerTeam = aWon ? teamA : teamB
                      const loserTeam = aWon ? teamB : teamA
                      const winnerNames = winnerTeam.map(shortNameOf).join(' · ')
                      const loserNames = loserTeam.map(shortNameOf).join(' · ')
                      const winnerFull = winnerTeam.map(memberNameOf).join(' · ')
                      const loserFull = loserTeam.map(memberNameOf).join(' · ')

                      const scoreSets = (m.sets || []).map(([a, b]) => ({
                        winPts: aWon ? a : b,
                        losePts: aWon ? b : a,
                      }))
                      const isMultiSet = scoreSets.length > 1
                      const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
                      const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0
                      const fullScoreStr = isMultiSet
                        ? `${winSetsCount}–${loseSetsCount} (${scoreSets.map((s) => `${s.winPts}-${s.losePts}`).join(', ')})`
                        : (scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '')

                      const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                      const isRated = m.ratingEnabled !== false
                      const winnerDeltaStr = isRated ? (winnerTeam.length > 1 ? `+${absDelta} · +${absDelta}` : `+${absDelta}`) : t('challenge.casual')
                      const loserDeltaStr = isRated ? (loserTeam.length > 1 ? `−${absDelta} · −${absDelta}` : `−${absDelta}`) : t('challenge.casual')

                      const isUpset = isUpsetMatch(m)
                      const isClose = isCloseMatch(m)
                      const isThreeSets = isThreeSetMatch(m)
                      const isStreak = (m.brokenStreak || 0) >= 3

                      const s = (db.sessions || []).find((x) => x.id === m.sessionId)
                      const courtObj = s?.courts?.[m.courtIdx]
                      const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                      const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                      const matchTime = m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (courtObj?.from || '19:00')
                      const matchCode = matchCodeOf(db, m)

                      // Vạch màu trái và background
                      let leftBorderColor = 'transparent'
                      let rowBg = 'transparent'
                      let tagLabel = t('matchVideo.tagCorrect')
                      let tagBg = 'var(--surface-inset)'
                      let tagColor = 'var(--text-secondary)'

                      if (isUpset) {
                        leftBorderColor = '#E14434'
                        rowBg = isDark ? 'rgba(225,68,52,.07)' : 'rgba(225,68,52,.05)'
                        tagLabel = t('matchVideo.tagUpset')
                        tagBg = isDark ? 'rgba(225,68,52,.24)' : 'var(--status-incident-bg)'
                        tagColor = isDark ? '#FFB0A5' : 'var(--status-incident-fg)'
                      } else if (isClose) {
                        leftBorderColor = '#E08A00'
                        rowBg = isDark ? 'rgba(224,138,0,.07)' : 'rgba(224,138,0,.05)'
                        tagLabel = t('matchVideo.tagClose')
                        tagBg = isDark ? 'rgba(224,138,0,.22)' : 'var(--status-delayed-bg)'
                        tagColor = isDark ? '#FFCB77' : 'var(--status-delayed-fg)'
                      } else if (isThreeSets) {
                        leftBorderColor = '#7C3AED'
                        rowBg = isDark ? 'rgba(124,58,237,.07)' : 'rgba(124,58,237,.05)'
                        tagLabel = t('matchVideo.tagThreeSets')
                        tagBg = isDark ? 'rgba(124,58,237,.22)' : 'var(--violet-100)'
                        tagColor = isDark ? '#C4B5FD' : 'var(--violet-700)'
                      } else if (isStreak) {
                        leftBorderColor = '#00B2A9'
                        rowBg = isDark ? 'rgba(0,178,169,.06)' : 'rgba(0,178,169,.04)'
                        tagLabel = t('matchVideo.tagStreak', { n: m.brokenStreak })
                        tagBg = isDark ? 'rgba(0,178,169,.22)' : 'var(--status-transit-bg)'
                        tagColor = isDark ? '#7FE6DF' : 'var(--status-transit-fg)'
                      }

                      const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                      const predPct = isUpset ? '34%' : isClose ? '52%' : '50%'
                      const hasVideo = Boolean(m.videoUrl)
                      const videoTagLabel = videoTagLabelOf(m)

                      return (
                        <div key={m.id} style={{ display: 'grid' }}>
                          <div
                            style={{
                              position: 'relative',
                              display: 'grid',
                              gridTemplateColumns: '50px 44px 62px 68px minmax(0,1fr) 88px minmax(0,1fr) 100px 98px 68px',
                              alignItems: 'center',
                              minHeight: 50,
                              borderBottom: '1px solid var(--border-subtle)',
                              background: rowBg,
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Vạch màu bên trái 2px */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: leftBorderColor,
                              }}
                            />

                            {/* Cột 1: Mã */}
                            <div style={{ padding: '0 0 0 14px' }}>
                              <button
                                type="button"
                                onClick={() => setViewingMatch(m)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  font: "600 11.5px/1.3 'IBM Plex Mono', monospace",
                                  color: 'var(--text-accent)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                                title={t('matchDetail.title')}
                              >
                                {matchCode}
                              </button>
                            </div>

                            {/* Cột 2: Sửa */}
                            <div style={{ padding: '0 2px' }}>
                              <button
                                type="button"
                                onClick={() => setEditingMatch(m)}
                                style={{
                                  height: 22,
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 8px',
                                  borderRadius: 5,
                                  background: 'var(--surface-raised)',
                                  border: '1px solid var(--border-default)',
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                              >
                                {t('matchSearch.btnEdit')}
                              </button>
                            </div>

                            {/* Cột 3: Giờ + khoảng cách */}
                            <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                                {matchTime}
                              </span>
                              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                                {m.gapText || '+0′'}
                              </span>
                            </div>

                            {/* Cột 4: Sân (click navigate buổi & trận) */}
                            <div style={{ padding: '0 6px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s?.id ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/buoi-tap/${s.id}?tab=matches&matchId=${m.id}`)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    font: "400 11.5px/1.3 'IBM Plex Mono', monospace",
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    textDecoration: 'none',
                                  }}
                                  title={`${venue?.name || ''} · ${t('pages.sessions.title')}`}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-accent)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                                >
                                  {courtLabel || t('session.courtNum', { n: 1 })}
                                </button>
                              ) : (
                                <span style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                                  {courtLabel || t('session.courtNum', { n: 1 })}
                                </span>
                              )}
                            </div>

                            {/* Cột 5: Đội thắng */}
                            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span title={winnerFull}>{winnerNames}</span>
                              </span>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-delivered-fg)' }}>
                                {winnerDeltaStr}
                              </span>
                            </div>

                            {/* Cột 6: Tỷ số */}
                            <div style={{ padding: '0 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ font: "600 16px/1 'IBM Plex Mono', monospace" }}>
                                <span style={{ color: 'var(--text-accent)' }}>
                                  {isMultiSet ? winSetsCount : (scoreSets.length > 0 ? scoreSets[0].winPts : 21)}
                                </span>
                                <span style={{ color: 'var(--text-muted)', padding: '0 3px' }}>–</span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {isMultiSet ? loseSetsCount : (scoreSets.length > 0 ? scoreSets[0].losePts : 19)}
                                </span>
                              </div>
                              {isMultiSet && (
                                <div
                                  style={{
                                    font: "500 10.5px/1.2 'IBM Plex Mono', monospace",
                                    color: 'var(--text-muted)',
                                    marginTop: 3,
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={scoreSets.map((s) => `${s.winPts}–${s.losePts}`).join(', ')}
                                >
                                  {scoreSets.map((s) => `${s.winPts}:${s.losePts}`).join(' ')}
                                </div>
                              )}
                            </div>

                            {/* Cột 7: Đội thua */}
                            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: "500 12.5px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span title={loserFull}>{loserNames}</span>
                              </span>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-incident-fg)' }}>
                                {loserDeltaStr}
                              </span>
                            </div>

                            {/* Cột 8: Dự đoán */}
                            <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                                {predPct}
                              </span>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: tagBg,
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: tagColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tagLabel}
                              </span>
                            </div>

                            {/* Cột 9: Video */}
                            <div style={{ padding: '0 6px', display: 'flex', justifyContent: 'center' }}>
                              {hasVideo ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPlayingVideoMatch(m)
                                  }}
                                  style={{
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '0 9px',
                                    borderRadius: 999,
                                    background: isDark ? 'rgba(225,68,52,.14)' : 'var(--status-incident-bg)',
                                    border: '1px solid',
                                    borderColor: isDark ? 'rgba(225,68,52,.45)' : 'var(--red-500)',
                                    font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                    color: isDark ? '#FF9A8F' : 'var(--status-incident-fg)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={m.videoUrl}
                                >
                                  <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace" }}>▶</span>
                                  <span>{videoTagLabel}</span>
                                  {Number(m.videoViews) > 0 && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: 0.85, fontSize: 10, marginLeft: 2 }}>
                                      <Icon name="eye" size={10} />
                                      <span>{m.videoViews}</span>
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setExpandedVideoMatchId((prev) => (prev === m.id ? null : m.id))}
                                  style={{
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '0 9px',
                                    borderRadius: 999,
                                    border: '1px dashed var(--border-default)',
                                    background: 'transparent',
                                    font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {t('matchVideo.btnAttach')}
                                </button>
                              )}
                            </div>

                            {/* Cột 10: Nguồn */}
                            <div style={{ padding: '0 14px 0 6px', textAlign: 'right', font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                              {isChallenge ? t('challenge.challenge') : t('challenge.fromCourt')}
                            </div>
                          </div>

                          {/* Dòng Inline Expander gắn Video */}
                          {expandedVideoMatchId === m.id && (
                            <MatchVideoInlineExpander
                              match={m}
                              matchCode={matchCode}
                              timeStr={matchTime}
                              courtVenueStr={`${courtLabel} · ${venue?.name || ''}`}
                              teamText={`${winnerFull} vs ${loserFull}`}
                              scoreText={fullScoreStr}
                              lockCount={isAdmin ? 0 : matchVideosOf(m).length}
                              onSave={(videoData) => {
                                a.attachMatchVideo(m.id, videoData)
                                setExpandedVideoMatchId(null)
                              }}
                              onCancel={() => setExpandedVideoMatchId(null)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {searchResults.length === 0 && (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('matchSearch.emptySearch')}
                  </div>
                )}
              </div>
            </div>
          )}

            {/* Footer Bảng: Phân trang / Xem thêm */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '11px 14px',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                {t('common.showingOf', { n: Math.min(searchCardLimit, searchResults.length), total: searchResults.length })}
              </div>
              {searchResults.length > searchCardLimit && (
                <button
                  type="button"
                  onClick={() => setSearchCardLimit((prev) => prev + 10)}
                  style={{
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 7,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-default)',
                    font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {t('matchSearch.viewMoreMatches', { n: Math.min(10, searchResults.length - searchCardLimit) })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MA TRẬN ĐỐI ĐẦU H2H (MATRIX) - 100% NGUYÊN BẢN LEADERBOARD CŨ */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
          gap: 16,
          alignItems: 'start',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
        }}>
          {/* Cột trái: Ma trận */}
          <div style={{ ...S.card, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '14px 16px', gap: 10 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={S.cardTitle}>{t('matchSearch.matrixTitle')}</div>
                <div style={S.cardSub}>
                  {matrixMemberLimit === 5
                    ? t('matchSearch.matrixSubMobile5')
                    : matrixMemberLimit === 999
                      ? t('matchSearch.matrixHeaderSub', { count: activeMembers.length })
                      : t('matchSearch.matrixSubTopN', { count: matrixMemberLimit })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  padding: 2,
                  borderRadius: 6,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                }}>
                  {[5, 8, 12, 999].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setMatrixMemberLimit(limit)}
                      style={{
                        padding: isMobile ? '4px 7px' : '4px 9px',
                        borderRadius: 4,
                        border: 'none',
                        background: matrixMemberLimit === limit ? 'var(--surface-card)' : 'transparent',
                        color: matrixMemberLimit === limit ? 'var(--text-primary)' : 'var(--text-muted)',
                        font: "600 11px/1 'IBM Plex Sans', sans-serif",
                        cursor: 'pointer',
                        boxShadow: matrixMemberLimit === limit ? 'var(--shadow-xs)' : 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {limit === 999 ? t('matchSearch.clubAll') : limit}
                    </button>
                  ))}
                </div>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(0,178,169,.18)',
                  color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.matrixReadByRow')}
                </span>
              </div>
            </div>

            <div style={{
              padding: isMobile ? '12px 14px' : 16,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              minWidth: 0,
              maxWidth: '100%',
            }}>
              <table style={{
                borderCollapse: 'separate',
                borderSpacing: isMobile ? '4px 4px' : 0,
                width: isMobile ? 'auto' : '100%',
                minWidth: 'max-content',
                fontSize: isMobile ? 12 : 13,
              }}>
                <thead>
                  <tr>
                    <th style={{
                      ...S.matrixTh,
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      background: 'var(--surface-card)',
                      boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                      width: isMobile ? 44 : 110,
                      minWidth: isMobile ? 44 : 110,
                      maxWidth: isMobile ? 48 : 130,
                      padding: isMobile ? '6px 4px' : '8px 10px',
                      border: isMobile ? 'none' : '1px solid var(--border-subtle)',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}>
                      VS
                    </th>
                    {topMembersForMatrix.map((m) => (
                      <th
                        key={m.id}
                        title={m.name}
                        style={{
                          ...S.matrixTh,
                          minWidth: isMobile ? 52 : 56,
                          maxWidth: isMobile ? 56 : 70,
                          padding: isMobile ? '6px 2px' : '8px 4px',
                          border: isMobile ? 'none' : '1px solid var(--border-subtle)',
                          font: isMobile ? '600 11px/1.2 "IBM Plex Sans", sans-serif' : '600 11.5px/1.2 "IBM Plex Sans", sans-serif',
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          whiteSpace: isMobile ? 'nowrap' : 'normal',
                          wordBreak: 'break-word',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {getShortDisplayName(m.name, topMembersForMatrix)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topMembersForMatrix.map((p1) => (
                    <tr key={p1.id}>
                      <td
                        title={p1.name}
                        style={{
                          ...S.matrixRowLabel,
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          background: 'var(--surface-card)',
                          boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                          width: isMobile ? 44 : 110,
                          minWidth: isMobile ? 44 : 110,
                          maxWidth: isMobile ? 48 : 130,
                          padding: isMobile ? '6px 4px' : '8px 10px',
                          border: isMobile ? 'none' : '1px solid var(--border-subtle)',
                          font: isMobile ? '600 13px/1.2 "IBM Plex Sans", sans-serif' : '600 12.5px/1.2 "IBM Plex Sans", sans-serif',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {getShortDisplayName(p1.name, topMembersForMatrix)}
                      </td>
                      {topMembersForMatrix.map((p2) => {
                        if (p1.id === p2.id) {
                          return (
                            <td
                              key={p2.id}
                              style={{
                                ...S.matrixSelfCell,
                                ...(isMobile ? {
                                  width: 52,
                                  minWidth: 52,
                                  height: 38,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: isDark ? '#0B1220' : 'var(--surface-inset)',
                                  color: isDark ? '#2E3E5C' : 'var(--text-disabled)',
                                  font: '600 12px/1 "IBM Plex Mono", monospace',
                                  padding: 0,
                                } : {})
                              }}
                            >
                              —
                            </td>
                          )
                        }
                        const cell = matrixData[p1.id]?.[p2.id] || { wins: 0, losses: 0 }
                        const net = cell.wins - cell.losses
                        const total = cell.wins + cell.losses
                        const isDisparate = Math.abs(net) >= 4
                        const cellColor = net > 0
                          ? (isDark ? '#5FD9A2' : 'var(--status-delivered-fg)')
                          : net < 0
                            ? (isDark ? '#FF9A8F' : 'var(--status-incident-fg)')
                            : 'var(--text-muted)'
                        const cellBg = net > 0
                          ? 'rgba(18,168,103,.18)'
                          : net < 0
                            ? 'rgba(225,68,52,.18)'
                            : isMobile ? 'var(--surface-inset)' : 'transparent'
                        const borderStyle = isMobile
                          ? (isDisparate
                            ? (net > 0 ? (isDark ? '1.5px solid #5FD9A2' : '1.5px solid var(--status-delivered-fg)') : (isDark ? '1.5px solid #FF9A8F' : '1.5px solid var(--status-incident-fg)'))
                            : 'none')
                          : (isDisparate
                            ? (net > 0 ? '2px solid #5FD9A2' : '2px solid #FF9A8F')
                            : '1px solid var(--border-subtle)')

                        return (
                          <td
                            key={p2.id}
                            onClick={() => {
                              if (total > 0) {
                                setPlayerA(p1.id)
                                setPlayerB(p2.id)
                                setSearchMode('vs')
                                setActiveTab('search')
                              }
                            }}
                            title={total > 0 ? `${p1.name} vs ${p2.name}: ${cell.wins}-${cell.losses} (${t('matchSearch.title')})` : undefined}
                            style={{
                              ...S.matrixCell,
                              color: cellColor,
                              background: cellBg,
                              border: borderStyle,
                              cursor: total > 0 ? 'pointer' : 'default',
                              transition: 'all 0.15s ease',
                              padding: isMobile ? '0' : '6px 8px',
                              ...(isMobile ? {
                                width: 52,
                                minWidth: 52,
                                height: 38,
                                borderRadius: 6,
                              } : {}),
                            }}
                          >
                            {isMobile ? (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                font: '600 12px/1 "IBM Plex Mono", monospace',
                              }}>
                                {total > 0 ? `${cell.wins}-${cell.losses}` : '—'}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <span style={{ font: '600 13px/1 "IBM Plex Mono", monospace' }}>{cell.wins}-{cell.losses}</span>
                                {total > 0 && (
                                  <span style={{ font: '400 10px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                                    {total}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend underneath matrix */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 14,
                flexWrap: 'wrap',
                font: '400 12px/1.3 "IBM Plex Mono", monospace',
                color: 'var(--text-muted)',
              }}>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(18,168,103,.18)',
                  color: isDark ? '#5FD9A2' : 'var(--status-delivered-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.legendMoreWins')}
                </span>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(225,68,52,.18)',
                  color: isDark ? '#FF9A8F' : 'var(--status-incident-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.legendMoreLosses')}
                </span>
                {!isMobile && (
                  <span style={{
                    font: '600 10px/1 "IBM Plex Sans", sans-serif',
                    padding: '5px 9px',
                    borderRadius: 999,
                    background: 'var(--surface-inset)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('matchSearch.legendBalanced')}
                  </span>
                )}
                <span>{t('matchSearch.matrixReadByRow')}</span>
                {!isMobile && (
                  <span style={{ font: '400 12px/1.4 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    {t('matchSearch.legendDisparateBorder')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cột phải / Dưới: 2 Thẻ (Đáng chú ý & Chưa gặp nhau) */}
          <div style={{
            display: 'grid',
            gap: 14,
            alignContent: 'start',
            minWidth: 0,
            maxWidth: '100%',
            position: isMobile ? 'static' : 'sticky',
            top: 16,
            maxHeight: isMobile ? 'none' : 'calc(100vh - 140px)',
            overflowY: isMobile ? 'visible' : 'auto',
            paddingRight: 2,
          }}>
            {/* Card 1: Đáng chú ý / Cặp lệch nhất */}
            <div style={{ ...S.card, minWidth: 0, maxWidth: '100%' }}>
              <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={isMobile ? { font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' } : S.cardTitle}>
                    {isMobile ? t('matchSearch.notableTitle') : t('matchSearch.disparateTitle')}
                  </div>
                  {!isMobile && <div style={S.cardSub}>{t('matchSearch.disparateSub')}</div>}
                </div>
              </div>
              <div style={{ padding: isMobile ? '12px 14px' : '10px 12px', display: 'grid', gap: 6 }}>
                {disparatePairsList.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('common.noData')}
                  </div>
                ) : (
                  disparatePairsList.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setPlayerA(item.player1.id)
                        setPlayerB(item.player2.id)
                        setSearchMode('vs')
                        setActiveTab('search')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: isMobile ? '10px 12px' : '8px 10px',
                        borderRadius: 8,
                        background: 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-500)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                      title={`${item.player1.name} · ${item.player2.name}`}
                    >
                      <span style={{ flex: 1, minWidth: 0, font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('matchSearch.cardH2HTitle', { nameA: item.player1.name, nameB: item.player2.name })}
                      </span>
                      <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.total} {t('units.match')}
                      </span>
                      <span style={{
                        font: '600 13px/1.3 "IBM Plex Mono", monospace',
                        color: item.wins > item.losses
                          ? (isDark ? '#5FD9A2' : 'var(--status-delivered-fg)')
                          : (isDark ? '#FF9A8F' : 'var(--status-incident-fg)'),
                        whiteSpace: 'nowrap',
                      }}>
                        {item.wins}-{item.losses}
                      </span>
                    </div>
                  ))
                )}
                <span style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('matchSearch.tapCellHint')}
                </span>
              </div>
            </div>

            {/* Card 2: Chưa gặp nhau */}
            <div style={{ ...S.card, minWidth: 0, maxWidth: '100%' }}>
              <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={S.cardTitle}>{t('matchSearch.neverMet')}</div>
                  <div style={S.cardSub}>{t('matchSearch.neverMetSub')}</div>
                </div>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(224,138,0,.18)',
                  color: 'var(--status-delayed-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {neverMetSessionScored.length} {t('matchSearch.pairs')}
                </span>
              </div>
              <div style={{ padding: isMobile ? '12px 14px' : '10px 12px', display: 'grid', gap: 6 }}>
                {neverMetSessionScored.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('common.noData')}
                  </div>
                ) : (
                  neverMetSessionScored.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: isMobile ? '10px 12px' : '8px 10px',
                        borderRadius: 8,
                        background: 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={`${item.p1.name} · ${item.p2.name}`}>{item.p1.name} · {item.p2.name}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap' }}>
                          {t('matchSearch.commonSessions', { count: item.commonSessions })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setInitialTeamA([item.p1.id])
                            setInitialTeamB([item.p2.id])
                            setChallengeModalOpen(true)
                          }}
                          style={{
                            border: '1px solid var(--border-default)',
                            background: 'var(--surface-card)',
                            color: 'var(--status-transit-fg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            font: '600 11px/1 "IBM Plex Sans", sans-serif',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title={t('challenge.challenge')}
                        >
                          <Icon name="target" size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <span style={{ font: '400 12px/1.35 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('matchSearch.neverMetPriorityNotice')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Modal xem video trận đấu trực tiếp */}
      {playingVideoMatch && (
        <VideoPlayerModal
          match={playingVideoMatch}
          matchCode={matchCodeOf(db, playingVideoMatch)}
          onClose={() => setPlayingVideoMatch(null)}
        />
      )}

      {/* Modal chi tiết trận đấu */}
      {viewingMatch && (
        <MatchDetailModal
          match={viewingMatch}
          onClose={() => {
            setViewingMatch(null)
            if (searchParams.get('matchId')) {
              const next = new URLSearchParams(searchParams)
              next.delete('matchId')
              setSearchParams(next, { replace: true })
            }
          }}
          onEdit={(m) => {
            setViewingMatch(null)
            setEditingMatch(m)
          }}
        />
      )}

      {/* Modal sửa điểm inline */}
      {editingMatch && (
        <EditScoreModal
          match={editingMatch}
          allMatches={searchResults}
          onNavigateMatch={(nextM) => setEditingMatch(nextM)}
          onClose={() => setEditingMatch(null)}
          onSaved={() => setEditingMatch(null)}
        />
      )}

      {/* Modal tạo kèo / gạ kèo */}
      {challengeModalOpen && (
        <CreateChallengeModal
          onClose={() => setChallengeModalOpen(false)}
          onCreated={() => setChallengeModalOpen(false)}
          initialTeamA={initialTeamA}
          initialTeamB={initialTeamB}
        />
      )}

      {/* Modal gắn link video */}
      {attachVideoMatch && (
        <AttachVideoModal
          match={attachVideoMatch}
          matchCode={matchCodeOf(db, attachVideoMatch)}
          onClose={() => setAttachVideoMatch(null)}
          onSaved={() => setAttachVideoMatch(null)}
        />
      )}

      {/* Modal chọn buổi chơi cho kèo */}
      {selectingSessionChallenge && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectingSessionChallenge(null)}
          title={t('challenge.linkSessionModalTitle', { code: selectingSessionChallenge.code })}
          maxWidth={460}
        >
          <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
            <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>
              {t('challenge.linkSessionModalDesc')}
            </div>

            {availableSessions.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('challenge.noAvailableSessions')}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {availableSessions.map((s) => {
                  const isOpen = s.status === 'open'
                  const isCurrent = selectingSessionChallenge.sessionId === s.id
                  // Chỉ mỗi ngày thì không đủ để chọn: cùng một tuần có mấy buổi, phải biết
                  // giờ nào, mấy sân, đã có ai đi chưa.
                  const attendN = presentCount(db, s)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const ok = a.linkChallengeToSession(selectingSessionChallenge.id, s.id)
                        if (ok !== false) {
                          setSelectingSessionChallenge(null)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: isCurrent ? 'rgba(0, 178, 169, 0.12)' : 'var(--surface-card)',
                        border: `1px solid ${isCurrent ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ font: '600 14px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
                            {wd(s.date)} · {t('challenge.sessionItemDate', { date: dd(s.date) })}
                          </span>
                          {isOpen ? (
                            <span style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'rgba(0, 178, 169, 0.15)',
                              color: 'var(--teal-500)',
                              fontWeight: 600,
                            }}>
                              {t('challenge.sessionStatusOpen')}
                            </span>
                          ) : s.status === 'closed' ? (
                            <span style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'rgba(224, 138, 0, 0.15)',
                              color: 'var(--status-delayed-fg)',
                              fontWeight: 600,
                            }}>
                              {t('sessionState.closed')}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'var(--surface-sunken)',
                              color: 'var(--text-muted)',
                              fontWeight: 600,
                            }}>
                              {t(`sessionState.${s.status}`)}
                            </span>
                          )}
                          {isCurrent && (
                            <span style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'var(--surface-sunken)',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}>
                              {t('challenge.sessionStatusCurrent')}
                            </span>
                          )}
                        </div>
                        <div style={{ font: '400 12px/1.3 var(--font-sans)', color: 'var(--text-muted)' }}>
                          {t('challenge.sessionItemMeta', { time: timeTxt(s), courts: courtTxt(db, s) })}
                        </div>
                        <div style={{ font: '400 12px/1.3 var(--font-sans)', color: attendN > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                          {attendN > 0
                            ? t('challenge.sessionItemAttend', { n: attendN })
                            : t('challenge.sessionItemNoAttend')}
                        </div>
                        {s.title && (
                          <div style={{ font: '400 12px/1.3 var(--font-sans)', color: 'var(--text-muted)' }}>
                            {s.title}
                          </div>
                        )}
                      </div>
                      <Icon name="arrow-right" size={16} color="var(--text-secondary)" />
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              {selectingSessionChallenge.sessionId && (
                <button
                  type="button"
                  onClick={() => {
                    const ok = a.linkChallengeToSession(selectingSessionChallenge.id, null)
                    if (ok !== false) {
                      setSelectingSessionChallenge(null)
                    }
                  }}
                  style={{
                    ...S.smallGhostBtn,
                    color: 'var(--status-incident-fg)',
                    borderColor: 'rgba(225,68,52,0.3)',
                    marginRight: 'auto',
                  }}
                >
                  <Icon name="unlink" size={14} />
                  <span>{t('challenge.btnUnlinkSession')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectingSessionChallenge(null)}
                style={S.smallGhostBtn}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal chi tiết/thao tác kèo */}
      {viewingChallenge && (
        <ChallengeDetailModal
          challenge={(db.challenges || []).find((c) => c.id === viewingChallenge.id) || viewingChallenge}
          session={(db.sessions || []).find((s) => s.id === ((db.challenges || []).find((c) => c.id === viewingChallenge.id) || viewingChallenge).sessionId)}
          onClose={() => setViewingChallenge(null)}
          onScoreInput={(c) => {
            setViewingChallenge(null)
            setScoringChallenge(c)
          }}
          onOpenMatch={(m) => {
            setViewingChallenge(null)
            setViewingMatch(m)
          }}
        />
      )}

      {/* Modal ghi điểm cho kèo */}
      {scoringChallenge && (
        <ScoreModal
          challenge={scoringChallenge}
          session={(db.sessions || []).find((s) => s.id === scoringChallenge.sessionId)}
          onClose={() => setScoringChallenge(null)}
          onSaved={() => setScoringChallenge(null)}
        />
      )}
    </div>
  )
}

/**
 * Menu ⋯ cho các thao tác phụ trên card kèo.
 *
 * Tự viết vì bộ DS (`components/ds/`, VENDORED — không sửa tay) không có dropdown. Bắt click ra
 * ngoài bằng một lớp phủ trong suốt thay vì nghe `document`: không phải dọn listener, và không
 * đụng tới các lớp z-index khác của trang.
 */
function CardMenu({ items }) {
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null
  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        type="button"
        aria-label={t('common.more')}
        title={t('common.more')}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        style={{ ...S.smallGhostBtn, padding: '0 8px' }}
      >
        <Icon name="ellipsis" size={14} />
      </button>
      {open && (
        <>
          <div
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 41,
              minWidth: 178,
              display: 'grid',
              gap: 2,
              padding: 4,
              borderRadius: 8,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.18))',
            }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: it.danger ? 'var(--red-500, #ef4444)' : 'var(--text-primary)',
                  font: '500 12.5px/1 var(--font-sans)',
                  whiteSpace: 'nowrap',
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

/**
 * Hàng chọn một trong popover Bộ lọc (tab Lịch sử). Ô chia đều, nhiều lựa chọn (danh sách sân)
 * thì tự xuống dòng thay vì tràn ngang.
 */
function FilterSeg({ options, value, onChange }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
        gap: 4,
        padding: 3,
        borderRadius: 8,
        background: 'var(--field-bg)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            title={o.label}
            onClick={() => onChange(o.value)}
            style={{
              height: 30,
              minWidth: 0,
              padding: '0 8px',
              borderRadius: 6,
              border: 'none',
              background: on ? 'var(--surface-card)' : 'transparent',
              boxShadow: on ? 'var(--shadow-xs)' : 'none',
              font: `${on ? 600 : 500} 12px/1 var(--font-sans)`,
              color: on ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const S = {
  page: {
    width: '100%',
    minWidth: 0,
    display: 'grid',
    gap: 16,
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  h1: {
    font: '700 22px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  hint: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  tabTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '2px 0',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text-secondary)',
    font: '600 13px/1 var(--font-sans)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--surface-card)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-xs)',
  },
  tabBadgeMono: {
    font: '600 11px/1 var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 999,
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  },
  subTabWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    overflowX: 'auto',
    maxWidth: '100%',
  },
  subTabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 6,
    font: '500 12.5px/1 var(--font-sans)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  subTabCount: {
    font: '600 11px/1 var(--font-mono)',
  },
  challengeCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 10,
    padding: '13px 14px',
    display: 'grid',
    gap: 8,
    boxShadow: 'var(--shadow-xs)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg)',
  },
  sessionBadge: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)',
  },
  casualBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  },
  challengeBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(168,85,247,.16)',
    color: '#D8B4FE',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid',
  },
  teamName: {
    font: '600 13.5px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  teamRatingMono: {
    font: '400 11.5px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  vsText: {
    font: '700 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    padding: '0 6px',
  },
  warnBox: {
    fontSize: 11.5,
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(240,183,92,0.12)',
    border: '1px solid rgba(240,183,92,0.3)',
    color: 'var(--status-delayed-fg)',
  },
  smallPrimaryBtn: {
    height: 28,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 11px',
    borderRadius: 6,
    background: 'var(--action-primary-bg)',
    color: '#FFFFFF',
    font: '600 12px/1 var(--font-sans)',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  smallSecondaryBtn: {
    height: 28,
    whiteSpace: 'nowrap',
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
    whiteSpace: 'nowrap',
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
    whiteSpace: 'nowrap',
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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 2px',
    marginBottom: 12,
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionLabel: {
    font: '600 13px/1.2 var(--font-sans)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sectionCount: {
    font: '600 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--surface-sunken)',
    padding: '2px 7px',
    borderRadius: 999,
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
    gridColumn: '1 / -1',
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

  // -------------------------------------------------------------
  // STYLES GỐC TỪ LEADERBOARD CŨ CHO TAB SEARCH VÀ MATRIX
  // -------------------------------------------------------------
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  statCardBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    padding: '14px 16px',
    display: 'grid',
    gap: 6,
    alignContent: 'start',
  },
  statCardLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statCardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  searchTableHead: {
    display: 'grid',
    gridTemplateColumns: '96px 165px 1.15fr 76px 1.15fr 88px 84px',
    background: 'var(--surface-inset)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  searchTableRow: {
    display: 'grid',
    gridTemplateColumns: '96px 165px 1.15fr 76px 1.15fr 88px 84px',
    borderBottom: '1px solid var(--border-subtle)',
    minHeight: 52,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  thCell: {
    padding: '0 12px',
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  tdCell: {
    padding: '0 12px',
  },
  monoMeta: {
    font: '400 12px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
  },
  sourcePill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
  },
  editBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    color: 'var(--status-transit-fg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  contextCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: 4,
  },
  contextCardBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 13px',
    borderRadius: 8,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
  contextCardLabel: {
    font: '600 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  contextHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  contextScore: {
    font: '700 20px/1.2 "IBM Plex Mono", monospace',
    color: 'var(--text-primary)',
  },
  contextMeta: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  matrixTable: {
    borderCollapse: 'collapse',
    fontSize: 13,
    width: '100%',
  },
  matrixTh: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-inset)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textAlign: 'center',
  },
  matrixRowLabel: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-inset)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  matrixCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 600,
  },
  matrixSelfCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    color: 'var(--text-disabled)',
    background: 'var(--surface-page)',
  },
  pairBadge: {
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  bucketCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  bucketHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  challengeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
    color: 'var(--gray-0)',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-xs)',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  bountyBanner: {
    padding: '14px 18px',
    borderRadius: 8,
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  bountyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  bountyTitle: {
    font: '700 14px "IBM Plex Sans", sans-serif',
    color: 'var(--status-delayed-fg)',
  },
  bountyBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--status-delayed-fg)',
    color: 'var(--status-delayed-fg)',
    fontSize: 11,
    fontWeight: 700,
  },
  bountyDesc: {
    fontSize: 12.5,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  h2hScoreBig: {
    padding: '14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
  },
  h2hStatsBox: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: 6,
  },
  h2hStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}
