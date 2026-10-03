import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  QrCode,
  Mic,
  MicOff,
  Music,
  MessageSquare,
} from "lucide-react";
import logoImg from "@/assets/logo2.png";

/**
 * Black Heritage launch reel. 24 seconds, 1080x1920.
 *
 * Every frame is a pure function of the playhead `t`, so scrubbing, looping and
 * screen-recording are frame-accurate. Features clean synthesized audio design
 * (808 sub-bass, filtered noise sweeps, crystal bell chords, acoustic clicks)
 * and optional human voiceover read via Web Speech API.
 *
 * Add ?clean=1 to hide the studio chrome for direct recording.
 */

const W = 1080;
const H = 1920;
const TOTAL = 24;
const GOLD = "#E3B23C";
const INK = "#F7F5EF";
const MUTED = "#9EA0AD";
const BG = "#0F0F14";
const SURFACE = "#19191F";
const HAIR = "#31313A";

// Timeline (seconds)
const SCENES = [
  { id: "cities", start: 0, dur: 3.6 },
  { id: "events", start: 3.6, dur: 4.4 },
  { id: "ticket", start: 8.0, dur: 4.0 },
  { id: "talent", start: 12.0, dur: 4.0 },
  { id: "organizers", start: 16.0, dur: 4.4 },
  { id: "outro", start: 20.4, dur: 3.6 },
] as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (lt: number, a: number, d: number) => clamp((lt - a) / d);
const outQuart = (x: number) => 1 - Math.pow(1 - x, 4);
const outBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

type RvOpts = { x?: number; y?: number; s?: number; r?: number; back?: boolean };
function rv(lt: number, a: number, d = 0.6, o: RvOpts = {}): React.CSSProperties {
  const raw = seg(lt, a, d);
  const p = o.back ? outBack(raw) : outQuart(raw);
  const s = o.s ?? 1;
  return {
    opacity: clamp(raw * 2.2),
    transform: `translate3d(${(o.x || 0) * (1 - p)}px, ${(o.y || 0) * (1 - p)}px, 0) scale(${s + (1 - s) * p}) rotate(${(o.r || 0) * (1 - p)}deg)`,
  };
}

const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

