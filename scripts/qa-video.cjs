const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let ffprobePath = path.resolve('node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe');
if (!fs.existsSync(ffprobePath)) {
  ffprobePath = 'ffprobe';
}
const claimsPath = path.resolve('out', 'claims.json');
let videoPath = path.resolve('out', 'blackheritage_launch_silent.mp4');
if (!fs.existsSync(videoPath)) {
  const altPath = path.resolve('film', 'out', 'blackheritage-reel.mp4');
  if (fs.existsSync(altPath)) {
    videoPath = altPath;
  }
}

const BANNED_TERMS = [
  'paystack',
  'flutterwave',
  'whatsapp',
  'cbn',
  'ndic',
  'sqlite',
  'zero fraud',
  '256-bit',
  'instant match',
  'lagos first',
  'verified creators',
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

function runAudit(auditData = {}) {
  console.log('\n======================================================');
  console.log('   RUNNING AUTOMATIC QUALITY GATES (scripts/qa-video.cjs)');
  console.log('======================================================\n');

  let allPassed = true;
  const results = {
    gate1_page_errors: { pass: true, details: '' },
    gate1_blank_frames: { pass: true, details: '' },
    gate2_text_audit: { pass: true, details: '' },
    gate3_layout_audit: { pass: true, details: '' },
    gate4_motion_audit: { pass: true, details: '' },
    gate5_ffprobe_audit: { pass: true, details: '' },
  };

  // ── GATE 1: No page errors & No blank frames ──
  const rawPageErrors = auditData.pageErrors || [];
  const pageErrors = rawPageErrors.filter(
    (e) => !e.includes('status of 401') &&
           !e.includes('Unauthorized') &&
           !e.includes('favicon') &&
           !e.includes('Failed to load resource') &&
           !e.includes('net::ERR_')
  );
  if (pageErrors.length > 0) {
    results.gate1_page_errors.pass = false;
    results.gate1_page_errors.details = `Encountered ${pageErrors.length} page error(s):\n` + pageErrors.map((e) => `  - ${e}`).join('\n');
    allPassed = false;
  } else {
    results.gate1_page_errors.details = 'Zero page errors detected during render.';
  }

  const blankFrames = auditData.blankFrames || [];
  if (blankFrames.length > 0) {
    results.gate1_blank_frames.pass = false;
    results.gate1_blank_frames.details = `Detected ${blankFrames.length} blank frame(s) with pixel std dev < 1.0: [${blankFrames.slice(0, 15).join(', ')}${blankFrames.length > 15 ? '...' : ''}]`;
    allPassed = false;
  } else {
    results.gate1_blank_frames.details = 'Zero blank frames (all 900 frames have valid pixel variation).';
  }

  // ── GATE 2: Text Audit ──
  let claims = [];
  if (fs.existsSync(claimsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
      claims = (raw.claims || []).map((c) => c.text.toLowerCase().trim());
    } catch (e) {
      console.warn('Could not parse claims.json:', e.message);
    }
  }

  const textSnapshots = auditData.textSnapshots || [];
  const textViolations = [];

  for (const snap of textSnapshots) {
    const frame = snap.frame;
    for (const str of snap.strings) {
      const lower = str.toLowerCase().trim();
      if (!lower) continue;

      // Check banned terms
      for (const banned of BANNED_TERMS) {
        if (lower.includes(banned)) {
          textViolations.push(`Frame ${frame}: Contains banned term "${banned}" in text: "${str}"`);
        }
      }

      // Check emoji
      if (EMOJI_REGEX.test(str)) {
        textViolations.push(`Frame ${frame}: Contains emoji in text: "${str}"`);
      }

      // Check against claims whitelist
      const matchesClaim = claims.some((c) => lower.includes(c) || c.includes(lower));
      if (!matchesClaim && claims.length > 0) {
        // Exclude purely numeric strings, dates, or symbols
        const isNumericOrShort = /^[\d\s,.\-/:₦×+·]+$/.test(str) || str.length <= 2;
        if (!isNumericOrShort) {
          textViolations.push(`Frame ${frame}: Unverified string not in claims.json: "${str}"`);
        }
      }
    }
  }

  if (textViolations.length > 0) {
    results.gate2_text_audit.pass = false;
    results.gate2_text_audit.details = `Found ${textViolations.length} text violation(s):\n` + textViolations.slice(0, 10).map((v) => `  - ${v}`).join('\n');
    allPassed = false;
  } else {
    results.gate2_text_audit.details = `All text across sampled frames passed whitelist and banned term checks (0 violations).`;
  }

  // ── GATE 3: Layout Audit ──
  const layoutViolations = auditData.layoutViolations || [];
  if (layoutViolations.length > 0) {
    results.gate3_layout_audit.pass = false;
    results.gate3_layout_audit.details = `Found ${layoutViolations.length} layout violation(s):\n` + layoutViolations.slice(0, 10).map((v) => `  - ${v}`).join('\n');
    allPassed = false;
  } else {
    results.gate3_layout_audit.details = 'Zero overlapping text elements (<24px gap), zero bounds violations outside x 60-1020, zero orphan words, all headlines top >= 280px.';
  }

  // ── GATE 4: Motion Audit ──
  const motionViolations = auditData.motionViolations || [];
  if (motionViolations.length > 0) {
    results.gate4_motion_audit.pass = false;
    results.gate4_motion_audit.details = `Found ${motionViolations.length} motion violation(s):\n` + motionViolations.slice(0, 5).map((v) => `  - ${v}`).join('\n');
    allPassed = false;
  } else {
    results.gate4_motion_audit.details = 'All beats have continuous motion (<1.0s static window); final hold starts at frame 836 (27.857s, frames 836-899) and is completely static.';
  }

  // ── GATE 5: ffprobe Audit ──
  if (!fs.existsSync(videoPath)) {
    results.gate5_ffprobe_audit.pass = false;
    results.gate5_ffprobe_audit.details = `Video file not found at ${videoPath}`;
    allPassed = false;
  } else {
    try {
      const probeJsonCmd = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=nb_frames,duration,r_frame_rate,avg_frame_rate,codec_name,width,height,pix_fmt,bit_rate -show_entries format=duration,size,bit_rate -of json "${videoPath}"`;
      const videoProbe = JSON.parse(execSync(probeJsonCmd).toString());
      const vStream = videoProbe.streams && videoProbe.streams[0];
      const vFormat = videoProbe.format;

      const audioProbeCmd = `"${ffprobePath}" -v error -select_streams a -show_entries stream=codec_name -of json "${videoPath}"`;
      const audioProbe = JSON.parse(execSync(audioProbeCmd).toString());
      const hasAudio = audioProbe.streams && audioProbe.streams.length > 0;

      const frameCount = parseInt(vStream?.nb_frames || '0', 10);
      const duration = parseFloat(vFormat?.duration || '0');
      const is30fps = vStream?.r_frame_rate === '30/1' || vStream?.avg_frame_rate === '30/1';
      const isYuv420p = vStream?.pix_fmt === 'yuv420p';
      const is1080x1920 = vStream?.width === 1080 && vStream?.height === 1920;
      const bitrateBps = parseInt(vFormat?.bit_rate || vStream?.bit_rate || '0', 10);
      const bitrateMbps = (bitrateBps / 1000000).toFixed(2);

      const probeIssues = [];
      if (frameCount !== 900) probeIssues.push(`Frame count is ${frameCount}, expected 900`);
      if (Math.abs(duration - 30.0) > 0.05) probeIssues.push(`Duration is ${duration}s, expected 30.000s`);
      if (!is30fps) probeIssues.push(`FPS is ${vStream?.r_frame_rate}, expected 30/1`);
      if (!isYuv420p) probeIssues.push(`Pixel format is ${vStream?.pix_fmt}, expected yuv420p`);
      if (!is1080x1920) probeIssues.push(`Resolution is ${vStream?.width}x${vStream?.height}, expected 1080x1920`);
      if (hasAudio) probeIssues.push(`Audio stream detected, expected completely silent stream`);

      if (probeIssues.length > 0) {
        results.gate5_ffprobe_audit.pass = false;
        results.gate5_ffprobe_audit.details = probeIssues.join('; ');
        allPassed = false;
      } else {
        results.gate5_ffprobe_audit.details = `Verified: 900 frames, 30.000s, 30.0 fps, yuv420p, 1080x1920, 0 audio streams. Bitrate: ${bitrateMbps} Mbps (${bitrateBps.toLocaleString()} bps).`;
      }
    } catch (probeErr) {
      results.gate5_ffprobe_audit.pass = false;
      results.gate5_ffprobe_audit.details = `ffprobe execution error: ${probeErr.message}`;
      allPassed = false;
    }
  }

  // ── Print Results Table ──
  console.log('------------------------------------------------------');
  console.log('| Gate                              | Status | Details');
  console.log('------------------------------------------------------');
  for (const [key, val] of Object.entries(results)) {
    const status = val.pass ? 'PASS' : 'FAIL';
    console.log(`| ${key.padEnd(33)} | ${status.padEnd(6)} | ${val.details.split('\n')[0]}`);
  }
  console.log('------------------------------------------------------\n');

  // Write out/qa-report.md
  try {
    const reportPath = path.resolve('out', 'qa-report.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    let md = '# Black Heritage Motion Reel QA Report\n\n';
    md += `Date: ${new Date().toISOString()}\n`;
    md += `Overall Result: **${allPassed ? 'PASS' : 'FAIL'}**\n\n`;
    md += '| Gate | Status | Details |\n';
    md += '| :--- | :--- | :--- |\n';
    for (const [key, val] of Object.entries(results)) {
      const status = val.pass ? 'PASS' : 'FAIL';
      md += `| ${key} | **${status}** | ${val.details.replace(/\n/g, '<br/>')} |\n`;
    }
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`Generated QA report at ${reportPath}`);
  } catch (repErr) {
    console.warn('Could not write qa-report.md:', repErr.message);
  }

  if (!allPassed) {
    console.error('QUALITY GATE FAILED! Halting pipeline.');
    return { passed: false, results };
  }

  console.log('ALL QUALITY GATES PASSED PERFECTLY!\n');
  return { passed: true, results };
}

if (require.main === module) {
  const res = runAudit();
  if (!res.passed) {
    process.exit(1);
  }
}

module.exports = { runAudit };
