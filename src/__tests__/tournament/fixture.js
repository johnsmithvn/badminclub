// Dữ liệu mẫu cho test giao diện giải đấu — đúng hình dạng `toTour()` (dbmap) trả về.
// Dựa trên giải mùa 1 (Masters Phú Khê 2026). Chỉ test import; app không import file này (RULES §3.4).

export const LEVELS = ['Newbie', 'TBY', 'TB-', 'TB']

export const members = [
  { id: 'm1', name: 'Nguyễn Văn An', gender: 'nam', level: 'TB', active: true },
  { id: 'm2', name: 'Trần Bình', gender: 'nam', level: 'TB-', active: true },
  { id: 'm3', name: 'Lê Thị Cúc', gender: 'nu', level: 'TBY', active: true },
  { id: 'm4', name: 'Phạm Dung', gender: 'nu', level: 'TB', active: true },
  { id: 'm5', name: 'Hoàng Em', gender: 'nam', level: 'Newbie', active: true },
]

export const db = {
  clubId: 'c1', month: '2026-08', levels: LEVELS, members, guests: [], viewAs: 'owner', playerRatings: {},
}

const reg = (id, playerId, gender, p = {}) => ({
  id, clubId: 'c1', tournamentId: 't1', playerType: 'member', playerId, gender, level: 'TB',
  ratingSnapshot: 500, fee: gender === 'nam' ? 200000 : 150000, paid: false, paidAt: null, status: 'registered', ...p,
})
const ev = (id, kind, teamSize, genderRule, status = 'draft') => ({
  id, clubId: 'c1', tournamentId: 't1', kind, teamSize, genderRule, status, templateKey: null, note: '', sortOrder: 0,
})

export function tour(p = {}) {
  return {
    id: 't1', clubId: 'c1', name: 'Giải Masters Phú Khê 2026', startsOn: '2026-08-16', startTime: '08:00', endTime: '12:00',
    venue: 'Sân An Bình', courtLabels: ['Sân 20', 'Sân 21'], scope: 'club_only', status: 'registration',
    feeMale: 200000, feeFemale: 150000, rules: ['Có mặt trước giờ thi đấu 10 phút'], createdBy: null, deletedAt: null,
    events: [ev('e-md', 'md', 2, 'male'), ev('e-wd', 'wd', 2, 'female', 'drawn'), ev('e-xd', 'xd', 2, 'mixed')],
    stages: [], stageLinks: [],
    registrations: [
      reg('r1', 'm1', 'nam', { paid: true }), reg('r2', 'm2', 'nam'), reg('r3', 'm3', 'nu', { paid: true }),
      reg('r4', 'm4', 'nu'), reg('r5', 'm5', 'nam', { status: 'withdrawn', paid: true }),
    ],
    entries: [
      { eventId: 'e-md', registrationId: 'r1' }, { eventId: 'e-md', registrationId: 'r2' },
      { eventId: 'e-wd', registrationId: 'r3' }, { eventId: 'e-xd', registrationId: 'r1' },
    ],
    teams: [], teamPlayers: [], groups: [], groupTeams: [], matches: [], matchEdits: [],
    prizes: [
      { id: 'p1', rank: 1, label: 'Nhất', description: 'Huy chương vàng', cash: 200000, eventId: null },
      { id: 'p2', rank: 2, label: 'Nhì', description: '', cash: 150000, eventId: null },
    ],
    budgetLines: [{ id: 'b1', label: 'Thuê sân', amount: 640000, sortOrder: 0 }],
    ...p,
  }
}
