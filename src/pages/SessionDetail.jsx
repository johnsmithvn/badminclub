// Chi tiết buổi: điểm danh · sân buổi này · khách giao lưu · chốt tiền (handoff 02 §3).
// Nút "Chốt buổi" là hành động primary DUY NHẤT của trang.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Icon, IconButton, Input, Select } from '#ds'
import { EditGuestDialog, Empty, GenderSegment, LevelChip, Mono, SearchSelect, SessionPill, TabTrack } from '#ui'
import CourtAssignmentTab from '#components/session/CourtAssignmentTab.jsx'
import SessionPlannerTab from '#components/session/planner/SessionPlannerTab.jsx'
import PlannerAddWishDialog from '#components/session/planner/PlannerAddWishDialog.jsx'
import SessionMatchesTab from '#components/session/SessionMatchesTab.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { dd, ddmy, monthOf, wd } from '#utils/dates.js'
import {
  courtOf, dueState, duesOf,
  fmt, fmtK, genderTxt, groupMembers, groupOf, guestOf, guestPrice, headCount, levelOf,
  isAdhoc, isMemberCharge, memberOf, presentCount, rowCost, sGuests, sGuestsOnly, sessionMembers,
  sessionOf, normalizeText, guestStats, myMember,
  shortName,
} from '#lib/money.js'
import { addCourtForm, guestForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { sortAttendanceMembers } from '#lib/members.js'
import { t } from '#i18n'
import NotificationBell from '#components/notification/NotificationBell.jsx'

function SelfAttendanceCard({ s, db, a, isMobile, isClosed }) {
  const { isDark } = useTheme()
  const myMem = myMember(db)
  if (!myMem) return null

  const myId = myMem.id
  const month = monthOf(s.date)
  const isFixedMember = groupMembers(db, s.groupId, month).some((m) => m.id === myId)
  const myAtt = (db.attendance?.[s.id] || {})[myId]

  const statusLabel =
    myAtt === true
      ? t('attend.present')
      : myAtt === false
      ? t('attend.absent')
      : myAtt === 'extra'
      ? t('attend.extra')
      : t('attend.unmarked')

  const statusColor =
    myAtt === true
      ? (isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)')
      : myAtt === false
      ? '#EF4444'
      : myAtt === 'extra'
      ? '#3B82F6'
      : 'var(--text-muted, #9ca3af)'

  const statusBg =
    myAtt === true
      ? (isDark ? 'rgba(0, 178, 169, 0.12)' : 'var(--surface-accent-soft, rgba(0, 178, 169, 0.12))')
      : myAtt === false
      ? 'rgba(239, 68, 68, 0.12)'
      : myAtt === 'extra'
      ? 'rgba(59, 130, 246, 0.12)'
      : 'var(--surface-sunken)'

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        backgroundColor: 'var(--surface-card, #171717)',
        border: '1px solid rgba(0, 245, 212, 0.25)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: 'rgba(0, 245, 212, 0.1)',
            color: 'var(--teal-400, #00F5D4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="clipboard-check" size={18} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('attend.selfCheckinTitle')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {t('attend.myStatus')}:{' '}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: statusBg,
                color: statusColor,
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {!isClosed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isFixedMember ? (
            <>
              <Button
                variant={myAtt === true ? 'primary' : 'secondary'}
                size="sm"
                icon="check"
                onClick={() => a.memberSelfCheckin(s.id, 'present')}
                style={{ height: 32, fontSize: 12 }}
              >
                {t('attend.btnPresent')}
              </Button>
              <Button
                variant={myAtt === false ? 'danger' : 'ghost'}
                size="sm"
                icon="x"
                onClick={() => a.memberSelfCheckin(s.id, 'absent')}
                style={{ height: 32, fontSize: 12 }}
              >
                {t('attend.btnAbsent')}
              </Button>
            </>
          ) : (
            <>
              {myAtt === 'extra' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="x"
                  onClick={() => a.memberSelfCheckin(s.id, 'removeExtra')}
                  style={{ height: 32, fontSize: 12, color: '#EF4444' }}
                >
                  {t('attend.btnCancelExtra')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => a.memberSelfCheckin(s.id, 'extra')}
                  style={{ height: 32, fontSize: 12 }}
                >
                  {t('attend.btnExtra')}
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('attend.sessionClosedHint')}
        </div>
      )}
    </div>
  )
}