/* ───────────── Clean Studio Audio Engine ───────────── */
class CleanAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  sfxOn = true;
  musicOn = false;
  masterVol = 0.85;

  private get c() {
    if (!this.ctx && typeof window !== "undefined") {
      const A = window.AudioContext || (window as any).webkitAudioContext;
      if (A) this.ctx = new A();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Pre-generate smooth pink-filtered stereo noise buffer for cinema whooshes
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const dur = 1.0;
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(2, Math.floor(rate * dur), rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
      }
    }
    this.noiseBuf = buf;
    return buf;
  }

  // 1. Deep Sub-Bass Punch (808 hit on cuts)
  subHit(vol = 0.35) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.45);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * this.masterVol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.6);

    // Subtle transient click for punch
    const click = c.createOscillator();
    const cg = c.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(320, t);
    click.frequency.exponentialRampToValueAtTime(60, t + 0.025);
    cg.gain.setValueAtTime(vol * 0.3 * this.masterVol, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(cg);
    cg.connect(c.destination);
    click.start(t);
    click.stop(t + 0.035);
  }

  // 2. Cinematic Whoosh Sweep (Filtered noise + gentle stereo bandpass)
  whoosh(vol = 0.22) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;
    const dur = 0.42;

    const noise = c.createBufferSource();
    noise.buffer = this.getNoiseBuffer(c);

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(2.2, t);
    filter.frequency.setValueAtTime(280, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(380, t + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * this.masterVol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(c.destination);

    noise.start(t);
    noise.stop(t + dur + 0.05);
  }

  // 3. Crisp UI Tick / Acoustic Snap
  tick(vol = 0.08) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.02);

    g.gain.setValueAtTime(vol * this.masterVol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // 4. WhatsApp Message Incoming Ping (Pure dual-tone marimba chime: G5 -> C6)
  ping(vol = 0.18) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;

    const notes = [784, 1046.5];
    notes.forEach((freq, idx) => {
      const at = t + idx * 0.07;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);

      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol * this.masterVol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  }

  // 5. Gate Scanner Success Chime (Bright ascending major third: C6 -> E6)
  scanSuccess(vol = 0.16) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;

    const notes = [1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const at = t + idx * 0.09;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);

      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol * this.masterVol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(at);
      osc.stop(at + 0.38);
    });
  }

  // 6. Crystal Bell Chord (Lush harmonic stack)
  bellChord(vol = 0.15) {
    const c = this.c;
    if (!c || !this.sfxOn) return;
    const t = c.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];

    chord.forEach((freq, idx) => {
      const at = t + idx * 0.035;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);

      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime((vol / chord.length) * 1.8 * this.masterVol, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(at);
      osc.stop(at + 0.75);
    });
  }

  // 7. Ambient Afrobeats Groove Pulse (Subtle syncopation on the 108 BPM grid)
  grooveBeat(beatIndex: number, vol = 0.12) {
    if (!this.musicOn) return;
    const c = this.c;
    if (!c) return;
    const t = c.currentTime;

    const isKick = beatIndex % 4 === 0 || beatIndex % 4 === 2.5;
    if (isKick) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(86, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      g.gain.setValueAtTime(vol * 0.6 * this.masterVol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }
}
const sfx = new CleanAudioEngine();

/* ───────────── Human Voiceover Script & Captions ───────────── */
export type VoiceoverCue = {
  time: number;
  sceneId: string;
  title: string;
  spoken: string;
  caption: string;
};

export const VOICEOVER_SCRIPT: VoiceoverCue[] = [
  {
    time: 0.15,
    sceneId: "cities",
    title: "Nigeria's Best Nights",
    spoken: "Nigeria's best nights. Concerts, parties, and festivals across Lagos, Abuja, Port Harcourt, and Ibadan.",
    caption: "Nigeria's best nights · Lagos · Abuja · Port Harcourt · Ibadan",
  },
  {
    time: 3.75,
    sceneId: "events",
    title: "Find Your Night",
    spoken: "Discover curated events. Instant checkout and verified entry.",
    caption: "Discover curated events · Instant checkout & verified entry",
  },
  {
    time: 8.1,
    sceneId: "ticket",
    title: "Instant WhatsApp Ticket",
    spoken: "Pay once with Paystack. Your QR ticket arrives right on WhatsApp.",
    caption: "Pay once with Paystack · QR ticket lands on WhatsApp",
  },
  {
    time: 12.1,
    sceneId: "talent",
    title: "Book Verified Talent",
    spoken: "Need top DJs, MCs, or sound engineers? Book talent directly on WhatsApp.",
    caption: "Book top DJs, MCs & creatives directly on WhatsApp",
  },
  {
    time: 16.1,
    sceneId: "organizers",
    title: "For Organizers",
    spoken: "For organizers: sell out fast, scan the gate offline, and get paid in twenty-four hours.",
    caption: "Sell tickets · Scan gate offline · Paid in 24 hours",
  },
  {
    time: 20.5,
    sceneId: "outro",
    title: "Your Night Starts Here",
    spoken: "Black Heritage. Your night starts here. Visit black h events dot com.",
    caption: "Black Heritage · Your night starts here · blackhevents.com",
  },
];

type CueAction = "subHit" | "whoosh" | "tick" | "ping" | "scanSuccess" | "bellChord";
const AUDIO_CUES: [number, CueAction][] = [
  [0.0, "subHit"],
  [0.55, "tick"],
  [1.1, "tick"],
  [1.65, "tick"],
  [2.25, "whoosh"],
  [3.6, "whoosh"],
  [4.15, "tick"],
  [4.45, "tick"],
  [4.75, "tick"],
  [8.0, "whoosh"],
  [9.0, "ping"],
  [9.7, "scanSuccess"],
  [12.0, "whoosh"],
  [12.6, "tick"],
  [13.3, "subHit"],
  [15.1, "tick"],
  [16.0, "whoosh"],
  [16.9, "tick"],
  [17.3, "scanSuccess"],
  [18.5, "bellChord"],
  [19.3, "subHit"],
  [20.4, "subHit"],
  [20.6, "bellChord"],
  [21.8, "whoosh"],
];

/* ───────────── Shared bits ───────────── */
const font = {
  display: { fontFamily: "'Playfair Display', serif" } as React.CSSProperties,
  body: { fontFamily: "'DM Sans', sans-serif" } as React.CSSProperties,
};

function Shell({ lt, dur, children }: { lt: number; dur: number; children: React.ReactNode }) {
  const out = 1 - seg(lt, dur - 0.3, 0.3);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: out,
        transform: `scale(${1 + 0.035 * (1 - out)})`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...font.body,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: GOLD,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Rule({ lt, a }: { lt: number; a: number }) {
  return (
    <div
      style={{
        height: 6,
        width: 120 * outQuart(seg(lt, a, 0.5)),
        background: GOLD,
        borderRadius: 3,
      }}
    />
  );
}

/* ───────────── Scene 1: the hook ───────────── */
const CITY_FLASH = [
  { word: "LAGOS", img: "/events/mainland-block-party.jpg" },
  { word: "ABUJA", img: "/events/alte-culture-festival.jpg" },
  { word: "PORT HARCOURT", img: "/events/native-sound-system.jpg" },
  { word: "IBADAN", img: "/events/palmwine-music-festival.jpg" },
];

function SceneCities({ lt, dur }: { lt: number; dur: number }) {
  const step = 0.55;
  const idx = Math.min(CITY_FLASH.length - 1, Math.floor(lt / step));
  const inFlash = lt < step * CITY_FLASH.length;
  const local = lt - idx * step;
  const city = CITY_FLASH[idx];
  const settle = seg(lt, 2.25, 0.7);

  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: inFlash ? 1 : 1 - outQuart(settle) * 0.9 }}>
        <img
          src={city.img}
          alt=""
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 1500,
            height: 1500,
            objectFit: "cover",
            transform: `translate(-50%, -50%) scale(${1.02 + local * 0.12})`,
            filter: "brightness(0.38) saturate(1.1)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${BG}cc 0%, transparent 35%, transparent 60%, ${BG} 100%)` }} />
      </div>

      {inFlash && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center" }}>
          <div
            style={{
              ...font.display,
              fontWeight: 800,
              fontSize: city.word.length > 7 ? 150 : 230,
              lineHeight: 1,
              color: INK,
              letterSpacing: "-0.02em",
              transform: `scale(${1.12 - 0.12 * outQuart(seg(local, 0, 0.18))})`,
              opacity: clamp(local / 0.06),
            }}
          >
            {city.word}
          </div>
          <div style={{ margin: "34px auto 0", height: 6, width: 140, background: GOLD, borderRadius: 3 }} />
        </div>
      )}

      {!inFlash && (
        <div style={{ position: "absolute", left: 80, right: 80, top: 700 }}>
          <Eyebrow style={rv(lt, 2.3, 0.5, { y: 24 })}>Concerts · Parties · Festivals</Eyebrow>
          <div
            style={{
              ...font.display,
              fontWeight: 800,
              fontSize: 168,
              lineHeight: 1.02,
              color: INK,
              marginTop: 36,
              letterSpacing: "-0.02em",
              ...rv(lt, 2.4, 0.7, { y: 70 }),
            }}
          >
            Nigeria's
            <br />
            <span style={{ fontStyle: "italic", fontWeight: 400, color: GOLD }}>best nights.</span>
          </div>
          <div style={{ marginTop: 44 }}>
            <Rule lt={lt} a={3.0} />
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ───────────── Scene 2: events ───────────── */
const EVENT_CARDS = [
  { title: "The Lagos Street & Sound Festival", city: "Lagos", price: 10000, tag: "Selling fast", img: "/events/mainland-block-party.jpg" },
  { title: "Sip, Sound & Canvas: Golden Hour Rooftop", city: "Lekki, Lagos", price: 20000, tag: "Only 25 left", img: "/events/sip-and-paint-ng.jpg" },
  { title: "Lagos Alté & Indie Sound Gathering", city: "Victoria Island", price: 12500, tag: "1,318 going", img: "/events/alte-culture-festival.jpg" },
];

function SceneEvents({ lt, dur }: { lt: number; dur: number }) {
  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", left: 80, top: 210 }}>
        <Eyebrow style={rv(lt, 0.05, 0.5, { y: 20 })}>Across Nigeria</Eyebrow>
        <div style={{ ...font.display, fontWeight: 800, fontSize: 124, color: INK, marginTop: 20, letterSpacing: "-0.02em", ...rv(lt, 0.15, 0.7, { y: 50 }) }}>
          Find your night.
        </div>
      </div>

      {EVENT_CARDS.map((e, i) => {
        const a = 0.55 + i * 0.28;
        const p = outBack(seg(lt, a, 0.8));
        const o = clamp(seg(lt, a, 0.3));
        const float = Math.sin(lt * 1.6 + i) * 6;
        return (
          <div
            key={e.title}
            style={{
              position: "absolute",
              left: 80,
              top: 520 + i * 365,
              width: 920,
              height: 330,
              display: "flex",
              borderRadius: 28,
              overflow: "hidden",
              background: SURFACE,
              border: `2px solid ${HAIR}`,
              boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9)",
              opacity: o,
              transform: `perspective(1600px) translate3d(${(1 - p) * 520}px, ${float}px, 0) rotateY(${(1 - p) * -38}deg) rotateZ(${(1 - p) * 4}deg)`,
              willChange: "transform",
            }}
          >
            <div style={{ width: 330, flexShrink: 0, position: "relative", overflow: "hidden" }}>
              <img src={e.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.15 - 0.1 * seg(lt, a, 1.4)})` }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 60%, ${SURFACE})` }} />
            </div>
            <div style={{ padding: "34px 40px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
              <div>
                <div style={{ ...font.display, fontWeight: 700, fontSize: 44, lineHeight: 1.12, color: INK }}>{e.title}</div>
                <div style={{ ...font.body, fontSize: 28, color: MUTED, marginTop: 12 }}>{e.city}</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ ...font.body, fontSize: 22, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>From</div>
                  <div style={{ ...font.display, fontWeight: 700, fontSize: 58, color: INK }}>{naira(e.price)}</div>
                </div>
                <div style={{ ...font.body, fontSize: 24, fontWeight: 700, color: GOLD, border: `2px solid ${GOLD}`, borderRadius: 999, padding: "10px 22px", whiteSpace: "nowrap" }}>
                  {e.tag}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ position: "absolute", left: 80, right: 80, top: 1640, ...font.body, fontSize: 30, color: MUTED, ...rv(lt, 2.3, 0.6, { y: 24 }) }}>
        Instant confirmation. Verified entry.
      </div>
    </Shell>
  );
}

/* ───────────── Scene 3: ticket on WhatsApp ───────────── */
function SceneTicket({ lt, dur }: { lt: number; dur: number }) {
  const scan = (Math.sin(lt * 3.2) + 1) / 2;
  const qrIn = outBack(seg(lt, 1.7, 0.7));
  const valid = seg(lt, 2.7, 0.25);
  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", left: 80, right: 80, top: 210 }}>
        <Eyebrow style={rv(lt, 0.05, 0.5, { y: 20 })}>Checkout</Eyebrow>
        <div style={{ ...font.display, fontWeight: 800, fontSize: 112, lineHeight: 1.06, color: INK, marginTop: 20, letterSpacing: "-0.02em", ...rv(lt, 0.15, 0.7, { y: 50 }) }}>
          Pay once.
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 400, color: GOLD }}>QR lands on WhatsApp.</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 130,
          top: 680,
          width: 820,
          height: 900,
          borderRadius: 44,
          background: "#0B141A",
          border: `2px solid ${HAIR}`,
          overflow: "hidden",
          boxShadow: "0 50px 100px -30px rgba(0,0,0,0.9)",
          ...rv(lt, 0.4, 0.8, { y: 120, r: 2 }),
        }}
      >
        <div style={{ height: 120, background: "#1F2C34", display: "flex", alignItems: "center", gap: 22, padding: "0 36px" }}>
          <div style={{ width: 68, height: 68, borderRadius: 34, background: SURFACE, border: `2px solid ${GOLD}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
            <img src={logoImg} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ ...font.body, fontSize: 32, fontWeight: 700, color: INK }}>Black Heritage</div>
            <div style={{ ...font.body, fontSize: 22, color: "#7EE0A0" }}>Your tickets</div>
          </div>
        </div>

        <div style={{ padding: 34, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ alignSelf: "flex-start", maxWidth: 600, background: "#1F2C34", borderRadius: "8px 28px 28px 28px", padding: "24px 30px", ...rv(lt, 1.0, 0.5, { x: -50 }) }}>
            <div style={{ ...font.body, fontSize: 30, color: INK, lineHeight: 1.35 }}>Payment received.</div>
            <div style={{ ...font.body, fontSize: 28, color: MUTED, marginTop: 6 }}>Festival Lawn Pass · {naira(12500)}</div>
          </div>

          <div style={{ alignSelf: "flex-start", width: 560, background: "#1F2C34", borderRadius: "8px 28px 28px 28px", padding: 26, ...rv(lt, 1.6, 0.5, { x: -50 }) }}>
            <div style={{ ...font.body, fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase" }}>E-ticket</div>
            <div style={{ position: "relative", margin: "20px auto 6px", width: 300, height: 300, background: "#fff", borderRadius: 24, display: "grid", placeItems: "center", transform: `scale(${qrIn})`, overflow: "hidden" }}>
              <QrCode size={250} color="#000" strokeWidth={1.6} />
              <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 92}%`, height: 6, background: GOLD, boxShadow: `0 0 28px 6px ${GOLD}` }} />
              <div style={{ position: "absolute", inset: 0, background: "#1DB954", opacity: valid * 0.9, display: "grid", placeItems: "center" }}>
                <div style={{ ...font.body, fontSize: 96, color: "#fff", fontWeight: 700, transform: `scale(${outBack(valid)})` }}>✓</div>
              </div>
            </div>
            <div style={{ ...font.body, fontSize: 24, color: MUTED, textAlign: "center", marginTop: 12 }}>Show this at the gate</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 80, right: 80, top: 1640, ...font.body, fontSize: 32, color: INK, ...rv(lt, 2.4, 0.6, { y: 24 }) }}>
        E-ticket arrives instantly after payment.
      </div>
    </Shell>
  );
}

