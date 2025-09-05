const fs = require('fs');
const p = 'c:/Users/coffe/Desktop/Nuggie/client/species-database.js';
const s = fs.readFileSync(p,'utf8');
let depth = 0;
let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
const lines = s.split('\n');
for (let i=0;i<lines.length;i++){
  const line = lines[i];
  for (let j=0;j<line.length;j++){
    const ch = line[j];
    if (escaped) { escaped=false; continue; }
    if (ch === '\\') { escaped=true; continue; }
    if (!inSingle && !inDouble && ch === '`') { inTemplate = !inTemplate; continue; }
    if (inTemplate) continue;
    if (!inDouble && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; continue; }
    if (inSingle || inDouble) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) {
      console.log('Negative depth at line', i+1, 'col', j+1);
      process.exit(0);
    }
  }
  if (i%1000===0) process.stdout.write('.');
}
console.log('\nDone. depth=', depth);
