const fs = require('fs');
const vm = require('vm');
const path = 'c:/Users/coffe/Desktop/Nuggie/client/species-database.js';
try {
  const s = fs.readFileSync(path, 'utf8');
  try {
    new vm.Script(s, { filename: path });
    console.log('PARSE_OK');
  } catch (e) {
    console.error('PARSE_ERROR', e && e.message);
    if (e && e.stack) console.error(e.stack.split('\n').slice(0,5).join('\n'));
  }
} catch (err) {
  console.error('script failed', err);
}
