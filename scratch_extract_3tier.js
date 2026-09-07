import fs from 'fs'

const content = fs.readFileSync('c:/Workspace/badminclub/.design_handoff.html', 'utf8')
const lines = content.split('\n')

function extractSection(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n')
}

// Let's save the exact HTML of the 8 screens to a clean file so we can view and reference them easily
const sectionContent = extractSection(25, 1056)
fs.writeFileSync('c:/Workspace/badminclub/scratch_3tier_design.html', sectionContent, 'utf8')
console.log('Saved scratch_3tier_design.html, length:', sectionContent.length)
