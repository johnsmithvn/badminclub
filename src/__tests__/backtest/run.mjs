// CLI backtest — KHÔNG phải file test, `npm test` không nhặt (chỉ glob *.test.js).
//
//   npm run backtest -- <duong-dan.json>                  xem bộ số hiện tại
//   npm run backtest -- <duong-dan.json> --save <moc.json> lưu làm mốc
//   npm run backtest -- <duong-dan.json> --vs   <moc.json> so với mốc
//
// Quy trình khi đổi công thức Elo hoặc thang điểm mùa:
//   1. TRƯỚC khi sửa:  --save baseline.json
//   2. Sửa công thức
//   3. Sau khi sửa:    --vs baseline.json    -> hiện đúng ai đổi, đổi bao nhiêu

import fs from 'node:fs'
import { runBacktest, diffBacktest } from '#lib/backtest.js'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }

if (!file) {
  console.error('Thiếu đường dẫn file trận (.json xuất từ trang Trận đấu).')
  console.error('  npm run backtest -- ./tran_dau.json [--save moc.json] [--vs moc.json]')
  process.exit(1)
}

const snap = runBacktest(JSON.parse(fs.readFileSync(file, 'utf8')))
const savePath = flag('--save')
const vsPath = flag('--vs')

if (savePath) {
  fs.writeFileSync(savePath, JSON.stringify(snap, null, 2) + '\n')
  console.log(`Đã lưu mốc: ${savePath}  (${snap.dataset.matches} trận · ${snap.elo.length} hội viên)`)
  process.exit(0)
}

const n = (x) => (x > 0 ? '+' : '') + x

if (vsPath) {
  const d = diffBacktest(JSON.parse(fs.readFileSync(vsPath, 'utf8')), snap)
  if (d.identical) {
    console.log('KHÔNG ĐỔI — bộ số trùng khít với mốc.')
    process.exit(0)
  }
  if (d.stats.length) {
    console.log('=== CHỈ SỐ TỔNG ===')
    d.stats.forEach((s) => console.log(`  ${s.key.padEnd(18)} ${JSON.stringify(s.before)} → ${JSON.stringify(s.after)}${s.delta != null ? `  (${n(s.delta)})` : ''}`))
  }
  if (d.elo.length) {
    console.log(`\n=== ELO ĐỔI (${d.elo.length} người) ===`)
    d.elo.forEach((r) => console.log(`  ${r.name.padEnd(20)} ${Object.entries(r.changed).map(([f, v]) => `${f} ${v.before}→${v.after} (${n(v.delta)})`).join(' · ')}`))
  }
  if (d.season.length) {
    console.log(`\n=== ĐIỂM MÙA ĐỔI (${d.season.length} người) ===`)
    d.season.forEach((r) => console.log(`  ${r.name.padEnd(20)} ${Object.entries(r.changed).map(([f, v]) => `${f} ${v.before}→${v.after} (${n(v.delta)})`).join(' · ')}`))
  }
  if (d.missing.length) {
    console.log(`\n=== CÓ Ở MỘT BÊN (${d.missing.length}) ===`)
    d.missing.forEach((m) => console.log(`  ${m.list} ${m.id} chỉ có ở ${m.onlyIn}`))
  }
  process.exit(0)
}

const s = snap.stats
console.log(`Bộ dữ liệu: ${snap.dataset.matches} trận · ${snap.dataset.sessions} buổi · ${snap.dataset.players} người`)
console.log('')
console.log('=== SỨC KHOẺ ELO ===')
console.log(`  Tổng điểm tự sinh/huỷ : ${n(s.eloDrift)}   (Elo chuẩn phải ≈ 0)`)
console.log(`  Chênh trong nội bộ đôi: median ${s.pairGapMedian} · p90 ${s.pairGapP90} · max ${s.pairGapMax}`)
console.log(`  Chênh giữa hai đội    : median ${s.teamGapMedian} · p90 ${s.teamGapP90} · max ${s.teamGapMax}`)
console.log('')
console.log('=== SỨC KHOẺ ĐIỂM MÙA ===')
console.log(`  Sàn 0 tạo thêm điểm   : ${n(s.clampGainTotal)} cho ${s.clampedPlayers} người   (thang replay được phải = 0)`)
console.log(`  Tổng upset            : ${s.totalUpsets}`)
console.log(`  Dải điểm đã dùng      : ${Object.entries(s.tierCounts).map(([k, v]) => `${k} ${v}`).join(' · ') || '(chưa có)'}`)
console.log('')
console.log('=== ELO (cao → thấp) ===')
;[...snap.elo].sort((a, b) => b.rating - a.rating).forEach((r) => {
  console.log(`  ${r.name.padEnd(20)} ${String(r.level).padEnd(5)} ${String(r.seed).padStart(4)} → ${String(r.rating).padStart(4)}  (${n(r.rating - r.seed)})  ${r.wins}–${r.losses}  K=${r.kFactor}`)
})
console.log('')
console.log('=== ĐIỂM MÙA (cao → thấp) ===')
;[...snap.season].sort((a, b) => b.points - a.points).forEach((r) => {
  console.log(`  ${r.name.padEnd(20)} ${String(r.points).padStart(4)}  thật ${String(r.rawPoints).padStart(4)}${r.clampGain ? `  sàn bù ${n(r.clampGain)}` : ''}  ${r.wins}–${r.losses}`)
})
