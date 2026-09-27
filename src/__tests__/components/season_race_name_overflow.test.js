import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { shortName, NAME_CHARS } from '../../lib/money.js'

test('Season Race — Hiển thị đủ tên trên màn lớn và CSS ellipsis chống tràn trên Mobile', async (t) => {
  await t.test('1. shortName: Cắt ngắn tên dài bảo vệ layout cho các nơi cần rút gọn cố định', () => {
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

  await t.test('2. SeasonRaceTab.jsx: Giữ tên đầy đủ và dùng CSS ellipsis chuẩn CareerEloTab', async () => {
    const filePath = path.resolve('src/components/leaderboard/SeasonRaceTab.jsx')
    const code = await fs.readFile(filePath, 'utf8')

    // 2.1 Không hard-truncate trong JS bằng shortName trên bảng đua top mùa giải
    assert.ok(
      !code.includes('shortName(top1?.name)'),
      'Top 1 không được hard truncate bằng shortName; phải render đủ tên và để CSS ellipsis xử lý'
    )
    assert.ok(
      !code.includes('shortName(top2?.name)'),
      'Top 2 không được hard truncate bằng shortName'
    )
    assert.ok(
      !code.includes('shortName(top3?.name)'),
      'Top 3 không được hard truncate bằng shortName'
    )
    assert.ok(
      !code.includes('shortName(row.name)'),
      'Row bảng không được hard truncate bằng shortName'
    )

    // 2.2 Hiển thị tên đầy đủ với thẻ title để tooltip hiển thị trọn vẹn
    assert.ok(code.includes('<span title={top1?.name}>{top1?.name}</span>'), 'Top 1 hiển thị đầy đủ tên kèm tooltip')
    assert.ok(code.includes('<span title={top2?.name}>{top2?.name}</span>'), 'Top 2 hiển thị đầy đủ tên kèm tooltip')
    assert.ok(code.includes('<span title={top3?.name}>{top3?.name}</span>'), 'Top 3 hiển thị đầy đủ tên kèm tooltip')
    assert.ok(code.includes('<span title={row.name}>{row.name}</span>'), 'Row bảng hiển thị đầy đủ tên kèm tooltip')

    // 2.3 Không được dùng gridTemplateColumns: '1fr 1fr' thiếu minmax(0, 1fr) trên mobile podium
    assert.ok(
      !code.includes("gridTemplateColumns: '1fr 1fr'"),
      "Không được dùng gridTemplateColumns: '1fr 1fr' vì sẽ bị chữ dài đẩy phình cột. Phải dùng minmax(0, 1fr)!"
    )
    assert.ok(
      !code.includes('gridTemplateColumns: "1fr 1fr"'),
      'Không được dùng gridTemplateColumns: "1fr 1fr"!'
    )
    assert.ok(
      code.includes("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'"),
      'Mobile 2-column podium phải dùng repeat(2, minmax(0, 1fr))'
    )

    // 2.4 Kiểm tra Dropdown chọn mùa giải có bo góc đẹp và giới hạn maxWidth chống tràn
    assert.ok(code.includes('borderRadius: 8'), 'Dropdown chọn mùa giải phải bo góc 8px đẹp chuẩn TDMS')
    assert.ok(code.includes('maxWidth: 100%') || code.includes("maxWidth: '100%'"), 'Dropdown chọn mùa giải phải có maxWidth: 100% chống tràn màn hình')
    assert.ok(code.includes('boxSizing: border-box') || code.includes("boxSizing: 'border-box'"), 'Dropdown phải có boxSizing border-box')
  })
})
