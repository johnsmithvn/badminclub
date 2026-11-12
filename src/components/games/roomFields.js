import { BOARD_POINTS, NO_STAKE, buyinsOf, stakeOf } from '#lib/games/registry.js'
import { DICTS as NOITU_DICTS, REPEATS as NOITU_REPEATS, TIMES as NOITU_TIMES } from '#lib/games/noitu.js'
import { SIZES as COVAY_SIZES } from '#lib/games/covay.js'
import { MODES as XO_MODES } from '#lib/games/xo.js'
import { DAY_TIMES as MASOI_TIMES, REVEALS as MASOI_REVEALS, GUARD, SEER, WITCH, WOLF, isWolf, lineupOf } from '#lib/games/masoi.js'
import { TIMES as BAIBIP_TIMES } from '#lib/games/baibip.js'
import { LEADS as TIENLEN_LEADS, TIMES as TIENLEN_TIMES, VARIANTS as TIENLEN_VARIANTS } from '#lib/games/tienlen.js'
import { LAPS as BAUCUA_LAPS, TIMES as BAUCUA_TIMES } from '#lib/games/baucua.js'
import { TIMES as LOTO_TIMES } from '#lib/games/loto.js'
import { LAPS as XIDACH_LAPS, TIMES as XIDACH_TIMES } from '#lib/games/xidach.js'
import { QUANS as OQ_QUANS, ROWS as OQ_ROWS, STONES as OQ_STONES, TIMES as OQ_TIMES } from '#lib/games/oanquan.js'
import { CLOCKS } from '#lib/games/chessClock.js'
import { t } from '#i18n'
import cfg from '#config/app.js'

// Tuỳ chọn phòng của từng game — một nguồn cho cả form Tạo phòng (Games.jsx) lẫn khung Luật bàn / Sửa luật ở phòng
// chờ (WaitingRoom.jsx). `fieldsOf` trả danh sách trường; <RoomOptions> vẽ thành form, `rulesOf` đọc thành các dòng
// "nhãn — giá trị". Thêm tuỳ chọn mới cho game nào thì thêm ở đây là cả hai chỗ cùng thấy.

// Game có đồng hồ / số vòng chọn lúc tạo phòng: chữ ở games.<id>.time · timeOpt · timeNone (0 = tắt) · laps · lapsOpt.
const TIME_OPTS = { baucua: BAUCUA_TIMES, loto: LOTO_TIMES, xidach: XIDACH_TIMES, oanquan: OQ_TIMES, tienlen: TIENLEN_TIMES }
const LAP_OPTS = { baucua: BAUCUA_LAPS, xidach: XIDACH_LAPS }
const MASOI_CUSTOM = [WOLF, WOLF, SEER, GUARD, WITCH]
const CHESS = ['covua', 'cotuong']

const sel = (key, label, value, options, set, hint) => ({ type: 'select', key, label, value: String(value), options, set, hint })
const sw = (key, label, value, set, hint) => ({ type: 'switch', key, label, value: !!value, set, hint })
const nums = (list, label) => list.map((n) => ({ value: String(n), label: label(n) }))

