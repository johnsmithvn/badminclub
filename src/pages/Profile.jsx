// Hồ sơ TRONG CLB đang xem — bảng `club_members`. Màn này KHÔNG sửa hồ sơ tài khoản
// (`profiles`); cái đó ở `/tai-khoan` (`Account.jsx`), ngoài CLB.
//
// Sửa được gì, không sửa được gì — ranh giới nằm dưới DB, không phải quy ước của client:
//   · TÊN (hiển thị + đầy đủ): tự đổi, không cần duyệt. Policy `cm_update_self_name` + trigger
//     `cm_guard_self_update` (0010) cho đúng hai cột đó, mọi cột khác trigger chặn.
//   · `level` là dữ liệu tính tiền và xếp sân. `money.js: levelOf` suy trình độ của MỌI tháng
//     từ đúng ô `member.level`, nên tự sửa nó là sửa lại cả những buổi đã chốt xong. Đường đúng
//     là xin đổi → `member_changes` → chủ CLB duyệt, và trình độ áp dụng TỪ THÁNG SAU.
//   · `phone` chủ CLB dùng để đối chiếu chuyển khoản và gợi ý ghép tài khoản → cũng phải duyệt.
//   · `role` không nằm trong tầm tay chủ nhân bản ghi, không bao giờ.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Icon, Input, Select } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { genderTxt, nextLevelStep, playerName } from '#lib/money.js'
import { roleName } from '#lib/roles.js'
import { getPlayerRating, rankTierOf, confidenceProgress, MIN_RATING } from '#lib/rating.js'
import { ddmy } from '#utils/dates.js'
import { PUBLIC_PATHS } from '#routes'
import { t } from '#i18n'

