// node src/__tests__/dates.test.js
import assert from 'node:assert/strict'
import { addMonth, dd, ddmy, genDates, hours, monthGrid, monthOf, monthShort, monthTxt, wd, weekdayOf } from '#utils/dates.js'

/* nhãn ngày tháng */
assert.equal(wd('2026-08-16'), 'CN')
assert.equal(wd('2026-08-21'), 'T6')
assert.equal(weekdayOf('2026-08-16'), 0)
assert.equal(dd('2026-08-16'), '16/08')
assert.equal(ddmy('2026-08-16'), '16/08/2026')
assert.equal(monthOf('2026-08-16'), '2026-08')
assert.equal(monthTxt('2026-08'), 'Tháng 08/2026')
assert.equal(monthShort('2026-08'), '08/2026')

/* addMonth phải nhảy đúng qua biên năm */
assert.equal(addMonth('2026-08', 1), '2026-09')
assert.equal(addMonth('2026-12', 1), '2027-01')
assert.equal(addMonth('2026-01', -1), '2025-12')
assert.equal(addMonth('2026-08', 0), '2026-08')
assert.equal(addMonth('2026-08', -8), '2025-12')

/* giờ thập phân — nguồn của mọi phép tính tiền sân */
assert.equal(hours('18:00', '20:00'), 2)
assert.equal(hours('20:00', '22:00'), 2)
assert.equal(hours('18:30', '20:00'), 1.5)
assert.equal(hours('19:15', '21:45'), 2.5)

/* genDates: đúng thứ, đúng biên, không vượt trần 400 */
const sundays = genDates([0], '2026-08-01', '2026-08-31')
assert.deepEqual(sundays, ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30'])
assert.equal(genDates([0, 5], '2026-08-01', '2026-08-31').length, 9) // 5 CN + 4 T6
assert.deepEqual(genDates([], '2026-08-01', '2026-08-31'), [], 'không chọn thứ nào thì không sinh buổi')
assert.deepEqual(genDates([0], '', '2026-08-31'), [], 'thiếu ngày bắt đầu thì không sinh buổi')
assert.deepEqual(genDates([0], '2026-08-02', '2026-08-02'), ['2026-08-02'], 'start = end và trúng thứ')
assert.deepEqual(genDates([1], '2026-08-02', '2026-08-02'), [], 'start = end nhưng không trúng thứ')
assert.ok(genDates([0, 1, 2, 3, 4, 5, 6], '2020-01-01', '2030-01-01').length <= 400, 'phải chặn ở 400')

/* monthGrid: 6 tuần × 7 ngày, bắt đầu từ Chủ nhật, ngày 1 nằm đúng cột */
const grid = monthGrid('2026-08')
assert.equal(grid.length, 6)
assert.ok(grid.every((w) => w.length === 7))
assert.equal(grid[0][0].iso <= '2026-08-01', true, 'ô đầu không được vượt qua ngày 1')
assert.equal(weekdayOf(grid[0][0].iso), 0, 'tuần phải bắt đầu từ Chủ nhật')
const inMonth = grid.flat().filter((d) => d.inMonth)
assert.equal(inMonth.length, 31, 'tháng 8 có 31 ngày')
assert.equal(inMonth[0].iso, '2026-08-01')
assert.equal(inMonth[30].iso, '2026-08-31')
// tháng 2 năm nhuận
assert.equal(monthGrid('2028-02').flat().filter((d) => d.inMonth).length, 29)

console.log('dates check: OK')
