import fs from 'node:fs';

['A1', 'A2', 'A3', 'A4', 'A5'].forEach(name => {
  const html = fs.readFileSync(`scratch/screen_${name}.html`, 'utf8');
  console.log(`\n=================== SCREEN ${name} (Length: ${html.length}) ===================`);
  
  // Extract visible texts by stripping tags
  const cleanText = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join(' · ');

  console.log(cleanText.substring(0, 800));
});
