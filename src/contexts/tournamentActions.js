// Hành động ghi của module Giải đấu — trải vào `a.*` trong makeActions (appActions.js).
//
// Dữ liệu giải KHÔNG nằm trong `db` và KHÔNG đi qua diff()/save() (docs/TOURNAMENT_PLAN.md §4.1):
// mỗi hành động ghi thẳng từng dòng (hoặc gọi RPC), chờ xong rồi nạp lại giải vào state `tour`.
// Không lạc quan: dữ liệu giải nhỏ, đúng quan trọng hơn nhanh.

import { loadTournament, loadTournamentMatches, loadTournaments, tournamentRpc, tournamentWrite } from '#contexts/storage.js'
import { tourRows } from '#contexts/dbmap.js'
import { EVENT_KINDS, canEnter, eligibleNotEntered, entriesOpen, newRegistration, nextStatuses } from '#lib/tournament/hub.js'
import { autoPair, eventPlayers, eventTeams, lineupIssue } from '#lib/tournament/pairing.js'
import { buildTemplateStages, drawNumbers, entrantsOf } from '#lib/tournament/format.js'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { buildRoundRobin, snakeGroups } from '#lib/tournament/roundRobin.js'
import { entrantsFromLinks } from '#lib/tournament/links.js'
import { applyCommit, applyEdit, applyUndo } from '#lib/tournament/advance.js'
import { levelOf, myMember } from '#lib/money.js'
import { t } from '#i18n'

/** Lỗi từ DB/RPC mang key `tournament.err.*` → dịch; lỗi khác giữ nguyên để còn biết là gì. */
export const tourErr = (e) => {
  const m = String(e?.message || e || '')
  return m.startsWith('tournament.err.') ? t(m) : m
}

