const fs = require('fs');
const path = require('path');

// Regex for emoji characters (excluding © \u00a9 and ® \u00ae)
const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u2122|\u2139|[\ud83c\udca0-\ud83c\udcff]|[\ud83d\udc00-\ud83d\ude4f]|[\ud83d\ude80-\ud83d\udefc]|[\ud83e\udd00-\ud83e\uffff])/g;

const root = path.resolve(__dirname, '..');
const dirs = [path.join(root, 'client', 'src'), path.join(root, 'server')];

const results = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const matches = line.match(emojiRegex);
        if (matches) {
          results.push({
            file: path.relative(root, full),
            line: idx + 1,
            matches,
            content: line.trim()
          });
        }
      });
    }
  }
}

for (const d of dirs) {
  if (fs.existsSync(d)) scanDir(d);
}

console.log(`Found ${results.length} lines with emojis:`);
const outPath = path.join(root, 'out', 'emoji-audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

for (const r of results.slice(0, 30)) {
  console.log(`${r.file}:${r.line} [${r.matches.join(' ')}] -> ${r.content.slice(0, 80)}`);
}
if (results.length > 30) {
  console.log(`... and ${results.length - 30} more. Full list saved to out/emoji-audit.json`);
}
