import fs from 'node:fs';

const content = fs.readFileSync('scratch/Danh_hieu_va_Treo_thuong.dc.html', 'utf8');

// Find all script tags
const scripts = content.match(/<script[\s\S]*?<\/script>/gi) || [];
console.log('Found scripts:', scripts.length);
scripts.forEach((s, i) => {
  console.log(`Script ${i+1}: length ${s.length}, snippet: ${s.substring(0, 300)}`);
});

// Also look for JSON or data objects
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('const ') || l.includes('let ') || l.includes('var ') || l.includes('{ name:')) {
    console.log(`Line ${i+1}: ${l.trim().substring(0, 150)}`);
  }
});
