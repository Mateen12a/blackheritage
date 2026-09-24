const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/PC/.gemini/antigravity-ide/brain/84a9bd3c-c46b-4f40-8c69-c5e9e636f686';
const destDir = path.resolve(__dirname, '../client/public/events');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const posters = [
  {
    src: 'mainland_party_poster_1790165395409.jpg',
    dest: 'mainland-block-party.jpg',
  },
  {
    src: 'alte_culture_poster_1790165455508.jpg',
    dest: 'alte-culture-festival.jpg',
  },
  {
    src: 'native_sound_poster_1790165472069.jpg',
    dest: 'native-sound-system.jpg',
  },
  {
    src: 'sip_paint_poster_1790165490855.jpg',
    dest: 'sip-and-paint-ng.jpg',
  },
  {
    src: 'palmwine_fest_poster_1790165512705.jpg',
    dest: 'palmwine-music-festival.jpg',
  },
];

for (const p of posters) {
  const srcPath = path.join(srcDir, p.src);
  const destPath = path.join(destDir, p.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${p.src} -> ${p.dest} (${fs.statSync(destPath).size} bytes)`);
  } else {
    console.error(`Source not found: ${srcPath}`);
  }
}
