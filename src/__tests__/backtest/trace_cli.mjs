// CLI truy vết điểm mùa — chạy qua run.mjs khi file là "Xuất dữ liệu truy vết" (schema badminclub_trace).
// KHÔNG phải file test, `npm test` không nhặt.
//
//   npm run backtest -- truy_vet.json                                   bảng điểm hiện tại
//   npm run backtest -- truy_vet.json --at "2026-10-16 14:00"           bảng điểm lúc đó
//   npm run backtest -- truy_vet.json --at "2026-10-16 14:00" --vs-at "2026-10-16 16:00"
//                                                                       ai đổi bao nhiêu, VÌ lần ghi nào
//   thêm  --season 2026-Q4   chọn mùa (mặc định: mùa chứa mốc)
//         --who "Canh"       chỉ in người có tên bắt đầu bằng chữ này
//         --top 20           số dòng bảng điểm (mặc định 15)
//
// Giờ gõ dạng "YYYY-MM-DD HH:mm" hiểu theo giờ CLB (app.json → trace.timezone).
// Chỉ tua được về sau lúc chạy migration 0070 — trước đó không có lịch sử.

import { boardOf, explainChange, parseAt, rewind } from '#lib/trace.js'
import cfg from '#config/app.json' with { type: 'json' }

const offMin = (() => {
  const m = String(cfg.trace?.timezone || '+00:00').match(/^([+-])(\d{2}):(\d{2})$/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
})()
const local = (ts) => {
  const d = new Date((typeof ts === 'number' ? ts : Date.parse(ts)) + offMin * 60000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}
const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n)
const pad = (s, n) => String(s).slice(0, n).padEnd(n)

export function runTraceCli(data, args) {
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
  const tables = data.tables || {}
  const audit = data.audit || []
  const nameOf = new Map([
    ...(tables.club_members || []).map((m) => [m.id, m.name]),
    ...(tables.guests || []).map((g) => [g.id, g.name]),
  ])
  const actorOf = new Map((tables.club_members || []).filter((m) => m.user_id).map((m) => [m.user_id, m.name]))
  const who = flag('--who')
  const top = Number(flag('--top')) || 15
  const seasonId = flag('--season')
  const nm = (id) => nameOf.get(id) || String(id).slice(0, 8)

  const first = audit.length ? audit.reduce((a, e) => Math.min(a, Date.parse(e.changed_at)), Infinity) : null
  console.log(`File truy vết ${data.clubName || data.clubCode || ''} · xuất ${local(data.exportedAt)} · ${audit.length} dòng lịch sử`
    + (first ? ` (sớm nhất ${local(first)})` : ' — KHÔNG có lịch sử, chỉ xem được hiện tại'))

  const atText = flag('--at')
  const vsText = flag('--vs-at')
  const nowMs = Date.parse(data.exportedAt) || Date.now()
  const atMs = atText ? parseAt(atText) : nowMs
  if (!Number.isFinite(atMs)) return console.error(`Không đọc được mốc --at "${atText}"`)
  if (first != null && atMs < first) console.log(`⚠ Mốc ${local(atMs)} trước lịch sử sớm nhất — dữ liệu là trạng thái sớm nhất còn giữ.`)

  if (!vsText) {
    const b = boardOf(rewind(tables, audit, atMs), atMs, seasonId)
    if (!b.season) return console.log('Không tìm thấy mùa giải chứa mốc này.')
    console.log(`\n=== Bảng điểm mùa ${b.season.code || b.season.id} lúc ${local(atMs)} ===`)
    b.rows.filter((r) => !who || r.name.startsWith(who)).slice(0, who ? undefined : top)
      .forEach((r, i) => console.log(`${String(i + 1).padStart(3)}. ${pad(r.name, 24)} ${String(r.points).padStart(5)}  · ${r.matches} trận, ${r.wins} thắng`))
    return
  }

  const vsMs = parseAt(vsText)
  if (!Number.isFinite(vsMs)) return console.error(`Không đọc được mốc --vs-at "${vsText}"`)
  const [fromMs, toMs] = atMs <= vsMs ? [atMs, vsMs] : [vsMs, atMs]
  const r = explainChange(tables, audit, fromMs, toMs, seasonId)
  if (!r.season) return console.log('Không tìm thấy mùa giải chứa mốc này.')

  const describe = (s) => {
    const sides = (m) => {
      const ps = m.players || []
      const side = (team) => ps.filter((p) => p.team === team).map((p) => nm(p.player_id)).join(' + ') || '?'
      return `${side(0)} vs ${side(1)}`
    }
    const score = (m) => (Array.isArray(m.sets) ? m.sets.map((x) => x.join('–')).join(', ') : '')
    const kind = (m) => (m.challenge_id ? ' (kèo)' : '')
    const parts = []
    s.matchesDeleted.forEach((m) => parts.push(`Huỷ trận ${local(m.ended_at)} ${sides(m)} ${score(m)}${kind(m)}`))
    s.matchesAdded.forEach((m) => parts.push(`Ghi trận ${sides(m)} ${score(m)}${kind(m)}`))
    s.scoreEdits.forEach((e) => parts.push(`Sửa tỉ số ${JSON.stringify(e.old?.sets ?? e.old?.winner_team)} → ${JSON.stringify(e.new?.sets ?? e.new?.winner_team)}`))
    if (s.eloRewrites) parts.push(`Tính lại Elo — ${s.eloRewrites} trận đổi số Elo lưu trong trận`)
    s.levelChanges.forEach((l) => parts.push(`Đổi trình độ ${nm(l.table === 'member_levels' ? l.id.split('|')[0] : l.id)}: ${l.from ?? '—'} → ${l.to ?? '—'}`))
    s.challengesDeleted.forEach((c) => parts.push(`Xoá kèo ${c.code || String(c.id).slice(0, 8)}`
      + (c.predictions.length ? ` — xoá theo ${c.predictions.length} phiếu cược (${c.predictions.map((p) => `${nm(p.member_id)} ${p.status} ${p.stake_points}`).join(', ')})` : '')))
    if (s.unlinkedFromChallenge) parts.push(`${s.unlinkedFromChallenge} trận thôi là kèo (mất hệ số kèo)`)
    if (s.predictions && !s.challengesDeleted.length) parts.push(`Phiếu cược đổi (${s.predictions} dòng)`)
    if (s.seasonConfig) parts.push('Đổi cấu hình mùa')
    if (!parts.length) parts.push(Object.entries(s.counts).map(([t, c]) => `${t} +${c.I}/~${c.U}/-${c.D}`).join(', '))
    return `${local(s.at)} · ${actorOf.get(s.actor) || (s.actor ? s.actor.slice(0, 8) : 'SQL/không rõ')} · ${parts.join('; ')}`
  }

  const before = new Map(r.before.rows.map((x) => [x.id, x]))
  const after = new Map(r.after.rows.map((x) => [x.id, x]))
  const ids = [...new Set([...before.keys(), ...after.keys()])]
    .map((id) => ({ id, b: before.get(id)?.points ?? 0, a: after.get(id)?.points ?? 0, name: (after.get(id) || before.get(id)).name }))
    .filter((x) => x.a !== x.b && (!who || x.name.startsWith(who)))
    .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))

  console.log(`\n=== Mùa ${r.season.code || r.season.id} · ${local(fromMs)} → ${local(toMs)} · ${r.steps.length} lần ghi làm đổi điểm ===`)
  if (!ids.length) console.log('Không ai đổi điểm mùa.')
  ids.forEach((x) => {
    console.log(`\n${pad(x.name, 24)} ${String(x.b).padStart(5)} → ${String(x.a).padStart(5)}  (${sign(x.a - x.b)})`)
    r.steps.filter((s) => s.deltas[x.id]).sort((p, q) => Math.abs(q.deltas[x.id]) - Math.abs(p.deltas[x.id]))
      .forEach((s) => console.log(`   ${sign(s.deltas[x.id]).padStart(5)}  ${describe(s.summary)}`))
  })
}
