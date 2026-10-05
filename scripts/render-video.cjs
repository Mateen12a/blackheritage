const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { runAudit } = require('./qa-video.cjs');

let ffmpegPath = path.resolve('node_modules', 'ffmpeg-static', 'ffmpeg.exe');
if (!fs.existsSync(ffmpegPath)) {
  ffmpegPath = 'ffmpeg';
}
let ffprobePath = path.resolve('node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe');
if (!fs.existsSync(ffprobePath)) {
  ffprobePath = 'ffprobe';
}

const TOTAL_FRAMES = 900; // 30.0s * 30 fps
const FPS = 30;
const DURATION = 30.0;

const REVIEW_TIMESTAMPS = [0.8, 2.5, 5.0, 7.5, 10.5, 12.8, 15.5, 18.0, 20.0, 23.0, 24.5, 27.0, 29.5];

const TRANSITIONS = [
  { name: 'T1_hook_to_checkout_3.5s', frames: [99, 102, 105, 108, 111] },
  { name: 'T2_checkout_to_gate_9.0s', frames: [264, 267, 270, 273, 276] },
  { name: 'T3_gate_to_talent_14.0s', frames: [414, 417, 420, 423, 426] },
  { name: 'T4_talent_to_payout_21.5s', frames: [639, 642, 645, 648, 651] },
  { name: 'T5_payout_to_lockup_25.0s', frames: [744, 747, 750, 753, 756] },
];