/* ───────────── Scene 4: talent ───────────── */
const TALENT_CHIPS = ["DJ", "MC", "Caterer", "Photographer", "Sound Engineer", "Lighting", "Live Band", "Decorator", "Bartender"];

function SceneTalent({ lt, dur }: { lt: number; dur: number }) {
  const press = seg(lt, 2.8, 0.18);
  const pressBack = seg(lt, 2.98, 0.2);
  const btnScale = 1 - 0.05 * press + 0.05 * pressBack;
  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", left: 80, right: 80, top: 210 }}>
        <Eyebrow style={rv(lt, 0.05, 0.5, { y: 20 })}>Talent directory</Eyebrow>
        <div style={{ ...font.display, fontWeight: 800, fontSize: 112, lineHeight: 1.06, color: INK, marginTop: 20, letterSpacing: "-0.02em", ...rv(lt, 0.15, 0.7, { y: 50 }) }}>
          Book the people
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 400, color: GOLD }}>behind the night.</span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 80, right: 80, top: 640, display: "flex", flexWrap: "wrap", gap: 18 }}>
        {TALENT_CHIPS.map((c, i) => (
          <div
            key={c}
            style={{
              ...font.body,
              fontSize: 32,
              fontWeight: 500,
              color: i === 0 ? "#111" : INK,
              background: i === 0 ? GOLD : SURFACE,
              border: `2px solid ${i === 0 ? GOLD : HAIR}`,
              borderRadius: 999,
              padding: "16px 34px",
              ...rv(lt, 0.4 + i * 0.08, 0.45, { y: 30, s: 0.8, back: true }),
            }}
          >
            {c}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          top: 1000,
          width: 920,
          borderRadius: 36,
          background: SURFACE,
          border: `2px solid ${GOLD}66`,
          padding: 44,
          boxShadow: "0 50px 100px -30px rgba(0,0,0,0.9)",
          ...rv(lt, 1.2, 0.7, { y: 140, r: -2, back: true }),
        }}
      >
        <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
          <img src="/dj-zoro.jpg" alt="DJ Zoro Naija" style={{ width: 210, height: 210, borderRadius: 105, objectFit: "cover", border: `4px solid ${GOLD}` }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...font.display, fontWeight: 700, fontSize: 64, color: INK }}>DJ Zoro Naija</div>
            <div style={{ ...font.body, fontSize: 32, color: MUTED, marginTop: 8 }}>DJ · Lagos</div>
            <div style={{ ...font.body, fontSize: 32, color: INK, marginTop: 14 }}>
              <span style={{ color: GOLD }}>★★★★</span>
              <span style={{ color: GOLD, opacity: 0.55 }}>★</span>
              <span style={{ marginLeft: 14, fontWeight: 700 }}>4.5</span>
            </div>
          </div>
        </div>
        <div style={{ ...font.body, fontSize: 30, color: MUTED, lineHeight: 1.4, margin: "34px 0 34px", ...rv(lt, 1.4, 0.45, { y: 16 }) }}>
          Message about your date, venue and budget. You deal, we make the introduction.
        </div>
        <div style={{ ...font.body, fontSize: 34, fontWeight: 700, color: "#111", background: GOLD, borderRadius: 22, padding: "28px 0", textAlign: "center", transform: `scale(${btnScale})`, ...rv(lt, 1.7, 0.45, { y: 20 }) }}>
          Message on WhatsApp
        </div>
      </div>
    </Shell>
  );
}

