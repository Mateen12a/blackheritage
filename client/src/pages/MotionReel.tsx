import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Copy, Check, QrCode } from "lucide-react";
import logoImg from "@/assets/logo2.png";

/**
 * Black Heritage launch reel. 24 seconds, 1080x1920.
 *
 * Every frame is a pure function of the playhead `t`, so scrubbing, looping and
 * screen-recording are frame-accurate. Copy is lifted from the live product:
 * QR on WhatsApp, offline gate scanning, flat 6% fee, 24-hour payouts, and the
 * talent directory with direct WhatsApp contact. Add ?clean=1 to hide the
 * studio chrome for recording.
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

/* ───────────── Sound (synthesised, no assets) ───────────── */
class Sfx {
  private ctx: AudioContext | null = null;
  on = false;
  private get c() {
    if (!this.ctx && typeof window !== "undefined") {
      const A = window.AudioContext || (window as any).webkitAudioContext;
      if (A) this.ctx = new A();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = "sine", at = 0) {
    const c = this.c;
    if (!c || !this.on) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  hit() { this.tone(150, 40, 0.5, 0.22); }
  tick() { this.tone(1500, 900, 0.07, 0.05, "square"); }
  whoosh() { this.tone(180, 900, 0.3, 0.07, "sawtooth"); }
  chime() { [1046, 1318, 1568].forEach((f, i) => this.tone(f, f, 0.5, 0.1, "triangle", i * 0.09)); }
  beep() { this.tone(1760, 1760, 0.12, 0.07); }
}
const sfx = new Sfx();

// [time, sound]
const CUES: [number, keyof Sfx][] = [
  [0.0, "hit"], [0.6, "tick"], [1.2, "tick"], [1.8, "tick"], [2.3, "whoosh"],
  [3.6, "whoosh"], [4.0, "tick"], [4.5, "tick"], [5.0, "tick"],
  [8.0, "whoosh"], [9.4, "chime"], [10.2, "beep"],
  [12.0, "whoosh"], [14.2, "tick"],
  [16.0, "hit"], [17.4, "beep"], [18.4, "tick"], [19.6, "chime"],
  [20.4, "hit"],
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
      {/* flyer plate behind the word, drifting */}
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

      {/* chat panel */}
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
  const press = seg(lt, 3.1, 0.18);
  const pressBack = seg(lt, 3.28, 0.2);
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
              ...rv(lt, 0.5 + i * 0.09, 0.45, { y: 30, s: 0.8, back: true }),
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
          ...rv(lt, 1.3, 0.8, { y: 140, r: -2, back: true }),
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
        <div style={{ ...font.body, fontSize: 30, color: MUTED, lineHeight: 1.4, margin: "34px 0 34px", ...rv(lt, 2.2, 0.5, { y: 16 }) }}>
          Message about your date, venue and budget. You deal, we make the introduction.
        </div>
        <div style={{ ...font.body, fontSize: 34, fontWeight: 700, color: "#111", background: GOLD, borderRadius: 22, padding: "28px 0", textAlign: "center", transform: `scale(${btnScale})`, ...rv(lt, 2.5, 0.5, { y: 20 }) }}>
          Message on WhatsApp
        </div>
      </div>
    </Shell>
  );
}

/* ───────────── Scene 5: organizers ───────────── */
function SignalBars({ lt }: { lt: number }) {
  // bars drop away around 0.9s to show the network dying while the scan carries on
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
        height: 330,
        borderRadius: 30,
        background: SURFACE,
        border: `2px solid ${HAIR}`,
        padding: "34px 42px",
        boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9)",
        ...rv(lt, a, 0.7, { x: 160, back: true }),
      }}
    >
      {children}
    </div>
  );
}

