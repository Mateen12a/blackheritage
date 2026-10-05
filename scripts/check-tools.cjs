const ffmpegPath = require('ffmpeg-static');
const ffprobe = require('ffprobe-static');
const { execSync } = require('child_process');

console.log('ffmpeg path:', ffmpegPath);
console.log('ffprobe path:', ffprobe.path);

try {
  const ffmpegVer = execSync(`"${ffmpegPath}" -version`).toString().split('\n')[0];
  console.log('ffmpeg version:', ffmpegVer);
} catch (e) {
  console.error('ffmpeg run failed:', e.message);
}

try {
  const ffprobeVer = execSync(`"${ffprobe.path}" -version`).toString().split('\n')[0];
  console.log('ffprobe version:', ffprobeVer);
} catch (e) {
  console.error('ffprobe run failed:', e.message);
}
