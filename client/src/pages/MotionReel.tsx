import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  MessageCircle,
  ShieldCheck,
  Check,
} from "lucide-react";
import logoImg from "@/assets/logo_transparent.png";
export interface CueItem {
  time_s: number;
  frame: number;
  bar?: number;
  sfx?: string;
  picture?: string;
}

export interface CuesManifest {
  source?: string;
  fps: number;
  total_frames: number;
  cues: CueItem[];
}

export function validateCuesManifest(data: any): CuesManifest {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid film/cues.json: file is missing or not a JSON object");
  }
  if (!Array.isArray(data.cues)) {
    throw new Error("Invalid film/cues.json: missing required 'cues' array");
  }
  if (data.cues.length === 0) {
    throw new Error("Invalid film/cues.json: 'cues' array cannot be empty");
  }
  for (let i = 0; i < data.cues.length; i++) {
    const c = data.cues[i];
    if (typeof c.time_s !== "number" || isNaN(c.time_s)) {
      throw new Error(`Invalid cue at index ${i}: time_s must be a valid number, got ${c.time_s}`);
    }
    if (typeof c.frame !== "number" || isNaN(c.frame)) {
      throw new Error(`Invalid cue at index ${i}: frame must be a valid number, got ${c.frame}`);
    }
  }
  return data as CuesManifest;
}

const W = 1080;
const H = 1920;
export const TOTAL = 30.0;
export const FPS = 30;
export const TOTAL_FRAMES = 900;
const GOLD = "#E3B23C";
const INK = "#F7F5EF";
const MUTED = "#9EA0AD";
const BG = "#0A0A0E";
const SURFACE = "#15151C";
const SURFACE_CARD = "#121217";
const HAIR = "#2A2A34";

export const SCENES = [
  { id: "hook", start: 0.0, dur: 4.286, title: "1. Hook (Event Page)" },
  { id: "ticket", start: 4.286, dur: 4.285, title: "2. Checkout & Confirmation" },
  { id: "gate", start: 8.571, dur: 4.286, title: "3. Gate Scan (Offline)" },
  { id: "talent", start: 12.857, dur: 8.572, title: "4. Talent Directory" },
  { id: "payout", start: 21.429, dur: 4.285, title: "5. Payout & Clear Fees" },
  { id: "lockup", start: 25.714, dur: 4.286, title: "6. Logo Lockup" },
] as const;

export const AUDIO_CUES = [
  { id: "C1", time: 0.8, name: "glow_bloom", desc: "Warm ambient sub bloom rising as the event page rises into view." },
  { id: "C2", time: 1.2, name: "sale_hero", desc: "Tactile micro-switch tap and haptic pop as first sale triggers: ticker rolls to 143 and hero toast scales up." },
  { id: "C3", time: 4.2, name: "transition", desc: "Sleek low-frequency air swoosh as device transitions smoothly into checkout form." },
  { id: "C4", time: 6.4, name: "confirm_tick", desc: "Clean haptic payment confirmation tick as payment confirms." },
  { id: "C5", time: 7.5, name: "qr_resolve", desc: "Crisp digital laser wipe sweep resolving the QR ticket pass." },
  { id: "C6", time: 9.6, name: "valid_beep", desc: "High positive gate scanner verification chime (1760 Hz) for first valid entry." },
  { id: "C7", time: 11.8, name: "duplicate_buzz", desc: "Short low-frequency double buzz (140 Hz) flagging already scanned duplicate ticket." },
  { id: "C8", time: 13.0, name: "chips", desc: "Rapid tactile shutter sweep as talent category pills slide into frame." },
  { id: "C9", time: 18.2, name: "tap", desc: "Subtle premium glass tap with gentle sub-bass ripple on direct booking CTA." },
  { id: "C10", time: 23.0, name: "settle", desc: "Harmonic brass settlement chime as payout counter locks to final ₦1,880,000 value." },
  { id: "C11", time: 25.7, name: "swell", desc: "Deep cinematic riser swelling into quiet acoustic brand resonance behind transparent logo lockup." },
];