/** Các trường tuỳ chọn của game. `set(patch)` gộp vào options. Không gồm mức cược (xem `stake` trong RoomOptions). */
export function fieldsOf(gameId, opts, set) {
  const f = []
  const num = (key) => (e) => set({ [key]: Number(e.target.value) })
  if (gameId === 'caro') {
    // Chỉ bàn lớn, 5 quân thắng — bàn 3 × 3 đã tách thành Cờ X-O (0107).
    f.push(sel('size', t('games.caro.size'), opts.size, nums(cfg.games.caroSizes, (n) => t('games.caro.sizeOpt', { n })), num('size')))
    f.push(sw('blockedEnds', t('games.caro.blockedEnds'), opts.blockedEnds, (e) => set({ blockedEnds: e.target.checked }), t('games.caro.blockedEndsHint')))
    f.push(sw('exact', t('games.caro.exact'), opts.exact, (e) => set({ exact: e.target.checked }), t('games.caro.exactHint')))
  }
  if (gameId === 'xo') {
    f.push(sel('mode', t('games.xo.mode'), opts.mode, XO_MODES.map((v) => ({ value: v, label: t('games.xo.modeOpt.' + v) })), (e) => set({ mode: e.target.value })))
  }
  if (gameId === 'oanquan') {
    f.push(sel('quans', t('games.oanquan.quans'), opts.quans, OQ_QUANS.map((n) => ({ value: String(n), label: t('games.oanquan.quansOpt.' + n) })), num('quans')))
    f.push(sel('rows', t('games.oanquan.rows'), opts.rows, nums(OQ_ROWS, (n) => t('games.oanquan.rowsOpt', { n })), num('rows')))
    f.push(sel('stones', t('games.oanquan.stones'), opts.stones, nums(OQ_STONES, (n) => t('games.oanquan.stonesOpt', { n })), num('stones')))
    f.push(sw('nhon', t('games.oanquan.nhon'), opts.nhon, (e) => set({ nhon: e.target.checked }), t('games.oanquan.nhonHint')))
  }
  if (gameId === 'chamo') {
    f.push(sel('size', t('games.chamo.size'), opts.size, nums(cfg.games.chamoSizes, (n) => t('games.chamo.sizeOpt', { n, lines: 2 * n * (n + 1) })), num('size')))
  }
  if (gameId === 'covay') {
    f.push(sel('size', t('games.covay.size'), opts.size, COVAY_SIZES.map((n) => ({ value: String(n), label: t('games.covay.sizeOpt.' + n) })), num('size')))
  }
  if (CHESS.includes(gameId)) {
    f.push(sel('clock', t('games.clock'), opts.clock || 0, nums([0, ...CLOCKS], (n) => (n ? t('games.clockOpt', { n }) : t('games.clockNone'))), num('clock'), t('games.clockHint')))
  }
  if (gameId === 'noitu') {
    f.push(sel('lang', t('games.noitu.lang'), opts.lang, ['vi', 'en'].map((v) => ({ value: v, label: t(v === 'vi' ? 'games.noitu.langVi' : 'games.noitu.langEn') })), (e) => set({ lang: e.target.value })))
    if (opts.lang === 'en') f.push(sel('link', t('games.noitu.link'), opts.link, nums([1, 2], (n) => t('games.noitu.linkOpt', { n })), num('link')))
    f.push(sel('time', t('games.noitu.time'), opts.time, nums(NOITU_TIMES, (n) => t('games.noitu.timeOpt', { n })), num('time')))
    if (opts.lang !== 'en') {
      f.push(sel('dict', t('games.noitu.dict'), opts.dict, NOITU_DICTS.map((v) => ({ value: v, label: t('games.noitu.dictOpt.' + v) })), (e) => set({ dict: e.target.value })))
      if (opts.dict !== 'vote') f.push(sw('cut', t('games.noitu.cut'), opts.cut, (e) => set({ cut: e.target.checked }), t('games.noitu.cutHint')))
      f.push(sw('flip', t('games.noitu.flip'), opts.flip !== false, (e) => set({ flip: e.target.checked }), t('games.noitu.flipHint')))
    }
    f.push(sel('repeat', t('games.noitu.repeat'), opts.repeat, NOITU_REPEATS.map((n) => ({ value: String(n), label: t('games.noitu.repeatOpt.' + n) })), num('repeat')))
  }
  if (gameId === 'masoi') {
    f.push(sel('reveal', t('games.masoi.reveal'), opts.reveal, MASOI_REVEALS.map((v) => ({ value: v, label: t('games.masoi.revealOpt.' + v) })), (e) => set({ reveal: e.target.value })))
    f.push(sel('time', t('games.masoi.time'), opts.time, nums(MASOI_TIMES, (n) => (n ? t('games.masoi.timeOpt', { n }) : t('games.masoi.timeNone'))), num('time')))
    f.push(sel('deck', t('games.masoi.deck'), opts.roles ? 'custom' : 'auto',
      [{ value: 'auto', label: t('games.masoi.deckAuto') }, { value: 'custom', label: t('games.masoi.deckCustom') }],
      (e) => set({ roles: e.target.value === 'custom' ? MASOI_CUSTOM : undefined })))
    if (opts.roles) f.push({ type: 'roles', key: 'roles', label: t('games.masoi.specialsLabel'), text: lineupOf(opts.roles) })
  }
  if (gameId === 'tienlen') {
    f.push(sel('variant', t('games.tienlen.variant'), opts.variant, TIENLEN_VARIANTS.map((v) => ({ value: v, label: t('games.tienlen.variantOpt.' + v) })), (e) => set({ variant: e.target.value })))
    f.push(sel('lead', t('games.tienlen.lead'), opts.lead, TIENLEN_LEADS.map((v) => ({ value: v, label: t('games.tienlen.leadOpt.' + v) })), (e) => set({ lead: e.target.value })))
  }
  if (gameId === 'baibip') {
    f.push(sel('time', t('games.baibip.time'), opts.time, nums(BAIBIP_TIMES, (n) => (n ? t('games.baibip.timeOpt', { n }) : t('games.baibip.timeNone'))), num('time')))
  }
  if (TIME_OPTS[gameId]) {
    f.push(sel('time', t('games.' + gameId + '.time'), opts.time ?? 0, nums(TIME_OPTS[gameId], (n) => (n ? t('games.' + gameId + '.timeOpt', { n }) : t('games.' + gameId + '.timeNone'))), num('time')))
  }
  if (LAP_OPTS[gameId]) {
    f.push(sel('laps', t('games.' + gameId + '.laps'), opts.laps, nums(LAP_OPTS[gameId], (n) => t('games.' + gameId + '.lapsOpt', { n })), num('laps')))
  }
  return f
}

/** Đọc tuỳ chọn thành các dòng [nhãn, giá trị] cho khung Luật bàn. */
export function rulesOf(gameId, opts) {
  const rows = fieldsOf(gameId, opts, () => {}).map((x) => [x.label,
    x.type === 'switch' ? t(x.value ? 'games.wait.on' : 'games.wait.off')
      : x.type === 'roles' ? x.text
        : x.options.find((o) => o.value === x.value)?.label ?? x.value])
  if (!NO_STAKE.includes(gameId)) {
    const n = stakeOf(opts)
    rows.push([t(BOARD_POINTS.includes(gameId) ? 'games.coins.pointValue' : 'games.coins.stake'), n ? t('games.coins.stakeOpt', { n }) : t('games.coins.noStake')])
  }
  return rows
}

/** Ma sói tự chọn mà không có Sói nào → chưa cho tạo / lưu. Ví thiếu xu cho mức cược đã chọn → chưa cho tạo. */
export const blockedOf = (gameId, opts, coins) => {
  if (gameId === 'masoi' && opts.roles && !opts.roles.some(isWolf)) return true
  const ins = buyinsOf(gameId, stakeOf(opts))
  return coins != null && ins.length > 0 && ins[0] > coins
}
