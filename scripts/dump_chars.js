const fs = require('fs');
const p = 'c:/Users/coffe/Desktop/Nuggie/client/species-database.js';
const s = fs.readFileSync(p);
console.log('length', s.length);
for (let i=0;i<200 && i<s.length;i++){
  const b = s[i];
  const ch = String.fromCharCode(b);
  const code = b;
  process.stdout.write(code.toString().padStart(3,' ')+':'+(ch==='\n'?'\\n':ch));
  if ((i+1)%8===0) process.stdout.write('\n');
}
