import fs from 'fs'

const content = fs.readFileSync('c:/Workspace/badminclub/.design_handoff.html', 'utf8')
const lines = content.split('\n')

function inspectRange(start, end, label) {
  console.log(`\n================== ${label} (${start} - ${end}) ==================`)
  for (let i = start - 1; i < end; i++) {
    const l = lines[i]
    if (!l) continue
    // extract visible text or key tags
    const text = l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length > 0) {
      console.log(`${i + 1}: ${text}`)
    }
  }
}

inspectRange(2365, 2580, 'DS1: Tìm trận')
inspectRange(2580, 2753, 'DS2: Chi tiết và sửa trận')
inspectRange(2753, 2920, 'DS3: Ma trận đối đầu')