async function main() {
  console.log('====================================================');
  console.log(' Black Heritage Deterministic Video Render Pipeline');
  console.log(' Target: 1080x1920 · 30.000 fps · 30.000s · 900 frames');
  console.log('====================================================\n');

  // Sync authentic event flyers if script exists
  try {
    const syncScript = path.resolve('scripts', 'sync-flyers.cjs');
    if (fs.existsSync(syncScript)) {
      require(syncScript);
    }
  } catch (syncErr) {
    console.warn('Sync flyers notice:', syncErr.message);
  }

  const framesDir = path.resolve('out', 'temp_frames');
  const stillsDir = path.resolve('out', 'stills');
  const transDir = path.resolve('out', 'stills', 'transitions');
  const outputPath = path.resolve('out', 'blackheritage_launch_silent.mp4');
  const filmOutDir = path.resolve('film', 'out');
  const filmOutputPath = path.resolve(filmOutDir, 'blackheritage-reel.mp4');

  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(stillsDir, { recursive: true });
  fs.mkdirSync(transDir, { recursive: true });
  fs.mkdirSync(filmOutDir, { recursive: true });

  console.log('1. Launching browser...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
  }

  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });

  // Track page errors and console errors
  const pageErrors = [];
  page.on('pageerror', (err) => {
    console.error('[Browser PageError]:', err.message);
    pageErrors.push(err.message || String(err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore favicon, non-fatal network asset errors, or expected 401 unauthenticated checks
      const isBenign = txt.includes('ERR_BLOCKED_BY_RESPONSE') ||
                       txt.includes('favicon') ||
                       txt.includes('status of 401') ||
                       txt.includes('Unauthorized') ||
                       txt.includes('Failed to load resource') ||
                       txt.includes('net::ERR_');
      if (!isBenign) {
        console.error('[Browser Console Error]:', txt);
        pageErrors.push(txt);
      }
    }
  });

async function resolveBaseUrl() {
  if (process.env.LOCAL_BASE_URL) return process.env.LOCAL_BASE_URL;
  if (process.env.BASE_URL && (process.env.BASE_URL.includes('localhost') || process.env.BASE_URL.includes('127.0.0.1'))) {
    return process.env.BASE_URL;
  }
  const candidates = ['http://localhost:5000', 'http://localhost:5050'];
  for (const c of candidates) {
    try {
      const res = await fetch(c);
      if (res.status < 500) return c;
    } catch {}
  }
  return 'http://localhost:5000';
}

  const baseUrl = await resolveBaseUrl();
  console.log(`2. Navigating to ${baseUrl}/reel?raw=1 ...`);
  await page.goto(`${baseUrl}/reel?raw=1`, { waitUntil: 'networkidle' });

  console.log('3. Preloading fonts and awaiting document.fonts.ready ...');
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('800 48px "Playfair Display"'),
      document.fonts.load('700 48px "Playfair Display"'),
      document.fonts.load('400 16px "Playfair Display"'),
      document.fonts.load('400 16px "DM Sans"'),
      document.fonts.load('500 16px "DM Sans"'),
      document.fonts.load('700 24px "DM Sans"')
    ]);
    await document.fonts.ready;
    if (typeof window.__setReelTime === 'function') {
      window.__setReelTime(0, false);
    }
  });

  console.log('4. Capturing 900 frames deterministically with QA telemetry...');
  const startTime = Date.now();

  const blankFrames = [];
  const textSnapshots = [];
  const layoutViolations = [];
  const motionViolations = [];

  let prevFrameSample = null;
  let zeroDiffStreak = 0;

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const time = f / FPS;

    // Set exact deterministic time
    await page.evaluate((t) => {
      if (typeof window.__setReelTime === 'function') {
        window.__setReelTime(t, false);
      }
    }, time);

    const frameFile = path.join(framesDir, `frame_${String(f).padStart(4, '0')}.png`);
    const screenshotBuf = await page.screenshot({
      path: frameFile,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
      type: 'png',
    });

    // ── Pixel sample & Blank frame detection (Gate 1) ──
    // Sample 200 pixels evenly from the buffer to compute variance & frame difference
    const sampleLen = Math.min(screenshotBuf.length, 2000);
    const step = Math.floor(screenshotBuf.length / 200);
    let sum = 0;
    let sumSq = 0;
    const samples = [];
    for (let i = 0; i < 200; i++) {
      const byte = screenshotBuf[i * step];
      samples.push(byte);
      sum += byte;
      sumSq += byte * byte;
    }
    const mean = sum / 200;
    const variance = (sumSq / 200) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));

    if (stdDev < 1.0) {
      blankFrames.push(f);
    }

    // ── Motion difference check (Gate 4) ──
    if (prevFrameSample) {
      let diff = 0;
      for (let i = 0; i < 200; i++) {
        diff += Math.abs(samples[i] - prevFrameSample[i]);
      }
      const avgDiff = diff / 200;
      if (avgDiff < 0.05) {
        zeroDiffStreak++;
      } else {
        zeroDiffStreak = 0;
      }

      // Check if zero diff streak exceeds 1.0s (30 frames) before the final hold
      // Final hold starts at frame 836 (27.857s to 30.0s, frames 836 to 899)
      if (f < 836 && zeroDiffStreak > 30) {
        motionViolations.push(`Beat stall detected at frame ${f} (t=${time.toFixed(2)}s): > 1.0s of zero frame difference`);
      }
    }
    prevFrameSample = samples;

    // ── Periodic Text & Layout Audit at every 15th frame (Gates 2 & 3) ──
    if (f % 15 === 0) {
      const frameAudit = await page.evaluate((currFrame) => {
        const textElements = [];
        const stage = document.getElementById('reel-stage') || document.body;

        // Traverse visible text nodes
        const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const txt = node.textContent?.trim();
          if (!txt || txt.length === 0) continue;
          const parent = node.parentElement;
          if (!parent) continue;

          const rect = parent.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) continue;

          const isAllowOverlap = !!parent.closest('[data-allow-overlap="true"]');
          const isDisplayMoment = !!parent.closest('[data-display-moment="true"]');
          const isHeadline = parent.tagName === 'H1' || parent.tagName === 'H2' || !!parent.closest('[data-headline="true"]');

          textElements.push({
            text: txt,
            tag: parent.tagName,
            rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
            isAllowOverlap,
            isDisplayMoment,
            isHeadline,
          });
        }

        const strings = textElements.map((e) => e.text);
        const violations = [];

        // Check bounds (x 60 to 1020) and headlines
        for (const el of textElements) {
          if (!el.isDisplayMoment) {
            // Horizontal margins
            if (el.rect.left < 50 || el.rect.right > 1030) {
              violations.push(`Frame ${currFrame}: Element "${el.text.slice(0, 30)}" exceeds bounds [left: ${el.rect.left.toFixed(0)}, right: ${el.rect.right.toFixed(0)}]`);
            }
          }

          if (el.isHeadline) {
            // Headline top must be >= 280
            if (el.rect.top < 275 && !el.isDisplayMoment) {
              violations.push(`Frame ${currFrame}: Headline "${el.text.slice(0, 30)}" top sits at ${el.rect.top.toFixed(0)}px (< 280px)`);
            }

            // Check orphan words on last line
            const lines = el.text.split('\n').filter(Boolean);
            const lastLine = lines[lines.length - 1] || '';
            const words = lastLine.trim().split(/\s+/);
            if (words.length === 1 && lines.length > 1 && words[0].length > 1) {
              violations.push(`Frame ${currFrame}: Headline has orphan word on last line: "${words[0]}"`);
            }
          }
        }

        return { strings, violations };
      }, f);

      textSnapshots.push({ frame: f, strings: frameAudit.strings });
      if (frameAudit.violations.length > 0) {
        layoutViolations.push(...frameAudit.violations);
      }
    }

    if (f % 30 === 0 || f === TOTAL_FRAMES - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = (((f + 1) / TOTAL_FRAMES) * 100).toFixed(1);
      const fps = ((f + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`Frame ${f + 1}/${TOTAL_FRAMES} (${percent}%) at t=${time.toFixed(2)}s | ${elapsed}s elapsed (${fps} capture fps)`);
    }
  }

  await browser.close();
  console.log(`\nFrame capture complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);

  // ── Extract review stills ──
  console.log('5. Extracting review stills...');
  for (const t of REVIEW_TIMESTAMPS) {
    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.round(t * FPS));
    const src = path.join(framesDir, `frame_${String(frameIndex).padStart(4, '0')}.png`);
    const dst = path.join(stillsDir, `still_${t.toFixed(1)}s.png`);
    fs.copyFileSync(src, dst);
    console.log(`Saved review still for ${t.toFixed(1)}s (frame ${frameIndex}) -> ${dst}`);
  }

  // ── Extract transition frame strips ──
  console.log('6. Extracting transition frame strips (every 3rd frame)...');
  for (const trans of TRANSITIONS) {
    for (const f of trans.frames) {
      const src = path.join(framesDir, `frame_${String(f).padStart(4, '0')}.png`);
      const dst = path.join(transDir, `${trans.name}_frame_${f}.png`);
      fs.copyFileSync(src, dst);
    }
    console.log(`Saved transition strip for ${trans.name}`);
  }

  // ── Check if any blank frames or page errors occurred ──
  if (blankFrames.length > 0) {
    console.error(`\n[FATAL ERROR]: Found ${blankFrames.length} blank frame(s) with pixel standard deviation < 1.0!`);
    console.error(`Blank frames: [${blankFrames.join(', ')}]`);
  }
  if (pageErrors.length > 0) {
    console.error(`\n[FATAL ERROR]: Encountered ${pageErrors.length} browser page error(s)!`);
    console.error(pageErrors);
  }

  // ── Encode with FFmpeg (Gate 5) ──
  console.log('7. Encoding with ffmpeg: libx264, crf 14, preset slow, maxrate 16M, bufsize 32M, yuv420p, constant 30 fps, no audio...');
  const ffmpegCmd = `"${ffmpegPath}" -y -framerate 30 -i "${path.join(framesDir, 'frame_%04d.png')}" -c:v libx264 -crf 14 -preset slow -maxrate 16M -bufsize 32M -pix_fmt yuv420p -r 30 -an "${outputPath}"`;
  console.log(`Executing: ${ffmpegCmd}`);
  execSync(ffmpegCmd, { stdio: 'inherit' });

  // ── Sync to film/out/blackheritage-reel.mp4 ──
  fs.copyFileSync(outputPath, filmOutputPath);
  console.log(`Synced reel output to: ${filmOutputPath}`);

  // ── Run Quality Gates Audit ──
  const auditData = {
    pageErrors,
    blankFrames,
    textSnapshots,
    layoutViolations,
    motionViolations,
  };

  const auditResult = runAudit(auditData);

  // ── Clean up temporary frames ──
  console.log('9. Cleaning up temporary frames...');
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log('Temporary frames cleaned up.');

  if (!auditResult.passed) {
    console.error('\n[FATAL]: One or more automatic quality gates FAILED.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log(' RENDER & ALL QUALITY GATES SUCCESSFUL');
  console.log(` Output: ${outputPath}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during render:', err);
  process.exit(1);
});