// Preload screenshots and clip frames
export function preloadReelAssets(): Promise<void> {
  const images = [
    "/screens/S01.png",
    "/screens/S02.png",
    "/screens/S03.png",
    "/screens/S04.png",
    "/screens/S05.png",
    "/screens/S06.png",
    "/screens/S07.png",
    "/screens/S08.png",
    "/screens/S09.png",
    "/screens/S10.png",
    "/film/frames/C05_dj/0001.jpg",
    "/film/frames/C09_cloth/0001.jpg",
    "/film/frames/C03_guests/0001.jpg",
    logoImg,
  ];
  return Promise.all(
    images.map((src) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
      });
    })
  ).then(() => undefined);
}

// ── Strict Cubic-Bezier Easing Solvers ──
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t: number) { return ((ax * t + bx) * t + cx) * t; }
  function sampleCurveY(t: number) { return ((ay * t + by) * t + cy) * t; }
  function sampleCurveDerivativeX(t: number) { return (3 * ax * t + 2 * bx) * t + cx; }

  return function solve(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t) - x;
      if (Math.abs(x2) < 1e-4) return sampleCurveY(t);
      const d2 = sampleCurveDerivativeX(t);
      if (Math.abs(d2) < 1e-4) break;
      t = t - x2 / d2;
    }
    let t0 = 0, t1 = 1;
    t = x;
    while (t0 < t1) {
      const x2 = sampleCurveX(t);
      if (Math.abs(x2 - x) < 1e-4) return sampleCurveY(t);
      if (x > x2) t0 = t; else t1 = t;
      t = (t1 + t0) / 2;
    }
    return sampleCurveY(t);
  };
}

export const easeEntrance = makeBezier(0.16, 1, 0.3, 1);
export const easeMove = makeBezier(0.65, 0, 0.35, 1);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (lt: number, a: number, d: number) => clamp((lt - a) / d);
const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

const font = {
  display: { fontFamily: "'Playfair Display', serif" } as React.CSSProperties,
  body: { fontFamily: "'DM Sans', sans-serif" } as React.CSSProperties,
};

// ── Error Boundary ──
export class SceneErrorBoundary extends React.Component<
  { sceneId: string; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error(`[SceneErrorBoundary] Crash in scene ${this.props.sceneId}:`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          data-allow-overlap="true"
          style={{
            position: "absolute",
            inset: 0,
            padding: 48,
            background: "#160505",
            color: "#FF6B6B",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ ...font.display, fontSize: 36, fontWeight: 800 }}>
            Scene Error: {this.props.sceneId}
          </div>
          <div style={{ ...font.body, fontSize: 20, marginTop: 12, opacity: 0.85 }}>
            {this.state.error?.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Standard Headline Component ──
function Headline({
  lines,
  highlight,
  progress,
  top = 280,
  behind = false,
  opacity,
}: {
  lines: string[];
  highlight?: string;
  progress: number;
  top?: number;
  behind?: boolean;
  opacity?: number;
}) {
  const p = easeEntrance(progress);
  const effectiveOpacity = typeof opacity === "number" ? clamp(opacity) : clamp(p * 2);
  return (
    <div
      data-headline="true"
      data-allow-overlap={behind ? "true" : undefined}
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top,
        textAlign: "center",
        zIndex: behind ? 5 : 30,
        pointerEvents: "none",
        opacity: effectiveOpacity,
        transform: `translate3d(0, ${(1 - p) * 28}px, 0)`,
      }}
    >
      <h1
        style={{
          ...font.display,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.12,
          color: INK,
          letterSpacing: "-0.03em",
          margin: 0,
          padding: 0,
          filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.85))",
        }}
      >
        {lines.map((line, i) => {
          if (!highlight || !line.includes(highlight)) {
            return <div key={i}>{line}</div>;
          }
          const parts = line.split(highlight);
          return (
            <div key={i}>
              {parts[0]}
              <span style={{ color: GOLD }}>{highlight}</span>
              {parts[1]}
            </div>
          );
        })}
      </h1>
    </div>
  );
}

