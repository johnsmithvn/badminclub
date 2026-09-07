import fs from 'fs'

const content = fs.readFileSync('c:/Workspace/badminclub/.design_handoff.html', 'utf8')
const lines = content.split('\n')

console.log('Total lines:', lines.length)

// Find sections and screen labels
const matches = []
lines.forEach((line, idx) => {
  if (
    line.includes('Hệ 3 tầng') ||
    line.includes('8a') ||
    line.includes('8b') ||
    line.includes('CE1') ||
    line.includes('CE2') ||
    line.includes('CE3') ||
    line.includes('CE4') ||
    line.includes('CE5') ||
    line.includes('CE6') ||
    line.includes('CE7') ||
    line.includes('CE8') ||
    line.includes('data-screen') ||
    line.includes('id="8')
  ) {
    matches.push({ line: idx + 1, text: line.trim() })
  }
})

console.log('Found matches:', matches.length)
matches.slice(0, 50).forEach(m => console.log(`${m.line}: ${m.text}`))