/* ───────────── Scene 5: organizers ───────────── */
function SignalBars({ lt }: { lt: number }) {
  const lost = seg(lt, 0.9, 0.5);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 40 }}>
      {[14, 22, 30, 40].map((h, i) => (
        <div key={i} style={{ width: 9, height: h, borderRadius: 3, background: lost > i / 4 ? HAIR : INK }} />
      ))}
    </div>
  );
}

function PanelBox({ lt, a, top, children }: { lt: number; a: number; top: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top,
        width: 920,
        height: 315,
        borderRadius: 30,
        background: SURFACE,
        border: `2px solid ${HAIR}`,
        padding: "32px 42px",
        boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9)",
        ...rv(lt, a, 0.65, { x: 160, back: true }),
      }}
    >
      {children}
    </div>
  );
}

function SceneOrganizers({ lt, dur }: { lt: number; dur: number }) {
  const words = ["Sell tickets.", "Scan the gate.", "Get paid."];
  const feeP = outQuart(seg(lt, 1.4, 0.6));
  const save = Math.round(320000 * feeP);
  const clock = seg(lt, 1.9, 0.8);

  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", left: 80, right: 80, top: 190 }}>
        <Eyebrow style={rv(lt, 0.05, 0.5, { y: 20 })}>For organizers</Eyebrow>
        <div style={{ ...font.display, fontWeight: 800, fontSize: 100, lineHeight: 1.06, marginTop: 18, letterSpacing: "-0.02em" }}>
          {words.map((w, i) => (
            <div key={w} style={{ color: i === 2 ? GOLD : INK, fontStyle: i === 2 ? "italic" : "normal", fontWeight: i === 2 ? 400 : 800, ...rv(lt, 0.15 + i * 0.28, 0.6, { y: 50 }) }}>
              {w}
            </div>
          ))}
        </div>
      </div>

      {/* gate */}
      <PanelBox lt={lt} a={0.7} top={600}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase" }}>Offline gate scanning</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <SignalBars lt={lt} />
            <div style={{ ...font.body, fontSize: 22, fontWeight: 700, color: "#111", background: lt > 1.0 ? GOLD : HAIR, borderRadius: 999, padding: "6px 16px", opacity: lt > 1.0 ? 1 : 0.5 }}>OFFLINE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
          <div style={{ flex: 1, background: "#1DB95422", border: "2px solid #1DB954", borderRadius: 20, padding: "24px 28px", ...rv(lt, 1.2, 0.4, { y: 20 }) }}>
            <div style={{ ...font.body, fontSize: 34, fontWeight: 700, color: "#7EE0A0" }}>✓ Valid ticket</div>
            <div style={{ ...font.body, fontSize: 24, color: MUTED, marginTop: 6 }}>Let them in</div>
          </div>
          <div style={{ flex: 1, background: "#E5484D22", border: "2px solid #E5484D", borderRadius: 20, padding: "24px 28px", ...rv(lt, 1.6, 0.4, { y: 20 }) }}>
            <div style={{ ...font.body, fontSize: 34, fontWeight: 700, color: "#FF8A8E" }}>Already used</div>
            <div style={{ ...font.body, fontSize: 24, color: MUTED, marginTop: 6 }}>Duplicate caught</div>
          </div>
        </div>
      </PanelBox>

      {/* fee */}
      <PanelBox lt={lt} a={1.3} top={945}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase" }}>Flat 6% fee</div>
          <div style={{ ...font.body, fontSize: 26, color: MUTED }}>on {naira(8000000)} in sales</div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 24, color: MUTED }}>
            <span>Typical 10% portal</span>
            <span>{naira(800000)}</span>
          </div>
          <div style={{ height: 16, background: HAIR, borderRadius: 8, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${100 * feeP}%`, height: "100%", background: MUTED }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 24, color: INK, marginTop: 16 }}>
            <span>Black Heritage</span>
            <span>{naira(480000)}</span>
          </div>
          <div style={{ height: 16, background: HAIR, borderRadius: 8, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${60 * feeP}%`, height: "100%", background: GOLD }} />
          </div>
        </div>
        <div style={{ ...font.display, fontWeight: 700, fontSize: 40, color: INK, marginTop: 20, textAlign: "right" }}>
          You keep <span style={{ color: GOLD }}>{naira(save)}</span> more
        </div>
      </PanelBox>

      {/* payout */}
      <PanelBox lt={lt} a={1.7} top={1290}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, height: "100%" }}>
          <div style={{ position: "relative", width: 170, height: 170, flexShrink: 0 }}>
            <svg width="170" height="170" viewBox="0 0 170 170">
              <circle cx="85" cy="85" r="74" fill="none" stroke={HAIR} strokeWidth="12" />
              <circle cx="85" cy="85" r="74" fill="none" stroke={GOLD} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 74}`} strokeDashoffset={`${2 * Math.PI * 74 * (1 - clock)}`} transform="rotate(-90 85 85)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...font.display, fontWeight: 800, fontSize: 52, color: INK }}>24h</div>
          </div>
          <div>
            <div style={{ ...font.display, fontWeight: 700, fontSize: 48, lineHeight: 1.15, color: INK }}>Paid to your own bank account</div>
            <div style={{ ...font.body, fontSize: 26, color: MUTED, marginTop: 10 }}>Within 24 hours. The attendee list stays yours.</div>
          </div>
        </div>
      </PanelBox>
    </Shell>
  );
}

/* ───────────── Scene 6: outro ───────────── */
function SceneOutro({ lt, dur }: { lt: number; dur: number }) {
  const glow = outQuart(seg(lt, 0, 1.4));
  return (
    <Shell lt={lt} dur={dur + 10 /* hold final frame */}>
      <div style={{ position: "absolute", left: "50%", top: 760, width: 1100, height: 1100, marginLeft: -550, marginTop: -550, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}38 0%, transparent 62%)`, opacity: glow, transform: `scale(${0.6 + 0.4 * glow})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 460, textAlign: "center" }}>
        <img src={logoImg} alt="Black Heritage" style={{ width: 240, height: 240, objectFit: "contain", ...rv(lt, 0.05, 0.6, { s: 0.7, back: true }) }} />
        <div style={{ ...font.display, fontWeight: 800, fontSize: 132, color: INK, letterSpacing: "-0.02em", marginTop: 28, ...rv(lt, 0.25, 0.6, { y: 40 }) }}>
          Black Heritage
        </div>
        <div style={{ ...font.display, fontStyle: "italic", fontSize: 76, color: GOLD, marginTop: 12, ...rv(lt, 0.5, 0.6, { y: 30 }) }}>
          Your night starts here.
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 52, ...font.body, fontSize: 32, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, ...rv(lt, 0.75, 0.5, { y: 20 }) }}>
          <span>Events</span>
          <span style={{ color: GOLD }}>·</span>
          <span>Talent</span>
          <span style={{ color: GOLD }}>·</span>
          <span>Organizers</span>
        </div>
        <div style={{ display: "inline-block", marginTop: 70, ...font.body, fontSize: 44, fontWeight: 700, color: "#111", background: GOLD, borderRadius: 26, padding: "28px 72px", boxShadow: `0 20px 50px -10px ${GOLD}66`, ...rv(lt, 0.95, 0.6, { y: 30, s: 0.9, back: true }) }}>
          blackhevents.com
        </div>
      </div>
    </Shell>
  );
}

/* ───────────── Stage ───────────── */
function Stage({ t, showCaptions }: { t: number; showCaptions: boolean }) {
  const active = SCENES.find((s, i) => t >= s.start && (t < s.start + s.dur || i === SCENES.length - 1)) || SCENES[0];
  const lt = t - active.start;
  const drift = t * 0.04;

  const activeCue = VOICEOVER_SCRIPT.slice().reverse().find((c) => t >= c.time);

  return (
    <div style={{ position: "relative", width: W, height: H, background: BG, overflow: "hidden", color: INK }}>
      {/* ambient light */}
      <div style={{ position: "absolute", width: 1300, height: 1300, left: -420 + Math.sin(drift * 6) * 120, top: -520 + Math.cos(drift * 5) * 100, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}1f 0%, transparent 62%)` }} />
      <div style={{ position: "absolute", width: 1100, height: 1100, right: -500 + Math.cos(drift * 4) * 100, bottom: -420 + Math.sin(drift * 7) * 90, borderRadius: "50%", background: "radial-gradient(circle, #5B5BD633 0%, transparent 62%)" }} />

      {active.id === "cities" && <SceneCities lt={lt} dur={active.dur} />}
      {active.id === "events" && <SceneEvents lt={lt} dur={active.dur} />}
      {active.id === "ticket" && <SceneTicket lt={lt} dur={active.dur} />}
      {active.id === "talent" && <SceneTalent lt={lt} dur={active.dur} />}
      {active.id === "organizers" && <SceneOrganizers lt={lt} dur={active.dur} />}
      {active.id === "outro" && <SceneOutro lt={lt} dur={active.dur} />}

      {/* corner mark */}
      {active.id !== "outro" && (
        <div style={{ position: "absolute", left: 80, top: 96, display: "flex", alignItems: "center", gap: 16, opacity: 0.9 }}>
          <img src={logoImg} alt="" style={{ width: 52, height: 52, objectFit: "contain" }} />
          <span style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>Black Heritage</span>
        </div>
      )}

      {/* Subtitles / Captions Pill */}
      {showCaptions && activeCue && (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            bottom: 150,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
            opacity: clamp(lt > 0.08 ? 1 : 0),
            transition: "opacity 0.2s ease",
          }}
        >
          <div
            style={{
              background: "rgba(15, 15, 20, 0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(227, 178, 60, 0.35)",
              borderRadius: 20,
              padding: "16px 36px",
              textAlign: "center",
              boxShadow: "0 12px 36px -8px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ ...font.body, fontSize: 28, color: INK, fontWeight: 600, letterSpacing: "0.02em" }}>
              {activeCue.caption}
            </div>
          </div>
        </div>
      )}

      {/* timeline progress */}
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 110, height: 6, background: "#ffffff14", borderRadius: 3 }}>
        <div style={{ width: `${(t / TOTAL) * 100}%`, height: "100%", background: GOLD, borderRadius: 3 }} />
      </div>
    </div>
  );
}

