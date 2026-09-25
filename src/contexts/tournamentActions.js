// Hành động ghi của module Giải đấu — trải vào `a.*` trong makeActions (appActions.js).
//
// Dữ liệu giải KHÔNG nằm trong `db` và KHÔNG đi qua diff()/save() (docs/TOURNAMENT_PLAN.md §4.1):
// mỗi hành động ghi thẳng từng dòng (hoặc gọi RPC), chờ xong rồi nạp lại giải vào state `tour`.
// Không lạc quan: dữ liệu giải nhỏ, đúng quan trọng hơn nhanh.

import { loadTournament, loadTournamentMatches, loadTournaments, tournamentRpc, tournamentWrite } from '#contexts/storage.js'
import { tourRows } from '#contexts/dbmap.js'
import { EVENT_KINDS, entriesOpen, newRegistration, nextStatuses } from '#lib/tournament/hub.js'
import { autoPair, eventPlayers, eventTeams, lineupIssue } from '#lib/tournament/pairing.js'
import { drawNumbers, entrantsOf } from '#lib/tournament/format.js'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { applyCommit, applyEdit, applyUndo } from '#lib/tournament/advance.js'
import { levelOf, myMember } from '#lib/money.js'
import { t } from '#i18n'

/** Lỗi từ DB/RPC mang key `tournament.err.*` → dịch; lỗi khác giữ nguyên để còn biết là gì. */
export const tourErr = (e) => {
  const m = String(e?.message || e || '')
  return m.startsWith('tournament.err.') ? t(m) : m
}