function SceneOrganizers({ lt, dur }: { lt: number; dur: number }) {
  const words = ["Sell tickets.", "Scan the gate.", "Get paid."];
  const feeP = outQuart(seg(lt, 2.0, 1.0));
  const save = Math.round(320000 * feeP);
  const clock = seg(lt, 3.0, 0.8);
  return (
    <Shell lt={lt} dur={dur}>
      <div style={{ position: "absolute", left: 80, right: 80, top: 200 }}>
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
      <PanelBox lt={lt} a={0.7} top={640}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase" }}>Offline gate scanning</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <SignalBars lt={lt} />
            <div style={{ ...font.body, fontSize: 22, fontWeight: 700, color: "#111", background: lt > 1.0 ? GOLD : HAIR, borderRadius: 999, padding: "6px 16px", opacity: lt > 1.0 ? 1 : 0.5 }}>OFFLINE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 36 }}>
          <div style={{ flex: 1, background: "#1DB95422", border: "2px solid #1DB954", borderRadius: 20, padding: "26px 28px", ...rv(lt, 1.3, 0.4, { y: 20 }) }}>
            <div style={{ ...font.body, fontSize: 36, fontWeight: 700, color: "#7EE0A0" }}>✓ Valid ticket</div>
            <div style={{ ...font.body, fontSize: 24, color: MUTED, marginTop: 6 }}>Let them in</div>
          </div>
          <div style={{ flex: 1, background: "#E5484D22", border: "2px solid #E5484D", borderRadius: 20, padding: "26px 28px", ...rv(lt, 1.8, 0.4, { y: 20 }) }}>
            <div style={{ ...font.body, fontSize: 36, fontWeight: 700, color: "#FF8A8E" }}>Already used</div>
            <div style={{ ...font.body, fontSize: 24, color: MUTED, marginTop: 6 }}>Duplicate caught</div>
          </div>
        </div>
      </PanelBox>

      {/* fee */}
      <PanelBox lt={lt} a={1.5} top={1000}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase" }}>Flat 6% fee</div>
          <div style={{ ...font.body, fontSize: 26, color: MUTED }}>on {naira(8000000)} in sales</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 24, color: MUTED }}>
            <span>Typical 10% portal</span>
            <span>{naira(800000)}</span>
          </div>
          <div style={{ height: 18, background: HAIR, borderRadius: 9, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${100 * feeP}%`, height: "100%", background: MUTED }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 24, color: INK, marginTop: 20 }}>
            <span>Black Heritage</span>
            <span>{naira(480000)}</span>
          </div>
          <div style={{ height: 18, background: HAIR, borderRadius: 9, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${60 * feeP}%`, height: "100%", background: GOLD }} />
          </div>
        </div>
        <div style={{ ...font.display, fontWeight: 700, fontSize: 44, color: INK, marginTop: 24, textAlign: "right" }}>
          You keep <span style={{ color: GOLD }}>{naira(save)}</span> more
        </div>
      </PanelBox>

      {/* payout */}
      <PanelBox lt={lt} a={2.3} top={1360}>
        <div style={{ display: "flex", alignItems: "center", gap: 44, height: "100%" }}>
          <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="78" fill="none" stroke={HAIR} strokeWidth="12" />
              <circle cx="90" cy="90" r="78" fill="none" stroke={GOLD} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 78}`} strokeDashoffset={`${2 * Math.PI * 78 * (1 - clock)}`} transform="rotate(-90 90 90)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...font.display, fontWeight: 800, fontSize: 56, color: INK }}>24h</div>
          </div>
          <div>
            <div style={{ ...font.display, fontWeight: 700, fontSize: 54, lineHeight: 1.1, color: INK }}>Paid to your own bank account</div>
            <div style={{ ...font.body, fontSize: 28, color: MUTED, marginTop: 14 }}>Within 24 hours. The attendee list stays yours.</div>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 480, textAlign: "center" }}>
        <img src={logoImg} alt="Black Heritage" style={{ width: 240, height: 240, objectFit: "contain", ...rv(lt, 0.1, 0.9, { s: 0.5, back: true }) }} />
        <div style={{ ...font.display, fontWeight: 800, fontSize: 132, color: INK, letterSpacing: "-0.02em", marginTop: 30, ...rv(lt, 0.45, 0.7, { y: 50 }) }}>
          Black Heritage
        </div>
        <div style={{ ...font.display, fontStyle: "italic", fontSize: 76, color: GOLD, marginTop: 14, ...rv(lt, 0.8, 0.7, { y: 40 }) }}>
          Your night starts here.
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 60, ...font.body, fontSize: 32, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, ...rv(lt, 1.2, 0.6, { y: 24 }) }}>
          <span>Events</span>
          <span style={{ color: GOLD }}>·</span>
          <span>Talent</span>
          <span style={{ color: GOLD }}>·</span>
          <span>Organizers</span>
        </div>
        <div style={{ display: "inline-block", marginTop: 90, ...font.body, fontSize: 44, fontWeight: 700, color: "#111", background: GOLD, borderRadius: 26, padding: "30px 72px", ...rv(lt, 1.6, 0.7, { y: 40, s: 0.9, back: true }) }}>
          blackhevents.com
        </div>
      </div>
    </Shell>
  );
}

/* ───────────── Stage ───────────── */
function Stage({ t }: { t: number }) {
  const active = SCENES.find((s, i) => t >= s.start && (t < s.start + s.dur || i === SCENES.length - 1)) || SCENES[0];
  const lt = t - active.start;
  const drift = t * 0.04;
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

      {/* corner mark + progress */}
      {active.id !== "outro" && (
        <div style={{ position: "absolute", left: 80, top: 96, display: "flex", alignItems: "center", gap: 16, opacity: 0.9 }}>
          <img src={logoImg} alt="" style={{ width: 52, height: 52, objectFit: "contain" }} />
          <span style={{ ...font.body, fontSize: 26, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>Black Heritage</span>
        </div>
      )}
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 120, height: 5, background: "#ffffff14", borderRadius: 3 }}>
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

#BlackHeritage #LagosNights #NigeriaEvents #Afrobeats #LagosEvents`;

