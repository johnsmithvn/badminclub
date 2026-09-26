import { dd, wd } from '#utils/dates.js'
import { t } from '#i18n'
import { presetKeyOf } from '#lib/tournament/format.js'
import { regName } from '#lib/tournament/hub.js'
import { stageLabelKey } from '#lib/tournament/flow.js'

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
  if (k) return t('tournament.format.preset.' + k)
  if (!rule?.sets || !rule?.points) return t('tournament.format.custom')
  // Luật tự chỉnh: mô tả đúng như luật mẫu ("3 sec 25 · cách 2, trần 30"), không chỉ ghi "Tuỳ chỉnh".
  return t('tournament.format.ruleDesc', { sets: rule.sets, points: rule.points })
    + (rule.winBy2 ? t('tournament.format.ruleBy2', { cap: rule.cap }) : t('tournament.format.ruleTouch'))
}

/** Mã trận: TK1, BK2 — chung kết và 3-4 chỉ có một trận nên không đánh số. */
export function matchCode(m) {
  const head = t('tournament.code.' + m.roundKind)
  if (m.roundKind === 'final' || m.roundKind === 'third') return head
  // Vòng bảng: slot đánh lại từ 0 mỗi lượt → thêm lượt vào mã, không thì hai trận khác lượt trùng mã.
  return m.roundKind === 'group' ? `${head}${m.round + 1}.${m.slot + 1}` : head + (m.slot + 1)
}

/** Tên đội = tên các VĐV nối ' / ' (đội chưa xác định → null). */
export function teamName(tour, db, teamId) {
  if (!teamId) return null
  const regs = new Map(tour.registrations.map((r) => [r.id, r]))
  const names = tour.teamPlayers
    .filter((p) => p.teamId === teamId)
    .map((p) => regs.get(p.registrationId))
    .filter(Boolean)
    .map((r) => regName(tour, db, r))
  return names.length ? names.join(' / ') : t('common.unknown')
}

/** Khoá bản nháp bảng điểm trên máy trọng tài (plan §4.5). */
export const draftKey = (matchId) => 'tourScore:' + matchId

/** Tên giai đoạn hiển thị: tên BTC đặt trên sơ đồ, không có thì tên theo vai (vòng bảng / nhánh chính / phụ). */
export function stageName(stage, eventStages) {
  return stage.title || t(stageLabelKey(stage, eventStages))
}

/**
 * Nhãn "hạng nào đi tiếp" trên mũi tên sơ đồ: 1 hạng · dải liền (Hạng 1–2) · rời (Hạng 1, 3) ·
 * "mọi đội còn lại" (lấy thừa nhiều hạng, > 6) → "Hạng 3 trở xuống".
 */
export function rankLabel(ranks) {
  const r = [...ranks].sort((a, b) => a - b)
  if (!r.length) return ''
  if (r.length > 6) return t('tournament.flow.ranksFrom', { n: r[0] })
  if (r.length === 1) return t('tournament.flow.rank', { n: r[0] })
  const contiguous = r.every((x, i) => i === 0 || x === r[i - 1] + 1)
  return contiguous ? t('tournament.flow.ranksRange', { a: r[0], b: r[r.length - 1] }) : t('tournament.flow.rank', { n: r.join(', ') })
}