export function makeTournamentActions({ dbRef, tourRef, setTour, toast, uid }) {
  const db = () => dbRef.current
  const tour = () => tourRef.current

  const reloadTour = async () => {
    const cur = tour()
    if (cur) setTour(await loadTournament(cur.id))
  }

  /** Chạy một lần ghi rồi nạp lại giải. Lỗi → toast, trả false. */
  const run = async (fn, okKey, vars) => {
    try {
      await fn()
      await reloadTour()
      if (okKey) toast(t(okKey, vars))
      return true
    } catch (e) {
      toast(tourErr(e))
      return false
    }
  }

  const write = (table, op, list) => tournamentWrite(table, op, op === 'delete' ? list : tourRows(table, list))
  const base = () => ({ clubId: tour().clubId, tournamentId: tour().id })

  return {
    tourList: () => loadTournaments(db().clubId),

    /** Mở một giải vào state `tour`. `null` = đóng (rời trang). */
    tourOpen: async (id) => {
      if (!id) { setTour(null); return null }
      const data = await loadTournament(id)
      setTour(data)
      return data
    },

    tourReload: reloadTour,

    /** Tạo giải nháp, trả id để điều hướng vào Hub. */
    tourCreate: async (form) => {
      const id = uid()
      try {
        await write('tournaments', 'insert', [{
          ...form, id, clubId: db().clubId, status: 'draft', createdBy: myMember(db())?.id || null,
        }])
        toast(t('tournament.toast.created', { name: form.name }))
        return id
      } catch (e) {
        toast(tourErr(e))
        return null
      }
    },

    tourUpdate: (patch) => run(() => write('tournaments', 'upsert', [{ ...tour(), ...patch }]), 'tournament.toast.saved'),

    tourSetStatus: (status) => {
      if (!nextStatuses(tour().status).includes(status)) return toast(t('tournament.err.badTransition'))
      return run(() => write('tournaments', 'upsert', [{ ...tour(), status }]),
        'tournament.toast.status', { status: t('tournament.status.' + status) })
    },

    /** Xoá mềm: giải biến khỏi danh sách, dữ liệu con giữ nguyên. */
    tourDelete: async () => {
      try {
        await write('tournaments', 'upsert', [{ ...tour(), deletedAt: new Date().toISOString() }])
        toast(t('tournament.toast.deleted', { name: tour().name }))
        setTour(null)
        return true
      } catch (e) {
        toast(tourErr(e))
        return false
      }
    },

    tourAddEvent: (kind) => run(() => write('tournament_events', 'insert', [{
      ...base(), id: uid(), kind, ...EVENT_KINDS[kind], status: 'draft', sortOrder: tour().events.length,
    }]), 'tournament.toast.eventAdded', { name: t('tournament.kind.' + kind) }),

    /** Chỉ nội dung còn nháp và chưa ai đăng ký — xoá nội dung có người là xoá luôn đăng ký của họ. */
    tourDeleteEvent: (eventId) => {
      const ev = tour().events.find((e) => e.id === eventId)
      if (!ev || ev.status !== 'draft' || tour().entries.some((e) => e.eventId === eventId)) {
        return toast(t('tournament.err.eventInUse'))
      }
      return run(() => write('tournament_events', 'delete', [eventId]), 'tournament.toast.eventDeleted')
    },

    /** Đăng ký thành viên (bỏ qua người đã có dòng — kể cả đã rút: dùng tourRestore). */
    tourRegister: (memberIds) => {
      const cur = tour()
      const d = db()
      const had = new Set(cur.registrations.map((r) => r.playerId))
      const rows = memberIds
        .filter((id) => !had.has(id))
        .map((id) => d.members.find((m) => m.id === id))
        .filter(Boolean)
        .map((m) => ({
          ...base(), id: uid(),
          // Trình độ của THÁNG này (levelOf), không phải cột gốc — đổi trình chờ áp dụng thì đã tính.
          ...newRegistration({ tournament: cur, member: { ...m, level: levelOf(m, d.month) }, ratings: d.playerRatings, levels: d.levels }),
        }))
      if (!rows.length) return false
      return run(() => write('tournament_registrations', 'insert', rows), 'tournament.toast.registered', { n: rows.length })
    },

    tourSetPaid: (regId, paid) => {
      const r = tour().registrations.find((x) => x.id === regId)
      return run(() => write('tournament_registrations', 'upsert', [{
        ...base(), ...r, paid, paidAt: paid ? new Date().toISOString() : null,
      }]))
    },

    /** Rút lui là đổi trạng thái, không xoá: còn giữ lịch sử và khoản đã đóng. */
    tourWithdraw: (regId, withdrawn) => {
      const r = tour().registrations.find((x) => x.id === regId)
      return run(() => write('tournament_registrations', 'upsert', [{
        ...base(), ...r, status: withdrawn ? 'withdrawn' : 'registered',
      }]), withdrawn ? 'tournament.toast.withdrawn' : 'tournament.toast.restored')
    },

    tourToggleEntry: (regId, eventId, on) => {
      const ev = tour().events.find((e) => e.id === eventId)
      if (!ev || !entriesOpen(ev)) return toast(t('tournament.err.eventLocked'))
      const row = { ...base(), eventId, registrationId: regId }
      return run(() => write('tournament_event_entries', on ? 'insert' : 'delete', on ? [row] : tourRows('tournament_event_entries', [row])))
    },

    /** Giải thưởng / dự trù chi: thêm hoặc sửa một dòng. */
    tourSaveLine: (table, line) => run(() => write(table, 'upsert', [{ ...base(), ...line, id: line.id || uid() }]),
      'tournament.toast.saved'),

    tourDeleteLine: (table, id) => run(() => write(table, 'delete', [id])),

    /* ---------- Phase 2: đội hình ---------- */

    /** Đưa người vào đội `teamId` (null = lập đội mới); rời đội cũ trước, đội cũ rỗng thì xoá. */
    tourPlace: (eventId, regId, teamId) => run(async () => {
      await leaveTeam(eventId, regId)
      let tid = teamId
      if (!tid) {
        tid = uid()
        await write('tournament_teams', 'insert', [{ ...base(), id: tid, eventId, pinned: false, status: 'active' }])
      }
      await write('tournament_team_players', 'insert', [{ ...base(), teamId: tid, eventId, registrationId: regId }])
    }),

    /** Trả người về danh sách chưa có cặp. */
    tourUnplace: (eventId, regId) => run(() => leaveTeam(eventId, regId)),

    tourPin: (teamId, pinned) => {
      const t0 = tour().teams.find((x) => x.id === teamId)
      return run(() => write('tournament_teams', 'upsert', [{ ...t0, pinned }]))
    },

    /** Xoá mọi cặp CHƯA ghim (người về danh sách chờ). Cặp ghim giữ nguyên. */
    tourClearPairs: (eventId) => run(() => dropUnpinned(eventId)),

    /** Ghép tự động: gỡ cặp chưa ghim rồi ghép lại toàn bộ người chưa có cặp. */
    tourAutoPair: (eventId, mode) => run(async () => {
      await dropUnpinned(eventId)
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      const pinnedIds = new Set(cur.teams.filter((t) => t.eventId === eventId && t.pinned).map((t) => t.id))
      const pool = eventPlayers(cur, eventId).filter((p) => !p.teamId || !pinnedIds.has(p.teamId))
      const pairs = autoPair(pool, { genderRule: ev.genderRule, mode })
      if (!pairs.length) return
      const teams = pairs.map(() => ({ ...base(), id: uid(), eventId, pinned: false, status: 'active' }))
      await write('tournament_teams', 'insert', teams)
      await write('tournament_team_players', 'insert', pairs.flatMap((pair, i) => pair.map((p) => ({
        ...base(), teamId: teams[i].id, eventId, registrationId: p.id,
      }))))
    }),

    /** Chốt đội hình: kiểm lại luật, nội dung đơn thì lập mỗi người một đội, rồi khoá (DB trigger giữ khoá). */
    tourLockLineup: (eventId) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      const players = eventPlayers(cur, eventId)
      const issue = lineupIssue(ev, eventTeams(cur, eventId), players)
      if (issue) return toast(t(issue))
      return run(async () => {
        if (ev.teamSize === 1) {
          const loners = players.filter((p) => !p.teamId)
          const teams = loners.map(() => ({ ...base(), id: uid(), eventId, pinned: false, status: 'active' }))
          if (teams.length) {
            await write('tournament_teams', 'insert', teams)
            await write('tournament_team_players', 'insert', loners.map((p, i) => ({ ...base(), teamId: teams[i].id, eventId, registrationId: p.id })))
          }
        }
        await write('tournament_events', 'upsert', [{ ...ev, status: 'drawn' }])
      }, 'tournament.toast.locked', { name: t('tournament.kind.' + ev.kind) })
    },

    /** Mở lại đội hình — chỉ khi chưa có lịch thi đấu (giai đoạn nào cũng còn `pending`). */
    tourUnlockLineup: (eventId) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      if (ev.status !== 'drawn' || cur.stages.some((s) => s.eventId === eventId && s.status !== 'pending')) {
        return toast(t('tournament.err.scheduleExists'))
      }
      return run(() => write('tournament_events', 'upsert', [{ ...ev, status: 'draft' }]), 'tournament.toast.unlocked')
    },

    /* ---------- Phase 2: thể thức & lịch ---------- */

    /** Lưu thể thức (giai đoạn 1) của nội dung. Đã có lịch thì không đổi được — luật đã chép vào từng trận. */
    tourSaveStage: (eventId, stage) => {
      const cur = tour()
      const old = cur.stages.find((s) => s.eventId === eventId && s.seq === stage.seq)
      if (old && old.status !== 'pending') return toast(t('tournament.err.scheduleExists'))
      return run(() => write('tournament_stages', 'upsert', [{ ...base(), ...old, ...stage, eventId, id: old?.id || uid() }]))
    },

    /** Bốc thăm: số 1..n ngẫu nhiên cho các đội đủ người. Làm lại được tới khi tạo lịch. */
    tourDraw: (eventId) => {
      const cur = tour()
      const teams = eventTeams(cur, eventId)
      const rows = drawNumbers(teams).map(({ teamId, drawNo }) => ({ ...cur.teams.find((x) => x.id === teamId), drawNo }))
      return run(() => write('tournament_teams', 'upsert', rows), 'tournament.toast.drawn')
    },

    /**
     * Đổi số bốc thăm của hai đội = đổi chỗ trong nhánh. Chỉ trước khi có lịch; đã có lịch thì
     * "Làm lại lịch" trước (plan: không có RPC đổi chỗ riêng — đổi chỗ = sinh lại).
     */
    tourSwapDraw: (eventId, teamIdA, teamIdB) => {
      const cur = tour()
      if (cur.stages.some((s) => s.eventId === eventId && s.status !== 'pending')) return toast(t('tournament.err.scheduleExists'))
      const a = cur.teams.find((x) => x.id === teamIdA)
      const b = cur.teams.find((x) => x.id === teamIdB)
      if (!a || !b || a.id === b.id) return false
      return run(() => write('tournament_teams', 'upsert', [{ ...a, drawNo: b.drawNo }, { ...b, drawNo: a.drawNo }]))
    },

    /** Tạo lịch: bracket.js dựng nhánh ở client, RPC chỉ kiểm + ghi nguyên tử (plan §2.3). */
    tourGenerate: (eventId) => {
      const cur = tour()
      const stage = cur.stages.find((s) => s.eventId === eventId && s.seq === 1)
      if (!stage) return toast(t('tournament.format.needFormat'))
      const { error, entrants } = entrantsOf(eventTeams(cur, eventId), stage.config?.seeding)
      if (error) return toast(t(error))
      let matches
      try {
        matches = buildKnockout({ stage, entrants, newId: uid })
      } catch (e) {
        return toast(e.message)
      }
      return run(() => tournamentRpc('tournament_generate_stage', { p_stage: stage.id, p_groups: [], p_matches: matches }),
        'tournament.toast.generated', { n: matches.filter((m) => m.status !== 'bye').length })
    },

    /* ---------- Phase 3: nhánh đấu trực tiếp ---------- */

    /** Nạp lại riêng bảng trận (poll 15 s) — nhẹ hơn nạp cả giải, bắt được cả trận vừa bị xoá khi reset. */
    tourPoll: async () => {
      const cur = tour()
      if (!cur) return
      const { matches, matchEdits } = await loadTournamentMatches(cur.id)
      setTour((x) => (x && x.id === cur.id ? { ...x, matches, matchEdits } : x))
    },

    /** Trận bắt đầu đánh: người khác thấy "đang đánh", trận trước nó hết hoàn tác được. */
    tourStartMatch: (matchId, court) => run(() => tournamentRpc('tournament_start_match', { p_match: matchId, p_court: court || null })),

    /**
     * Chốt kết quả. Chạy thử `applyCommit` trên máy trước: sai luật thì báo ngay bằng key i18n,
     * khỏi đi một vòng mạng. RPC vẫn kiểm lại — máy khách không phải chỗ tin.
     */
    tourCommit: (matchId, { sets = [], winner, status = 'done', note = null }) => {
      const check = applyCommit(tour().matches, { matchId, sets, winner, status, note })
      if (check.error) { toast(t(check.error)); return false }
      return run(() => tournamentRpc('tournament_commit_match', {
        p_match: matchId, p_sets: sets, p_winner: winner, p_status: status, p_note: note,
      }), 'tournament.toast.committed')
    },

    tourEditScore: (matchId, sets, reason) => {
      const check = applyEdit(tour().matches, { matchId, sets, reason })
      if (check.error) { toast(t(check.error)); return false }
      return run(() => tournamentRpc('tournament_edit_match', { p_match: matchId, p_sets: sets, p_reason: reason }), 'tournament.toast.edited')
    },

    tourUndo: (matchId, reason) => {
      const check = applyUndo(tour().matches, { matchId, reason })
      if (check.error) { toast(t(check.error)); return false }
      return run(() => tournamentRpc('tournament_undo_match', { p_match: matchId, p_reason: reason }), 'tournament.toast.undone')
    },

    /** BTC chỉnh thứ tự / sân của trận chưa đánh. */
    tourSchedule: (matchId, seqNo, court) => run(() => tournamentRpc('tournament_schedule_match', {
      p_match: matchId, p_seq_no: seqNo ?? null, p_court: court || null,
    })),

    /** Xoá lịch để làm lại (đổi chỗ, đổi luật) — RPC chặn nếu đã có trận xong. */
    tourResetSchedule: (eventId, reason) => {
      const stage = tour().stages.find((s) => s.eventId === eventId && s.seq === 1)
      if (!stage) return false
      return run(() => tournamentRpc('tournament_reset_stage', { p_stage: stage.id, p_reason: reason }), 'tournament.toast.resetDone')
    },
  }

  /** Rời đội hiện tại của nội dung; đội còn trống thì xoá luôn (không để đội ma). */
  async function leaveTeam(eventId, regId) {
    const cur = tour()
    const tp = cur.teamPlayers.find((p) => p.eventId === eventId && p.registrationId === regId)
    if (!tp) return
    await write('tournament_team_players', 'delete', tourRows('tournament_team_players', [tp]))
    if (!cur.teamPlayers.some((p) => p.teamId === tp.teamId && p.registrationId !== regId)) {
      await write('tournament_teams', 'delete', [tp.teamId])
    }
  }

  /** Xoá các đội chưa ghim của nội dung (cascade xoá người trong đội). */
  async function dropUnpinned(eventId) {
    const ids = tour().teams.filter((x) => x.eventId === eventId && !x.pinned).map((x) => x.id)
    if (ids.length) await write('tournament_teams', 'delete', ids)
  }
}
