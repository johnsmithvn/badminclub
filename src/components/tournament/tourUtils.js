import { dd, wd } from '#utils/dates.js'
import { t } from '#i18n'
import { presetKeyOf } from '#lib/tournament/format.js'
import { playerName } from '#lib/money.js'

/** 'T7 · 16/08/2026 · An Bình · 2 sân · 08:00–12:00' — các mẩu thiếu thì bỏ, không để '· ·'. */
export function tourMeta(tour) {
  const time = [tour.startTime, tour.endTime].filter(Boolean).join('–')
  return [
    tour.startsOn && `${wd(tour.startsOn)} · ${dd(tour.startsOn)}/${tour.startsOn.slice(0, 4)}`,
    tour.venue,
    tour.courtLabels.length > 0 && t('tournament.hero.courts', { n: tour.courtLabels.length }),
    time,
  ].filter(Boolean).join(' · ')
}

/** Tên luật mẫu ('1 sec 30 · chạm'), luật không khớp mẫu nào thì 'Tuỳ chỉnh'. */
export function ruleLabel(rule) {
  const k = presetKeyOf(rule)
  return k ? t('tournament.format.preset.' + k) : t('tournament.format.custom')
}

/** Mã trận: TK1, BK2 — chung kết và 3-4 chỉ có một trận nên không đánh số. */
export function matchCode(m) {
  const head = t('tournament.code.' + m.roundKind)
  return m.roundKind === 'final' || m.roundKind === 'third' ? head : head + (m.slot + 1)
}

/** Tên đội = tên các VĐV nối ' / ' (đội chưa xác định → null). */
export function teamName(tour, db, teamId) {
  if (!teamId) return null
  const regs = new Map(tour.registrations.map((r) => [r.id, r]))
  const names = tour.teamPlayers
    .filter((p) => p.teamId === teamId)
    .map((p) => regs.get(p.registrationId))
    .filter(Boolean)
    .map((r) => playerName(db, r.playerId))
  return names.length ? names.join(' / ') : t('common.unknown')
}

/** Khoá bản nháp bảng điểm trên máy trọng tài (plan §4.5). */
export const draftKey = (matchId) => 'tourScore:' + matchId