export default function MotionReel() {
  const clean = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("clean");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sound, setSound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  const prev = useRef(0);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    sfx.on = sound;
  }, [sound]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (s: number) => {
      if (last !== null) {
        const d = Math.min(0.1, (s - last) / 1000);
        setT((p) => (p + d >= TOTAL ? 0 : p + d));
      }
      last = s;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (t < prev.current) prev.current = -1;
    for (const [at, name] of CUES) {
      if (prev.current < at && t >= at && playing) (sfx[name] as () => void).call(sfx);
    }
    prev.current = t;
  }, [t, playing]);

  const reserveH = clean ? 0 : 150;
  const reserveW = clean ? 0 : 420;
  const scale = Math.max(0.1, Math.min((vp.w - reserveW - 48) / W, (vp.h - reserveH - 24) / H));

  const stage = (
    <div style={{ width: W * scale, height: H * scale, borderRadius: clean ? 0 : 28 * scale * 2, overflow: "hidden", flexShrink: 0, boxShadow: clean ? "none" : "0 30px 80px -20px rgba(0,0,0,0.9)", border: clean ? "none" : `1px solid ${HAIR}` }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Stage t={t} />
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
      <header className="flex items-center justify-between px-6 py-4 border-b border-hairline">
        <Link href="/" className="flex items-center gap-2.5 font-display font-bold text-lg">
          <img src={logoImg} alt="" className="h-7 w-auto" />
          Black Heritage
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden sm:inline text-muted-ink">24s · 1080×1920 · add <code className="text-gold">?clean=1</code> to record</span>
          <Link href="/" className="px-3 py-1.5 rounded-md bg-surface-2 border border-hairline text-muted-ink hover:text-ink">Back to app</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6">
        {stage}

        <aside className="w-full max-w-sm space-y-4">
          <div className="rounded-xl bg-surface border border-hairline p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">Playback</span>
              <span className="font-mono text-xs text-gold">{t.toFixed(1)}s / {TOTAL}s</span>
            </div>
            <input type="range" min={0} max={TOTAL} step={0.05} value={t} onChange={(e) => setT(parseFloat(e.target.value))} className="w-full accent-gold" aria-label="Scrub timeline" />
            <div className="flex gap-2">
              <button onClick={() => setPlaying(!playing)} className="flex-1 py-2.5 rounded-lg bg-gold text-black font-bold text-sm flex items-center justify-center gap-2">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={() => setT(0)} className="px-3 rounded-lg bg-surface-2 border border-hairline" aria-label="Restart"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => setSound(!sound)} className="px-3 rounded-lg bg-surface-2 border border-hairline" aria-label="Toggle sound">
                {sound ? <Volume2 className="w-4 h-4 text-gold" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-hairline p-4 space-y-2">
            <div className="font-display font-bold mb-1">Scenes</div>
            {[
              ["Nigeria's best nights", 0],
              ["Find your night", 3.6],
              ["QR lands on WhatsApp", 8],
              ["Book the people behind the night", 12],
              ["Sell. Scan. Get paid.", 16],
              ["Your night starts here", 20.4],
            ].map(([label, at]) => {
              const on = t >= (at as number) && t < (at as number) + 3.5;
              return (
                <button key={label as string} onClick={() => setT(at as number)} className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${on ? "border-gold/60 text-gold bg-gold/10" : "border-hairline text-muted-ink hover:text-ink"}`}>
                  <span className="font-mono text-xs mr-2">{(at as number).toFixed(1)}s</span>{label}
                </button>
              );
            })}
          </div>

          <button onClick={copy} className="w-full py-2.5 rounded-lg bg-surface border border-hairline text-sm font-medium flex items-center justify-center gap-2 hover:border-gold">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Caption copied" : "Copy Instagram caption"}
          </button>
        </aside>
      </main>
    </div>
  );
}