export default function SessionDetail() {
  const { db, a } = useApp()
  const { isDark } = useTheme()
  const isMobile = useMobile(768)
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [tabState, setTabState] = useState(tabFromUrl || 'attend')
  const activeTab = tabFromUrl || tabState
  const setActiveTab = (tab) => {
    setTabState(tab)
    setSearchParams({ tab }, { replace: true })
  }
  const [editingGuest, setEditingGuest] = useState(null)
  const sid = id || db.sessionId
  const s = sessionOf(db, sid)

  const me = myMember(db)
  const [showMyWishDialog, setShowMyWishDialog] = useState(false)
  const myWish = useMemo(
    () => (s?.planner?.wishes || []).find((w) => w.memberId === me?.id),
    [s?.planner?.wishes, me?.id]
  )
  const wishPlayers = useMemo(() => {
    if (!s) return []
    return sessionMembers(db, s).map((m) => ({
      key: m.id,
      name: m.name,
      gender: m.gender,
      avatarUrl: m.avatarUrl,
    }))
  }, [db, s])

  // URL là nguồn sự thật; đồng bộ vào db để action dùng db.sessionId.
  useEffect(() => { if (sid) a.setSessionId(sid) }, [sid, a])

  if (!s) {
    return (
      <Card padding="0">
        <Empty icon="calendar-days" title={t('session.emptyTitle')} hint={t('session.emptyHint')} />
      </Card>
    )
  }

  const role = db.viewAs || 'owner'
  const canEdit = can(role, 'sessions')
  const canMoney = can(role, 'money')
  const month = s.date.slice(0, 7)
  const group = groupOf(db, s.groupId)
  // Cố định của nhóm + người đi thêm hôm nay. Người đi thêm trả tiền theo ĐƠN GIÁ MỘT BUỔI
  // của nhóm, không phải giá khách — họ là người nhà, xem tab Đối chiếu ở Công nợ.
  const att = db.attendance[s.id] || {}
  const [sortKey, setSortKey] = useState(0)

  // Thứ tự thành viên được tính ban đầu (hoặc khi người dùng chủ động bấm "Gom nhóm").
  // Trong quá trình bấm đổi trạng thái điểm danh, thứ tự được giữ cố định để không bị nhảy vị trí.
  const orderedMemberIds = useMemo(() => {
    return sortAttendanceMembers(sessionMembers(db, s), att).map((m) => m.id)
  }, [s.id, sortKey])

  const currentMembers = sessionMembers(db, s)
  const memberMap = useMemo(() => new Map(currentMembers.map((m) => [m.id, m])), [currentMembers])
  const members = useMemo(() => {
    const sorted = orderedMemberIds.map((mid) => memberMap.get(mid)).filter(Boolean)
    const existing = new Set(orderedMemberIds)
    const rest = currentMembers.filter((m) => !existing.has(m.id))
    return [...sorted, ...rest]
  }, [orderedMemberIds, memberMap, currentMembers])
  // Khối "Khách giao lưu" chỉ liệt kê khách NGOÀI CLB. Dòng thu của thành viên đi buổi đột xuất
  // nằm trong bảng điểm danh, ngay cạnh tên họ — không tách ra hai chỗ cho cùng một người.
  const guests = sGuestsOnly(db, s.id)
  const adhoc = isAdhoc(s)
  const charges = sGuests(db, s.id).filter(isMemberCharge)
  const dues = duesOf(db, month)

  const allSold = (s.courts || []).length > 0 && (s.courts || []).every((court) => court.sold)
  const isCancelled = s.status === 'cancelled'
  const isClosed = s.status === 'closed'
  const isInactive = allSold || isCancelled

  const sessionMatches = (db.matches || []).filter((m) => m.sessionId === s.id)
  const pendingChallengesCount = (db.challenges || []).filter((c) => c.sessionId === s.id && c.status === 'pending').length

  const courtNames = (s.courts || [])
    .filter((c) => !c.sold)
    .map((c) => c.label || courtOf(db, c.courtId).name)
    .join(', ')
  const timeRange = s.courts && s.courts[0] ? `${s.courts[0].from} → ${s.courts[0].to}` : ''
  const sSubTitle = timeRange && courtNames
    ? t('session.courtTimeSub', { time: timeRange, courts: courtNames })
    : `${wd(s.date)} · ${headCount(db, s)} ${t('units.people')} · ${(s.courts || []).filter((c) => !c.sold).length} ${t('units.court')} · ${group.name}`

  const [attStatusFilter, setAttStatusFilter] = useState('all')
  const [attKindFilter, setAttKindFilter] = useState('all')

  const KIND_COLORS = {
    member: '#00B2A9',
    guest: '#E0A03C',
    extra: '#8A7BE8',
  }

  const hexA = (hex, a) => {
    const h = (hex || '#00B2A9').replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }

  // 1. Thành viên cố định của nhóm
  const fixedMembers = members.filter((m) => att[m.id] !== 'extra').map((m) => {
    const state = att[m.id]
    const isPresent = state === true
    const isNoShow = state === 'noshow'
    const isAbsent = allSold || state === false
    const status = isPresent ? 'present' : isNoShow ? 'noshow' : isAbsent ? 'absent' : 'pending'
    const due = dues.find((d) => d.memberId === m.id && d.groupId === s.groupId)
    const charge = adhoc ? charges.find((c) => c.memberId === m.id) : null
    let owe = false
    if (charge) {
      owe = !charge.paid
    } else if (due) {
      const ds = dueState(due)
      owe = ds.state !== 'full'
    }
    return {
      id: m.id,
      name: m.name,
      gender: m.gender === 'nu' || m.gender === 'F' ? 'F' : 'M',
      level: levelOf(m, month),
      kind: 'member',
      status,
      owe,
      raw: m,
    }
  })

  // 2. Người đi thêm hôm nay
  const extraMembers = members.filter((m) => att[m.id] === 'extra').map((m) => {
    const charge = adhoc ? charges.find((c) => c.memberId === m.id) : null
    const owe = charge ? !charge.paid : false
    return {
      id: m.id,
      name: m.name,
      gender: m.gender === 'nu' || m.gender === 'F' ? 'F' : 'M',
      level: levelOf(m, month),
      kind: 'extra',
      status: 'present',
      owe,
      raw: m,
    }
  })

  // 3. Khách ngoài giao lưu
  const guestMembers = guests.map((g) => {
    const gInfo = guestOf(db, g.guestId)
    return {
      id: g.id,
      guestId: g.guestId,
      name: gInfo.name,
      gender: g.gender === 'nu' || g.gender === 'F' ? 'F' : 'M',
      level: g.level || gInfo.level,
      kind: 'guest',
      status: 'present',
      owe: !g.paid,
      raw: g,
    }
  })

  const everyone = [...fixedMembers, ...extraMembers, ...guestMembers]

  const dGoing = everyone.filter((m) => m.status === 'present').length
  const nMemPresent = everyone.filter((m) => m.status === 'present' && m.kind === 'member').length
  const nGuestPresent = everyone.filter((m) => m.status === 'present' && m.kind === 'guest').length
  const nExtraPresent = everyone.filter((m) => m.status === 'present' && m.kind === 'extra').length
  const dBreak = t('attend.breakdown', {
    members: nMemPresent,
    guests: nGuestPresent,
    extras: nExtraPresent,
  })

  const dStatusTabs = [
    { key: 'all', label: t('common.all'), count: everyone.length },
    { key: 'present', label: t('attend.present'), count: everyone.filter((m) => m.status === 'present').length },
    { key: 'absent', label: t('attend.absent'), count: everyone.filter((m) => m.status === 'absent' || m.status === 'noshow').length },
    { key: 'pending', label: t('attend.unmarked'), count: everyone.filter((m) => m.status === 'pending').length },
  ]

  const dKindTabs = [
    { key: 'all', label: t('common.all'), count: everyone.length },
    { key: 'member', label: t('attend.member'), count: everyone.filter((m) => m.kind === 'member').length },
    { key: 'guest', label: t('attend.guest'), count: everyone.filter((m) => m.kind === 'guest').length },
    { key: 'extra', label: t('attend.extra'), count: everyone.filter((m) => m.kind === 'extra').length },
  ]

  const filteredEveryone = everyone.filter((m) => {
    const matchStatus =
      attStatusFilter === 'all' ||
      (attStatusFilter === 'present'
        ? m.status === 'present'
        : attStatusFilter === 'absent'
        ? m.status === 'absent' || m.status === 'noshow'
        : m.status === 'pending')
    const matchKind = attKindFilter === 'all' || m.kind === attKindFilter
    return matchStatus && matchKind
  })

  const dMen = filteredEveryone.filter((m) => m.gender === 'M')
  const dWomen = filteredEveryone.filter((m) => m.gender === 'F')

  const dMenAll = everyone.filter((m) => m.gender === 'M')
  const dWomenAll = everyone.filter((m) => m.gender === 'F')

  const laneLabel = (arr) => {
    const presentList = arr.filter((m) => m.status === 'present')
    const gCount = presentList.filter((m) => m.kind === 'guest').length
    const eCount = presentList.filter((m) => m.kind === 'extra').length
    const tail = [
      gCount ? t('attend.laneGuests', { n: gCount }) : '',
      eCount ? t('attend.laneExtras', { n: eCount }) : '',
    ].filter(Boolean).join(' · ')
    return tail
      ? `${t('attend.laneLabel', { present: presentList.length })} · ${tail}`
      : t('attend.laneLabel', { present: presentList.length })
  }

  const dMenLabel = laneLabel(dMenAll)
  const dWomenLabel = laneLabel(dWomenAll)

  const renderChip = (m) => {
    const c = KIND_COLORS[m.kind] || '#00B2A9'
    const isPresent = m.status === 'present'
    const isAbsent = m.status === 'absent'
    const isNoShow = m.status === 'noshow'

    let bg = 'var(--surface-inset, #101927)'
    let border = '1px dashed var(--border-default, #33435F)'
    let color = 'var(--text-secondary, #A8B7CB)'

    if (isPresent) {
      bg = hexA(c, isDark ? 0.17 : 0.12)
      border = `1px solid ${hexA(c, isDark ? 0.42 : 0.35)}`
      color = 'var(--text-primary, #E9EFF7)'
    } else if (isNoShow) {
      bg = isDark ? 'rgba(234, 88, 12, 0.22)' : 'rgba(234, 88, 12, 0.12)'
      border = isDark ? '1px solid rgba(251, 146, 60, 0.50)' : '1px solid rgba(234, 88, 12, 0.45)'
      color = isDark ? '#FB923C' : '#C2410C'
    } else if (isAbsent) {
      bg = 'transparent'
      border = '1px solid var(--border-subtle, #2A3A56)'
      color = 'var(--text-muted, #8494AA)'
    }

    const handleClick = () => {
      if (!canEdit || isInactive || isClosed) return
      if (m.kind === 'member') {
        a.toggleAtt(s.id, m.id)
      } else if (m.kind === 'extra') {
        a.confirm({
          title: t('session.dropExtraTitle'),
          message: t('session.dropExtraMsg', { name: m.name }),
          tone: 'danger',
          confirmText: t('session.dropExtraOk'),
          onConfirm: () => a.removeExtra(s.id, m.id),
        })
      } else if (m.kind === 'guest') {
        setEditingGuest(guestOf(db, m.guestId))
      }
    }

    const chipTitle = `${m.name} · ${
      isPresent
        ? t('attend.present')
        : isNoShow
        ? t('attend.noshowTooltip')
        : isAbsent
        ? t('attend.absent')
        : t('attend.unmarked')
    }${m.owe ? ' · ' + t('attend.legendOwe') : ''}`

    return (
      <button
        key={`${m.kind}-${m.id}`}
        type="button"
        onClick={handleClick}
        disabled={!canEdit || isInactive || isClosed}
        title={chipTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 8px 0 7px',
          borderRadius: 6,
          width: '100%',
          minWidth: 0,
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          borderLeft: `3px solid ${isPresent ? c : hexA(c, 0.4)}`,
          background: bg,
          borderTop: border,
          borderRight: border,
          borderBottom: border,
          color,
          cursor: canEdit && !isInactive && !isClosed ? 'pointer' : 'default',
          textAlign: 'left',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span title={m.name}>{shortName(m.name)}</span>
        </span>
        {isNoShow && (
          <span
            style={{
              font: "700 9.5px/1 'IBM Plex Sans', sans-serif",
              padding: '2px 4px',
              borderRadius: 3,
              background: isDark ? 'rgba(234, 88, 12, 0.35)' : 'rgba(234, 88, 12, 0.20)',
              color: isDark ? '#FDBA74' : '#C2410C',
              flex: '0 0 auto',
              letterSpacing: '0.2px',
            }}
          >
            {t('attend.noshowShort')}
          </span>
        )}
        {m.owe && (
          <span
            title={t('attend.legendOwe')}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#E0A03C',
              flex: '0 0 auto',
            }}
          />
        )}
        <span style={{
          font: "400 10.5px/1 'IBM Plex Mono', monospace",
          color: isAbsent ? 'var(--text-disabled)' : 'var(--text-muted)',
          flex: '0 0 auto',
        }}>
          {m.level}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* ---------------- Unified Session Top Header (Mockup 01 / K1 / W1) ---------------- */}
      {isMobile ? (
        <div style={S.sessionHeaderBarMobile}>
          {/* Tầng 1: Nút back + Tiêu đề & Subtitle + Badge trạng thái + Xóa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
            <button
              type="button"
              onClick={() => a.go('sessions')}
              style={S.backBtn}
              aria-label={t('session.backToList')}
            >
              <Icon name="arrow-left" size={18} color="var(--text-primary)" />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <div style={S.sessionTitleText}>
                {`${t('session.sessionTitlePrefix')} ${dd(s.date)}`}
              </div>
              <div style={{ ...S.sessionSubText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sSubTitle}
              </div>
            </div>
            <div style={s.status === 'open' ? S.statusBadgeTeal : S.statusBadgeDefault}>
              <div style={s.status === 'open' ? S.statusDotTeal : S.statusDotDefault} />
              <span style={{ font: '600 11px/1 "IBM Plex Sans", sans-serif', color: s.status === 'open' ? '#5FDBD3' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {s.status === 'open'
                  ? (sessionMatches.length > 0 ? t('session.statusPlaying') : t('session.statusOpen'))
                  : t(`sessionState.${s.status}`)}
              </span>
            </div>
            <NotificationBell />
            {canEdit && s.status !== 'closed' && (
              <IconButton
                icon="trash-2"
                size="sm"
                variant="ghost"
                label={t('session.doDelete')}
                onClick={() => a.confirm({
                  title: t('session.delTitle'),
                  message: t('session.delMsg', { date: ddmy(s.date) }),
                  tone: 'danger',
                  confirmText: t('session.doDelete'),
                  onConfirm: () => a.deleteSession(s.id),
                })}
              />
            )}
          </div>

          {/* Tầng 2: Action Bar (Copy Zalo + Nút hành động chính Mở / Chốt / Mở lại) */}
          <div style={{ display: 'flex', gap: 8, width: '100%', paddingTop: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="send"
              onClick={() => a.copyZalo(s.id)}
              style={{
                flex: 1,
                height: 34,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                justifyContent: 'center',
              }}
            >
              {t('session.copyZalo')}
            </Button>
            {canEdit && (
              <>
                {s.status === 'draft' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="user-round-check"
                    onClick={() => a.setSessionStatus(s.id, 'open')}
                    style={{
                      height: 34,
                      flex: '0 0 auto',
                      background: 'var(--teal-600)',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {t('session.doOpen')}
                  </Button>
                )}
                {s.status === 'open' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="circle-check"
                    disabled={!canMoney}
                    onClick={() => a.confirm({
                      title: t('session.closeTitle'),
                      message: t('session.closeMsg'),
                      tone: 'info',
                      confirmText: t('session.closeOk'),
                      onConfirm: () => a.setSessionStatus(s.id, 'closed'),
                    })}
                    style={{
                      height: 34,
                      flex: '0 0 auto',
                      background: '#0D5E3A',
                      border: '1px solid #00875A',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {t('session.doClose')}
                  </Button>
                )}
                {(s.status === 'cancelled' || s.status === 'closed') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="rotate-ccw"
                    disabled={!canMoney}
                    onClick={() => a.confirm({
                      title: t('session.reopenTitle'),
                      message: t('session.reopenMsg'),
                      tone: 'warning',
                      confirmText: t('session.reopenOk'),
                      onConfirm: () => a.setSessionStatus(s.id, 'open'),
                    })}
                    style={{
                      height: 34,
                      flex: '0 0 auto',
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {t('session.doReopen')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={S.sessionHeaderBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={() => a.go('sessions')}
              style={S.backBtn}
              aria-label={t('session.backToList')}
            >
              <Icon name="arrow-left" size={18} color="var(--text-primary)" />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={S.sessionTitleText}>
                {`${t('session.sessionTitlePrefix')} ${dd(s.date)}`}
              </div>
              <div style={S.sessionSubText}>
                {sSubTitle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <NotificationBell />
            <div style={s.status === 'open' ? S.statusBadgeTeal : S.statusBadgeDefault}>
              <div style={s.status === 'open' ? S.statusDotTeal : S.statusDotDefault} />
              <span style={{ font: '600 11.5px/1 "IBM Plex Sans", sans-serif', color: s.status === 'open' ? '#5FDBD3' : 'var(--text-muted)' }}>
                {s.status === 'open'
                  ? (sessionMatches.length > 0 ? t('session.statusPlaying') : t('session.statusOpen'))
                  : t(`sessionState.${s.status}`)}
              </span>
            </div>

            {canEdit && (
              <>
                {s.status === 'draft' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="user-round-check"
                    onClick={() => a.setSessionStatus(s.id, 'open')}
                  >
                    {t('session.doOpen')}
                  </Button>
                )}
                {s.status === 'open' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="circle-check"
                    disabled={!canMoney}
                    onClick={() => a.confirm({
                      title: t('session.closeTitle'),
                      message: t('session.closeMsg'),
                      tone: 'info',
                      confirmText: t('session.closeOk'),
                      onConfirm: () => a.setSessionStatus(s.id, 'closed'),
                    })}
                  >
                    {t('session.doClose')}
                  </Button>
                )}
                {(s.status === 'cancelled' || s.status === 'closed') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="rotate-ccw"
                    disabled={!canMoney}
                    onClick={() => a.confirm({
                      title: t('session.reopenTitle'),
                      message: t('session.reopenMsg'),
                      tone: 'warning',
                      confirmText: t('session.reopenOk'),
                      onConfirm: () => a.setSessionStatus(s.id, 'open'),
                    })}
                  >
                    {t('session.doReopen')}
                  </Button>
                )}
              </>
            )}

            <IconButton
              icon="send"
              size="sm"
              variant="ghost"
              label={t('session.copyZalo')}
              onClick={() => a.copyZalo(s.id)}
            />

            {canEdit && s.status !== 'closed' && (
              <IconButton
                icon="trash-2"
                size="sm"
                variant="ghost"
                label={t('session.doDelete')}
                onClick={() => a.confirm({
                  title: t('session.delTitle'),
                  message: t('session.delMsg', { date: ddmy(s.date) }),
                  tone: 'danger',
                  confirmText: t('session.doDelete'),
                  onConfirm: () => a.deleteSession(s.id),
                })}
              />
            )}
          </div>
        </div>
      )}

      {/* ---------------- Segmented Tab Bar (Handoff 02 / 05) ---------------- */}
      <TabTrack style={{ ...S.tabBarWrap, margin: isMobile ? '10px 0 6px' : '14px 0 8px', width: isMobile ? '100%' : 'auto' }}>
        <div style={{ ...S.tabTrack, width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => setActiveTab('attend')}
            style={{
              ...S.tabBtn,
              ...(isMobile ? S.tabBtnMobile : {}),
              ...(activeTab === 'attend' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.attend')}</span>
            <span style={{
              ...S.tabBadgeMono,
              color: activeTab === 'attend' ? '#5FDBD3' : 'var(--text-muted)',
            }}>
              {presentCount(db, s)}/{members.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            style={{
              ...S.tabBtn,
              ...(isMobile ? S.tabBtnMobile : {}),
              ...(activeTab === 'planner' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.planner')}</span>
            <span style={{
              ...S.tabBadgeMono,
              color: activeTab === 'planner' ? '#5FDBD3' : 'var(--text-muted)',
            }}>
              {s.planner?.rounds?.length || 10}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('courts')}
            style={{
              ...S.tabBtn,
              ...(isMobile ? S.tabBtnMobile : {}),
              ...(activeTab === 'courts' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.courts')}</span>
            <span style={{
              ...S.tabBadgeMono,
              color: '#5FDBD3',
            }}>
              {sessionMatches.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            style={{
              ...S.tabBtn,
              ...(isMobile ? S.tabBtnMobile : {}),
              ...(activeTab === 'matches' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.matches')}</span>
            <span style={{
              ...S.tabBadgeMono,
              color: '#F0B75C',
            }}>
              {sessionMatches.length}{pendingChallengesCount > 0 ? `/${pendingChallengesCount}` : ''}
            </span>
          </button>
        </div>
      </TabTrack>
      {!isMobile && (
        <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', margin: '0 0 14px' }}>
          {activeTab === 'attend' ? t('sessionTabs.hintAttend') : activeTab === 'planner' ? t('sessionTabs.hintPlanner') : activeTab === 'courts' ? t('sessionTabs.hintCourts') : t('sessionTabs.hintMatches')}
        </div>
      )}

      {/* Khối nguyện vọng thành viên */}
      {me && !isClosed && (
        <div style={{
          margin: '0 0 16px',
          padding: '12px 16px',
          borderRadius: 10,
          background: myWish ? 'rgba(139, 92, 246, 0.08)' : 'var(--surface-card)',
          border: myWish ? '1px solid rgba(139, 92, 246, 0.4)' : '1px dashed var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: myWish ? 'rgba(139, 92, 246, 0.2)' : 'var(--surface-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: myWish ? '#A78BFA' : 'var(--text-muted)',
              flexShrink: 0,
            }}>
              <Icon name="sparkles" size={16} />
            </div>
            <div>
              <div style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {myWish ? t('session.myWishTitle') : t('session.myWishBtn')}
              </div>
              <div style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                {myWish
                  ? `${myWish.text}${myWish.note ? ` (${myWish.note})` : ''}`
                  : t('session.myWishEmpty')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {myWish ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShowMyWishDialog(true)}>
                  {t('session.myWishEdit')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    a.confirm({
                      title: t('session.myWishDelete'),
                      message: t('session.myWishDeleteConfirm'),
                      tone: 'danger',
                      onConfirm: () => a.deleteSessionWish(s.id, myWish.id),
                    })
                  }}
                >
                  {t('session.myWishDelete')}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setShowMyWishDialog(true)}>
                <Icon name="plus" size={13} />
                <span>{t('session.myWishBtn')}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'attend' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}>
        {/* ---------------- điểm danh ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <SelfAttendanceCard s={s} db={db} a={a} isMobile={isMobile} isClosed={isClosed} />
          {/* ---------------- Khối Điểm Danh 2a ---------------- */}
          <div
            style={{
              background: 'var(--surface-card, #141D2E)',
              border: '1px solid var(--border-default, #22304A)',
              borderRadius: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,.35)',
              padding: '14px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            {/* Header: Badge 2a, Tiêu đề, Badge số người đi, Breakdown, Nút Tất cả có mặt & Xoá */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span
                style={{
                  font: "600 11px/1 'IBM Plex Mono', monospace",
                  color: '#04302C',
                  background: 'var(--teal-500, #00B2A9)',
                  padding: '4px 7px',
                  borderRadius: 4,
                }}
              >
                2a
              </span>
              <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {`${t('session.attendTitle')} ${dd(s.date)}`}
              </div>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  font: "700 12px/1 'IBM Plex Sans', sans-serif",
                  color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
                  background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                  border: '1px solid ' + (isDark ? 'rgba(0,178,169,.35)' : 'rgba(0,178,169,.30)'),
                  padding: '5px 9px',
                  borderRadius: 5,
                }}
              >
                {t('attend.peopleGoing', { n: dGoing })}
              </span>
              <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                {dBreak}
              </span>
              {canEdit && !isInactive && !isClosed && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => a.markAll(s.id, true)}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      borderRadius: 6,
                      background: 'var(--surface-inset, #1A2437)',
                      border: '1px solid var(--border-default, #2E3E5C)',
                      font: "600 12px/1 'IBM Plex Sans', sans-serif",
                      color: 'var(--text-primary, #E9EFF7)',
                    }}
                  >
                    {t('session.allPresent')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => a.markAll(s.id, false)}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      borderRadius: 6,
                      font: "600 12px/1 'IBM Plex Sans', sans-serif",
                      color: 'var(--text-muted, #8494AA)',
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </>
              )}
            </div>

            {/* Thanh Filter kép: Trạng thái + Phân loại */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                paddingBottom: 11,
                borderBottom: '1px solid var(--border-subtle, #1D2A42)',
              }}
            >
              {dStatusTabs.map((tab) => {
                const isActive = attStatusFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAttStatusFilter(tab.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      font: "600 12px/1 'IBM Plex Sans', sans-serif",
                      background: isActive
                        ? (isDark ? 'var(--teal-500, #00B2A9)' : 'var(--teal-600, #00786F)')
                        : 'var(--surface-inset, #101927)',
                      border: '1px solid ' + (isActive ? 'var(--teal-500, #00B2A9)' : 'var(--border-default, #2E3E5C)'),
                      color: isActive ? '#04231F' : 'var(--text-secondary, #A8B7CB)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        font: "600 10.5px/1 'IBM Plex Mono', monospace",
                        opacity: isActive ? 0.85 : 0.6,
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}

              <span style={{ width: 1, height: 18, background: 'var(--border-subtle, #2A3A56)', margin: '0 3px' }} />

              {dKindTabs.map((tab) => {
                const isActive = attKindFilter === tab.key
                const col = tab.key === 'all' ? (isDark ? '#00B2A9' : '#00786F') : (KIND_COLORS[tab.key] || '#00B2A9')
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAttKindFilter(tab.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      font: "600 12px/1 'IBM Plex Sans', sans-serif",
                      background: isActive
                        ? hexA(col, isDark ? 0.22 : 0.15)
                        : 'var(--surface-inset, #101927)',
                      border: '1px solid ' + (isActive ? col : 'var(--border-default, #2E3E5C)'),
                      color: isActive ? (isDark ? '#E9EFF7' : 'var(--text-primary)') : 'var(--text-secondary, #A8B7CB)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        font: "600 10.5px/1 'IBM Plex Mono', monospace",
                        opacity: isActive ? 0.85 : 0.6,
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}

              <span style={{ flex: 1 }} />

              <button
                type="button"
                title={t('attend.reorderHint')}
                onClick={() => setSortKey((k) => k + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 28,
                  padding: '0 9px',
                  borderRadius: 6,
                  font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                  background: 'var(--surface-inset, #1A2437)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  color: 'var(--text-secondary, #A8B7CB)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="rotate-ccw" size={12} color="var(--text-muted)" />
                <span>{t('attend.reorderBtn')}</span>
              </button>
            </div>

            {/* Thông báo huỷ / bán sân */}
            {isCancelled && <Alert tone="danger">{t('session.cancelledNotice')}</Alert>}
            {allSold && <Alert tone="warning">{t('session.allSoldNotice')}</Alert>}
            {adhoc && <Alert tone="info">{t('session.adhocChargeNote')}</Alert>}
            {everyone.length === 0 && <Empty icon="users" title={t('members.emptyGroup')} hint={t('members.emptyGroupHint')} />}

            {/* Lưới 2 làn: Nam và Nữ */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {/* Làn Nam */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 9px',
                    borderRadius: 7,
                    background: isDark ? 'rgba(91,155,232,.10)' : 'rgba(91,155,232,.08)',
                    border: isDark ? '1px solid rgba(91,155,232,.28)' : '1px solid rgba(91,155,232,.20)',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5B9BE8', flex: '0 0 auto' }} />
                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {t('gender.nam')}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#9CC4F2' : '#3B82F6' }}>
                    {dMenLabel}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {dMen.map(renderChip)}
                </div>
              </div>

              {/* Làn Nữ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 9px',
                    borderRadius: 7,
                    background: isDark ? 'rgba(232,138,184,.10)' : 'rgba(232,138,184,.08)',
                    border: isDark ? '1px solid rgba(232,138,184,.28)' : '1px solid rgba(232,138,184,.20)',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E88AB8', flex: '0 0 auto' }} />
                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {t('gender.nu')}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B2D0' : '#EC4899' }}>
                    {dWomenLabel}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {dWomen.map(renderChip)}
                </div>
              </div>
            </div>

            {/* Footer chú thích (Legend) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
                paddingTop: 6,
                borderTop: '1px solid var(--border-subtle, #1D2A42)',
                font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif",
                color: 'var(--text-muted, #8494AA)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: 'var(--teal-500, #00B2A9)' }} />
                {t('attend.member')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: '#E0A03C' }} />
                {t('attend.guest')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: '#8A7BE8' }} />
                {t('attend.extra')}
              </span>
              <span style={{ width: 1, height: 14, background: 'var(--border-subtle, #2A3A56)' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(0,178,169,.20)', border: '1px solid rgba(0,178,169,.45)' }} />
                {t('attend.legendPresent')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, border: '1px solid var(--border-subtle, #2A3A56)', background: 'transparent' }} />
                {t('attend.legendAbsent')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(234, 88, 12, 0.25)', border: '1px solid rgba(251, 146, 60, 0.50)' }} />
                {t('attend.legendNoshow')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, border: '1px dashed var(--border-default, #33435F)' }} />
                {t('attend.legendPending')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E0A03C' }} />
                {t('attend.legendOwe')}
              </span>
              <span style={{ flex: 1 }} />
            </div>

            {/* ExtraPicker */}
            {canEdit && !isInactive && !isClosed && (
              <ExtraPicker s={s} members={members} isMobile={isMobile} />
            )}
          </div>
        </div>

        {/* ---------------- cột phải ---------------- */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card
            title={t('session.courtsTitle')}
            subtitle={t('session.courtsSub')}
            icon="map-pin"
            padding="14px 16px"
            actions={canEdit && !isClosed && (
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => a.openDialog('addcourt', addCourtForm(db, s))}
                style={{
                  height: 32,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t('session.addCourt')}
              </Button>
            )}
          >
            <div style={{ display: 'grid', gap: 9 }}>
              {(s.courts || []).map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    flexWrap: 'wrap',
                    padding: '9px 11px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    background: 'var(--surface-inset, #101927)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={S.label}>
                        {c.label ? (
                          <>
                            <span style={{ color: 'var(--teal-600)', fontWeight: 700 }}>{c.label}</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                            <span>{courtOf(db, c.courtId).name}</span>
                          </>
                        ) : (
                          (s.courts || []).length > 1 ? (
                            <>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('session.courtNum', { n: i + 1 })}</span>
                              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                              <span>{courtOf(db, c.courtId).name}</span>
                            </>
                          ) : (
                            courtOf(db, c.courtId).name
                          )
                        )}
                      </span>
                      {canEdit && !isClosed && (
                        <IconButton
                          icon="pencil"
                          size="sm"
                          variant="ghost"
                          label={t('session.editCourtLabel')}
                          onClick={() => a.openDialog('editCourtLabel', { sid: s.id, courtIndex: i, label: c.label || '' })}
                        />
                      )}
                      {courtOf(db, c.courtId).mapUrl && (
                        <a
                          href={courtOf(db, c.courtId).mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            color: 'var(--teal-600)', fontSize: 12, textDecoration: 'none',
                            padding: '2px 6px', borderRadius: 4, background: 'var(--surface-brand-soft)',
                          }}
                          title={t('session.mapTitle')}
                        >
                          <Icon name="map-pin" size={12} />
                          <span>{t('settings.openMap')}</span>
                        </a>
                      )}
                      {c.extra && <span style={S.tagAmber}>{t('session.extraBadge')}</span>}
                      {c.sold && <span style={S.tagGreen}>{t('session.soldBadge')}</span>}
                    </div>
                    <Mono color="var(--text-muted)">{c.from + ' → ' + c.to}</Mono>
                  </div>
                  <Mono
                    weight={600}
                    color={c.sold ? 'var(--text-muted)' : 'var(--text-primary)'}
                    style={c.sold ? { textDecoration: 'line-through' } : undefined}
                  >
                    {fmt(rowCost(db, c))}
                  </Mono>
                  {canEdit && !isClosed && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => a.toggleCourtSold(s.id, i)}
                        style={{
                          height: 30,
                          padding: '0 10px',
                          background: 'var(--surface-card, #1A2437)',
                          border: '1px solid var(--border-default, #2E3E5C)',
                          color: 'var(--text-primary, #E9EFF7)',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {c.sold ? t('session.unsell') : t('session.sell')}
                      </Button>
                      {c.extra && (
                        <IconButton
                          icon="trash-2"
                          size="sm"
                          variant="ghost"
                          label={t('common.delete')}
                          onClick={() => a.confirm({
                            title: t('session.delCourtTitle'),
                            message: t('session.delCourtMsg', { from: c.from, to: c.to }),
                            tone: 'danger',
                            confirmText: t('session.delCourtOk'),
                            onConfirm: () => a.removeSessionCourt(s.id, i),
                          })}
                        />
                      )}
                    </>
                  )}
                  {c.sold && (
                    <div style={S.soldBox}>
                      <Input
                        label={t('session.soldAmount')}
                        mono
                        suffix={t('units.dong')}
                        value={String(c.soldAmount || 0)}
                        disabled={!canEdit || isClosed}
                        onChange={(e) => a.setSold(s.id, i, 'soldAmount', e.target.value)}
                        style={{ width: 140 }}
                      />
                      <Input
                        label={t('session.soldTo')}
                        value={c.soldTo || ''}
                        disabled={!canEdit || isClosed}
                        onChange={(e) => a.setSold(s.id, i, 'soldTo', e.target.value)}
                        style={{ width: 170 }}
                      />
                    </div>
                  )}
                </div>
              ))}
              <div style={S.caption}>{t('session.courtRule')}</div>
            </div>
          </Card>

          <Card title={t('session.guestsTitle')} subtitle={t('session.guestsSub')} icon="user-round-plus" padding="14px 16px">
            {isCancelled && <Alert tone="danger">{t('session.cancelledGuestNotice')}</Alert>}
            {allSold && <Alert tone="warning">{t('session.allSoldGuestNotice')}</Alert>}
            {canEdit && !isInactive && !isClosed && <GuestForm s={s} isMobile={isMobile} />}
            <div style={{ display: 'grid', gap: 8, marginTop: guests.length ? 12 : 0 }}>
              {guests.length === 0
                ? <Empty icon="user-round-plus" title={t('session.guestEmpty')} hint={t('session.guestEmptyHint')} />
                : guests.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: '10px 12px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        background: 'var(--surface-inset, #101927)',
                        opacity: isInactive ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.label} title={guestOf(db, g.guestId).name}>{shortName(guestOf(db, g.guestId).name)}</div>
                          <div style={S.caption}>{genderTxt(g.gender) + ' · ' + g.level}</div>
                        </div>
                        <Mono weight={600} color="var(--text-primary)">{fmt(g.price)}</Mono>
                        <span style={g.paid ? S.tagGreen : S.tagAmber}>
                          {t(g.paid ? 'session.guestPaid' : 'session.guestDebt')}
                        </span>
                        {canEdit && !isInactive && !isClosed && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <IconButton
                              icon="pencil"
                              size="sm"
                              variant="ghost"
                              label={t('common.edit')}
                              onClick={() => setEditingGuest(guestOf(db, g.guestId))}
                            />
                            <IconButton
                              icon="trash-2"
                              size="sm"
                              variant="ghost"
                              label={t('common.delete')}
                              onClick={() => a.confirm({
                                title: t('session.delGuestTitle'),
                                message: t('session.delGuestMsg', { name: guestOf(db, g.guestId).name }),
                                tone: 'danger',
                                confirmText: t('session.delGuestOk'),
                                onConfirm: () => a.removeGuest(g.id),
                              })}
                            />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <SearchSelect
                          size="sm"
                          style={{ width: '100%' }}
                          menuWidth={240}
                          placeholder={t('session.guestByShort')}
                          searchPlaceholder={t('session.searchMember')}
                          options={db.members.filter((m) => m.active !== false).map((m) => ({
                            value: m.id,
                            label: m.name,
                            level: levelOf(m, s.date.slice(0, 7)),
                            sub: m.phone || undefined,
                          }))}
                          levels={db.levels}
                          clearable
                          disabled={!canEdit || isInactive || isClosed}
                          value={g.invitedBy || ''}
                          onChange={(val) => a.setGuestInviter(g.id, val)}
                        />
                      </div>
                    </div>
                  ))}
            </div>
            <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', marginTop: 8 }}>
              {t('session.guestNoChallenge')}
            </div>
          </Card>

        </div>
      </div>
      )}

      {activeTab === 'planner' && <SessionPlannerTab s={s} />}
      {activeTab === 'courts' && <CourtAssignmentTab s={s} />}
      {activeTab === 'matches' && <SessionMatchesTab s={s} onSwitchTab={setActiveTab} />}

      {editingGuest && (
        <EditGuestDialog
          guest={editingGuest}
          levels={db.levels}
          onClose={() => setEditingGuest(null)}
          onSave={(patch) => {
            a.updateGuest(editingGuest.id, patch)
            setEditingGuest(null)
          }}
          onDelete={() => {
            a.confirm({
              title: t('session.delGuestTitle'),
              message: t('session.delGuestMsg', { name: editingGuest.name }),
              tone: 'danger',
              confirmText: t('session.delGuestOk'),
              onConfirm: () => {
                a.deleteGuest(editingGuest.id)
                setEditingGuest(null)
              },
            })
          }}
        />
      )}

      {showMyWishDialog && (
        <PlannerAddWishDialog
          isOpen={showMyWishDialog}
          onClose={() => setShowMyWishDialog(false)}
          onSaveWish={(wish) => {
            a.saveSessionWish(s.id, wish)
            setShowMyWishDialog(false)
          }}
          onDeleteWish={(wishId) => {
            a.deleteSessionWish(s.id, wishId)
            setShowMyWishDialog(false)
          }}
          players={wishPlayers}
          defaultMemberId={me?.id}
          existingWish={myWish}
        />
      )}
    </>
  )
}

/* ---------------- thêm người đi thêm ---------------- */

/**
 * Thành viên CLB nhưng không cố định nhóm này, hôm nay có đánh. Trước đây cách duy nhất để thu
 * là nhét họ vào danh sách khách với giá khách — sai người, thu vượt, và phồng báo cáo khách.
 * Giờ họ trả theo ĐƠN GIÁ MỘT BUỔI của nhóm, hiện ở tab Đối chiếu bên Công nợ.
 */
function ExtraPicker({ s, members, isMobile }) {
  const { db, ui, a } = useApp()
  const inSession = new Set(members.map((m) => m.id))
  const rest = db.members.filter((m) => m.active !== false && !inSession.has(m.id))
  if (!rest.length) return null

  const extraOptions = rest.map((m) => ({
    value: m.id,
    label: m.name,
    level: levelOf(m, s.date.slice(0, 7)),
    sub: m.phone || undefined,
  }))

  const raw = ui.form.exMember
  const selectedMembers = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  const count = selectedMembers.length

  const handleAdd = () => {
    selectedMembers.forEach((mid) => a.addExtra(s.id, mid))
    a.setF('exMember', [])
  }

  return (
    <div style={{
      ...S.extraBox,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
    }}>
      <SearchSelect
        multiple
        size="sm"
        style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}
        menuWidth={280}
        value={selectedMembers}
        placeholder={t('session.extraPick')}
        searchPlaceholder={t('session.searchSolo')}
        options={extraOptions}
        levels={db.levels}
        clearable
        onChange={(vals) => a.setF('exMember', vals)}
      />
      <Button
        variant="secondary"
        size="sm"
        icon="user-round-plus"
        disabled={count === 0}
        style={{
          height: 34,
          justifyContent: 'center',
          background: 'var(--surface-inset, #1A2437)',
          border: '1px solid var(--border-default, #2E3E5C)',
          color: 'var(--text-primary, #E9EFF7)',
          fontWeight: 600,
        }}
        onClick={handleAdd}
      >
        {count > 1 ? t('session.extraAddMany', { n: count }) : t('session.extraAdd')}
      </Button>
    </div>
  )
}

/* ---------------- form thêm khách ---------------- */

function GuestForm({ s, isMobile }) {
  const { db, ui, a } = useApp()
  const [open, setOpen] = useState(false)
  const [showExtra, setShowExtra] = useState(false)
  const f = { ...guestForm(db), ...(ui.form || {}) }
  const set = (k, v) => a.setF(k, v)
  const price = guestPrice(db, f.gLevel, f.gGender)
  const companionPrice = f.gHasCompanion
    ? guestPrice(db, f.gCompanionLevel || f.gLevel, f.gCompanionGender || 'nu')
    : 0
  const totalPrice = price + companionPrice
  const noLevel = !f.gLevel
  const toSettings = () => { a.go('settings'); a.setTab('settings', 'money') }

  const selectedGuest = f.gGuestId ? db.guests.find((g) => g.id === f.gGuestId) : null
  const stats = selectedGuest ? guestStats(db, selectedGuest.id) : null

  // Gợi ý danh bạ khách
  const matchingGuests = useMemo(() => {
    const q = normalizeText(f.gName || '')
    if (!q) return db.guests.slice(0, 8)
    return db.guests.filter((g) => {
      const n = normalizeText(g.name)
      const p = (g.phone || '').replace(/\D/g, '')
      return n.includes(q) || (p && p.includes(q))
    }).slice(0, 8)
  }, [db.guests, f.gName])

  const selectGuest = (g) => {
    set('gGuestId', g.id)
    set('gName', g.name)
    set('gGender', g.gender)
    set('gLevel', g.level)
    set('gPhone', g.phone || '')
    set('gNote', g.note || '')
    if (g.invitedBy) set('gBy', g.invitedBy)
    setShowExtra(Boolean(g.phone || g.note))
    setOpen(false)
  }

  const memberOptions = db.members.filter((m) => m.active !== false).map((m) => ({
    value: m.id,
    label: m.name,
    level: levelOf(m, (s?.date || new Date().toISOString()).slice(0, 7)),
    sub: m.phone || undefined,
  }))

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Hàng 1: Tên khách + Giới tính + Trình độ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 110px 90px',
        gap: 9,
        alignItems: 'flex-end',
      }}>
        {/* Ô Tìm / Nhập tên khách với Autocomplete */}
        <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : 'auto' }}>
          <Input
            label={t('session.guestName')}
            placeholder={t('session.guestSearchPlaceholder')}
            value={f.gName || ''}
            onChange={(e) => {
              set('gName', e.target.value)
              set('gGuestId', '')
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
          {open && matchingGuests.length > 0 && (
            <div style={S.guestDropdown}>
              {matchingGuests.map((g) => {
                const gs = guestStats(db, g.id)
                const lastDate = gs.lastSession ? ddmy(gs.lastSession.date) : ''
                return (
                  <button
                    key={g.id}
                    type="button"
                    style={S.guestOption}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectGuest(g)
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }} title={g.name}>{shortName(g.name)}</span>
                      <LevelChip level={g.level} levels={db.levels} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{genderTxt(g.gender)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {gs.sessionCount > 0
                          ? t('session.guestSessionMeta', { n: gs.sessionCount, date: lastDate })
                          : t('session.guestNoSession')}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {g.phone ? g.phone : t('members.guestNoPhone')}
                      {g.invitedBy ? ` · ${t('session.guestByShort')} ${memberOf(db, g.invitedBy).name}` : ''}
                      {g.note ? ` · ${g.note}` : ''}
                    </div>
                  </button>
                )
              })}
              {f.gName && (
                <button
                  type="button"
                  style={{ ...S.guestOption, color: 'var(--text-accent, var(--teal-500))', fontWeight: 600 }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    set('gGuestId', '')
                    setOpen(false)
                  }}
                >
                  {t('session.guestAddNew', { name: f.gName })}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ gridColumn: isMobile ? '1' : 'auto' }}>
          <GenderSegment
            label={t('session.guestGender')}
            value={f.gGender || 'nam'}
            onChange={(val) => set('gGender', val)}
          />
        </div>
        <div style={{ gridColumn: isMobile ? '2' : 'auto' }}>
          <Select
            label={t('session.guestLevel')}
            value={f.gLevel}
            options={db.levels.map((l) => ({ value: l, label: l }))}
            onChange={(e) => set('gLevel', e.target.value)}
          />
        </div>
      </div>

      {/* Hàng 2: Người rủ + Nút Thêm */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
        gap: 9,
        alignItems: 'flex-end',
      }}>
        <div style={{ minWidth: 0 }}>
          <SearchSelect
            label={t('session.guestBy')}
            value={f.gBy || ''}
            placeholder={t('debts.clubRecruited')}
            searchPlaceholder={t('session.searchMember')}
            options={memberOptions}
            levels={db.levels}
            clearable
            onChange={(val) => set('gBy', val)}
          />
        </div>
        <Button
          variant="primary"
          icon="plus"
          disabled={noLevel}
          style={{
            whiteSpace: 'nowrap',
            fontWeight: 600,
            minWidth: 100,
            justifyContent: 'center',
            height: 36,
          }}
          onClick={() => { setOpen(false); a.addGuest() }}
        >
          {noLevel
            ? t('common.add')
            : (f.gHasCompanion ? t('session.addTwoGuests', { amount: fmt(totalPrice) }) : fmt(totalPrice))}
        </Button>
      </div>

      {/* Tuỳ chọn +1 người đi kèm & Mở rộng SĐT/Note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 600, color: f.gHasCompanion ? 'var(--teal-700)' : 'var(--text-secondary)',
        }}>
          <input
            type="checkbox"
            checked={!!f.gHasCompanion}
            onChange={(e) => {
              const checked = e.target.checked
              set('gHasCompanion', checked)
              if (checked && !f.gCompanionName && f.gName) {
                set('gCompanionName', t('session.companionDefault', { name: f.gName.trim() }))
              }
            }}
            style={{ cursor: 'pointer', accentColor: 'var(--teal-600)' }}
          />
          <span>{t('session.guestAddCompanion')}</span>
        </label>

        <button
          type="button"
          style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--text-accent, var(--teal-500))', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          onClick={() => setShowExtra(!showExtra)}
        >
          <Icon name={showExtra ? 'chevron-up' : 'plus'} size={12} />
          <span>{t(showExtra ? 'session.extraLess' : 'session.extraMore')}</span>
        </button>
      </div>

      {/* Form người đi kèm */}
      {f.gHasCompanion && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1.5fr 1fr 1fr',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(14, 165, 233, 0.08) 100%)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
        }}>
          <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
            <Input
              label={t('session.companionName')}
              placeholder={t('session.companionDefault', { name: (f.gName || '').trim() || '...' })}
              value={f.gCompanionName || ''}
              onChange={(e) => set('gCompanionName', e.target.value)}
            />
          </div>
          <div style={{ gridColumn: isMobile ? '1' : 'auto' }}>
            <GenderSegment
              label={t('session.guestGender')}
              value={f.gCompanionGender || 'nu'}
              onChange={(val) => set('gCompanionGender', val)}
            />
          </div>
          <div style={{ gridColumn: isMobile ? '2' : 'auto' }}>
            <Select
              label={t('session.guestLevel')}
              value={f.gCompanionLevel || f.gLevel || db.levels[0]}
              options={db.levels.map((l) => ({ value: l, label: l }))}
              onChange={(e) => set('gCompanionLevel', e.target.value)}
            />
          </div>
          <div style={{
            gridColumn: isMobile ? '1 / -1' : 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-muted)',
            paddingBottom: 4,
          }}>
            <Icon name="link" size={12} />
            <span>{t('session.companionTag', { name: f.gName || t('session.guestName') })}</span>
          </div>
        </div>
      )}

      {showExtra && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr', gap: 9 }}>
          <Input
            label={t('members.guestPhone')}
            placeholder={t('session.phGuestPhone2')}
            value={f.gPhone || ''}
            onChange={(e) => set('gPhone', e.target.value)}
          />
          <Input
            label={t('members.guestNote')}
            placeholder={t('session.phGuestNote2')}
            value={f.gNote || ''}
            onChange={(e) => set('gNote', e.target.value)}
          />
        </div>
      )}

      {/* Dòng nhắc SĐT nếu khách quen (>= 3 buổi) chưa có SĐT */}
      {selectedGuest && stats && stats.sessionCount >= 3 && !selectedGuest.phone && !showExtra && !f.gPhone && (
        <div style={S.phonePrompt}>
          <Icon name="phone" size={14} style={{ color: 'var(--status-delayed-fg)' }} />
          <span>{t('session.guestPhonePrompt', { name: selectedGuest.name, n: stats.sessionCount })}</span>
          <input
            type="text"
            placeholder={t('session.guestPhone')}
            value={f.gPhone || ''}
            onChange={(e) => set('gPhone', e.target.value)}
            style={S.miniInput}
          />
        </div>
      )}

      {(noLevel || price === 0) && (
        <button type="button" onClick={toSettings} style={S.guestWarn}>
          {t(noLevel ? 'session.guestNoLevel' : 'session.guestNoPrice')}
        </button>
      )}
    </div>
  )
}

const S = {
  sessionHeaderBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 60,
    padding: '12px 16px',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
  },
  sessionHeaderBarMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 16px',
    background: '#080F1C',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    margin: '0 0 12px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  sessionHeaderSubRowMobile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTop: '1px solid var(--border-subtle)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: 'var(--surface-inset)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  sessionTitleText: {
    font: '600 17px/1.2 Barlow, sans-serif',
    letterSpacing: '-0.01em',
    color: 'var(--text-primary)',
  },
  sessionSubText: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  statusBadgeTeal: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(0, 178, 169, 0.18)',
    border: '1px solid rgba(0, 178, 169, 0.3)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statusDotTeal: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#5FDBD3',
    boxShadow: '0 0 6px #5FDBD3',
  },
  statusBadgeDefault: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statusDotDefault: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text-muted)',
  },
  tabBarWrap: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '14px 0 6px', maxWidth: '100%' },
  tabTrack: { display: 'flex', padding: 3, borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', gap: 2, maxWidth: '100%', boxSizing: 'border-box' },
  tabBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, padding: '0 12px',
    borderRadius: 6, border: 'none', background: 'transparent',
    font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  tabBtnMobile: {
    flex: '1 1 0',
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
    minHeight: 38,
    padding: '0 4px',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tabBtnActive: { background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,.08))' },
  tabBadgeMono: { font: '400 11px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  label: { font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' },
  caption: { font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' },
  attRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', width: '100%',
    border: '1px solid', borderRadius: 8, font: 'inherit',
  },
  attBtn: {
    display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
    background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit',
  },
  extraBox: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3,
    padding: '10px', borderRadius: 8, border: '1px dashed var(--border-subtle)',
  },
  courtRow: {
    display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  soldBox: { display: 'flex', gap: 9, flexBasis: '100%', flexWrap: 'wrap', marginTop: 6 },
  guestForm: { display: 'grid', gridTemplateColumns: '1.4fr 110px 95px minmax(180px, 1.6fr) auto', gap: 9, alignItems: 'flex-end' },
  guestDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: 'var(--surface-overlay, var(--surface-card))', border: '1px solid var(--border-subtle)',
    borderRadius: 8, boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.1))',
    maxHeight: 240, overflowY: 'auto', marginTop: 4, display: 'grid',
  },
  guestOption: {
    display: 'grid', gap: 2, padding: '8px 12px', border: 0, borderBottom: '1px solid var(--border-subtle)',
    background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit',
  },
  phonePrompt: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap',
  },
  miniInput: {
    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)', font: 'inherit', fontSize: 13, width: 140,
  },
  guestWarn: {
    textAlign: 'left', border: 0, padding: 0, cursor: 'pointer', background: 'transparent',
    font: 'var(--type-caption)', color: 'var(--status-delayed-fg)', textDecoration: 'underline',
  },
  guestRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(130px, 1.2fr) auto auto auto',
    gap: 12,
    alignItems: 'center',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    background: 'var(--surface-card)',
  },
  tagAmber: {
    font: '700 11px/1 var(--font-sans)', padding: '3px 7px', borderRadius: 4,
    background: 'var(--surface-warning-soft, rgba(224,138,0,.18))', color: 'var(--status-delayed, #B26A00)', whiteSpace: 'nowrap',
  },
  tagGreen: {
    font: '700 11px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 4,
    background: 'var(--green-100, rgba(18,168,103,.18))', color: 'var(--action-success-bg, #0E8A55)', whiteSpace: 'nowrap',
  },
}
