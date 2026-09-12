import fs from 'node:fs';

const content = fs.readFileSync('scratch/Danh_hieu_va_Treo_thuong.dc.html', 'utf8');

function extractBetween(startPattern, endPattern) {
  const startIdx = content.indexOf(startPattern);
  if (startIdx === -1) return '';
  const endIdx = content.indexOf(endPattern, startIdx);
  if (endIdx === -1) return content.substring(startIdx, startIdx + 5000);
  return content.substring(startIdx, endIdx);
}

// Let's print the descriptions and comments around A1..A5
const screens = [
  { id: 'A1', label: 'A1 Bo suu tap anime' },
  { id: 'A2', label: 'A2 Chi tiet danh hieu anime' },
  { id: 'A3', label: 'A3 Bang treo thuong anime' },
  { id: 'A4', label: 'A4 Modal mo khoa anime' },
  { id: 'A5', label: 'A5 Xep hang suu tap anime' },
];

screens.forEach(sc => {
  const idx = content.indexOf(sc.label);
  console.log(`=== ${sc.id} (index ${idx}) ===`);
  if (idx !== -1) {
    const snippet = content.substring(Math.max(0, idx - 200), idx + 1000);
    console.log(snippet.substring(0, 800));
  }
});
