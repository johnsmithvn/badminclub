// node src/__tests__/sync/tournament_map.test.js
//
// Kiểm tra ánh xạ 2 chiều giữa client camelCase và Postgres snake_case cho module Giải đấu.
// ĐẶC BIỆT QUAN TRỌNG: Đảm bảo bảng giải đấu KHÔNG bao giờ lọt vào TABLES / diff() (Quyết định D5 & Plan §4.1).

import assert from 'node:assert/strict'
import { TABLES, toTour, toTourMatch, toTourMatchEdit, tourRows } from '#contexts/dbmap.js'

/* ---------- 1. CHẶN TÁI PHẠM D5: KHÔNG BẢNG GIẢI ĐẤU NÀO LỌT VÀO TABLES ---------- */

const tournamentTables = TABLES.filter((spec) => spec.table.startsWith('tournament'))
assert.equal(
  tournamentTables.length,
  0,
  'LỖI KIẾN TRÚC NGHIÊM TRỌNG: Bảng giải đấu ' +
    tournamentTables.map((t) => t.table).join(', ') +
    ' đã bị khai báo vào TABLES! Bảng giải đấu phải được nạp và ghi riêng, không qua diff().'
)

/* ---------- 2. KIỂM TRA toTour VÀ CÁC SUB-MAPPER ---------- */

const rawMock = {
  tournament: {
    id: 't-1',
    club_id: 'c-1',
    name: 'Giải Đấu Mùa Thu',
    starts_on: '2026-10-15',
    start_time: '08:30:00',
    end_time: '18:00:00',
    venue: 'Sân Cầu Lông Tân Bình',
    court_labels: ['Sân 1', 'Sân 2'],
    scope: 'club_only',
    status: 'draft',
    fee_male: 200000,
    fee_female: 150000,
    rules: [{ title: 'Quy định chung' }],
    created_by: 'm-1',
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T10:00:00Z',
    deleted_at: null,
  },
  events: [
    {
      id: 'ev-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      kind: 'md',
      team_size: 2,
      gender_rule: 'male',
      status: 'drawn',
      template_key: 'ko',
      note: 'Đôi nam',
      sort_order: 1,
    },
  ],
  stages: [
    {
      id: 'st-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      event_id: 'ev-1',
      seq: 1,
      type: 'knockout',
      title: 'Vòng Loại Trực Tiếp',
      status: 'pending',
      config: { thirdPlace: true },
      match_rule: { sets: 1, points: 30, winBy2: false, cap: 30 },
      rule_overrides: { final: { sets: 3, points: 15, winBy2: false, cap: 15 } },
    },
  ],
  stageLinks: [
    {
      id: 'stl-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      from_stage_id: 'st-1',
      to_stage_id: 'st-2',
      ranks: [1, 2],
    },
  ],
  registrations: [
    {
      id: 'reg-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      player_type: 'member',
      player_id: 'm-1',
      gender: 'nam',
      level: 'TB+',
      rating_snapshot: 550,
      fee: 200000,
      paid: true,
      paid_at: '2026-09-25T11:00:00Z',
      status: 'registered',
    },
  ],
  entries: [
    {
      club_id: 'c-1',
      tournament_id: 't-1',
      event_id: 'ev-1',
      registration_id: 'reg-1',
    },
  ],
  teams: [
    {
      id: 'tm-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      event_id: 'ev-1',
      seed: 1,
      draw_no: 1,
      pinned: true,
      name: 'Team Siêu Sao',
      status: 'active',
    },
  ],
  teamPlayers: [
    {
      club_id: 'c-1',
      tournament_id: 't-1',
      team_id: 'tm-1',
      event_id: 'ev-1',
      registration_id: 'reg-1',
    },
  ],
  groups: [
    {
      id: 'gr-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      stage_id: 'st-1',
      label: 'Bảng A',
      seq: 1,
    },
  ],
  groupTeams: [
    {
      club_id: 'c-1',
      tournament_id: 't-1',
      group_id: 'gr-1',
      team_id: 'tm-1',
      seed_in_group: 1,
      final_rank: null,
    },
  ],
  matches: [
    {
      id: 'm-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      event_id: 'ev-1',
      stage_id: 'st-1',
      group_id: null,
      round: 0,
      slot: 0,
      round_kind: 'sf',
      team_a_id: 'tm-1',
      team_b_id: 'tm-2',
      source_a: { kind: 'seed', n: 1 },
      source_b: { kind: 'seed', n: 4 },
      next_match_id: 'm-ck',
      next_side: 'A',
      loser_next_match_id: 'm-34',
      loser_next_side: 'A',
      rule: { sets: 1, points: 30, winBy2: false, cap: 30 },
      status: 'ready',
      sets: [],
      winner: null,
      result_note: null,
      seq_no: 1,
      court_label: 'Sân 1',
      started_at: null,
      finished_at: null,
      updated_at: '2026-09-25T12:00:00Z',
      updated_by: 'm-1',
    },
  ],
  matchEdits: [
    {
      id: 'ed-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      match_id: 'm-1',
      action: 'commit',
      old_sets: [],
      new_sets: [[30, 25]],
      old_winner: null,
      new_winner: 'A',
      reason: 'Trọng tài chốt',
      edited_by: 'm-1',
      edited_at: '2026-09-25T12:30:00Z',
    },
  ],
  prizes: [
    {
      id: 'pz-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      event_id: null,
      rank: 1,
      label: 'Giải Nhất',
      description: 'Cúp + Tiền thưởng',
      cash: 500000,
    },
  ],
  budgetLines: [
    {
      id: 'bl-1',
      club_id: 'c-1',
      tournament_id: 't-1',
      label: 'Tiền sân',
      amount: 1500000,
      sort_order: 1,
    },
  ],
}

