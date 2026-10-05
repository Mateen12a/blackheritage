const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/PC/.gemini/antigravity-ide/brain/84a9bd3c-c46b-4f40-8c69-c5e9e636f686';
const currentArtifactDir = 'C:/Users/PC/.gemini/antigravity-ide/brain/70055d67-e9c8-45ab-bb6e-8c71b58a7179';
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
  {
    src: path.join(currentArtifactDir, 'sunset_gala_hero_1791131950997.jpg'),
    dest: 'abuja-sunset-gala.jpg',
    absolute: true,
  },
];

for (const p of posters) {
  const srcPath = p.absolute ? p.src : path.join(srcDir, p.src);
  const destPath = path.join(destDir, p.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${p.src} -> ${p.dest} (${fs.statSync(destPath).size} bytes)`);
  } else {
    console.warn(`Source not found: ${srcPath}`);
  }
}

// Sync real screen captures from film/screens to client/public/screens
const screensSrc = path.resolve(__dirname, '../film/screens');
const screensDest = path.resolve(__dirname, '../client/public/screens');
if (fs.existsSync(screensSrc)) {
  fs.mkdirSync(screensDest, { recursive: true });
  const files = fs.readdirSync(screensSrc).filter((f) => f.endsWith('.png'));
  for (const f of files) {
    fs.copyFileSync(path.join(screensSrc, f), path.join(screensDest, f));
  }
  console.log(`Synced ${files.length} screen captures from film/screens to client/public/screens`);
}