// ── Interactive Tap Cursor Indicator ──
function TapCursor({ x, y, progress }: { x: number; y: number; progress: number }) {
  if (progress <= 0 || progress >= 1) return null;
  const scale = 1 - Math.abs(progress - 0.5) * 0.4;
  const ripple = progress;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 90 * ripple,
          height: 90 * ripple,
          borderRadius: "50%",
          border: `2.5px solid ${GOLD}`,
          opacity: 1 - ripple,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD} 30%, ${GOLD}88 70%)`,
          boxShadow: `0 0 24px ${GOLD}cc`,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

// ── Device Frame Component ──
function PhoneDevice({
  children,
  style = {},
  screenStyle = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  screenStyle?: React.CSSProperties;
}) {
  return (
    <div
      data-phone-device="true"
      style={{
        position: "absolute",
        left: 60,
        top: 480,
        width: 960,
        height: 1360,
        background: "#0E0E14",
        border: `3px solid ${HAIR}`,
        borderRadius: 52,
        boxShadow: `0 0 0 1.5px ${GOLD}26, 0 40px 100px -20px rgba(0,0,0,0.95), 0 0 60px ${GOLD}1a`,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        zIndex: 15,
        ...style,
      }}
    >
      {/* Speaker slot */}
      <div
        data-allow-overlap="true"
        style={{
          width: 72,
          height: 6,
          background: HAIR,
          borderRadius: 3,
          margin: "4px auto 14px",
          flexShrink: 0,
        }}
      />
      {/* Screen container */}
      <div
        style={{
          flex: 1,
          borderRadius: 42,
          overflow: "hidden",
          position: "relative",
          background: SURFACE,
          ...screenStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Deterministic JPEG Sequence Clip Player ──
// Clips come from film/frames/<ID>/ as JPEG sequences. No video elements and no seeking.
function ClipSequence({
  clipId,
  start,
  dur,
  totalFrames = 240,
  t,
  style = {},
}: {
  clipId: string;
  start: number;
  dur: number;
  totalFrames?: number;
  t: number;
  style?: React.CSSProperties;
}) {
  if (t < start || t > start + dur) return null;
  const progress = clamp((t - start) / dur);
  const frameIdx = Math.min(totalFrames, Math.max(1, Math.floor(progress * (totalFrames - 1)) + 1));
  const frameStr = String(frameIdx).padStart(4, "0");
  const src = `/film/frames/${clipId}/${frameStr}.jpg`;

  return (
    <img
      src={src}
      alt={clipId}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/* ───────────── Beat 1 (0.0 to 4.286s): Hook ───────────── */
function SceneHook({ lt }: { lt: number }) {
  const riseProgress = easeEntrance(seg(lt, 0.0, 0.8));
  const cameraPush = easeMove(seg(lt, 0.8, 1.2));
  const isPressed = lt >= 1.15 && lt < 1.35;
  const isSold = lt >= 1.2;
  const ticker = isSold ? 143 : 142;
  const popProgress = easeEntrance(seg(lt, 1.2, 0.4));
  const phoneY = (1 - riseProgress) * 1200;
  const continuousDrift = (lt / 4.286) * 0.04;
  const ambientY = Math.sin(lt * 1.5) * 4;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* C05 DJ booth hook clip from film/frames/C05_dj */}
      {lt < 1.4 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, opacity: clamp((1.4 - lt) * 2) * 0.4, pointerEvents: "none" }}>
          <ClipSequence clipId="C05_dj" start={0} dur={1.4} totalFrames={240} t={lt} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10, 10, 14, 0.7)" }} />
        </div>
      )}

      <Headline
        lines={["Sell out your next event."]}
        highlight="event."
        progress={seg(lt, 0.1, 0.5)}
        top={280}
        behind={true}
      />

      <PhoneDevice
        style={{
          transform: `translate3d(0, ${phoneY + ambientY}px, 0) scale(${1.0 + cameraPush * 0.08 + continuousDrift})`,
          transformOrigin: "center 80%",
        }}
      >
        {/* Real System Screen S01 */}
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <img
            src="/screens/S01.png"
            alt="Abuja Sunset Gala"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
          />

          {/* Tap cursor indicator on Get Tickets */}
          <TapCursor x={464} y={720} progress={seg(lt, 1.0, 0.3)} />

          {/* Real sale toast popup at 1.2s */}
          {popProgress > 0 && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: "50%",
                transform: `translateX(-50%) scale(${0.7 + popProgress * 0.3})`,
                width: "84%",
                background: "rgba(18, 18, 24, 0.96)",
                border: `2px solid ${GOLD}`,
                borderRadius: 24,
                padding: "20px 24px",
                boxShadow: `0 24px 60px rgba(0,0,0,0.9), 0 0 30px ${GOLD}33`,
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: clamp(popProgress * 1.5),
                zIndex: 35,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: `${GOLD}22`,
                  border: `1.5px solid ${GOLD}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: GOLD,
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...font.body, fontSize: 24, fontWeight: 800, color: INK }}>
                  New ticket confirmed
                </div>
                <div style={{ ...font.body, fontSize: 18, color: MUTED, marginTop: 4 }}>
                  VIP Pass · Ref #BH-7KQ2M4XA
                </div>
              </div>
            </div>
          )}
        </div>
      </PhoneDevice>
    </div>
  );
}

