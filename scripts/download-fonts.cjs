const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.resolve(__dirname, '..', 'client', 'public', 'fonts');
fs.mkdirSync(fontsDir, { recursive: true });

// Fetch the CSS from Google Fonts with a Chrome user agent to get woff2 URLs
const cssUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,700&display=swap';

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, headers));
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching Google Fonts CSS...');
  const cssBuffer = await fetchUrl(cssUrl);
  const css = cssBuffer.toString('utf-8');

  // Parse font-face rules
  const fontFaceRegex = /@font-face\s*{([^}]+)}/g;
  let match;
  let localCss = '';
  let count = 0;

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const familyMatch = /font-family:\s*['"]?([^'";]+)['"]?/.exec(block);
    const weightMatch = /font-weight:\s*([^;]+)/.exec(block);
    const styleMatch = /font-style:\s*([^;]+)/.exec(block);
    const urlMatch = /url\((https:\/\/[^)]+)\)\s*format\(['"]?([^'"]+)['"]?\)/.exec(block);

    if (familyMatch && weightMatch && urlMatch) {
      const family = familyMatch[1].trim();
      const weight = weightMatch[1].trim();
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const remoteUrl = urlMatch[1];
      const format = urlMatch[2];

      const ext = format === 'woff2' ? 'woff2' : 'woff';
      const cleanFam = family.replace(/\s+/g, '-').toLowerCase();
      const filename = `${cleanFam}-${style}-${weight}.${ext}`;
      const destPath = path.join(fontsDir, filename);

      console.log(`Downloading ${filename} from ${remoteUrl}...`);
      const fontData = await fetchUrl(remoteUrl);
      fs.writeFileSync(destPath, fontData);
      count++;

      localCss += `@font-face {\n  font-family: '${family}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${filename}') format('${format}');\n}\n\n`;
    }
  }

  const cssPath = path.join(fontsDir, 'fonts.css');
  fs.writeFileSync(cssPath, localCss);
  console.log(`Successfully downloaded ${count} fonts and wrote ${cssPath}`);
}

run().catch(console.error);
