const fs = require('fs');
const p = 'c:/Users/coffe/Desktop/Nuggie/client/species-database.js';
const s = fs.readFileSync(p,'utf8');
let depth=0; let inS=false, inD=false, inT=false, esc=false;
const lines=s.split('\n');
let lastNonZero=-1;
for(let i=0;i<lines.length;i++){
  const line=lines[i];
  for(let j=0;j<line.length;j++){
    const ch=line[j];
    if (esc) { esc=false; continue; }
    if (ch==='\\') { esc=true; continue; }
    if (!inD && !inT && ch==="'") { inS=!inS; continue; }
    if (!inS && !inT && ch==='"') { inD=!inD; continue; }
    if (!inS && !inD && ch==='`') { inT=!inT; continue; }
    if (inS||inD||inT) continue;
    if (ch==='{') depth++;
    if (ch==='}') depth--;
  }
  if (depth!==0) lastNonZero=i+1;
  if ((i+1)%5000===0) process.stdout.write('.');
}
console.log('\nlast line with non-zero depth:', lastNonZero, 'final depth=', depth);