/* ───────────── Beat 2 (4.286 to 8.571s): Checkout to Inbox ───────────── */
function SceneTicket({ lt }: { lt: number }) {
  // Phase 1 (0.0 to 2.14s): Checkout form (S02.png), taps Pay at 1.8s
  // Phase 2 (2.14s to 3.21s): Confirmation state (S03.png)
  // Phase 3 (3.21s onwards): Ticket email with QR code (S04.png), QR macro push
  const isConfirmed = lt >= 2.143;
  const isEmailQr = lt >= 3.214;
  const qrPush = easeMove(seg(lt, 3.214, 0.9));
  const headlineFade = clamp(1 - seg(lt, 2.5, 0.5));
  const continuousDrift = (lt / 4.286) * 0.04;
  const ambientY = Math.sin(lt * 1.8) * 3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {lt < 3.05 && (
        <Headline
          lines={["Tickets land in their inbox."]}
          highlight="inbox."
          progress={seg(lt, 0.1, 0.5)}
          top={280}
          opacity={headlineFade}
        />
      )}

      <PhoneDevice
        style={{
          transform: isEmailQr
            ? `scale(${1.0 + qrPush * 0.32 + continuousDrift}) translate3d(0, ${-qrPush * 120 + ambientY}px, 0)`
            : `scale(${1.0 + (isConfirmed ? seg(lt, 2.143, 0.8) * 0.05 : 0) + continuousDrift}) translate3d(0, ${ambientY}px, 0)`,
          transformOrigin: "center 60%",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {!isConfirmed ? (
            <>
              {/* Real Checkout Screen S02 */}
              <img
                src="/screens/S02.png"
                alt="Checkout"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
              {/* Tap cursor on Pay button */}
              <TapCursor x={464} y={980} progress={seg(lt, 1.8, 0.3)} />
            </>
          ) : !isEmailQr ? (
            <>
              {/* Real Confirmation Screen S03 */}
              <img
                src="/screens/S03.png"
                alt="Tickets Confirmed"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
            </>
          ) : (
            <>
              {/* Real Ticket Email & QR Screen S04 */}
              <img
                src="/screens/S04.png"
                alt="Ticket Email with QR"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
            </>
          )}
        </div>
      </PhoneDevice>
    </div>
  );
}

/* ───────────── Beat 3 (8.571 to 12.857s): Gate Scan (Offline) ───────────── */
function SceneGate({ lt }: { lt: number }) {
  // 0.0 to 3.2s: S05.png (Valid ticket)
  // 3.2s onwards: S06.png (Already used duplicate ticket)
  const isDuplicate = lt >= 3.215;
  const validPulse = seg(lt, 1.071, 0.6);
  const shakeProgress = seg(lt, 3.215, 0.6);
  const shakeX = Math.sin(shakeProgress * Math.PI * 8) * 8 * (1 - shakeProgress);
  const continuousDrift = (lt / 4.286) * 0.04;
  const ambientY = Math.sin(lt * 2.0) * 3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Wipe into gate backdrop using film/frames/C09_cloth */}
      {lt < 1.1 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 25, opacity: clamp((1.1 - lt) * 2) * 0.45, pointerEvents: "none" }}>
          <ClipSequence clipId="C09_cloth" start={0} dur={1.1} totalFrames={240} t={lt} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10, 10, 14, 0.55)" }} />
        </div>
      )}

      <Headline
        lines={["Scan the gate. Even offline."]}
        highlight="offline."
        progress={seg(lt, 0.1, 0.5)}
        top={280}
      />

      <PhoneDevice
        style={{
          transform: `translate3d(${isDuplicate ? shakeX : 0}px, ${ambientY}px, 0) scale(${1.0 + continuousDrift})`,
          boxShadow: isDuplicate
            ? `0 0 60px rgba(239, 68, 68, 0.4)`
            : validPulse > 0
            ? `0 0 60px rgba(34, 197, 94, 0.4)`
            : `0 0 0 1.5px ${GOLD}26, 0 40px 100px -20px rgba(0,0,0,0.95)`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <img
            src={isDuplicate ? "/screens/S06.png" : "/screens/S05.png"}
            alt="Gate Scanner"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
          />

          {/* Scanner action tap */}
          {!isDuplicate && (
            <TapCursor x={740} y={328} progress={seg(lt, 0.8, 0.25)} />
          )}
          {isDuplicate && (
            <TapCursor x={740} y={328} progress={seg(lt, 3.1, 0.25)} />
          )}
        </div>
      </PhoneDevice>
    </div>
  );
}

