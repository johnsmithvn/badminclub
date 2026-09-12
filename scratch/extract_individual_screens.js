import fs from 'node:fs';

const content = fs.readFileSync('scratch/Danh_hieu_va_Treo_thuong.dc.html', 'utf8');

function getBlock(label, nextLabel) {
  const start = content.indexOf(label);
  if (start === -1) return '';
  const end = nextLabel ? content.indexOf(nextLabel, start) : start + 30000;
  return content.substring(start, end !== -1 ? end : start + 30000);
}

fs.writeFileSync('scratch/screen_A1.html', getBlock('data-screen-label="A1 Bo suu tap anime"', 'data-screen-label="A2 Chi tiet danh hieu anime"'));
fs.writeFileSync('scratch/screen_A2.html', getBlock('data-screen-label="A2 Chi tiet danh hieu anime"', 'data-screen-label="A3 Bang treo thuong anime"'));
fs.writeFileSync('scratch/screen_A3.html', getBlock('data-screen-label="A3 Bang treo thuong anime"', 'data-screen-label="A4 Modal mo khoa anime"'));
fs.writeFileSync('scratch/screen_A4.html', getBlock('data-screen-label="A4 Modal mo khoa anime"', 'data-screen-label="A5 Xep hang suu tap anime"'));
fs.writeFileSync('scratch/screen_A5.html', getBlock('data-screen-label="A5 Xep hang suu tap anime"', 'data-screen-label="A6 Hien thi o bang xep hang anime"'));

console.log('Written screen files A1..A5');
