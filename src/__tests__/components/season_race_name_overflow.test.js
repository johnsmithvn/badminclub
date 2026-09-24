import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { shortName, NAME_CHARS } from '../../lib/money.js'

test('Season Race — Chống tràn chữ tên dài trên Mobile & Desktop', async (t) => {
  await t.test('1. shortName: Cắt ngắn tên dài bảo vệ layout không vượt trần NAME_CHARS', () => {
    // Tên bình thường (< 24 ký tự) giữ nguyên
    assert.equal(shortName('Nguyễn Văn A'), 'Nguyễn Văn A')
    assert.equal(shortName('Bát canh thập cẩm'), 'Bát canh thập cẩm')

    // Tên dài 4-5 chữ vượt quá 24 ký tự -> cắt tại ranh giới từ và thêm dấu …
    const longName = 'Nguyễn Trần Đình Bảo Long Quân'
    assert.ok(longName.length > NAME_CHARS, 'longName phải > 24 ký tự để kích hoạt shortName')
    const res = shortName(longName)
    assert.ok(res.endsWith('…'), 'Kết quả phải có dấu …')
    assert.ok(res.length <= NAME_CHARS + 1, 'Độ dài sau khi cắt không được vượt trần an toàn')

    // Tên không có khoảng trắng dài dằng dặc -> cắt đúng 24 ký tự + …
    const continuousLong = 'SupercalifragilisticexpialidociousMember'
    const resContinuous = shortName(continuousLong)
    assert.equal(resContinuous, continuousLong.slice(0, NAME_CHARS) + '…')

    // Null, undefined, rỗng an toàn
    assert.equal(shortName(null), '')
    assert.equal(shortName(undefined), '')
    assert.equal(shortName(''), '')
  })

  await t.test('2. SeasonRaceTab.jsx: Kiểm tra AST/mã nguồn không cho phép dùng tên thô chưa bọc shortName', async () => {
    const filePath = path.resolve('src/components/leaderboard/SeasonRaceTab.jsx')
    const code = await fs.readFile(filePath, 'utf8')

    // 2.1 Bắt buộc phải import shortName từ #lib/money.js
    assert.ok(
      code.includes("import { shortName } from '#lib/money.js'") ||
      code.includes('import { shortName } from "#lib/money.js"') ||
      code.includes('shortName'),
      'SeasonRaceTab phải import shortName'
    )

    // 2.2 Không được dùng gridTemplateColumns: '1fr 1fr' thiếu minmax(0, 1fr) trên mobile podium
    assert.ok(
      !code.includes("gridTemplateColumns: '1fr 1fr'"),
      "Không được dùng gridTemplateColumns: '1fr 1fr' vì sẽ bị chữ dài đẩy phình cột. Phải dùng minmax(0, 1fr)!"
    )
    assert.ok(
      !code.includes('gridTemplateColumns: "1fr 1fr"'),
      'Không được dùng gridTemplateColumns: "1fr 1fr"!'
    )

    // 2.3 Mọi chỗ render tên Top 1, Top 2, Top 3 và row bảng mùa phải bọc qua shortName
    // Bắt các mẫu lỗi trước đây: <span title={top1?.name}>{top1?.name}</span>
    assert.ok(
      !code.includes('<span title={top1?.name}>{top1?.name}</span>'),
      'Top 1 không được render {top1?.name} thô, phải bọc shortName(top1?.name)'
    )
    assert.ok(
      !code.includes('<span title={top2?.name}>{top2?.name}</span>'),
      'Top 2 không được render {top2?.name} thô, phải bọc shortName(top2?.name)'
    )
    assert.ok(
      !code.includes('<span title={top3?.name}>{top3?.name}</span>'),
      'Top 3 không được render {top3?.name} thô, phải bọc shortName(top3?.name)'
    )
    assert.ok(
      !code.includes('<span title={row.name}>{row.name}</span>'),
      'Row bảng xếp hạng không được render {row.name} thô, phải bọc shortName(row.name)'
    )

    // 2.4 Kiểm tra đã dùng shortName cho top1, top2, top3
    assert.ok(code.includes('shortName(top1?.name)'), 'Top 1 phải dùng shortName(top1?.name)')
    assert.ok(code.includes('shortName(top2?.name)'), 'Top 2 phải dùng shortName(top2?.name)')
    assert.ok(code.includes('shortName(top3?.name)'), 'Top 3 phải dùng shortName(top3?.name)')
    assert.ok(code.includes('shortName(row.name)'), 'Row bảng phải dùng shortName(row.name)')
  })
})