/* ───────────── Beat 4 (12.857 to 21.429s): Talent Directory ───────────── */
function SceneTalent({ lt }: { lt: number }) {
  // Phase 1 (0.0 to 2.14s): Directory category chips (S07.png)
  // Phase 2 (2.14 to 5.35s): Profiles showcase (S08.png), taps Message at 4.8s
  // Phase 3 (5.35s to 8.57s): Message sent state (S09.png)
  const isProfiles = lt >= 2.143;
  const isChat = lt >= 5.357;
  const continuousDrift = (lt / 8.572) * 0.05;
  const ambientY = Math.sin(lt * 1.5) * 4;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Crowd / guests backdrop from film/frames/C03_guests */}
      {lt >= 6.429 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, opacity: clamp((lt - 6.429) * 2) * 0.35, pointerEvents: "none" }}>
          <ClipSequence clipId="C03_guests" start={6.429} dur={2.143} totalFrames={240} t={lt} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10, 10, 14, 0.7)" }} />
        </div>
      )}

      <Headline
        lines={["Need talent? Book here."]}
        highlight="here."
        progress={seg(lt, 0.1, 0.5)}
        top={280}
      />

      <PhoneDevice
        style={{
          transform: `translate3d(0, ${ambientY}px, 0) scale(${1.0 + continuousDrift})`,
          transformOrigin: "center center",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {!isProfiles ? (
            <>
              {/* Real Directory Screen S07 */}
              <img
                src="/screens/S07.png"
                alt="Talent Directory"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            </>
          ) : !isChat ? (
            <>
              {/* Real Profiles Screen S08 */}
              <img
                src="/screens/S08.png"
                alt="Talent Profiles"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
              {/* Tap cursor on Message DJ button */}
              <TapCursor x={464} y={540} progress={seg(lt, 4.8, 0.3)} />
            </>
          ) : (
            <>
              {/* Real Message Sent Screen S09 */}
              <img
                src="/screens/S09.png"
                alt="Chat Sent"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            </>
          )}
        </div>
      </PhoneDevice>
    </div>
  );
}