const CAPTION = `Your night starts here.

Black Heritage is live.

Find concerts, parties and festivals across Lagos, Abuja, Port Harcourt and Ibadan. Pay once and your QR e-ticket lands on WhatsApp.

Book the DJs, MCs, caterers and sound crews behind the night, straight from their portfolios.

Organizers: sell tickets, scan the gate offline, get paid in 24 hours.

blackhevents.com

#BlackHeritage #LagosNights #NigeriaEvents #Afrobeats #LagosEvents #BookTalent`;

export default function MotionReel() {
  const clean = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("clean");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sound, setSound] = useState(true);
  const [voiceover, setVoiceover] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [musicGroove, setMusicGroove] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  const prevT = useRef(0);
  const prevVoiceCue = useRef<number>(-1);

  // Resize listener
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Audio settings sync
  useEffect(() => {
    sfx.sfxOn = sound;
    sfx.musicOn = musicGroove;
  }, [sound, musicGroove]);

  // Load voices for Web Speech API
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length > 0) {
        setVoices(all);
        // Find best English voice
        const naturalEnglish =
          all.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Online"))) ||
          all.find((v) => v.lang.startsWith("en-NG")) ||
          all.find((v) => v.lang.startsWith("en-GB")) ||
          all.find((v) => v.lang.startsWith("en-US")) ||
          all[0];
        if (naturalEnglish && !selectedVoice) {
          setSelectedVoice(naturalEnglish.name);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Main playback loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (s: number) => {
      if (last !== null) {
        const d = Math.min(0.08, (s - last) / 1000);
        setT((p) => {
          const next = p + d;
          return next >= TOTAL ? 0 : next;
        });
      }
      last = s;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // SFX cue triggers + groove
  useEffect(() => {
    if (t < prevT.current) {
      prevT.current = -1;
      prevVoiceCue.current = -1;
    }

    // Trigger SFX cues
    if (sound && playing) {
      for (const [at, name] of AUDIO_CUES) {
        if (prevT.current < at && t >= at) {
          (sfx[name] as (vol?: number) => void).call(sfx);
        }
      }

      // Music groove pulse
      if (musicGroove) {
        const stepTime = 0.28; // ~107 BPM 16th grid
        const step = Math.floor(t / stepTime);
        const prevStep = Math.floor(prevT.current / stepTime);
        if (step > prevStep) {
          sfx.grooveBeat(step);
        }
      }
    }

    // Trigger Voiceover narration
    if (voiceover && playing && typeof window !== "undefined" && window.speechSynthesis) {
      for (let i = 0; i < VOICEOVER_SCRIPT.length; i++) {
        const cue = VOICEOVER_SCRIPT[i];
        if (prevT.current < cue.time && t >= cue.time && prevVoiceCue.current !== i) {
          prevVoiceCue.current = i;
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(cue.spoken);
            u.rate = 1.08;
            u.pitch = 0.98;
            if (selectedVoice) {
              const v = voices.find((x) => x.name === selectedVoice);
              if (v) u.voice = v;
            }
            window.speechSynthesis.speak(u);
          } catch (e) {
            console.error("Speech error", e);
          }
        }
      }
    }

    prevT.current = t;
  }, [t, playing, sound, voiceover, musicGroove, selectedVoice, voices]);

  // Handle stop/pause speech cancel
  const handlePlayPause = () => {
    if (playing && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(!playing);
  };

  const handleRestart = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    prevVoiceCue.current = -1;
    setT(0);
  };

  const handleAuditionVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Black Heritage. Your night starts here. Nigeria's best events and talent.");
    u.rate = 1.08;
    u.pitch = 0.98;
    if (selectedVoice) {
      const v = voices.find((x) => x.name === selectedVoice);
      if (v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  };

  const reserveH = clean ? 0 : 150;
  const reserveW = clean ? 0 : 440;
  const scale = Math.max(0.1, Math.min((vp.w - reserveW - 48) / W, (vp.h - reserveH - 24) / H));

  const stage = (
    <div
      style={{
        width: W * scale,
        height: H * scale,
        borderRadius: clean ? 0 : 28 * scale * 2,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: clean ? "none" : "0 30px 80px -20px rgba(0,0,0,0.9)",
        border: clean ? "none" : `1px solid ${HAIR}`,
      }}
    >
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Stage t={t} showCaptions={captions} />
      </div>
    </div>
  );

  if (clean) {
    return <div style={{ minHeight: "100vh", background: "#000", display: "grid", placeItems: "center" }}>{stage}</div>;
  }

  const copy = () => {
    navigator.clipboard.writeText(CAPTION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="min-h-screen bg-[#07070A] text-ink flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-[#0A0A0F]/80 backdrop-blur-md sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5 font-display font-bold text-lg hover:text-gold transition-colors">
          <img src={logoImg} alt="" className="h-7 w-auto" />
          Black Heritage
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline text-muted-ink">
            24s · 1080×1920 9:16 · add <code className="text-gold font-mono">?clean=1</code> to record
          </span>
          <Link href="/" className="px-3.5 py-1.5 rounded-lg bg-surface border border-hairline text-muted-ink hover:text-ink hover:border-gold/40 transition-colors">
            Back to app
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6">
        {stage}

        <aside className="w-full max-w-md space-y-4">
          {/* Playback card */}
          <div className="rounded-xl bg-surface border border-hairline p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-base">Timeline</span>
              <span className="font-mono text-sm text-gold font-semibold">{t.toFixed(1)}s / {TOTAL}s</span>
            </div>

            <input
              type="range"
              min={0}
              max={TOTAL}
              step={0.05}
              value={t}
              onChange={(e) => {
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                setT(parseFloat(e.target.value));
              }}
              className="w-full accent-gold cursor-pointer"
              aria-label="Scrub timeline"
            />

            <div className="flex gap-2">
              <button
                onClick={handlePlayPause}
                className="flex-1 py-3 rounded-lg bg-gold text-[#0F0F14] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all shadow-md shadow-gold/20"
              >
                {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {playing ? "Pause" : "Play Reel"}
              </button>
              <button
                onClick={handleRestart}
                className="px-3.5 rounded-lg bg-surface-2 border border-hairline hover:border-gold/40 text-muted-ink hover:text-ink active:scale-95 transition-all"
                title="Restart"
                aria-label="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSound(!sound)}
                className={`px-3.5 rounded-lg border transition-all ${
                  sound ? "bg-gold/15 border-gold/40 text-gold" : "bg-surface-2 border-hairline text-muted-ink hover:text-ink"
                }`}
                title={sound ? "Mute Studio SFX" : "Unmute Studio SFX"}
                aria-label="Toggle SFX"
              >
                {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Audio & Human Read Controls */}
          <div className="rounded-xl bg-surface border border-hairline p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5">
              <span className="font-display font-bold text-sm">Audio & Voiceover</span>
              <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">Studio Quality</span>
            </div>

            {/* Voiceover Human Read Toggle */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {voiceover ? <Mic className="w-4 h-4 text-gold" /> : <MicOff className="w-4 h-4 text-muted-ink" />}
                <div>
                  <div className="text-sm font-medium">Human Voiceover</div>
                  <div className="text-xs text-muted-ink">Narrates each scene naturally</div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (voiceover && typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                  setVoiceover(!voiceover);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  voiceover ? "bg-gold text-[#0F0F14] border-gold" : "bg-surface-2 border-hairline text-muted-ink hover:text-ink"
                }`}
              >
                {voiceover ? "Active" : "Off"}
              </button>
            </div>

            {/* Voice selector */}
            {voiceover && voices.length > 0 && (
              <div className="pt-2 space-y-1.5 border-t border-hairline/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-ink">Narrator Voice</span>
                  <button
                    onClick={handleAuditionVoice}
                    className="text-[11px] text-gold hover:underline font-medium"
                  >
                    Audition Voice ❯
                  </button>
                </div>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full text-xs bg-[#0F0F14] border border-hairline rounded-lg px-2.5 py-2 text-ink outline-none focus:border-gold/60"
                >
                  {voices
                    .filter((v) => v.lang.startsWith("en"))
                    .map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Captions & Groove Toggles */}
            <div className="pt-2 border-t border-hairline/60 grid grid-cols-2 gap-2">
              <button
                onClick={() => setCaptions(!captions)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  captions ? "bg-gold/15 border-gold/40 text-gold" : "bg-surface-2 border-hairline text-muted-ink hover:text-ink"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {captions ? "Captions: ON" : "Captions: OFF"}
              </button>

              <button
                onClick={() => setMusicGroove(!musicGroove)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  musicGroove ? "bg-gold/15 border-gold/40 text-gold" : "bg-surface-2 border-hairline text-muted-ink hover:text-ink"
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                {musicGroove ? "Groove: ON" : "Groove: OFF"}
              </button>
            </div>
          </div>

          {/* Scenes Jump List */}
          <div className="rounded-xl bg-surface border border-hairline p-5 space-y-2 shadow-xl">
            <div className="font-display font-bold text-sm mb-1">Scenes (Jump to Preview)</div>
            {SCENES.map((scene, i) => {
              const cue = VOICEOVER_SCRIPT[i];
              const on = t >= scene.start && t < scene.start + scene.dur;
              return (
                <button
                  key={scene.id}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.speechSynthesis) {
                      window.speechSynthesis.cancel();
                    }
                    // Jump to 0.6s into the scene so all visuals are clearly visible
                    setT(scene.start + 0.6);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs border transition-all ${
                    on ? "border-gold/60 text-gold bg-gold/10 font-semibold" : "border-hairline text-muted-ink hover:text-ink hover:border-gold/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="font-mono text-gold/80 mr-2">{scene.start.toFixed(1)}s</span>
                      {cue.title}
                    </span>
                    {on && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Instagram Caption Copy */}
          <button
            onClick={copy}
            className="w-full py-3 rounded-xl bg-surface border border-hairline text-sm font-semibold flex items-center justify-center gap-2 hover:border-gold hover:text-gold transition-all shadow-lg active:scale-[0.99]"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Caption copied to clipboard!" : "Copy Instagram Reel Caption"}
          </button>
        </aside>
      </main>
    </div>
  );
}
