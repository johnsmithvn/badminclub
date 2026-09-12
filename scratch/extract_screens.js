import fs from 'node:fs';
const content = fs.readFileSync('scratch/Danh_hieu_va_Treo_thuong.dc.html', 'utf8');

console.log('Total lines:', content.split('\n').length);

const lines = content.split('\n');
lines.forEach((line, idx) => {
  const l = line.trim();
  if (l.includes('data-screen-label') || l.startsWith('<!--') || l.includes('Bản Anime') || l.includes('bản Anime')) {
    console.log(`Line ${idx + 1}: ${l}`);
  }
});
