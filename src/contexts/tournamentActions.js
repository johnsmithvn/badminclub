// Hành động ghi của module Giải đấu — trải vào `a.*` trong makeActions (appActions.js).
//
// Dữ liệu giải KHÔNG nằm trong `db` và KHÔNG đi qua diff()/save() (docs/TOURNAMENT_PLAN.md §4.1):
// mỗi hành động ghi thẳng từng dòng (hoặc gọi RPC), chờ xong rồi nạp lại giải vào state `tour`.
// Không lạc quan: dữ liệu giải nhỏ, đúng quan trọng hơn nhanh.

import { loadTournament, loadTournamentMatches, loadTournaments, tournamentRpc, tournamentWrite } from '#contexts/storage.js'
import { tourRows } from '#contexts/dbmap.js'
import { EVENT_KINDS, canEnter, eligibleNotEntered, entriesOpen, newGuestRegistration, newRegistration, nextStatuses } from '#lib/tournament/hub.js'
import { autoPair, eventPlayers, eventTeams, lineupIssue, shuffle } from '#lib/tournament/pairing.js'
import { RULE_PRESETS, buildTemplateStages, drawNumbers, entrantsOf } from '#lib/tournament/format.js'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { buildRoundRobin } from '#lib/tournament/roundRobin.js'
import { graphIssue, graphOf, groupsForStage, manualGroupsOk, nextSeq, stagesFromGraph } from '#lib/tournament/canvas.js'
import { applySeedOrder, entrantsFromLinks } from '#lib/tournament/links.js'
import { applyCommit, applyEdit, applyUndo } from '#lib/tournament/advance.js'
import { stageEditable } from '#lib/tournament/bracketView.js'
import { eventDone, tourDone } from '#lib/tournament/flow.js'
import { levelOf, myMember } from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }
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
          ...form, id, clubId: db().clubId, status: 'registration', createdBy: myMember(db())?.id || null,
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

    tourUpdateEvent: (eventId, patch) => {
      const ev = tour().events.find((e) => e.id === eventId)
      if (!ev) return toast(t('tournament.err.notFound'))
      return run(() => write('tournament_events', 'upsert', [{ ...ev, ...patch }]), 'tournament.toast.saved')
    },

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
    tourRegister: (memberIds, eventIds = [], { guestIds = [], newGuests = [] } = {}) => {
      const cur = tour()
      const d = db()
      const had = new Set(cur.registrations.map((r) => r.playerId))
      const memberRows = memberIds
        .filter((id) => !had.has(id))
        .map((id) => d.members.find((m) => m.id === id))
        .filter(Boolean)
        .map((m) => ({
          ...base(), id: uid(),
          // Trình độ của THÁNG này (levelOf), không phải cột gốc — đổi trình chờ áp dụng thì đã tính.
          ...newRegistration({ tournament: cur, member: { ...m, level: levelOf(m, d.month) }, ratings: d.playerRatings, levels: d.levels }),
        }))
      // Khách ngoài CLB (chỉ giải "Mở rộng"): người đã có trong danh sách của CLB + người mới gõ tên.
      const guestList = cur.scope === 'open' ? [
        ...guestIds.filter((id) => !had.has(id)).map((id) => (cur.guests || []).find((g) => g.id === id)).filter(Boolean),
        ...newGuests.filter((g) => g.name?.trim()).map((g) => ({ id: uid(), clubId: cur.clubId, name: g.name.trim(), gender: g.gender, level: g.level || '', phone: g.phone || '', fresh: true })),
      ] : []
      const guestRows = guestList.map((g) => ({ ...base(), id: uid(), ...newGuestRegistration({ tournament: cur, guest: g, levels: d.levels }) }))
      const rows = [...memberRows, ...guestRows]
      if (!rows.length) return false
      const entries = cur.events
        .filter((ev) => eventIds.includes(ev.id) && entriesOpen(ev))
        .flatMap((ev) => rows.filter((r) => canEnter(ev, r.gender)).map((r) => ({ ...base(), eventId: ev.id, registrationId: r.id })))
      const created = guestList.filter((g) => g.fresh)
      return run(async () => {
        if (created.length) await write('tournament_guests', 'insert', created)
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

    /** "Tất cả đã đóng": một lần bấm cho mọi người còn nợ phí (bỏ qua người phí 0 và người đã rút). */
    tourSetAllPaid: () => {
      const now = new Date().toISOString()
      const rows = tour().registrations.filter((r) => r.status === 'registered' && !r.paid && r.fee > 0)
      if (!rows.length) return false
      return run(() => write('tournament_registrations', 'upsert', rows.map((r) => ({ ...base(), ...r, paid: true, paidAt: now }))),
        'tournament.toast.allPaid', { n: rows.length })
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
      const pairs = autoPair(pool, { genderRule: ev.genderRule, mode, history: db().matches || [] })
      if (!pairs.length) return
      const teams = pairs.map(() => ({ ...base(), id: uid(), eventId, pinned: false, status: 'active' }))
      await write('tournament_teams', 'insert', teams)
      await write('tournament_team_players', 'insert', pairs.flatMap((pair, i) => pair.map((p) => ({
        ...base(), teamId: teams[i].id, eventId, registrationId: p.id,
      }))))
    }),

    /** Đổi chỗ 2 người giữa 2 đội (gợi ý `suggestSwap`): gỡ 2 dòng rồi ghi lại chéo nhau. */
    tourSwapPlayers: (eventId, { teamA, regA, teamB, regB }) => {
      const tps = tour().teamPlayers.filter((p) => p.eventId === eventId && (p.registrationId === regA.id || p.registrationId === regB.id))
      if (tps.length !== 2) return false
      return run(async () => {
        await write('tournament_team_players', 'delete', tourRows('tournament_team_players', tps))
        await write('tournament_team_players', 'insert', [
          { ...base(), teamId: teamB, eventId, registrationId: regA.id },
          { ...base(), teamId: teamA, eventId, registrationId: regB.id },
        ])
      }, 'tournament.toast.swapped')
    },

    /** Chốt đội hình: kiểm lại luật, nội dung đơn thì lập mỗi người một đội, rồi khoá (DB trigger giữ khoá). */
    tourLockLineup: (eventId) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      const players = eventPlayers(cur, eventId)
      const issue = lineupIssue(ev, eventTeams(cur, eventId), players)
      if (issue) return toast(t(issue))
      return run(() => lockLineup(eventId), 'tournament.toast.locked', { name: t('tournament.kind.' + ev.kind) })
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
    /**
     * Tạo lịch. Giai đoạn đầu mà đội hình chưa chốt thì TỰ chốt luôn (làm gọn: không bắt bấm "Chốt đội hình"
     * rồi mới sang đây bấm "Tạo lịch"). Chưa chọn thể thức → dùng Loại trực tiếp mặc định (báo một dòng).
     * Đội hình chưa hợp lệ → báo đúng lý do, không làm gì.
     */
    tourGenerate: async (eventId, stageSeq = 1) => {
      const ev = tour().events.find((e) => e.id === eventId)
      if (stageSeq === 1 && ev) {
        const open = entriesOpen(ev)
        const noFormat = !tour().stages.some((s) => s.eventId === eventId && s.seq === 1)
        if (open) {
          const issue = lineupIssue(ev, eventTeams(tour(), eventId), eventPlayers(tour(), eventId))
          if (issue) { toast(t(issue)); return false }
        }
        if (open || noFormat) {
          try {
            // Nạp lại giữa hai bước: lockLineup ghi đè cả dòng nội dung — dữ liệu cũ sẽ xoá mất template vừa đặt.
            if (noFormat) { await replaceFormat(eventId, 'ko'); await reloadTour() }
            if (open) { await lockLineup(eventId); await reloadTour() }
            if (noFormat) toast(t('tournament.format.autoKo'))
          } catch (e) {
            toast(tourErr(e))
            return false
          }
        }
      }
      return generate(eventId, stageSeq)
    },

    /**
     * Chốt giai đoạn (vòng bảng): ghi final_rank cho các đội và chuyển stage sang 'done'. Rồi TỰ sinh lịch các
     * giai đoạn nhận đội từ đây mà mọi nguồn đã chốt (vd. bảng → nhánh chính + nhánh phụ) — khỏi bấm thêm
     * "Tạo lịch" từng nhánh. Sinh hỏng (hạng hoà chưa tách…) thì nút tạo lịch tay vẫn còn ở bảng xếp hạng.
     */
    tourCloseStage: async (stageId, ranks) => {
      const ok = await synced(run(() => tournamentRpc('tournament_close_stage', { p_stage: stageId, p_ranks: ranks }),
        'tournament.toast.stageClosed'))
      if (!ok) return ok
      const cur = tour()
      const links = cur.stageLinks || []
      const done = (id) => cur.stages.find((s) => s.id === id)?.status === 'done'
      const ready = cur.stages
        .filter((s) => s.status === 'pending' && links.some((l) => l.fromStageId === stageId && l.toStageId === s.id))
        .filter((s) => links.filter((l) => l.toStageId === s.id).every((l) => done(l.fromStageId)))
        .sort((x, y) => x.seq - y.seq)
      for (const s of ready) await generate(s.eventId, s.seq)
      return ok
    },

    /** Đổi mẫu thể thức cho nội dung */
    tourSaveTemplate: async (eventId, templateKey, custom = {}) => {
      if (tour().stages.some((s) => s.eventId === eventId && s.status !== 'pending')) {
        toast(t('tournament.err.scheduleExists'))
        return false
      }
      return run(() => replaceFormat(eventId, templateKey, custom), 'tournament.toast.formatSaved')
    },

    /**
     * Áp dụng gợi ý thể thức (`recommend`) cho nhiều nội dung trong MỘT lần bấm. Nội dung đã có lịch thì giữ
     * nguyên — gợi ý không bao giờ xoá lịch đang chạy.
     * @param {Array<{ eventId: string, pick: { tpl, numGroups, advance } }>} list
     */
    tourApplyRecommendation: (list, rules = null) => {
      const locked = new Set(tour().stages.filter((s) => s.status !== 'pending').map((s) => s.eventId))
      const todo = list.filter((x) => x.pick && !locked.has(x.eventId))
      if (!todo.length) return false
      return run(async () => {
        for (const { eventId, pick } of todo) {
          await replaceFormat(eventId, pick.tpl, { numGroups: pick.numGroups, advancePerGroup: pick.advance || 2, rules })
        }
      }, 'tournament.toast.recommendApplied', { n: todo.length })
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

    /* ---------- Phase 6: canvas sơ đồ (thể thức tự dựng) ---------- */
    // Mọi thao tác chỉ khi nội dung CHƯA có lịch; sửa xong nội dung thành mẫu 'custom'.

    /**
     * Thêm khối: chưa có gì → khối nguồn (seq 1); đã có → nhánh loại trực tiếp mới, đặt ở `at`.
     * `config` ghép đè cấu hình mặc định (khay trái: "Vòng tròn" = 1 bảng, "Chung kết" = không tranh 3).
     */
    tourCanvasAdd: (eventId, type, at = null, config = {}) => {
      const cur = tour()
      const ev = cur.events.find((e) => e.id === eventId)
      const stages = cur.stages.filter((s) => s.eventId === eventId)
      if (!ev || stages.some((s) => s.status !== 'pending')) { toast(t('tournament.err.scheduleExists')); return false }
      const d = cfg.tournament.defaultRules
      const qualify = { ...RULE_PRESETS[d.qualify[ev.kind] || d.qualify.default] }
      const ranking = { ...RULE_PRESETS[d.ranking] }
      const row = {
        ...base(), id: uid(), eventId, seq: nextSeq(stages), type, title: null, status: 'pending',
        config: { ...(type === 'round_robin' ? { numGroups: 2, legs: 1, seeding: 'seed' } : { thirdPlace: true, seeding: stages.length ? 'rank' : 'seed' }), ...config },
        matchRule: qualify, ruleOverrides: type === 'knockout' ? { final: ranking, third: ranking } : {},
        canvasX: at?.x ?? null, canvasY: at?.y ?? null,
      }
      return run(async () => {
        await write('tournament_stages', 'insert', [row])
        await markCustom(ev)
      })
    },

    /** Sửa khối (toạ độ sau khi kéo, tên, số bảng, luật…) — `patch` ghép vào giai đoạn. */
    tourCanvasSave: (stageId, patch) => {
      const cur = tour()
      const stage = cur.stages.find((s) => s.id === stageId)
      if (!stage || stage.status !== 'pending') return false
      const ev = cur.events.find((e) => e.id === stage.eventId)
      const onlyMove = Object.keys(patch).every((k) => k === 'canvasX' || k === 'canvasY')
      return run(async () => {
        await write('tournament_stages', 'upsert', [{ ...base(), ...stage, ...patch }])
        if (!onlyMove) await markCustom(ev) // kéo cho gọn không làm đổi thể thức
      })
    },

    /** Nối nguồn → khối bằng bộ hạng `ranks`; bộ rỗng = gỡ nối. */
    tourCanvasLink: (fromStageId, toStageId, ranks) => {
      const cur = tour()
      const to = cur.stages.find((s) => s.id === toStageId)
      if (!to || to.status !== 'pending') return false
      const ev = cur.events.find((e) => e.id === to.eventId)
      const old = (cur.stageLinks || []).find((l) => l.fromStageId === fromStageId && l.toStageId === toStageId)
      const sorted = [...ranks].sort((a, b) => a - b)
      return run(async () => {
        if (!sorted.length) {
          if (old) await write('tournament_stage_links', 'delete', [old.id])
        } else {
          await write('tournament_stage_links', 'upsert', [{ ...base(), id: old?.id || uid(), fromStageId, toStageId, ranks: sorted }])
        }
        await markCustom(ev)
      })
    },

    /** Xoá khối (và link của nó). Khối nguồn chỉ xoá được khi là khối cuối cùng. */
    tourCanvasDelete: (stageId) => {
      const cur = tour()
      const stage = cur.stages.find((s) => s.id === stageId)
      if (!stage || stage.status !== 'pending') return false
      const siblings = cur.stages.filter((s) => s.eventId === stage.eventId)
      if (stage.seq === 1 && siblings.length > 1) { toast(t('tournament.canvas.errDeleteSource')); return false }
      const links = (cur.stageLinks || []).filter((l) => l.fromStageId === stageId || l.toStageId === stageId)
      const ev = cur.events.find((e) => e.id === stage.eventId)
      return run(async () => {
        if (links.length) await write('tournament_stage_links', 'delete', links.map((l) => l.id))
        await write('tournament_stages', 'delete', [stageId])
        await markCustom(ev)
      })
    },

    /** "Lưu làm mẫu CLB": lưu hình sơ đồ của nội dung (khối + đường nối) để lần sau dựng lại 1 bước. */
    tourSaveClubTemplate: (eventId, name) => {
      const cur = tour()
      const stages = cur.stages.filter((s) => s.eventId === eventId)
      if (!stages.length || !name?.trim()) return false
      const row = { id: uid(), clubId: cur.clubId, name: name.trim(), graph: graphOf(stages, cur.stageLinks || []), createdBy: myMember(db())?.id || null }
      return run(() => write('tournament_templates', 'insert', [row]), 'tournament.toast.templateSaved', { name: row.name })
    },

    tourDeleteClubTemplate: (id) => run(() => write('tournament_templates', 'delete', [id]), 'tournament.toast.templateDeleted'),

    /**
     * "Tạo nhanh sơ đồ" (canvas): dựng lại toàn bộ sơ đồ từ mẫu + cách chia đội vào bảng
     * ('snake' rắn theo rating · 'draw' bốc thăm · 'empty' để trống tự kéo).
     */
    tourQuickBuild: (eventId, templateKey, { numGroups, advance, fill = 'snake' } = {}) => {
      const cur = tour()
      if (cur.stages.some((s) => s.eventId === eventId && s.status !== 'pending')) { toast(t('tournament.err.scheduleExists')); return false }
      const ids = shuffle(eventTeams(cur, eventId).filter((x) => x.full).map((x) => x.id))
      const G = numGroups || 1
      const manualGroups = fill === 'empty' ? Array.from({ length: G }, () => [])
        : fill === 'draw' ? Array.from({ length: G }, (_, g) => ids.filter((_, i) => i % G === g)) : null
      return synced(run(() => replaceFormat(eventId, templateKey, { numGroups: G, advancePerGroup: advance || 2, manualGroups }), 'tournament.toast.formatSaved'))
    },

    /**
     * "Xong · tạo lại nhánh" (thanh Thiết lập nhánh) và kéo đổi chỗ đội vòng đầu: xoá lịch giai đoạn → sửa → sinh lại.
     * Chỉ khi nhánh CHƯA trận nào có kết quả / đang đánh (DB cũng chặn: `stageHasResults`).
     *   patch: ghép vào giai đoạn (luật, tranh hạng 3, cách xếp).
     *   order: thứ tự đội vòng đầu (từ `swapOrder`) → số bốc thăm + xếp kiểu 'slot' (chỉ giai đoạn đầu).
     */
    tourRestage: async (stageId, { patch = {}, order = null } = {}) => {
      const cur = tour()
      const stage = cur.stages.find((s) => s.id === stageId)
      if (!stage || stage.type !== 'knockout') return false
      if (!stageEditable(cur.matches, stageId)) { toast(t('tournament.bracket.restageBlocked')); return false }
      if (order && stage.seq !== 1) return false
      try {
        await tournamentRpc('tournament_reset_stage', { p_stage: stageId, p_reason: t('tournament.bracket.restageReason') })
        const config = { ...stage.config, ...(patch.config || {}), ...(order ? { seeding: 'slot' } : {}) }
        await write('tournament_stages', 'upsert', [{ ...base(), ...stage, ...patch, config, status: 'pending' }])
        if (order) {
          const rows = order.map((id, i) => ({ ...cur.teams.find((x) => x.id === id), drawNo: i + 1 })).filter((x) => x.id)
          await write('tournament_teams', 'upsert', rows.map((x) => ({ ...base(), ...x })))
        }
        await reloadTour()
      } catch (e) {
        toast(tourErr(e))
        await reloadTour().catch(() => {})
        return false
      }
      return generate(stage.eventId, stage.seq)
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
      return synced(run(() => tournamentRpc('tournament_commit_match', {
        p_match: matchId, p_sets: sets, p_winner: winner, p_status: status, p_note: note,
      }), 'tournament.toast.committed'))
    },

    tourEditScore: (matchId, sets, reason) => {
      const check = applyEdit(tour().matches, { matchId, sets, reason })
      if (check.error) { toast(t(check.error)); return false }
      return run(() => tournamentRpc('tournament_edit_match', { p_match: matchId, p_sets: sets, p_reason: reason }), 'tournament.toast.edited')
    },

    tourUndo: (matchId, reason) => {
      const check = applyUndo(tour().matches, { matchId, reason })
      if (check.error) { toast(t(check.error)); return false }
      return synced(run(() => tournamentRpc('tournament_undo_match', { p_match: matchId, p_reason: reason }), 'tournament.toast.undone'))
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
      return synced(run(() => tournamentRpc('tournament_reset_stage', { p_stage: stage.id, p_reason: reason }), 'tournament.toast.resetDone'))
    },
  }

  /** Sinh trận của một giai đoạn (đội hình đã chốt). Dùng qua `tourGenerate`. */
  function generate(eventId, stageSeq) {
    const cur = tour()
    const stage = cur.stages.find((s) => s.eventId === eventId && s.seq === stageSeq)
    if (!stage) return toast(t('tournament.format.needFormat'))
    // Thể thức tự dựng trên canvas: sơ đồ phải sinh lịch được trọn (không để nhánh mồ côi giữa chừng).
    const evStages = cur.stages.filter((s) => s.eventId === eventId)
    const issue = graphIssue(evStages, cur.stageLinks || [])
    if (issue) return toast(t(issue))

    if (stage.type === 'round_robin') {
      const teams = eventTeams(cur, eventId)
      const full = teams.filter((x) => x.full)
      const numGroups = stage.config?.numGroups || 1
      // Mỗi bảng ≥ 2 đội, không thì có bảng không có trận nào và không chốt hạng được.
      if (full.length < numGroups * 2) return toast(t('tournament.format.tooFewForGroups', { n: numGroups * 2 }))
      // Chia tay trên canvas: phải xếp đủ mọi cặp, mỗi bảng ≥ 2 — không âm thầm chia rắn đè ý BTC.
      // Chưa chia tay thì chia rắn theo rating.
      const manual = stage.config?.manualGroups
      if (manual && !manualGroupsOk(manual, full.map((x) => x.id), numGroups)) return toast(t('tournament.canvas.errGroupsManual'))
      const rawGroups = groupsForStage(stage, full)
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
      return synced(run(() => tournamentRpc('tournament_generate_stage', { p_stage: stage.id, p_groups: groups, p_matches: matches }),
        'tournament.toast.generated', { n: matches.length }))
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
      // BTC tự xếp ai được ưu tiên/miễn trước (thay tự động theo hạng) — chỉ áp khi còn khớp đúng tập đội.
      entrants = applySeedOrder(res.entrants, stage.config?.seedOrder)
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
    return synced(run(() => tournamentRpc('tournament_generate_stage', { p_stage: stage.id, p_groups: [], p_matches: matches }),
      'tournament.toast.generated', { n: matches.filter((m) => m.status !== 'bye').length }))
  }

  /** Chốt đội hình: nội dung đơn lập mỗi người một đội, rồi khoá (DB trigger giữ khoá). Người gọi đã kiểm luật. */
  async function lockLineup(eventId) {
    const cur = tour()
    const ev = cur.events.find((e) => e.id === eventId)
    if (ev.teamSize === 1) {
      const loners = eventPlayers(cur, eventId).filter((p) => !p.teamId)
      const teams = loners.map(() => ({ ...base(), id: uid(), eventId, pinned: false, status: 'active' }))
      if (teams.length) {
        await write('tournament_teams', 'insert', teams)
        await write('tournament_team_players', 'insert', loners.map((p, i) => ({ ...base(), teamId: teams[i].id, eventId, registrationId: p.id })))
      }
    }
    await write('tournament_events', 'upsert', [{ ...ev, status: 'drawn' }])
  }

  /**
   * Trạng thái giải TỰ đi theo lịch thi đấu — BTC không phải bấm (làm gọn đăng ký):
   *   nhận đăng ký → đang diễn ra: khi có giai đoạn đầu tiên được sinh trận;
   *   đang diễn ra → kết thúc: khi mọi nội dung có kết quả cuối (`tourDone`) — nội dung xong cũng ghi `finished`;
   *   đi ngược khi hoàn tác / làm lại lịch (kết thúc → đang diễn ra → nhận đăng ký). Giải đã huỷ thì để yên.
   * Gọi SAU khi một thao tác ghi thành công (dữ liệu đã nạp lại).
   */
  async function syncStatus() {
    const cur = tour()
    if (!cur || cur.status === 'cancelled') return
    const scheduled = cur.stages.some((s) => s.status !== 'pending')
    const done = tourDone(cur)
    const want = done ? 'finished' : scheduled ? 'running' : 'registration'
    // Nội dung: xong → 'finished'; hoàn tác làm hết xong → về 'running'.
    const events = cur.events
      .map((e) => ({ e, done: eventDone(cur, e) }))
      .filter(({ e, done }) => (done ? e.status !== 'finished' : e.status === 'finished'))
      .map(({ e, done }) => ({ ...base(), ...e, status: done ? 'finished' : 'running' }))
    if (want === cur.status && !events.length) return
    try {
      if (events.length) await write('tournament_events', 'upsert', events)
      if (want !== cur.status) await write('tournaments', 'upsert', [{ ...cur, status: want }])
      await reloadTour()
      if (want === 'finished' && cur.status !== 'finished') toast(t('tournament.toast.finished'))
    } catch (e) {
      toast(tourErr(e))
    }
  }
  /** Chạy `syncStatus` sau một thao tác thành công; trả nguyên kết quả của thao tác. */
  async function synced(p) {
    const ok = await p
    if (ok) await syncStatus()
    return ok
  }

  /** Thay toàn bộ giai đoạn + link của nội dung theo mẫu (chỉ khi chưa giai đoạn nào có lịch — người gọi kiểm). */
  async function replaceFormat(eventId, templateKey, custom = {}) {
    const cur = tour()
    const ev = cur.events.find((e) => e.id === eventId)
    if (!ev) return
    const oldStages = cur.stages.filter((s) => s.eventId === eventId)
    const oldIds = new Set(oldStages.map((s) => s.id))
    const oldLinks = (cur.stageLinks || []).filter((l) => oldIds.has(l.fromStageId) || oldIds.has(l.toStageId))
    // Mẫu CLB ('club:<id>') dựng từ sơ đồ đã lưu; mẫu có sẵn dựng bằng buildTemplateStages.
    const clubTpl = templateKey.startsWith('club:') ? (cur.templates || []).find((x) => 'club:' + x.id === templateKey) : null
    const { stages, links } = clubTpl ? stagesFromGraph(clubTpl.graph) : buildTemplateStages(templateKey, ev, custom)
    if (custom.manualGroups !== undefined && stages[0]?.type === 'round_robin') {
      stages[0] = { ...stages[0], config: { ...stages[0].config, manualGroups: custom.manualGroups } }
    }
    // Luật gợi ý (hộp Gợi ý thể thức): vòng loại cho mọi giai đoạn, chung kết + 3-4 cho nhánh loại.
    if (custom.rules) {
      const q = RULE_PRESETS[custom.rules.qualify]
      const f = RULE_PRESETS[custom.rules.final]
      stages.forEach((s, i) => {
        stages[i] = { ...s, matchRule: q ? { ...q } : s.matchRule, ruleOverrides: s.type === 'knockout' && f ? { ...s.ruleOverrides, final: { ...f }, third: { ...f } } : s.ruleOverrides }
      })
    }
    const newStages = stages.map((s) => ({ ...base(), ...s, id: uid(), eventId }))
    const idOfSeq = Object.fromEntries(newStages.map((s) => [s.seq, s.id]))
    const newLinks = links.map((l) => ({ ...base(), id: uid(), fromStageId: idOfSeq[l.fromStageSeq], toStageId: idOfSeq[l.toStageSeq], ranks: l.ranks }))
    if (oldLinks.length) await write('tournament_stage_links', 'delete', oldLinks.map((l) => l.id))
    if (oldStages.length) await write('tournament_stages', 'delete', oldStages.map((s) => s.id))
    await write('tournament_stages', 'insert', newStages)
    if (newLinks.length) await write('tournament_stage_links', 'insert', newLinks)
    await write('tournament_events', 'upsert', [{ ...base(), ...ev, templateKey: clubTpl ? 'custom' : templateKey }])
  }

  /** Nội dung sửa trên canvas → mẫu 'custom' (tab Thể thức không tự đè thể thức tự dựng). */
  async function markCustom(ev) {
    if (ev && ev.templateKey !== 'custom') await write('tournament_events', 'upsert', [{ ...base(), ...ev, templateKey: 'custom' }])
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
