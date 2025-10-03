const fs = require('fs');
const path = process.argv[2];
const s = fs.readFileSync(path,'utf8');
let stack = [];
let state = { inSingle:false, inDouble:false, inBacktick:false, inLineComment:false, inBlockComment:false };
for (let i=0;i<s.length;i++){
  const ch = s[i];
  const next = s[i+1] || '';
  const prev = s[i-1] || '';
  // comments
  if (!state.inSingle && !state.inDouble && !state.inBacktick) {
    if (!state.inBlockComment && ch === '/' && next === '/') { state.inLineComment = true; i++; continue; }
    if (!state.inLineComment && ch === '/' && next === '*') { state.inBlockComment = true; i++; continue; }
  }
  if (state.inLineComment) { if (ch === '\n') state.inLineComment = false; continue; }
  if (state.inBlockComment) { if (ch === '*' && next === '/') { state.inBlockComment = false; i++; continue; } else continue; }
  // strings and templates
  if (!state.inSingle && !state.inDouble && ch === '`' && !state.inBacktick) { state.inBacktick = true; stack.push({ch:'`',i}); continue; }
  if (state.inBacktick) { if (ch === '`' && prev !== '\\') { state.inBacktick = false; const top = stack.pop(); if (!top || top.ch !== '`') console.log('MISMATCH backtick at', i); } continue; }
  if (!state.inSingle && !state.inBacktick && ch === '"' && !state.inDouble) { state.inDouble = true; stack.push({ch:'"',i}); continue; }
  if (state.inDouble) { if (ch === '"' && prev !== '\\') { state.inDouble = false; const top = stack.pop(); if (!top || top.ch !== '"') console.log('MISMATCH double at', i); } continue; }
  if (!state.inDouble && !state.inBacktick && ch === "'" && !state.inSingle) { state.inSingle = true; stack.push({ch:"'",i}); continue; }
  if (state.inSingle) { if (ch === "'" && prev !== '\\') { state.inSingle = false; const top = stack.pop(); if (!top || top.ch !== "'") console.log('MISMATCH single at', i); } continue; }
  // brackets
  if (ch === '{' || ch === '(' || ch === '[') { stack.push({ch,i}); }
  if (ch === '}' || ch === ')' || ch === ']') { const top = stack.pop(); if (!top) { console.log('Unmatched closing', ch, 'at', i); } else { const match = { '}':'{', ')':'(', ']':'[' }[ch]; if (top.ch !== match) console.log('Mismatch at', i, 'expected', match, 'got', top.ch); } }
}
if (stack.length) { console.log('Unclosed tokens at end:'); stack.slice(-50).forEach(x=>console.log(x)); process.exitCode=2; } else console.log('All balanced');
