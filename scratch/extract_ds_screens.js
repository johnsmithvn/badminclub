import fs from 'fs'

const content = fs.readFileSync('c:/Workspace/badminclub/.design_handoff.html', 'utf8')
const lines = content.split('\n')

function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n')
}

fs.writeFileSync('c:/Workspace/badminclub/scratch/ds1_raw.html', extractLines(2370, 2579))
fs.writeFileSync('c:/Workspace/badminclub/scratch/ds2_raw.html', extractLines(2580, 2752))
fs.writeFileSync('c:/Workspace/badminclub/scratch/ds3_raw.html', extractLines(2753, 2918))

console.log('Extracted DS1, DS2, DS3 raw HTML files!')