/* ───────────── Beat 5 (21.429 to 25.714s): Payout & Clear Fees ───────────── */
function ScenePayout({ lt }: { lt: number }) {
  const countProgress = easeEntrance(Math.min(1, lt / 1.6));
  const settledAmount = Math.round(1880000 * countProgress);
  const continuousDrift = (lt / 4.285) * 0.03;
  const ambientY = Math.sin(lt * 1.6) * 3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Headline
        lines={["Clear ticket fees."]}
        highlight="fees."
        progress={seg(lt, 0.1, 0.5)}
        top={280}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate3d(0, ${ambientY}px, 0) scale(${1.0 + continuousDrift})`,
          transformOrigin: "center 60%",
        }}
      >

      {/* Large Naira Counter Display Moment */}
      <div
        data-display-moment="true"
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 480,
          textAlign: "center",
          zIndex: 20,
        }}
      >
        <div
          style={{
            ...font.display,
            fontSize: 160,
            fontWeight: 800,
            color: GOLD,
            letterSpacing: "-0.04em",
            lineHeight: 1.0,
            filter: `drop-shadow(0 0 50px ${GOLD}44)`,
          }}
        >
          {naira(settledAmount)}
        </div>
        <div
          style={{
            ...font.body,
            fontSize: 26,
            fontWeight: 700,
            color: MUTED,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 16,
          }}
        >
          Organizer Share · Sample
        </div>
      </div>

      {/* Clean Arithmetic Box */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 840,
          background: SURFACE,
          border: `2px solid ${HAIR}`,
          borderRadius: 40,
          padding: "48px 52px",
          boxShadow: `0 40px 100px -20px rgba(0,0,0,0.95)`,
          zIndex: 15,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 32, color: MUTED }}>
          <span>Ticket Sales Revenue</span>
          <span style={{ color: INK, fontWeight: 700 }}>₦2,000,000</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", ...font.body, fontSize: 32, color: MUTED, marginTop: 24 }}>
          <span>Flat Platform Fee (6.0%)</span>
          <span style={{ color: GOLD, fontWeight: 700 }}>-₦120,000</span>
        </div>

        <div style={{ height: 1.5, background: HAIR, margin: "28px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ ...font.body, fontSize: 36, color: INK, fontWeight: 800 }}>Organizer Share</span>
          <span style={{ ...font.display, fontSize: 56, fontWeight: 800, color: GOLD }}>
            {naira(settledAmount)}
          </span>
        </div>
      </div>
    </div>
  </div>
  );
}

/* ───────────── Beat 6 (25.714 to 30.0s): Logo Lockup ───────────── */
function SceneLockup({ lt }: { lt: number }) {
  // Final hold starts at frame 836 (27.857s, which is lt >= 2.143s) through 30.0s
  const isStill = lt >= 2.143;
  const p = isStill ? 1.0 : easeEntrance(Math.min(1, lt / 2.143));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Fabric wipe into logo lockup from film/frames/C09_cloth */}
      {lt < 1.2 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, opacity: clamp((1.2 - lt) * 2) * 0.55, pointerEvents: "none" }}>
          <ClipSequence clipId="C09_cloth" start={0} dur={1.2} totalFrames={240} t={lt} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10, 10, 14, 0.55)" }} />
        </div>
      )}

      <Headline
        lines={["Your night starts here."]}
        highlight="here."
        progress={1}
        top={280}
      />

      <div
        data-lockup-brand="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: p,
          transform: `scale(${0.9 + p * 0.1})`,
        }}
      >
        <img
          src={logoImg}
          alt="Black Heritage"
          style={{
            width: 320,
            height: "auto",
            filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.9))",
          }}
        />

        <div
          style={{
            ...font.display,
            fontSize: 56,
            fontWeight: 800,
            color: INK,
            letterSpacing: "0.08em",
            marginTop: 36,
            textAlign: "center",
          }}
        >
          BLACK HERITAGE
        </div>

        {/* Gold domain pill per production pack specification */}
        <div
          style={{
            marginTop: 48,
            padding: "16px 48px",
            background: "rgba(227, 178, 60, 0.12)",
            border: `2px solid ${GOLD}`,
            borderRadius: 999,
            color: GOLD,
            ...font.body,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "0.06em",
            boxShadow: `0 0 40px rgba(227, 178, 60, 0.2)`,
          }}
        >
          blackhevents.com
        </div>
      </div>
    </div>
  );
}

// ── Master Stage ──
function Stage({ t }: { t: number }) {
  const activeScene = SCENES.find((s) => t >= s.start && t < s.start + s.dur) || SCENES[SCENES.length - 1];
  const lt = Math.max(0, t - activeScene.start);

  return (
    <div
      id="motion-reel-stage"
      style={{
        width: W,
        height: H,
        position: "relative",
        background: BG,
        overflow: "hidden",
      }}
    >
      <SceneErrorBoundary sceneId={activeScene.id}>
        {activeScene.id === "hook" && <SceneHook lt={lt} />}
        {activeScene.id === "ticket" && <SceneTicket lt={lt} />}
        {activeScene.id === "gate" && <SceneGate lt={lt} />}
        {activeScene.id === "talent" && <SceneTalent lt={lt} />}
        {activeScene.id === "payout" && <ScenePayout lt={lt} />}
        {activeScene.id === "lockup" && <SceneLockup lt={lt} />}
      </SceneErrorBoundary>
    </div>
  );
}

// ── Main Page Component ──
export default function MotionReel() {
  const isRaw = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("raw") === "1";

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!isRaw); // Autoplay when ?raw=1 is absent
  const [raw] = useState(isRaw);
  const [error, setError] = useState<string | null>(null);
  const [cuesManifest, setCuesManifest] = useState<CuesManifest | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Initialize cues and asset preloading
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        // Read film/cues.json from browser-loadable path
        const res = await fetch("/film/cues.json");
        if (!res.ok) {
          throw new Error(`Failed to load /film/cues.json: HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        const validated = validateCuesManifest(data);
        if (isMounted) setCuesManifest(validated);

        // Preload assets; reject if any fail to load
        await preloadReelAssets();
      } catch (err: any) {
        if (isMounted) {
          console.error("[MotionReel Verification Failure]:", err);
          setError(err.message || String(err));
        }
      }
    }
    init();

    // Expose deterministic time setter for Playwright / headless renderer (?raw=1)
    (window as any).__setReelTime = (time: number, isPlaying = false) => {
      setT(clamp(time, 0, TOTAL));
      setPlaying(isPlaying);
    };

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard shortcut: Space to pause or play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // RequestAnimationFrame playback loop with autoplay and loop
  useEffect(() => {
    if (!playing) {
      lastTimeRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const loop = (now: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (now - lastTimeRef.current) / 1000;
        setT((prev) => {
          const next = prev + delta;
          if (next >= TOTAL) {
            // Loop back seamlessly to 0
            return next % TOTAL;
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing]);

  // Visible Error Overlay (never a blank screen)
  if (error) {
    return (
      <div
        id="motion-reel-error-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "#160505",
          color: "#F7F5EF",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.2)",
            border: "2px solid #EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <XCircle style={{ width: 36, height: 36, color: "#EF4444" }} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#EF4444", margin: "0 0 12px" }}>
          Asset or Cues Load Failure
        </h1>
        <p style={{ fontSize: 16, color: "#9EA0AD", maxWidth: 560, margin: "0 0 24px", lineHeight: 1.5 }}>
          A required system asset or cue manifest failed verification. This visible error prevents silent blank frame captures.
        </p>
        <pre
          style={{
            background: "#260B0B",
            border: "1px solid #7F1D1D",
            color: "#FCA5A5",
            padding: "16px 24px",
            borderRadius: 12,
            fontSize: 14,
            maxWidth: 680,
            overflowX: "auto",
          }}
        >
          {error}
        </pre>
      </div>
    );
  }

  const scale = 0.42;

  return (
    <div className="min-h-screen bg-[#08080C] text-ink flex flex-col items-center p-4 lg:p-8">
      {!raw && (
        <header className="w-full max-w-7xl flex items-center justify-between pb-6 border-b border-hairline mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Motion Reel Studio</h1>
            <p className="text-xs text-muted-ink mt-1">Real System Capture Composite · 1080x1920 · 30.0s · 900 frames · 30 fps</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="px-4 py-2 rounded-lg bg-surface border border-hairline text-xs font-medium hover:border-gold/40">
                Back to Site
              </button>
            </Link>
          </div>
        </header>
      )}

      <main className={`flex ${raw ? "items-center justify-center" : "flex-col lg:flex-row items-center lg:items-start gap-8 max-w-7xl w-full justify-center"}`}>
        {/* Render Stage Container */}
        <div
          onClick={() => {
            if (raw) setPlaying((prev) => !prev);
          }}
          title={raw ? (playing ? "Click to pause" : "Click to play") : undefined}
          style={{
            cursor: raw ? "pointer" : "default",
            width: raw ? W : W * scale,
            height: raw ? H : H * scale,
            position: "relative",
            overflow: "hidden",
            borderRadius: raw ? 0 : 32,
            boxShadow: raw ? "none" : "0 30px 90px rgba(0,0,0,0.9), 0 0 50px rgba(227,178,60,0.15)",
            background: BG,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: raw ? "none" : `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <Stage t={t} />
          </div>
        </div>

        {/* Controls Sidebar with Scrub Bar & Storyboard */}
        {!raw && (
          <aside className="w-full lg:w-96 flex flex-col gap-5">
            <div className="rounded-xl bg-surface border border-hairline p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm">Interactive Player</span>
                <span className="font-mono text-xs text-gold">
                  {t.toFixed(2)}s / {TOTAL.toFixed(2)}s · F{Math.min(TOTAL_FRAMES, Math.floor(t * FPS))}
                </span>
              </div>

              {/* Scrub Bar */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={TOTAL}
                  step={0.0333}
                  value={t}
                  onChange={(e) => {
                    setPlaying(false);
                    setT(parseFloat(e.target.value));
                  }}
                  className="w-full accent-gold cursor-pointer"
                  title="Scrub video timeline"
                />
                <div className="flex justify-between text-[10px] text-muted-ink font-mono px-0.5">
                  <span>0.0s</span>
                  <span>15.0s</span>
                  <span>30.0s</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPlaying(!playing)}
                  className="flex-1 py-2.5 rounded-lg bg-gold text-[#0F0F14] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gold-soft transition-all"
                  title="Press Space to toggle"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {playing ? "Pause (Space)" : "Play (Space)"}
                </button>
                <button
                  onClick={() => setT(0)}
                  className="px-3 py-2.5 rounded-lg bg-surface-2 border border-hairline hover:border-gold/40 text-muted-ink hover:text-ink transition-all"
                  title="Reset to 0s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Storyboard Beats Jump List */}
            <div className="rounded-xl bg-surface border border-hairline p-5 space-y-2 shadow-xl">
              <div className="font-display font-bold text-sm mb-1">Storyboard Beats (112 BPM Grid)</div>
              {SCENES.map((scene) => {
                const on = t >= scene.start && t < scene.start + scene.dur;
                return (
                  <button
                    key={scene.id}
                    onClick={() => {
                      setPlaying(false);
                      setT(scene.start);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs border transition-all ${
                      on ? "border-gold/60 text-gold bg-gold/10 font-semibold" : "border-hairline text-muted-ink hover:text-ink hover:border-gold/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        <span className="font-mono text-gold/80 mr-2">{scene.start.toFixed(1)}s</span>
                        {scene.title}
                      </span>
                      {on && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
