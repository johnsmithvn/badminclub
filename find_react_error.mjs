import fs from 'fs';
import path from 'path';

// 1. Search for error decoder / error 310
function searchErrors(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) searchErrors(full);
    else if (full.endsWith('.js')) {
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('react.dev/errors/')) {
        console.log('Found error url in', full);
        const idx = text.indexOf('react.dev/errors/');
        console.log(text.slice(Math.max(0, idx - 50), idx + 80));
      }
    }
  }
}
searchErrors('node_modules/react');
searchErrors('node_modules/react-dom');
