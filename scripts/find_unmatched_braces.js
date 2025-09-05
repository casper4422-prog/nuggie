const fs = require('fs');
const s = fs.readFileSync('c:/Users/coffe/Desktop/Nuggie/client/species-database.js','utf8');
let inS=false,inD=false,inT=false,esc=false;
const stack = [];
const lines = s.split('\n');
for(let i=0;i<lines.length;i++){
  const line = lines[i];
  for(let j=0;j<line.length;j++){
    const ch = line[j];
    if (esc) { esc=false; continue; }
    if (ch==='\\') { esc=true; continue; }
    if (!inD && !inT && ch==="'") { inS=!inS; continue; }
    if (!inS && !inT && ch==='"') { inD=!inD; continue; }
    if (!inS && !inD && ch==='`') { inT=!inT; continue; }
    if (inS||inD||inT) continue;
    if (ch==='{') stack.push({line:i+1,col:j+1});
    if (ch==='}') {
      if (stack.length===0) {
        console.log('Unmatched } at', i+1, j+1); process.exit(0);
      }
      stack.pop();
    }
  }
}
console.log('unmatched opens:', stack.slice(-10));
console.log('total unmatched opens:', stack.length);