const tour = toTour(rawMock)
assert.ok(tour, 'toTour phải trả về object giải đấu')
assert.equal(tour.id, 't-1')
assert.equal(tour.clubId, 'c-1')
assert.equal(tour.name, 'Giải Đấu Mùa Thu')
assert.equal(tour.startsOn, '2026-10-15')
assert.equal(tour.startTime, '08:30')
assert.equal(tour.endTime, '18:00')
assert.equal(tour.feeMale, 200000)
assert.equal(tour.feeFemale, 150000)
assert.equal(tour.events.length, 1)
assert.equal(tour.events[0].kind, 'md')
assert.equal(tour.stages.length, 1)
assert.equal(tour.stages[0].matchRule.points, 30)
assert.equal(tour.stageLinks.length, 1)
assert.deepEqual(tour.stageLinks[0].ranks, [1, 2])
assert.equal(tour.registrations.length, 1)
assert.equal(tour.registrations[0].ratingSnapshot, 550)
assert.equal(tour.registrations[0].paid, true)
assert.equal(tour.teams.length, 1)
assert.equal(tour.teams[0].pinned, true)
assert.equal(tour.matches.length, 1)
assert.equal(tour.matches[0].status, 'ready')
assert.equal(tour.matches[0].roundKind, 'sf')
assert.equal(tour.matches[0].teamAId, 'tm-1')
assert.equal(tour.matches[0].teamBId, 'tm-2')
assert.equal(tour.matches[0].nextMatchId, 'm-ck')
assert.equal(tour.matches[0].nextSide, 'A')
assert.equal(tour.matches[0].loserNextMatchId, 'm-34')
assert.equal(tour.matches[0].loserNextSide, 'A')
assert.equal(tour.matches[0].seqNo, 1)
assert.equal(tour.matchEdits.length, 1)
assert.equal(tour.matchEdits[0].action, 'commit')
assert.deepEqual(tour.matchEdits[0].newSets, [[30, 25]])
assert.equal(tour.matchEdits[0].newWinner, 'A')
assert.equal(tour.prizes.length, 1)
assert.equal(tour.prizes[0].cash, 500000)
assert.equal(tour.budgetLines.length, 1)
assert.equal(tour.budgetLines[0].amount, 1500000)

/* ---------- 3. KIỂM TRA tourRows (CLIENT → POSTGRES) ---------- */

// Tournaments
const tourRowsOut = tourRows('tournaments', [tour])
assert.equal(tourRowsOut.length, 1)
assert.equal(tourRowsOut[0].club_id, 'c-1')
assert.equal(tourRowsOut[0].fee_male, 200000)
assert.equal(tourRowsOut[0].start_time, '08:30')

// Events
const evRowsOut = tourRows('tournament_events', tour.events)
assert.equal(evRowsOut[0].team_size, 2)
assert.equal(evRowsOut[0].gender_rule, 'male')

// Stages
const stRowsOut = tourRows('tournament_stages', tour.stages)
assert.equal(stRowsOut[0].match_rule.points, 30)
assert.equal(stRowsOut[0].event_id, 'ev-1')

// Stage Links
const stlRowsOut = tourRows('tournament_stage_links', tour.stageLinks)
assert.deepEqual(stlRowsOut[0].ranks, [1, 2])

// Registrations
const regRowsOut = tourRows('tournament_registrations', tour.registrations)
assert.equal(regRowsOut[0].player_id, 'm-1')
assert.equal(regRowsOut[0].paid, true)
assert.equal(regRowsOut[0].rating_snapshot, 550)

// Teams
const tmRowsOut = tourRows('tournament_teams', tour.teams)
assert.equal(tmRowsOut[0].pinned, true)
assert.equal(tmRowsOut[0].draw_no, 1)

// Prizes
const pzRowsOut = tourRows('tournament_prizes', tour.prizes)
assert.equal(pzRowsOut[0].cash, 500000)

// Budget lines
const blRowsOut = tourRows('tournament_budget_lines', tour.budgetLines)
assert.equal(blRowsOut[0].amount, 1500000)

console.log('Tournament mapping check: OK')