export default function Profile() {
  const { db, a } = useApp()
  const { clubs: myClubs, setActiveClub } = useAuth()
  const navigate = useNavigate()

  const me = (db.members || []).find((m) => m.userId === db.currentUserId) || null
  const myGroups = me ? (db.groups || []).filter((g) => (me.groupIds || []).includes(g.id)) : []
  const pending = me ? (db.changes || []).filter((c) => c.status === 'pending' && c.memberId === me.id) : []

  // Thống kê trận đấu, đối đầu & phong độ cho hồ sơ Elo
  const stats = useMemo(() => {
    if (!me) return null
    const mid = me.id
    const matches = db.matches || []
    const myMatches = []

    const partnerMap = {}
    const oppMap = {}

    matches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const inA = teamA.includes(mid)
      const inB = teamB.includes(mid)
      if (!inA && !inB) return

      const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')
      const myTeam = inA ? teamA : teamB
      const oppTeam = inA ? teamB : teamA

      myMatches.push({ ...m, won, at: m.at || (m.createdAt ? Date.parse(m.createdAt) : 0) })

      // Đồng đội (đôi)
      myTeam.forEach((pid) => {
        if (pid === mid) return
        if (!partnerMap[pid]) partnerMap[pid] = { games: 0, wins: 0 }
        partnerMap[pid].games++
        if (won) partnerMap[pid].wins++
      })

      // Đối thủ
      oppTeam.forEach((oid) => {
        if (!oppMap[oid]) oppMap[oid] = { games: 0, wins: 0 }
        oppMap[oid].games++
        if (won) oppMap[oid].wins++
      })
    })

    myMatches.sort((a, b) => (b.at || 0) - (a.at || 0))
    const total = myMatches.length
    const wins = myMatches.filter((m) => m.won).length
    const losses = total - wins
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
    const recent10 = myMatches.slice(0, 10).map((m) => (m.won ? 'W' : 'L')).reverse()

    // Biểu đồ 12 buổi gần nhất
    const sessions = [...(db.sessions || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(-12)
    const sessionBars = sessions.map((s) => {
      const count = myMatches.filter((m) => m.sessionId === s.id).length
      return {
        date: s.date ? `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}` : '—',
        count,
      }
    })
    const maxSessionCount = Math.max(1, ...sessionBars.map((b) => b.count))

    // Partner hợp nhất (games >= 2, win rate cao nhất)
    let bestPartner = null
    let maxPartnerWr = -1
    Object.entries(partnerMap).forEach(([pid, d]) => {
      if (d.games >= 2) {
        const wr = d.wins / d.games
        if (wr > maxPartnerWr || (wr === maxPartnerWr && d.games > (bestPartner?.games || 0))) {
          maxPartnerWr = wr
          bestPartner = { id: pid, name: playerName(db, pid), games: d.games, wins: d.wins, winRate: Math.round(wr * 100) }
        }
      }
    })

    // Gặp nhiều nhất
    let mostOpp = null
    let maxOppGames = 0
    Object.entries(oppMap).forEach(([oid, d]) => {
      if (d.games > maxOppGames) {
        maxOppGames = d.games
        mostOpp = { id: oid, name: playerName(db, oid), games: d.games, wins: d.wins, losses: d.games - d.wins }
      }
    })

    // Đối thủ khó nhất (games >= 2, win rate của mình thấp nhất)
    let toughestOpp = null
    let minMyWr = 2
    Object.entries(oppMap).forEach(([oid, d]) => {
      if (d.games >= 2) {
        const myWr = d.wins / d.games
        if (myWr < minMyWr || (myWr === minMyWr && d.games > (toughestOpp?.games || 0))) {
          minMyWr = myWr
          toughestOpp = { id: oid, name: playerName(db, oid), games: d.games, wins: d.wins, losses: d.games - d.wins, winRate: Math.round(myWr * 100) }
        }
      }
    })

    const pr = getPlayerRating(db.playerRatings, mid, me, db.levels)
    const displayRating = Math.max(MIN_RATING, pr.rating)
    const tier = rankTierOf(displayRating)
    const confProg = confidenceProgress(total || pr.gamesCount)

    // Milestones
    const milestones = [10, 25, 50, 100, 200, 500]
    const nextTarget = milestones.find((m) => m > total) || null

    // Tham gia buổi tập
    const allSessions = db.sessions || []
    const pastSessions = allSessions.filter((s) => s.state === 'closed' || (s.date && s.date <= new Date().toISOString().slice(0, 10)))
    const attendedCount = pastSessions.filter((s) => (s.attendance || []).some((att) => (att.memberId === mid || att.id === mid) && att.status === 'present')).length
    const attendRate = pastSessions.length > 0 ? Math.round((attendedCount / pastSessions.length) * 100) : 0

    return {
      total,
      wins,
      losses,
      winRate,
      recent10,
      sessionBars,
      maxSessionCount,
      bestPartner,
      mostOpp,
      toughestOpp,
      displayRating,
      tier,
      confProg,
      nextTarget,
      attendedCount,
      totalSessions: pastSessions.length,
      attendRate,
    }
  }, [me, db.matches, db.sessions, db.members, db.playerRatings, db.levels])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 16, alignItems: 'start' }}>
      {/* 1. Bản ghi thành viên trong CLB này */}
      <MeCard me={me} myGroups={myGroups} db={db} a={a} />

      {/* 2. Thẻ Thành tích & Elo */}
      <MemberPerformanceCard me={me} stats={stats} />

      {/* 3. Thẻ Đối đầu & Partner */}
      <MemberH2HPartnerCard me={me} stats={stats} />

      {/* 4. Thẻ Tiến trình & Cột mốc */}
      <MemberContributionCard me={me} stats={stats} />

      {/* 5. Xin đổi thông tin trong CLB — chủ CLB duyệt */}
      <ChangeCard me={me} pending={pending} db={db} a={a} />

      {/* 6. Hồ sơ tài khoản + danh sách CLB */}
      <Card title={t('profile.accountTitle')} subtitle={t('profile.accountSub')} icon="building-2" padding="14px">
        <div style={{ display: 'grid', gap: 10 }}>
          <Button variant="secondary" icon="user-round-cog" onClick={() => navigate(PUBLIC_PATHS.account)}>
            {t('profile.accountBtn')}
          </Button>
          <span style={S.caption}>{t('profile.accountNote')}</span>

          {myClubs.length === 0
            ? <Empty icon="building-2" title={t('profile.noClub')} hint={t('profile.noClubHint')} />
            : myClubs.map((c) => {
                const here = c.id === db.clubId
                return (
                  <button key={c.id} type="button" onClick={() => setActiveClub(c.id)} style={{
                    ...S.clubRow, borderColor: here ? 'var(--navy-700)' : 'var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={S.label}>{c.name}</div>
                      <Mono color="var(--text-muted)">{t('profile.clubMeta', { code: c.code, n: c.member_count })}</Mono>
                    </div>
                    <span style={S.rolePill}>{roleName(c.role)}</span>
                    {here && <span style={{ font: 'var(--type-caption)', color: 'var(--status-delivered)' }}>{t('profile.viewing')}</span>}
                  </button>
                )
              })}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- bản ghi của tôi + đổi tên ---------------- */

/**
 * Hai tên, và chỉ hai tên này là tự sửa được:
 *   · TÊN HIỂN THỊ (`name`) — cái nằm trên bảng điểm danh, bảng chia tiền, báo cáo Zalo;
 *   · TÊN ĐẦY ĐỦ (`full_name`) — chỉ để đối chiếu, hiện nhỏ bên dưới, không thay tên hiển thị
 *     ở bất cứ đâu.
 *
 * `a.renameMe` ghi thẳng DB rồi `reload()` chứ không đi qua đồng bộ ngầm — lý do nằm ở chính
 * action đó (upsert cần policy INSERT mà thành viên thường không có).
 */
function MeCard({ me, myGroups, db, a }) {
  const [loadedFor, setLoadedFor] = useState(null)
  const [name, setName] = useState('')
  const [full, setFull] = useState('')
  const [saving, setSaving] = useState(false)

  // Nạp một lần cho mỗi bản ghi, không dùng effect: `me` là phần tử của `db.members` nên đổi
  // tham chiếu mỗi lần đồng bộ, effect sẽ hất mất chữ đang gõ dở.
  if (me && loadedFor !== me.id) {
    setLoadedFor(me.id)
    setName(me.name)
    setFull(me.fullName || '')
  }

  const dirty = me && (name.trim() !== me.name || full.trim() !== (me.fullName || ''))
  const save = async () => {
    setSaving(true)
    await a.renameMe(name, full)
    setSaving(false)
  }

  return (
    <Card title={t('profile.meTitle')} subtitle={db.club.name} icon="user-round" padding="16px 18px">
      {!me
        ? <Empty icon="unlink" title={t('profile.changeNoMember')} hint={t('profile.changeNoMemberHint')} />
        : <div style={{ display: 'grid', gap: 13 }}>
            <div style={S.idRow}>
              <Avatar name={me.name} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={S.h3}>{me.name}</div>
                {me.fullName && <div style={S.caption}>{me.fullName}</div>}
                <Mono color="var(--text-muted)">{me.phone || t('common.notYet')}</Mono>
              </div>
              <div style={{ flex: 1 }} />
              <span style={S.rolePill}>{roleName(me.role)}</span>
            </div>

            {me.email && <Row label={t('members.fEmail')}><Mono>{me.email}</Mono></Row>}
            <Row label={t('auth.fGender')}>{genderTxt(me.gender)}</Row>
            <Row label={t('auth.fLevel')}>
              <LevelChip level={me.level} levels={db.levels} />
              {nextLevelStep(me, db.month) && (
                <span style={S.caption}>
                  {t('profile.levelPending', {
                    level: nextLevelStep(me, db.month).level,
                    month: nextLevelStep(me, db.month).from,
                  })}
                </span>
              )}
            </Row>
            <Row label={t('profile.fJoined')}><Mono>{ddmy(me.joined)}</Mono></Row>
            <Row label={t('profile.fGroups')}>
              {myGroups.length === 0
                ? <span style={S.caption}>{t('profile.groupsNone')}</span>
                : myGroups.map((g) => <span key={g.id} style={S.groupPill}>{g.name}</span>)}
            </Row>

            <div style={{ display: 'grid', gap: 9, paddingTop: 11, borderTop: '1px solid var(--border-subtle)' }}>
              <Overline>{t('profile.renameTitle')}</Overline>
              <Input label={t('profile.fDisplayName')} hint={t('profile.fDisplayNameHint')}
                value={name} onChange={(e) => setName(e.target.value)} />
              <Input label={t('members.fFull')} hint={t('members.fFullHint')}
                value={full} onChange={(e) => setFull(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" icon="circle-check"
                  disabled={saving || !dirty || !name.trim()} onClick={save}>
                  {saving ? t('account.saving') : t('common.save')}
                </Button>
              </div>
            </div>

            <div style={S.note}>
              <Icon name="info" size={14} />
              <span>{t('profile.snapshotNote')}</span>
            </div>
          </div>}
    </Card>
  )
}

/* ---------------- xin đổi thông tin ---------------- */

/**
 * Hai trường thôi, đúng bộ mà `appActions.requestChange` + `approveChange` xử lý được:
 * SĐT (duyệt xong áp dụng ngay) và trình độ (áp dụng từ tháng sau). Thêm ô ở đây mà không thêm
 * nhánh ở `approveChange` thì yêu cầu gửi đi rồi duyệt xong không có gì đổi.
 */
function ChangeCard({ me, pending, db, a }) {
  const [level, setLevel] = useState('')
  const [phone, setPhone] = useState('')

  if (!me) return null

  return (
    <Card title={t('profile.changeTitle')} subtitle={t('profile.changeSub')} icon="settings-2" padding="16px 18px">
      <div style={{ display: 'grid', gap: 13 }}>
        {pending.length > 0 && (
          <div style={S.pendingBox}>
            {pending.map((c) => (
              <div key={c.id}>
                {t('profile.changePending', { field: t('members.changeField.' + c.field), to: c.to })}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 6 }}>
          <Select label={t('profile.changeLevel')} value={level} onChange={(e) => setLevel(e.target.value)}
            options={[{ value: '', label: t('profile.changePick') }]
              .concat((db.levels || []).map((l) => ({ value: l, label: l })))} />
          <Button variant="secondary" size="sm" icon="send" disabled={!level}
            onClick={() => { a.requestChange('level', level); setLevel('') }}>
            {t('profile.changeSend')}
          </Button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <Input label={t('profile.changePhone')} mono value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="secondary" size="sm" icon="send" disabled={!phone.trim()}
            onClick={() => { a.requestChange('phone', phone); setPhone('') }}>
            {t('profile.changeSend')}
          </Button>
        </div>

        <span style={S.caption}>{t('profile.changeNote')}</span>
      </div>
    </Card>
  )
}

/* ---------------- Thẻ Thành tích & Phong độ Elo ---------------- */
function MemberPerformanceCard({ me, stats }) {
  if (!me) return null
  if (!stats || stats.total === 0) {
    return (
      <Card title={t('profile.performanceTitle')} subtitle={t('profile.performanceSub')} icon="trophy" padding="16px 18px">
        <Empty icon="award" title={t('profile.noMatchesPlayed')} hint={t('profile.performanceSub')} />
      </Card>
    )
  }

  return (
    <Card title={t('profile.performanceTitle')} subtitle={t('profile.performanceSub')} icon="trophy" padding="16px 18px">
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Rating to & Rank Tier */}
        <div style={S.eloHeaderBox}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('profile.eloRating')}
            </div>
            <div style={{ font: '700 28px/1.1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>
              {stats.displayRating}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${stats.tier.color}`,
              color: stats.tier.color,
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon name={stats.tier.icon} size={13} />
              <span>{stats.tier.label}</span>
            </span>
            <div style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-secondary)' }}>
              {stats.wins}W – {stats.losses}L · <strong style={{ color: stats.winRate >= 50 ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--text-primary)' }}>{stats.winRate}%</strong>
            </div>
          </div>
        </div>

        {/* Dải 10 trận gần nhất */}
        <div style={{ display: 'grid', gap: 6 }}>
          <Overline>{t('profile.recent10')}</Overline>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {stats.recent10.map((res, i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: res === 'W' ? 'rgba(18,168,103,.2)' : 'rgba(225,68,52,.2)',
                  color: res === 'W' ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--status-incident-fg, #FF9A8F)',
                  border: `1px solid ${res === 'W' ? 'var(--green-600, #00875A)' : 'rgba(225,68,52,.4)'}`,
                }}
              >
                {res}
              </span>
            ))}
          </div>
        </div>

        {/* Biểu đồ mini số trận 12 buổi gần nhất */}
        {stats.sessionBars.length > 0 && (
          <div style={{ display: 'grid', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
            <Overline>{t('profile.recentSessionsBar', { n: stats.sessionBars.length })}</Overline>
            <div style={S.barChartWrap}>
              {stats.sessionBars.map((b, idx) => {
                const heightPct = stats.maxSessionCount > 0 ? Math.max(8, Math.round((b.count / stats.maxSessionCount) * 100)) : 8
                return (
                  <div key={idx} style={S.barCol}>
                    <div style={{ fontSize: 10, color: b.count > 0 ? 'var(--text-primary)' : 'var(--text-disabled)', fontFamily: '"IBM Plex Mono", monospace' }}>
                      {b.count > 0 ? b.count : ''}
                    </div>
                    <div style={{ width: '100%', height: 46, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        borderRadius: 3,
                        background: b.count > 0 ? 'linear-gradient(180deg, var(--teal-500, #00B2A9), var(--teal-700, #00786F))' : 'rgba(255,255,255,0.06)',
                      }} />
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace', whiteSpace: 'nowrap' }}>
                      {b.date}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ---------------- Thẻ Đối đầu & Partner ---------------- */
function MemberH2HPartnerCard({ me, stats }) {
  if (!me) return null
  if (!stats || stats.total === 0) {
    return (
      <Card title={t('profile.h2hPartnerTitle')} subtitle={t('profile.h2hPartnerSub')} icon="users" padding="16px 18px">
        <Empty icon="users" title={t('profile.noH2HData')} hint={t('profile.h2hPartnerSub')} />
      </Card>
    )
  }

  return (
    <Card title={t('profile.h2hPartnerTitle')} subtitle={t('profile.h2hPartnerSub')} icon="users" padding="16px 18px">
      <div style={{ display: 'grid', gap: 10 }}>
        {/* Partner hợp nhất */}
        <div style={S.h2hBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.h2hIconWrap, color: 'var(--status-delivered-fg, #5FD9A2)', background: 'rgba(18,168,103,.15)' }}>
              <Icon name="sparkles" size={14} />
            </div>
            <div>
              <div style={S.h2hBoxLabel}>{t('profile.bestPartner')}</div>
              <div style={S.h2hBoxTitle}>
                {stats.bestPartner ? stats.bestPartner.name : '—'}
              </div>
            </div>
          </div>
          {stats.bestPartner && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 14px "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg, #5FD9A2)' }}>
                {stats.bestPartner.winRate}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {stats.bestPartner.wins}W – {stats.bestPartner.games - stats.bestPartner.wins}L
              </div>
            </div>
          )}
        </div>

        {/* Đối thủ khó nhất */}
        <div style={S.h2hBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.h2hIconWrap, color: 'var(--status-incident-fg, #FF9A8F)', background: 'rgba(225,68,52,.15)' }}>
              <Icon name="shield" size={14} />
            </div>
            <div>
              <div style={S.h2hBoxLabel}>{t('profile.toughestOpponent')}</div>
              <div style={S.h2hBoxTitle}>
                {stats.toughestOpp ? stats.toughestOpp.name : '—'}
              </div>
            </div>
          </div>
          {stats.toughestOpp && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 14px "IBM Plex Mono", monospace', color: 'var(--status-incident-fg, #FF9A8F)' }}>
                {stats.toughestOpp.winRate}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {stats.toughestOpp.wins}W – {stats.toughestOpp.losses}L
              </div>
            </div>
          )}
        </div>

        {/* Gặp nhiều nhất */}
        <div style={S.h2hBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.h2hIconWrap, color: 'var(--status-transit-fg, #5FDBD3)', background: 'rgba(0,178,169,.15)' }}>
              <Icon name="target" size={14} />
            </div>
            <div>
              <div style={S.h2hBoxLabel}>{t('profile.mostFrequentOpp')}</div>
              <div style={S.h2hBoxTitle}>
                {stats.mostOpp ? stats.mostOpp.name : '—'}
              </div>
            </div>
          </div>
          {stats.mostOpp && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 14px "IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
                {stats.mostOpp.games}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {stats.mostOpp.wins}W – {stats.mostOpp.losses}L
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ---------------- Thẻ Tiến trình & Cột mốc ---------------- */
function MemberContributionCard({ me, stats }) {
  if (!me) return null
  if (!stats) {
    return (
      <Card title={t('profile.contributionsTitle')} subtitle={t('profile.contributionsSub')} icon="sparkles" padding="16px 18px">
        <Empty icon="sparkles" title={t('profile.noMatchesPlayed')} hint={t('profile.contributionsSub')} />
      </Card>
    )
  }

  const { confProg, total, nextTarget, attendRate, attendedCount, totalSessions } = stats

  return (
    <Card title={t('profile.contributionsTitle')} subtitle={t('profile.contributionsSub')} icon="sparkles" padding="16px 18px">
      <div style={{ display: 'grid', gap: 13 }}>
        {/* Tiến trình R1 -> R5 */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={S.h2hBoxLabel}>
              {t('rating.confidence.levelR', { num: confProg.levelNum })} · {t('rating.confidence.' + (stats.tier ? 'high' : 'low'))}
            </span>
            <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>
              {confProg.current}/{confProg.target} ({confProg.pct}%)
            </span>
          </div>
          <div style={S.progressBarTrack}>
            <div style={{ ...S.progressBarFill, width: `${confProg.pct}%` }} />
          </div>
        </div>

        {/* Cột mốc trận đấu tiếp theo */}
        <div style={{ display: 'grid', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={S.h2hBoxLabel}>{t('profile.nextMilestone')}</span>
            <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
              {nextTarget ? t('profile.milestoneProgress', { current: total, target: nextTarget }) : t('profile.milestoneReached')}
            </span>
          </div>
          {nextTarget && (
            <div style={S.progressBarTrack}>
              <div style={{
                ...S.progressBarFill,
                width: `${Math.min(100, Math.round((total / nextTarget) * 100))}%`,
                background: 'linear-gradient(90deg, var(--amber-600, #C26A00), var(--status-delayed-fg, #F0B75C))',
              }} />
            </div>
          )}
        </div>

        {/* Tỷ lệ tham dự buổi */}
        <div style={{ display: 'grid', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={S.h2hBoxLabel}>{t('profile.attendanceRate')}</span>
            <span style={{ font: '700 14px "IBM Plex Mono", monospace', color: attendRate >= 70 ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--text-primary)' }}>
              {attendRate}%
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {t('profile.attendanceRateSub', { attended: attendedCount, total: totalSessions })}
          </div>
        </div>
      </div>
    </Card>
  )
}

const Row = ({ label, children }) => (
  <div style={S.row}>
    <span style={S.rowLabel}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
  </div>
)

const S = {
  h3: { font: 'var(--type-h3)', color: 'var(--text-primary)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  idRow: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)',
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  rowLabel: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)',
  },
  groupPill: {
    font: '600 11px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 6,
    background: 'var(--surface-accent-soft)', color: 'var(--teal-700)',
  },
  clubRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
    border: '1px solid', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit',
  },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 8,
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)', font: 'var(--type-caption)',
  },
  pendingBox: {
    display: 'grid', gap: 4, padding: '9px 11px', borderRadius: 8,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: 'var(--type-caption)',
  },
  eloHeaderBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    flexWrap: 'wrap',
    gap: 10,
  },
  barChartWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 8,
    height: 76,
    overflowX: 'auto',
  },
  barCol: {
    flex: 1,
    minWidth: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  h2hBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    gap: 8,
  },
  h2hIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  h2hBoxLabel: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  h2hBoxTitle: {
    font: '600 13.5px "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 999,
    background: 'var(--surface-inset, #101927)',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--teal-700, #00786F), var(--teal-500, #00B2A9))',
    transition: 'width 0.3s ease',
  },
}