/** "Mọi đội còn lại" vào nhánh phụ: lấy thừa hạng — bảng không có hạng đó thì `entrantsFromLinks` bỏ qua. */
const PLATE_ALL = 16

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

    /**
     * Đăng ký thành viên (bỏ qua người đã có dòng — kể cả đã rút: dùng tourRestore), rồi đưa luôn vào các
     * nội dung `eventIds` còn nhận người và hợp giới — khỏi bấm chip từng người.
     */
    tourRegister: (memberIds, eventIds = []) => {
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
      const entries = cur.events
        .filter((ev) => eventIds.includes(ev.id) && entriesOpen(ev))
        .flatMap((ev) => rows.filter((r) => canEnter(ev, r.gender)).map((r) => ({ ...base(), eventId: ev.id, registrationId: r.id })))
      return run(async () => {
        await write('tournament_registrations', 'insert', rows)
        if (entries.length) await write('tournament_event_entries', 'insert', entries)
      }, 'tournament.toast.registered', { n: rows.length })
    },

    /** Đưa mọi thí sinh đang đăng ký, hợp giới, chưa có trong nội dung vào nội dung đó. */
    tourEnterAll: (eventId) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      if (!ev || !entriesOpen(ev)) return toast(t('tournament.err.eventLocked'))
      const rows = eligibleNotEntered(cur, ev).map((r) => ({ ...base(), eventId, registrationId: r.id }))
      if (!rows.length) return false
      return run(() => write('tournament_event_entries', 'insert', rows), 'tournament.toast.entered', { n: rows.length })
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

    /** Tạo lịch: round-robin hoặc knockout dựng ở client, RPC chỉ kiểm + ghi nguyên tử (plan §2.3). */
    tourGenerate: (eventId, stageSeq = 1) => {
      const cur = tour()
      const stage = cur.stages.find((s) => s.eventId === eventId && s.seq === stageSeq)
      if (!stage) return toast(t('tournament.format.needFormat'))

      if (stage.type === 'round_robin') {
        const teams = eventTeams(cur, eventId)
        const full = teams.filter((x) => x.full)
        const numGroups = stage.config?.numGroups || 1
        // Mỗi bảng ≥ 2 đội, không thì có bảng không có trận nào và không chốt hạng được.
        if (full.length < numGroups * 2) return toast(t('tournament.format.tooFewForGroups', { n: numGroups * 2 }))
        const rawGroups = snakeGroups(full, numGroups)
        const groups = rawGroups.map((g) => ({
          id: uid(),
          stageId: stage.id,
          label: g.label,
          seq: g.seq,
          teams: g.teams,
        }))
        let matches
        try {
          matches = buildRoundRobin({ stage, groups, legs: stage.config?.legs || 1, newId: uid })
        } catch (e) {
          return toast(e.message)
        }
        return run(() => tournamentRpc('tournament_generate_stage', { p_stage: stage.id, p_groups: groups, p_matches: matches }),
          'tournament.toast.generated', { n: matches.length })
      }

      // Loại trực tiếp (knockout)
      let entrants
      if (stage.config?.seeding === 'rank') {
        const link = (cur.stageLinks || []).find((l) => l.toStageId === stage.id)
        if (!link) return toast(t('tournament.err.invalidLink'))
        const priorStage = cur.stages.find((s) => s.id === link.fromStageId)
        if (!priorStage || priorStage.status !== 'done') return toast(t('tournament.err.priorStageNotDone'))
        const groups = (cur.groups || []).filter((g) => g.stageId === priorStage.id)
        const groupTeams = cur.groupTeams || []
        const res = entrantsFromLinks({ link, groups, groupTeams })
        if (res.error) return toast(t(res.error))
        entrants = res.entrants
      } else {
        const { error, entrants: ent } = entrantsOf(eventTeams(cur, eventId), stage.config?.seeding)
        if (error) return toast(t(error))
        entrants = ent
      }

      let matches
      try {
        matches = buildKnockout({ stage, entrants, newId: uid })
      } catch (e) {
        return toast(e.message)
      }
      return run(() => tournamentRpc('tournament_generate_stage', { p_stage: stage.id, p_groups: [], p_matches: matches }),
        'tournament.toast.generated', { n: matches.filter((m) => m.status !== 'bye').length })
    },

    /** Chốt giai đoạn (vòng bảng): ghi final_rank cho các đội và chuyển stage sang 'done'. */
    tourCloseStage: (stageId, ranks) => {
      return run(() => tournamentRpc('tournament_close_stage', { p_stage: stageId, p_ranks: ranks }),
        'tournament.toast.stageClosed')
    },

    /** Đổi mẫu thể thức cho nội dung */
    tourSaveTemplate: async (eventId, templateKey, custom = {}) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      if (!ev) return false
      const oldStages = cur.stages.filter((s) => s.eventId === eventId)
      // Đã sinh trận thì không thay thể thức (DB cũng chặn xoá giai đoạn có trận qua FK) — làm lại lịch trước.
      if (oldStages.some((s) => s.status !== 'pending')) { toast(t('tournament.err.scheduleExists')); return false }
      const { stages, links } = buildTemplateStages(templateKey, ev, custom)
      const oldStageIds = new Set(oldStages.map((s) => s.id))
      const oldLinks = (cur.stageLinks || []).filter((l) => oldStageIds.has(l.fromStageId) || oldStageIds.has(l.toStageId))

      const newStages = stages.map((s) => ({ ...base(), ...s, id: uid(), eventId }))
      const stageMapBySeq = {}
      newStages.forEach((s) => { stageMapBySeq[s.seq] = s.id })

      const newLinks = links.map((l) => ({
        ...base(),
        id: uid(),
        fromStageId: stageMapBySeq[l.fromStageSeq],
        toStageId: stageMapBySeq[l.toStageSeq],
        ranks: l.ranks,
      }))

      try {
        if (oldLinks.length) await write('tournament_stage_links', 'delete', oldLinks.map((l) => l.id))
        if (oldStages.length) await write('tournament_stages', 'delete', oldStages.map((s) => s.id))
        await write('tournament_stages', 'insert', newStages)
        if (newLinks.length) await write('tournament_stage_links', 'insert', newLinks)
        await write('tournament_events', 'upsert', [{ ...base(), ...ev, templateKey }])
        await reloadTour()
        toast(t('tournament.toast.formatSaved'))
        return true
      } catch (e) {
        toast(tourErr(e))
        return false
      }
    },

    /**
     * Đội đi tiếp sau vòng bảng: sửa `config.advancePerGroup` của vòng bảng VÀ `ranks` của các link (link là thứ
     * `entrantsFromLinks` đọc — chỉ sửa config thì nhánh vẫn lấy số đội cũ).
     *   advance: số đội mỗi bảng vào nhánh chính (hạng 1..advance).
     *   plate:   (mẫu có nhánh phụ) số hạng ngay sau đó vào nhánh phụ; 'all' = mọi đội còn lại.
     *            Bảng ít đội hơn thì `entrantsFromLinks` tự bỏ qua hạng thiếu.
     * Không truyền thì giữ nguyên giá trị đang có.
     */
    tourSetAdvance: async (eventId, { advance, plate } = {}) => {
      const cur = tour()
      const stages = cur.stages.filter((s) => s.eventId === eventId).sort((x, y) => x.seq - y.seq)
      const [rr, main, plateStage] = stages
      if (!rr || rr.type !== 'round_robin' || !main) return false
      if (stages.some((s) => s.status !== 'pending')) { toast(t('tournament.err.scheduleExists')); return false }
      const linkOf = (to) => (cur.stageLinks || []).find((l) => l.fromStageId === rr.id && l.toStageId === to.id)
      const seq = (from, k) => Array.from({ length: k }, (_, i) => from + i)
      const n = advance ?? rr.config?.advancePerGroup ?? 2
      const oldPlate = plateStage && linkOf(plateStage) ? linkOf(plateStage).ranks.length : 2
      const p = plate ?? (oldPlate > 2 ? 'all' : oldPlate)
      const links = [
        linkOf(main) && { ...linkOf(main), ranks: seq(1, n) },
        plateStage && linkOf(plateStage) && { ...linkOf(plateStage), ranks: seq(n + 1, p === 'all' ? PLATE_ALL : p) },
      ].filter(Boolean)
      return run(async () => {
        await write('tournament_stages', 'upsert', [{ ...base(), ...rr, config: { ...rr.config, advancePerGroup: n } }])
        if (links.length) await write('tournament_stage_links', 'upsert', links.map((l) => ({ ...base(), ...l })))
      })
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
      // Làm lại giai đoạn MUỘN NHẤT đã sinh trận (nhánh sau vòng bảng trước) — DB chặn làm lại giai đoạn
      // trước khi giai đoạn sau đã sinh (`downstreamStageRunning`).
      const stage = tour().stages
        .filter((s) => s.eventId === eventId && s.status !== 'pending')
        .sort((x, y) => y.seq - x.seq)[0]
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
