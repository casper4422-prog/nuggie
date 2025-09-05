const fs = require('fs');
const vm = require('vm');
const path = 'c:/Users/coffe/Desktop/Nuggie/client/species-database.js';
try {
  const s = fs.readFileSync(path, 'utf8');
  const lines = s.split('\n');
  let lo = 1, hi = lines.length, bad = lines.length;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const chunk = lines.slice(0, mid).join('\n');
    try {
      new vm.Script(chunk, { filename: path });
      lo = mid + 1;
    } catch (e) {
      bad = mid;
      hi = mid - 1;
    }
  }
  console.log('first failing line:', bad);
  const start = Math.max(1, bad - 10);
  const end = Math.min(lines.length, bad + 10);
  console.log('--- context ---');
  for (let i = start; i <= end; i++) {
    const prefix = (i === bad) ? '>>' : '  ';
    console.log(prefix + ' ' + i + ': ' + lines[i - 1]);
  }
} catch (err) {
  console.error('script failed', err);
  process.exit(2);
}
