import fs from 'node:fs';

const content = fs.readFileSync('scratch/Danh_hieu_va_Treo_thuong.dc.html', 'utf8');

const scriptStart = content.indexOf('<script type="text/x-dc"');
const scriptEnd = content.indexOf('</script>', scriptStart);

if (scriptStart !== -1 && scriptEnd !== -1) {
  const code = content.substring(scriptStart, scriptEnd + 9);
  fs.writeFileSync('scratch/badges_spec.html', code);
  
  // Extract pure JS inside
  const jsStart = code.indexOf('>') + 1;
  const jsEnd = code.lastIndexOf('</script>');
  const pureJs = code.substring(jsStart, jsEnd);
  fs.writeFileSync('scratch/badges_spec.js', pureJs);
  console.log('Extracted badges_spec.js successfully, size:', pureJs.length);
}
