// Mọi hành động ghi dữ liệu. Mỗi hành động bắn toast bằng tiếng Việt nói rõ đã làm gì và hệ quả.
// Quy ước: dbRef.current = db hiện tại (đọc để tính text toast), setDb(partial) để ghi.

import { addMonth, dd, ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import cfg from '#config/app.json' with { type: 'json' }
import {
  courtCost, courtOf, courtTxt, fmt, fmtK, freezeCost, groupMembers, groupOf, guestOf, guestPrice, memberOf,
  presentCount, rowCost, sGuests, guestRev, sessionMembers, isPresent,
  sessionOf, timeTxt, unfrozenCost,
  adjustRows, adjustSessions, lockDues, regroupDues, dueState, intOf, memberRefs, groupRefs, sessionRefs, joinDues,
  adhocCharges, chargeName, isVault, sGuestsOnly, normalizeText, myMember, playerName,
} from '#lib/money.js'
import { CATS, fundBalance, groupKey, ledger, undoTarget } from '#lib/ledger.js'
import { modeToast, activeCourtIdxs, arrange, autoSplit, courtSlotIds, matchStats, place, removePlayer, sessionPlayers, slotCourtIdx } from '#lib/assign.js'
import { can, membersWithPerm, roleDesc, roleName, viewAsOptions } from '#lib/roles.js'
import { applyScheduleEdit, planScheduleDelete, planScheduleEdit } from '#lib/schedules.js'
import { teamRating, replayRatingCascade, DEFAULT_RATING, MIN_RATING, applyRatingDelta, calcPlayerDeltas, rankTierOf, initialRatingOf, computeClubCalibration, confidenceOf } from '#lib/rating.js'
import { nextChallengeCode, isChallengeFullyAccepted, getChallengeSeriesProgress, canMemberPredict, availableSeasonPoints, settlePredictionsLocal, expiredChallenges, orphanedChallenges, abandonedChallenges, isChallengeAccepted, validateStakePoints } from '#lib/challenge.js'
import { resolveVenue } from '#lib/forms.js'
import { supabase, unwrap } from '#supabase'
import { pathOf, buildPushUrl } from '#routes'
import { t } from '#i18n'
import { getMemberStreak } from '#lib/badges.js'
import { seasonMatchesOf, calculateSeasonLeaderboard } from '#lib/season.js'
import { buildMatchBackup, validateMatchBackup } from '#lib/matchBackup.js'
import cfgBadges from '#config/badges.json' with { type: 'json' }
import { syncPatchMatchViews, syncPatchMatchVideo } from '#contexts/storage.js'
import { detectMatchNarrative, notifyRecipients, notifiableMemberIds, resolveNotificationPayload } from '#lib/activity.js'

/** Id của mọi bản ghi mới. Trùng kiểu uuid của Postgres nên client ghi thẳng được, khỏi map id. */
const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Các trường SỐ của một nhóm cố định — dùng để biết ô nhập nào phải đi qua intOf. */
const GROUP_NUM = ['feeNam', 'feeNu', 'unitNam', 'unitNu']

/** Cache lưu thao tác tự điểm danh gần nhất của thành viên để chống spam click liên tục */
const recentSelfCheckins = new Map()

/** Cache chống bắn trùng thông báo điểm danh cùng loại trong thời gian ngắn */
const recentAttendanceEvents = new Map()

/**
 * Sự kiện được đẩy lên MÀN KHOÁ điện thoại. Danh sách này cố ý NGẮN.
 *
 * Tiêu chí: chỉ những việc cần người nhận PHẢN HỒI, và bỏ lỡ thì hỏng việc. Mọi loại khác vẫn
 * vào chuông trong app như thường — bỏ khỏi đây chỉ là không rung máy.
 *
 * Lý do phải khắt khe: hộp thông báo chỉ nạp 100 dòng mới nhất (`reloadNotifications`), và
 * người bị rung vì việc không đáng sẽ tắt quyền thông báo — mất luôn những cái đáng đọc.
 */
const PUSH_EVENTS = new Set([
  'challenge_created',   // bị thách đấu — phải nhận/từ chối trước khi kèo hết hạn 60 phút
  'challenge_teammate',  // bị xếp đánh cặp — kèo không thành nếu thiếu chữ ký của họ
  'challenge_cancelled', // kèo biến mất, và phiếu dự đoán được hoàn
  'session_rsvp_invite', // mở điểm danh — quản trò cần câu trả lời để xếp sân

  // ---- ĐÃ BỎ khỏi push (vẫn còn chuông trong app) ----
  // 'challenge_accepted'  'challenge_declined'  'challenge_completed'
  //      Không gấp: mở app là thấy. Một kèo sinh tới 4 thông báo cho cùng nhóm người,
  //      đánh 5 kèo một buổi là 20 lần rung máy.
  // 'bounty_broken'
  //      Tin vui, không phải việc cần làm.
  // 'session_cancelled'
  //      Giữ chuông; người đã điểm danh sẽ thấy khi mở app.
  //
  // ---- TẠM TẮT: phần TIỀN, chờ test kỹ cơ chế chống spam ----
  // 'claim_submitted'  'claim_approved'  'claim_rejected'
  // 'refund_session'   'refund_bulk'
  //      Dồn vào cuối tháng, dễ bắn hàng loạt. Bật lại sau khi đã đo thực tế.
])

export function makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast, reload }) {
  const db = () => dbRef.current
  /** Form đang nhập — đọc qua ref, KHÔNG đọc qua updater của setUi (updater không chạy đồng bộ). */
  const form = () => uiRef.current.form || {}
  /**
   * Ghi db: fn(d) trả về phần thay đổi.
   *
   * `d` có thể là null: đổi CLB làm `setDb(null)` (xem AppContext), nên mọi action async đang
   * chờ (`reloadNotifications`, các `.then` của Supabase) khi quay lại sẽ chạy fn(null) và ném
   * "Cannot read properties of null" — React không có error boundary nên gỡ sạch cây, người
   * dùng thấy màn "Lỗi khởi động ứng dụng". Bỏ qua patch là đúng: CLB cũ không còn trên màn.
   */
  const up = (fn) => setDb((d) => (d ? { ...d, ...fn(d) } : d))

  /**
   * Ghi/đè một dòng đối chiếu buổi. Lần đầu chạm vào là LƯU con số hiện tại — từ đó sửa điểm
   * danh hay sửa quỹ nhóm không làm đổi khoản đã chốt nữa.
   */
  const upsertAdjust = (d, row, patch) => {
    const list = (d.adjustments || []).slice()
    const i = list.findIndex((x) => x.key === row.key)
    const base = i >= 0 ? list[i] : {
      id: uid(), key: row.key, month: row.month, groupId: row.groupId, memberId: row.memberId,
      kind: row.kind, sessions: row.sessions, unit: row.unit, amount: row.amount,
      settle: (row && row.settle) || 'cash', paid: false, paidAt: null,
      settledSessions: [],
    }
    const next = { ...base, ...patch }
    if (i >= 0) list[i] = next
    else list.push(next)
    return list
  }

  const upUi = (fn) => setUi((u) => ({ ...u, ...fn(u) }))
  const myRole = () => db().viewAs || 'owner'

  /**
   * Chia sân ghi xuống `session_lineups` · `session_court_groups` · `matches` · `match_players`,
   * mà RLS gác cả bốn bằng cờ `assign` (`0002_auth_rls.sql:409`). Vai `member` CÓ route `assign`
   * (handoff: 3 màn mobile của thành viên) nhưng KHÔNG có cờ đó.
   *
   * Không chặn ở đây thì: member kéo một người → Supabase từ chối → `flush()` ném lỗi → ảnh chụp
   * đồng bộ không cập nhật → op hỏng phát lại mãi và **cả hàng đợi kẹt**, trong khi màn hình vẫn
   * báo đã lưu. Chặn bằng toast, không disable im lặng (ARCHITECTURE §4 quy ước 2).
   */
  const canAssign = () => {
    if (can(myRole(), 'assign')) return true
    toast(t('toast.noAssignPerm'))
    return false
  }

  /** Danh sách cố định của một tháng, suy từ groupIds nếu tháng đó chưa có bản ghi riêng. */
  const ensureRoster = (d, month) => {
    if (d.roster[month]) return d.roster[month]
    const r = {}
    d.groups.forEach((g) => {
      r[g.id] = {}
      d.members.filter((m) => (m.groupIds || []).indexOf(g.id) >= 0).forEach((m) => { r[g.id][m.id] = 'fixed' })
    })
    return r
  }

  /**
   * Buổi ĐỘT XUẤT: đồng bộ dòng thu theo giá giao lưu với bảng điểm danh vừa đổi. Gọi từ MỌI
   * đường sửa điểm danh (toggleAtt · addExtra · removeExtra · markAll) — sót một đường là có
   * người đánh mà không có dòng tiền, và không màn nào lộ ra chuyện đó.
   * Công thức thuần nằm ở `money.js: adhocCharges`; đây chỉ gắn `id`.
   */
  const withAdhocCharges = (d, sid, att) => {
    const { add, remove } = adhocCharges(d, sessionOf(d, sid), att)
    if (!add.length && !remove.length) return {}
    return {
      sessionGuests: d.sessionGuests
        .filter((g) => remove.indexOf(g.id) < 0)
        .concat(add.map((r) => ({ id: uid(), ...r }))),
    }
  }

  /** Điều hướng qua React Router. */
  const nav = (key, id) => {
    if (!navRef.current) return
    if (typeof key === 'string' && key.startsWith('/')) {
      navRef.current(key)
    } else {
      navRef.current(pathOf(key, id))
    }
  }

  const patchSession = (sid, fn) =>
    up((d) => ({ sessions: d.sessions.map((x) => (x.id === sid ? fn(x, d) : x)) }))

  /**
   * Quyết toán hoặc hoàn phiếu dự đoán của một kèo.
   *
   * Đi qua RPC `settle_challenge_predictions` chứ KHÔNG qua đường đồng bộ chung: 0041 đã revoke
   * UPDATE của `authenticated` trên `challenge_predictions`, mà đồng bộ chung ghi bằng
   * `.upsert(onConflict:'id')` — Postgres đòi quyền UPDATE cho câu đó ngay lúc lập kế hoạch nên
   * mọi lượt ghi trả 42501, và vì bảng đứng trước `player_ratings` trong hàng đợi, nó kéo theo
   * cả Elo không được lưu. Xem `dbmap.js: TABLES` và migration 0042.
   *
   * @param winnerTeam 'A' | 'B' để chia thắng thua; null để hoàn phiếu (huỷ / từ chối / hết hạn).
   */
  const settlePredictions = (challengeId, winnerTeam) => {
    if (!challengeId) return
    const d0 = db()
    const touched = (d0.challengePredictions || []).some((p) => (
      p.challengeId === challengeId
      && (p.status === 'pending' || ((winnerTeam === 'A' || winnerTeam === 'B') && (p.status === 'won' || p.status === 'lost')))
    ))
    if (!touched) return // Kèo không ai cược thì khỏi gọi server

    const at = new Date().toISOString()
    up((d) => ({
      challengePredictions: settlePredictionsLocal(d.challengePredictions, challengeId, winnerTeam || null, at),
    }))

    if (!supabase) return
    supabase
      .rpc('settle_challenge_predictions', { p_challenge_id: challengeId, p_winner_team: winnerTeam || null })
      .then(({ error }) => {
        if (!error) return
        console.warn('[prediction] settle error:', error.message)
        // State vừa cập nhật lạc quan giờ là lời nói dối. Nạp lại cho màn hình nói thật.
        toast(t('challenge.predictionSettleFailed'))
        reload()
      })
  }

  const emitEvent = ({
    type,
    payload = {},
    recipients = [],
    refType = null,
    refId = null,
    actorId = null,
    skipActivity = false,
  }) => {
    const d0 = db()
    const clubId = d0.clubId
    const effectiveActorId = actorId || myMember(d0)?.id || null
    const now = new Date().toISOString()

    // Chống bắn trùng thông báo điểm danh cho cùng người, cùng buổi, cùng trạng thái
    if (type === 'attendance_reported') {
      const eventKey = `${type}:${effectiveActorId}:${refId}:${payload?.status}`
      const lastSent = recentAttendanceEvents.get(eventKey)
      if (lastSent && Date.now() - lastSent < 3000) {
        return
      }
      recentAttendanceEvents.set(eventKey, Date.now())
      if (recentAttendanceEvents.size > 100) {
        const curTime = Date.now()
        for (const [k, v] of recentAttendanceEvents.entries()) {
          if (curTime - v > 10000) recentAttendanceEvents.delete(k)
        }
      }
    }

    // 1. Social Activity (chỉ DB, không vào db state)
    if (!skipActivity && clubId && supabase) {
      supabase
        .from('activity_events')
        .insert({
          club_id: clubId,
          actor_id: effectiveActorId,
          type,
          payload,
          ref_type: refType,
          ref_id: refId,
          created_at: now,
        })
        .then(({ error }) => {
          if (error) console.warn('[activity] insert error:', error.message)
        })
    }

    // 2. Personal Notifications — xem `notifyRecipients` để biết vì sao phải lọc theo members
    // Chỉ người ĐÃ LIÊN KẾT TÀI KHOẢN mới đọc được thông báo — xem `notifiableMemberIds`.
    const memberIds = notifiableMemberIds(d0.members)
    const validRecipients = notifyRecipients(recipients, effectiveActorId, memberIds)

    if (validRecipients.length > 0 && clubId && supabase) {
      supabase
        .from('notifications')
        .insert(validRecipients.map((recId) => ({
          id: uid(),
          club_id: clubId,
          member_id: recId,
          type,
          payload,
          ref_type: refType,
          ref_id: refId,
          created_at: now,
        })))
        .then(({ error }) => {
          if (error) console.warn('[notifications] insert error:', error.message)
        })

      // 3. Web Push Notifications
      if (PUSH_EVENTS.has(type)) {
        const rp = resolveNotificationPayload({ type, payload, refId }, d0)
        const notifKey = (type === 'challenge_created' && !rp.creator) ? 'challenge_created_simple' : type
        const text = t(`notification.${notifKey}`, rp)
        const deepUrl = buildPushUrl({ type, refType, refId, clubId })
        // `functions.invoke` KHÔNG reject: lỗi HTTP (401/403/500) được bắt bên trong và trả về
        // qua `error` — `.catch()` chỉ bắt được lỗi mạng. Đọc `error` ở `.then`, không thì
        // Edge Function hỏng mà console sạch trơn, không có gì để lần.
        supabase.functions.invoke('push-send', {
          body: {
            member_ids: validRecipients,
            club_id: clubId,
            title: d0.club?.name || 'BadminClub',
            body: text,
            url: deepUrl,
            tag: refId ? `${type}_${refId}` : undefined,
          },
        })
          .then(({ data, error }) => {
            if (error) return console.warn('[push] gửi thất bại:', error)
            // Function trả 200 ngay cả khi không gửi được cái nào (không có subscription, hoặc
            // mọi lượt gửi đều lỗi). Không nói ra thì đứng ngoài nhìn y hệt lúc thành công.
            if (data && (data.sentCount === 0 || data.failedCount > 0)) {
              console.warn('[push] không gửi được:', type, data)
            }
          })
          .catch((e) => console.warn('[push] gửi thất bại:', e))
      }
    }
  }

  /**
   * Đưa phiếu đã ăn/thua về lại trạng thái chờ. Dùng khi gỡ trận làm chuỗi kèo quay về dang dở:
   * để nguyên thì phiếu đứng theo một kết quả đã bị xoá, và điểm mùa sai cho tới khi có người
   * nhập lại tỷ số.
   */
  const unsettlePredictions = (challengeId) => {
    const d0 = db()
    const touched = (d0.challengePredictions || []).some(
      (p) => p.challengeId === challengeId && (p.status === 'won' || p.status === 'lost')
    )
    if (!touched) return

    up((d) => ({
      challengePredictions: (d.challengePredictions || []).map((p) => (
        p.challengeId === challengeId && (p.status === 'won' || p.status === 'lost')
          ? { ...p, status: 'pending', payoutPoints: 0, settledAt: null, updatedAt: new Date().toISOString() }
          : p
      )),
    }))

    if (!supabase) return
    supabase.rpc('unsettle_challenge_predictions', { p_challenge_id: challengeId }).then(({ error }) => {
      if (!error) return
      console.warn('[prediction] unsettle error:', error.message)
      toast(t('challenge.predictionSettleFailed'))
      reload()
    })
  }

  const A = {
    /* ---------- điều hướng, tháng, tab, form ---------- */
    go: (key, id) => nav(key, id),
    openSession: (id) => {
      setDb((d) => ({ ...d, sessionId: id }))
      nav('session', id)
    },
    shiftMonth: (delta) => up((d) => ({ month: addMonth(d.month, delta) })),
    /** Đồng bộ buổi đang xem theo URL — các action như addGuest/addSessionCourt dùng db.sessionId. */
    setSessionId: (id) => setDb((d) => (d.sessionId === id ? d : { ...d, sessionId: id })),
    setTab: (k, v) => upUi((u) => ({ tab: { ...u.tab, [k]: v } })),
    setF: (k, v) => upUi((u) => ({ form: { ...u.form, [k]: v } })),
    openDialog: (name, form = {}) => upUi(() => ({ dialog: name, form })),
    closeDialog: () => upUi(() => ({ dialog: null, form: {} })),
    confirm: (options) => {
      const c = typeof options === 'string' ? { message: options } : options
      upUi(() => ({ confirm: c }))
    },
    alert: (options) => {
      const c = typeof options === 'string'
        ? { message: options, alertOnly: true, confirmText: t('common.close') }
        : { ...options, alertOnly: true, confirmText: options.okText || options.confirmText || t('common.close') }
      upUi(() => ({ confirm: c }))
    },
    closeConfirm: () => upUi(() => ({ confirm: null })),
    toggleExpand: (k) => upUi((u) => ({ expanded: { ...u.expanded, [k]: !u.expanded[k] } })),
    setAllExpanded: (map) => upUi(() => ({ expanded: map })),
    toast,

    /* ---------- CLB, vai, tài khoản ---------- */
    setViewAs: (v) => {
      // Chỉ cho xem như vai của mình hoặc yếu hơn — xem viewAsOptions.
      if (viewAsOptions(db().myRole).indexOf(v) < 0) return toast(t('toast.viewAsDenied'))
      up(() => ({ viewAs: v }))
      toast(t('toast.viewAs', { role: roleName(v), desc: roleDesc(v) }))
    },
    setMemberRole: (mid, role) => {
      if (!can(myRole(), 'members')) return toast(t('toast.noMemberPerm'))
      up((d) => ({ members: d.members.map((m) => (m.id === mid ? { ...m, role } : m)) }))
      toast(t('toast.roleChanged', { name: memberOf(db(), mid).name, role: roleName(role) }))
    },
    linkMemberUser: (mid, uid) => {
      if (!uid) return toast(t('toast.pickMemberRecord'))
      // Một user chỉ gắn 1 bản ghi trong 1 CLB: bản ghi cũ tự bị bỏ ghép.
      up((d) => ({
        members: d.members.map((m) => {
          if (m.id === mid) return { ...m, userId: uid, linkedAt: d.today }
          if (m.userId === uid) return { ...m, userId: null }
          return m
        }),
      }))
      const u = db().users.find((x) => x.id === uid)
      toast(t('toast.linked', { name: memberOf(db(), mid).name, account: u ? u.name : uid }))
    },
    /**
     * Tra một tài khoản theo email CHÍNH XÁC để ghép. Đi qua RPC `find_member_candidate`
     * (0013) vì RLS giấu `profiles`: client không đọc được tài khoản chưa dính tới CLB này.
     *
     * Trả `{ id, name, alreadyInClub }` hoặc `null`. Cố ý KHÔNG tự ghép — người bấm phải nhìn
     * tên rồi tự xác nhận, vì ghép sai là gán lịch sử điểm danh và tiền của người này sang
     * tài khoản người khác.
     */
    findMemberCandidate: async (email) => {
      const q = (email || '').trim()
      if (!q) return null
      const rows = unwrap(await supabase.rpc('find_member_candidate', {
        p_club: db().clubId, p_email: q,
      }))
      const r = (rows || [])[0]
      return r ? { id: r.id, name: r.name, alreadyInClub: !!r.already_in_club } : null
    },
    unlinkMember: (mid) => {
      up((d) => ({ members: d.members.map((m) => (m.id === mid ? { ...m, userId: null } : m)) }))
      toast(t('toast.unlinked'))
    },
    // Mời qua SĐT đã gỡ khỏi client: phần TẠO bản ghi chạy được nhưng phần NHẬN (mở link →
    // tạo tài khoản → tự ghép) chưa có, nên nút chỉ hứa suông. Bảng `club_invites` và cột
    // `clubs.allow_invite` giữ nguyên dưới DB, chờ làm thành một module riêng có gửi tin thật.
    // Hai hành động dưới KHÔNG đi qua đồng bộ ngầm: người xin vào chưa phải thành viên nên
    // client không có quyền ghi thẳng. Gọi RPC (SECURITY DEFINER) rồi nạp lại CLB.
    /**
     * `fields`: các trường (`lib/members.js: MERGE_FIELDS`) chủ CLB tick để lấy từ hồ sơ tài
     * khoản đè lên bản ghi thành viên. Rỗng = chỉ gắn tài khoản, giữ nguyên dữ liệu CLB đang
     * dùng để tính tiền — đó là mặc định, và là hành vi trước 0009.
     *
     * Chỉ có nghĩa khi GHÉP (`mid` khác rỗng). Nhánh tạo mới lấy trọn hồ sơ vì không có dữ
     * liệu cũ nào để giữ; RPC bỏ qua `p_fields` ở nhánh đó.
     */
    approveJoin: async (rid, mid, fields) => {
      const d0 = db()
      const req = (d0.joinRequests || []).find((r) => r.id === rid)
      if (!req) return
      const u = d0.users.find((x) => x.id === req.userId)
      const name = mid ? memberOf(d0, mid).name : ''
      const take = mid ? (fields || []) : []
      try {
        unwrap(await supabase.rpc('approve_join_request', {
          p_request: rid, p_member_id: mid || null, p_fields: take,
        }))
      } catch (e) {
        // DB chưa apply 0009 thì hàm 3 tham số không tồn tại và PostgREST trả nguyên văn
        // "Could not find the function public.approve_join_request(...) in the schema cache" —
        // câu đó không nói cho ai biết phải làm gì.
        const m = String(e.message || '')
        return toast(/approve_join_request|schema cache/i.test(m) ? t('sync.needMigrate') : m)
      }
      await reload()
      const targetMemberId = mid || db().members.find((m) => m.userId === req.userId)?.id
      if (targetMemberId) {
        // TẮT theo yêu cầu: toàn bộ thông báo mục Thành viên (cả chuông lẫn push).
        // Người vừa được duyệt đang đứng ngay trong app và thấy CLB hiện ra — dòng thông báo
        // không thêm thông tin gì. Bật lại: bỏ comment khối dưới.
        // emitEvent({
        //   type: 'join_approved',
        //   payload: { clubId: d0.clubId, memberId: targetMemberId },
        //   recipients: [targetMemberId],
        //   refType: 'member',
        //   refId: targetMemberId,
        //   skipActivity: true,
        // })
        emitEvent({
          type: 'member_joined',
          payload: { memberId: targetMemberId },
          recipients: [],
          refType: 'member',
          refId: targetMemberId,
        })
      }
      if (!mid) return toast(t('toast.memberCreatedFromUser', { account: u ? u.name : '' }))
      // Ghi đè trường nào phải nói ra: đó là dữ liệu CLB vừa bị thay, và không có đường lùi.
      toast(take.length
        ? t('toast.linkedFields', {
            name, account: u ? u.name : '',
            fields: take.map((f) => t('members.changeField.' + f)).join(', '),
          })
        : t('toast.linked', { name, account: u ? u.name : '' }))
    },
    rejectJoin: async (rid) => {
      const d0 = db()
      const req = (d0.joinRequests || []).find((r) => r.id === rid)
      try {
        unwrap(await supabase.rpc('reject_join_request', { p_request: rid }))
      } catch (e) {
        return toast(e.message)
      }
      await reload()
      // TẮT theo yêu cầu: toàn bộ thông báo mục Thành viên (cả chuông lẫn push).
      // if (req?.matchedMemberId) {
      //   emitEvent({
      //     type: 'join_rejected',
      //     payload: { clubId: d0.clubId },
      //     recipients: [req.matchedMemberId],
      //     refType: 'member',
      //     refId: req.id,
      //     skipActivity: true,
      //   })
      // }
      toast(t('toast.joinRejected'))
    },
    toggleLinkMode: (k) => {
      up((d) => {
        const lm = { code: true, invite: true, phone: true, ...d.club.linkModes }
        lm[k] = !lm[k]
        return { club: { ...d.club, linkModes: lm } }
      })
    },

    /* ---------- điểm danh ---------- */
    toggleAtt: (sid, mid) =>
      up((d) => {
        const a = { ...d.attendance }
        const m = { ...(a[sid] || {}) }
        // Người đi thêm không có trạng thái "vắng" — họ không cố định nhóm này nên không nợ
        // buổi nào. Muốn bỏ thì bấm nút xoá.
        if (m[mid] === 'extra') return {}

        // Vòng 3 trạng thái. Thứ tự CỐ Ý đặt 'noshow' ở CUỐI: Có mặt ↔ Vắng vẫn là một cú bấm
        // như trước, giữ nguyên thói quen của quản trò. Nghỉ không báo là ca hiếm nên đứng sau,
        // bấm quá tay cũng chỉ rơi vào nó rồi quay về Có mặt, không mất bước nào.
        //   chưa điểm danh → Có mặt → Vắng → Nghỉ không báo → Có mặt → …
        const next = m[mid] === true ? false
          : m[mid] === false ? 'noshow'
            : true
        m[mid] = next
        a[sid] = m

        // Chỉ 'Có mặt' mới được đứng trên sân. Vắng hay nghỉ không báo đều phải gỡ khỏi lineup —
        // để sót là quản trò xếp sân cho một người không có ở đó.
        const onCourt = next === true
        let lineups = d.lineups
        if (!onCourt && d.lineups?.[sid]) {
          const sLineup = { ...d.lineups[sid] }
          let changed = false
          Object.keys(sLineup).forEach((slotId) => {
            if (sLineup[slotId] === mid) {
              delete sLineup[slotId]
              changed = true
            }
          })
          if (changed) lineups = { ...d.lineups, [sid]: sLineup }
        }

        return { attendance: a, lineups, ...withAdhocCharges(d, sid, m) }
      }),
    /** Thêm người đi thêm: thành viên nhóm khác hôm nay có đánh. Sinh khoản THU ở đối chiếu. */
    addExtra: (sid, mid) => {
      if (!mid) return toast(t('toast.needMember'))
      up((d) => {
        const m = { ...(d.attendance[sid] || {}), [mid]: 'extra' }
        return { attendance: { ...d.attendance, [sid]: m }, ...withAdhocCharges(d, sid, m) }
      })
      toast(t('toast.extraAdded', { name: memberOf(db(), mid).name }))
    },
    removeExtra: (sid, mid) => {
      up((d) => {
        const m = { ...(d.attendance[sid] || {}) }
        delete m[mid]
        let lineups = d.lineups
        if (d.lineups?.[sid]) {
          const sLineup = { ...d.lineups[sid] }
          let changed = false
          Object.keys(sLineup).forEach((slotId) => {
            if (sLineup[slotId] === mid) {
              delete sLineup[slotId]
              changed = true
            }
          })
          if (changed) lineups = { ...d.lineups, [sid]: sLineup }
        }
        return { attendance: { ...d.attendance, [sid]: m }, lineups, ...withAdhocCharges(d, sid, m) }
      })
      toast(t('toast.extraRemoved'))
    },
    markAll: (sid, val) => {
      up((d) => {
        const s = sessionOf(d, sid)
        const a = { ...d.attendance }
        // Bắt đầu từ bảng cũ chứ không bảng rỗng: "tất cả có mặt/vắng" chỉ nói về danh sách
        // CỐ ĐỊNH, không được hất người đi thêm ra khỏi buổi.
        const m = { ...(a[sid] || {}) }
        groupMembers(d, s.groupId, monthOf(s.date)).forEach((x) => { m[x.id] = val })
        a[sid] = m

        let lineups = d.lineups
        if (!val && d.lineups?.[sid]) {
          lineups = { ...d.lineups, [sid]: {} }
        }

        return { attendance: a, lineups, ...withAdhocCharges(d, sid, m) }
      })
      toast(t(val ? 'toast.allPresent' : 'toast.allAbsent'))
    },

    /* ---------- sân của buổi ---------- */
    setSold: (sid, i, k, v) =>
      patchSession(sid, (x) => {
        const rows = (x.courts || []).slice()
        rows[i] = { ...rows[i], [k]: k === 'soldAmount' ? intOf(v) : v }
        return { ...x, courts: rows }
      }),
    toggleCourtSold: (sid, i) =>
      patchSession(sid, (x, d) => {
        const rows = (x.courts || []).slice()
        const r = rows[i]
        rows[i] = r.sold
          ? { ...r, sold: false, soldAmount: 0, soldTo: '' }
          : { ...r, sold: true, soldAmount: Math.round(rowCost(d, r) / 1000) * 1000 }
        return { ...x, courts: rows }
      }),
    addSessionCourt: () => {
      const f = form()
      const sid = db().sessionId
      up((d) => ({
        sessions: d.sessions.map((x) =>
          x.id === sid
            ? {
                ...x,
                courts: (x.courts || []).concat([
                  { courtId: f.acCourt, label: (f.acLabel || '').trim(), from: f.acFrom, to: f.acTo, sold: false, soldAmount: 0, soldTo: '', extra: true },
                ]),
              }
            : x
        ),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtAdded'))
    },
    setSessionCourtLabel: (sid, courtIndex, label) => {
      patchSession(sid, (x) => {
        const rows = (x.courts || []).slice()
        if (!rows[courtIndex]) return x
        rows[courtIndex] = { ...rows[courtIndex], label: (label || '').trim() }
        return { ...x, courts: rows }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtLabelUpdated'))
    },
    /** Ghi chú của một buổi. Cột `sessions.note` có sẵn dưới DB và đã map hai chiều từ lâu,
     *  chỉ là chưa có ô nhập nào. */
    setSessionNote: (sid, v) => patchSession(sid, (x) => ({ ...x, note: v })),
    setSessionPlanner: (sid, planner) => patchSession(sid, (x) => ({ ...x, planner })),
    saveSessionWish: (sid, wish) => {
      if (!wish || !wish.memberId) return false
      patchSession(sid, (x) => {
        const p = x.planner || {}
        const curWishes = Array.isArray(p.wishes) ? p.wishes : []
        const exists = curWishes.some((w) => w.id === wish.id || w.memberId === wish.memberId)
        const nextWishes = exists
          ? curWishes.map((w) => (w.id === wish.id || w.memberId === wish.memberId ? { ...w, ...wish } : w))
          : [...curWishes, wish]
        return {
          ...x,
          planner: {
            ...p,
            wishes: nextWishes,
          },
        }
      })
      toast(t('session.myWishSaved'))
      return true
    },
    deleteSessionWish: (sid, wishId) => {
      if (!wishId) return false
      patchSession(sid, (x) => {
        const p = x.planner || {}
        const curWishes = Array.isArray(p.wishes) ? p.wishes : []
        return {
          ...x,
          planner: {
            ...p,
            wishes: curWishes.filter((w) => w.id !== wishId),
          },
        }
      })
      toast(t('session.myWishDeleted'))
      return true
    },

    /**
     * XOÁ CỨNG một buổi — chỉ khi chưa ai chạm vào (`money.js: sessionRefs`). Sáu bảng con
     * cascade theo `sessions`, nên xoá buổi đã có dấu vết là mất điểm danh, trận và tiền khách
     * đã thu, âm thầm. Có dấu vết thì dùng Huỷ.
     */
    deleteSession: (sid) => {
      const d0 = db()
      const was = sessionOf(d0, sid)
      if (!was) return
      const why = sessionRefs(d0, sid)
      if (why.length) {
        return toast(t('toast.sessionHasRefs', {
          why: why.map((k) => t('session.ref.' + k)).join(', '),
        }))
      }
      up((d) => ({ sessions: d.sessions.filter((x) => x.id !== sid) }))
      toast(t('toast.sessionDeleted', { date: dd(was.date) }))
    },

    removeSessionCourt: (sid, i) =>
      patchSession(sid, (x) => {
        const rows = (x.courts || []).slice()
        rows.splice(i, 1)
        return { ...x, courts: rows }
      }),

    /* ---------- trạng thái buổi ---------- */
    setSessionStatus: (sid, st) => {
      const ss = sessionOf(db(), sid)
      const dateStr = ss?.date ? dd(ss.date) : ''
      // Bấm lại đúng trạng thái đang có thì không có gì xảy ra để mà kể.
      const changed = ss && ss.status !== st
      up((d) => ({
        sessions: d.sessions.map((x) => {
          if (x.id !== sid) return x
          const base = { ...x, status: st, closedAt: st === 'closed' ? d.today : x.closedAt }
          return st === 'closed'
            ? { ...base, ...freezeCost(d, base) }
            : { ...base, ...unfrozenCost(base) }
        }),
      }))
      if (changed && st === 'open') {
        emitEvent({
          type: 'session_opened',
          payload: { sessionId: sid, date: dateStr },
          recipients: [],
          refType: 'session',
          refId: sid,
        })
        const cur = sessionOf(db(), sid)
        // MỘT BUỔI CHỈ MỜI MỘT LẦN. `rsvpInvitedAt` (migration 0051) là chốt chặn: đóng rồi mở
        // lại — sửa sân, sửa giờ, hay chỉ để test — không mời lại lần nào nữa. Lọc "người chưa
        // trả lời" thôi thì chưa đủ, vì đúng nhóm chưa kịp trả lời lại là nhóm bị nã nhiều nhất.
        // Muốn mời lại có chủ đích: đặt `rsvp_invited_at = NULL` cho buổi đó dưới DB.
        //
        // Vẫn lọc theo TỪNG NGƯỜI trong lần mời duy nhất đó: quản trò tick sẵn vài người lúc
        // còn nháp là chuyện thường, chặn cả buổi vì mấy người đó là những người còn lại mất mời.
        const att = db().attendance?.[sid] || {}
        if (cur?.groupId && !cur.rsvpInvitedAt) {
          const inviteeIds = groupMembers(db(), cur.groupId, monthOf(cur.date || db().today))
            .map((m) => m.id)
            .filter((id) => att[id] === undefined)
          if (inviteeIds.length > 0) {
            // Ghi mốc TRƯỚC khi bắn: bắn xong mới ghi mà giữa chừng lỗi thì lần mở sau mời lại.
            const invitedAt = new Date().toISOString()
            up((d) => ({
              sessions: d.sessions.map((x) => (x.id === sid ? { ...x, rsvpInvitedAt: invitedAt } : x)),
            }))
            emitEvent({
              type: 'session_rsvp_invite',
              payload: { sessionId: sid, date: cur.date || dateStr },
              recipients: inviteeIds,
              refType: 'session',
              refId: sid,
              skipActivity: true,
            })
          }
        }
      } else if (changed && st === 'closed') {
        emitEvent({
          type: 'session_closed',
          payload: { sessionId: sid, date: dateStr },
          recipients: [],
          refType: 'session',
          refId: sid,
        })
      } else if (changed && st === 'cancelled') {
        // Đã mời người ta đi thì huỷ phải báo lại — không thì cả nhóm ra sân đứng nhìn nhau.
        const cur = sessionOf(db(), sid)
        const invited = cur?.groupId
          ? groupMembers(db(), cur.groupId, monthOf(cur.date || db().today)).map((m) => m.id)
          : []
        const answered = Object.keys(db().attendance?.[sid] || {})
        emitEvent({
          type: 'session_cancelled',
          payload: { sessionId: sid, date: cur?.date || dateStr },
          recipients: [...new Set([...invited, ...answered])],
          refType: 'session',
          refId: sid,
        })
      }
      const key = { closed: 'sessionClosed', open: 'sessionOpened', cancelled: 'sessionCancelled' }[st] || 'sessionDraft'
      toast(t('toast.' + key))
    },

    /* ---------- khách giao lưu ---------- */
    addGuest: () => {
      const f = form()
      const name = (f.gName || '').trim()
      if (!name && !f.gGuestId) return toast(t('toast.needGuestName'))
      const level = f.gLevel || db().levels[0]
      if (!level) return toast(t('toast.noClubLevels'))
      const gender = f.gGender || 'nam'
      const inviterId = f.gBy || null
      const phone = (f.gPhone || '').trim()
      const note = (f.gNote || '').trim()
      const hasCompanion = !!f.gHasCompanion
      const d0 = db()

      // Tra khách theo ID (nếu chọn từ danh sách) hoặc theo tên chuẩn hoá (nếu gõ)
      const old = f.gGuestId
        ? d0.guests.find((x) => x.id === f.gGuestId)
        : d0.guests.find((x) => normalizeText(x.name) === normalizeText(name))
      const gid = old ? old.id : uid()
      const finalName = old ? old.name : name

      if (sGuests(d0, d0.sessionId).some((x) => x.guestId === gid)) {
        return toast(t('toast.guestDup', { name: finalName }))
      }

      // Thông tin người đi kèm (nếu có)
      const compName = hasCompanion ? ((f.gCompanionName || '').trim() || t('session.companionDefault', { name: finalName })) : ''
      const compGender = hasCompanion ? (f.gCompanionGender || 'nu') : 'nu'
      const compLevel = hasCompanion ? (f.gCompanionLevel || level) : level
      const compGid = hasCompanion ? uid() : null

      up((d) => {
        let nextGuests = d.guests.slice()
        if (old) {
          nextGuests = nextGuests.map((x) => {
            if (x.id !== gid) return x
            return {
              ...x,
              invitedBy: inviterId !== null ? inviterId : x.invitedBy,
              phone: phone || x.phone || '',
              note: note || x.note || '',
              level: f.gUpdateGuestLevel ? level : x.level,
              gender: f.gUpdateGuestLevel ? gender : x.gender,
            }
          })
        } else {
          nextGuests.push({
            id: gid,
            name: finalName,
            gender,
            level,
            invitedBy: inviterId,
            phone,
            note,
          })
        }

        if (hasCompanion && compGid) {
          nextGuests.push({
            id: compGid,
            name: compName,
            gender: compGender,
            level: compLevel,
            invitedBy: inviterId,
            phone: '',
            note: t('session.companionTag', { name: finalName }),
            companionOf: gid,
          })
        }

        const newSessionGuests = [{
          id: uid(),
          sessionId: d.sessionId,
          guestId: gid,
          level,
          gender,
          price: guestPrice(d, level, gender),
          paid: !!f.gPaid,
          paidAt: f.gPaid ? d.today : null,
          invitedBy: inviterId,
        }]

        if (hasCompanion && compGid) {
          newSessionGuests.push({
            id: uid(),
            sessionId: d.sessionId,
            guestId: compGid,
            level: compLevel,
            gender: compGender,
            price: guestPrice(d, compLevel, compGender),
            paid: !!f.gPaid,
            paidAt: f.gPaid ? d.today : null,
            invitedBy: inviterId,
            companionOf: gid,
          })
        }

        return {
          guests: nextGuests,
          sessionGuests: d.sessionGuests.concat(newSessionGuests),
        }
      })

      upUi((u) => ({
        form: {
          ...u.form,
          gGuestId: '',
          gName: '',
          gPhone: '',
          gNote: '',
          gBy: '',
          gHasCompanion: false,
          gCompanionName: '',
          gCompanionGender: 'nu',
          gCompanionLevel: db().levels[0] || 'Y',
        },
      }))

      const inviterName = inviterId ? memberOf(db(), inviterId).name : t('debts.clubRecruited')
      if (hasCompanion) {
        const p1 = guestPrice(db(), level, gender)
        const p2 = guestPrice(db(), compLevel, compGender)
        toast(t('toast.guestAddedTwo', {
          name: finalName,
          companion: compName,
          by: inviterName,
          price: fmt(p1 + p2),
        }))
      } else {
        toast(t('toast.guestAdded', {
          name: finalName,
          by: inviterName,
          price: fmt(guestPrice(db(), level, gender)),
        }))
      }
    },
    updateGuest: (gid, patch) => {
      const was = db().guests.find((x) => x.id === gid)
      if (!was) return
      up((d) => ({
        guests: d.guests.map((x) => (x.id === gid ? { ...x, ...patch } : x)),
      }))
      toast(t('toast.guestUpdated', { name: patch.name || was.name }))
    },
    deleteGuest: (gid) => {
      const d0 = db()
      const was = d0.guests.find((x) => x.id === gid)
      if (!was) return
      const sgs = (d0.sessionGuests || []).filter((sg) => sg.guestId === gid)
      const hasPaid = sgs.some((sg) => sg.paid)
      if (hasPaid) {
        return toast(t('toast.guestInUse'))
      }
      up((d) => ({
        guests: d.guests.filter((x) => x.id !== gid && x.companionOf !== gid),
        sessionGuests: d.sessionGuests.filter((sg) => sg.guestId !== gid),
      }))
      toast(t('toast.guestDeleted', { name: was.name }))
    },
    /* ---------- thành viên tự khai đã chuyển tiền (migration 0018) ---------- */

    /**
     * Gửi khai báo cho N khoản của CHÍNH MÌNH. Đi qua RPC chứ không qua đồng bộ diff: RLS chỉ
     * cho thành viên thường ĐỌC ba bảng nợ, và mở quyền ghi cho họ thì phải chặn cột `paid`
     * bằng trigger trên cả ba bảng — hàm chỉ chạm đúng một cột rẻ hơn hẳn.
     *
     * RPC trả về SỐ DÒNG khai được, có thể nhỏ hơn số gửi lên (khoản vừa được thủ quỹ tick,
     * hoặc đã khai ở thiết bị khác). Nói ra thay vì báo thành công khống.
     */
    claimPayments: async (items) => {
      const list = (items || []).filter((x) => x && x.kind && x.id)
      if (!list.length) return
      try {
        const n = unwrap(await supabase.rpc('claim_payments', {
          p_club: db().clubId,
          p_items: list.map((x) => ({ kind: x.kind, id: x.id })),
        }))
        await reload()
        // Khai xong mà không báo ai thì thủ quỹ phải tự vào Công nợ soi mới biết có người khai.
        // Gửi cho người có quyền 'money' — đúng những người bấm được nút đối chiếu.
        if (n > 0) {
          const d1 = db()
          const meId = myMember(d1)?.id || null
          emitEvent({
            type: 'claim_submitted',
            payload: { memberId: meId, n },
            recipients: membersWithPerm(d1.members, 'money'),
            refType: 'debts',
            refId: null,
            actorId: meId,
            skipActivity: true,
          })
        }
        toast(n > 0 ? t('toast.claimSent', { n }) : t('toast.claimNothing'))
      } catch (e) {
        const m = String(e.message || '')
        toast(/claim_payments|schema cache/i.test(m) ? t('sync.needMigrate') : m)
      }
    },

    /**
     * Từ chối: xoá `claimed_at`, khoản nợ hiện lại cho thành viên.
     *
     * Đây là thao tác XOÁ DẤU VẾT — sau khi chạy thì không phân biệt được "vừa bị từ chối"
     * với "chưa khai bao giờ". Khi làm thông báo, dòng `notifications` phải ghi NGAY TẠI ĐÂY;
     * không dựng lại được từ DB về sau.
     */
    rejectClaim: ({ kind, id, reason }) => {
      const d0 = db()
      let memberId = null
      if (kind === 'dues') {
        const row = (d0.dues || []).find((x) => x.id === id)
        memberId = row?.memberId
      } else if (kind === 'guest') {
        const row = (d0.sessionGuests || []).find((x) => x.id === id)
        memberId = row?.memberId
      } else {
        const row = (d0.adjustments || []).find((x) => x.id === id)
        memberId = row?.memberId
      }
      const clear = (x) => (x.id === id ? { ...x, claimedAt: null } : x)
      up((d) => (
        kind === 'dues' ? { dues: d.dues.map(clear) }
        : kind === 'guest' ? { sessionGuests: d.sessionGuests.map(clear) }
        : { adjustments: (d.adjustments || []).map(clear) }
      ))
      if (memberId) {
        emitEvent({
          type: 'claim_rejected',
          payload: { kind, claimId: id, reason: reason || '' },
          recipients: [memberId],
          refType: 'claim',
          refId: id,
          skipActivity: true,
        })
      }
      toast(t('toast.claimRejected'))
    },

    toggleGuestPaid: (id) => {
      const was = db().sessionGuests.find((g) => g.id === id)
      if (was && !was.paid && was.claimedAt && was.memberId) {
        emitEvent({
          type: 'claim_approved',
          payload: { kind: 'guest', claimId: was.id, amount: was.price || 0 },
          recipients: [was.memberId],
          refType: 'claim',
          refId: was.id,
          skipActivity: true,
        })
      }
      return up((d) => ({
        sessionGuests: d.sessionGuests.map((g) => (g.id === id ? { ...g, paid: !g.paid, paidAt: !g.paid ? d.today : null } : g)),
      }))
    },
    /**
     * Sửa đè giá một lượt thu. Bảng giá theo trình độ chỉ là GỢI Ý — CLB miễn cho người mới,
     * lấy rẻ người nhà, thu thêm người đến muộn… đều là chuyện thường. Đã thu rồi thì khoá:
     * sửa số sau khi tiền vào quỹ là sổ quỹ lệch mà không có dòng nào giải thích.
     *
     * ĐANG CHỜ DUYỆT cũng khoá: người ta đã chuyển đúng số cũ rồi, sửa lúc này là duyệt xong
     * thì sổ ghi một số mà tài khoản nhận một số khác.
     */
    setChargePrice: (id, v) =>
      up((d) => ({
        sessionGuests: d.sessionGuests.map((g) =>
          (g.id === id && !g.paid && !g.claimedAt ? { ...g, price: intOf(v) } : g)),
      })),
    removeGuest: (id) => {
      up((d) => ({ sessionGuests: d.sessionGuests.filter((g) => g.id !== id) }))
      toast(t('toast.guestRemoved'))
    },
    setGuestInviter: (sgId, mid) =>
      up((d) => ({ sessionGuests: d.sessionGuests.map((x) => (x.id === sgId ? { ...x, invitedBy: mid } : x)) })),
    /** `id` là guestId (khách) hoặc memberId (thành viên đi buổi đột xuất) — xem `guestDebtRows`. */
    collectDebt: (id) => {
      const d0 = db()
      const row = d0.sessionGuests.find((g) => g.guestId === id || g.memberId === id)
      // Tìm các ID khách đi kèm của người này
      const companionIds = new Set(d0.guests.filter((g) => g.companionOf === id).map((g) => g.id))
      up((d) => ({
        sessionGuests: d.sessionGuests.map((g) => {
          const ss = sessionOf(d, g.sessionId)
          const mine = g.guestId === id || g.memberId === id || companionIds.has(g.guestId) || g.companionOf === id
          return mine && ss && monthOf(ss.date) === d.month ? { ...g, paid: true, paidAt: g.paidAt || d.today } : g
        }),
      }))
      // Cùng một việc "ghi nhận đã thu" mà `payDue` và `toggleGuestPaid` thì báo, nút này thì
      // không — thành viên khai xong không biết đã được đối chiếu hay chưa, tuỳ thủ quỹ bấm nút
      // nào. Báo ở đây cho khớp. Chỉ báo khi người đó ĐÃ KHAI: chưa khai thì họ không chờ gì cả.
      const claimed = d0.sessionGuests.find((g) => {
        const ss = sessionOf(d0, g.sessionId)
        return g.memberId === id && g.claimedAt && !g.paid && ss && monthOf(ss.date) === d0.month
      })
      if (claimed) {
        emitEvent({
          type: 'claim_approved',
          payload: { kind: 'guest', claimId: claimed.id },
          recipients: [id],
          refType: 'claim',
          refId: claimed.id,
          skipActivity: true,
        })
      }
      toast(t('toast.debtCollected', { name: row ? chargeName(d0, row) : guestOf(d0, id).name }))
    },

    /* ---------- quỹ tháng, back tiền, danh sách cố định ---------- */
    /**
     * Ghi nhận tiền quỹ tháng đã NHẬN. `amount` bỏ trống = thu nốt phần còn thiếu.
     * Không dùng cờ bật/tắt nữa: đóng trước một phần là chuyện thường, cờ boolean thì hoặc
     * ghi thừa hoặc ghi thiếu.
     */
    payDue: (id, amount) => {
      const was = db().dues.find((y) => y.id === id)
      if (!was) return
      const st = dueState(was)
      const add = amount === undefined ? st.remain : intOf(amount)
      if (add <= 0) return toast(t('toast.needAmount'))
      const next = st.paid + add
      up((d) => ({ dues: d.dues.map((x) => (x.id === id ? { ...x, paidAmount: next, paidAt: d.today } : x)) }))
      if (was.claimedAt && was.memberId) {
        emitEvent({
          type: 'claim_approved',
          payload: { kind: 'dues', claimId: was.id, amount: add },
          recipients: [was.memberId],
          refType: 'claim',
          refId: was.id,
          skipActivity: true,
        })
      }
      const name = memberOf(db(), was.memberId).name
      const left = Math.max(0, st.amount - next)
      toast(left > 0
        ? t('toast.duePartial', { name, amount: fmt(add), remain: fmt(left) })
        : t('toast.duePaid', { name, amount: fmt(add) }))
    },
    /** Xoá sạch số đã nhận của một khoản — dùng khi ghi nhầm người. */
    clearDue: (id) => {
      const was = db().dues.find((y) => y.id === id)
      if (!was || !dueState(was).paid) return
      up((d) => ({ dues: d.dues.map((x) => (x.id === id ? { ...x, paidAmount: 0, paidAt: null } : x)) }))
      toast(t('toast.dueUnpaid', { name: memberOf(db(), was.memberId).name }))
    },
    /**
     * Đánh dấu một khoản đối chiếu đã trả / đã thu.
     *   amount ÂM  → chi "Back cố định nghỉ"
     *   amount DƯƠNG → thu "Đi thêm buổi"
     * Riêng settle='offset_next_dues' thì KHÔNG sinh giao dịch — trừ vào quỹ tháng sau.
     */
    settleAdjust: (key) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row) return
      const matching = adjustSessions(db(), month, row)
      const allSessionIds = matching.map((s) => s.id)

      if (row.paid) {
        up((d) => (row.settle === 'cash'
          ? { adjustments: (d.adjustments || []).filter((x) => x.key !== key) }
          : { adjustments: upsertAdjust(d, row, { paid: false, paidAt: null, settledSessions: [] }) }))
        toast(t('toast.adjustUndone'))
      } else {
        up((d) => ({
          adjustments: upsertAdjust(d, row, {
            paid: true,
            paidAt: d.today,
            settledSessions: allSessionIds,
          }),
        }))
        const back = row.amount < 0
        if (back && row.memberId) {
          emitEvent({
            type: 'refund_bulk',
            payload: {
              amount: fmt(Math.abs(row.amount)),
              n: row.sessions || 1,
              month: row.month,
              memberId: row.memberId,
            },
            recipients: [row.memberId],
            refType: 'debts',
            skipActivity: true,
          })
        }
        toast(t(back ? 'toast.adjustPaid' : 'toast.adjustCollected',
          { name: row.member.name, amount: fmt(Math.abs(row.amount)) }))
      }
    },
    toggleAdjustSession: (key, sessionId) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row) return

      const matching = adjustSessions(db(), month, row)
      const allSessionIds = matching.map((s) => s.id)
      if (allSessionIds.length === 0 && sessionId) allSessionIds.push(sessionId)

      const curSettled = (Array.isArray(row.settledSessions) && row.settledSessions.length > 0)
        ? row.settledSessions
        : (row.paid ? allSessionIds : [])

      const isSettled = curSettled.includes(sessionId)
      const nextSettled = isSettled
        ? curSettled.filter((id) => id !== sessionId)
        : [...curSettled, sessionId]

      const isAllPaid = allSessionIds.length > 0 && allSessionIds.every((id) => nextSettled.includes(id))

      if (nextSettled.length === 0 && row.settle === 'cash') {
        up((d) => ({
          adjustments: (d.adjustments || []).filter((x) => x.key !== key),
        }))
      } else {
        up((d) => ({
          adjustments: upsertAdjust(d, row, {
            settledSessions: nextSettled,
            paid: isAllPaid,
            paidAt: isAllPaid ? (row.paidAt || d.today) : null,
          }),
        }))
      }

      const s = sessionOf(db(), sessionId)
      const dateTxt = s ? ddmy(s.date) : ''
      const unitPrice = row.unit || (row.sessions ? Math.round(Math.abs(row.amount) / row.sessions) : 0)

      if (isSettled) {
        toast(t('toast.adjustUndoneSession', { name: row.member.name, date: dateTxt }))
      } else {
        const isRefund = row.amount < 0
        if (isRefund && row.memberId) {
          emitEvent({
            type: 'refund_session',
            payload: {
              amount: fmt(unitPrice),
              date: dateTxt,
              sessionId,
              memberId: row.memberId,
            },
            recipients: [row.memberId],
            refType: 'debts',
            refId: sessionId,
            skipActivity: true,
          })
        }
        toast(t(isRefund ? 'toast.adjustPaidSession' : 'toast.adjustCollectedSession', {
          name: row.member.name,
          date: dateTxt,
          amount: fmt(unitPrice),
        }))
      }
    },
    /** Chọn cách trả: tiền mặt, hay trừ vào quỹ tháng sau. */
    setAdjustSettle: (key, settle) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row || row.paid) return
      up((d) => (settle === 'cash' && !row.saved
        ? {}
        : { adjustments: upsertAdjust(d, row, { settle }) }))
      toast(t(settle === 'cash' ? 'toast.settleCash' : 'toast.settleOffset', { name: row.member.name }))
    },
    setAdjustAmount: (key, amount) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row || row.paid) return
      const amt = intOf(amount)
      const sign = row.amount < 0 ? -1 : 1
      up((d) => ({
        adjustments: upsertAdjust(d, row, { amount: sign * Math.abs(amt) }),
      }))
    },
    setAdjustUnit: (key, unit) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row || row.paid) return
      const u = intOf(unit)
      const sign = row.amount < 0 ? -1 : 1
      const totalAmount = sign * Math.abs(u) * (row.sessions || 1)
      up((d) => ({
        adjustments: upsertAdjust(d, row, { unit: u, amount: totalAmount }),
      }))
    },
    /**
     * Ô cố định của một người trong một ca. `'none'` KHÔNG phải một trạng thái lưu được: enum
     * `roster_state` dưới DB chỉ có ('fixed','off','pending'), còn `money.js: rosterStatus` suy
     * ra 'none' từ chỗ KHÔNG CÓ bản ghi. Nên 'none' phải XOÁ ô, không phải ghi chuỗi 'none' —
     * ghi xuống là Postgres 22P02 và cả hàng đợi đồng bộ kẹt lại, trong khi màn hình vẫn hiện
     * thay đổi nên không ai biết là chưa lưu.
     */
    setRoster: (month, gid, mid, val) =>
      up((d) => {
        const all = { ...d.roster }
        const base = d.roster[month] || ensureRoster(d, month)
        const gm = { ...(base[gid] || {}) }
        if (cfg.rosterStates.indexOf(val) < 0) delete gm[mid]
        else gm[mid] = val
        all[month] = { ...base, [gid]: gm }
        return { roster: all }
      }),
    lockRoster: (month) => {
      const wasLocked = !!db().locked[month]
      up((d) => {
        // ponytail: bỏ chốt chỉ tắt cờ, KHÔNG hoàn lại các khoản đã trừ vào quỹ tháng này.
        // Đúng như hành vi cũ (dues sinh ra vẫn ở lại). Cần hoàn thì phải có bước huỷ riêng.
        if (d.locked[month]) return { locked: { ...d.locked, [month]: false } }
        // Công thức nằm ở money.js: lockDues — đây là chỗ sinh ra toàn bộ tiền phải thu của
        // một tháng, phải test được bằng node chứ không chỉ bấm thử.
        const { rows, used } = lockDues(d, month)
        return {
          dues: d.dues.concat(rows.map((r) => ({ id: uid(), ...r }))),
          adjustments: (d.adjustments || []).map((x) =>
            used.indexOf(x.key) < 0 ? x : { ...x, paid: true, paidAt: month + '-01' }),
          locked: { ...d.locked, [month]: true },
        }
      })
      toast(wasLocked ? t('toast.rosterUnlocked') : t('toast.rosterLocked', { month: monthTxt(month).toLowerCase() }))
    },
    approveChange: (id, ok) => {
      up((d) => {
        const c = d.changes.find((x) => x.id === id)
        if (!c) return {}
        let members = d.members
        if (ok) {
          members = d.members.map((m) => {
            if (m.id !== c.memberId) return m
            if (c.field === 'phone') return { ...m, phone: c.to }
            // "Áp dụng ngay" = trình độ của người này LÀ c.to, kể cả buổi cũ → xoá sạch mốc,
            // không thì một mốc quá khứ vẫn thắng `level` và duyệt xong không thấy gì đổi.
            if (c.effective === 'now') {
              return { ...m, level: c.to, levelHistory: [], pendingLevel: null, pendingLevelFrom: null }
            }
            // Mốc lấy từ HÔM NAY, không phải tháng đang chọn ở header: duyệt trong lúc xem
            // tháng cũ thì mốc rơi vào quá khứ và trình độ mới áp dụng ngay, đổi luôn cái
            // hiện trên các buổi đã đánh xong.
            const from = addMonth(monthOf(d.today), 1)
            // Thêm MỘT mốc, giữ các mốc cũ: đổi lần thứ hai không được xoá lịch sử lần thứ nhất,
            // không thì đoạn giữa hai lần đổi rơi về `level` gốc (đó là lỗi của mô hình cũ).
            const hist = (m.levelHistory || []).filter((h) => h.from !== from).concat([{ from, level: c.to }])
            return { ...m, levelHistory: hist, pendingLevel: null, pendingLevelFrom: null }
          })
        }
        return { members, changes: d.changes.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' : 'rejected' } : x)) }
      })
      // Đọc yêu cầu từ state TRƯỚC khi `up()` ghi đè trạng thái — sau đó vẫn còn dòng, nhưng
      // lấy ở đây cho rõ là ta báo theo đúng cái vừa duyệt.
      // TẮT theo yêu cầu: toàn bộ thông báo mục Thành viên (cả chuông lẫn push).
      // const chg = (db().changes || []).find((x) => x.id === id)
      // if (chg?.memberId) {
      //   emitEvent({
      //     type: ok ? 'member_change_approved' : 'member_change_rejected',
      //     payload: { field: chg.field, to: chg.to },
      //     recipients: [chg.memberId],
      //     refType: 'member',
      //     refId: id,
      //     skipActivity: true,
      //   })
      // }
      toast(t(ok ? 'toast.changeApproved' : 'toast.changeRejected'))
    },

    /* ---------- thành viên ---------- */
    /**
     * Lưu sửa thành viên, gồm cả NHÓM CỐ ĐỊNH — trước đây phải đi đường vòng qua tab Danh sách
     * cố định, mà tab đó lại chỉ thấy tháng sau nên coi như không sửa được.
     *
     * Gỡ hết nhóm = thành người đi lẻ (vãng lai). Khi đó khoản quỹ tháng của nhóm bị gỡ:
     *   chưa đóng đồng nào → XOÁ, không thì họ bị nhắc một khoản không còn phải đóng;
     *   đã đóng một phần   → GIỮ nguyên và ghi chú lý do. Tiền đã vào quỹ thật thì không được
     *                        tự bốc hơi khỏi sổ, và họ đã trả cho các buổi của tháng đó rồi.
     */
    saveMember: () => {
      const f = form()
      const d0 = db()
      const was = d0.members.find((m) => m.id === f.eId)
      if (!was) return
      const gs = f.eGroups || []
      const gMonth = addMonth(d0.month, 1)

      const mb = {
        ...was,
        name: f.eName,
        fullName: (f.eFull || '').trim(),
        phone: f.ePhone || '',
        email: (f.eEmail || '').trim(),
        gender: f.eGender,
        level: f.eLevel,
        avatarUrl: f.eAvatarUrl !== undefined ? f.eAvatarUrl : (was.avatarUrl || ''),
        qrUrl: f.eQrUrl !== undefined ? f.eQrUrl : (was.qrUrl || ''),
        bankHolder: f.eBankHolder !== undefined ? f.eBankHolder : (was.bankHolder || ''),
        bankNo: f.eBankNo !== undefined ? f.eBankNo : (was.bankNo || ''),
        bankName: f.eBankName !== undefined ? f.eBankName : (was.bankName || ''),
        bankAccounts: f.eBankAccounts || was.bankAccounts || [],
        // Chủ CLB sửa thẳng = áp dụng ngay cho mọi tháng → lịch sử mốc cũ phải đi theo, không
        // thì tháng sau trình độ tự nhảy về mốc cũ mà không ai hiểu vì sao.
        levelHistory: f.eLevel === was.level ? (was.levelHistory || []) : [],
        pendingLevel: null,
        pendingLevelFrom: null,
        note: f.eNote || '',
        groupIds: gs.slice(),
      }

      // Tính TRƯỚC updater rồi mới ghi: cộng dồn `kept`/`dropped` bên trong updater là đọc
      // state rồi gây side effect ở đó — React 19 StrictMode gọi updater hai lần và toast báo
      // gấp đôi số tiền (xem ARCHITECTURE §4 quy ước 1).
      const { dues, add, kept, dropped } = regroupDues(d0, mb, gs, gMonth)
      const rows = add.map((r) => ({ id: uid(), ...r }))

      up((d) => {
        const roster = { ...d.roster }
        const base = roster[gMonth] || ensureRoster(d, gMonth)
        const next = { ...base }
        d.groups.forEach((g) => {
          next[g.id] = { ...(next[g.id] || {}), [f.eId]: gs.indexOf(g.id) >= 0 ? 'fixed' : 'off' }
        })
        roster[gMonth] = next
        return { members: d.members.map((m) => (m.id === f.eId ? mb : m)), roster, dues: dues.concat(rows) }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(kept > 0
        ? t('toast.memberSavedKept', { amount: fmt(kept), month: monthTxt(gMonth).toLowerCase() })
        : dropped > 0
          ? t('toast.memberSavedDropped', { n: dropped, month: monthTxt(gMonth).toLowerCase() })
          : t('toast.memberSaved'))
    },
    /**
     * Ngưng hoạt động: giữ nguyên toàn bộ lịch sử điểm danh và tiền, chỉ ẩn khỏi danh sách.
     *
     * `back` > 0 thì ghi thêm một dòng chi "Back cố định nghỉ" vào sổ quỹ. Phải ghi ở đây chứ
     * không qua bảng đối chiếu: người đã ngưng thì `adjustRows` không sinh dòng cho họ nữa
     * (nó lọc qua `groupMembers`, mà `groupMembers` bỏ người `active === false`).
     * Trả bao nhiêu, hay không trả, là thoả thuận của CLB — app chỉ gợi ý số.
     */
    deactivate: (id, back) => {
      const was = db().members.find((m) => m.id === id)
      if (!was) return
      const amount = intOf(back)
      up((d) => ({
        members: d.members.map((m) => (m.id === id ? { ...m, active: false } : m)),
        manual: amount > 0
          ? d.manual.concat([{
              id: uid(), date: d.today, dir: 'out', cat: CATS.back,
              label: t('members.offBackLabel', { name: was.name, month: monthTxt(d.month).toLowerCase() }),
              amount, by: memberOf(d, (d.members.find((m) => m.userId === d.currentUserId) || {}).id).name,
            }])
          : d.manual,
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(amount > 0
        ? t('toast.memberOffBack', { name: was.name, amount: fmt(amount) })
        : t('toast.memberOff', { name: was.name }))
    },
    /**
     * Cho hoạt động lại. KHÔNG đụng tiền: khoản back đã ghi lúc ngưng là giao dịch thật,
     * người ta quay lại thì thu lại bằng một dòng thu tay, không xoá lịch sử.
     */
    reactivate: (id) => {
      const was = db().members.find((m) => m.id === id)
      if (!was) return
      up((d) => ({ members: d.members.map((m) => (m.id === id ? { ...m, active: true } : m)) }))
      toast(t('toast.memberOn', { name: was.name }))
    },
    /**
     * Xoá cứng — CHỈ khi chưa dính điểm danh, tiền, trận nào. Dính rồi thì xoá là mất lịch sử
     * của tháng đã chốt, và khoá ngoại dưới DB cũng chặn.
     */
    deleteMember: (id) => {
      const d0 = db()
      const m = d0.members.find((x) => x.id === id)
      if (!m) return
      const why = memberRefs(d0, id)
      if (why.length) {
        return toast(t('toast.memberHasRefs', { name: m.name, why: why.map((k) => t('members.ref.' + k)).join(', ') }))
      }
      up((d) => {
        // Dọn cả bản ghi danh sách cố định, không thì khoá ngoại group_memberships chặn lúc ghi.
        const roster = {}
        Object.keys(d.roster || {}).forEach((month) => {
          roster[month] = {}
          Object.keys(d.roster[month]).forEach((gid) => {
            const gm = { ...d.roster[month][gid] }
            delete gm[id]
            roster[month][gid] = gm
          })
        })
        return { members: d.members.filter((x) => x.id !== id), roster }
      })
      toast(t('toast.memberDeleted', { name: m.name }))
    },
    deleteMembersBulk: (ids) => {
      const d0 = db()
      const toDel = []
      const blocked = []
      ids.forEach((id) => {
        const m = d0.members.find((x) => x.id === id)
        if (!m) return
        const why = memberRefs(d0, id)
        if (why.length) blocked.push(m.name)
        else toDel.push(id)
      })

      if (!toDel.length) {
        return toast(t('toast.bulkDelNone'))
      }

      const idSet = new Set(toDel)
      up((d) => {
        const roster = {}
        Object.keys(d.roster || {}).forEach((month) => {
          roster[month] = {}
          Object.keys(d.roster[month]).forEach((gid) => {
            const gm = { ...d.roster[month][gid] }
            toDel.forEach((id) => delete gm[id])
            roster[month][gid] = gm
          })
        })
        return { members: d.members.filter((x) => !idSet.has(x.id)), roster }
      })

      if (blocked.length) {
        toast(t('toast.bulkDelSome', { n: toDel.length, skipped: blocked.length, names: blocked.join(', ') }))
      } else {
        toast(t('toast.bulkDelOk', { n: toDel.length }))
      }
    },
    setMembersGroupsBulk: (memberIds, groupIds) => {
      const d0 = db()
      const gs = groupIds || []
      const month = d0.month
      const nextM = addMonth(month, 1)

      let duesAccum = (d0.dues || []).slice()
      const newDuesRows = []

      const targetMembers = d0.members.filter((m) => memberIds.includes(m.id))
      targetMembers.forEach((mb) => {
        const updatedMb = { ...mb, groupIds: gs.slice() }
        const { dues, add } = regroupDues({ ...d0, dues: duesAccum }, updatedMb, gs, month)
        duesAccum = dues
        add.forEach((r) => newDuesRows.push({ id: uid(), ...r }))
      })

      up((d) => {
        const roster = { ...d.roster }
        ;[month, nextM].forEach((mKey) => {
          const base = roster[mKey] || ensureRoster(d, mKey)
          const next = { ...base }
          d.groups.forEach((g) => {
            const gm = { ...(next[g.id] || {}) }
            memberIds.forEach((id) => {
              gm[id] = gs.indexOf(g.id) >= 0 ? 'fixed' : 'off'
            })
            next[g.id] = gm
          })
          roster[mKey] = next
        })

        const idSet = new Set(memberIds)
        return {
          members: d.members.map((m) => (idSet.has(m.id) ? { ...m, groupIds: gs.slice() } : m)),
          roster,
          dues: duesAccum.concat(newDuesRows),
        }
      })

      if (gs.length === 0) {
        toast(t('toast.bulkNoGroup', { n: memberIds.length }))
      } else {
        const gNames = d0.groups.filter((g) => gs.includes(g.id)).map((g) => g.short || g.name).join(' + ')
        toast(t('toast.bulkGroup', { n: memberIds.length, groups: gNames }))
      }
    },
    deactivateMembersBulk: (ids) => {
      const idSet = new Set(ids)
      up((d) => ({
        members: d.members.map((m) => (idSet.has(m.id) ? { ...m, active: false } : m)),
      }))
      toast(t('toast.bulkOff', { n: ids.length }))
    },
    reactivateMembersBulk: (ids) => {
      const idSet = new Set(ids)
      up((d) => ({
        members: d.members.map((m) => (idSet.has(m.id) ? { ...m, active: true } : m)),
      }))
      toast(t('toast.bulkOn', { n: ids.length }))
    },
    createMember: () => {
      const f = form()
      const d0 = db()
      const name = (f.mName || '').trim()
      if (!name) return toast(t('toast.needMemberName'))
      // Không chọn ca nào = chưa cố định (đi lẻ). KHÔNG tự gán về ca đầu tiên: người mới đến
      // chơi thử mà bị gán cố định thì tháng sau `lockDues` đẻ ra một khoản quỹ không ai yêu
      // cầu, và không có gì trên màn hình nói cho họ biết.
      const gs = (f.mGroups || []).slice()
      const start = gs.length ? f.mStart || 'next' : 'none'
      const nextM = addMonth(d0.month, 1)

      // Sinh id và tính khoản thu TRƯỚC updater. Trước đây toast đọc `db()` SAU `up()` rồi mò
      // `members[length - 1]` — mà `db()` lúc đó vẫn là state cũ (dbRef chỉ cập nhật ở
      // useLayoutEffect), nên số tiền in ra là của NGƯỜI TRƯỚC ĐÓ hoặc 0.
      const id = uid()
      const mb = {
        id, name, gender: f.mGender || 'nam', level: f.mLevel || d0.levels[0],
        groupIds: start === 'now' ? gs : [], role: 'member', phone: f.mPhone || '',
        fullName: (f.mFull || '').trim(), email: (f.mEmail || '').trim(),
        avatarUrl: f.mAvatarUrl || '',
        qrUrl: f.mQrUrl || '',
        bankHolder: f.mBankHolder || '',
        bankNo: f.mBankNo || '',
        bankName: f.mBankName || '',
        bankAccounts: f.mBankAccounts || [],
        note: f.mNote || '',
        joined: d0.today, active: true, userId: null, levelHistory: [],
        pendingLevel: null, pendingLevelFrom: null,
      }
      const owed = start !== 'now' ? [] : gs.map((gid) => {
        const g = d0.groups.find((x) => x.id === gid)
        const jd = g ? joinDues(d0, mb, g, d0.month) : { amount: 0 }
        return { gid, jd }
      }).filter((x) => x.jd.amount > 0)

      up((d) => {
        const roster = { ...d.roster }
        const fix = (month, gid) => {
          const base = roster[month] || ensureRoster(d, month)
          roster[month] = { ...base, [gid]: { ...(base[gid] || {}), [id]: 'fixed' } }
        }
        gs.forEach((gid) => {
          fix(nextM, gid)
          // Vào từ THÁNG NÀY thì phải cố định cả tháng này, không thì người mới không hiện ở
          // màn điểm danh và không ai chấm công cho họ được.
          if (start === 'now') fix(d.month, gid)
        })
        return {
          roster,
          members: d.members.concat([mb]),
          dues: d.dues.concat(owed.map(({ gid, jd }) => ({
            id: uid(), month: d.month, groupId: gid, memberId: id, amount: jd.amount,
            paidAmount: 0, paidAt: null, method: '',
            note: jd.full ? t('members.joinFull') : t('members.joinPartial', { n: jd.sessions }),
          }))),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(start === 'next'
        ? t('toast.memberAddedNext', { name, month: monthTxt(nextM).toLowerCase() })
        : start === 'now'
          ? t('toast.memberAddedNow', {
              name, month: monthTxt(d0.month).toLowerCase(),
              amount: fmtK(owed.reduce((x, y) => x + y.jd.amount, 0)),
            })
          : t('toast.memberAdded', { name }))
    },

    importMembers: (parsedRows, options = {}) => {
      const valid = (parsedRows || []).filter((r) => r.status !== 'error' && r.name)
      if (!valid.length) return toast(t('toast.noValidMembersToImport'))

      const d0 = db()
      const start = options.start || 'next'
      const defGid = options.defaultGroupId || null
      const nextM = addMonth(d0.month, 1)

      const newMembers = []
      const newDues = []
      const fixMap = []

      valid.forEach((row) => {
        const id = uid()
        const gs = Array.isArray(row.groupIds)
          ? row.groupIds
          : (row.groupId ? [row.groupId] : (defGid ? [defGid] : []))
        const mb = {
          id,
          name: row.name,
          fullName: (row.fullName || '').trim(),
          email: (row.email || '').trim(),
          gender: row.gender || 'nam',
          level: row.level || d0.levels[0],
          groupIds: start === 'now' ? gs : [],
          role: 'member',
          phone: row.phone || '',
          joined: d0.today,
          active: true,
          userId: null,
          levelHistory: [],
          pendingLevel: null,
          pendingLevelFrom: null,
        }
        newMembers.push(mb)

        if (start === 'now' && gs.length) {
          gs.forEach((gid) => {
            const g = d0.groups.find((x) => x.id === gid)
            const jd = g ? joinDues(d0, mb, g, d0.month) : { amount: 0 }
            if (jd && jd.amount > 0) {
              newDues.push({
                id: uid(),
                month: d0.month,
                groupId: gid,
                memberId: id,
                amount: jd.amount,
                paidAmount: 0,
                paidAt: null,
                method: '',
                note: jd.full ? t('members.joinFull') : t('members.joinPartial', { n: jd.sessions }),
              })
            }
          })
        }

        if (start !== 'none' && gs.length) {
          fixMap.push({ id, gs })
        }
      })

      up((d) => {
        const roster = { ...d.roster }
        const fix = (month, gid, mid) => {
          const base = roster[month] || ensureRoster(d, month)
          roster[month] = { ...base, [gid]: { ...(base[gid] || {}), [mid]: 'fixed' } }
        }

        fixMap.forEach(({ id, gs }) => {
          gs.forEach((gid) => {
            fix(nextM, gid, id)
            if (start === 'now') fix(d.month, gid, id)
          })
        })

        return {
          roster,
          members: d.members.concat(newMembers),
          dues: d.dues.concat(newDues),
        }
      })

      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.membersImported', { n: newMembers.length }))
    },

    /* ---------- lịch cố định và buổi ---------- */
    toggleSchedule: (id) => {
      // Đọc TRƯỚC khi ghi: db() sau up() vẫn là state cũ (React chưa render lại).
      const was = db().schedules.find((x) => x.id === id)
      if (!was) return
      up((d) => ({ schedules: d.schedules.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }))
      toast(t(was.active ? 'toast.scheduleOff' : 'toast.scheduleOn', { name: was.name }))
    },
    toggleWeekday: (wdNum) =>
      upUi((u) => {
        const w = (u.form.weekdays || []).slice()
        const i = w.indexOf(wdNum)
        if (i < 0) w.push(wdNum)
        else w.splice(i, 1)
        return { form: { ...u.form, weekdays: w } }
      }),
    /** Bật/tắt một nhóm trong form. `field` là 'mGroups' (thêm mới) hoặc 'eGroups' (sửa). */
    toggleMemberGroup: (gid, field = 'mGroups') =>
      upUi((u) => {
        const w = (u.form[field] || []).slice()
        const i = w.indexOf(gid)
        if (i < 0) w.push(gid)
        else w.splice(i, 1)
        return { form: { ...u.form, [field]: w } }
      }),
    /**
     * Đổi nhóm trong hộp thoại tạo lịch → kéo luôn giờ mặc định của nhóm đó xuống các dòng sân.
     *
     * Trước đây `defaultCourtRows` chỉ đọc `db.groups[0]` MỘT LẦN lúc mở hộp thoại, nên tạo
     * lịch cho "Ca chủ nhật" lại điền giờ của "Ca thứ 6" (nhóm đứng đầu mảng) — và đổi nhóm
     * xong giờ vẫn đứng im. Hai ô "giờ mặc định" của nhóm vì thế trông như vô dụng: chúng có
     * dữ liệu đúng nhưng không bao giờ tới được đúng chỗ.
     *
     * Chỉ đụng dòng sân đang có, KHÔNG đụng buổi nào đã sinh — giờ của buổi nằm ở `session_courts`.
     */
    setScheduleGroup: (gid) =>
      upUi((u) => {
        const g = db().groups.find((x) => x.id === gid)
        if (!g) return { form: { ...u.form, sGroup: gid } }
        return {
          form: {
            ...u.form,
            sGroup: gid,
            rows: (u.form.rows || []).map((r) => ({ ...r, from: g.from || r.from, to: g.to || r.to })),
          },
        }
      }),
    addRow: () => {
      // CLB mới chưa có sân nào — nói rõ thay vì nổ vì đọc courts[0].
      const c = db().courts[0]
      if (!c) return toast(t('toast.needCourtFirst'))
      upUi((u) => {
        // Giờ lấy theo nhóm ĐANG CHỌN trong form, không phải `groups[0]`. Đọc groups[0] là
        // thêm dòng sân thứ hai cho lịch Ca chủ nhật lại điền giờ của Ca thứ 6 — cùng đúng
        // cái lỗi mà `setScheduleGroup` vừa vá cho dòng đầu.
        const gs = db().groups
        const g = gs.find((x) => x.id === u.form.sGroup) || gs[0]
        return {
          form: {
            ...u.form,
            rows: (u.form.rows || []).concat([
              { courtId: c.id, label: '', from: (g && g.from) || '18:00', to: (g && g.to) || '20:00' },
            ]),
          },
        }
      })
    },
    delRow: (i) =>
      upUi((u) => {
        const r = (u.form.rows || []).slice()
        r.splice(i, 1)
        return { form: { ...u.form, rows: r } }
      }),
    setRow: (i, k, v) =>
      upUi((u) => {
        const r = (u.form.rows || []).slice()
        r[i] = { ...r[i], [k]: v }
        return { form: { ...u.form, rows: r } }
      }),
    createSchedule: (dates) => {
      const f = form()
      const d0 = db()
      const sGroup = f.sGroup || (d0.groups.length > 0 ? d0.groups[0].id : '')
      if (!sGroup) return toast(t('toast.needGroupFirst'))
      if (!dates.length) return toast(t('toast.needWeekday'))
      up((d) => {
        const scId = uid()
        const rows = (f.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false }))
        const exist = {}
        d.sessions.forEach((x) => { exist[x.date + '|' + sGroup] = true })
        const added = []
        dates.forEach((dt) => {
          if (exist[dt + '|' + sGroup]) return
          added.push({
            id: uid(), date: dt, groupId: sGroup, status: 'draft', note: '',
            courts: rows.map((r) => ({ ...r })), scheduleId: scId,
          })
        })
        return {
          schedules: d.schedules.concat([{
            id: scId, name: f.sName || t('schedules.autoName', { group: groupOf(d, f.sGroup).short }), groupId: f.sGroup,
            weekdays: f.weekdays, rows: f.rows, start: f.start, end: f.end, active: true,
          }]),
          sessions: d.sessions.concat(added).sort((a, b) => (a.date < b.date ? -1 : 1)),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.scheduleCreated', { n: dates.length, from: dd(dates[0]), to: dd(dates[dates.length - 1]) }))
    },
    /**
     * SỬA một lịch đã sinh buổi. Toàn bộ luật "được đụng buổi nào" nằm ở
     * `lib/schedules.js: planScheduleEdit` — buổi đã mở/chốt/huỷ và buổi quá khứ bất khả xâm
     * phạm, xem chú thích đầu file đó.
     *
     * Kế hoạch tính LẠI ở đây từ `db()` chứ không nhận từ dialog: dialog tính để HIỆN, action
     * tính để LÀM. Nhận bản dialog truyền xuống là có ngày người ta duyệt một bản kế hoạch
     * còn app chạy một bản khác (state đổi giữa lúc hộp thoại đang mở).
     */
    saveSchedule: () => {
      const f = form()
      const d0 = db()
      const sched = (d0.schedules || []).find((x) => x.id === f.eSchedId)
      if (!sched) return
      const plan = planScheduleEdit(d0, sched, f)
      if (plan.blocked.length) return toast(t(plan.blocked[0]))

      up((d) => applyScheduleEdit(d, sched, f, planScheduleEdit(d, sched, f), uid))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.scheduleSaved', {
        name: f.sName || sched.name,
        keep: plan.keep.length, add: plan.add.length, remove: plan.remove.length,
        skip: plan.locked.length + plan.past.length,
      }))
    },
    /**
     * XOÁ HẲN một lịch. Chỉ cho khi lịch còn mềm (`planScheduleDelete`) — còn buổi đã mở/đã
     * chốt/đã qua ngày thì đường đúng là bấm "Tắt", không phải xoá.
     */
    deleteSchedule: (id) => {
      const d0 = db()
      const sched = (d0.schedules || []).find((x) => x.id === id)
      if (!sched) return
      const plan = planScheduleDelete(d0, sched)
      if (!plan.ok) return toast(t('toast.scheduleNoDelete', { n: plan.locked.length + plan.past.length }))
      up((d) => ({
        schedules: d.schedules.filter((x) => x.id !== id),
        sessions: d.sessions.filter((x) => x.scheduleId !== id),
      }))
      toast(t('toast.scheduleDeleted', { name: sched.name, n: plan.sessions.length }))
    },
    createAdhoc: () => {
      const f = form()
      if (!f.aDate) return toast(t('toast.needDate'))
      // CLB chưa có sân nào thì `defaultCourtRows` trả `courtId: ''`, mà `session_courts.court_id`
      // là `uuid NOT NULL REFERENCES courts(id)` — chuỗi rỗng xuống đó là Postgres 22P02, và vì
      // ảnh chụp đồng bộ chỉ cập nhật khi MỌI op xong nên cả hàng đợi kẹt lại. Nút "Buổi đột xuất"
      // nằm ở header nên đây là thao tác một CLB mới toanh chạm vào đầu tiên.
      if (!db().courts.length) return toast(t('toast.needCourtFirst'))
      if ((f.rows || []).some((r) => !r.courtId)) return toast(t('toast.needCourtFirst'))
      // Sinh id TRƯỚC updater: StrictMode gọi updater hai lần, gán biến ngoài ở trong đó thì
      // biến giữ id của lần gọi này còn state giữ id của lần gọi kia — nav() trỏ vào buổi
      // không tồn tại.
      const newId = uid()
      up((d) => {
        return {
          sessionId: newId,
          sessions: d.sessions.concat([{
            // LUÔN 'ALL' (→ group_id NULL). Gán buổi đột xuất vào một ca cố định thì
            // `unitPrice` đếm nó vào số buổi của ca đó, đơn giá một buổi tụt xuống, và tiền
            // back cho người vắng của CẢ ca giảm theo — không ai sửa gì mà tiền vẫn đổi.
            id: newId, date: f.aDate, groupId: 'ALL', status: 'open',
            note: t('adhoc.noteDefault'),
            courts: (f.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false })),
            scheduleId: null,
          }]).sort((a, b) => (a.date < b.date ? -1 : 1)),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      nav('session', newId)
      toast(t('toast.adhocCreated', { date: dd(f.aDate) }))
    },

    /* ---------- sổ quỹ ---------- */
    createCourtBill: () => {
      const f = form()
      const d = db()
      const amt = intOf(f.bAmount)
      const venue = resolveVenue(d, f.bVenue || '').trim()
      if (!amt || !venue) return toast(t('toast.needVenueAmount'))
      up((d) => {
        return {
          courtBills: (d.courtBills || []).concat([{
            id: uid(), month: f.bMonth, date: f.bDate, venue, amount: amt,
            payerId: f.bPayer || null, payer: '', note: f.bNote || '',
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.billAdded', { amount: fmtK(amt) }))
    },
    /**
     * Sửa một hoá đơn sân ĐÃ GHI. Gõ nhầm số tiền hay nhầm tháng là chuyện thường, mà cách duy
     * nhất trước đây là xoá rồi ghi lại — xoá xong ghi lại thì mất luôn `repaidAt`, tức là mất
     * dấu vết CLB đã trả lại người ứng hay chưa.
     *
     * KHÔNG đụng `repaidAt`: đó là sự kiện tiền rời két, thuộc về nút Hoàn/Trả lại, không thuộc
     * về form sửa. Đổi người ứng thì người mới cũng thừa hưởng đúng trạng thái đã trả đó.
     */
    saveCourtBill: () => {
      const f = form()
      const d = db()
      const amt = intOf(f.bAmount)
      const venue = resolveVenue(d, f.bVenue || '').trim()
      if (!amt || !venue) return toast(t('toast.needVenueAmount'))
      up((d) => ({
        courtBills: (d.courtBills || []).map((x) => (x.id === f.eBillId
          ? { ...x, month: f.bMonth, date: f.bDate, venue, amount: amt, payerId: f.bPayer || null, note: f.bNote || '' }
          : x)),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.billSaved', { amount: fmtK(amt) }))
    },
    createLedger: () => {
      const f = form()
      const amt = intOf(f.lAmount)
      if (!amt || !(f.lLabel || '').trim()) return toast(t('toast.needLabelAmount'))
      up((d) => {
        return {
          manual: d.manual.concat([{
            id: uid(), date: f.lDate, dir: f.lDir, cat: f.lCat, label: f.lLabel, amount: amt,
            by: memberOf(d, (d.members.find((m) => m.userId === d.currentUserId) || {}).id).name,
          }]),
        }
      })
      // Bung sẵn nhóm vừa ghi vào. Dòng sổ quỹ gộp theo ngày+hạng mục+chiều, nên ghi một khoản
      // trùng ngày và hạng mục với khoản đã có thì nó chui vào dòng cũ, dòng cũ đổi thành
      // "2 dòng" và MÀN HÌNH KHÔNG CÓ DÒNG NÀO MỚI — người ghi tưởng bấm hụt, ghi lại lần nữa.
      const gk = groupKey({ date: f.lDate, cat: f.lCat, dir: f.lDir })
      upUi((u) => ({ dialog: null, form: {}, expanded: { ...u.expanded, [gk]: true } }))
      toast(t('toast.ledgerAdded'))
    },
    /** Sửa một dòng thu/chi ghi tay. Giữ nguyên `by` — người ghi gốc là dấu vết, không phải ô nhập. */
    saveLedger: () => {
      const f = form()
      const amt = intOf(f.lAmount)
      if (!amt || !(f.lLabel || '').trim()) return toast(t('toast.needLabelAmount'))
      up((d) => ({
        manual: d.manual.map((x) => (x.id === f.eLedgerId
          ? { ...x, date: f.lDate, dir: f.lDir, cat: f.lCat, label: f.lLabel, amount: amt }
          : x)),
      }))
      // Sửa ngày hoặc hạng mục là dòng nhảy sang nhóm khác — bung nhóm ĐÍCH, không phải nhóm cũ.
      upUi((u) => ({
        dialog: null, form: {},
        expanded: { ...u.expanded, [groupKey({ date: f.lDate, cat: f.lCat, dir: f.lDir })]: true },
      }))
      toast(t('toast.ledgerSaved'))
    },
    setCourtPayMode: (v) => {
      up((d) => ({ club: { ...d.club, courtPayMode: v } }))
      toast(t(v === 'month' ? 'toast.payModeMonth' : 'toast.payModeSession'))
    },

    /**
     * CLB trả lại tiền cho người đã ứng — LÚC NÀY khoản chi mới vào sổ quỹ (migration 0011).
     * Bấm lần nữa thì gỡ đánh dấu: bấm nhầm mà không lùi được thì sổ quỹ mang một dòng chi ma.
     * Đọc trạng thái TRƯỚC khi ghi — updater của React không chạy đồng bộ, đọc trong đó thì
     * toast báo ngược (đúng cái bug `toggleSchedule` đã dính một lần).
     */
    repayAdvance: (id) => {
      const cur = (db().courtBills || []).find((x) => x.id === id)
      if (!cur) return
      const on = !cur.repaidAt
      up((d) => ({ courtBills: d.courtBills.map((x) => (x.id === id ? { ...x, repaidAt: on ? d.today : '' } : x)) }))
      toast(t(on ? 'toast.advanceRepaid' : 'toast.advanceUndone'))
    },
    deleteAdvance: (id) => {
      up((d) => ({ courtBills: (d.courtBills || []).filter((x) => x.id !== id) }))
      toast(t('toast.debtDeleted'))
    },

    /* ---------- cài đặt ---------- */
    setClub: (k, v) => up((d) => ({ club: { ...d.club, [k]: v } })),
    toggleMultiGroup: (enabled) => {
      up((d) => ({ club: { ...d.club, multiGroup: !!enabled } }))
      toast(t(enabled ? 'toast.multiGroupEnabled' : 'toast.multiGroupDisabled'))
    },
    setDefaultGroupDues: (k, v) =>
      up((d) => {
        if (!d.groups || d.groups.length === 0) return {}
        const defGid = d.groups[0].id
        return {
          groups: d.groups.map((g) => (g.id === defGid ? { ...g, [k]: intOf(v) } : g)),
        }
      }),
    /**
     * Thang trình độ của CLB. Nhập một chuỗi "yếu, ..., mạnh" — THỨ TỰ chính là thứ tự mạnh dần,
     * thuật toán cân sân dùng đúng thứ tự này.
     * Chặn xoá trình độ đang có người dùng: xoá xong thì bảng giá khách và cân sân sai câm.
     */
    /**
     * Gán một mức giá khách cho NHIỀU trình độ cùng lúc. Thang 9 bậc là 18 ô nhập tay, mà thực
     * tế CLB chỉ có vài mức giá — gõ từng ô vừa lâu vừa dễ lệch.
     * `who`: 'nam' | 'nu' | 'both'.
     */
    applyPriceBulk: () => {
      const f = form()
      const levels = f.bulkLevels || []
      const price = intOf(f.bulkPrice)
      const who = f.bulkWho || 'both'
      if (!levels.length) return toast(t('toast.needLevels'))
      up((d) => ({
        guestPrices: d.guestPrices.map((x) => {
          if (levels.indexOf(x.level) < 0) return x
          return {
            ...x,
            nam: who === 'nu' ? x.nam : price,
            nu: who === 'nam' ? x.nu : price,
          }
        }),
      }))
      upUi((u) => ({ form: { ...u.form, bulkLevels: [] } }))
      toast(t('toast.priceBulk', { n: levels.length, amount: fmtK(price) }))
    },
    toggleBulkLevel: (level) =>
      upUi((u) => {
        const w = (u.form.bulkLevels || []).slice()
        const i = w.indexOf(level)
        if (i < 0) w.push(level)
        else w.splice(i, 1)
        return { form: { ...u.form, bulkLevels: w } }
      }),
    setLevels: (text) => {
      const list = String(text || '').split(',').map((x) => x.trim()).filter(Boolean)
      const next = list.filter((x, i) => list.indexOf(x) === i)
      if (next.length < 2) return toast(t('toast.levelsTooFew'))
      const d0 = db()
      const used = new Set()
      d0.members.forEach((m) => {
        used.add(m.level)
        if (m.pendingLevel) used.add(m.pendingLevel)
        // Bậc chỉ còn trong lịch sử vẫn ĐANG được dùng: xoá nó khỏi thang là các buổi cũ đọc ra
        // một bậc không tồn tại, `levels.indexOf()` ra -1 và cân sân sai lặng lẽ.
        ;(m.levelHistory || []).forEach((h) => used.add(h.level))
      })
      d0.guests.forEach((g) => used.add(g.level))
      d0.sessionGuests.forEach((g) => used.add(g.level))
      const lost = [...used].filter((l) => l && next.indexOf(l) < 0)
      if (lost.length) return toast(t('toast.levelsInUse', { list: lost.join(', ') }))
      up((d) => ({
        levels: next,
        club: { ...d.club, levels: next },
        guestPrices: next.map((lv) => d.guestPrices.find((p) => p.level === lv) || { level: lv, nam: 0, nu: 0 }),
      }))
      toast(t('toast.levelsSaved', { n: next.length }))
    },
    setLockDay: (v) => up((d) => ({ club: { ...d.club, lockDay: Math.min(28, Math.max(1, intOf(v) || 1)) } })),
    setPrice: (level, gender, v) =>
      up((d) => ({
        guestPrices: d.guestPrices.map((x) => (x.level === level ? { ...x, [gender]: intOf(v) } : x)),
      })),
    setCourtField: (id, k, v) =>
      up((d) => ({
        courts: d.courts.map((c) => (c.id === id ? { ...c, [k]: k === 'price' ? intOf(v) : v } : c)),
      })),
    addCourt: () => {
      const f = form()
      const name = (f.cName || '').trim()
      if (!name) return toast(t('toast.needCourtName'))
      up((d) => ({
        courts: d.courts.concat([{
          id: uid(), name, addr: (f.cAddr || '').trim(),
          mapUrl: (f.cMapUrl || '').trim(),
          price: intOf(f.cPrice), active: true,
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtCreated', { name }))
    },
    addGroup: () => {
      const f = form()
      const d0 = db()
      const def = d0.groups[0] || {}
      const name = (f.grName || '').trim()
      if (!name) return toast(t('toast.needGroupName'))
      up((d) => ({
        groups: d.groups.concat([{
          id: uid(), name, short: (f.grShort || '').trim() || name.slice(0, 3),
          feeNam: def.feeNam || 0,
          feeNu: def.feeNu || 0,
          unitNam: def.unitNam || 0,
          unitNu: def.unitNu || 0,
          from: f.grFrom || '18:00', to: f.grTo || '20:00',
          courtIds: [], active: true,
          sortOrder: d.groups.length,
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.groupCreated', { name }))
    },
    toggleGroupCourt: (gid, cid) =>
      up((d) => ({
        groups: d.groups.map((g) => {
          if (g.id !== gid) return g
          const has = (g.courtIds || []).indexOf(cid) >= 0
          return { ...g, courtIds: has ? g.courtIds.filter((x) => x !== cid) : (g.courtIds || []).concat([cid]) }
        }),
      })),
    setGroupField: (id, k, v) =>
      up((d) => ({
        // Khoá nào là SỐ phải liệt kê tay: `typeof g[k] === 'number'` sai ngay khi giá trị đang
        // là null (đơn giá tự đặt để trống) — lúc đó nó nhét thẳng chuỗi vào cột bigint.
        groups: d.groups.map((g) => (g.id === id
          ? { ...g, [k]: GROUP_NUM.indexOf(k) >= 0 ? intOf(v) : v }
          : g)),
      })),
    /**
     * Xoá một nhóm cố định. Chặn theo DỮ LIỆU (`money.js: groupRefs`), không theo vị trí.
     *
     * Luật cũ chặn `groups[0]` là "nhóm mặc định không xoá" — mà `groups[0]` chỉ là nhóm đứng
     * đầu mảng, không phải một cờ thật. Nhập cài đặt từ CLB khác xong là thứ tự đổi, và người
     * ta không xoá nổi một nhóm rác dù nó chẳng dính gì. Luật cũ cũng chỉ kiểm buổi + lịch,
     * bỏ lọt quỹ tháng / đối chiếu / danh sách cố định — mà mấy bảng đó đều trỏ về
     * `member_groups` bằng khoá ngoại TRẦN, xoá là 23503 và kẹt cả hàng đợi đồng bộ.
     */
    deleteGroup: (id) => {
      const d0 = db()
      const why = groupRefs(d0, id)
      if (why.length) {
        const txt = why.map((k) => t('settings.groupRef.' + k)).join(', ')
        // Có lịch sử = chặn VĨNH VIỄN, nói thẳng ra. Gộp chung với "gỡ đi rồi xoá lại" là để
        // người ta ngồi gỡ mãi một thứ không bao giờ gỡ nổi.
        return toast(t(why.indexOf('history') >= 0 ? 'toast.groupHistoryLocked' : 'toast.groupInUse', { why: txt }))
      }
      up((d) => ({
        groups: d.groups.filter((g) => g.id !== id),
        // Hết ca thì thành đi lẻ. KHÔNG đá sang ca mặc định: đó là gán cố định thay cho user,
        // và tháng sau sẽ thu quỹ của một ca họ chưa bao giờ chọn.
        members: d.members.map((m) => ({ ...m, groupIds: (m.groupIds || []).filter((g) => g !== id) })),
      }))
      toast(t('toast.groupDeleted'))
    },
    saveMoneyTab: ({
      feeNam,
      feeNu,
      hasRefund,
      unitNam,
      unitNu,
      guestPrices,
      hasMemberExtraDiscount,
      memberExtraDiscount,
    }) => {
      const parseUnit = (v) => (v === -1 || v === '-1' ? -1 : intOf(v))
      up((d) => {
        const def = (d.groups || []).find((g) => !g.hasCustomPricing) || d.groups[0] || {}
        const isCustom = (g) => {
          if (g.hasCustomPricing === true) return true
          if (g.hasCustomPricing === false) return false
          if (!def.id || def.hasCustomPricing) return false
          if (g.id === def.id) return false
          return (
            intOf(g.feeNam) !== intOf(def.feeNam) ||
            intOf(g.feeNu) !== intOf(def.feeNu) ||
            intOf(g.unitNam) !== intOf(def.unitNam) ||
            intOf(g.unitNu) !== intOf(def.unitNu)
          )
        }
        return {
          club: {
            ...d.club,
            ...(hasMemberExtraDiscount !== undefined
              ? { hasMemberExtraDiscount: Boolean(hasMemberExtraDiscount) }
              : {}),
            ...(memberExtraDiscount !== undefined
              ? { memberExtraDiscount: intOf(memberExtraDiscount) }
              : {}),
          },
          groups: d.groups.map((g) => {
            if (isCustom(g)) return g
            return {
              ...g,
              feeNam: intOf(feeNam),
              feeNu: intOf(feeNu),
              hasRefund: hasRefund !== undefined ? hasRefund : g.hasRefund,
              unitNam: parseUnit(unitNam),
              unitNu: parseUnit(unitNu),
            }
          }),
          guestPrices: guestPrices ? guestPrices.map((x) => ({
            level: x.level,
            nam: intOf(x.nam),
            nu: intOf(x.nu),
          })) : d.guestPrices,
        }
      })
      toast(t('toast.pricingSaved'))
    },
    saveGroupsTab: (groupsList) => {
      up(() => ({
        groups: groupsList.map((g, idx) => ({
          ...g,
          name: (g.name || '').trim(),
          short: (g.short || '').trim() || (g.name || '').slice(0, 3),
          feeNam: intOf(g.feeNam),
          feeNu: intOf(g.feeNu),
          unitNam: g.unitNam === -1 || g.unitNam === '-1' ? -1 : intOf(g.unitNam),
          unitNu: g.unitNu === -1 || g.unitNu === '-1' ? -1 : intOf(g.unitNu),
          from: g.from || '18:00',
          to: g.to || '20:00',
          sortOrder: idx,
        })),
      }))
      toast(t('toast.groupsSaved'))
    },
    exportSettings: () => {
      const d = db()
      const data = {
        schema: 'badminclub_settings',
        version: 1,
        exportedAt: new Date().toISOString(),
        clubName: d.club?.name || '',
        clubCode: d.club?.code || '',
        club: {
          roundUnit: !!d.club?.roundUnit,
          lockDay: d.club?.lockDay || cfg.club.defaultLockDay,
          seeDebtEachOther: !!d.club?.seeDebtEachOther,
          seeFund: !!d.club?.seeFund,
          courtPayMode: d.club?.courtPayMode || 'payer',
          levels: d.levels || cfg.levelsDefault,
        },
        money: {
          feeNam: d.groups[0]?.feeNam || 0,
          feeNu: d.groups[0]?.feeNu || 0,
          unitNam: d.groups[0]?.unitNam || 0,
          unitNu: d.groups[0]?.unitNu || 0,
          hasMemberExtraDiscount: Boolean(d.club?.hasMemberExtraDiscount),
          memberExtraDiscount: d.club?.memberExtraDiscount != null ? intOf(d.club.memberExtraDiscount) : 5000,
          guestPrices: (d.guestPrices || []).map((p) => ({
            level: p.level,
            nam: p.nam || 0,
            nu: p.nu || 0,
          })),
        },
        courts: (d.courts || []).map((c) => ({
          name: c.name,
          addr: c.addr || '',
          mapUrl: c.mapUrl || '',
          price: c.price || 0,
          active: c.active !== false,
        })),

        groups: (d.groups || []).map((g) => ({
          name: g.name,
          short: g.short || '',
          feeNam: g.feeNam || 0,
          feeNu: g.feeNu || 0,
          unitNam: g.unitNam || 0,
          unitNu: g.unitNu || 0,
          from: g.from || '18:00',
          to: g.to || '20:00',
          active: g.active !== false,
        })),
      }

      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const aEl = document.createElement('a')
      const fileName = `cai_dat_clb_${d.club?.code || 'badmin'}.json`
      aEl.href = url
      aEl.download = fileName
      document.body.appendChild(aEl)
      aEl.click()
      document.body.removeChild(aEl)
      URL.revokeObjectURL(url)
      toast(t('toast.settingsExported', { file: fileName }))
    },
    /**
     * Tải lịch sử trận ra file .json. Chỉ trục thi đấu — không tiền quỹ, không công nợ.
     * Dùng đúng cách tải của `exportSettings` để hai chỗ không trôi khác nhau.
     */
    exportMatches: (range = null) => {
      const d = db()
      const data = buildMatchBackup(d, range)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const aEl = document.createElement('a')
      // Tên file nói rõ trong đó là khoảng nào — sau này có chục file thì không phải mở ra đoán.
      const tag = range?.label ? `_${String(range.label).replace(/[^w-]+/g, '-')}` : ''
      const fileName = `tran_dau_${d.club?.code || 'badmin'}${tag}_${new Date().toISOString().slice(0, 10)}.json`
      aEl.href = url
      aEl.download = fileName
      document.body.appendChild(aEl)
      aEl.click()
      document.body.removeChild(aEl)
      URL.revokeObjectURL(url)
      toast(t('toast.matchesExported', { file: fileName, n: data.matchCount }))
    },

    /**
     * Nạp lịch sử trận từ file. TẤT CẢ HOẶC KHÔNG GÌ CẢ — `validateMatchBackup` gác cửa, ở đây
     * chỉ ghi khi nó nói ok. Kiểm lại lần nữa ngay trước khi ghi chứ không tin kết quả dialog
     * đã soi lúc chọn file: giữa hai thời điểm đó có thể vừa đồng bộ về một trận mới từ máy khác.
     */
    applyImportedMatches: (data) => {
      const res = validateMatchBackup(data, db())
      if (!res.ok) return toast(t('toast.matchesImportBlocked'))
      up(() => ({ matches: res.matches }))
      toast(t('toast.matchesImported', { n: res.matches.length }))
    },

    applyImportedSettings: (data, opts = {}) => {
      if (!data || data.schema !== 'badminclub_settings') {
        return toast(t('toast.settingsBadFile'))
      }

      up((d) => {
        const next = {}

        // 1. Cài đặt chung & Levels
        if (opts.includeClub && data.club) {
          const clubLevels = Array.isArray(data.club.levels) && data.club.levels.length
            ? data.club.levels
            : d.levels

          next.club = {
            ...d.club,
            roundUnit: data.club.roundUnit !== undefined ? !!data.club.roundUnit : d.club.roundUnit,
            lockDay: data.club.lockDay || d.club.lockDay,
            seeDebtEachOther: data.club.seeDebtEachOther !== undefined ? !!data.club.seeDebtEachOther : d.club.seeDebtEachOther,
            seeFund: data.club.seeFund !== undefined ? !!data.club.seeFund : d.club.seeFund,
            courtPayMode: data.club.courtPayMode || d.club.courtPayMode,
            levels: clubLevels,
          }
          next.levels = clubLevels
        }

        // 2. Biểu phí & Giá khách giao lưu
        if (opts.includeMoney && data.money) {
          if (data.money.hasMemberExtraDiscount !== undefined) {
            next.club = {
              ...(next.club || d.club),
              hasMemberExtraDiscount: Boolean(data.money.hasMemberExtraDiscount),
              memberExtraDiscount: data.money.memberExtraDiscount != null ? intOf(data.money.memberExtraDiscount) : 5000,
            }
          }
          const activeLevels = next.levels || d.levels
          if (Array.isArray(data.money.guestPrices)) {
            const priceMap = {}
            data.money.guestPrices.forEach((p) => {
              priceMap[p.level] = { nam: intOf(p.nam), nu: intOf(p.nu) }
            })
            next.guestPrices = activeLevels.map((lv) => ({
              level: lv,
              nam: priceMap[lv]?.nam || 0,
              nu: priceMap[lv]?.nu || 0,
            }))
          }
          const feeNam = intOf(data.money.feeNam)
          const feeNu = intOf(data.money.feeNu)
          const unitNam = intOf(data.money.unitNam)
          const unitNu = intOf(data.money.unitNu)
          const currentGroups = next.groups || d.groups
          next.groups = currentGroups.map((g) => ({
            ...g,
            feeNam: feeNam || g.feeNam,
            feeNu: feeNu || g.feeNu,
            unitNam: unitNam || g.unitNam,
            unitNu: unitNu || g.unitNu,
          }))
        }

        // 3. Sân bãi
        if (opts.includeCourts && Array.isArray(data.courts) && data.courts.length) {
          const existingCourts = (d.courts || []).slice()
          const newCourts = []
          data.courts.forEach((c) => {
            const match = existingCourts.find((x) => x.name.toLowerCase() === (c.name || '').trim().toLowerCase())
            if (match) {
              match.addr = c.addr || match.addr
              match.mapUrl = c.mapUrl || match.mapUrl
              match.price = intOf(c.price) || match.price
            } else {
              newCourts.push({
                id: uid(),
                name: (c.name || '').trim(),
                addr: c.addr || '',
                mapUrl: c.mapUrl || '',
                price: intOf(c.price),
                active: c.active !== false,
              })
            }
          })
          next.courts = existingCourts.concat(newCourts)
        }



        // 5. Nhóm cố định
        if (opts.includeGroups && Array.isArray(data.groups) && data.groups.length) {
          const existingGroups = (next.groups || d.groups || []).slice()
          const newGroups = []
          data.groups.forEach((g) => {
            const match = existingGroups.find((x) => x.name.toLowerCase() === (g.name || '').trim().toLowerCase())
            if (match) {
              match.short = g.short || match.short
              match.from = g.from || match.from
              match.to = g.to || match.to
              match.feeNam = intOf(g.feeNam) || match.feeNam
              match.feeNu = intOf(g.feeNu) || match.feeNu
              match.unitNam = intOf(g.unitNam) || match.unitNam
              match.unitNu = intOf(g.unitNu) || match.unitNu
            } else {
              newGroups.push({
                id: uid(),
                name: (g.name || '').trim(),
                short: g.short || (g.name || '').slice(0, 3),
                from: g.from || '18:00',
                to: g.to || '20:00',
                feeNam: intOf(g.feeNam) || 0,
                feeNu: intOf(g.feeNu) || 0,
                unitNam: intOf(g.unitNam) || 0,
                unitNu: intOf(g.unitNu) || 0,
                courtIds: [],
                active: g.active !== false,
              })
            }
          })
          next.groups = existingGroups.concat(newGroups)
        }

        return next
      })

      upUi(() => ({ dialog: null }))
      toast(t('toast.settingsImported', { club: data.clubName || t('common.unknown') }))
    },

    /**
     * Tự đổi TÊN của mình trong CLB — không cần ai duyệt. Chỉ hai cột `name` (tên hiển thị) và
     * `full_name`; trình độ / SĐT / vai vẫn phải xin qua `requestChange`, và trigger
     * `cm_guard_self_update` (0010) chặn mọi cột khác ngay dưới DB, không tin client.
     *
     * KHÔNG đi qua đồng bộ ngầm như các action khác: `storage.js` ghi bằng upsert, mà upsert là
     * `INSERT ... ON CONFLICT` nên Postgres đòi cả policy INSERT — thành viên thường không có,
     * op sẽ hỏng VĨNH VIỄN và kẹt luôn hàng đợi (xem `ponytail:` ở `storage.js: flush`). Vì thế
    /**
     * Thành viên tự đổi thông tin hồ sơ của mình trong CLB: tên hiển thị, tên đầy đủ, ảnh đại diện trong CLB.
     * Cập nhật trực tiếp `club_members` rồi `reload()`.
     */
    updateMe: async ({ name, fullName, avatarUrl } = {}) => {
      const d0 = db()
      const me = d0.members.find((m) => m.userId === d0.currentUserId)
      if (!me) return toast(t('toast.noMemberRecord'))
      const nm = String(name ?? me.name).trim()
      if (!nm) return toast(t('toast.needMemberName'))
      const full = String(fullName ?? me.fullName ?? '').trim()
      const currentAv = me.avatarUrl || ''
      const newAv = avatarUrl !== undefined ? (avatarUrl || '') : currentAv
      if (nm === me.name && full === (me.fullName || '') && newAv === currentAv) {
        return toast(t('toast.changeSame'))
      }
      try {
        const rows = unwrap(await supabase.from('club_members')
          .update({ name: nm, full_name: full || null, avatar_url: newAv || null })
          .eq('id', me.id)
          .select())
        if (!rows || rows.length === 0) {
          return toast(t('toast.noMemberRecord'))
        }
      } catch (e) {
        return toast(e.message)
      }
      await reload()
      toast(t('toast.updatedMe'))
    },

    renameMe: async (name, fullName) => {
      const d0 = db()
      const me = d0.members.find((m) => m.userId === d0.currentUserId)
      if (!me) return toast(t('toast.noMemberRecord'))
      const nm = String(name || '').trim()
      if (!nm) return toast(t('toast.needMemberName'))
      const full = String(fullName || '').trim()
      if (nm === me.name && full === (me.fullName || '')) return toast(t('toast.changeSame'))
      try {
        unwrap(await supabase.from('club_members')
          .update({ name: nm, full_name: full || null })
          .eq('id', me.id))
      } catch (e) {
        return toast(e.message)
      }
      await reload()
      toast(t('toast.renamedMe', { name: nm }))
    },

    setMemberShelf: (mid, shelf) => {
      const s = Array.isArray(shelf) ? shelf.slice(0, 3) : []
      up((d) => ({
        members: (d.members || []).map((m) =>
          m.id === mid ? { ...m, badgeShelf: s, badge_shelf: s } : m,
        ),
      }))
      toast(t('badges.shelfSaved'))
    },

    setMemberSignature: (mid, sig) => {
      const text = String(sig || '').trim().slice(0, 80)
      up((d) => ({
        members: (d.members || []).map((m) =>
          m.id === mid ? { ...m, signature: text } : m,
        ),
      }))
      toast(t('badges.signatureSaved'))
    },

    /**
     * Thành viên tự xin đổi thông tin của mình trong CLB (handoff 01 §6).
     * SĐT áp dụng NGAY, trình độ áp dụng TỪ THÁNG SAU — vì trình độ ảnh hưởng giá khách và
     * thuật toán cân sân của những buổi đã chốt.
     */
    requestChange: (field, value) => {
      const d0 = db()
      const me = d0.members.find((m) => m.userId === d0.currentUserId)
      if (!me) return toast(t('toast.noMemberRecord'))
      const from = field === 'phone' ? (me.phone || '') : me.level
      const to = String(value || '').trim()
      if (!to) return toast(t('toast.changeEmpty'))
      if (to === from) return toast(t('toast.changeSame'))
      if ((d0.changes || []).some((c) => c.status === 'pending' && c.memberId === me.id && c.field === field)) {
        return toast(t('toast.changeDup'))
      }
      // Tách `id` ra khỏi `up()` để dòng thông báo trỏ được vào đúng yêu cầu vừa tạo.
      const changeId = uid()
      up((d) => ({
        changes: (d.changes || []).concat([{
          id: changeId, memberId: me.id, field, from, to, by: 'member',
          effective: field === 'phone' ? 'now' : 'next', status: 'pending',
        }]),
      }))
      // TẮT theo yêu cầu: toàn bộ thông báo mục Thành viên (cả chuông lẫn push).
      //
      // ⚠️ Hệ quả: yêu cầu đổi SĐT / trình độ nằm im trong màn Thành viên cho tới khi chủ CLB
      // tình cờ mở ra. Không có đường nào khác để họ biết. Bật lại khi thấy sót yêu cầu.
      // emitEvent({
      //   type: 'member_change_requested',
      //   payload: { memberId: me.id, field },
      //   recipients: membersWithPerm(d0.members, 'members'),
      //   refType: 'member',
      //   refId: changeId,
      //   actorId: me.id,
      //   skipActivity: true,
      // })
      toast(t(field === 'phone' ? 'toast.changeAskedNow' : 'toast.changeAskedNext'))
    },

    /* ---------- chia sân ---------- */
    setAsnMode: (v) => upUi(() => ({ asnMode: v })),
    pickPlayer: (key) => upUi((u) => ({ picked: u.picked === key ? null : key })),
    place: (sid, slot, key) => {
      if (!key || !canAssign()) return
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const before = lineups[sid] || {}
        const prev = before[slot]
        lineups[sid] = place(before, slot, key)
        const out = { lineups }
        if ((d.groupMode || {})[sid]) {
          const cgAll = { ...(d.courtGroups || {}) }
          const cg = { ...(cgAll[sid] || {}) }
          const ci = slotCourtIdx(slot)
          cg[key] = ci
          if (prev && prev !== key) cg[prev] = ci
          cgAll[sid] = cg
          out.courtGroups = cgAll
        }
        return out
      })
      upUi(() => ({ picked: null }))
    },
    tapSlot: (sid, slot, picked) => {
      if (picked) return null // caller gọi place
      const k = ((db().lineups || {})[sid] || {})[slot]
      if (k) upUi(() => ({ picked: k }))
    },
    clearSlot: (sid, slot) => canAssign() &&
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const lu = { ...(lineups[sid] || {}) }
        delete lu[slot]
        lineups[sid] = lu
        return { lineups }
      }),
    removeFromCourt: (sid, key) => canAssign() &&
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        lineups[sid] = removePlayer(lineups[sid] || {}, key)
        const cgAll = { ...(d.courtGroups || {}) }
        const cg = { ...(cgAll[sid] || {}) }
        delete cg[key]
        cgAll[sid] = cg
        return { lineups, courtGroups: cgAll }
      }),
    assignToCourt: (sid, key, ci) => {
      if (!key || !canAssign()) return
      up((d) => {
        const cgAll = { ...(d.courtGroups || {}) }
        const cg = { ...(cgAll[sid] || {}) }
        cg[key] = ci
        cgAll[sid] = cg
        const lineups = { ...(d.lineups || {}) }
        const lu = { ...(lineups[sid] || {}) }
        Object.keys(lu).forEach((k) => { if (lu[k] === key && slotCourtIdx(k) !== ci) delete lu[k] })
        lineups[sid] = lu
        return { courtGroups: cgAll, lineups }
      })
      upUi(() => ({ picked: null }))
    },
    toggleGroupMode: (sid) => {
      if (!canAssign()) return
      const on = !!(db().groupMode || {})[sid]
      up((d) => ({ groupMode: { ...(d.groupMode || {}), [sid]: !on } }))
      toast(t(on ? 'toast.groupModeOff' : 'toast.groupModeOn'))
    },
    autoSplitCourts: (sid) => {
      if (!canAssign()) return
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const idxs = activeCourtIdxs(s)
      if (idxs.length < 2) return toast(t('toast.oneCourtOnly'))
      const ps = sessionPlayers(d0, s)
      const cg = autoSplit(ps, idxs, d0.levels)
      const mode = (uiRef.current && uiRef.current.asnMode) || 'balance'
      const { lineup } = arrange({
        players: ps,
        session: s,
        mode,
        levels: d0.levels,
        matches: d0.matches || [],
        groupMode: true,
        courtGroups: cg,
        kept: [],
        playing: (d0.playing || {})[sid] || {},
      })
      up((d) => ({
        courtGroups: { ...(d.courtGroups || {}), [sid]: cg },
        lineups: { ...(d.lineups || {}), [sid]: lineup },
        groupMode: { ...(d.groupMode || {}), [sid]: true },
      }))
      upUi(() => ({ picked: null }))
      toast(t('toast.courtsSplit', { n: ps.length, courts: idxs.length }))
    },
    clearLineup: (sid) => {
      if (!canAssign()) return
      up((d) => ({
        lineups: { ...(d.lineups || {}), [sid]: {} },
        courtGroups: { ...(d.courtGroups || {}), [sid]: {} },
        groupMode: { ...(d.groupMode || {}), [sid]: false },
      }))
      upUi(() => ({ picked: null }))
      toast(t('toast.lineupCleared'))
    },
    setLineup: (sid, lineup) => {
      if (!canAssign()) return
      up((d) => ({ lineups: { ...(d.lineups || {}), [sid]: lineup } }))
      toast(t('toast.lineupUpdated'))
    },
    arrange: (sid, mode) => {
      if (!canAssign()) return
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const { lineup, count } = arrange({
        players: sessionPlayers(d0, s),
        session: s,
        mode,
        stats: matchStats(d0.matches, sid),
        current: (d0.lineups || {})[sid] || {},
        groupMode: !!(d0.groupMode || {})[sid],
        courtGroups: (d0.courtGroups || {})[sid] || {},
        levels: d0.levels,
      })
      up((d) => ({ lineups: { ...(d.lineups || {}), [sid]: lineup } }))
      upUi(() => ({ picked: null, asnMode: mode }))
      toast(t('toast.arranged', { mode: modeToast(mode), n: count }))
    },

    /* ---------- bấm giờ và ghi trận ---------- */
    setCourtMin: (sid, ci, v) => canAssign() &&
      up((d) => {
        const all = { ...(d.courtMin || {}) }
        const c = { ...(all[sid] || {}) }
        c[ci] = intOf(v)
        all[sid] = c
        return { courtMin: all }
      }),
    startCourt: (sid, ci) => {
      if (!canAssign()) return
      const on = !!((db().playing || {})[sid] || {})[ci]
      up((d) => {
        const all = { ...(d.playing || {}) }
        const c = { ...(all[sid] || {}) }
        c[ci] = on ? false : Date.now()
        all[sid] = c
        return { playing: all }
      })
      toast(t(on ? 'toast.clockStopped' : 'toast.clockStarted'))
    },
    finishCourt: (sid, ci, minutes) => {
      if (!canAssign()) return
      const d0 = db()
      const lu = (d0.lineups || {})[sid] || {}
      const keys = courtSlotIds(ci).map((sl) => lu[sl]).filter(Boolean)
      if (!keys.length) return toast(t('toast.courtEmpty'))
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const l2 = { ...(lineups[sid] || {}) }
        courtSlotIds(ci).forEach((sl) => { delete l2[sl] })
        lineups[sid] = l2
        const playing = { ...(d.playing || {}) }
        const c = { ...(playing[sid] || {}) }
        c[ci] = false
        playing[sid] = c
        return {
          lineups, playing,
          matches: (d.matches || []).concat([
            { id: uid(), sessionId: sid, courtIdx: ci, playerKeys: keys, minutes, at: Date.now() },
          ]),
        }
      })
      upUi(() => ({ picked: null }))
      toast(t('toast.matchSaved', { n: keys.length, min: minutes }))
    },
    undoMatch: (sid) => {
      if (!canAssign()) return
      const d0 = db()
      const list = (d0.matches || []).filter((x) => x.sessionId === sid)
      if (!list.length) return toast(t('toast.noMatch'))
      const last = list[list.length - 1]
      const remainingMatches = (d0.matches || []).filter((x) => x.id !== last.id)
      const { finalRatings, updatedMatches } = replayRatingCascade(remainingMatches, last.id, d0.members, d0.levels, d0.guests)
      up((d) => {
        const nextRatings = { ...(d.playerRatings || {}) }
        Object.entries(finalRatings || {}).forEach(([mid, r]) => {
          const old = nextRatings[mid] || {}
          nextRatings[mid] = {
            ...old,
            ...r,
            id: old.id || r.id || uid(),
            memberId: mid,
          }
        })
        const memberMap = {}
        ;(d0.members || []).forEach((m) => { memberMap[m.id] = m })
        ;(d0.guests || []).forEach((g) => { memberMap[g.id] = g })
        const calList = computeClubCalibration(updatedMatches, memberMap)
        const prevCals = d.clubCalibration || []
        const nextCals = ['<100', '100-300', '>300'].map((bKey) => {
          const item = calList.find((x) => x.bucket === bKey) || { bucket: bKey, sampleSize: 0, observedWinRate: 0, learnedAdjustment: 0 }
          const existing = prevCals.find((p) => p.bucket === bKey)
          return {
            id: existing?.id || uid(),
            bucket: bKey,
            sampleSize: item.sampleSize || 0,
            observedWinRate: item.observedWinRate || 0,
            learnedAdjustment: item.learnedAdjustment || 0,
          }
        })
        const chalId = last.challengeId
        const challenges = chalId
          ? (d.challenges || []).map((k) => {
              if (k.id !== chalId) return k
              const prog = getChallengeSeriesProgress(k, updatedMatches)
              if (prog.isComplete) {
                return {
                  ...k,
                  status: 'played',
                  winnerTeam: prog.winnerTeam,
                  seriesScore: { winsA: prog.winsA, winsB: prog.winsB },
                }
              }
              return {
                ...k,
                status: 'accepted',
                winnerTeam: null,
                seriesScore: prog.totalSetsPlayed > 0 ? { winsA: prog.winsA, winsB: prog.winsB } : null,
                // Gỡ hết hiệp thì MỞ LẠI cổng cược. `predictionsLocked` là cờ chỉ có đường bật
                // (5 chỗ ghi true, 0 chỗ ghi false) — nhập nhầm tỷ số rồi gỡ ra là kèo câm
                // vĩnh viễn dù nó sắp được đánh lại.
                predictionsLocked: prog.totalSetsPlayed > 0 ? k.predictionsLocked : false,
              }
            })
          : (d.challenges || [])

        return {
          matches: updatedMatches,
          challenges,
          playerRatings: nextRatings,
          clubCalibration: nextCals,
        }
      })
      // Gỡ trận làm chuỗi kèo đổi: còn đủ thắng thì quyết toán lại theo đội thắng mới, quay về
      // dang dở thì đưa phiếu về chờ. Không làm thì phiếu đứng theo trận vừa bị xoá.
      if (last.challengeId) {
        const chalNow = (db().challenges || []).find((k) => k.id === last.challengeId)
        if (chalNow) {
          const prog = getChallengeSeriesProgress(chalNow, updatedMatches)
          if (prog.isComplete) settlePredictions(chalNow.id, prog.winnerTeam)
          else unsettlePredictions(chalNow.id)
        }
      }
      toast(t('toast.matchUndone'))
    },

    /* ---------- Kèo & Thi đấu (Challenge & Rating) ---------- */
    createChallenge: ({ sessionId, teamA, teamB, courtId, bestOf = (cfg.challenge?.defaultBestOf ?? 3), ratingEnabled = true, scheduledAt, stakeText = '' }) => {
      const d0 = db()
      const myMem = myMember(d0)
      const myId = myMem?.id || null
      if (!myId) {
        toast(t('common.unauthorized'))
        return
      }
      const code = nextChallengeCode(d0.challenges)
      // Hạn NHẬN kèo. 60 phút cũ quá ngắn: gạ kèo buổi sáng cho buổi tối là kèo chết trước khi
      // người ta kịp mở app. `defaultExpireMins` vẫn giữ trong config nhưng CHỈ còn dùng để suy
      // cho dòng cũ thiếu `expiresAt` (xem `challengeExpiryAt`) — kèo tạo từ đây ghi thẳng mốc.
      const expireDays = cfg.challenge?.pendingExpireDays ?? 7
      const allInMatch = [...(teamA || []), ...(teamB || [])]
      const acceptedPlayers = allInMatch.includes(myId) ? [myId] : []
      const newChalTemp = {
        teamA: teamA || [],
        teamB: teamB || [],
        acceptedPlayers,
      }
      const isFullyAccepted = isChallengeFullyAccepted(newChalTemp)
      const newChal = {
        id: uid(),
        code,
        clubId: d0.clubId,
        sessionId: sessionId || null,
        createdBy: myId,
        status: isFullyAccepted ? 'accepted' : 'pending',
        courtId: courtId || null,
        scheduledAt: scheduledAt || null,
        bestOf,
        ratingEnabled,
        expiresAt: new Date(Date.now() + expireDays * 86400000).toISOString(),
        matchId: null,
        acceptedPlayers,
        // Kèo tạo ra đã đủ chữ ký (người tạo đánh một mình cả hai đội thì không xảy ra, nhưng
        // admin duyệt sẵn thì có) cũng phải có mốc nhận, không thì timeline lại rơi về giờ tạo.
        acceptedAt: isFullyAccepted ? new Date().toISOString() : '',
        acceptedBy: isFullyAccepted ? myId : null,
        deployedAt: '',
        stakeText: String(stakeText || '').slice(0, cfg.challenge?.stakeMaxLen ?? 120),
        teamA: teamA || [],
        teamB: teamB || [],
      }
      up((d) => ({ challenges: [newChal, ...(d.challenges || [])] }))
      emitEvent({
        type: 'challenge_created',
        payload: {
          chalId: newChal.id,
          code,
          challengerIds: teamA || [],
          opponentIds: teamB || [],
          createdBy: myId,
          // Cố ý KHÔNG ghi `creator: myMem.name`: RULES §3.3 — payload lưu ID, tên giải mã lúc
          // render. Ghi tên cứng xuống DB thì đổi tên thành viên là thông báo cũ giữ tên chết.
        },
        recipients: (teamB || []).filter((id) => id !== myId),
        refType: 'challenge',
        refId: newChal.id,
        actorId: myId,
      })
      // Đồng đội ở ĐỘI A cũng phải bấm nhận thì kèo mới thành (`challenge.js: isFullyAccepted`
      // đòi đủ chữ ký CẢ HAI đội), nhưng trước đây chỉ `teamB` được báo — người đội A không hề
      // biết có kèo, kèo nằm chờ chữ ký của họ rồi hết hạn sau 60 phút.
      // Loại `challenge_created`: câu đó viết cho đối thủ ("nhận được lời thách đấu từ X"),
      // đọc sai nghĩa khi X là đồng đội mình.
      const teammates = (teamA || []).filter((id) => id !== myId)
      if (teammates.length) {
        emitEvent({
          type: 'challenge_teammate',
          payload: { chalId: newChal.id, code },
          recipients: teammates,
          refType: 'challenge',
          refId: newChal.id,
          actorId: myId,
          skipActivity: true, // `challenge_created` đã ghi dòng hoạt động cho kèo này rồi
        })
      }
      toast(t('challenge.toastCreated', { code }))
      return newChal
    },

    /**
     * Đổi thể thức kèo (BO1 ⇄ BO3) sau khi đã tạo.
     *
     * CHỈ cho đổi khi kèo CHƯA ghi set nào. `getChallengeSeriesProgress` suy số hiệp phải
     * thắng ra từ `bestOf`, nên đổi giữa chừng là đổi luôn điều kiện thắng của chính loạt
     * đang đánh: đang dẫn 1-0 ở BO3 mà hạ xuống BO1 thì loạt đó lập tức thành đã kết thúc, còn
     * BO1 đã xong mà nâng lên BO3 thì trận đã chốt bị mở lại.
     */
    setChallengeFormat: (challengeId, bestOf) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      const next = Number(bestOf)
      if (next !== 1 && next !== 3) return
      if ((Number(chal.bestOf) || 1) === next) return

      const myMem = myMember(d0)
      const isCreator = Boolean(myMem && chal.createdBy === myMem.id)
      if (!isCreator && !canAssign()) {
        return
      }

      const hasScore = (d0.matches || []).some((m) => m.challengeId === challengeId)
      if (hasScore || chal.status === 'played' || chal.status === 'cancelled' || chal.status === 'expired') {
        toast(t('challenge.formatLockedToast'))
        return
      }

      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, bestOf: next } : c)),
      }))
      toast(t('challenge.formatChangedToast', { code: chal.code, bo: next }))
    },

    /**
     * Đặt / sửa / xoá GIAO KÈO — thoả thuận đời thật ("thua mua 2 chai nước").
     *
     * Thuần trang trí: không đụng điểm mùa, Elo, SP hay công nợ. App chỉ ghi lại cho hai bên khỏi
     * cãi nhau lúc tan sân; nó không thu hộ và không nhắc nợ ai.
     *
     * Sửa được tới tận lúc kèo đánh xong — khác `setChallengeFormat` phải khoá khi có tỷ số, vì
     * chữ này không tham gia tính toán gì nên đổi lúc nào cũng vô hại.
     */
    setChallengeStake: (challengeId, stakeText) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return

      const myMem = myMember(d0)
      const isCreator = Boolean(myMem && chal.createdBy === myMem.id)
      const isParticipant = Boolean(myMem && [...(chal.teamA || []), ...(chal.teamB || [])].includes(myMem.id))
      if (!isCreator && !isParticipant && !canAssign()) {
        return
      }

      // Cắt đúng trần của cột DB (`challenges_stake_text_len` trong 0048). Cắt ở đây thay vì để
      // server chửi: người dùng gõ dài thì mất phần đuôi, không phải mất cả thao tác.
      const next = String(stakeText || '').trim().slice(0, cfg.challenge?.stakeMaxLen ?? 120)
      if (next === (chal.stakeText || '')) return

      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, stakeText: next } : c)),
      }))
      toast(next ? t('challenge.stakeSavedToast') : t('challenge.stakeClearedToast'))
    },

    respondChallenge: (challengeId, accept, force = false) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      const myMem = myMember(d0)
      const allPlayers = [...(chal.teamA || []), ...(chal.teamB || [])]
      const isParticipant = myMem && allPlayers.includes(myMem.id)
      if (!canAssign() && !isParticipant) return
      if (chal.status !== 'pending') return

      const isExpired = chal.expiresAt && new Date(chal.expiresAt).getTime() <= Date.now()
      if (isExpired) {
        up((d) => ({
          challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, status: 'expired' } : c)),
        }))
        // Kèo chết thì phiếu phải được hoàn, không thì SP của người đặt bị giam vĩnh viễn —
        // không có tiến trình nào quét kèo quá hạn, đây là lần DUY NHẤT ta biết nó đã hết hạn.
        settlePredictions(challengeId, null)
        toast(t('challenge.toastExpired'))
        return
      }

      if (!accept) {
        up((d) => ({
          challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, status: 'declined' } : c)),
        }))
        settlePredictions(challengeId, null)
        emitEvent({
          type: 'challenge_declined',
          payload: { chalId: chal.id, code: chal.code, declinedById: myMem?.id || null },
          recipients: [chal.createdBy],
          refType: 'challenge',
          refId: chal.id,
          actorId: myMem?.id || null,
        })
        toast(t('challenge.toastDeclined', { code: chal.code }))
        return
      }

      let nextAccepted = chal.acceptedPlayers || []
      if (canAssign() && (force || !isParticipant)) {
        // Admin duyệt nhanh: chấp nhận toàn bộ đấu thủ.
        // `force` là nút "Duyệt cả kèo" — admin ĐANG đánh trong kèo cũng bấm được. Thiếu nó thì
        // kèo có người chưa ghép tài khoản không ai nhận nổi (xem `canAdminForceAcceptChallenge`).
        nextAccepted = Array.from(new Set([...nextAccepted, ...allPlayers]))
      } else if (myMem) {
        nextAccepted = Array.from(new Set([...nextAccepted, myMem.id]))
      }

      const isFullyAccepted = isChallengeFullyAccepted({ ...chal, acceptedPlayers: nextAccepted })
      const nextStatus = isFullyAccepted ? 'accepted' : 'pending'

      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId
          ? {
            ...c,
            acceptedPlayers: nextAccepted,
            status: nextStatus,
            // Mốc nhận ghi đúng lúc kèo ĐỦ chữ ký, không phải lúc người đầu tiên bấm — timeline
            // hỏi "kèo chốt lúc mấy giờ", không hỏi "ai bấm trước".
            ...(isFullyAccepted ? { acceptedAt: new Date().toISOString(), acceptedBy: myMem?.id || null } : {}),
          }
          : c)),
      }))

      if (isFullyAccepted) {
        emitEvent({
          type: 'challenge_accepted',
          payload: { chalId: chal.id, code: chal.code, acceptedById: myMem?.id || null },
          recipients: [chal.createdBy],
          refType: 'challenge',
          refId: chal.id,
          actorId: myMem?.id || null,
        })
        toast(t('challenge.toastAccepted', { code: chal.code }))
      } else {
        toast(t('challenge.toastPartiallyAccepted', { code: chal.code }))
      }
    },

    acceptOpenChallenge: ({ challengeId, partnerId }) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      const myMem = myMember(d0)
      const myId = myMem?.id || null
      if (!myId) {
        toast(t('common.unauthorized'))
        return
      }
      if (chal.status !== 'pending') return

      const isExpired = chal.expiresAt && new Date(chal.expiresAt).getTime() <= Date.now()
      if (isExpired) {
        up((d) => ({
          challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, status: 'expired' } : c)),
        }))
        // Kèo chết thì phiếu phải được hoàn, không thì SP của người đặt bị giam vĩnh viễn —
        // không có tiến trình nào quét kèo quá hạn, đây là lần DUY NHẤT ta biết nó đã hết hạn.
        settlePredictions(challengeId, null)
        toast(t('challenge.toastExpired'))
        return
      }

      const needed = (chal.teamA || []).length > 1 ? 2 : 1
      const current = (chal.teamB || []).filter(Boolean)
      if (current.includes(myId) || (chal.teamA || []).includes(myId)) return
      const validPartner = partnerId && partnerId !== myId && !current.includes(partnerId) && !(chal.teamA || []).includes(partnerId) ? partnerId : null
      const newJoiners = [myId, ...(validPartner ? [validPartner] : [])]
      const teamB = [...current, ...newJoiners].slice(0, needed)
      const nextAccepted = Array.from(new Set([...(chal.acceptedPlayers || []), myId]))
      const isFullyAccepted = isChallengeFullyAccepted({ ...chal, teamB, acceptedPlayers: nextAccepted })
      const status = isFullyAccepted ? 'accepted' : 'pending'

      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId
          ? {
            ...c,
            teamB,
            acceptedPlayers: nextAccepted,
            status,
            ...(isFullyAccepted ? { acceptedAt: new Date().toISOString(), acceptedBy: myId } : {}),
          }
          : c)),
      }))

      // Kèo MỞ: người tạo treo kèo rồi đi làm việc khác. Không bắn ở đây thì họ không có cách
      // nào biết đã có người nhận — trước đây nhánh này là nhánh duy nhất không bắn gì cả.
      emitEvent({
        type: 'challenge_accepted',
        payload: { chalId: chal.id, code: chal.code, acceptedById: myId },
        recipients: [chal.createdBy, ...(chal.teamA || [])],
        refType: 'challenge',
        refId: chal.id,
        actorId: myId,
        skipActivity: !isFullyAccepted,
      })

      // Người được rủ đánh cặp bị kéo thẳng vào `teamB` mà không ai báo — cùng lỗi với nhánh
      // tạo kèo: họ phải bấm nhận thì kèo mới đủ chữ ký.
      if (validPartner) {
        emitEvent({
          type: 'challenge_teammate',
          payload: { chalId: chal.id, code: chal.code },
          recipients: [validPartner],
          refType: 'challenge',
          refId: chal.id,
          actorId: myId,
          skipActivity: true,
        })
      }

      if (isFullyAccepted) {
        toast(t('challenge.toastAccepted', { code: chal.code }))
      } else {
        toast(t('challenge.toastPartiallyAccepted', { code: chal.code }))
      }
    },

    deleteChallenge: (challengeId) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      if (!canAssign()) {
        toast(t('common.unauthorized'))
        return
      }
      up((d) => ({
        challenges: (d.challenges || []).filter((c) => c.id !== challengeId),
        matches: (d.matches || []).map((m) => (m.challengeId === challengeId ? { ...m, challengeId: null } : m)),
        // Không đánh dấu 'refunded' mà XOÁ hẳn: `challenge_predictions.challenge_id` là khoá
        // ngoại ON DELETE CASCADE, xoá kèo dưới DB là phiếu bay theo. State phải gương đúng thế,
        // không thì còn lại một đống phiếu mồ côi trỏ vào kèo không tồn tại.
        challengePredictions: (d.challengePredictions || []).filter((p) => p.challengeId !== challengeId),
      }))
      toast(t('challenge.toastDeleted', { code: chal.code }))
    },

    cancelChallenge: (challengeId) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      const myMem = myMember(d0)
      const isPlayer = myMem && ((chal.teamA || []).includes(myMem.id) || (chal.teamB || []).includes(myMem.id) || chal.createdBy === myMem.id)
      if (!canAssign() && !isPlayer) return
      // Kèo ĐÃ CÓ KẾT QUẢ thì không huỷ được — huỷ sẽ để lại kèo 'cancelled' mà trận vẫn nằm
      // trong sổ.
      if (chal.status !== 'pending' && !isChallengeAccepted(chal)) {
        toast(t('challenge.cancelTooLate'))
        return
      }
      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, status: 'cancelled', predictionsLocked: true } : c)),
      }))
      settlePredictions(challengeId, null)
      // `notification.challenge_cancelled` và icon của nó đã có sẵn từ lâu, chỉ thiếu đúng lời
      // gọi này — nên huỷ kèo là đối thủ ĐÃ NHẬN KÈO thấy kèo biến mất mà không ai báo, và
      // người đặt phiếu thì bị hoàn điểm im lặng. Lấy ID từ `d0` (ảnh chụp TRƯỚC khi hoàn phiếu),
      // sau `settlePredictions` thì không còn phiếu 'pending' nào để dò.
      const predictorIds = (d0.challengePredictions || [])
        .filter((p) => p.challengeId === challengeId && p.status === 'pending')
        .map((p) => p.memberId)
      emitEvent({
        type: 'challenge_cancelled',
        payload: { code: chal.code },
        recipients: [...(chal.teamA || []), ...(chal.teamB || []), chal.createdBy, ...predictorIds],
        refType: 'challenge',
        refId: challengeId,
      })
      toast(t('challenge.toastCancelled', { code: chal.code }))
    },

    placePrediction: async ({ challengeId, team, stakePoints }) => {
      const d0 = db()
      const myMem = myMember(d0)
      const myId = myMem?.id || null
      if (!myId) {
        toast(t('common.unauthorized'))
        return { ok: false, error: 'unauthorized' }
      }
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) {
        toast(t('challenge.predictionNotFound'))
        return { ok: false, error: 'not_found' }
      }

      // Mức cược NHẬP TỰ DO. Luật đọc từ MỘT chỗ dùng chung với modal (`validateStakePoints`) —
      // trước đây chỗ này chặn cứng `[1,2,3]` và là chốt thứ ba còn sót khi mở sang nhập tự do.
      // Trần trùng số với CHECK trong 0047 và guard trong RPC; SQL không đọc được JSON.
      const maxStake = cfg.challenge?.maxStakePoints ?? 100
      const stake = Number(stakePoints)
      if (!validateStakePoints({ stake, maxStake }).ok) {
        toast(t('challenge.predictionInvalidStake', { max: maxStake }))
        return { ok: false, error: 'invalid_stake' }
      }

      // SP khả dụng phải tính ở client: server không dựng lại được điểm mùa (nó là hàm dẫn xuất
      // từ toàn bộ lịch sử trận, không có bảng nào lưu). Hết điểm là KHÔNG được cược — không có
      // cửa nợ điểm, và cũng không có cửa "thua quá sàn thì thua miễn phí" như trước.
      const seasonRes = calculateSeasonLeaderboard(d0)
      const totalSp = (seasonRes?.leaderboard || []).find((r) => r.id === myId)?.totalSeasonPoints || 0
      const available = availableSeasonPoints(totalSp, d0.challengePredictions, d0.challenges, d0.sessions, myId)

      // Mọi luật còn lại đọc từ MỘT chỗ: `canMemberPredict`. Trước đây luật này nằm rải ở ba nơi
      // (modal, action, và chính hàm đó) và đã lệch nhau.
      const gate = canMemberPredict(chal, myId, d0, available)
      if (!gate.ok) {
        toast(t({
          disabled: 'challenge.predictionDisabled',
          locked: 'challenge.predictionMatchLocked',
          player_conflict: 'challenge.predictionConflictSelf',
          already_predicted: 'challenge.predictionAlreadyPlaced',
          insufficient_points: 'challenge.predictionNoPoints',
          member_inactive: 'common.unauthorized',
        }[gate.reason] || 'common.unauthorized'))
        return { ok: false, error: gate.reason }
      }
      if (stake > available) {
        toast(t('challenge.predictionNotEnoughPoints', { available }))
        return { ok: false, error: 'insufficient_points' }
      }
      if (!supabase) return { ok: false, error: 'offline' }

      // RPC chứ không INSERT thẳng: `uq_chal_member_prediction` chặn dòng thứ hai cho cùng cặp
      // (kèo, người), mà huỷ phiếu thì GIỮ NGUYÊN dòng cũ ở trạng thái 'cancelled'. Đặt lại sau
      // khi huỷ mà insert là đâm vào UNIQUE. RPC dùng ON CONFLICT DO UPDATE để đặt lại dòng đó.
      const { data, error } = await supabase.rpc('place_challenge_prediction', {
        p_challenge_id: challengeId,
        p_team: team,
        p_stake: stake,
      })
      if (error) {
        console.warn('[prediction] place error:', error.message)
        toast(error.message)
        return { ok: false, error: 'rpc_failed' }
      }

      const nowIso = new Date().toISOString()
      const newPred = {
        id: data,
        challengeId,
        clubId: d0.clubId,
        memberId: myId,
        team,
        stakePoints: stake,
        payoutPoints: 0,
        status: 'pending',
        settledAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      // Thay tại chỗ nếu đây là lần đặt lại trên chính dòng vừa huỷ.
      up((d) => {
        const rest = (d.challengePredictions || []).filter(
          (p) => !(p.challengeId === challengeId && p.memberId === myId)
        )
        return { challengePredictions: [newPred, ...rest] }
      })

      toast(t('challenge.predictionSuccess', {
        team: team === 'A' ? t('challenge.teamA') : t('challenge.teamB'),
        points: stake,
      }))
      return { ok: true, prediction: newPred }
    },

    cancelPrediction: async (predictionId) => {
      const d0 = db()
      const myId = myMember(d0)?.id || null
      if (!myId) {
        toast(t('common.unauthorized'))
        return { ok: false, error: 'unauthorized' }
      }

      const pred = (d0.challengePredictions || []).find((p) => p.id === predictionId)
      if (!pred) return { ok: false, error: 'not_found' }

      // Chỉ chính chủ. RPC `cancel_challenge_prediction` (0041) cũng chỉ cho chính chủ, nên nhánh
      // "admin huỷ hộ" trước đây có gọi cũng bị server từ chối — bỏ cho khớp.
      if (pred.memberId !== myId) {
        toast(t('common.unauthorized'))
        return { ok: false, error: 'unauthorized' }
      }
      if (pred.status !== 'pending') {
        toast(t('challenge.predictionCannotCancelSettled'))
        return { ok: false, error: 'not_pending' }
      }
      const chal = (d0.challenges || []).find((c) => c.id === pred.challengeId)
      if (chal?.predictionsLocked || chal?.status === 'oncourt' || chal?.status === 'played') {
        toast(t('challenge.predictionCancelLocked'))
        return { ok: false, error: 'locked' }
      }
      if (!supabase) return { ok: false, error: 'offline' }

      const { error } = await supabase.rpc('cancel_challenge_prediction', { p_prediction_id: predictionId })
      if (error) {
        console.warn('[prediction] cancel error:', error.message)
        toast(error.message)
        return { ok: false, error: 'rpc_failed' }
      }

      const nowIso = new Date().toISOString()
      up((d) => ({
        challengePredictions: (d.challengePredictions || []).map((p) => (
          p.id === predictionId
            ? { ...p, status: 'cancelled', payoutPoints: p.stakePoints, settledAt: nowIso, updatedAt: nowIso }
            : p
        )),
      }))

      toast(t('challenge.predictionCancelSuccess'))
      return { ok: true }
    },

    linkChallengeToSession: (challengeId, sessionId) => {
      const d0 = db()
      const chal = (d0.challenges || []).find((c) => c.id === challengeId)
      if (!chal) return
      const s = sessionId ? sessionOf(d0, sessionId) : null
      if (sessionId && !s) return
      const myMem = myMember(d0)
      const isPlayer = myMem && ((chal.teamA || []).includes(myMem.id) || (chal.teamB || []).includes(myMem.id) || chal.createdBy === myMem.id)
      if (!canAssign() && !isPlayer) return

      // Validate: Nếu gắn vào buổi, kiểm tra xem có người chơi nào vắng mặt / không đi buổi đó không
      if (sessionId && s) {
        const att = d0.attendance?.[s.id] || {}
        const allPlayers = [...(chal.teamA || []), ...(chal.teamB || [])]

        // 1. Chặn nếu có người chơi đã báo vắng (hoặc nghỉ không báo)
        const absentKeys = allPlayers.filter((id) => att[id] === false || att[id] === 'noshow')
        if (absentKeys.length > 0) {
          const absentNames = absentKeys.map((id) => playerName(d0, id) || id)
          toast(t('planner.chalAbsentCantSchedule', { names: absentNames.join(', ') }))
          return
        }

        // 2. Chặn nếu có người chơi không thuộc nhóm thành viên hoặc khách của buổi đó
        const mems = sessionMembers(d0, s) || []
        const guests = sGuests(d0, s.id) || []
        const eligibleKeys = new Set([
          ...mems.map((m) => m.id),
          ...guests.map((g) => g.guestId || g.memberId || g.id),
        ])
        const notInSessionKeys = allPlayers.filter((id) => !eligibleKeys.has(id))
        if (notInSessionKeys.length > 0) {
          const notInSessionNames = notInSessionKeys.map((id) => playerName(d0, id) || id)
          toast(t('planner.chalAbsentCantSchedule', { names: notInSessionNames.join(', ') }))
          return
        }

        // 3. Nếu buổi chơi đã bắt đầu điểm danh có mặt: đòi hỏi người chơi phải có mặt
        const hasStartedAttendance = Object.values(att).some((v) => isPresent(v))
        if (hasStartedAttendance) {
          const sessPlayers = sessionPlayers(d0, s)
          const presentKeys = new Set(sessPlayers.map((p) => p.key))
          const notPresentKeys = allPlayers.filter((id) => !presentKeys.has(id))
          if (notPresentKeys.length > 0) {
            const notPresentNames = notPresentKeys.map((id) => playerName(d0, id) || id)
            toast(t('planner.chalAbsentCantSchedule', { names: notPresentNames.join(', ') }))
            return
          }
        }
      }

      up((d) => ({
        challenges: (d.challenges || []).map((c) => (c.id === challengeId ? { ...c, sessionId: sessionId || null } : c)),
      }))
      if (s) {
        toast(t('challenge.toastLinkedToSession', { code: chal.code, date: dd(s.date) }))
      } else {
        toast(t('challenge.toastUnlinkedFromSession', { code: chal.code }))
      }
    },

    saveMatchScore: ({ sid, sessionId, ci, courtIdx, courtIndex, sets, challengeCode, challengeId, teamA: propTeamA, teamB: propTeamB, ratingEnabled: propRatingEnabled, minutes }) => {
      if (!canAssign()) return
      const d0 = db()
      const targetSid = sid || sessionId
      const targetCi = ci !== undefined && ci !== null ? ci : (courtIdx !== undefined && courtIdx !== null ? courtIdx : courtIndex)
      const lu = targetSid ? ((d0.lineups || {})[targetSid] || {}) : {}
      const lineupKeys = (targetCi !== undefined && targetCi !== null) ? courtSlotIds(targetCi).map((sl) => lu[sl]).filter(Boolean) : []

      const teamA = (propTeamA && propTeamA.length) ? propTeamA : lineupKeys.slice(0, 2)
      const teamB = (propTeamB && propTeamB.length) ? propTeamB : lineupKeys.slice(2, 4)
      const keys = [...teamA, ...teamB]
      if (!keys.length) return toast(t('toast.courtEmpty'))

      const chal = challengeCode
        ? (d0.challenges || []).find((c) => c.code === challengeCode)
        : challengeId
          ? (d0.challenges || []).find((c) => c.id === challengeId)
          : null
      const isRated = propRatingEnabled !== undefined
        ? Boolean(propRatingEnabled)
        : (chal ? chal.ratingEnabled !== false : true)

      const playedSets = (sets || []).filter((r) => r[0] + r[1] > 0)
      const aWins = playedSets.filter((r) => r[0] > r[1]).length
      const bWins = playedSets.filter((r) => r[1] > r[0]).length
      const winnerTeam = aWins > bWins ? 'A' : bWins > aWins ? 'B' : null
      const aWon = winnerTeam === 'A'

      const namesA = teamA.map((id) => playerName(d0, id)).join(' · ')
      const namesB = teamB.map((id) => playerName(d0, id)).join(' · ')
      const winner = aWon ? namesA : (winnerTeam === 'B' ? namesB : '—')
      const loser = aWon ? namesB : (winnerTeam === 'B' ? namesA : '—')

      const scoreText = playedSets.length > 1
        ? aWins + ' – ' + bWins
        : (playedSets[0] ? playedSets[0][0] + ' – ' + playedSets[0][1] : '')

      const matchId = uid()
      let newMatch
      // Bảng rating sau trận. up() chạy đồng bộ nên biến này có giá trị ngay sau khi up() trả về.
      // Cần cho người gọi (ScoreModal) dựng db "sau trận" để tính huy hiệu phụ thuộc Elo mới.
      let nextPlayerRatings = null
      let isChalComplete = true
      let chalSeriesProg = null
      let currentSetNum = 1
      let isBoSeries = false

      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        if (targetSid && targetCi !== undefined && targetCi !== null) {
          const l2 = { ...(lineups[targetSid] || {}) }
          courtSlotIds(targetCi).forEach((sl) => { delete l2[sl] })
          lineups[targetSid] = l2
        }

        const playing = { ...(d.playing || {}) }
        if (targetSid && targetCi !== undefined && targetCi !== null) {
          const c = { ...(playing[targetSid] || {}) }
          c[targetCi] = false
          playing[targetSid] = c
        }

        // Tính Elo nếu trận được tính rating và có người thắng
        const playerRatings = { ...(d.playerRatings || {}) }
        const ratingsMap = {}
        const gamesCountMap = {}
        Object.keys(playerRatings).forEach((mid) => {
          ratingsMap[mid] = playerRatings[mid].rating
          gamesCountMap[mid] = playerRatings[mid].gamesCount || 0
        })
        ;[...teamA, ...teamB].forEach((id) => {
          if (ratingsMap[id] === undefined) {
            const m = (d0.members || []).find((x) => x.id === id) || (d0.guests || []).find((x) => x.id === id)
            ratingsMap[id] = initialRatingOf(m?.level, d0.levels)
            gamesCountMap[id] = 0
          }
        })

        const ra = teamRating(teamA, ratingsMap)
        const rb = teamRating(teamB, ratingsMap)
        let delta = 0
        if (isRated && winnerTeam) {
          const { deltas } = calcPlayerDeltas({
            teamA,
            teamB,
            aWon,
            ratingsMap,
            gamesCountMap,
            sets: playedSets,
          })
          delta = deltas[teamA[0]] || 0
          const memberIdSet = new Set((d0.members || []).map((x) => x.id))
          teamA.forEach((id) => {
            if (!memberIdSet.has(id)) return // Khách giao lưu không tích luỹ bảng xếp hạng Elo CLB
            const memA = (d0.members || []).find((x) => x.id === id)
            const seedA = initialRatingOf(memA?.level, d0.levels)
            const cur = playerRatings[id] || { id: uid(), rating: seedA, gamesCount: 0, winsCount: 0, lossesCount: 0 }
            const newR = applyRatingDelta(cur.rating, deltas[id])
            playerRatings[id] = {
              ...cur,
              id: cur.id || uid(),
              rating: newR,
              displayRating: Math.max(MIN_RATING, newR),
              tier: rankTierOf(newR),
              gamesCount: cur.gamesCount + 1,
              // Ghi luôn ở đây cho khớp replayRatingCascade — thiếu dòng này thì nhãn độ tin cậy
              // đứng yên cho tới khi có người bấm "Tính lại toàn bộ Elo".
              confidence: confidenceOf(cur.gamesCount + 1),
              winsCount: aWon ? cur.winsCount + 1 : cur.winsCount,
              lossesCount: !aWon ? cur.lossesCount + 1 : cur.lossesCount,
            }
          })
          teamB.forEach((id) => {
            if (!memberIdSet.has(id)) return // Khách giao lưu không tích luỹ bảng xếp hạng Elo CLB
            const memB = (d0.members || []).find((x) => x.id === id)
            const seedB = initialRatingOf(memB?.level, d0.levels)
            const cur = playerRatings[id] || { id: uid(), rating: seedB, gamesCount: 0, winsCount: 0, lossesCount: 0 }
            const newR = applyRatingDelta(cur.rating, deltas[id])
            playerRatings[id] = {
              ...cur,
              id: cur.id || uid(),
              rating: newR,
              displayRating: Math.max(MIN_RATING, newR),
              tier: rankTierOf(newR),
              gamesCount: cur.gamesCount + 1,
              // Ghi luôn ở đây cho khớp replayRatingCascade — thiếu dòng này thì nhãn độ tin cậy
              // đứng yên cho tới khi có người bấm "Tính lại toàn bộ Elo".
              confidence: confidenceOf(cur.gamesCount + 1),
              winsCount: !aWon ? cur.winsCount + 1 : cur.winsCount,
              lossesCount: aWon ? cur.lossesCount + 1 : cur.lossesCount,
            }
          })
        }

        const sessionMatches = (d.matches || []).filter((x) => x.sessionId === targetSid)
        const prevChalMatches = chal ? (d.matches || []).filter((x) => x.challengeId === chal.id) : []
        currentSetNum = prevChalMatches.length + 1
        isBoSeries = chal && (Number(chal.bestOf) || 1) > 1

        const matchCode = chal
          ? (isBoSeries ? `${chal.code}-H${currentSetNum}` : chal.code)
          : `M-${String(sessionMatches.length + 1).padStart(2, '0')}`

        // B2: Kiểm tra nếu trận đấu có tính điểm thi đấu (isRated) làm đứt chuỗi thắng Bounty của đối thủ
        let bountyBroken = false
        let brokenStreak = 0
        let bountyVictims = []
        const minBountyStreak = Number(cfgBadges?.bounty?.minStreakSingle || 5)
        if (isRated && (winnerTeam === 'A' || winnerTeam === 'B')) {
          // Danh hiệu là phần TRANG TRÍ của việc lưu trận. Nếu nó ném lỗi thì chỉ được mất
          // cái cờ bounty, tuyệt đối không được kéo đổ cả thao tác lưu tỷ số.
          try {
            const losingPlayers = winnerTeam === 'A' ? (teamB || []) : (teamA || [])
            const currentSeasonMatches = seasonMatchesOf(d)
            const streakers = losingPlayers.map((pid) => {
              const { streak } = getMemberStreak(pid, d, null, currentSeasonMatches)
              return { pid, streak }
            })
            const maxLosingStreak = Math.max(0, ...streakers.map((s) => s.streak))
            if (maxLosingStreak >= minBountyStreak) {
              bountyBroken = true
              brokenStreak = maxLosingStreak
              // Chỉ người có chuỗi đạt mốc maxLosingStreak mới là nạn nhân thực sự bị ngắt chuỗi
              bountyVictims = streakers.filter((s) => s.streak === maxLosingStreak).map((s) => s.pid)
            }
          } catch (err) {
            console.warn('[badges] bỏ qua tính bounty cho trận này:', err)
            bountyBroken = false
            brokenStreak = 0
            bountyVictims = []
          }
        }

        newMatch = {
          id: matchId,
          code: matchCode,
          sessionId: targetSid || null,
          courtIdx: targetCi !== undefined && targetCi !== null ? targetCi : 0,
          teamA,
          teamB,
          playerKeys: keys,
          minutes: minutes || cfg.match?.defaultMinutes || 20,
          at: Date.now(),
          sourceType: chal ? 'challenge' : 'session',
          challengeId: chal ? chal.id : null,
          ratingEnabled: isRated,
          sets: playedSets,
          winnerTeam,
          scoreText,
          initialRatingA: ra,
          initialRatingB: rb,
          eloDelta: Math.abs(delta),
          bountyBroken,
          brokenStreak,
          bountyVictimIds: bountyVictims,
        }

        if (chal) {
          const allChalMatches = [...prevChalMatches, newMatch]
          chalSeriesProg = getChallengeSeriesProgress(chal, allChalMatches)
          const winsNeeded = chalSeriesProg.winsNeeded
          const directSetsCount = (playedSets || []).filter(([a, b]) => a > 0 || b > 0).length
          const isDirectComplete = directSetsCount >= winsNeeded && Boolean(winnerTeam)
          isChalComplete = isDirectComplete || chalSeriesProg.isComplete
        } else {
          isChalComplete = true
          chalSeriesProg = null
        }

        const challenges = chal
          ? (d.challenges || []).map((k) => {
              if (k.id !== chal.id) return k
              // Mốc RA SÂN: app không còn nút "Đưa lên sân" riêng, nên lúc ván ĐẦU của kèo được
              // ghi chính là lúc kèo thật sự ra sân. `|| k.deployedAt` giữ mốc cũ cho các ván sau
              // của chuỗi BO3 — ván 2, ván 3 không được đẩy mốc này lên nữa.
              const deployedAt = k.deployedAt || new Date().toISOString()
              if (isChalComplete) {
                return {
                  ...k,
                  status: 'played',
                  matchId,
                  deployedAt,
                  winnerTeam: chalSeriesProg?.winnerTeam || winnerTeam,
                  seriesScore: chalSeriesProg ? { winsA: chalSeriesProg.winsA, winsB: chalSeriesProg.winsB } : null,
                  predictionsLocked: true,
                }
              }
              // Chưa hoàn tất chuỗi: Giữ ở trạng thái accepted để tiếp tục nạp vào sân cho ván sau
              return {
                ...k,
                status: 'accepted',
                matchId: null,
                deployedAt,
                seriesScore: chalSeriesProg ? { winsA: chalSeriesProg.winsA, winsB: chalSeriesProg.winsB } : null,
                // Ghi xong hiệp đầu là ĐÓNG cổng cược. Trước đây việc này do nút "Đưa lên sân"
                // làm; bỏ nút rồi mà không khoá ở đây thì khán giả xem xong hiệp 1 biết tỷ số
                // rồi mới đặt — cược khi đã biết bài.
                predictionsLocked: true,
              }
            })
          : (d.challenges || [])

        const nextMatches = (d.matches || []).concat([newMatch])
        const memberMap = {}
        ;(d0.members || []).forEach((m) => { memberMap[m.id] = m })
        ;(d0.guests || []).forEach((g) => { memberMap[g.id] = g })
        const calList = computeClubCalibration(nextMatches, memberMap)
        const prevCals = d.clubCalibration || []
        const nextCals = ['<100', '100-300', '>300'].map((bKey) => {
          const item = calList.find((x) => x.bucket === bKey) || { bucket: bKey, sampleSize: 0, observedWinRate: 0, learnedAdjustment: 0 }
          const existing = prevCals.find((p) => p.bucket === bKey)
          return {
            id: existing?.id || uid(),
            bucket: bKey,
            sampleSize: item.sampleSize || 0,
            observedWinRate: item.observedWinRate || 0,
            learnedAdjustment: item.learnedAdjustment || 0,
          }
        })

        nextPlayerRatings = playerRatings

        return {
          lineups,
          playing,
          matches: nextMatches,
          challenges,
          playerRatings,
          clubCalibration: nextCals,
        }
      })

      upUi(() => ({ picked: null }))
      if (chal && !isChalComplete) {
        toast(t('challenge.toastSetSaved', { code: chal.code, set: currentSetNum, score: chalSeriesProg?.seriesScoreText || scoreText }))
      } else if (chal && isChalComplete && isBoSeries) {
        toast(t('challenge.toastSeriesCompleted', { code: chal.code, score: chalSeriesProg?.seriesScoreText || scoreText, winner }))
      } else {
        toast(t('scoreModal.toastSaved', { winner, loser, score: scoreText }))
      }

      // Quyết toán phiếu dự đoán — CỐ Ý nằm ngoài `up()`. Trước đây nó đổi state trong updater
      // rồi để đồng bộ chung ghi xuống, mà bảng đó đã bị revoke quyền UPDATE: op ném 42501 giữa
      // hàng đợi, và vì nó đứng TRƯỚC `player_ratings` nên Elo của trận vừa lưu không xuống DB.
      if (chal && isChalComplete) {
        settlePredictions(chal.id, chalSeriesProg?.winnerTeam || winnerTeam || null)
      }

      // Phát sự kiện Social Activity & Notification sau khi lưu trận
      const narrativeType = detectMatchNarrative(newMatch)
      const myId = myMember(db())?.id || null
      const winIds = (newMatch.winnerTeam === 'A' ? newMatch.teamA : newMatch.teamB) || []
      const loseIds = (newMatch.winnerTeam === 'A' ? newMatch.teamB : newMatch.teamA) || []
      // `recipients: []` là cố ý. Bốn người trong trận vừa đánh xong và đang đứng ngay cạnh
      // sân — báo cho họ biết tỷ số trận họ vừa đánh là rác. Mà `storage.load()` chỉ lấy 100
      // dòng mới nhất, nên một buổi 15 trận là đủ đẩy 'đã duyệt hoàn tiền' và 'mời điểm danh'
      // ra khỏi cửa sổ đó. Bảng tin hoạt động đã kể trận rồi; hộp thông báo để dành cho việc
      // người ta không tự biết.
      //
      // `skipActivity` khi trận thuộc kèo: kèo BO3 lưu mỗi set thành MỘT match (-H1/-H2/-H3),
      // không chặn thì một kèo đẻ ra 3 dòng trận + 1 dòng kèo. Dòng `challenge_completed` bên
      // dưới đã kể trọn trận kèo.
      emitEvent({
        type: 'match_recorded',
        payload: {
          matchId: newMatch.id,
          matchCode: newMatch.code,
          score: newMatch.scoreText,
          winnerTeam: newMatch.winnerTeam,
          narrativeType,
          winnerIds: winIds,
          loserIds: loseIds,
        },
        recipients: [],
        refType: 'match',
        refId: newMatch.id,
        actorId: myId,
        skipActivity: Boolean(chal),
      })

      if (newMatch.bountyBroken) {
        emitEvent({
          type: 'bounty_broken',
          payload: {
            matchId: newMatch.id,
            streak: newMatch.brokenStreak,
            breakerIds: winIds,
            victimIds: newMatch.bountyVictimIds?.length > 0 ? newMatch.bountyVictimIds : loseIds,
          },
          recipients: [...winIds, ...loseIds],
          refType: 'match',
          refId: newMatch.id,
          actorId: myId,
        })
      }

      if (chal && isChalComplete) {
        const cWinners = (chalSeriesProg?.winnerTeam === 'A' ? chal.teamA : chal.teamB) || winIds
        const cLosers = (chalSeriesProg?.winnerTeam === 'A' ? chal.teamB : chal.teamA) || loseIds
        const winTeam = chalSeriesProg?.winnerTeam || newMatch.winnerTeam
        const winSets = chalSeriesProg ? (winTeam === 'B' ? chalSeriesProg.winsB : chalSeriesProg.winsA) : 1
        const loseSets = chalSeriesProg ? (winTeam === 'B' ? chalSeriesProg.winsA : chalSeriesProg.winsB) : 0
        emitEvent({
          type: 'challenge_completed',
          payload: {
            chalId: chal.id,
            code: chal.code,
            winnerTeam: winTeam,
            seriesScore: `${winSets}-${loseSets}`,
            winnerIds: cWinners,
            loserIds: cLosers,
          },
          recipients: [...(chal.teamA || []), ...(chal.teamB || [])],
          refType: 'challenge',
          refId: chal.id,
          actorId: myId,
        })
      }

      // Trận vừa lưu + bảng rating sau trận. Người gọi nào chỉ cần match thì bỏ qua field thừa.
      return { ...newMatch, nextPlayerRatings }
    },

    editMatchScore: ({ matchId, sets, newSets, reason, at, playedAt }) => {
      if (!canAssign()) return
      const d0 = db()
      const match = (d0.matches || []).find((m) => m.id === matchId)
      if (!match) return

      const actualSets = sets || newSets || []
      const nextAt = at !== undefined && at !== null ? at : (playedAt !== undefined && playedAt !== null ? playedAt : match.at)
      const myMem = myMember(d0)
      const myId = myMem?.id || null
      const editLog = {
        id: uid(),
        matchId,
        clubId: d0.clubId,
        editedBy: myId,
        editedAt: new Date().toISOString(),
        fieldChanged: 'sets',
        oldValue: JSON.stringify({ sets: match.sets || [], at: match.at }),
        newValue: JSON.stringify({ sets: actualSets, at: nextAt }),
        reason: reason || t('common.edit'),
        ratingRecalcFromMatchId: matchId,
      }

      // Xác định đội thắng set để kiểm tra ngắt chuỗi
      const playedSets = actualSets.filter((r) => r[0] + r[1] > 0)
      const aWins = playedSets.filter((r) => r[0] > r[1]).length
      const bWins = playedSets.filter((r) => r[1] > r[0]).length
      const winnerTeam = aWins > bWins ? 'A' : bWins > aWins ? 'B' : null

      let bountyBroken = false
      let brokenStreak = 0
      let bountyVictims = []
      const minBountyStreak = Number(cfgBadges?.bounty?.minStreakSingle || 5)
      const isRated = match.ratingEnabled !== false
      if (isRated && (winnerTeam === 'A' || winnerTeam === 'B')) {
        try {
          const losingPlayers = winnerTeam === 'A' ? (match.teamB || []) : (match.teamA || [])
          const currentSeasonMatches = seasonMatchesOf(d0).filter((m) => m.id !== matchId)
          const streakers = losingPlayers.map((pid) => {
            const { streak } = getMemberStreak(pid, d0, null, currentSeasonMatches)
            return { pid, streak }
          })
          const maxLosingStreak = Math.max(0, ...streakers.map((s) => s.streak))
          if (maxLosingStreak >= minBountyStreak) {
            bountyBroken = true
            brokenStreak = maxLosingStreak
            bountyVictims = streakers.filter((s) => s.streak === maxLosingStreak).map((s) => s.pid)
          }
        } catch (err) {
          console.warn('[badges] bỏ qua tính bounty khi editMatchScore:', err)
          bountyBroken = false
          brokenStreak = 0
          bountyVictims = []
        }
      }

      // Replay cascade tính lại toàn bộ Elo các trận sau đó
      const updatedMatchList = (d0.matches || []).map((m) =>
        m.id === matchId
          ? {
              ...m,
              sets: actualSets,
              at: nextAt,
              winnerTeam: winnerTeam || m.winnerTeam,
              bountyBroken,
              brokenStreak,
              bountyVictimIds: bountyVictims,
            }
          : m,
      )
      const { finalRatings, updatedMatches } = replayRatingCascade(updatedMatchList, matchId, d0.members, d0.levels, d0.guests)

      up((d) => {
        const nextRatings = { ...(d.playerRatings || {}) }
        Object.entries(finalRatings || {}).forEach(([mid, r]) => {
          const old = nextRatings[mid] || {}
          nextRatings[mid] = {
            ...old,
            ...r,
            id: old.id || r.id || uid(),
            memberId: mid,
          }
        })
        const memberMap = {}
        ;(d0.members || []).forEach((m) => { memberMap[m.id] = m })
        ;(d0.guests || []).forEach((g) => { memberMap[g.id] = g })
        const calList = computeClubCalibration(updatedMatches, memberMap)
        const prevCals = d.clubCalibration || []
        const nextCals = ['<100', '100-300', '>300'].map((bKey) => {
          const item = calList.find((x) => x.bucket === bKey) || { bucket: bKey, sampleSize: 0, observedWinRate: 0, learnedAdjustment: 0 }
          const existing = prevCals.find((p) => p.bucket === bKey)
          return {
            id: existing?.id || uid(),
            bucket: bKey,
            sampleSize: item.sampleSize || 0,
            observedWinRate: item.observedWinRate || 0,
            learnedAdjustment: item.learnedAdjustment || 0,
          }
        })
        return {
          matches: updatedMatches,
          playerRatings: nextRatings,
          matchEdits: [editLog, ...(d.matchEdits || [])],
          clubCalibration: nextCals,
        }
      })

      const newScoreStr = playedSets.map((s) => `${s[0]}-${s[1]}`).join(', ')
      // Sửa tỷ số một ván trong kèo có thể LẬT đội thắng chung cuộc. Trước đây phiếu dự đoán
      // đứng nguyên theo kết quả cũ mãi mãi — người đoán đúng vẫn bị ghi là thua. Tính lại chuỗi
      // trên bộ trận SAU khi sửa rồi quyết toán lại; RPC 0042 nhận cả phiếu đã ăn/thua.
      if (match.challengeId) {
        const chalNow = (db().challenges || []).find((c) => c.id === match.challengeId)
        if (chalNow) {
          const prog = getChallengeSeriesProgress(chalNow, updatedMatches)
          if (prog.isComplete) settlePredictions(chalNow.id, prog.winnerTeam)
        }
      }

      emitEvent({
        type: 'match_edited',
        payload: {
          matchId,
          matchCode: match.code || match.id.slice(0, 8),
          newScore: newScoreStr,
          reason: reason || '',
        },
        // `recipients: []` là cố ý, như `match_recorded` ngay trên: sửa tỷ số xảy ra liên tục
        // trong buổi (nhập nhầm rồi sửa là chuyện thường), mà hộp thông báo chỉ giữ 100 dòng —
        // mỗi dòng sửa điểm là một dòng đẩy 'đã duyệt hoàn tiền' hay 'mời điểm danh' ra ngoài.
        // Bảng tin hoạt động vẫn kể chuyện này (không có `skipActivity`).
        recipients: [],
        refType: 'match',
        refId: matchId,
        actorId: myId,
      })

      toast(t('common.save') + ': ' + match.id)
      const updatedTargetMatch = updatedMatches.find((m) => m.id === matchId) || {
        ...match,
        sets: actualSets,
        at: nextAt,
        winnerTeam: winnerTeam || match.winnerTeam,
        bountyBroken,
        brokenStreak,
        bountyVictimIds: bountyVictims,
      }
      return {
        ...updatedTargetMatch,
        bountyBroken,
        brokenStreak,
        bountyVictimIds: bountyVictims,
        nextPlayerRatings: finalRatings,
      }
    },

    attachMatchVideo: (matchId, { videoUrl, videoTimestamp, videoNote } = {}) => {
      const d0 = db()
      const match = (d0.matches || []).find((m) => m.id === matchId)
      if (!match) return false

      const nextUrl = videoUrl !== undefined ? (videoUrl ? videoUrl.trim() : null) : match.videoUrl
      const nextTs = videoTimestamp !== undefined ? (videoTimestamp ? videoTimestamp.trim() : null) : match.videoTimestamp
      const nextNote = videoNote !== undefined ? (videoNote ? videoNote.trim() : null) : match.videoNote

      // Cập nhật snapshot cục bộ để `diff` không phát sinh op upsert trên bảng matches,
      // tránh bị RLS từ chối khi người thực hiện là thành viên thường (member).
      syncPatchMatchVideo(matchId, nextUrl, nextTs, nextNote)

      up((d) => ({
        matches: (d.matches || []).map((m) => (
          m.id === matchId
            ? {
              ...m,
              videoUrl: nextUrl,
              videoTimestamp: nextTs,
              videoNote: nextNote,
            }
            : m
        )),
      }))

      // Gọi RPC gắn video an toàn trên database
      if (supabase && typeof supabase.rpc === 'function') {
        Promise.resolve(supabase.rpc('attach_match_video', {
          p_match_id: matchId,
          p_video_url: nextUrl,
          p_video_timestamp: nextTs,
          p_video_note: nextNote,
        })).catch((err) => {
          console.warn('[actions] Không gọi được RPC attach_match_video:', err?.message || err)
        })
      }

      toast(t('common.save'))
      return true
    },

    incrementMatchVideoViews: (matchId) => {
      if (!matchId) return false
      const d0 = db()
      const match = (d0.matches || []).find((m) => m.id === matchId)
      if (!match) return false
      const myMem = myMember(d0)
      const viewerKey = myMem?.id || 'guest'
      const currentViewers = (typeof match.videoViewers === 'object' && match.videoViewers) ? match.videoViewers : {}
      const currentCount = typeof currentViewers[viewerKey] === 'number' ? currentViewers[viewerKey] : 0
      const nextViewers = {
        ...currentViewers,
        [viewerKey]: currentCount + 1,
      }
      const nextTotalViews = Number(match.videoViews || 0) + 1

      // Cập nhật snapshot cục bộ của storage để `diff` không phát sinh op upsert trên bảng matches,
      // tránh bị RLS từ chối đối với thành viên thường và khách.
      syncPatchMatchViews(matchId, nextTotalViews, nextViewers)

      // Cập nhật state cục bộ để UI phản hồi tức thì
      up((d) => ({
        matches: (d.matches || []).map((m) => (
          m.id === matchId
            ? {
              ...m,
              videoViews: nextTotalViews,
              videoViewers: nextViewers,
            }
            : m
        )),
      }))

      // Gọi hàm RPC tăng lượt xem an toàn trên database
      if (supabase && typeof supabase.rpc === 'function') {
        Promise.resolve(supabase.rpc('increment_match_video_views', {
          p_match_id: matchId,
          p_viewer_id: viewerKey,
        })).catch((err) => {
          console.warn('[actions] Không gọi được RPC increment_match_video_views:', err?.message || err)
        })
      }
      return true
    },

    cancelMatch: ({ matchId, reason }) => {
      if (!canAssign()) return
      const d0 = db()
      const match = (d0.matches || []).find((m) => m.id === matchId)
      if (!match) return

      const myMem = myMember(d0)
      const myId = myMem?.id || null
      const editLog = {
        id: uid(),
        matchId,
        clubId: d0.clubId,
        editedBy: myId,
        editedAt: new Date().toISOString(),
        fieldChanged: 'status',
        oldValue: 'completed',
        newValue: 'cancelled',
        reason: reason || t('common.delete'),
        ratingRecalcFromMatchId: matchId,
      }

      const remainingMatches = (d0.matches || []).filter((m) => m.id !== matchId)
      const { finalRatings, updatedMatches } = replayRatingCascade(remainingMatches, matchId, d0.members, d0.levels, d0.guests)

      up((d) => {
        const nextRatings = { ...(d.playerRatings || {}) }
        Object.entries(finalRatings || {}).forEach(([mid, r]) => {
          const old = nextRatings[mid] || {}
          nextRatings[mid] = {
            ...old,
            ...r,
            id: old.id || r.id || uid(),
            memberId: mid,
          }
        })
        const memberMap = {}
        ;(d0.members || []).forEach((m) => { memberMap[m.id] = m })
        ;(d0.guests || []).forEach((g) => { memberMap[g.id] = g })
        const calList = computeClubCalibration(updatedMatches, memberMap)
        const prevCals = d.clubCalibration || []
        const nextCals = ['<100', '100-300', '>300'].map((bKey) => {
          const item = calList.find((x) => x.bucket === bKey) || { bucket: bKey, sampleSize: 0, observedWinRate: 0, learnedAdjustment: 0 }
          const existing = prevCals.find((p) => p.bucket === bKey)
          return {
            id: existing?.id || uid(),
            bucket: bKey,
            sampleSize: item.sampleSize || 0,
            observedWinRate: item.observedWinRate || 0,
            learnedAdjustment: item.learnedAdjustment || 0,
          }
        })
        const chalId = match.challengeId
        const challenges = chalId
          ? (d.challenges || []).map((k) => {
              if (k.id !== chalId) return k
              const prog = getChallengeSeriesProgress(k, updatedMatches)
              if (prog.isComplete) {
                return {
                  ...k,
                  status: 'played',
                  winnerTeam: prog.winnerTeam,
                  seriesScore: { winsA: prog.winsA, winsB: prog.winsB },
                }
              }
              return {
                ...k,
                status: 'accepted',
                winnerTeam: null,
                seriesScore: prog.totalSetsPlayed > 0 ? { winsA: prog.winsA, winsB: prog.winsB } : null,
              }
            })
          : (d.challenges || [])

        return {
          matches: updatedMatches,
          challenges,
          playerRatings: nextRatings,
          matchEdits: [editLog, ...(d.matchEdits || [])],
          clubCalibration: nextCals,
        }
      })

      // Huỷ trận chạy `replayRatingCascade` — Elo và điểm mùa của bốn người đổi ngay tại đây.
      // `match_edited` đã báo khi SỬA điểm; huỷ hẳn còn đổi nhiều hơn mà trước giờ im lặng.
      emitEvent({
        type: 'match_cancelled',
        payload: {
          matchId,
          matchCode: match.code || match.id.slice(0, 8),
          reason: reason || '',
        },
        // `recipients: []` như `match_edited`: huỷ trận thường đi kèm nhập lại ngay, bắn cho
        // bốn người mỗi lần là ngập hộp thông báo. Bảng tin hoạt động vẫn ghi.
        recipients: [],
        refType: 'match',
        refId: matchId,
        actorId: myId,
      })

      toast(t('common.delete') + ': ' + match.id)
      return { matchId, cancelled: true }
    },

    recalcAllRatings: () => {
      if (!canAssign()) return
      const d0 = db()
      const { finalRatings, updatedMatches } = replayRatingCascade(d0.matches || [], null, d0.members, d0.levels, d0.guests)
      up((d) => {
        const nextRatings = { ...(d.playerRatings || {}) }
        Object.entries(finalRatings || {}).forEach(([mid, r]) => {
          const old = nextRatings[mid] || {}
          nextRatings[mid] = {
            ...old,
            ...r,
            id: old.id || r.id || uid(),
            memberId: mid,
          }
        })
        const memberMap = {}
        ;(d0.members || []).forEach((m) => { memberMap[m.id] = m })
        ;(d0.guests || []).forEach((g) => { memberMap[g.id] = g })
        const calList = computeClubCalibration(updatedMatches, memberMap)
        const prevCals = d.clubCalibration || []
        const nextCals = ['<100', '100-300', '>300'].map((bKey) => {
          const item = calList.find((x) => x.bucket === bKey) || { bucket: bKey, sampleSize: 0, observedWinRate: 0, learnedAdjustment: 0 }
          const existing = prevCals.find((p) => p.bucket === bKey)
          return {
            id: existing?.id || uid(),
            bucket: bKey,
            sampleSize: item.sampleSize || 0,
            observedWinRate: item.observedWinRate || 0,
            learnedAdjustment: item.learnedAdjustment || 0,
          }
        })
        return {
          matches: updatedMatches,
          playerRatings: nextRatings,
          clubCalibration: nextCals,
        }
      })
      toast(t('leaderboard.recalcSuccess'))
    },


    /* ---------- báo cáo Zalo ---------- */
    copyZalo: (sid) => {
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const g = groupOf(d0, s.groupId)
      const gl = sGuestsOnly(d0, sid)
      const L = []
      L.push(t('zalo.head', { club: d0.club.name.toUpperCase(), date: ddmy(s.date), wd: wd(s.date) }))
      L.push(t('zalo.court', { court: courtTxt(d0, s), time: timeTxt(s) }))
      L.push(t('zalo.attend', {
        n: presentCount(d0, s),
        total: groupMembers(d0, s.groupId, monthOf(s.date)).length,
        group: g.name,
      }))
      L.push(t('zalo.courtOnly', { amount: fmt(courtCost(d0, s)) }))
      L.push('')
      L.push(t('zalo.guestsHead', { n: gl.length, amount: fmt(guestRev(d0, sid)) }))
      gl.forEach((x) => {
        const by = x.invitedBy || guestOf(d0, x.guestId).invitedBy
        L.push(t('zalo.guestLine', {
          name: guestOf(d0, x.guestId).name,
          gender: t(x.gender === 'nu' ? 'gender.nu' : 'gender.nam'),
          level: x.level,
          by: by ? t('zalo.guestBy', { name: memberOf(d0, by).name }) : '',
          amount: fmt(x.price),
          paid: t(x.paid ? 'zalo.guestPaid' : 'zalo.guestDebt'),
        }))
      })
      L.push('')
      L.push(t('zalo.guestRev', { amount: fmt(guestRev(d0, sid)) }))
      L.push(t('zalo.balance', { amount: fmt(fundBalance(d0)) }))
      const bk = d0.club.bank
      L.push(t('zalo.bank', { holder: bk.holder, no: bk.no, bank: bk.bank }))
      const txt = L.join('\n')
      upUi(() => ({ dialog: 'zalo', form: { zaloText: txt } }))
      try {
        navigator.clipboard.writeText(txt).then(() => toast(t('toast.zaloCopied')), () => {})
      } catch { /* clipboard bị chặn thì vẫn hiện dialog để copy tay */ }
    },
  }

  /**
   * HOÀN TÁC một dòng sổ quỹ — giống hệt bấm "Thu" rồi "Bỏ thu" ở màn Công nợ.
   *
   * Sổ quỹ là bảng SUY RA (`lib/ledger.js: ledger`), không có dòng nào để xoá. Nên hoàn tác =
   * lật đúng cái cờ ở NGUỒN, rồi dòng tự biến khỏi sổ và số dư tự trừ lại. Nguồn nào ứng với
   * dòng nào là việc của `undoTarget` — hàm thuần, có test.
   *
   * Gọi LẠI đúng các action mà màn Công nợ / Kho cầu vẫn dùng chứ không viết luồng gỡ thứ hai:
   * hai đường gỡ cho cùng một khoản tiền rồi sẽ lệch nhau, mà lệch ở đây là lệch số dư quỹ.
   * Vì thế `makeActions` trả về `A` chứ không trả literal — cần gọi được action anh em.
   */
  A.undoLedgerRow = (rowId) => {
    const d0 = db()
    const tg = undoTarget(d0, ledger(d0).find((r) => r.id === rowId))
    if (!tg) return toast(t('toast.ledgerNoUndo'))
    if (tg.kind === 'manual') {
      up((d) => ({ manual: d.manual.filter((m) => m.id !== tg.id) }))
      return toast(t('toast.ledgerRemoved'))
    }
    if (tg.kind === 'due') return A.clearDue(tg.id)
    if (tg.kind === 'guest') {
      A.toggleGuestPaid(tg.id)
      return toast(t('toast.guestUnpaid'))
    }
    if (tg.kind === 'adjust_session') return A.toggleAdjustSession(tg.key, tg.sessionId)
    if (tg.kind === 'adjust') return A.settleAdjust(tg.key)
    return A.repayAdvance(tg.id)
  }

  /**
   * Nạp lại thông báo của mình từ Supabase. `storage.load()` chỉ chạy một lần lúc vào CLB, nên
   * không có hàm này thì thông báo người khác bắn sang chỉ tới khi F5 — riêng lời mời điểm danh
   * thì coi như vứt đi.
   *
   * Cố ý HỢP NHẤT theo id chứ không thay cả mảng: `dbmap` đồng bộ bảng `notifications` theo
   * mode 'id', dòng nào có trong ảnh chụp cũ mà vắng ở mảng mới là nó XOÁ dưới DB. Server chỉ
   * trả 100 dòng mới nhất, nên thay thẳng là tự tay xoá đúng những dòng vừa bị đẩy khỏi top 100.
   */
  /**
   * Dọn kèo mà cột `status` không còn khớp thực tế. Chạy một lần sau mỗi lần nạp CLB
   * (`AppContext`) — thay cho tiến trình quét chạy nền mà dự án không có chỗ chạy.
   *
   * HAI NGUYÊN NHÂN, HAI CÁCH XỬ KHÁC HẲN NHAU:
   *
   *   · Hết hạn NHẬN kèo  → đánh dấu 'expired'. Không ai bấm vào thì nó nằm lì ở 'pending'.
   *   · Buổi đã chốt/huỷ  → GỠ khỏi buổi, giữ nguyên kèo. Buổi chết không giết kèo, kèo chỉ mất
   *                         chỗ đánh; trả về hàng chờ tự do để gắn sang buổi khác.
   *
   * Bản đầu gộp cả hai thành 'expired' — chốt sổ buổi tối là kèo chưa kịp đánh bị giết, và card
   * hiện "Hết hạn" trong khi kèo chưa hề quá giờ nhận.
   *
   * Cả hai nhánh đều HOÀN phiếu dự đoán: trận không diễn ra thì không có gì để quyết toán, mà
   * phiếu treo 'pending' là SP của người đặt bị giam.
   *
   * CỐ Ý gọi RPC TRƯỚC rồi mới đổi state: nhánh hoàn phiếu của RPC cho phép thành viên thường
   * khi kèo đã chết, và nó đọc `session_id` dưới DB để biết điều đó. Đổi state trước là bản
   * đồng bộ có thể xoá `session_id` xong mới tới lượt RPC chạy, lúc đó server không còn thấy
   * kèo chết nữa và từ chối.
   * CỐ Ý không `reload()` khi RPC lỗi: hàm này chạy ngay sau một lần nạp, reload tiếp là quay
   * vòng vô tận. Lỗi thì ghi log, lần nạp sau dọn lại.
   */
  A.sweepStaleChallenges = () => {
    const d0 = db()
    if (!d0.clubId) return
    const expired = expiredChallenges(d0)
    const orphaned = orphanedChallenges(d0)
    const abandoned = abandonedChallenges(d0)
    if (!expired.length && !orphaned.length && !abandoned.length) return

    const hasPending = (id) => (d0.challengePredictions || []).some(
      (p) => p.challengeId === id && p.status === 'pending'
    )
    if (supabase) {
      [...expired, ...orphaned, ...abandoned].forEach((c) => {
        if (!hasPending(c.id)) return
        supabase
          .rpc('settle_challenge_predictions', { p_challenge_id: c.id, p_winner_team: null })
          .then(({ error }) => {
            if (error) console.warn('[prediction] sweep refund error:', c.code, error.message)
          })
      })
    }

    const at = new Date().toISOString()
    const expiredIds = new Set(expired.map((c) => c.id))
    const orphanIds = new Set(orphaned.map((c) => c.id))
    const abandonedIds = new Set(abandoned.map((c) => c.id))
    const playedSetsOf = (c) => getChallengeSeriesProgress(c, d0.matches || []).totalSetsPlayed

    up((d) => ({
      challenges: (d.challenges || []).map((c) => {
        if (expiredIds.has(c.id)) return { ...c, status: 'expired', predictionsLocked: true }
        // Đã nhận mà bỏ hoang quá hạn → 'cancelled', KHÔNG phải 'expired': 'expired' nghĩa là
        // hết giờ nhận kèo, mà kèo này thì đã nhận rồi. Nhãn "Đã huỷ" đọc đúng chuyện hơn.
        if (abandonedIds.has(c.id)) return { ...c, status: 'cancelled', predictionsLocked: true }
        if (!orphanIds.has(c.id)) return c
        return {
          ...c,
          sessionId: null,
          // Chưa đánh hiệp nào thì mở lại cổng cược: kèo sẽ được xếp sang buổi khác, và chưa có
          // gì lộ ra để mà cược gian.
          predictionsLocked: playedSetsOf(c) > 0,
        }
      }),
      challengePredictions: [...expiredIds, ...orphanIds, ...abandonedIds].reduce(
        (list, id) => settlePredictionsLocal(list, id, null, at),
        d.challengePredictions || [],
      ),
    }))
  }

  A.reloadNotifications = async () => {
    const d0 = db()
    // `?.` vì hàm này chạy theo sự kiện focus tab / message của Service Worker — có thể nổ
    // đúng lúc đang đổi CLB, khi `db` là null.
    if (!d0?.clubId || !supabase) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('club_id', d0.clubId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return console.warn('[notifications] reload error:', error.message)

    const fresh = (data || []).map((n) => ({
      id: n.id, clubId: n.club_id, memberId: n.member_id, type: n.type,
      payload: n.payload || {}, refType: n.ref_type || null, refId: n.ref_id || null,
      readAt: n.read_at || null, createdAt: n.created_at || null,
    }))
    up((d) => {
      const byId = new Map((d.notifications || []).map((n) => [n.id, n]))
      fresh.forEach((n) => byId.set(n.id, n))
      return {
        notifications: [...byId.values()].sort((x, y) =>
          new Date(y.createdAt || 0) - new Date(x.createdAt || 0)),
      }
    })
  }

  A.markNotificationRead = (notifId) => {
    const now = new Date().toISOString()
    // Optimistic local update
    up((d) => ({
      notifications: (d.notifications || []).map((n) =>
        n.id === notifId ? { ...n, readAt: now } : n
      ),
    }))
    // Persist to DB (fire-and-forget, nếu lỗi thì lần reload sẽ hiển thị lại unread)
    if (supabase) {
      supabase.from('notifications').update({ read_at: now }).eq('id', notifId).then(({ error }) => {
        if (error) console.warn('[notifications] markRead error:', error.message)
      })
    }
  }

  A.markAllNotificationsRead = () => {
    const d0 = db()
    const myId = myMember(d0)?.id || null
    const now = new Date().toISOString()
    // Collect IDs to update before mutating state
    const idsToMark = (d0.notifications || [])
      .filter((n) => (!myId || n.memberId === myId) && !n.readAt)
      .map((n) => n.id)
    // Optimistic local update
    up((d) => ({
      notifications: (d.notifications || []).map((n) =>
        (!myId || n.memberId === myId) && !n.readAt ? { ...n, readAt: now } : n
      ),
    }))
    // Persist to DB
    if (supabase && idsToMark.length > 0) {
      supabase.from('notifications').update({ read_at: now }).in('id', idsToMark).then(({ error }) => {
        if (error) console.warn('[notifications] markAllRead error:', error.message)
      })
    }
  }

  A.memberSelfCheckin = (sessionId, status) => {
    const d0 = db()
    const myMem = myMember(d0)
    if (!myMem) return toast(t('toast.noMemberRecord'))
    const myId = myMem.id
    const s = sessionOf(d0, sessionId)
    if (!s) return
    if (s.status === 'closed') {
      return toast(t('toast.selfCheckinClosed'))
    }

    const currentAtt = d0.attendance?.[sessionId]?.[myId]

    // Xác định trạng thái mục tiêu trong bảng attendance
    const targetAtt =
      status === 'present' ? true :
      status === 'absent' ? false :
      status === 'extra' ? 'extra' :
      undefined

    // Kiểm tra xem trạng thái có thực sự thay đổi so với hiện tại không
    const isActuallyChanged = status === 'removeExtra'
      ? currentAtt === 'extra'
      : currentAtt !== targetAtt

    // Tránh spam/click đúp nhanh: kiểm tra cache thao tác gần nhất (trong vòng 3 giây)
    const checkinKey = `${sessionId}:${myId}`
    const recent = recentSelfCheckins.get(checkinKey)
    const isRapidDuplicate = Boolean(
      recent &&
      Date.now() - recent.time < 3000 &&
      recent.status === status
    )

    if (!isActuallyChanged || isRapidDuplicate) {
      if (!isRapidDuplicate) {
        toast(t('toast.selfCheckinNoChange'))
      }
      return
    }

    recentSelfCheckins.set(checkinKey, { status, time: Date.now() })
    if (recentSelfCheckins.size > 100) {
      const curTime = Date.now()
      for (const [k, v] of recentSelfCheckins.entries()) {
        if (curTime - v.time > 10000) recentSelfCheckins.delete(k)
      }
    }

    up((d) => {
      const a = { ...d.attendance }
      const m = { ...(a[sessionId] || {}) }

      if (status === 'removeExtra') {
        delete m[myId]
      } else if (status === 'extra') {
        m[myId] = 'extra'
      } else if (status === 'present') {
        m[myId] = true
      } else if (status === 'absent') {
        m[myId] = false
      }

      a[sessionId] = m

      let lineups = d.lineups
      const onCourt = status === 'present'
      if (!onCourt && d.lineups?.[sessionId]) {
        const sLineup = { ...d.lineups[sessionId] }
        let changed = false
        Object.keys(sLineup).forEach((slotId) => {
          if (sLineup[slotId] === myId) {
            delete sLineup[slotId]
            changed = true
          }
        })
        if (changed) lineups = { ...d.lineups, [sessionId]: sLineup }
      }

      return { attendance: a, lineups, ...withAdhocCharges(d, sessionId, m) }
    })

    // Gọi RPC lưu server nếu có supabase
    if (supabase && (status === 'present' || status === 'absent' || status === 'extra')) {
      supabase
        .rpc('member_self_checkin', {
          p_session_id: sessionId,
          p_status: status,
        })
        .then(({ error }) => {
          if (error) console.warn('[memberSelfCheckin] error:', error.message)
        })
    }

    // Gửi thông báo tới Chủ CLB & Thủ quỹ
    const managers = (d0.members || [])
      .filter((m) => (m.role === 'owner' || m.role === 'treasurer') && m.id !== myId)
      .map((m) => m.id)

    if (managers.length > 0 && status !== 'removeExtra') {
      emitEvent({
        type: 'attendance_reported',
        payload: {
          memberId: myId,
          sessionId,
          date: s.date,
          status,
        },
        recipients: managers,
        refType: 'session',
        refId: sessionId,
        actorId: myId,
        skipActivity: true,
      })
    }

    toast(t('toast.selfCheckinSuccess'))
  }

  A.setSeasonConfig = (seasonData) => {
    const d0 = db()
    const existingSeasons = Array.isArray(d0.seasons) && d0.seasons.length > 0
      ? d0.seasons
      : (d0.club?.seasons || [cfg.season])

    const targetId = seasonData.id || seasonData.code
    let updated = false
    const newSeasons = existingSeasons.map((s) => {
      if ((targetId && (s.id === targetId || s.code === targetId)) || (!targetId && s.active)) {
        updated = true
        return { ...s, ...seasonData }
      }
      return s
    })

    if (!updated) {
      newSeasons.push({ ...seasonData, active: true })
    }

    up((d) => ({
      seasons: newSeasons,
      club: {
        ...(d.club || {}),
        seasons: newSeasons,
      },
    }))

    toast(t('season.saveSeasonSuccess'))
  }

  A.endSeasonAndStartNew = ({ oldSeasonId, newSeasonData, podiumSnapshot = [] }) => {
    const d0 = db()
    const nowIso = new Date().toISOString()
    const existingSeasons = Array.isArray(d0.seasons) && d0.seasons.length > 0
      ? d0.seasons
      : (d0.club?.seasons || [cfg.season])

    const updatedSeasons = existingSeasons.map((s) => {
      const isTarget = oldSeasonId ? (s.id === oldSeasonId || s.code === oldSeasonId) : s.active
      if (isTarget) {
        return {
          ...s,
          active: false,
          closedAt: nowIso,
          podiumSnapshot: podiumSnapshot.length > 0 ? podiumSnapshot : (s.podiumSnapshot || []),
        }
      }
      return { ...s, active: false }
    })

    const newSeason = {
      id: newSeasonData.id || newSeasonData.code || uid(),
      code: newSeasonData.code || 'SEASON',
      name: newSeasonData.name || '',
      fullName: newSeasonData.fullName || newSeasonData.name || '',
      startDate: newSeasonData.startDate,
      endDate: newSeasonData.endDate,
      cycle: newSeasonData.cycle || 'quarter',
      totalSessionsExpected: Number(newSeasonData.totalSessionsExpected) || 14,
      minMatchesOfficial: Number(newSeasonData.minMatchesOfficial) || 8,
      inactiveDays: Number(newSeasonData.inactiveDays) || 21,
      active: true,
      closedAt: null,
      bonusConfig: newSeasonData.bonusConfig || cfg?.season?.bonusConfig || { streak3: 5, streak5: 10, upset150: 5 },
      deltaScale: newSeasonData.deltaScale || cfg?.season?.deltaScale,
    }

    const finalSeasons = [newSeason, ...updatedSeasons]

    up((d) => ({
      seasons: finalSeasons,
      club: {
        ...(d.club || {}),
        seasons: finalSeasons,
      },
    }))

    toast(t('season.seasonEndedSuccess'))
  }

  return A
}
