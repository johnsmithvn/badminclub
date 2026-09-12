import fs from 'fs'

const content = fs.readFileSync('c:/Workspace/badminclub/.design_handoff.html', 'utf8')
const lines = content.split('\n')

function extractSection(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n')
}

// Let's dump text and structure summary for each of the 8 screens
const screens = [
  { id: 'SS1', name: 'Đua top mùa giải', start: 30, end: 306 },
  { id: 'SS3', name: 'Sổ điểm mùa giải', start: 307, end: 367 },
  { id: 'SS2', name: 'Bảng Elo', start: 368, end: 581 },
  { id: 'SS4', name: 'Bản đồ bốn góc', start: 582, end: 626 },
  { id: 'CE1', name: 'Chia sân best of N', start: 630, end: 865 },
  { id: 'CE2', name: 'Giải trình một sân', start: 866, end: 927 },
  { id: 'CE3', name: 'Effective strength', start: 928, end: 969 },
  { id: 'CE4', name: 'Cài đặt mùa giải', start: 970, end: 1056 },
]

for (const s of screens) {
  console.log(`=== ${s.id}: ${s.name} (Lines ${s.start}-${s.end}) ===`)
  const sec = extractSection(s.start, s.end)
  // Extract text nodes and key elements
  const textMatches = sec.match(/>([^<]+)</g) || []
  const texts = textMatches
    .map(t => t.replace(/[><]/g, '').trim())
    .filter(t => t.length > 1 && !t.startsWith('&nbsp;'))
  console.log('Sample texts:', texts.slice(0, 25).join(' | '))
  console.log('---')
}
